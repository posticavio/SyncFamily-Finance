import React, { useState, useMemo } from 'react';
import { 
  Movement, 
  Subcategory, 
  AccountForecast, 
  DailyForecastPoint, 
  Planned, 
  Deadline 
} from '../types';
import { 
  LineChart, 
  BarChart3, 
  GitFork, 
  TrendingUp, 
  Wallet, 
  Sparkles, 
  LayoutGrid, 
  Maximize2,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Layers,
  HelpCircle,
  Printer,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency, formatItalianPercent } from '../utils/formatters';
import { haptics } from '../utils/haptics';
import { MonthlyMacroBreakdownChart } from './MonthlyMacroBreakdownChart';
import { CashflowSankeyChart } from './CashflowSankeyChart';
import { AccountsBalanceTimelineChart } from './AccountsBalanceTimelineChart';
import { DailySpendingIncomeChart } from './DailySpendingIncomeChart';
import { MonthlySpendingTrendsChart } from './MonthlySpendingTrendsChart';
import { AccountForecastChart } from './AccountForecastChart';
import { ReportComposerA4 } from './ReportComposerA4';
import { TabHeaderInfo } from './TabHeaderInfo';

export type AnalyticsTabType = 
  | 'ALL'
  | 'REPORT_A4'
  | 'MACRO_MONTHLY' 
  | 'SANKEY' 
  | 'MONTHLY' 
  | 'DAILY' 
  | 'FORECAST' 
  | 'ACCOUNTS';

