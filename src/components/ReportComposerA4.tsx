import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Movement, 
  Subcategory, 
  AccountForecast, 
  DailyForecastPoint, 
  Planned, 
  Deadline 
} from '../types';
import { 
  Printer, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Sliders, 
  Maximize2, 
  Minimize2, 
  RotateCw, 
  FileText, 
  Sparkles, 
  BarChart3, 
  GitFork, 
  TrendingUp, 
  Calendar, 
  Wallet, 
  Layers, 
  Check, 
  RefreshCw, 
  Eye, 
  Settings, 
  Edit3, 
  LayoutGrid, 
  Landmark, 
  ArrowLeft,
  X,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency, formatDate } from '../utils/formatters';
import { haptics } from '../utils/haptics';
import { MonthlyMacroBreakdownChart } from './MonthlyMacroBreakdownChart';
import { CashflowSankeyChart } from './CashflowSankeyChart';
import { AccountsBalanceTimelineChart } from './AccountsBalanceTimelineChart';
import { DailySpendingIncomeChart } from './DailySpendingIncomeChart';
import { MonthlySpendingTrendsChart } from './MonthlySpendingTrendsChart';
import { AccountForecastChart } from './AccountForecastChart';

export type ChartBlockType = 
  | 'KPI_METRICS'
  | 'MACRO_MONTHLY' 
  | 'SANKEY' 
  | 'MONTHLY' 
  | 'DAILY' 
  | 'FORECAST' 
  | 'ACCOUNTS'
  | 'ACCOUNTS_TABLE'
  | 'CUSTOM_NOTE';

export type BlockWidth = 'FULL' | 'HALF' | 'THIRD' | 'TWO_THIRDS';
export type BlockHeight = 'COMPACT' | 'STANDARD' | 'LARGE';
export type PageOrientation = 'PORTRAIT' | 'LANDSCAPE';

export interface ReportBlockConfig {
  id: string;
  type: ChartBlockType;
  title: string;
  width: BlockWidth;
  height: BlockHeight;
  customNote?: string;
  showInPrint: boolean;
}

interface ReportComposerA4Props {
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
  onClose?: () => void;
}

const STORAGE_KEY = 'sync_family_report_a4_layout_v1';

const DEFAULT_BLOCKS: ReportBlockConfig[] = [
  {
    id: 'block-kpi',
    type: 'KPI_METRICS',
    title: 'Quadro Sintetico & Metriche di Cassa',
    width: 'FULL',
    height: 'COMPACT',
    showInPrint: true
  },
  {
    id: 'block-macro',
    type: 'MACRO_MONTHLY',
    title: 'Entrate vs Spese & Ripartizione 50/30/20',
    width: 'FULL',
    height: 'STANDARD',
    showInPrint: true
  },
  {
    id: 'block-sankey',
    type: 'SANKEY',
    title: 'Diagramma di Flusso Cassa (Sankey)',
    width: 'HALF',
    height: 'STANDARD',
    showInPrint: true
  },
  {
    id: 'block-monthly',
    type: 'MONTHLY',
    title: 'Trend Storico Mensile Spese',
    width: 'HALF',
    height: 'STANDARD',
    showInPrint: true
  },
  {
    id: 'block-forecast',
    type: 'FORECAST',
    title: 'Proiezione di Liquidità fino al 9 Successivo',
    width: 'FULL',
    height: 'COMPACT',
    showInPrint: true
  }
];

