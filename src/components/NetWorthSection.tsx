import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  Landmark, 
  PiggyBank, 
  CreditCard, 
  ShieldCheck, 
  ArrowUpRight, 
  ArrowDownRight,
  Sparkles,
  PieChart
} from 'lucide-react';
import { Account, Fund, Project } from '../types';
import { formatCurrency } from '../utils/formatters';

interface NetWorthSectionProps {
  accounts: Account[];
  funds: Fund[];
  projects?: Project[];
}

export const NetWorthSection: React.FC<NetWorthSectionProps> = ({
  accounts,
  funds,
  projects = []
}) => {
  const calculation = useMemo(() => {
    const liquidAccounts = accounts
      .filter(a => a.attivo !== false)
      .reduce((acc, a) => acc + (a.saldo_reale ?? a.saldo_iniziale ?? 0), 0);

    const savingFunds = funds
      .filter(f => f.attivo !== false)
      .reduce((acc, f) => acc + (f.saldo_reale ?? f.saldo_iniziale ?? 0), 0);

    const totalAssets = liquidAccounts + savingFunds;

    // Passività: debiti residui da progetti attivi (mutui, prestiti, finanziamenti)
    const activeDebts = projects
      .filter(p => p.stato === 'ATTIVO' && (p.tipo === 'MUTUO' || p.tipo === 'FINANZIAMENTO' || p.tipo === 'PRESTITO' || p.tipo === 'DEBITO'))
      .reduce((acc, p) => acc + (Number(p.debito_residuo ?? p.importo_target ?? 0)), 0);

    const netWorth = totalAssets - activeDebts;
    const debtRatio = totalAssets > 0 ? Math.round((activeDebts / totalAssets) * 100) : 0;

    return {
      liquidAccounts,
      savingFunds,
      totalAssets,
      activeDebts,
      netWorth,
      debtRatio
    };
  }, [accounts, funds, projects]);

  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] p-4 sm:p-6 border border-slate-200/80 dark:border-white/5 shadow-xs space-y-4">
      {/* Header Sezione */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-100 dark:border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[12px] bg-[#E31B23]/15 text-[#E31B23] flex items-center justify-center">
            <TrendingUp size={18} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-[#F5F5F7] tracking-tight">
              Patrimonio Netto Familiare
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-[#8E8E93]">
              Attività liquide e riserve al netto dei debiti residui
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <span className="text-[11px] text-slate-400 dark:text-[#8E8E93] block">Valore Netto Reale</span>
          <span className={`text-2xl sm:text-3xl font-extrabold font-numeric tabular-nums tracking-tight ${
            calculation.netWorth >= 0 ? 'text-[#E31B23]' : 'text-rose-500'
          }`}>
            {formatCurrency(calculation.netWorth)}
          </span>
        </div>
      </div>

      {/* 3 Blocchi Aggregati */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Attivi: Conti Correnti */}
        <div className="p-3.5 rounded-[18px] bg-slate-50 dark:bg-[#242426] border border-slate-200/60 dark:border-white/5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-[#8E8E93] flex items-center gap-1.5">
              <Landmark size={14} className="text-blue-500" />
              Liquidità Conti ({accounts.length})
            </span>
            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">Attivo</span>
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-[#F5F5F7] font-numeric tabular-nums pt-1">
            {formatCurrency(calculation.liquidAccounts)}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block">Disponibilità immediata</span>
        </div>

        {/* Attivi: Fondi Risparmio */}
        <div className="p-3.5 rounded-[18px] bg-slate-50 dark:bg-[#242426] border border-slate-200/60 dark:border-white/5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-[#8E8E93] flex items-center gap-1.5">
              <PiggyBank size={14} className="text-amber-500" />
              Fondi & Riserve ({funds.length})
            </span>
            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">Attivo</span>
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-[#F5F5F7] font-numeric tabular-nums pt-1">
            {formatCurrency(calculation.savingFunds)}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block">Salvadanaio ed emergenza</span>
        </div>

        {/* Passivi: Debiti e Finanziamenti */}
        <div className="p-3.5 rounded-[18px] bg-slate-50 dark:bg-[#242426] border border-slate-200/60 dark:border-white/5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-[#8E8E93] flex items-center gap-1.5">
              <CreditCard size={14} className="text-rose-500" />
              Debiti Residui
            </span>
            <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded">Passività</span>
          </div>
          <p className="text-lg font-bold text-rose-500 font-numeric tabular-nums pt-1">
            -{formatCurrency(calculation.activeDebts)}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block">
            {calculation.debtRatio}% degli attivi totali
          </span>
        </div>
      </div>
    </div>
  );
};