interface AnalyticsViewProps {
  movements: Movement[];
  subcategories: Subcategory[];
  accounts: AccountForecast[];
  funds: AccountForecast[];
  daily30Days: DailyForecastPoint[];
  planned?: Planned[];
  deadlines?: Deadline[];
  totaleOggiCalcolato: number;
  totaleFineMese: number;
  totaleAlNove: number;
  onNavigateToTransactions?: () => void;
  onNavigateToBudget?: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  movements = [],
  subcategories = [],
  accounts = [],
  funds = [],
  daily30Days = [],
  planned = [],
  deadlines = [],
  totaleOggiCalcolato,
  totaleFineMese,
  totaleAlNove,
  onNavigateToTransactions,
  onNavigateToBudget
}) => {
  const [activeChartTab, setActiveChartTab] = useState<AnalyticsTabType>('MACRO_MONTHLY');

  // Calcolo metriche di sintesi dell'analisi
  const summaryMetrics = useMemo(() => {
    const validMovements = movements.filter(m => !(m as any).is_deleted);
    const confirmedMovements = validMovements.filter(m => m.stato === 'CONFERMATO');

    let totalEntrate = 0;
    let totalUscite = 0;
    const monthsSet = new Set<string>();

    for (const m of confirmedMovements) {
      if (m.data) {
        monthsSet.add(m.data.substring(0, 7));
      }
      if (m.tipologia === 'ENTRATA') {
        totalEntrate += m.importo;
      } else if (m.tipologia === 'USCITA') {
        totalUscite += m.importo;
      }
    }

    const monthCount = Math.max(1, monthsSet.size);
    const avgMonthlyIncome = Math.round((totalEntrate / monthCount) * 100) / 100;
    const avgMonthlyExpense = Math.round((totalUscite / monthCount) * 100) / 100;
    const netSaving = Math.round((totalEntrate - totalUscite) * 100) / 100;
    const savingRate = totalEntrate > 0 ? Math.round(((totalEntrate - totalUscite) / totalEntrate) * 1000) / 10 : 0;

    return {
      totalEntrate,
      totalUscite,
      avgMonthlyIncome,
      avgMonthlyExpense,
      netSaving,
      savingRate,
      txCount: confirmedMovements.length,
      monthCount
    };
  }, [movements]);

  const chartTabs: { id: AnalyticsTabType; label: string; icon: React.ComponentType<{ size: number; className?: string }>; description: string }[] = [
    { 
      id: 'MACRO_MONTHLY', 
      label: 'Entrate vs Spese', 
      icon: BarChart3,
      description: 'Confronto mensile e ripartizione 50/30/20 (Devo, Ho bisogno, Voglio)'
    },
    { 
      id: 'SANKEY', 
      label: 'Flusso Sankey', 
      icon: GitFork,
      description: 'Diagramma di flusso dinamico: dai conti di entrata alle categorie di spesa'
    },
    { 
      id: 'MONTHLY', 
      label: 'Trend Mensile', 
      icon: TrendingUp,
      description: 'Andamento storico mensile delle spese suddivise per categoria'
    },
    { 
      id: 'DAILY', 
      label: 'Flussi 30 Giorni', 
      icon: Calendar,
      description: 'Entrate e uscite giornaliere registrate negli ultimi 30 giorni'
    },
    { 
      id: 'FORECAST', 
      label: 'Proiezione Saldo', 
      icon: Sparkles,
      description: 'Evoluzione della liquidità e stima del saldo fino al 9 del mese successivo'
    },
    { 
      id: 'ACCOUNTS', 
      label: 'Saldi per Conto', 
      icon: Wallet,
      description: 'Andamento storico e proiezioni separate per ciascun conto bancario e fondo'
    },
    { 
      id: 'ALL', 
      label: 'Tutti i Grafici', 
      icon: LayoutGrid,
      description: 'Visualizzazione panoramica completa di tutti i grafici analitici'
    },
    { 
      id: 'REPORT_A4', 
      label: 'Report A4 Stampabile', 
      icon: Printer,
      description: 'Componi, ridimensiona e stampa i grafici su foglio A4 orizzontale o verticale'
    }
  ];

  return (
    <div id="analytics-view-root" className="space-y-4 sm:space-y-5">
      {/* Viewing Area Header (One UI Style) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-1 border-b border-slate-100 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-[16px] bg-[#E31B23]/10 text-[#E31B23] flex items-center justify-center flex-shrink-0 shadow-2xs">
            <LineChart size={24} strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F5F5F7] tracking-tight">
                Analisi & Grafici <span className="hidden md:inline text-base font-mono font-normal text-slate-400 dark:text-slate-500">(A)</span>
              </h1>
              <TabHeaderInfo text="Quadro analitico avanzato: flussi cassa, modelli 50/30/20, diagrammi Sankey e proiezioni di liquidità" />
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-[#8E8E93] mt-0.5">
              Esplora andamenti, correlazioni e componi report A4 personalizzati
            </p>
          </div>
        </div>

        {/* Quick Actions and KPI Indicators */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            id="open-report-a4-composer-btn"
            onClick={() => {
              haptics.tap();
              setActiveChartTab('REPORT_A4');
            }}
            className={`px-3.5 py-2 rounded-full font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 border ${
              activeChartTab === 'REPORT_A4'
                ? 'bg-[#E31B23] text-white border-[#E31B23] shadow-xs'
                : 'bg-[#E31B23]/10 hover:bg-[#E31B23]/20 text-[#E31B23] dark:bg-[#E31B23]/15 dark:hover:bg-[#E31B23]/25 border-[#E31B23]/20'
            }`}
          >
            <Printer size={15} strokeWidth={2.2} />
            <span>Componi Report A4</span>
          </button>

          <div className="bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 rounded-[18px] px-3.5 py-2 shadow-2xs flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ArrowUpRight size={15} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#8E8E93] block leading-none">
                Media Entrate / Mese
              </span>
              <span className="font-numeric text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatCurrency(summaryMetrics.avgMonthlyIncome)}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 rounded-[18px] px-3.5 py-2 shadow-2xs flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#2A2A2E] text-slate-700 dark:text-[#F5F5F7] flex items-center justify-center shrink-0">
              <ArrowDownRight size={15} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#8E8E93] block leading-none">
                Media Spese / Mese
              </span>
              <span className="font-numeric text-xs sm:text-sm font-bold text-slate-900 dark:text-[#F5F5F7] tabular-nums">
                {formatCurrency(summaryMetrics.avgMonthlyExpense)}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 rounded-[18px] px-3.5 py-2 shadow-2xs flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[#E31B23]/10 text-[#E31B23] flex items-center justify-center shrink-0">
              <Percent size={14} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#8E8E93] block leading-none">
                Tasso Risparmio
              </span>
              <span className="font-numeric text-xs sm:text-sm font-bold text-[#E31B23] tabular-nums">
                {summaryMetrics.savingRate > 0 ? `+${summaryMetrics.savingRate}%` : `${summaryMetrics.savingRate}%`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Pills Bar (One UI Horizontal Pill Selector) */}
      <div 
        id="analytics-chart-selector-bar"
        className="bg-white dark:bg-[#1C1C1E] p-2 rounded-[24px] border border-slate-200/80 dark:border-white/5 shadow-2xs flex items-center gap-1.5 overflow-x-auto no-scrollbar"
      >
        {chartTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeChartTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`analytics-pill-${tab.id.toLowerCase()}`}
              type="button"
              onClick={() => {
                haptics.tap();
                setActiveChartTab(tab.id);
              }}
              className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer active:scale-95 shrink-0 ${
                isActive
                  ? 'bg-[#E31B23] text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7] hover:bg-slate-100 dark:hover:bg-[#242426]'
              }`}
              title={tab.description}
            >
              <Icon size={15} strokeWidth={isActive ? 2.5 : 2} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Chart Header Description */}
      {activeChartTab !== 'ALL' && (
        <div className="px-1 text-xs text-slate-500 dark:text-[#8E8E93] flex items-center gap-1.5">
          <Layers size={13} className="text-[#E31B23]" />
          <span>
            {chartTabs.find(t => t.id === activeChartTab)?.description}
          </span>
        </div>
      )}

      {/* Main Charts Area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeChartTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
          className="space-y-6"
        >
          {/* Vista Compositore Report A4 (Stampa & PDF) */}
          {activeChartTab === 'REPORT_A4' && (
            <ReportComposerA4
              movements={movements}
              subcategories={subcategories}
              accounts={accounts}
              funds={funds}
              daily30Days={daily30Days}
              planned={planned}
              deadlines={deadlines}
              totaleOggiCalcolato={totaleOggiCalcolato}
              totaleFineMese={totaleFineMese}
              totaleAlNove={totaleAlNove}
              onClose={() => setActiveChartTab('MACRO_MONTHLY')}
            />
          )}

          {/* Vista Singola 1: Macro Mensile (Entrate vs Spese & 50/30/20) */}
          {(activeChartTab === 'MACRO_MONTHLY' || activeChartTab === 'ALL') && (
            <div className="space-y-2">
              {activeChartTab === 'ALL' && (
                <div className="flex items-center gap-2 px-1 pt-2">
                  <BarChart3 size={18} className="text-[#E31B23]" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-[#F5F5F7]">
                    1. Entrate vs Spese & Ripartizione 50/30/20
                  </h2>
                </div>
              )}
              <MonthlyMacroBreakdownChart
                movements={movements}
                subcategories={subcategories}
                planned={planned}
                deadlines={deadlines}
              />
            </div>
          )}

          {/* Vista Singola 2: Sankey Flow */}
          {(activeChartTab === 'SANKEY' || activeChartTab === 'ALL') && (
            <div className="space-y-2">
              {activeChartTab === 'ALL' && (
                <div className="flex items-center gap-2 px-1 pt-4">
                  <GitFork size={18} className="text-[#E31B23]" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-[#F5F5F7]">
                    2. Flusso di Cassa Dinamico Sankey
                  </h2>
                </div>
              )}
              <CashflowSankeyChart
                movements={movements}
                subcategories={subcategories}
              />
            </div>
          )}

          {/* Vista Singola 3: Trend Storico Mensile */}
          {(activeChartTab === 'MONTHLY' || activeChartTab === 'ALL') && (
            <div className="space-y-2">
              {activeChartTab === 'ALL' && (
                <div className="flex items-center gap-2 px-1 pt-4">
                  <TrendingUp size={18} className="text-[#E31B23]" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-[#F5F5F7]">
                    3. Trend Storico Mensile & Budget
                  </h2>
                </div>
              )}
              <MonthlySpendingTrendsChart
                movements={movements}
                subcategories={subcategories}
                planned={planned}
                deadlines={deadlines}
              />
            </div>
          )}

          {/* Vista Singola 4: Flussi Giornalieri 30 Giorni */}
          {(activeChartTab === 'DAILY' || activeChartTab === 'ALL') && (
            <div className="space-y-2">
              {activeChartTab === 'ALL' && (
                <div className="flex items-center gap-2 px-1 pt-4">
                  <Calendar size={18} className="text-[#E31B23]" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-[#F5F5F7]">
                    4. Flussi Giornalieri (Entrate vs Uscite Ultimi 30gg)
                  </h2>
                </div>
              )}
              <DailySpendingIncomeChart
                movements={movements}
                daily30Days={daily30Days}
                planned={planned}
                deadlines={deadlines}
              />
            </div>
          )}

          {/* Vista Singola 5: Proiezione Saldo */}
          {(activeChartTab === 'FORECAST' || activeChartTab === 'ALL') && daily30Days.length > 0 && (
            <div className="space-y-2">
              {activeChartTab === 'ALL' && (
                <div className="flex items-center gap-2 px-1 pt-4">
                  <Sparkles size={18} className="text-[#E31B23]" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-[#F5F5F7]">
                    5. Proiezione Saldo e Liquidità fino al 9 Successivo
                  </h2>
                </div>
              )}
              <AccountForecastChart
                data={daily30Days}
                totaleOggiCalcolato={totaleOggiCalcolato}
                totaleFineMese={totaleFineMese}
                totaleAlNove={totaleAlNove}
              />
            </div>
          )}

          {/* Vista Singola 6: Saldi per Singolo Conto nel Tempo */}
          {(activeChartTab === 'ACCOUNTS' || activeChartTab === 'ALL') && (
            <div className="space-y-2">
              {activeChartTab === 'ALL' && (
                <div className="flex items-center gap-2 px-1 pt-4">
                  <Wallet size={18} className="text-[#E31B23]" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-[#F5F5F7]">
                    6. Evoluzione e Saldi per Singolo Conto
                  </h2>
                </div>
              )}
              <AccountsBalanceTimelineChart
                accounts={accounts}
                funds={funds}
                movements={movements}
                planned={planned}
                deadlines={deadlines}
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
