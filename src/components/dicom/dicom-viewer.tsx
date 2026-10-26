'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Types } from '@cornerstonejs/core';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import {
  buildImageIds,
  isMultiFrame,
  layoutCells,
  overlayText,
  presetsFor,
  voiRangeToWindow,
  windowToVoiRange,
  type DicomInstanceSummary,
  type DicomSeriesSummary,
  type DicomStudySummary,
  type ViewerLayout,
  type WindowPreset,
} from '@/lib/dicom';
import { configureToolGroup, getOrCreateEngine, loadCornerstone, RENDERING_ENGINE_ID, TOOL_GROUP_ID, type Cornerstone, type PrimaryTool } from './cornerstone-runtime';

type StackViewport = Types.IStackViewport;

interface CellState {
  seriesUid: string | null;
  index: number;
  total: number;
  window: { width: number; center: number } | null;
  zoom: number | null;
  error: boolean;
}

const EMPTY_CELL: CellState = { seriesUid: null, index: 0, total: 0, window: null, zoom: null, error: false };
const viewportIdOf = (cell: number) => `bb-vp-${cell}`;
const TOOLS: PrimaryTool[] = ['WindowLevel', 'Pan', 'Zoom', 'Length', 'Angle', 'EllipticalROI'];

export interface ViewerPatient {
  name: string | null;
  age: number | null;
  sex: string | null;
}

/**
 * Diagnostic-style viewer for the DICOM studies of one exam: series strip, 1×1/1×2/2×2 stack viewports,
 * window/level, pan, zoom, scroll, measurements, cine. Images are streamed from the API (WADO) with the
 * session token; nothing is saved (measurements stay in the browser).
 */
