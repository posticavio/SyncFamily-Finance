import React from 'react';
import { formatCurrency } from '../utils/formatters';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface BudgetProgressBarProps {
  reale: number;
  pianificato?: number;
  budget: number;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  showLegend?: boolean;
  isIncome?: boolean;
}

export interface SpendStatus {
  level: 'optimal' | 'moderate' | 'warning' | 'alert' | 'danger' | 'none';
  label: string;
  gradientClass: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  barHex: string;
}

export function getSpendStatus(percent: number, hasBudget: boolean, isStrictlyOver?: boolean): SpendStatus {
  if (!hasBudget) {
    return {
      level: 'none',
      label: 'Senza budget',
      gradientClass: 'from-slate-300 to-slate-400',
      badgeBg: 'bg-slate-100 dark:bg-white/10',
      badgeText: 'text-slate-600 dark:text-slate-300',
      badgeBorder: 'border-slate-200 dark:border-white/10',
      barHex: '#94a3b8'
    };
  }
  // Sforato SOLO se la spesa prevista supera strettamente l'importo di budget
  if (isStrictlyOver === true || (isStrictlyOver === undefined && percent > 100)) {
    return {
      level: 'danger',
      label: 'Limite superato',
      gradientClass: 'from-rose-500 via-red-500 to-rose-600',
      badgeBg: 'bg-rose-50 dark:bg-rose-950/40',
      badgeText: 'text-rose-700 dark:text-rose-400',
      badgeBorder: 'border-rose-300 dark:border-rose-800',
      barHex: '#ef4444'
    };
  }
  if (percent === 100) {
    // Al 100% esatto senza superamento: budget perfettamente allineato alle spese
    return {
      level: 'optimal',
      label: 'Budget allineato',
      gradientClass: 'from-emerald-400 via-emerald-500 to-teal-500',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
      badgeText: 'text-emerald-700 dark:text-emerald-400',
      badgeBorder: 'border-emerald-300 dark:border-emerald-800',
      barHex: '#10b981'
    };
  }
  if (percent >= 85) {
    return {
      level: 'alert',
      label: 'In esaurimento',
      gradientClass: 'from-amber-500 via-orange-500 to-amber-600',
      badgeBg: 'bg-orange-50 dark:bg-orange-950/40',
      badgeText: 'text-orange-700 dark:text-orange-400',
      badgeBorder: 'border-orange-300 dark:border-orange-800',
      barHex: '#f97316'
    };
  }
  if (percent >= 70) {
    return {
      level: 'warning',
      label: 'Attenzione',
      gradientClass: 'from-lime-500 via-amber-400 to-amber-500',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
      badgeText: 'text-amber-700 dark:text-amber-400',
      badgeBorder: 'border-amber-300 dark:border-amber-800',
      barHex: '#eab308'
    };
  }
  if (percent >= 50) {
    return {
      level: 'moderate',
      label: 'Moderato',
      gradientClass: 'from-emerald-400 via-lime-400 to-lime-500',
      badgeBg: 'bg-lime-50 dark:bg-lime-950/40',
      badgeText: 'text-lime-700 dark:text-lime-400',
      badgeBorder: 'border-lime-300 dark:border-lime-800',
      barHex: '#84cc16'
    };
  }
  return {
    level: 'optimal',
    label: 'Ottimale',
    gradientClass: 'from-emerald-400 to-emerald-500',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    badgeText: 'text-emerald-700 dark:text-emerald-400',
    badgeBorder: 'border-emerald-300 dark:border-emerald-800',
    barHex: '#10b981'
  };
}

export function getIncomeStatus(percent: number, hasBudget: boolean): SpendStatus {
  if (!hasBudget) {
    return {
      level: 'none',
      label: 'Senza obiettivo',
      gradientClass: 'from-slate-400 to-slate-500',
      badgeBg: 'bg-slate-100 dark:bg-white/10',
      badgeText: 'text-slate-600 dark:text-slate-300',
      badgeBorder: 'border-slate-200 dark:border-white/10',
      barHex: '#94a3b8'
    };
  }
  if (percent >= 100) {
    return {
      level: 'optimal',
      label: 'Obiettivo raggiunto',
      gradientClass: 'from-emerald-500 via-teal-500 to-emerald-600',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
      badgeText: 'text-emerald-700 dark:text-emerald-400',
      badgeBorder: 'border-emerald-300 dark:border-emerald-800',
      barHex: '#10b981'
    };
  }
  if (percent >= 70) {
    return {
      level: 'moderate',
      label: 'A buon punto',
      gradientClass: 'from-lime-500 to-emerald-500',
      badgeBg: 'bg-lime-50 dark:bg-lime-950/40',
      badgeText: 'text-lime-700 dark:text-lime-400',
      badgeBorder: 'border-lime-300 dark:border-lime-800',
      barHex: '#84cc16'
    };
  }
  return {
    level: 'alert',
    label: 'In corso',
    gradientClass: 'from-amber-400 to-lime-500',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
    badgeText: 'text-amber-700 dark:text-amber-400',
    badgeBorder: 'border-amber-300 dark:border-amber-800',
    barHex: '#eab308'
  };
}

