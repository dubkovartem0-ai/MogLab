import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface DisclaimerProps {
  className?: string;
  compact?: boolean;
}

export const Disclaimer: React.FC<DisclaimerProps> = ({ className = '', compact = false }) => {
  return (
    <div
      className={`rounded-xl border border-white/5 bg-surface/60 p-3 text-zinc-400 text-xs backdrop-blur-sm ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-500/80 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <span className="font-semibold text-zinc-300">Развлекательно-аналитическое приложение.</span>{' '}
          Расчеты основаны на геометрических пропорциях и алгоритмах симметрии, не являются медицинской, клинической или психологической диагностикой.
        </p>
      </div>
    </div>
  );
};