export function DicomViewer({ study, patient }: { study: DicomStudySummary; patient: ViewerPatient }) {
  const { t, formatDate } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Array<HTMLDivElement | null>>([null, null, null, null]);
  const csRef = useRef<Cornerstone | null>(null);
  const instancesBySeries = useRef(new Map<string, DicomInstanceSummary[]>());
  const [ready, setReady] = useState(false);
  const [engineError, setEngineError] = useState(false);
  const [layout, setLayout] = useState<ViewerLayout>('1x1');
  const [active, setActive] = useState(0);
  const [tool, setTool] = useState<PrimaryTool>('WindowLevel');
  const [cells, setCells] = useState<CellState[]>([EMPTY_CELL, EMPTY_CELL, EMPTY_CELL, EMPTY_CELL]);
  const [playing, setPlaying] = useState<Record<number, boolean>>({});
  const [fps, setFps] = useState(15);
  const series = study.series;
  const count = layoutCells(layout);

  const seriesOf = useCallback((uid: string | null) => series.find((s) => s.seriesInstanceUid === uid) ?? null, [series]);

  // ---------- engine ----------

  useEffect(() => {
    let live = true;
    const elements = cellRefs.current;
    loadCornerstone()
      .then((cs) => {
        if (!live) return;
        csRef.current = cs;
        getOrCreateEngine(cs);
        setReady(true);
      })
      .catch(() => live && setEngineError(true));
    return () => {
      live = false;
      const cs = csRef.current;
      if (!cs) return;
      for (const el of elements) {
        if (el) cs.tools.utilities.cine.stopClip(el);
      }
      cs.tools.ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID);
      cs.core.getRenderingEngine(RENDERING_ENGINE_ID)?.destroy();
    };
  }, []);

  const viewport = useCallback((cell: number): StackViewport | null => {
    const cs = csRef.current;
    const engine = cs?.core.getRenderingEngine(RENDERING_ENGINE_ID);
    return (engine?.getViewport(viewportIdOf(cell)) as StackViewport | undefined) ?? null;
  }, []);

  const readCell = useCallback(
    (cell: number) => {
      const vp = viewport(cell);
      if (!vp) return;
      const props = vp.getProperties();
      setCells((prev) => {
        const next = [...prev];
        next[cell] = {
          ...next[cell],
          index: vp.getCurrentImageIdIndex(),
          total: vp.getImageIds().length,
          window: props.voiRange ? voiRangeToWindow(props.voiRange) : null,
          zoom: vp.getZoom(),
        };
        return next;
      });
    },
    [viewport]
  );

  const instancesFor = useCallback(
    async (s: DicomSeriesSummary) => {
      const cached = instancesBySeries.current.get(s.seriesInstanceUid);
      if (cached) return cached;
      const list = await api.getDicomInstances(study.studyInstanceUid, s.seriesInstanceUid);
      instancesBySeries.current.set(s.seriesInstanceUid, list);
      return list;
    },
    [study.studyInstanceUid]
  );

  /** Show a series in a cell (enabling the viewport the first time) */
  const loadSeries = useCallback(
    async (cell: number, s: DicomSeriesSummary) => {
      const cs = csRef.current;
      const element = cellRefs.current[cell];
      if (!cs || !element) return;
      const engine = getOrCreateEngine(cs);
      const id = viewportIdOf(cell);
      if (!engine.getViewport(id)) {
        engine.enableElement({ viewportId: id, type: cs.core.Enums.ViewportType.STACK, element, defaultOptions: { background: [0, 0, 0] } });
      }
      cs.tools.utilities.cine.stopClip(element);
      setPlaying((p) => ({ ...p, [cell]: false }));
      setCells((prev) => {
        const next = [...prev];
        next[cell] = { ...EMPTY_CELL, seriesUid: s.seriesInstanceUid };
        return next;
      });
      configureToolGroup(cs, [id], tool);
      try {
        const instances = await instancesFor(s);
        const ids = buildImageIds(api.apiBaseUrl(), study.studyInstanceUid, s.seriesInstanceUid, instances);
        const vp = engine.getViewport(id) as StackViewport;
        await vp.setStack(ids, 0);
        vp.render();
        readCell(cell);
      } catch {
        setCells((prev) => {
          const next = [...prev];
          next[cell] = { ...next[cell], error: true };
          return next;
        });
      }
    },
    [instancesFor, readCell, study.studyInstanceUid, tool]
  );

  // First series in the first cells once the engine is up and when the layout grows
  useEffect(() => {
    if (!ready) return;
    for (let cell = 0; cell < count; cell += 1) {
      if (!cells[cell].seriesUid && series.length) void loadSeries(cell, series[Math.min(cell, series.length - 1)]);
    }
    // Cells beyond the layout are released
    const cs = csRef.current;
    const engine = cs?.core.getRenderingEngine(RENDERING_ENGINE_ID);
    for (let cell = count; cell < 4; cell += 1) {
      if (engine?.getViewport(viewportIdOf(cell))) {
        const el = cellRefs.current[cell];
        if (el) cs!.tools.utilities.cine.stopClip(el);
        engine.disableElement(viewportIdOf(cell));
        setCells((prev) => {
          const next = [...prev];
          next[cell] = EMPTY_CELL;
          return next;
        });
      }
    }
    engine?.resize(true, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when the engine starts or the layout changes
  }, [ready, count]);

  // Tool change applies to every viewport
  useEffect(() => {
    const cs = csRef.current;
    if (!ready || !cs) return;
    const ids = Array.from({ length: count }, (_, i) => viewportIdOf(i)).filter((id) => cs.core.getRenderingEngine(RENDERING_ENGINE_ID)?.getViewport(id));
    if (ids.length) configureToolGroup(cs, ids, tool);
  }, [tool, ready, count, cells]);

  // Overlay values follow rendering (scroll, W/L, zoom)
  useEffect(() => {
    const cs = csRef.current;
    if (!ready || !cs) return;
    const Events = cs.core.Enums.Events;
    const handlers: Array<() => void> = [];
    for (let cell = 0; cell < count; cell += 1) {
      const el = cellRefs.current[cell];
      if (!el) continue;
      const onRender = () => readCell(cell);
      const onError = () =>
        setCells((prev) => {
          const next = [...prev];
          next[cell] = { ...next[cell], error: true };
          return next;
        });
      el.addEventListener(Events.IMAGE_RENDERED, onRender);
      el.addEventListener(Events.IMAGE_LOAD_ERROR, onError);
      handlers.push(() => {
        el.removeEventListener(Events.IMAGE_RENDERED, onRender);
        el.removeEventListener(Events.IMAGE_LOAD_ERROR, onError);
      });
    }
    return () => handlers.forEach((h) => h());
  }, [ready, count, readCell]);

  // Keep the canvases sized to their cells
  useEffect(() => {
    const el = containerRef.current;
    if (!ready || !el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => csRef.current?.core.getRenderingEngine(RENDERING_ENGINE_ID)?.resize(true, false));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready]);

  // ---------- actions on the active cell ----------

  const withActive = useCallback(
    (fn: (vp: StackViewport) => void) => {
      const vp = viewport(active);
      if (!vp) return;
      fn(vp);
      vp.render();
      readCell(active);
    },
    [active, readCell, viewport]
  );

  const reset = useCallback(() => withActive((vp) => {
    vp.resetCamera();
    vp.resetProperties();
  }), [withActive]);
  const invert = useCallback(() => withActive((vp) => vp.setProperties({ invert: !vp.getProperties().invert })), [withActive]);
  const rotate = useCallback(() => withActive((vp) => {
    const current = vp.getViewPresentation().rotation ?? 0;
    vp.setViewPresentation({ rotation: (current + 90) % 360 });
  }), [withActive]);
  const flip = useCallback(() => withActive((vp) => {
    const camera = vp.getCamera();
    vp.setCamera({ flipHorizontal: !camera.flipHorizontal });
  }), [withActive]);
  const applyPreset = (p: WindowPreset) => withActive((vp) => vp.setProperties({ voiRange: windowToVoiRange(p.width, p.center) }));
  const scrollBy = useCallback((delta: number) => withActive((vp) => vp.scroll(delta)), [withActive]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }, []);

  const togglePlay = () => {
    const cs = csRef.current;
    const el = cellRefs.current[active];
    if (!cs || !el) return;
    if (playing[active]) cs.tools.utilities.cine.stopClip(el);
    else cs.tools.utilities.cine.playClip(el, { framesPerSecond: fps, loop: true });
    setPlaying((p) => ({ ...p, [active]: !p[active] }));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input,select,textarea')) return;
    const key = e.key.toLowerCase();
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') scrollBy(1);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') scrollBy(-1);
    else if (key === 'r') reset();
    else if (key === 'i') invert();
    else if (key === 'f') toggleFullscreen();
    else return;
    e.preventDefault();
  };

  const activeSeries = seriesOf(cells[active].seriesUid);
  const presets = presetsFor(activeSeries?.modality ?? study.modality);
  const activeInstances = activeSeries ? instancesBySeries.current.get(activeSeries.seriesInstanceUid) ?? [] : [];
  const canPlay = cells[active].total > 1 && (isMultiFrame(activeInstances) || cells[active].total > 1);

  const gridClass = layout === '1x1' ? 'grid-cols-1 grid-rows-1' : layout === '1x2' ? 'grid-cols-2 grid-rows-1' : 'grid-cols-2 grid-rows-2';
  const btn = 'px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-200 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-400';
  const btnOn = 'bg-lime-400 text-gray-900 hover:bg-lime-300';

  if (engineError) return <div className="p-6 rounded-2xl bg-gray-950 text-red-300 text-sm">{t('dicom.engineFailed')}</div>;

  return (
    <div ref={containerRef} tabIndex={0} onKeyDown={onKeyDown} className="flex flex-col bg-gray-950 text-gray-100 rounded-2xl overflow-hidden outline-none min-h-[70vh] [&:fullscreen]:rounded-none">
      {/* Toolbar */}
      <div role="toolbar" aria-label={t('dicom.title')} className="flex flex-wrap items-center gap-1 p-2 border-b border-white/10">
        {TOOLS.map((k) => (
          <button key={k} type="button" aria-pressed={tool === k} onClick={() => setTool(k)} className={`${btn} ${tool === k ? btnOn : ''}`}>
            {t(`dicom.tool.${k}`)}
          </button>
        ))}
        <span className="w-px h-5 bg-white/15 mx-1" aria-hidden="true" />
        <button type="button" onClick={reset} className={btn}>{t('dicom.action.reset')}</button>
        <button type="button" onClick={invert} className={btn}>{t('dicom.action.invert')}</button>
        <button type="button" onClick={rotate} className={btn}>{t('dicom.action.rotate')}</button>
        <button type="button" onClick={flip} className={btn}>{t('dicom.action.flip')}</button>
        <button type="button" onClick={toggleFullscreen} className={btn}>{t('dicom.action.fullscreen')}</button>
        {presets.length > 0 && (
          <>
            <span className="w-px h-5 bg-white/15 mx-1" aria-hidden="true" />
            <label className="sr-only" htmlFor="dicom-preset">{t('dicom.presets')}</label>
            <select
              id="dicom-preset"
              defaultValue=""
              onChange={(e) => {
                const p = presets.find((x) => x.key === e.target.value);
                if (p) applyPreset(p);
                e.target.value = '';
              }}
              className="bg-gray-900 border border-white/15 rounded-lg text-xs px-2 py-1.5"
            >
              <option value="" disabled>{t('dicom.presets')}</option>
              {presets.map((p) => (
                <option key={p.key} value={p.key}>{`${t(p.labelKey)} (W${p.width}/L${p.center})`}</option>
              ))}
            </select>
          </>
        )}
        {canPlay && (
          <>
            <span className="w-px h-5 bg-white/15 mx-1" aria-hidden="true" />
            <button type="button" onClick={togglePlay} className={`${btn} ${playing[active] ? btnOn : ''}`}>{playing[active] ? t('dicom.action.pause') : t('dicom.action.play')}</button>
            <label className="flex items-center gap-1 text-xs text-gray-300">
              <input type="range" min={2} max={60} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="w-20 accent-lime-400" aria-label={t('dicom.fps', { n: fps })} />
              {t('dicom.fps', { n: fps })}
            </label>
          </>
        )}
        <span className="ml-auto flex items-center gap-1 text-xs text-gray-300">
          {t('dicom.layout')}
          {(['1x1', '1x2', '2x2'] as ViewerLayout[]).map((l) => (
            <button key={l} type="button" aria-pressed={layout === l} onClick={() => setLayout(l)} className={`${btn} ${layout === l ? btnOn : ''}`}>
              {l.replace('x', '×')}
            </button>
          ))}
        </span>
      </div>

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        {/* Series strip */}
        <nav aria-label={t('dicom.series')} className="md:w-48 shrink-0 border-b md:border-b-0 md:border-r border-white/10 p-2 flex md:flex-col gap-2 overflow-auto">
          {series.map((s) => (
            <SeriesThumb key={s.seriesInstanceUid} studyUid={study.studyInstanceUid} series={s} ready={ready} cs={csRef} instancesFor={instancesFor}
              selected={cells[active].seriesUid === s.seriesInstanceUid}
              onPick={() => void loadSeries(active, s)}
            />
          ))}
        </nav>

        {/* Viewports */}
        <div className={`flex-1 grid ${gridClass} gap-px bg-white/10 min-h-[60vh]`}>
          {[0, 1, 2, 3].map((cell) => {
            const visible = cell < count;
            const s = seriesOf(cells[cell].seriesUid);
            const ov = overlayText(
              {
                patientName: patient.name,
                age: patient.age,
                sex: patient.sex,
                studyDate: study.studyDate,
                seriesDescription: s?.description ?? null,
                modality: s?.modality ?? study.modality,
                window: cells[cell].window,
                zoom: cells[cell].zoom,
                index: cells[cell].index,
                total: cells[cell].total,
              },
              (iso) => formatDate(`${iso}T12:00:00`)
            );
            return (
              <div
                key={cell}
                className={`relative bg-black ${visible ? '' : 'hidden'} ${active === cell && count > 1 ? 'ring-2 ring-inset ring-lime-400' : ''}`}
                onMouseDown={() => setActive(cell)}
                onTouchStart={() => setActive(cell)}
              >
                <div ref={(el) => { cellRefs.current[cell] = el; }} className="absolute inset-0" onContextMenu={(e) => e.preventDefault()} />
                {/* Corner texts (not interactive) */}
                <div className="pointer-events-none absolute inset-0 p-2 text-[11px] leading-4 text-lime-100/90 font-mono [text-shadow:0_0_3px_#000]">
                  <div className="absolute top-2 left-2">{ov.topLeft.map((l) => <div key={l}>{l}</div>)}</div>
                  <div className="absolute top-2 right-2 text-right">{ov.topRight.map((l) => <div key={l}>{l}</div>)}</div>
                  <div className="absolute bottom-2 left-2">{ov.bottomLeft.map((l) => <div key={l}>{l}</div>)}</div>
                  <div className="absolute bottom-2 right-2 text-right">{ov.bottomRight.map((l) => <div key={l}>{l}</div>)}</div>
                </div>
                {visible && !cells[cell].seriesUid && <p className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">{t('dicom.emptyCell')}</p>}
                {cells[cell].error && <p role="alert" className="absolute inset-x-0 top-1/2 text-center text-sm text-red-300">{t('dicom.imageError')}</p>}
              </div>
            );
          })}
        </div>
      </div>

      <p className="px-3 py-2 text-[11px] text-gray-400 border-t border-white/10">
        {t('dicom.measuresNote')} · {t('dicom.shortcuts')}
      </p>
    </div>
  );
}