export const BudgetProgressBar: React.FC<BudgetProgressBarProps> = ({
  reale,
  pianificato = 0,
  budget,
  size = 'md',
  showDetails = true,
  isIncome = false
}) => {
  const hasBudget = budget > 0;
  const realePercent = hasBudget ? Math.round((reale / budget) * 100) : (reale > 0 ? 100 : 0);
  const previsione = Math.round((reale + pianificato) * 100) / 100;
  const previsionePercent = hasBudget ? Math.round((previsione / budget) * 100) : (previsione > 0 ? 100 : 0);
  const differenza = isIncome
    ? Math.round((previsione - budget) * 100) / 100
    : Math.round((budget - previsione) * 100) / 100;

  // Calcola lo stato cromatico
  const isStrictlyOver = !isIncome && hasBudget && (differenza < 0);
  const effectivePercent = Math.max(realePercent, previsionePercent);
  const status = isIncome
    ? getIncomeStatus(effectivePercent, hasBudget)
    : getSpendStatus(effectivePercent, hasBudget, isStrictlyOver);

  // Calcola larghezze percentuali delle barre
  const realeBarWidth = Math.min(realePercent, 100);
  const plannedBarWidth = Math.max(0, Math.min(previsionePercent, 100) - realeBarWidth);
  const isOverBudget = isStrictlyOver;

  // Altezza barra in base al prop size
  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-3.5'
  }[size];

  return (
    <div className="w-full space-y-1.5">
      {showDetails && (
        <div className="flex items-center justify-between text-xs flex-wrap gap-x-3 gap-y-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {isIncome ? (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-numeric truncate">
                Incassato: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{formatCurrency(reale)}</strong>
                {pianificato > 0 && (
                  <span className="text-slate-400 dark:text-slate-500 font-normal"> (+{formatCurrency(pianificato)} in arrivo)</span>
                )}
              </span>
            ) : reale === 0 && pianificato > 0 ? (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-numeric truncate">
                In programma: <strong className="font-semibold">{formatCurrency(pianificato)}</strong>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal"> (da addebitare)</span>
              </span>
            ) : (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-numeric truncate">
                Speso: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{formatCurrency(reale)}</strong>
                {pianificato > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 font-medium"> (+{formatCurrency(pianificato)} in progr.)</span>
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-numeric">
              {hasBudget ? `su ${formatCurrency(budget)}` : 'Nessun target'}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold border ${status.badgeBg} ${status.badgeText} ${status.badgeBorder} flex items-center gap-1 ${
                !isIncome && isOverBudget ? 'animate-pulse ring-1 ring-rose-500/40 shadow-[0_0_8px_rgba(244,63,94,0.25)]' : ''
              }`}
            >
              {!isIncome && isOverBudget ? (
                <>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-80"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-600"></span>
                  </span>
                  <AlertCircle size={10} className="text-rose-600 dark:text-rose-400 shrink-0" />
                </>
              ) : !isIncome && effectivePercent >= 85 && effectivePercent < 100 ? (
                <>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500"></span>
                  </span>
                  <AlertTriangle size={10} className="text-orange-600 dark:text-orange-400 shrink-0" />
                </>
              ) : (
                <CheckCircle2 size={10} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              )}
              <span>{hasBudget ? `${effectivePercent}%` : '—'}</span>
            </span>
          </div>
        </div>
      )}

      {/* Barra di Progresso con transizione cromatica e lampeggio su sforamento */}
      <div className={`relative w-full ${heightClasses} bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden flex shadow-inner`}>
        {/* Barra Reale */}
        <div
          className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${status.gradientClass} ${
            isOverBudget ? 'shadow-[0_0_10px_rgba(239,68,68,0.7)] animate-pulse' : ''
          }`}
          style={{ width: `${realeBarWidth}%` }}
          title={`${isIncome ? 'Incassato' : 'Speso'}: ${formatCurrency(reale)} (${realePercent}%)`}
        />

        {/* Barra Estensione Pianificata (se presente: tratteggiata elegante) */}
        {plannedBarWidth > 0 && (
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${plannedBarWidth}%`,
              background: isIncome
                ? 'repeating-linear-gradient(45deg, #10b981, #10b981 4px, rgba(16, 185, 129, 0.35) 4px, rgba(16, 185, 129, 0.35) 8px)'
                : isOverBudget
                ? 'repeating-linear-gradient(45deg, #f43f5e, #f43f5e 4px, rgba(244, 63, 94, 0.35) 4px, rgba(244, 63, 94, 0.35) 8px)'
                : 'repeating-linear-gradient(45deg, #f59e0b, #f59e0b 4px, rgba(245, 158, 11, 0.35) 4px, rgba(245, 158, 11, 0.35) 8px)'
            }}
            title={`In programma: +${formatCurrency(pianificato)} (totale previsto ${previsionePercent}%)`}
          />
        )}
      </div>

      {/* Indicatore chiaro del residuo o scostamento */}
      {showDetails && hasBudget && (
        <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 pt-0.5">
          <span className="font-medium text-slate-500 dark:text-slate-400">
            {status.label}
          </span>
          <span className={`font-numeric font-semibold ${
            isIncome 
              ? (differenza >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')
              : (differenza >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400 animate-pulse')
          }`}>
            {isIncome 
              ? (differenza >= 0 ? `Superato di: +${formatCurrency(differenza)}` : `Da incassare: ${formatCurrency(Math.abs(differenza))}`)
              : (differenza >= 0 ? `Residuo: ${formatCurrency(differenza)}` : `Sforato di: ${formatCurrency(Math.abs(differenza))}`)
            }
          </span>
        </div>
      )}
    </div>
  );
};
