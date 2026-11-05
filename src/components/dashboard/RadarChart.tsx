import React from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadar,
  ResponsiveContainer
} from 'recharts';
import { RadarMetric } from '../../types/biometrics';

interface RadarChartProps {
  data: RadarMetric[];
}

export const RadarChart: React.FC<RadarChartProps> = ({ data }) => {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface p-4 shadow-lg space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-300 font-bold">
          Биометрический радар (6 осей)
        </h3>
        <span className="text-[11px] font-mono text-primary">Нормализовано 0–100%</span>
      </div>

      <div className="w-full h-64 -my-2 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsRadar data={data} outerRadius="75%">
            <PolarGrid stroke="rgba(255, 255, 255, 0.1)" strokeDasharray="3 3" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: '#A1A1AA', fontSize: 11, fontFamily: 'JetBrains Mono' }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />
            <Radar
              name="Biometrics"
              dataKey="value"
              stroke="#10B981"
              strokeWidth={2}
              fill="#10B981"
              fillOpacity={0.3}
            />
          </RechartsRadar>
        </ResponsiveContainer>
      </div>

      {/* Axis value breakdown */}
      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-surface-border/50 text-[11px] font-mono">
        {data.map(item => (
          <div key={item.subject} className="flex justify-between items-center text-zinc-400 px-1">
            <span className="truncate pr-1">{item.subject}:</span>
            <span className="text-zinc-200 font-bold">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};