/** Series card: description, count and the first image drawn small */
function SeriesThumb({
  studyUid,
  series,
  ready,
  cs,
  instancesFor,
  selected,
  onPick,
}: {
  studyUid: string;
  series: DicomSeriesSummary;
  ready: boolean;
  cs: React.RefObject<Cornerstone | null>;
  instancesFor: (s: DicomSeriesSummary) => Promise<DicomInstanceSummary[]>;
  selected: boolean;
  onPick: () => void;
}) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const label = useMemo(() => [series.seriesNumber != null ? `#${series.seriesNumber}` : null, series.modality, series.description || t('dicom.noDescription')].filter(Boolean).join(' · '), [series, t]);

  useEffect(() => {
    const runtime = cs.current;
    const canvas = canvasRef.current;
    if (!ready || !runtime || !canvas) return;
    let live = true;
    instancesFor(series)
      .then((instances) => {
        const first = buildImageIds(api.apiBaseUrl(), studyUid, series.seriesInstanceUid, instances)[0];
        if (live && first) return runtime.core.utilities.loadImageToCanvas({ canvas, imageId: first, thumbnail: true });
      })
      .catch(() => {
        // A thumbnail is optional: the card still opens the series
      });
    return () => {
      live = false;
    };
  }, [ready, cs, instancesFor, series, studyUid]);

  return (
    <button type="button" onClick={onPick} aria-pressed={selected} className={`shrink-0 w-36 md:w-full text-left rounded-xl p-1.5 border ${selected ? 'border-lime-400 bg-white/5' : 'border-white/10 hover:border-white/30'}`}>
      <canvas ref={canvasRef} width={160} height={120} className="w-full aspect-[4/3] bg-black rounded-md" aria-hidden="true" />
      <span className="block mt-1 text-[11px] text-gray-200 truncate" title={label}>{label}</span>
      <span className="block text-[11px] text-gray-400">{t('dicom.seriesCount', { n: series.numberOfInstances })}</span>
    </button>
  );
}
