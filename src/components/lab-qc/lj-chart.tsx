'use client';

import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { useLanguage } from '@/context/language-context';
import { ruleLabel, type LjChart, type LjPoint } from '@/lib/lab-qc';

/** Reference lines: mean solid; ±1 SD faint, ±2 SD amber (warning), ±3 SD red (rejection) */
const LINE_STYLE: Record<'mean' | 'sd1' | 'sd2' | 'sd3', { stroke: string; dash?: string; width: number }> = {
  mean: { stroke: '#14532D', width: 1.5 },
  sd1: { stroke: '#9CA3AF', dash: '2 4', width: 1 },
  sd2: { stroke: '#D97706', dash: '6 4', width: 1 },
  sd3: { stroke: '#DC2626', dash: '6 4', width: 1.25 },
};

interface TooltipEntry {
  payload?: LjPoint;
}

/** A point coloured by its run status, larger when rejected */
function StatusDot(props: { cx?: number; cy?: number; payload?: LjPoint }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  const r = payload.status === 'REJECTED' ? 6 : payload.status === 'WARNING' ? 5 : 4;
  return <circle cx={cx} cy={cy} r={r} fill={payload.colour} stroke="#fff" strokeWidth={1.5} />;
}

/**
 * Levey-Jennings chart of one control material: runs in time order against the target mean and
 * ±1/2/3 SD lines. Colour is never the only cue: the tooltip and the runs table give the status
 * and the violated rules in words.
 */
export function LeveyJenningsChart({ chart, name, unit }: { chart: LjChart; name: string; unit?: string | null }) {
  const { t, formatDateTime, formatDate } = useLanguage();
  const decimals = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(2)).replace('.', ',');

  const lineLabel = (key: string) => {
    if (key === 'mean') return t('qc.chart.mean');
    return t('qc.chart.sd', { sign: key.startsWith('-') ? '−' : '+', k: key.slice(1) });
  };

  const renderTooltip = ({ active, payload }: { active?: boolean; payload?: readonly TooltipEntry[] }) => {
    const point = payload?.map((p) => p.payload).find(Boolean);
    if (!active || !point) return null;
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs shadow-lg max-w-xs">
        <p className="font-semibold text-gray-900 dark:text-white">{formatDateTime(point.runAt)}</p>
        <p className="text-gray-700 dark:text-gray-300">
          {t('qc.chart.value')} : {decimals(point.value)} {unit ?? ''} · {t('qc.chart.z')} = {point.z === null ? '—' : point.z.toFixed(2).replace('.', ',')}
        </p>
        <p className="font-medium" style={{ color: point.colour }}>
          {t(`qc.status.${point.status}`)}
        </p>
        {point.violations.length > 0 && (
          <p className="text-gray-700 dark:text-gray-300">
            {t('qc.chart.rules')} : {point.violations.map(ruleLabel).join(', ')}
          </p>
        )}
        {point.comment && <p className="text-gray-500 dark:text-gray-400 italic">{point.comment}</p>}
      </div>
    );
  };

  if (chart.points.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 py-10 text-center">{t('qc.chart.empty')}</p>;
  }

  const [xMin, xMax] = chart.xDomain ?? [0, 1];
  const pad = Math.max((xMax - xMin) * 0.03, 3600_000);
  const sameDay = new Date(xMin).toDateString() === new Date(xMax).toDateString();

  return (
    <figure>
      <div className="h-72 sm:h-80" role="img" aria-label={t('qc.chart.ariaLabel', { name })}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chart.points} margin={{ top: 10, right: 64, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" strokeOpacity={0.6} />
            <XAxis
              dataKey="x"
              type="number"
              scale="time"
              domain={[xMin - pad, xMax + pad]}
              tickFormatter={(v: number) => (sameDay ? formatDateTime(new Date(v), { hour: '2-digit', minute: '2-digit' }) : formatDate(new Date(v).toISOString().slice(0, 10)))}
              tick={{ fontSize: 11, fill: '#6B7280' }}
              minTickGap={24}
            />
            <YAxis
              type="number"
              domain={chart.yDomain ?? ['auto', 'auto']}
              tickFormatter={(v: number) => decimals(v)}
              tick={{ fontSize: 11, fill: '#6B7280' }}
              width={56}
            />
            {chart.lines.map((line) => {
              const style = LINE_STYLE[line.tone];
              return (
                <ReferenceLine
                  key={line.key}
                  y={line.value}
                  stroke={style.stroke}
                  strokeDasharray={style.dash}
                  strokeWidth={style.width}
                  ifOverflow="extendDomain"
                  label={{ value: lineLabel(line.key), position: 'right', fontSize: 10, fill: style.stroke }}
                />
              );
            })}
            <Line dataKey="value" type="linear" stroke="#64748B" strokeWidth={1} dot={false} activeDot={false} isAnimationActive={false} />
            <Scatter dataKey="value" shape={<StatusDot />} isAnimationActive={false} />
            <Tooltip content={renderTooltip} cursor={{ strokeOpacity: 0.2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {t('qc.chart.legend')} · {t('qc.chart.runs', { n: chart.points.length })}
      </figcaption>
    </figure>
  );
}
