import React, { useState, useMemo } from 'react';
import { AccountForecast, ControlAlert, DailyForecastPoint, Movement, Subcategory, Deadline, Planned, WeeklyFinancialReport } from '../types';
import { formatCurrency } from '../utils/formatters';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowRight, 
  ShieldCheck, 
  Wallet, 
  Calendar, 
  Clock, 
  LayoutDashboard, 
  LineChart, 
  BarChart3, 
  Sparkles,
  LayoutGrid,
  GitFork,
  PieChart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { haptics } from '../utils/haptics';
import { DashboardSkeleton } from './DashboardSkeleton';
import { TabHeaderInfo } from './TabHeaderInfo';
import { Carousel } from './Carousel';
import { DailyBurnRateWidget } from './DailyBurnRateWidget';

interface BentoDashboardProps {
  isLoading?: boolean;
  totaleOggiCalcolato: number;
  totaleOggiReale: number;
  differenzaTotale: number;
  totaleFineMese: number;
  totaleAlNove: number;
  entrateMese: number;
  usciteMese: number;
  accounts: AccountForecast[];
  funds: AccountForecast[];
  daily30Days: DailyForecastPoint[];
  dailyForecastData?: DailyForecastPoint[];
  alerts: ControlAlert[];
  movements?: Movement[];
  subcategories?: Subcategory[];
  planned?: Planned[];
  deadlines?: Deadline[];
  weeklyReport?: WeeklyFinancialReport | null;
  allWeeklyReports?: WeeklyFinancialReport[];
  isWeeklyReportLoading?: boolean;
  onRefreshWeeklyReport?: () => Promise<void>;
  onOpenControlCenter: () => void;
  onOpenAccounts: () => void;
  onNavigateToCalendar?: (dateStr?: string) => void;
  onNavigateToProjects?: () => void;
  onNavigateToNotes?: () => void;
  onNavigateToReports?: () => void;
  onNavigateToAnalytics?: () => void;
  onRefresh?: () => void;
}

