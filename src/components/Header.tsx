import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  Bell, 
  Landmark, 
  Database, 
  Calendar, 
  PieChart, 
  ListFilter, 
  LayoutDashboard, 
  LineChart,
  Tag, 
  Settings, 
  FolderKanban, 
  StickyNote, 
  FileSpreadsheet, 
  Sparkles,
  SlidersHorizontal,
  ChevronDown,
  Search,
  Camera,
  Calculator,
  Printer,
  Repeat,
  Bot
} from 'lucide-react';
import { CloudSyncStatus } from '../services/store';
import { ThemeToggle } from './ThemeToggle';

export type AppTabType = 'DASHBOARD' | 'ANALISI' | 'TRANSAZIONI' | 'RICORRENZE' | 'REPORT_AI' | 'CALENDARIO' | 'BUDGET' | 'PROGETTI' | 'NOTE' | 'IMPOSTAZIONI' | 'CONTI';

interface HeaderProps {
  activeTab: AppTabType;
  setActiveTab: (tab: AppTabType) => void;
  alertCount: number;
  syncStatus: CloudSyncStatus;
  onOpenNewTransaction: () => void;
  onOpenControlCenter: () => void;
  onOpenAccounts: () => void;
  onOpenBackup: () => void;
  onOpenCategories?: () => void;
  onOpenReconciliation?: () => void;
  onOpenBalanceCorrection?: () => void;
  onOpenSpotlight?: () => void;
  onOpenReceiptScanner?: () => void;
  onOpenPurchaseImpact?: () => void;
  onOpenExportSummary?: () => void;
  onOpenAIChat?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  alertCount,
  syncStatus,
  onOpenNewTransaction,
  onOpenControlCenter,
  onOpenAccounts,
  onOpenBackup,
  onOpenCategories,
  onOpenReconciliation,
  onOpenBalanceCorrection,
  onOpenSpotlight,
  onOpenReceiptScanner,
  onOpenPurchaseImpact,
  onOpenExportSummary,
  onOpenAIChat,
}) => {
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setIsToolsOpen(false);
      }
    };
    if (isToolsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isToolsOpen]);

  // Discrete Firestore status indicator
  const renderStatusIndicator = () => {
    switch (syncStatus) {
      case 'CONNECTED':
        return (
          <div className="flex items-center gap-1.5" title="Database Firestore sincronizzato e online">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">Online</span>
          </div>
        );
      case 'SYNCING':
        return (
          <div className="flex items-center gap-1.5" title="Salvataggio modifiche su cloud in corso...">
            <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-normal">Salvataggio...</span>
          </div>
        );
      case 'INITIALIZING':
        return (
          <div className="flex items-center gap-1.5" title="Connessione a Firestore in corso...">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
            <span className="text-xs text-amber-600 dark:text-amber-400 font-normal">Connessione...</span>
          </div>
        );
      case 'OFFLINE':
      default:
        return (
          <div className="flex items-center gap-1.5" title="Modalità offline con cache locale">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            <span className="text-xs text-slate-400 font-normal">Offline</span>
          </div>
        );
    }
  };

  const isToolsActive = ['PROGETTI', 'NOTE', 'REPORT_AI', 'RICORRENZE', 'IMPOSTAZIONI'].includes(activeTab);

  const navTabs: { id: AppTabType; label: string; shortcut: string; icon: React.ComponentType<{ size: number; className?: string }> }[] = [
    { id: 'DASHBOARD', label: 'Homepage', shortcut: 'H', icon: LayoutDashboard },
    { id: 'ANALISI', label: 'Analisi', shortcut: 'A', icon: LineChart },
    { id: 'BUDGET', label: 'Budget', shortcut: 'B', icon: PieChart },
    { id: 'TRANSAZIONI', label: 'Movimenti', shortcut: 'M', icon: ListFilter },
    { id: 'RICORRENZE', label: 'Ricorrenze', shortcut: 'R', icon: Repeat },
    { id: 'CONTI', label: 'Patrimonio & Conti', shortcut: 'C', icon: Landmark },
    { id: 'CALENDARIO', label: 'Calendario', shortcut: 'L', icon: Calendar },
  ];

  return (
    <header className="bg-white dark:bg-[#121212] border-b border-slate-200/80 dark:border-white/5 sticky top-0 z-30 shadow-xs backdrop-blur-md">
      {/* 2. HEADER GLOBALE (TOP BAR) */}
      <div className="w-full max-w-7xl mx-auto h-11 md:h-13 px-4 md:px-8 flex items-center justify-between gap-2 sm:gap-4">
        {/* Sinistra: Nome App + Indicatore di stato discreto Firestore */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 rounded-[11px] bg-[#E31B23]/15 text-[#E31B23] border border-[#E31B23]/25 flex items-center justify-center font-bold text-sm">
            FF
          </div>
          <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 dark:text-[#F5F5F7] tracking-tight whitespace-nowrap">
            Finanze Familiari
          </h1>
          <div className="h-3.5 w-px bg-slate-200 dark:bg-white/10 hidden md:block" />
          <div className="hidden md:flex items-center">
            {renderStatusIndicator()}
          </div>
        </div>

        {/* Destra: Toolbar azioni (+ Nuova Transazione, Dropdown Gestione, Notifiche, Toggle Tema) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Spotlight Search Global Button (Ctrl+K) */}
          {onOpenSpotlight && (
            <button
              id="header-spotlight-btn"
              onClick={onOpenSpotlight}
              className="h-8 sm:h-9 px-2.5 sm:px-3 flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#1C1C1E] text-slate-700 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7] transition active:scale-95 shadow-xs cursor-pointer"
              title="Cerca ovunque (Scorciatoia: Ctrl+K)"
            >
              <Search size={14} strokeWidth={2.2} />
              <span className="hidden lg:inline text-xs font-medium">Cerca</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.2 text-[9.5px] font-mono font-bold text-slate-400 dark:text-[#8E8E93] bg-white dark:bg-[#242426] rounded border border-slate-200/80 dark:border-white/10">
                ⌘K
              </kbd>
            </button>
          )}

          {/* Pulsante Assistente AI Finanziario Gemini */}
          {onOpenAIChat && (
            <button
              id="header-gemini-ai-btn"
              onClick={onOpenAIChat}
              className="h-8 sm:h-9 px-2.5 sm:px-3.5 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:opacity-95 text-white font-bold text-xs sm:text-sm shadow-md shadow-red-600/25 transition active:scale-95 cursor-pointer shrink-0"
              title="Chiedi a Gemini (Assistente Finanziario per spese, entrate e grafici)"
            >
              <div className="relative flex items-center justify-center">
                <Sparkles size={15} className="animate-pulse" />
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-yellow-300 ring-1 ring-white" />
              </div>
              <span className="font-extrabold tracking-wide whitespace-nowrap">Chiedi a Gemini</span>
            </button>
          )}

          {/* Pulsante Nuova Transazione Primario */}
          <button
            id="btn-header-new-transaction"
            onClick={onOpenNewTransaction}
            className="h-8 sm:h-9 px-3 sm:px-4 flex items-center gap-1.5 rounded-full bg-[#E31B23] hover:bg-[#c9171e] text-white font-bold text-xs sm:text-sm shadow-md shadow-red-600/20 transition active:scale-95 cursor-pointer shrink-0"
            title="Nuova Transazione (Scorciatoia: N)"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span className="font-bold whitespace-nowrap">Nuova Operazione</span>
          </button>

          {/* Menu Dropdown Gestione & Strumenti Rapidi */}
          <div className="relative" ref={toolsMenuRef}>
            <button
              id="header-tools-dropdown-btn"
              onClick={() => setIsToolsOpen(!isToolsOpen)}
              className={`h-8 sm:h-9 px-2.5 sm:px-3 flex items-center gap-1.5 rounded-full border text-xs font-semibold transition active:scale-95 shadow-xs cursor-pointer ${
                isToolsActive
                  ? 'border-[#E31B23] bg-[#E31B23]/10 text-[#E31B23]'
                  : 'border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#1C1C1E] text-slate-700 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7]'
              }`}
              title="Strumenti, Analisi e Impostazioni"
              aria-expanded={isToolsOpen}
            >
              <SlidersHorizontal size={14} />
              <span className="hidden md:inline">Strumenti</span>
              {isToolsActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#E31B23] -ml-0.5" />
              )}
              <ChevronDown size={12} className={`transition-transform duration-200 ${isToolsOpen ? 'rotate-180' : ''}`} />
            </button>

            {isToolsOpen && (
              <div className="absolute right-0 mt-2 w-76 rounded-[24px] bg-white dark:bg-[#1C1C1E] border border-slate-200/90 dark:border-white/10 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-2">
                {/* Gruppo 1: Pianificazione & AI */}
                <div>
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-[#8E8E93] uppercase tracking-wider">
                    Pianificazione & AI
                  </div>
                  <div className="space-y-0.5 mt-1">
                    <button
                      onClick={() => {
                        setIsToolsOpen(false);
                        setActiveTab('RICORRENZE');
                      }}
                      className={`w-full px-3 py-2 rounded-[14px] text-left flex items-center gap-2.5 text-xs transition-colors ${
                        activeTab === 'RICORRENZE'
                          ? 'bg-[#E31B23]/15 text-[#E31B23] font-bold'
                          : 'text-slate-700 dark:text-[#F5F5F7] hover:bg-slate-100 dark:hover:bg-[#242426]'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-[10px] bg-red-500/15 text-[#E31B23] flex items-center justify-center shrink-0">
                        <Repeat size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="block font-semibold truncate">Gestione Ricorrenze & Rate</span>
                        <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block truncate">Spese periodiche e rate per sottocategoria</span>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setIsToolsOpen(false);
                        setActiveTab('REPORT_AI');
                      }}
                      className={`w-full px-3 py-2 rounded-[14px] text-left flex items-center gap-2.5 text-xs transition-colors ${
                        activeTab === 'REPORT_AI'
                          ? 'bg-[#E31B23]/15 text-[#E31B23] font-bold'
                          : 'text-slate-700 dark:text-[#F5F5F7] hover:bg-slate-100 dark:hover:bg-[#242426]'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-[10px] bg-purple-500/15 text-purple-500 dark:text-purple-400 flex items-center justify-center shrink-0">
                        <Sparkles size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="block font-semibold truncate">Report AI Gemini</span>
                        <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block truncate">Analisi settimanale e consigli</span>
                      </div>
                    </button>

                    {onOpenAIChat && (
                      <button
                        onClick={() => {
                          setIsToolsOpen(false);
                          onOpenAIChat();
                        }}
                        className="w-full px-3 py-2 rounded-[14px] text-left flex items-center gap-2.5 text-xs text-slate-700 dark:text-[#F5F5F7] hover:bg-slate-100 dark:hover:bg-[#242426] transition-colors"
                      >
                        <div className="w-7 h-7 rounded-[10px] bg-red-500/15 text-[#E31B23] flex items-center justify-center shrink-0">
                          <Bot size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="block font-semibold truncate text-[#E31B23]">Chiedi a Gemini (Chatbot)</span>
                          <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block truncate">Domande su spese, entrate e grafici</span>
                        </div>
                      </button>
                    )}

                    {onOpenReceiptScanner && (
                      <button
                        onClick={() => {
                          setIsToolsOpen(false);
                          onOpenReceiptScanner();
                        }}
                        className="w-full px-3 py-2 rounded-[14px] text-left flex items-center gap-2.5 text-xs text-slate-700 dark:text-[#F5F5F7] hover:bg-slate-100 dark:hover:bg-[#242426] transition-colors"
                      >
                        <div className="w-7 h-7 rounded-[10px] bg-rose-500/15 text-rose-500 dark:text-rose-400 flex items-center justify-center shrink-0">
                          <Camera size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="block font-semibold truncate">Scanner Scontrini AI</span>
                          <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block truncate">OCR Gemini Vision istantaneo</span>
                        </div>
                      </button>
                    )}

                    {onOpenPurchaseImpact && (
                      <button
                        onClick={() => {
                          setIsToolsOpen(false);
                          onOpenPurchaseImpact();
                        }}
                        className="w-full px-3 py-2 rounded-[14px] text-left flex items-center gap-2.5 text-xs text-slate-700 dark:text-[#F5F5F7] hover:bg-slate-100 dark:hover:bg-[#242426] transition-colors"
                      >
                        <div className="w-7 h-7 rounded-[10px] bg-indigo-500/15 text-indigo-500 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <Calculator size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="block font-semibold truncate">Simulatore "What-If" Acquisti</span>
                          <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block truncate">Impatto su liquidità e riserve</span>
                        </div>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setIsToolsOpen(false);
                        setActiveTab('PROGETTI');
                      }}
                      className={`w-full px-3 py-2 rounded-[14px] text-left flex items-center gap-2.5 text-xs transition-colors ${
                        activeTab === 'PROGETTI'
                          ? 'bg-[#E31B23]/15 text-[#E31B23] font-bold'
                          : 'text-slate-700 dark:text-[#F5F5F7] hover:bg-slate-100 dark:hover:bg-[#242426]'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-[10px] bg-blue-500/15 text-blue-500 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <FolderKanban size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="block font-semibold truncate">Progetti & Prestiti</span>
                        <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block truncate">Finanziamenti e impegni pluriennali</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Gruppo 2: Gestione & Utilità */}
                <div className="pt-1.5 border-t border-slate-100 dark:border-white/5">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-[#8E8E93] uppercase tracking-wider">
                    Gestione & Utilità
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {onOpenExportSummary && (
                      <button
                        onClick={() => {
                          setIsToolsOpen(false);
                          onOpenExportSummary();
                        }}
                        className="w-full px-3 py-2 rounded-[14px] text-left flex items-center gap-2.5 text-xs text-slate-700 dark:text-[#F5F5F7] hover:bg-slate-100 dark:hover:bg-[#242426] transition-colors"
                      >
                        <div className="w-7 h-7 rounded-[10px] bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <Printer size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="block font-semibold truncate">Esporta Report Mensile</span>
                          <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block truncate">Prospetto PDF e riassunto stampabile</span>
                        </div>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setIsToolsOpen(false);
                        setActiveTab('NOTE');
                      }}
                      className={`w-full px-3 py-2 rounded-[14px] text-left flex items-center gap-2.5 text-xs transition-colors ${
                        activeTab === 'NOTE'
                          ? 'bg-[#E31B23]/15 text-[#E31B23] font-bold'
                          : 'text-slate-700 dark:text-[#F5F5F7] hover:bg-slate-100 dark:hover:bg-[#242426]'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-[10px] bg-amber-500/15 text-amber-500 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <StickyNote size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="block font-semibold truncate">Idee & Note Spesa</span>
                        <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block truncate">Promemoria e appunti</span>
                      </div>
                    </button>

                    {onOpenBalanceCorrection && (
                      <button
                        onClick={() => {
                          setIsToolsOpen(false);
                          onOpenBalanceCorrection();
                        }}
                        className="w-full px-3 py-2 rounded-[14px] text-left flex items-center gap-2.5 text-xs text-slate-700 dark:text-[#F5F5F7] hover:bg-slate-100 dark:hover:bg-[#242426] transition-colors"
                      >
                        <div className="w-7 h-7 rounded-[10px] bg-red-500/15 text-[#E31B23] flex items-center justify-center shrink-0">
                          <Sparkles size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="block font-semibold truncate">Correzione Saldo Conti</span>
                          <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block truncate">Allinea saldi ed effettua rettifiche</span>
                        </div>
                      </button>
                    )}

                    {onOpenReconciliation && (
                      <button
                        onClick={() => {
                          setIsToolsOpen(false);
                          onOpenReconciliation();
                        }}
                        className="w-full px-3 py-2 rounded-[14px] text-left flex items-center gap-2.5 text-xs text-slate-700 dark:text-[#F5F5F7] hover:bg-slate-100 dark:hover:bg-[#242426] transition-colors"
                      >
                        <div className="w-7 h-7 rounded-[10px] bg-teal-500/15 text-teal-500 dark:text-teal-400 flex items-center justify-center shrink-0">
                          <FileSpreadsheet size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="block font-semibold truncate">Riconciliazione Estratto Conto</span>
                          <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block truncate">Verifica saldi bancari</span>
                        </div>
                      </button>
                    )}

                    {onOpenCategories && (
                      <button
                        onClick={() => {
                          setIsToolsOpen(false);
                          onOpenCategories();
                        }}
                        className="w-full px-3 py-2 rounded-[14px] text-left flex items-center gap-2.5 text-xs text-slate-700 dark:text-[#F5F5F7] hover:bg-slate-100 dark:hover:bg-[#242426] transition-colors"
                      >
                        <div className="w-7 h-7 rounded-[10px] bg-indigo-500/15 text-indigo-500 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <Tag size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="block font-semibold truncate">Categorie & Classificazioni</span>
                          <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block truncate">Voci di spesa e regole 50/30/20</span>
                        </div>
                      </button>
                    )}
                  </div>
                </div>

                {/* Gruppo 3: Sistema */}
                <div className="pt-1.5 border-t border-slate-100 dark:border-white/5">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-[#8E8E93] uppercase tracking-wider">
                    Sistema
                  </div>
                  <div className="space-y-0.5 mt-1">
                    <button
                      onClick={() => {
                        setIsToolsOpen(false);
                        setActiveTab('IMPOSTAZIONI');
                      }}
                      className={`w-full px-3 py-2 rounded-[14px] text-left flex items-center gap-2.5 text-xs transition-colors ${
                        activeTab === 'IMPOSTAZIONI'
                          ? 'bg-[#E31B23]/15 text-[#E31B23] font-bold'
                          : 'text-slate-700 dark:text-[#F5F5F7] hover:bg-slate-100 dark:hover:bg-[#242426]'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-[10px] bg-slate-200 dark:bg-[#2A2A2E] text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                        <Settings size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="block font-semibold truncate">Impostazioni & Mese Finanziario</span>
                        <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block truncate">Preferenze e giorno stipendio</span>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setIsToolsOpen(false);
                        onOpenBackup();
                      }}
                      className="w-full px-3 py-2 rounded-[14px] text-left flex items-center gap-2.5 text-xs text-slate-700 dark:text-[#F5F5F7] hover:bg-slate-100 dark:hover:bg-[#242426] transition-colors"
                    >
                      <div className="w-7 h-7 rounded-[10px] bg-slate-200 dark:bg-[#2A2A2E] text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                        <Database size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="block font-semibold truncate">Backup & Cloud</span>
                        <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block truncate">Esporta / Importa dati JSON</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Notifiche Bell Icon con badge compatto */}
          <button
            id="header-control-center-btn"
            onClick={onOpenControlCenter}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#1C1C1E] text-slate-700 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7] relative transition active:scale-95 shadow-xs cursor-pointer"
            title="Centro Controllo & Avvisi"
          >
            <Bell size={15} />
            {alertCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#E31B23] text-white font-bold text-[9.5px] rounded-full flex items-center justify-center ring-2 ring-white dark:ring-[#121212] font-numeric">
                {alertCount}
              </span>
            )}
          </button>

          {/* Toggle Tema Chiaro / Scuro */}
          <ThemeToggle />
        </div>
      </div>

      {/* 3. BARRA DI NAVIGAZIONE PRINCIPALE DESKTOP (One UI Pill Style) */}
      <nav 
        id="main-navigation-tabs"
        className="hidden md:flex w-full items-center gap-1.5 px-4 md:px-8 bg-white dark:bg-[#121212] border-t border-slate-100 dark:border-white/5 overflow-x-auto no-scrollbar max-w-7xl mx-auto py-1.5"
      >
        {navTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id.toLowerCase()}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium transition whitespace-nowrap cursor-pointer active:scale-95 ${
                isActive
                  ? 'bg-[#E31B23] text-white font-bold shadow-2xs'
                  : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7] hover:bg-slate-100 dark:hover:bg-[#1C1C1E]'
              }`}
              title={`${tab.label} (Scorciatoia: ${tab.shortcut})`}
            >
              <Icon size={15} className={isActive ? 'text-white' : 'text-slate-400 dark:text-[#8E8E93]'} />
              <span>{tab.label}</span>
              <span className={`hidden lg:inline text-[11px] font-mono font-normal opacity-70`}>
                ({tab.shortcut})
              </span>
            </button>
          );
        })}

        {onOpenAIChat && (
          <button
            onClick={onOpenAIChat}
            className="ml-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:opacity-95 shadow-xs cursor-pointer transition active:scale-95 shrink-0"
            title="Assistente AI Finanziario Gemini"
          >
            <Sparkles size={14} className="text-yellow-300 animate-pulse" />
            <span>Assistente Gemini</span>
          </button>
        )}
      </nav>
    </header>
  );
};
