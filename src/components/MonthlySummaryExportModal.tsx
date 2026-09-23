import React, { useRef } from 'react';
import { 
  Printer, 
  Download, 
  X, 
  FileSpreadsheet, 
  Calendar, 
  CheckCircle2, 
  Sparkles,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  PieChart
} from 'lucide-react';
import { Movement, Subcategory, Account, Fund } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { haptics } from '../utils/haptics';

interface MonthlySummaryExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCycleDate: Date;
  movements: Movement[];
  subcategories: Subcategory[];
  accounts: Account[];
  funds: Fund[];
}

export const MonthlySummaryExportModal: React.FC<MonthlySummaryExportModalProps> = ({
  isOpen,
  onClose,
  currentCycleDate,
  movements,
  subcategories,
  accounts,
  funds
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const monthLabel = currentCycleDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  const capitalizedMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  // Calcoli riassuntivi del mese
  const incomeMovements = movements.filter(m => m.tipologia === 'ENTRATA');
  const expenseMovements = movements.filter(m => m.tipologia === 'USCITA');

  const totalIncome = incomeMovements.reduce((acc, m) => acc + (Number(m.importo) || 0), 0);
  const totalExpenses = expenseMovements.reduce((acc, m) => acc + (Number(m.importo) || 0), 0);
  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

  // Breakdown 50/30/20
  let devoSum = 0;
  let hoBisognoSum = 0;
  let voglioSum = 0;

  expenseMovements.forEach(m => {
    const sub = subcategories.find(s => s.id === m.sottocategoria_id);
    const nec = m.necessita || sub?.necessita || 'DEVO';
    const amount = Number(m.importo) || 0;
    if (nec === 'DEVO' || nec === 'BISOGNO') devoSum += amount;
    else if (nec === 'HO_BISOGNO') hoBisognoSum += amount;
    else voglioSum += amount;
  });

  // Top Categorie di spesa
  const catMap = new Map<string, number>();
  expenseMovements.forEach(m => {
    const sub = subcategories.find(s => s.id === m.sottocategoria_id);
    const catName = sub?.nome || 'Altro';
    catMap.set(catName, (catMap.get(catName) || 0) + (Number(m.importo) || 0));
  });

  const topCategories = Array.from(catMap.entries())
    .map(([nome, totale]) => ({ nome, totale, pct: totalExpenses > 0 ? Math.round((totale / totalExpenses) * 100) : 0 }))
    .sort((a, b) => b.totale - a.totale)
    .slice(0, 6);

  // Patrimonio complessivo
  const totalAccountsLiquid = accounts.reduce((acc, a) => acc + (a.saldo_reale ?? a.saldo_iniziale ?? 0), 0);
  const totalFundsLiquid = funds.reduce((acc, f) => acc + (f.saldo_reale ?? f.saldo_iniziale ?? 0), 0);
  const totalNetWorth = totalAccountsLiquid + totalFundsLiquid;

  const handlePrint = () => {
    haptics.tap();
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        className="w-full max-w-3xl bg-white dark:bg-[#1C1C1E] rounded-[26px] shadow-2xl border border-slate-200/90 dark:border-white/10 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Modale */}
        <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/60 dark:bg-[#242426]/40 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[11px] bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <FileSpreadsheet size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#F5F5F7]">Report Mensile Stampabile</h3>
              <p className="text-[11px] text-slate-400 dark:text-[#8E8E93]">Consuntivo ufficiale {capitalizedMonth}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#E31B23] text-white hover:bg-[#c9171e] flex items-center gap-1.5 shadow-md shadow-red-600/20"
            >
              <Printer size={14} />
              <span>Stampa / PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-[#F5F5F7] hover:bg-slate-100 dark:hover:bg-[#242426]"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Foglio di Stampa / Documento A4 Styled */}
        <div ref={printRef} className="p-6 sm:p-8 overflow-y-auto space-y-6 bg-white dark:bg-[#121212] text-slate-900 dark:text-[#F5F5F7] no-scrollbar print:p-0">
          {/* Intestazione Documento */}
          <div className="flex items-start justify-between border-b-2 border-slate-200 dark:border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-[#E31B23] text-white font-bold flex items-center justify-center text-xs">FF</span>
                <span className="text-xl font-bold tracking-tight">Finanze Familiari</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#8E8E93] mt-1">Rendiconto Economico e Patrimonio</p>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-[#E31B23] block">{capitalizedMonth}</span>
              <span className="text-[11px] text-slate-400 dark:text-[#8E8E93]">Generato il {new Date().toLocaleDateString('it-IT')}</span>
            </div>
          </div>

          {/* 3 KPI Principali */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-[18px] bg-slate-50 dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-[#8E8E93] block">Entrate Totali</span>
              <p className="text-lg font-bold text-emerald-500 font-numeric tabular-nums">+{formatCurrency(totalIncome)}</p>
              <span className="text-[10px] text-slate-400">{incomeMovements.length} movimenti</span>
            </div>

            <div className="p-3.5 rounded-[18px] bg-slate-50 dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-[#8E8E93] block">Uscite Totali</span>
              <p className="text-lg font-bold text-slate-900 dark:text-[#F5F5F7] font-numeric tabular-nums">-{formatCurrency(totalExpenses)}</p>
              <span className="text-[10px] text-slate-400">{expenseMovements.length} movimenti</span>
            </div>

            <div className="p-3.5 rounded-[18px] bg-slate-50 dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-[#8E8E93] block">Risparmio Netto</span>
              <p className={`text-lg font-bold font-numeric tabular-nums ${netSavings >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {netSavings >= 0 ? '+' : ''}{formatCurrency(netSavings)}
              </p>
              <span className="text-[10px] text-slate-400">Tasso: {savingsRate}%</span>
            </div>
          </div>

          {/* Ripartizione 50/30/20 */}
          <div className="p-4 rounded-[20px] bg-slate-50 dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 space-y-3">
            <h4 className="text-xs font-bold text-slate-400 dark:text-[#8E8E93] uppercase tracking-wider">
              Ripartizione Spese (Regola 50 / 30 / 20)
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-[14px] bg-white dark:bg-[#242426] border border-slate-200/60 dark:border-white/5">
                <span className="text-[10px] font-bold text-blue-500 block">DEVO (Fisse/Obblighi)</span>
                <span className="text-sm font-bold font-numeric tabular-nums block mt-1">{formatCurrency(devoSum)}</span>
                <span className="text-[10px] text-slate-400">{totalExpenses > 0 ? Math.round((devoSum/totalExpenses)*100) : 0}%</span>
              </div>
              <div className="p-2.5 rounded-[14px] bg-white dark:bg-[#242426] border border-slate-200/60 dark:border-white/5">
                <span className="text-[10px] font-bold text-amber-500 block">HO BISOGNO (Primarie)</span>
                <span className="text-sm font-bold font-numeric tabular-nums block mt-1">{formatCurrency(hoBisognoSum)}</span>
                <span className="text-[10px] text-slate-400">{totalExpenses > 0 ? Math.round((hoBisognoSum/totalExpenses)*100) : 0}%</span>
              </div>
              <div className="p-2.5 rounded-[14px] bg-white dark:bg-[#242426] border border-slate-200/60 dark:border-white/5">
                <span className="text-[10px] font-bold text-purple-500 block">VOGLIO (Extra/Svago)</span>
                <span className="text-sm font-bold font-numeric tabular-nums block mt-1">{formatCurrency(voglioSum)}</span>
                <span className="text-[10px] text-slate-400">{totalExpenses > 0 ? Math.round((voglioSum/totalExpenses)*100) : 0}%</span>
              </div>
            </div>
          </div>

          {/* Top Voci di Spesa */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400 dark:text-[#8E8E93] uppercase tracking-wider">
              Principali Categorie di Spesa del Mese
            </h4>
            <div className="space-y-1.5">
              {topCategories.map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-[14px] bg-slate-50 dark:bg-[#1C1C1E] border border-slate-200/60 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-[#242426] text-slate-600 dark:text-[#8E8E93] text-[10.5px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold">{cat.nome}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold font-numeric tabular-nums">{formatCurrency(cat.totale)}</span>
                    <span className="text-[10px] text-slate-400 ml-2">({cat.pct}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Patrimonio Totale a Chiusura Periodo */}
          <div className="p-4 rounded-[20px] bg-slate-50 dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 dark:text-[#8E8E93] uppercase tracking-wider block">
                Patrimonio & Liquidità Complessiva
              </span>
              <span className="text-xs text-slate-500 dark:text-[#8E8E93] mt-0.5 block">
                {accounts.length} Conti Correnti + {funds.length} Fondi Risparmio
              </span>
            </div>
            <span className="text-xl font-bold text-[#E31B23] font-numeric tabular-nums">
              {formatCurrency(totalNetWorth)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