export const BentoDashboard: React.FC<BentoDashboardProps> = ({
  isLoading,
  totaleOggiCalcolato,
  totaleOggiReale,
  differenzaTotale,
  totaleFineMese,
  totaleAlNove,
  entrateMese,
  usciteMese,
  accounts,
  funds,
  daily30Days,
  dailyForecastData = [],
  alerts,
  movements = [],
  subcategories = [],
  planned = [],
  deadlines = [],
  weeklyReport = null,
  allWeeklyReports = [],
  isWeeklyReportLoading = false,
  onRefreshWeeklyReport,
  onOpenControlCenter,
  onOpenAccounts,
  onNavigateToCalendar,
  onNavigateToProjects,
  onNavigateToNotes,
  onNavigateToReports,
  onNavigateToAnalytics,
  onRefresh
}) => {
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const [includePlanned, setIncludePlanned] = useState(false);
  const [summaryViewTab, setSummaryViewTab] = useState<'SALDI' | 'FLUSSI' | 'TUTTI'>('SALDI');

  // Calcolo totale movimenti programmati da accounts + funds oppure da planned prop
  const totalPlannedCount = useMemo(() => {
    const all = [...accounts, ...funds];
    const fromAccounts = all.reduce((acc, i) => acc + (i.conteggio_programmati || 0), 0);
    if (fromAccounts > 0) return fromAccounts;
    return (planned || []).filter(p => p.stato === 'PENDENTE' && !(p as any).is_deleted).length;
  }, [accounts, funds, planned]);

  const totalPlannedNet = useMemo(() => {
    const all = [...accounts, ...funds];
    const fromAccounts = all.reduce((acc, i) => acc + (i.totale_programmati || 0), 0);
    if (fromAccounts !== 0) return Math.round(fromAccounts * 100) / 100;
    const pending = (planned || []).filter(p => p.stato === 'PENDENTE' && !(p as any).is_deleted);
    let net = 0;
    for (const p of pending) {
      if (p.tipologia === 'ENTRATA') net += p.importo;
      else if (p.tipologia === 'USCITA') net -= p.importo;
    }
    return Math.round(net * 100) / 100;
  }, [accounts, funds, planned]);

  const displayedSaldoOggi = useMemo(() => {
    if (includePlanned) {
      return Math.round((totaleOggiCalcolato + totalPlannedNet) * 100) / 100;
    }
    return totaleOggiCalcolato;
  }, [includePlanned, totaleOggiCalcolato, totalPlannedNet]);

  const chartPoints = (daily30Days && daily30Days.length > 0) ? daily30Days : dailyForecastData;
  const risultatoMese = Math.round((entrateMese - usciteMese) * 100) / 100;
  const hasDiff = differenzaTotale !== 0;

  const renderSaldiCards = () => (
    <Carousel
      id="dashboard-saldi-carousel"
      desktopGridClassName="sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-3.5"
      showDots={true}
      showArrows={true}
      ariaLabel="Saldi e Proiezioni di Liquidità"
    >
      {/* Card 1: Saldo Oggi (Reale e Calcolato) */}
      <div className="sm:col-span-2 md:col-span-1 bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 rounded-[22px] p-4 sm:p-5 shadow-sm flex flex-col justify-between relative overflow-hidden h-full min-h-[175px]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-xs font-semibold text-slate-500 dark:text-[#8E8E93] uppercase tracking-wide">
              {includePlanned ? 'Saldo con Programmati' : 'Saldo Disponibile'}
            </span>
            {totalPlannedCount > 0 && (
              <button
                type="button"
                onClick={() => setIncludePlanned(!includePlanned)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all shrink-0 ${
                  includePlanned
                    ? 'bg-[#E31B23] text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-[#2A2A2E] text-slate-700 dark:text-[#F5F5F7] border border-slate-200/60 dark:border-white/5'
                }`}
                title={includePlanned ? 'Clicca per vedere il Saldo Contabile base' : 'Clicca per includere i movimenti programmati'}
              >
                <Clock size={10} />
                <span>{includePlanned ? 'Inclusi' : `+${totalPlannedCount} prog.`}</span>
              </button>
            )}
          </div>
          <button
            onClick={onOpenAccounts}
            className="p-1.5 rounded-xl text-slate-400 hover:text-[#E31B23] dark:hover:text-[#E31B23] hover:bg-slate-100 dark:hover:bg-[#2A2A2E] transition-colors shrink-0 cursor-pointer"
            title="Gestisci Conti"
          >
            <Wallet size={16} />
          </button>
        </div>

        <div className="my-2 sm:my-2.5">
          <div className="font-numeric text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F5F5F7] tracking-tight tabular-nums">
            {formatCurrency(displayedSaldoOggi)}
          </div>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
            <span className="text-xs text-slate-500 dark:text-[#8E8E93]">
              Reale: <strong className="font-numeric text-slate-700 dark:text-[#F5F5F7] tabular-nums">{formatCurrency(totaleOggiReale)}</strong>
            </span>
            {hasDiff && (
              <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full tabular-nums ${differenzaTotale > 0 ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'}`}>
                Diff: {formatCurrency(differenzaTotale, { showSign: true })}
              </span>
            )}
          </div>

          {/* Riepilogo impatto movimenti programmati */}
          {totalPlannedCount > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-xs text-slate-500 dark:text-[#8E8E93]">
              <span className="text-slate-400">
                {includePlanned ? 'Base:' : 'Con programmati:'}
              </span>
              <span className="font-numeric font-bold text-slate-700 dark:text-[#F5F5F7] tabular-nums">
                {formatCurrency(includePlanned ? totaleOggiCalcolato : (totaleOggiCalcolato + totalPlannedNet))}
              </span>
              <span className={`text-[10px] font-mono font-semibold tabular-nums ${totalPlannedNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                ({formatCurrency(totalPlannedNet, { showSign: true })})
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-[#8E8E93] pt-2 border-t border-slate-100 dark:border-white/5">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span>{accounts.length} conti e {funds.length} fondi attivi</span>
        </div>
      </div>

      {/* Card 2: Saldo a Fine Mese */}
      <div className="col-span-1 bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 rounded-[22px] p-4 sm:p-5 shadow-sm flex flex-col justify-between h-full min-h-[175px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-[#8E8E93] uppercase tracking-wide">
            Previsto Fine Mese
          </span>
          <div className="w-7 h-7 rounded-lg bg-[#E31B23]/10 text-[#E31B23] flex items-center justify-center shrink-0">
            <Calendar size={15} />
          </div>
        </div>

        <div className="my-2 sm:my-2.5">
          <div className="font-numeric text-xl sm:text-2xl lg:text-3xl font-bold text-[#E31B23] dark:text-[#E31B23] tracking-tight tabular-nums">
            {formatCurrency(totaleFineMese)}
          </div>
          {totaleFineMese !== totaleOggiCalcolato && (
            <div className="mt-1 flex items-center">
              <span className={`inline-block text-[10px] sm:text-[11px] font-semibold font-numeric tabular-nums px-2 py-0.5 rounded-lg ${
                totaleFineMese > totaleOggiCalcolato 
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                  : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
              }`}>
                {formatCurrency(totaleFineMese - totaleOggiCalcolato, { showSign: true })}
              </span>
            </div>
          )}
          <p className="text-[11px] text-slate-400 dark:text-[#8E8E93] mt-1">
            Include flussi fino al 30/31
          </p>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 dark:text-[#8E8E93] pt-2 border-t border-slate-100 dark:border-white/5">
          <span>Chiusura mese</span>
          <span className="font-numeric font-medium text-slate-700 dark:text-[#F5F5F7] shrink-0">Fine mese</span>
        </div>
      </div>

      {/* Card 3: Saldo al 9 del Mese Successivo */}
      <div className="col-span-1 bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 rounded-[22px] p-4 sm:p-5 shadow-sm flex flex-col justify-between h-full min-h-[175px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-[#8E8E93] uppercase tracking-wide">
            Saldo al 9 Mese Succ.
          </span>
          <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#2A2A2E] text-slate-500 dark:text-[#8E8E93] flex items-center justify-center shrink-0">
            <ShieldCheck size={15} />
          </div>
        </div>

        <div className="my-2 sm:my-2.5">
          <div className="font-numeric text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800 dark:text-[#F5F5F7] tracking-tight tabular-nums">
            {formatCurrency(totaleAlNove)}
          </div>
          {totaleAlNove !== totaleOggiCalcolato && (
            <div className="mt-1 flex items-center">
              <span className={`inline-block text-[10px] sm:text-[11px] font-semibold font-numeric tabular-nums px-2 py-0.5 rounded-lg ${
                totaleAlNove > totaleOggiCalcolato 
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                  : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
              }`}>
                {formatCurrency(totaleAlNove - totaleOggiCalcolato, { showSign: true })}
              </span>
            </div>
          )}
          <p className="text-[11px] text-slate-400 dark:text-[#8E8E93] mt-1">
            Flussi fino al 9° giorno
          </p>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 dark:text-[#8E8E93] pt-2 border-t border-slate-100 dark:border-white/5">
          <span>Controllo sicurezza</span>
          <span className="font-numeric font-medium text-slate-700 dark:text-[#F5F5F7] shrink-0">Al 9 succ.</span>
        </div>
      </div>
    </Carousel>
  );

  const renderFlussiCards = () => (
    <Carousel
      id="dashboard-flussi-carousel"
      desktopGridClassName="sm:grid-cols-3 gap-3 sm:gap-3.5"
      showDots={true}
      showArrows={true}
      ariaLabel="Flussi Finanziari del Mese"
    >
      {/* Entrate Mese */}
      <div className="bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 rounded-[22px] p-4 sm:p-5 shadow-sm flex flex-col justify-between h-full min-h-[160px]">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs font-semibold text-slate-500 dark:text-[#8E8E93] uppercase tracking-wide">
            Entrate Mese
          </span>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <TrendingUp size={16} />
          </div>
        </div>
        <div>
          <span className="font-numeric text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 block tabular-nums">
            {formatCurrency(entrateMese, { showSign: true })}
          </span>
          <span className="text-[11px] text-slate-400 dark:text-[#8E8E93] block mt-1">
            Incassi registrati nel mese
          </span>
        </div>
      </div>

      {/* Uscite Mese */}
      <div className="bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 rounded-[22px] p-4 sm:p-5 shadow-sm flex flex-col justify-between h-full min-h-[160px]">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs font-semibold text-slate-500 dark:text-[#8E8E93] uppercase tracking-wide">
            Uscite Mese
          </span>
          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#2A2A2E] text-slate-700 dark:text-[#F5F5F7] flex items-center justify-center shrink-0">
            <TrendingDown size={16} />
          </div>
        </div>
        <div>
          <span className="font-numeric text-xl sm:text-2xl font-bold text-slate-900 dark:text-[#F5F5F7] block tabular-nums">
            {formatCurrency(usciteMese)}
          </span>
          <span className="text-[11px] text-slate-400 dark:text-[#8E8E93] block mt-1">
            Spese complessive del mese
          </span>
        </div>
      </div>

      {/* Risultato Netto Mese */}
      <div className="bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 rounded-[22px] p-4 sm:p-5 shadow-sm flex flex-col justify-between h-full min-h-[160px]">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs font-semibold text-slate-500 dark:text-[#8E8E93] uppercase tracking-wide">
            Risultato Netto
          </span>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${risultatoMese >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'}`}>
            <ShieldCheck size={16} />
          </div>
        </div>
        <div>
          <span className={`font-numeric text-xl sm:text-2xl font-bold block tabular-nums ${risultatoMese >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {formatCurrency(risultatoMese, { showSign: true })}
          </span>
          <span className="text-[11px] text-slate-400 dark:text-[#8E8E93] block mt-1">
            {risultatoMese >= 0 ? 'Avanzo netto di bilancio' : 'Disavanzo netto di bilancio'}
          </span>
        </div>
      </div>
    </Carousel>
  );

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayExpenses = useMemo(() => {
    return (movements || [])
      .filter(m => m.tipologia === 'USCITA' && m.data === todayStr && !(m as any).is_deleted)
      .reduce((sum, m) => sum + (Number(m.importo) || 0), 0);
  }, [movements, todayStr]);

  const daysRemainingInCycle = useMemo(() => {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return Math.max(1, endOfMonth.getDate() - now.getDate());
  }, []);

  const remainingVariableBudget = useMemo(() => {
    const remaining = Math.max(0, entrateMese - usciteMese);
    return remaining > 0 ? remaining : Math.max(0, 600 - todayExpenses);
  }, [entrateMese, usciteMese, todayExpenses]);

  return (
    <div id="bento-dashboard-grid" className="mt-0 space-y-2.5 sm:space-y-4">
      {/* 4. SEZIONE TITOLO PAGINA CON SELETTORE METRICHE INTEGRATO NELL'AREA BLU */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 pb-0.5 sm:pb-1">
        {/* Sinistra: Icona blu + Titolo + Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
            <LayoutDashboard size={22} />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Homepage <span className="hidden md:inline text-base font-mono font-normal text-slate-400 dark:text-slate-500">(H)</span>
            </h1>
            <TabHeaderInfo text="Saldi disponibili, proiezioni di liquidità a 30 giorni e andamento mensile" />
          </div>
        </div>

        {/* Destra: Selettore compatto One UI posizionato nell'area di testata */}
        <div
          id="metrics-view-switcher"
          className="inline-flex self-start sm:self-auto items-center bg-indigo-50/90 dark:bg-indigo-950/60 p-1 rounded-full text-xs font-medium border border-indigo-200/70 dark:border-indigo-800/60 shadow-2xs flex-shrink-0"
        >
          <button
            type="button"
            id="tab-btn-saldi"
            onClick={() => {
              setSummaryViewTab('SALDI');
              haptics.tap();
            }}
            className={`px-3 py-1.5 rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer active:scale-95 text-xs ${
              summaryViewTab === 'SALDI'
                ? 'bg-[#E31B23] text-white shadow-2xs font-semibold'
                : 'text-slate-600 dark:text-[#8E8E93] hover:text-indigo-600 dark:hover:text-indigo-300'
            }`}
          >
            <Wallet size={13} strokeWidth={2} />
            <span>Saldi</span>
          </button>

          <button
            type="button"
            id="tab-btn-flussi"
            onClick={() => {
              setSummaryViewTab('FLUSSI');
              haptics.tap();
            }}
            className={`px-3 py-1.5 rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer active:scale-95 text-xs ${
              summaryViewTab === 'FLUSSI'
                ? 'bg-[#E31B23] text-white shadow-2xs font-semibold'
                : 'text-slate-600 dark:text-[#8E8E93] hover:text-indigo-600 dark:hover:text-indigo-300'
            }`}
          >
            <TrendingUp size={13} strokeWidth={2} />
            <span>Flussi</span>
          </button>

          <button
            type="button"
            id="tab-btn-tutti"
            onClick={() => {
              setSummaryViewTab('TUTTI');
              haptics.tap();
            }}
            className={`px-3 py-1.5 rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer active:scale-95 text-xs ${
              summaryViewTab === 'TUTTI'
                ? 'bg-[#E31B23] text-white shadow-2xs font-semibold'
                : 'text-slate-600 dark:text-[#8E8E93] hover:text-indigo-600 dark:hover:text-indigo-300'
            }`}
          >
            <LayoutGrid size={13} strokeWidth={2} />
            <span>Tutti</span>
          </button>
        </div>
      </div>

      {/* Visualizzazione delle Card con Transizione Morbida */}
      <AnimatePresence mode="wait">
        {summaryViewTab === 'SALDI' && (
          <motion.div
            key="dashboard-metrics-saldi"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {renderSaldiCards()}
          </motion.div>
        )}

        {summaryViewTab === 'FLUSSI' && (
          <motion.div
            key="dashboard-metrics-flussi"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {renderFlussiCards()}
          </motion.div>
        )}

        {summaryViewTab === 'TUTTI' && (
          <motion.div
            key="dashboard-metrics-tutti"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="space-y-3.5"
          >
            {renderSaldiCards()}
            {renderFlussiCards()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Widget Ritmo di Spesa Giornaliera Consigliata (Safe-to-Spend One UI) */}
      <DailyBurnRateWidget
        remainingBudget={remainingVariableBudget}
        daysRemainingInCycle={daysRemainingInCycle}
        todaySpent={todayExpenses}
        totalCycleBudget={entrateMese > 0 ? entrateMese : 1500}
      />
    </div>
  );
};
