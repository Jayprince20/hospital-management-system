'use client';

import { api } from '@/lib/api';

/**
 * Cornerstone3D loaded on demand in the browser (never during server rendering): core, tools and
 * the DICOM image loader, initialised once per page load. Image requests go to the API on another
 * origin, so every request gets the session token (refreshed when about to expire). Codec .wasm files
 * are served from /dicom-codecs (copied by scripts/copy-dicom-codecs.mjs).
 */

export type CsCore = typeof import('@cornerstonejs/core');
export type CsTools = typeof import('@cornerstonejs/tools');

export interface Cornerstone {
  core: CsCore;
  tools: CsTools;
}

export const RENDERING_ENGINE_ID = 'bb-dicom-engine';
export const TOOL_GROUP_ID = 'bb-dicom-tools';
export const CODEC_BASE_PATH = '/dicom-codecs';

let loading: Promise<Cornerstone> | null = null;

export function loadCornerstone(): Promise<Cornerstone> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Cornerstone runs in the browser only'));
  if (!loading) {
    loading = (async () => {
      const [core, tools, loaderModule] = await Promise.all([
        import('@cornerstonejs/core'),
        import('@cornerstonejs/tools'),
        import('@cornerstonejs/dicom-image-loader'),
      ]);
      if (!core.isCornerstoneInitialized()) core.init();
      const dicomImageLoader = loaderModule.default;
      dicomImageLoader.init({
        maxWebWorkers: Math.max(1, Math.min(4, Math.floor((navigator.hardwareConcurrency || 2) / 2))),
        wasmBasePath: `${window.location.origin}${CODEC_BASE_PATH}`,
        beforeSend: async () => api.dicomRequestHeaders(),
      });
      tools.init();
      for (const Tool of [
        tools.WindowLevelTool,
        tools.PanTool,
        tools.ZoomTool,
        tools.StackScrollTool,
        tools.LengthTool,
        tools.AngleTool,
        tools.EllipticalROITool,
      ]) {
        try {
          tools.addTool(Tool);
        } catch {
          // Already added (hot reload)
        }
      }
      return { core, tools };
    })().catch((err) => {
      loading = null;
      throw err;
    });
  }
  return loading;
}

export type MeasureTool = 'Length' | 'Angle' | 'EllipticalROI';
export type PrimaryTool = 'WindowLevel' | 'Pan' | 'Zoom' | MeasureTool;

/**
 * Mouse and touch bindings: left button = the chosen tool, middle (or Shift+left) = pan, right = zoom,
 * wheel = scroll through slices, Ctrl+wheel = zoom; one finger = the chosen tool, two fingers = zoom,
 * three fingers = pan.
 */
export function configureToolGroup(cs: Cornerstone, viewportIds: string[], primary: PrimaryTool) {
  const { tools } = cs;
  const { MouseBindings, KeyboardBindings } = tools.Enums;
  let group = tools.ToolGroupManager.getToolGroup(TOOL_GROUP_ID);
  if (!group) {
    group = tools.ToolGroupManager.createToolGroup(TOOL_GROUP_ID)!;
    for (const Tool of [tools.WindowLevelTool, tools.PanTool, tools.ZoomTool, tools.StackScrollTool, tools.LengthTool, tools.AngleTool, tools.EllipticalROITool]) {
      group.addTool(Tool.toolName);
    }
  }
  for (const id of viewportIds) {
    if (!group.getViewportIds().includes(id)) group.addViewport(id, RENDERING_ENGINE_ID);
  }
  const name = (key: PrimaryTool) =>
    ({
      WindowLevel: tools.WindowLevelTool.toolName,
      Pan: tools.PanTool.toolName,
      Zoom: tools.ZoomTool.toolName,
      Length: tools.LengthTool.toolName,
      Angle: tools.AngleTool.toolName,
      EllipticalROI: tools.EllipticalROITool.toolName,
    })[key];

  // Reset every tool to passive, then bind
  for (const key of ['WindowLevel', 'Pan', 'Zoom', 'Length', 'Angle', 'EllipticalROI'] as PrimaryTool[]) group.setToolPassive(name(key));
  const primaryBindings = [{ mouseButton: MouseBindings.Primary }, { numTouchPoints: 1 }];
  const panBindings = [
    { mouseButton: MouseBindings.Auxiliary },
    { mouseButton: MouseBindings.Primary, modifierKey: KeyboardBindings.Shift },
    { numTouchPoints: 3 },
  ];
  const zoomBindings = [
    { mouseButton: MouseBindings.Secondary },
    { mouseButton: MouseBindings.Wheel, modifierKey: KeyboardBindings.Ctrl },
    { numTouchPoints: 2 },
  ];
  if (primary === 'Pan') {
    group.setToolActive(name('Pan'), { bindings: [...primaryBindings, ...panBindings.slice(0, 1)] });
    group.setToolActive(name('Zoom'), { bindings: zoomBindings });
  } else if (primary === 'Zoom') {
    group.setToolActive(name('Zoom'), { bindings: [...primaryBindings, ...zoomBindings] });
    group.setToolActive(name('Pan'), { bindings: panBindings });
  } else {
    group.setToolActive(name(primary), { bindings: primaryBindings });
    group.setToolActive(name('Pan'), { bindings: panBindings });
    group.setToolActive(name('Zoom'), { bindings: zoomBindings });
  }
  group.setToolActive(tools.StackScrollTool.toolName, { bindings: [{ mouseButton: MouseBindings.Wheel }] });
  return group;
}

export function getOrCreateEngine(cs: Cornerstone) {
  return cs.core.getRenderingEngine(RENDERING_ENGINE_ID) ?? new cs.core.RenderingEngine(RENDERING_ENGINE_ID);
}
