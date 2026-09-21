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
  Tag, 
  Settings, 
  FolderKanban, 
  StickyNote, 
  FileSpreadsheet, 
  Sparkles,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { CloudSyncStatus } from '../services/store';
import { ThemeToggle } from './ThemeToggle';

export type AppTabType = 'DASHBOARD' | 'TRANSAZIONI' | 'REPORT_AI' | 'CALENDARIO' | 'BUDGET' | 'PROGETTI' | 'NOTE' | 'IMPOSTAZIONI' | 'CONTI';

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
  onOpenReconciliation
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

  const isManagementActive = ['CONTI', 'PROGETTI', 'NOTE', 'IMPOSTAZIONI'].includes(activeTab);

  const navTabs: { id: AppTabType; label: string; shortcut: string; icon: React.ComponentType<{ size: number; className?: string }> }[] = [
    { id: 'DASHBOARD', label: 'Homepage', shortcut: 'H', icon: LayoutDashboard },
    { id: 'BUDGET', label: 'Budget', shortcut: 'B', icon: PieChart },
    { id: 'TRANSAZIONI', label: 'Movimenti', shortcut: 'M', icon: ListFilter },
    { id: 'CALENDARIO', label: 'Calendario', shortcut: 'C', icon: Calendar },
    { id: 'REPORT_AI', label: 'Report AI', shortcut: 'A', icon: Sparkles },
  ];

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-xs">
      {/* 2. HEADER GLOBALE (TOP BAR) - Struttura ultra-compatta h-10 md:h-12 */}
      <div className="w-full max-w-7xl mx-auto h-10 md:h-12 px-2.5 sm:px-6 flex items-center justify-between gap-2 sm:gap-4">
        {/* Sinistra: Nome App + Indicatore di stato discreto Firestore */}
        <div className="flex items-center gap-2 sm:gap-3">
          <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 dark:text-white tracking-tight whitespace-nowrap">
            Finanze Familiari
          </h1>
          <div className="h-3.5 w-px bg-slate-200 dark:bg-slate-700 hidden md:block" />
          <div className="hidden md:flex items-center">
            {renderStatusIndicator()}
          </div>
        </div>

        {/* Destra: Toolbar azioni (Dropdown Gestione, Notifiche, Toggle Tema, + Nuova Transazione) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Menu Dropdown Gestione & Strumenti Rapidi */}
          <div className="relative" ref={toolsMenuRef}>
            <button
              id="header-tools-dropdown-btn"
              onClick={() => setIsToolsOpen(!isToolsOpen)}
              className={`h-7.5 sm:h-8 px-2 sm:px-2.5 flex items-center gap-1 rounded-lg sm:rounded-xl border text-xs font-medium transition active:scale-95 shadow-xs cursor-pointer ${
                isManagementActive
                  ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750'
              }`}
              title="Strumenti e Gestione"
              aria-expanded={isToolsOpen}
            >
              <SlidersHorizontal size={14} />
              <span className="hidden md:inline">Gestione</span>
              {isManagementActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 -ml-0.5" />
              )}
              <ChevronDown size={12} className={`transition-transform duration-200 text-slate-400 ${isToolsOpen ? 'rotate-180' : ''}`} />
            </button>

            {isToolsOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-[20px] bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 border-b border-slate-100 dark:border-white/5 mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Sezioni & Azioni
                  </span>
                </div>

                {/* Nuova Transazione (Azione Rapida) */}
                {onOpenNewTransaction && (
                  <button
                    id="tool-menu-new-transaction"
                    onClick={() => {
                      setIsToolsOpen(false);
                      onOpenNewTransaction();
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-xs transition-colors font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#242426]"
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Plus size={15} strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="block text-slate-900 dark:text-slate-100 font-semibold">Nuova Transazione</span>
                        <span className="hidden md:inline text-[11px] font-mono font-normal text-slate-400 dark:text-slate-500 ml-1.5">(N)</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block -mt-0.5">Registra spesa o entrata</span>
                    </div>
                  </button>
                )}

                {/* Conti & Fondi */}
                <button
                  id="tool-menu-accounts"
                  onClick={() => {
                    setIsToolsOpen(false);
                    setActiveTab('CONTI');
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center gap-2.5 text-xs transition-colors font-medium ${
                    activeTab === 'CONTI'
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#242426]'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    activeTab === 'CONTI'
                      ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300'
                      : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                  }`}>
                    <Landmark size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="block text-slate-900 dark:text-slate-100 font-semibold">Conti & Fondi</span>
                      <span className="hidden md:inline text-[11px] font-mono font-normal text-slate-400 dark:text-slate-500 ml-1.5">(C)</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block -mt-0.5">Gestisci saldi e disponibilità</span>
                  </div>
                </button>

                {/* Progetti & Finanziamenti */}
                <button
                  id="tool-menu-projects"
                  onClick={() => {
                    setIsToolsOpen(false);
                    setActiveTab('PROGETTI');
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center gap-2.5 text-xs transition-colors font-medium ${
                    activeTab === 'PROGETTI'
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#242426]'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <FolderKanban size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="block text-slate-900 dark:text-slate-100 font-semibold">Progetti & Prestiti</span>
                      <span className="hidden md:inline text-[11px] font-mono font-normal text-slate-400 dark:text-slate-500 ml-1.5">(P)</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block -mt-0.5">Finanziamenti ed impegni di spesa</span>
                  </div>
                </button>

                {/* Idee & Note */}
                <button
                  id="tool-menu-notes"
                  onClick={() => {
                    setIsToolsOpen(false);
                    setActiveTab('NOTE');
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center gap-2.5 text-xs transition-colors font-medium ${
                    activeTab === 'NOTE'
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-semibold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#242426]'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <StickyNote size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="block text-slate-900 dark:text-slate-100 font-semibold">Idee & Note</span>
                      <span className="hidden md:inline text-[11px] font-mono font-normal text-slate-400 dark:text-slate-500 ml-1.5">(I)</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block -mt-0.5">Appunti e promemoria finanziari</span>
                  </div>
                </button>

                {/* Impostazioni */}
                <button
                  id="tool-menu-settings"
                  onClick={() => {
                    setIsToolsOpen(false);
                    setActiveTab('IMPOSTAZIONI');
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center gap-2.5 text-xs transition-colors font-medium ${
                    activeTab === 'IMPOSTAZIONI'
                      ? 'bg-slate-100 dark:bg-[#242426] text-slate-900 dark:text-white font-semibold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#242426]'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#2A2A2E] text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                    <Settings size={15} />
                  </div>
                  <div>
                    <span className="block text-slate-900 dark:text-slate-100 font-semibold">Impostazioni</span>
                    <span className="text-[10px] text-slate-400 block -mt-0.5">Configurazione generale app</span>
                  </div>
                </button>

                <div className="my-1 border-t border-slate-100 dark:border-white/5" />
                <div className="px-3 py-1">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Strumenti Finanziari
                  </span>
                </div>

                {onOpenReconciliation && (
                  <button
                    id="tool-menu-reconciliation"
                    onClick={() => {
                      setIsToolsOpen(false);
                      onOpenReconciliation();
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <FileSpreadsheet size={15} />
                    </div>
                    <div>
                      <span className="block text-slate-900 dark:text-slate-100 font-semibold">Estratto Conto</span>
                      <span className="text-[10px] text-slate-400 block -mt-0.5">Riconciliazione bancaria</span>
                    </div>
                  </button>
                )}

                {onOpenCategories && (
                  <button
                    id="tool-menu-categories"
                    onClick={() => {
                      setIsToolsOpen(false);
                      onOpenCategories();
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium"
                  >
                    <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                      <Tag size={15} />
                    </div>
                    <div>
                      <span className="block text-slate-900 dark:text-slate-100 font-semibold">Categorie & Icone</span>
                      <span className="text-[10px] text-slate-400 block -mt-0.5">Personalizza voci di spesa</span>
                    </div>
                  </button>
                )}

                <button
                  id="tool-menu-backup"
                  onClick={() => {
                    setIsToolsOpen(false);
                    onOpenBackup();
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium"
                >
                  <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Database size={15} />
                  </div>
                  <div>
                    <span className="block text-slate-900 dark:text-slate-100 font-semibold">Backup & Cloud</span>
                    <span className="text-[10px] text-slate-400 block -mt-0.5">Salva o ripristina dati JSON</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Notifiche Bell Icon con badge compatto */}
          <button
            id="header-control-center-btn"
            onClick={onOpenControlCenter}
            className="w-7.5 h-7.5 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 relative transition active:scale-95 shadow-xs cursor-pointer"
            title="Centro Controllo & Avvisi"
          >
            <Bell size={15} />
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 text-white font-bold text-[9px] rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 font-numeric">
                {alertCount}
              </span>
            )}
          </button>

          {/* Toggle Tema Chiaro / Scuro */}
          <ThemeToggle />
        </div>
      </div>

      {/* 3. BARRA DI NAVIGAZIONE PRINCIPALE (Desktop: visibile solo da tablet/desktop md:flex, completamente nascosta su smartphone) */}
      <nav 
        id="main-navigation-tabs"
        className="hidden md:flex items-center gap-1 md:gap-1.5 px-4 md:px-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800/80 overflow-x-auto no-scrollbar max-w-7xl mx-auto h-10"
      >
        {navTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id.toLowerCase()}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition whitespace-nowrap relative cursor-pointer ${
                isActive
                  ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold -mb-px'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-lg'
              }`}
              title={`${tab.label} (Scorciatoia: ${tab.shortcut})`}
            >
              <Icon size={15} className={isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'} />
              <span>{tab.label}</span>
              <span className={`hidden md:inline text-xs font-mono font-normal ml-0.5 ${
                isActive ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-400 dark:text-slate-500'
              }`}>
                ({tab.shortcut})
              </span>
            </button>
          );
        })}
      </nav>
    </header>
  );
};