export const ReportComposerA4: React.FC<ReportComposerA4Props> = ({
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
  onClose
}) => {
  const [orientation, setOrientation] = useState<PageOrientation>('LANDSCAPE');
  const [reportTitle, setReportTitle] = useState('Report Finanziario Famigliare');
  const [reportSubtitle, setReportSubtitle] = useState(() => {
    const d = new Date();
    const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    return `Prospetto Analitico - ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  });
  const [reportNotes, setReportNotes] = useState('Report generato ad uso interno con proiezioni di cassa, ripartizione delle spese per categoria e analisi di sostenibilità economica.');
  const [showNotesInPrint, setShowNotesInPrint] = useState(true);
  const [blocks, setBlocks] = useState<ReportBlockConfig[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Errore lettura layout report da storage:', e);
    }
    return DEFAULT_BLOCKS;
  });

  const [isAddBlockOpen, setIsAddBlockOpen] = useState(false);
  const [selectedBlockForEdit, setSelectedBlockForEdit] = useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = useState<'fit' | '100' | '85'>('fit');

  // Salvataggio layout in localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
    } catch (e) {
      console.warn('Errore salvataggio layout report:', e);
    }
  }, [blocks]);

  // Calcolo KPI di sintesi
  const summaryMetrics = useMemo(() => {
    const valid = movements.filter(m => !(m as any).is_deleted);
    const confirmed = valid.filter(m => m.stato === 'CONFERMATO');

    let totalEntrate = 0;
    let totalUscite = 0;
    const monthsSet = new Set<string>();

    for (const m of confirmed) {
      if (m.data) monthsSet.add(m.data.substring(0, 7));
      if (m.tipologia === 'ENTRATA') totalEntrate += m.importo;
      else if (m.tipologia === 'USCITA') totalUscite += m.importo;
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
      txCount: confirmed.length,
      totaleLiquidita: totaleOggiCalcolato
    };
  }, [movements, totaleOggiCalcolato]);

  // Gestione aggiunta nuovo blocco
  const handleAddBlock = (type: ChartBlockType) => {
    let title = 'Nuovo Grafico';
    let defaultWidth: BlockWidth = 'FULL';
    let defaultHeight: BlockHeight = 'STANDARD';

    switch (type) {
      case 'KPI_METRICS':
        title = 'Quadro Sintetico & Indicatori';
        defaultWidth = 'FULL';
        defaultHeight = 'COMPACT';
        break;
      case 'MACRO_MONTHLY':
        title = 'Entrate vs Spese (Mese per Mese & 50/30/20)';
        defaultWidth = 'FULL';
        defaultHeight = 'STANDARD';
        break;
      case 'SANKEY':
        title = 'Flusso di Cassa Dinamico Sankey';
        defaultWidth = 'HALF';
        defaultHeight = 'STANDARD';
        break;
      case 'MONTHLY':
        title = 'Trend Storico Mensile & Budget';
        defaultWidth = 'HALF';
        defaultHeight = 'STANDARD';
        break;
      case 'DAILY':
        title = 'Flussi Giornalieri 30 Giorni';
        defaultWidth = 'FULL';
        defaultHeight = 'STANDARD';
        break;
      case 'FORECAST':
        title = 'Proiezione Saldo fino al 9 Successivo';
        defaultWidth = 'FULL';
        defaultHeight = 'COMPACT';
        break;
      case 'ACCOUNTS':
        title = 'Evoluzione Saldi per Singolo Conto';
        defaultWidth = 'FULL';
        defaultHeight = 'STANDARD';
        break;
      case 'ACCOUNTS_TABLE':
        title = 'Tabella Saldi Conti & Riserve';
        defaultWidth = 'FULL';
        defaultHeight = 'COMPACT';
        break;
      case 'CUSTOM_NOTE':
        title = 'Nota / Commento Esecutivo';
        defaultWidth = 'FULL';
        defaultHeight = 'COMPACT';
        break;
    }

    const newBlock: ReportBlockConfig = {
      id: `block-${Date.now()}`,
      type,
      title,
      width: defaultWidth,
      height: defaultHeight,
      showInPrint: true
    };

    setBlocks(prev => [...prev, newBlock]);
    setIsAddBlockOpen(false);
    haptics.impact();
  };

  // Rimozione blocco
  const handleRemoveBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    haptics.tap();
  };

  // Sposta in alto / basso
  const handleMoveBlock = (index: number, direction: 'UP' | 'DOWN') => {
    if (direction === 'UP' && index === 0) return;
    if (direction === 'DOWN' && index === blocks.length - 1) return;

    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    const newBlocks = [...blocks];
    const item = newBlocks.splice(index, 1)[0];
    newBlocks.splice(targetIndex, 0, item);
    setBlocks(newBlocks);
    haptics.tap();
  };

  // Modifica larghezza blocco
  const handleChangeWidth = (id: string, width: BlockWidth) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, width } : b));
    haptics.tap();
  };

  // Modifica altezza blocco
  const handleChangeHeight = (id: string, height: BlockHeight) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, height } : b));
    haptics.tap();
  };

  // Preset Layout Rapidi
  const handleApplyPreset = (presetName: 'EXECUTIVE' | 'CASHFLOW' | 'ASSETS' | 'FULL') => {
    if (presetName === 'EXECUTIVE') {
      setOrientation('PORTRAIT');
      setBlocks([
        { id: 'p1', type: 'KPI_METRICS', title: 'Quadro Sintetico & Risparmio', width: 'FULL', height: 'COMPACT', showInPrint: true },
        { id: 'p2', type: 'MACRO_MONTHLY', title: 'Entrate vs Spese & Modello 50/30/20', width: 'FULL', height: 'STANDARD', showInPrint: true },
        { id: 'p3', type: 'MONTHLY', title: 'Trend Storico Mensile', width: 'FULL', height: 'STANDARD', showInPrint: true },
        { id: 'p4', type: 'CUSTOM_NOTE', title: 'Valutazione di Sintesi', width: 'FULL', height: 'COMPACT', customNote: 'Il bilancio presenta un andamento coerente con i vincoli del budget familiare.', showInPrint: true }
      ]);
    } else if (presetName === 'CASHFLOW') {
      setOrientation('LANDSCAPE');
      setBlocks([
        { id: 'c1', type: 'KPI_METRICS', title: 'Metriche Liquidità', width: 'FULL', height: 'COMPACT', showInPrint: true },
        { id: 'c2', type: 'SANKEY', title: 'Flusso Dinamico Cassa (Sankey)', width: 'HALF', height: 'STANDARD', showInPrint: true },
        { id: 'c3', type: 'DAILY', title: 'Flussi Giornalieri Ultimi 30 Giorni', width: 'HALF', height: 'STANDARD', showInPrint: true },
        { id: 'c4', type: 'FORECAST', title: 'Proiezione Saldo fino al 9 Successivo', width: 'FULL', height: 'COMPACT', showInPrint: true }
      ]);
    } else if (presetName === 'ASSETS') {
      setOrientation('LANDSCAPE');
      setBlocks([
        { id: 'a1', type: 'KPI_METRICS', title: 'Sintesi Patrimonio', width: 'FULL', height: 'COMPACT', showInPrint: true },
        { id: 'a2', type: 'ACCOUNTS', title: 'Evoluzione Saldi per Singolo Conto', width: 'TWO_THIRDS', height: 'STANDARD', showInPrint: true },
        { id: 'a3', type: 'ACCOUNTS_TABLE', title: 'Saldi Attuali Conti & Fondi', width: 'THIRD', height: 'STANDARD', showInPrint: true },
        { id: 'a4', type: 'FORECAST', title: 'Proiezione di Liquidità', width: 'FULL', height: 'COMPACT', showInPrint: true }
      ]);
    } else if (presetName === 'FULL') {
      setOrientation('LANDSCAPE');
      setBlocks(DEFAULT_BLOCKS);
    }
    haptics.impact();
  };

  // Esecuzione Stampa
  const handleTriggerPrint = () => {
    haptics.impact();
    window.print();
  };

  // Render del singolo componente grafico in base al tipo e altezza
  const renderChartBlockContent = (block: ReportBlockConfig) => {
    const heightClass = 
      block.height === 'COMPACT' 
        ? 'min-h-[220px]' 
        : block.height === 'LARGE' 
          ? 'min-h-[460px]' 
          : 'min-h-[340px]';

    switch (block.type) {
      case 'KPI_METRICS':
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 dark:bg-[#242426] rounded-[22px]">
            <div className="p-3 bg-white dark:bg-[#1C1C1E] rounded-[16px] border border-slate-200/80 dark:border-white/5">
              <span className="text-[10px] font-bold text-slate-400 dark:text-[#8E8E93] uppercase block">Saldo Totale Oggi</span>
              <span className="font-numeric text-base sm:text-lg font-extrabold text-slate-900 dark:text-[#F5F5F7] tabular-nums">
                {formatCurrency(totaleOggiCalcolato)}
              </span>
            </div>
            <div className="p-3 bg-white dark:bg-[#1C1C1E] rounded-[16px] border border-slate-200/80 dark:border-white/5">
              <span className="text-[10px] font-bold text-slate-400 dark:text-[#8E8E93] uppercase block">Previsto Fine Mese</span>
              <span className="font-numeric text-base sm:text-lg font-extrabold text-[#E31B23] tabular-nums">
                {formatCurrency(totaleFineMese)}
              </span>
            </div>
            <div className="p-3 bg-white dark:bg-[#1C1C1E] rounded-[16px] border border-slate-200/80 dark:border-white/5">
              <span className="text-[10px] font-bold text-slate-400 dark:text-[#8E8E93] uppercase block">Media Entrate / Mese</span>
              <span className="font-numeric text-base sm:text-lg font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatCurrency(summaryMetrics.avgMonthlyIncome)}
              </span>
            </div>
            <div className="p-3 bg-white dark:bg-[#1C1C1E] rounded-[16px] border border-slate-200/80 dark:border-white/5">
              <span className="text-[10px] font-bold text-slate-400 dark:text-[#8E8E93] uppercase block">Tasso di Risparmio</span>
              <span className="font-numeric text-base sm:text-lg font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums">
                {summaryMetrics.savingRate > 0 ? `+${summaryMetrics.savingRate}%` : `${summaryMetrics.savingRate}%`}
              </span>
            </div>
          </div>
        );

      case 'MACRO_MONTHLY':
        return (
          <div className={`w-full overflow-hidden ${heightClass}`}>
            <MonthlyMacroBreakdownChart
              movements={movements}
              subcategories={subcategories}
              planned={planned}
              deadlines={deadlines}
            />
          </div>
        );

      case 'SANKEY':
        return (
          <div className={`w-full overflow-hidden ${heightClass}`}>
            <CashflowSankeyChart
              movements={movements}
              subcategories={subcategories}
            />
          </div>
        );

      case 'MONTHLY':
        return (
          <div className={`w-full overflow-hidden ${heightClass}`}>
            <MonthlySpendingTrendsChart
              movements={movements}
              subcategories={subcategories}
              planned={planned}
              deadlines={deadlines}
            />
          </div>
        );

      case 'DAILY':
        return (
          <div className={`w-full overflow-hidden ${heightClass}`}>
            <DailySpendingIncomeChart
              movements={movements}
              daily30Days={daily30Days}
              planned={planned}
              deadlines={deadlines}
            />
          </div>
        );

      case 'FORECAST':
        return (
          <div className={`w-full overflow-hidden ${heightClass}`}>
            {daily30Days.length > 0 ? (
              <AccountForecastChart
                data={daily30Days}
                totaleOggiCalcolato={totaleOggiCalcolato}
                totaleFineMese={totaleFineMese}
                totaleAlNove={totaleAlNove}
              />
            ) : (
              <div className="p-4 text-center text-xs text-slate-400">Dati di proiezione non disponibili</div>
            )}
          </div>
        );

      case 'ACCOUNTS':
        return (
          <div className={`w-full overflow-hidden ${heightClass}`}>
            <AccountsBalanceTimelineChart
              accounts={accounts}
              funds={funds}
              movements={movements}
              planned={planned}
              deadlines={deadlines}
            />
          </div>
        );

      case 'ACCOUNTS_TABLE':
        return (
          <div className="p-3 bg-slate-50 dark:bg-[#242426] rounded-[18px] overflow-hidden">
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto no-scrollbar">
              {[...accounts, ...funds].map(acc => (
                <div key={acc.conto_id || acc.id} className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: acc.colore || '#E31B23' }} />
                    <span className="font-semibold text-slate-800 dark:text-[#F5F5F7]">{acc.nome}</span>
                  </div>
                  <span className="font-numeric font-bold text-slate-900 dark:text-[#F5F5F7] tabular-nums">
                    {formatCurrency(acc.saldo_attuale || 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );

      case 'CUSTOM_NOTE':
        return (
          <div className="p-4 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 rounded-[18px] text-xs text-amber-950 dark:text-amber-200 leading-relaxed">
            <p className="font-medium">{block.customNote || 'Inserisci qui note esplicative, conclusioni o indicazioni per la gestione del budget.'}</p>
          </div>
        );

      default:
        return null;
    }
  };

  const availableBlockOptions: { type: ChartBlockType; label: string; desc: string; icon: any }[] = [
    { type: 'MACRO_MONTHLY', label: 'Entrate vs Spese & 50/30/20', desc: 'Confronto mensile e ripartizione bisogni/desideri', icon: BarChart3 },
    { type: 'SANKEY', label: 'Flusso Dinamico Sankey', desc: 'Mappa visiva dai conti alle voci di spesa', icon: GitFork },
    { type: 'MONTHLY', label: 'Trend Storico Mensile', desc: 'Evoluzione delle categorie di spesa nel tempo', icon: TrendingUp },
    { type: 'DAILY', label: 'Flussi Giornalieri 30gg', desc: 'Dettaglio entrate e uscite giorno per giorno', icon: Calendar },
    { type: 'FORECAST', label: 'Proiezione Liquidità al 9', desc: 'Stima del saldo futuro fino al 9 del mese succ.', icon: Sparkles },
    { type: 'ACCOUNTS', label: 'Saldi per Singolo Conto', desc: 'Timeline e proiezioni per ciascun conto/fondo', icon: Wallet },
    { type: 'KPI_METRICS', label: 'Indicatori KPI Sintetici', desc: 'Tasso di risparmio, medie e liquidità', icon: LayoutGrid },
    { type: 'ACCOUNTS_TABLE', label: 'Tabella Conti & Saldi', desc: 'Lista compatta dei saldi attuali', icon: Landmark },
    { type: 'CUSTOM_NOTE', label: 'Nota / Commento Esecutivo', desc: 'Box di testo libero per annotazioni', icon: FileText }
  ];

  return (
    <div id="report-composer-container" className="space-y-4">
      {/* 1. Control Toolbar (Non stampata in PDF) */}
      <div className="no-print bg-white dark:bg-[#1C1C1E] p-3.5 sm:p-4 rounded-[24px] border border-slate-200/80 dark:border-white/5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-slate-100 dark:bg-[#242426] text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7] transition cursor-pointer"
              title="Torna alla vista grafica standard"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F5F5F7] tracking-tight flex items-center gap-2">
              <span>Compositore Report A4</span>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#E31B23]/15 text-[#E31B23]">
                {orientation === 'LANDSCAPE' ? 'A4 Orizzontale' : 'A4 Verticale'}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#8E8E93]">
              Aggiungi, ridimensiona e ordina i grafici per creare il prospetto perfetto per stampa o PDF
            </p>
          </div>
        </div>

        {/* Toolbar Azioni Principali */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Selettore Orientamento Pagina */}
          <div className="flex bg-slate-100 dark:bg-[#242426] p-1 rounded-full text-xs font-semibold border border-slate-200/60 dark:border-white/5">
            <button
              type="button"
              onClick={() => {
                setOrientation('LANDSCAPE');
                haptics.tap();
              }}
              className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                orientation === 'LANDSCAPE'
                  ? 'bg-[#E31B23] text-white shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-[#8E8E93]'
              }`}
            >
              <RotateCw size={13} className="rotate-90" />
              <span>Orizzontale</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOrientation('PORTRAIT');
                haptics.tap();
              }}
              className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                orientation === 'PORTRAIT'
                  ? 'bg-[#E31B23] text-white shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-[#8E8E93]'
              }`}
            >
              <FileText size={13} />
              <span>Verticale</span>
            </button>
          </div>

          {/* Preset Rapidi */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-[#242426] p-1 rounded-full text-xs border border-slate-200/60 dark:border-white/5">
            <button
              type="button"
              onClick={() => handleApplyPreset('EXECUTIVE')}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7] hover:bg-white dark:hover:bg-[#1C1C1E] transition cursor-pointer"
            >
              Esecutivo
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('CASHFLOW')}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7] hover:bg-white dark:hover:bg-[#1C1C1E] transition cursor-pointer"
            >
              Flussi
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('ASSETS')}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7] hover:bg-white dark:hover:bg-[#1C1C1E] transition cursor-pointer"
            >
              Patrimonio
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('FULL')}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7] hover:bg-white dark:hover:bg-[#1C1C1E] transition cursor-pointer"
            >
              Tutti
            </button>
          </div>

          {/* Tasto Aggiungi Grafico */}
          <button
            type="button"
            onClick={() => setIsAddBlockOpen(true)}
            className="px-3.5 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-[#242426] dark:hover:bg-[#2A2A2E] text-slate-800 dark:text-[#F5F5F7] text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer border border-slate-200/80 dark:border-white/5"
          >
            <Plus size={15} strokeWidth={2.5} className="text-[#E31B23]" />
            <span>Aggiungi Grafico</span>
          </button>

          {/* Tasto Primario Stampa / Salva PDF */}
          <button
            type="button"
            onClick={handleTriggerPrint}
            className="px-4 py-2 rounded-full bg-[#E31B23] hover:bg-[#c9171e] text-white text-xs font-bold flex items-center gap-2 transition active:scale-95 shadow-md shadow-[#E31B23]/20 cursor-pointer"
          >
            <Printer size={15} strokeWidth={2.5} />
            <span>Stampa / Salva PDF</span>
          </button>
        </div>
      </div>

      {/* Dynamic printer page size stylesheet and print overrides */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 ${orientation === 'LANDSCAPE' ? 'landscape' : 'portrait'} !important;
            margin: 10mm 12mm !important;
          }
          body, html {
            background: #ffffff !important;
            color: #0f172a !important;
          }
          .a4-print-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
          }
          /* High-quality print adjustments for cards */
          .a4-print-container .rounded-\\[24px\\] {
            border-radius: 18px !important;
            border: 1px solid #e2e8f0 !important;
            padding: 14px !important;
            margin-bottom: 12px !important;
            background-color: #ffffff !important;
            box-shadow: none !important;
          }
          .a4-print-container .bg-slate-50 {
            background-color: #f8fafc !important;
            border-radius: 14px !important;
          }
          .a4-print-container .rounded-\\[16px\\] {
            border-radius: 12px !important;
            border: 1px solid #f1f5f9 !important;
          }
        }
      `}} />

      {/* 2. Foglio Report A4 Preview */}
      <div className="w-full flex justify-center overflow-x-auto py-2">
        <div 
          id="printable-a4-sheet"
          className={`a4-print-container bg-white text-slate-900 p-6 sm:p-8 rounded-[26px] border border-slate-200/90 shadow-2xl transition-all ${
            orientation === 'LANDSCAPE' 
              ? 'w-full max-w-[1120px] min-h-[792px]' 
              : 'w-full max-w-[792px] min-h-[1120px]'
          }`}
          style={{
            fontFamily: "'Google Sans', 'Google Sans Text', sans-serif"
          }}
        >
          {/* Header Intestazione del Report A4 */}
          <div className="pb-4 mb-4 border-b-2 border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[14px] bg-[#E31B23] text-white flex items-center justify-center font-bold text-base shadow-xs">
                FF
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#E31B23] focus:outline-none w-full"
                />
                <input
                  type="text"
                  value={reportSubtitle}
                  onChange={(e) => setReportSubtitle(e.target.value)}
                  className="text-xs font-medium text-slate-500 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#E31B23] focus:outline-none w-full mt-0.5"
                />
              </div>
            </div>

            <div className="text-right text-xs text-slate-500 font-numeric">
              <span className="block font-bold text-slate-800">Generato il {formatDate(new Date().toISOString().split('T')[0])}</span>
              <span className="block text-[11px] text-slate-400">Finanze Familiari - Sync Cloud</span>
            </div>
          </div>

          {/* Box Note Esecutive / Commento (Opzionale) */}
          {showNotesInPrint && reportNotes && (
            <div className="mb-4 p-3 bg-slate-50 rounded-[20px] border border-slate-200 text-xs text-slate-600 leading-snug">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-bold text-[11px] text-slate-800 uppercase tracking-wide">Note & Valutazioni Esecutive</span>
              </div>
              <textarea
                value={reportNotes}
                onChange={(e) => setReportNotes(e.target.value)}
                rows={2}
                className="w-full text-xs text-slate-700 bg-transparent border-none p-0 focus:ring-0 focus:outline-none resize-none leading-relaxed"
              />
            </div>
          )}

          {/* Griglia Flessibile dei Blocchi Grafici Aggiunti */}
          <div className="grid grid-cols-12 gap-4 items-start">
            {blocks.map((block, idx) => {
              const colSpanClass = 
                block.width === 'FULL' 
                   ? 'col-span-12' 
                  : block.width === 'HALF' 
                    ? 'col-span-12 md:col-span-6' 
                    : block.width === 'THIRD' 
                      ? 'col-span-12 md:col-span-4' 
                      : 'col-span-12 md:col-span-8';

              return (
                <div 
                  key={block.id} 
                  className={`${colSpanClass} print-page-break-avoid bg-white border border-slate-200 rounded-[24px] p-4 shadow-2xs relative group transition-all`}
                >
                  {/* Toolbar di Gestione Blocco (Visibile al passaggio mouse o su mobile, nascosta in stampa) */}
                  <div className="no-print mb-2 pb-2 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-xs truncate max-w-[200px]">
                        {block.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Larghezza (Col-Span) */}
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-full text-[10.5px]">
                        <button
                          type="button"
                          onClick={() => handleChangeWidth(block.id, 'HALF')}
                          className={`px-2 py-0.5 rounded-full cursor-pointer ${block.width === 'HALF' ? 'bg-[#E31B23] text-white font-bold' : 'text-slate-600'}`}
                          title="50% Larghezza"
                        >
                          1/2
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChangeWidth(block.id, 'FULL')}
                          className={`px-2 py-0.5 rounded-full cursor-pointer ${block.width === 'FULL' ? 'bg-[#E31B23] text-white font-bold' : 'text-slate-600'}`}
                          title="100% Riga Intera"
                        >
                          Full
                        </button>
                      </div>

                      {/* Altezza */}
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-full text-[10.5px]">
                        <button
                          type="button"
                          onClick={() => handleChangeHeight(block.id, 'COMPACT')}
                          className={`px-1.5 py-0.5 rounded-full cursor-pointer ${block.height === 'COMPACT' ? 'bg-slate-700 text-white font-bold' : 'text-slate-600'}`}
                          title="Altezza Compatta"
                        >
                          S
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChangeHeight(block.id, 'STANDARD')}
                          className={`px-1.5 py-0.5 rounded-full cursor-pointer ${block.height === 'STANDARD' ? 'bg-slate-700 text-white font-bold' : 'text-slate-600'}`}
                          title="Altezza Standard"
                        >
                          M
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChangeHeight(block.id, 'LARGE')}
                          className={`px-1.5 py-0.5 rounded-full cursor-pointer ${block.height === 'LARGE' ? 'bg-slate-700 text-white font-bold' : 'text-slate-600'}`}
                          title="Altezza Ampia"
                        >
                          L
                        </button>
                      </div>

                      {/* Sposta */}
                      <button
                        type="button"
                        onClick={() => handleMoveBlock(idx, 'UP')}
                        disabled={idx === 0}
                        className="p-1 rounded-full text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                        title="Sposta Su"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveBlock(idx, 'DOWN')}
                        disabled={idx === blocks.length - 1}
                        className="p-1 rounded-full text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                        title="Sposta Giù"
                      >
                        <ArrowDown size={13} />
                      </button>

                      {/* Elimina */}
                      <button
                        type="button"
                        onClick={() => handleRemoveBlock(block.id)}
                        className="p-1 rounded-full text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="Rimuovi dal Report"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Header stampato del blocco */}
                  <div className="mb-1.5">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                      {block.title}
                    </h3>
                  </div>

                  {/* Contenuto Grafico Renderizzato */}
                  {renderChartBlockContent(block)}
                </div>
              );
            })}
          </div>

          {/* Footer del Report A4 */}
          <div className="mt-6 pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
            <span>Finanze Familiari • Report generato ad uso esclusivo del nucleo familiare</span>
            <span>Pagina 1 / 1</span>
          </div>
        </div>
      </div>

      {/* 3. Modale per Aggiungere un Blocco Grafico */}
      <AnimatePresence>
        {isAddBlockOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddBlockOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-white/10 rounded-[28px] p-5 shadow-2xl z-10 space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-[#F5F5F7]">Aggiungi Grafico al Report</h3>
                  <p className="text-xs text-slate-500 dark:text-[#8E8E93]">Seleziona il modulo analitico da inserire nel foglio A4</p>
                </div>
                <button
                  onClick={() => setIsAddBlockOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#2A2A2E] text-slate-500 dark:text-[#8E8E93] hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto no-scrollbar py-1">
                {availableBlockOptions.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => handleAddBlock(opt.type)}
                      className="p-3 rounded-[18px] bg-slate-50 dark:bg-[#242426] hover:bg-[#E31B23]/10 dark:hover:bg-[#E31B23]/15 border border-slate-200/80 dark:border-white/5 hover:border-[#E31B23]/40 text-left transition-all active:scale-98 cursor-pointer flex items-start gap-2.5"
                    >
                      <div className="w-8 h-8 rounded-[10px] bg-white dark:bg-[#1C1C1E] text-[#E31B23] flex items-center justify-center shrink-0 shadow-2xs">
                        <Icon size={16} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-slate-900 dark:text-[#F5F5F7] truncate">{opt.label}</span>
                        <span className="text-[10.5px] text-slate-500 dark:text-[#8E8E93] line-clamp-2 mt-0.5">{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
