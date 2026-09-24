import React from 'react';
import { 
  Flame, 
  AlertCircle, 
  CheckCircle2, 
  Calendar, 
  Sparkles,
  Info
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

interface DailyBurnRateWidgetProps {
  remainingBudget: number; // Budget variabile/discrezionale rimanente nel ciclo
  daysRemainingInCycle: number; // Giorni rimanenti al prossimo giorno stipendio
  todaySpent: number; // Spese registrate oggi
  totalCycleBudget: number;
}

export const DailyBurnRateWidget: React.FC<DailyBurnRateWidgetProps> = ({
  remainingBudget,
  daysRemainingInCycle,
  todaySpent,
  totalCycleBudget
}) => {
  const safeDays = Math.max(1, daysRemainingInCycle);
  const safeDailyAllowance = Math.max(0, Math.round((remainingBudget / safeDays) * 100) / 100);
  const todayPct = safeDailyAllowance > 0 ? Math.min(100, Math.round((todaySpent / safeDailyAllowance) * 100)) : 100;
  const isOverToday = todaySpent > safeDailyAllowance && safeDailyAllowance > 0;

  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] p-4 sm:p-5 border border-slate-200/80 dark:border-white/5 shadow-xs transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[12px] bg-[#E31B23]/10 text-[#E31B23] flex items-center justify-center shrink-0">
            <Flame size={18} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F7] tracking-tight flex items-center gap-1.5">
              <span>Ritmo di Spesa Consigliato (Safe-to-Spend)</span>
              <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#242426] text-slate-600 dark:text-[#8E8E93] font-normal">
                {safeDays} gg alla chiusura
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-[#8E8E93]">
              Budget giornaliero per non intaccare i risparmi e le scadenze fisse
            </p>
          </div>
        </div>

        {/* Indicatore Spesa Oggi vs Budget */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
            isOverToday 
              ? 'bg-amber-500/15 text-amber-500' 
              : 'bg-emerald-500/15 text-emerald-500'
          }`}>
            {isOverToday ? <AlertCircle size={13} /> : <CheckCircle2 size={13} />}
            {isOverToday ? 'Oggi sopra ritmo' : 'Nel ritmo di sicurezza'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3.5 items-center">
        {/* Valore Safe Daily */}
        <div className="p-3 bg-slate-50/80 dark:bg-[#242426] rounded-2xl">
          <span className="text-[11px] font-semibold text-slate-400 dark:text-[#8E8E93] block">Budget Giornaliero Sicuro</span>
          <span className="font-numeric text-xl sm:text-2xl font-extrabold text-[#E31B23] block tabular-nums mt-0.5">
            {formatCurrency(safeDailyAllowance)}
            <span className="text-xs font-normal text-slate-400 dark:text-[#8E8E93] ml-1">/giorno</span>
          </span>
        </div>

        {/* Speso Oggi */}
        <div className="p-3 bg-slate-50/80 dark:bg-[#242426] rounded-2xl">
          <span className="text-[11px] font-semibold text-slate-400 dark:text-[#8E8E93] block">Speso Oggi</span>
          <span className="font-numeric text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-[#F5F5F7] block tabular-nums mt-0.5">
            {formatCurrency(todaySpent)}
          </span>
        </div>

        {/* Avanzamento / Progress Bar */}
        <div className="p-3 bg-slate-50/80 dark:bg-[#242426] rounded-2xl flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#8E8E93] mb-1.5">
            <span>Uso Quota Oggi</span>
            <span className="font-numeric font-bold">{todayPct}%</span>
          </div>
          <div className="h-2 bg-slate-200/80 dark:bg-black/40 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                isOverToday ? 'bg-amber-500' : 'bg-[#E31B23]'
              }`}
              style={{ width: `${todayPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
