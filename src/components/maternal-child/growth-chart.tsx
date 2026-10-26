'use client';

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { useLanguage } from '@/context/language-context';
import { formatZ, type ChartMeasurement, type GrowthIndicator, type GrowthReference } from '@/lib/maternal-child';

/** WHO chart convention: median green, ±2 SD amber/orange, ±3 SD red; the child in blue */
const COLORS = { sd0: '#16a34a', sd2: '#ea580c', sd3: '#b91c1c', band: '#16a34a', child: '#1d4ed8' };

export const indicatorUnit = (indicator: GrowthIndicator) => (indicator === 'lhfa' || indicator === 'hcfa' ? 'cm' : indicator === 'bfa' ? 'bmi' : 'kg');

interface TooltipEntry {
  payload?: Partial<ChartMeasurement> & { sd0?: number };
}

/**
 * One WHO growth chart: the −3…+3 SD reference curves (normal range −2…+2 shaded) and the
 * child's measurements as a line with points. Values are listed in the history table too.
 */
export function GrowthChart({ indicator, reference, points }: { indicator: GrowthIndicator; reference: GrowthReference; points: ChartMeasurement[] }) {
  const { t, formatDate } = useLanguage();
  const unit = t(`mc.growth.unit.${indicatorUnit(indicator)}`);
  const xLabel = reference.xUnit === 'cm' ? t('mc.growth.axis.cm') : t('mc.growth.axis.month');
  const band = reference.points.map((p) => ({ x: p.x, band: [p.sdm2, p.sd2] as [number, number] }));
  const xs = reference.points.map((p) => p.x);
  const domain: [number, number] = [Math.min(...xs), Math.max(...xs)];
  const decimals = (n: number) => n.toFixed(1).replace('.', ',');

  const renderTooltip = ({ active, payload }: { active?: boolean; payload?: readonly TooltipEntry[] }) => {
    const point = payload?.map((p) => p.payload).find((p) => p && p.measuredOn);
    if (!active || !point || point.y == null || point.x == null) return null;
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs shadow-lg">
        <p className="font-semibold text-gray-900 dark:text-white">{formatDate(point.measuredOn!.slice(0, 10))}</p>
        <p className="text-gray-700 dark:text-gray-300">
          {decimals(point.y)} {unit} · {reference.xUnit === 'cm' ? `${decimals(point.x)} cm` : t('mc.growth.ageMonths', { n: decimals(point.x) })}
        </p>
        <p className="text-gray-500 dark:text-gray-400">z {formatZ(point.z)}</p>
      </div>
    );
  };

  const legend = [
    { color: COLORS.child, label: t('mc.growth.child'), solid: true },
    { color: COLORS.sd0, label: t('mc.growth.median') },
    { color: COLORS.sd2, label: t('mc.growth.sd', { n: '±2' }) },
    { color: COLORS.sd3, label: t('mc.growth.sd', { n: '±3' }), dashed: true },
  ];

  return (
    <figure className="space-y-2">
      <div className="h-72 sm:h-80 w-full" role="img" aria-label={t('mc.growth.chartLabel', { indicator: t(`mc.growth.ind.${indicator}`) })}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 8, right: 12, bottom: 20, left: 0 }}>
            <CartesianGrid stroke="currentColor" strokeOpacity={0.08} />
            <XAxis
              type="number"
              dataKey="x"
              domain={domain}
              allowDuplicatedCategory={false}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              stroke="currentColor"
              strokeOpacity={0.3}
              label={{ value: xLabel, position: 'insideBottom', offset: -12, fontSize: 11, fill: 'currentColor' }}
            />
            <YAxis
              type="number"
              domain={['auto', 'auto']}
              width={40}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              stroke="currentColor"
              strokeOpacity={0.3}
              label={{ value: unit, angle: -90, position: 'insideLeft', fontSize: 11, fill: 'currentColor', dx: 8 }}
            />
            <Area data={band} dataKey="band" type="monotone" stroke="none" fill={COLORS.band} fillOpacity={0.08} isAnimationActive={false} activeDot={false} />
            <Line data={reference.points} dataKey="sdm3" type="monotone" stroke={COLORS.sd3} strokeWidth={1.5} strokeDasharray="4 3" dot={false} activeDot={false} isAnimationActive={false} />
            <Line data={reference.points} dataKey="sdm2" type="monotone" stroke={COLORS.sd2} strokeWidth={1.5} dot={false} activeDot={false} isAnimationActive={false} />
            <Line data={reference.points} dataKey="sd0" type="monotone" stroke={COLORS.sd0} strokeWidth={2} dot={false} activeDot={false} isAnimationActive={false} />
            <Line data={reference.points} dataKey="sd2" type="monotone" stroke={COLORS.sd2} strokeWidth={1.5} dot={false} activeDot={false} isAnimationActive={false} />
            <Line data={reference.points} dataKey="sd3" type="monotone" stroke={COLORS.sd3} strokeWidth={1.5} strokeDasharray="4 3" dot={false} activeDot={false} isAnimationActive={false} />
            <Scatter
              data={points}
              dataKey="y"
              fill={COLORS.child}
              stroke="#ffffff"
              strokeWidth={2}
              line={{ stroke: COLORS.child, strokeWidth: 2 }}
              shape="circle"
              isAnimationActive={false}
            />
            <Tooltip content={renderTooltip} cursor={{ strokeOpacity: 0.2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
        {legend.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <svg width="18" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="18" y2="4" stroke={l.color} strokeWidth={2} strokeDasharray={l.dashed ? '4 3' : undefined} />
              {l.solid && <circle cx="9" cy="4" r="3" fill={l.color} />}
            </svg>
            {l.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
