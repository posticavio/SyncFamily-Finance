import React from 'react';
import { 
  Flame, 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle2,
  Calendar,
  Wallet
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
  const remainingToday = Math.max(0, safeDailyAllowance - todaySpent);
  const todayPct = safeDailyAllowance > 0 ? Math.min(100, Math.round((todaySpent / safeDailyAllowance) * 100)) : 100;

  const isOverToday = todaySpent > safeDailyAllowance && safeDailyAllowance > 0;

  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] p-4 sm:p-5 border border-slate-200/80 dark:border-white/5 shadow-xs transition-all hover:border-slate-300 dark:hover:border-white/10 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-[11px] bg-[#E31B23]/15 text-[#E31B23] flex items-center justify-center">
            <Flame size={18} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F7] tracking-tight">
              Spesa Giornaliera Consigliata
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-[#8E8E93]">
              Safe-to-Spend per {safeDays} {safeDays === 1 ? 'giorno' : 'giorni'} rimanenti
            </p>
          </div>
        </div>

        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold font-numeric tabular-nums flex items-center gap-1 ${
          isOverToday 
            ? 'bg-amber-500/15 text-amber-500' 
            : 'bg-emerald-500/15 text-emerald-500'
        }`}>
          {isOverToday ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
          {isOverToday ? 'Sopra Ritmo' : 'In Target'}
        </span>
      </div>

      <div className="flex items-baseline justify-between pt-1">
        <div>
          <span className="text-[11px] text-slate-400 dark:text-[#8E8E93] block">Budget Disponibile Oggi</span>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#E31B23] font-numeric tabular-nums tracking-tight">
            {formatCurrency(safeDailyAllowance)}
            <span className="text-xs font-semibold text-slate-400 dark:text-[#8E8E93] ml-1">/ giorno</span>
          </p>
        </div>

        <div className="text-right">
          <span className="text-[11px] text-slate-400 dark:text-[#8E8E93] block">Spesi Oggi</span>
          <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#F5F5F7] font-numeric tabular-nums">
            {formatCurrency(todaySpent)}
          </p>
        </div>
      </div>

      {/* Barra Progresso Odierna */}
      <div className="space-y-1 pt-1">
        <div className="h-2 w-full bg-slate-100 dark:bg-[#242426] rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${
              isOverToday ? 'bg-amber-500' : 'bg-[#E31B23]'
            }`}
            style={{ width: `${todayPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10.5px] text-slate-400 dark:text-[#8E8E93]">
          <span>Residuo ciclo: {formatCurrency(remainingBudget)}</span>
          <span>{todayPct}% del target giornaliero</span>
        </div>
      </div>
    </div>
  );
};
