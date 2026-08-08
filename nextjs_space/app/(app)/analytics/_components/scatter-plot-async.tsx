'use client';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  ReferenceLine, ReferenceArea,
} from 'recharts';

export default function ScatterPlotAsync({ data, avgCvss, avgEpss, sevColor, CustomTooltip }: any) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          type="number" dataKey="x" name="EPSS" domain={[0, 1]}
          tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          tickLine={false} axisLine={false} className="text-xs"
          label={{ value: 'EPSS', position: 'insideBottom', offset: -2, className: 'text-[10px] fill-muted-foreground' }}
        />
        <YAxis
          type="number" dataKey="y" name="CVSS" domain={[0, 10]}
          tickLine={false} axisLine={false} className="text-xs" width={32}
          label={{ value: 'CVSS', angle: -90, position: 'insideLeft', className: 'text-[10px] fill-muted-foreground' }}
        />
        <ZAxis range={[60, 160]} />
        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
        <ReferenceArea x1={avgEpss} x2={1} y1={avgCvss} y2={10} fill="#ef4444" fillOpacity={0.05} />
        <ReferenceLine x={avgEpss} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" strokeOpacity={0.4} />
        <ReferenceLine y={avgCvss} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" strokeOpacity={0.4} />
        <Scatter data={data}>
          {data.map((entry: any, i: number) => (
            <Cell key={i} fill={sevColor[(entry.severity || '').toUpperCase()] || sevColor.LOW} fillOpacity={0.65} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
