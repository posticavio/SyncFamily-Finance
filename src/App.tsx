import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Movement, Subcategory, Account, Fund, Planned, Deadline, AccountForecast, ControlAlert, DailyForecastPoint, WeeklyFinancialReport } from './types';
import { subscribeToDB, initFirestore, subscribeToSyncStatus, CloudSyncStatus } from './services/store';
import { MovementService } from './services/MovementService';
import { AccountService } from './services/AccountService';
import { CategoryService } from './services/CategoryService';
import { PlannedService } from './services/PlannedService';
import { DeadlineService } from './services/DeadlineService';
import { ControlService } from './services/ControlService';
import { WeeklyReportService } from './services/WeeklyReportService';

import { Header } from './components/Header';
import { BentoDashboard } from './components/BentoDashboard';
import { TransactionListView } from './components/TransactionListView';
import { CalendarView } from './components/CalendarView';
import { BudgetView } from './components/BudgetView';
import { NewTransactionModal } from './components/NewTransactionModal';
import { AccountsModal } from './components/AccountsModal';
import { AccountDetailModal } from './components/AccountDetailModal';
import { ControlCenterModal } from './components/ControlCenterModal';
import { BackupModal } from './components/BackupModal';
import { DesktopContextMenu } from './components/DesktopContextMenu';
import { MobileBottomNav } from './components/MobileBottomNav';
import { AccountsFundsSection } from './components/AccountsFundsSection';
import { DashboardSkeleton } from './components/DashboardSkeleton';
import { CategoryManagerModal } from './components/CategoryManagerModal';
import { SettingsView } from './components/SettingsView';
import { ProjectsView } from './components/ProjectsView';
import { NotepadView } from './components/NotepadView';
import { StatementReconciliationModal } from './components/StatementReconciliationModal';
import { WeeklyReportView } from './components/WeeklyReportView';
import { AnalyticsView } from './components/AnalyticsView';
import { SpotlightSearchModal } from './components/SpotlightSearchModal';
import { ReceiptScannerModal } from './components/ReceiptScannerModal';
import { PurchaseImpactModal } from './components/PurchaseImpactModal';
import { MonthlySummaryExportModal } from './components/MonthlySummaryExportModal';
import { AccountBalanceCorrectionModal } from './components/AccountBalanceCorrectionModal';
import { RecurrencesView } from './components/RecurrencesView';
import { AIChatModal } from './components/AIChatModal';
import { motion, AnimatePresence } from 'motion/react';

import { Plus, FolderKanban, Sparkles } from 'lucide-react';
import { formatCurrency } from './utils/formatters';
import { haptics } from './utils/haptics';
import { 
  getCurrentFinancialMonth, 
  isDateInFinancialMonth, 
  getFinancialPeriodInfo 
} from './utils/financialDate';

export default function App() {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'ANALISI' | 'TRANSAZIONI' | 'RICORRENZE' | 'REPORT_AI' | 'CALENDARIO' | 'BUDGET' | 'PROGETTI' | 'NOTE' | 'IMPOSTAZIONI' | 'CONTI'>('DASHBOARD');
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Data States
  const [movements, setMovements] = useState<Movement[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [rawAccounts, setRawAccounts] = useState<Account[]>([]);
  const [rawFunds, setRawFunds] = useState<Fund[]>([]);
  const [planned, setPlanned] = useState<Planned[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [alerts, setAlerts] = useState<ControlAlert[]>([]);

  // Cloud Sync Status
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('INITIALIZING');

  // Forecast Aggregates
  const [forecasts, setForecasts] = useState<{
    accounts: AccountForecast[];
    funds: AccountForecast[];
    totale_oggi_calcolato: number;
    totale_oggi_reale: number;
    differenza_totale: number;
    totale_fine_mese: number;
    totale_al_nove: number;
    daily30Days: DailyForecastPoint[];
  }>({
    accounts: [],
    funds: [],
    totale_oggi_calcolato: 0,
    totale_oggi_reale: 0,
    differenza_totale: 0,
    totale_fine_mese: 0,
    totale_al_nove: 0,
    daily30Days: []
  });

  // Weekly Automated Financial Report (Gemini API)
  const [weeklyReport, setWeeklyReport] = useState<WeeklyFinancialReport | null>(() => WeeklyReportService.getLatestReport());
  const [allWeeklyReports, setAllWeeklyReports] = useState<WeeklyFinancialReport[]>(() => WeeklyReportService.getAllReports());
  const [isWeeklyReportLoading, setIsWeeklyReportLoading] = useState(false);

  const handleRefreshWeeklyReport = useCallback(async (force: boolean = false) => {
    setIsWeeklyReportLoading(true);
    try {
      const generated = await WeeklyReportService.generateWeeklyReport(force);
      setWeeklyReport(generated);
      setAllWeeklyReports(WeeklyReportService.getAllReports());
    } catch (e) {
      console.error("Errore generazione report settimanale:", e);
    } finally {
      setIsWeeklyReportLoading(false);
    }
  }, []);

  // Modal States
  const [isNewTxOpen, setIsNewTxOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null);
  const [isAccountsOpen, setIsAccountsOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [isControlOpen, setIsControlOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isReconciliationOpen, setIsReconciliationOpen] = useState(false);
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [isReceiptScannerOpen, setIsReceiptScannerOpen] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [isPurchaseImpactOpen, setIsPurchaseImpactOpen] = useState(false);
  const [isExportSummaryOpen, setIsExportSummaryOpen] = useState(false);
  const [isBalanceCorrectionOpen, setIsBalanceCorrectionOpen] = useState(false);
  const [balanceCorrectionAccountId, setBalanceCorrectionAccountId] = useState<string | undefined>(undefined);
  const [reconciliationAccountId, setReconciliationAccountId] = useState<string | undefined>(undefined);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | undefined>(undefined);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [selectedBudgetFilter, setSelectedBudgetFilter] = useState<{
    subcategoryId?: string;
    month?: string;
  } | null>(null);
  const [selectedAccountForDetail, setSelectedAccountForDetail] = useState<AccountForecast | null>(null);

  const activeDetailAccount = useMemo(() => {
    if (!selectedAccountForDetail) return null;
    const all = [...forecasts.accounts, ...forecasts.funds];
    return all.find(a => 
      (a.conto_id && a.conto_id === selectedAccountForDetail.conto_id) || 
      (a.id && a.id === selectedAccountForDetail.id)
    ) || selectedAccountForDetail;
  }, [selectedAccountForDetail, forecasts]);

  const handleOpenNewTransactionForAccount = (accountId: string) => {
    setEditingMovement({
      id: '',
      movimento_id: '',
      data: new Date().toISOString().split('T')[0],
      descrizione: '',
      importo: 0,
      tipologia: 'USCITA',
      conto_origine: accountId,
      sottocategoria_id: subcategories[0]?.id || '',
      stato: 'CONFERMATO',
      origine_dati: 'MANUALE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    setIsNewTxOpen(true);
  };

  const handleOpenReconciliation = (accountId?: string) => {
    setReconciliationAccountId(accountId);
    setIsReconciliationOpen(true);
  };

  const handleOpenBalanceCorrection = (accountId?: string) => {
    setBalanceCorrectionAccountId(accountId);
    setIsBalanceCorrectionOpen(true);
  };

  const handleNavigateToCalendar = (dateStr?: string) => {
    if (dateStr) {
      setSelectedCalendarDate(dateStr);
    }
    setActiveTab('CALENDARIO');
  };

  // Desktop Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    movement: Movement;
  } | null>(null);

  // Load all data
  const refreshAll = useCallback(async () => {
    try {
      const [movs, subs, accs, fundsData, planneds, deads, alertList, fc] = await Promise.all([
        MovementService.getAll(),
        CategoryService.getAllSubcategories(),
        AccountService.getAllAccounts(),
        AccountService.getAllFunds(),
        PlannedService.getAll(),
        DeadlineService.getAll(),
        ControlService.getAlerts(),
        AccountService.getAllForecasts()
      ]);

      setMovements(movs);
      setSubcategories(subs);
      setRawAccounts(accs);
      setRawFunds(fundsData);
      setPlanned(planneds);
      setDeadlines(deads);
      setAlerts(alertList);
      setForecasts(fc);
    } catch (e) {
      console.error("Errore nel caricamento dati:", e);
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  // Initial load and subscription
  useEffect(() => {
    initFirestore();
    refreshAll();

    // Riconoscimento robusto scorciatoie Home Screen Android / Deep Link (?action=quick-add, /nuova-spesa, #quick-add, etc.)
    const checkDeepLinkAction = () => {
      try {
        const url = new URL(window.location.href);
        const search = url.searchParams;
        const rawAction = search.get('action') || (search.has('quick-add') ? 'quick-add' : '') || (search.has('nuova-spesa') ? 'quick-add' : '') || (search.has('scanner') ? 'scan-receipt' : '');
        const hash = (window.location.hash || '').replace('#', '').toLowerCase();
        const pathname = (window.location.pathname || '').toLowerCase();

        const isQuickAdd = 
          rawAction === 'quick-add' || 
          rawAction === 'new' || 
          rawAction === 'new-tx' || 
          rawAction === 'spesa' ||
          hash === 'quick-add' || 
          hash === 'nuova-spesa' || 
          hash === 'new' || 
          pathname === '/nuova-spesa' || 
          pathname === '/quick-add' ||
          pathname === '/spesa';

        const isScanner = 
          rawAction === 'scan-receipt' || 
          rawAction === 'scan' || 
          rawAction === 'scanner' || 
          hash === 'scan-receipt' || 
          hash === 'scanner' || 
          pathname === '/scanner' ||
          pathname === '/scontrino';

        const isWhatIf = 
          rawAction === 'what-if' || 
          rawAction === 'simulator' || 
          hash === 'what-if' || 
          pathname === '/what-if';

        if (isQuickAdd) {
          setEditingMovement(null);
          setIsNewTxOpen(true);
        } else if (isScanner) {
          setIsReceiptScannerOpen(true);
        } else if (isWhatIf) {
          setIsPurchaseImpactOpen(true);
        }
      } catch (e) {
        console.warn('Errore parsing deep link:', e);
      }
    };

    // Esegui subito e registra listener per quando l'app torna in primo piano da Android Shortcut
    checkDeepLinkAction();
    window.addEventListener('popstate', checkDeepLinkAction);
    window.addEventListener('hashchange', checkDeepLinkAction);
    window.addEventListener('focus', checkDeepLinkAction);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkDeepLinkAction();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Inizializza o genera automaticamente il report con cadenza settimanale
    const currentList = WeeklyReportService.getAllReports();
    setAllWeeklyReports(currentList);
    const latest = WeeklyReportService.getLatestReport();
    setWeeklyReport(latest);

    if (WeeklyReportService.shouldAutoGenerateWeeklyReport()) {
      handleRefreshWeeklyReport(false);
    }

    const unsubDB = subscribeToDB(() => {
      refreshAll();
      setAllWeeklyReports(WeeklyReportService.getAllReports());
      setWeeklyReport(WeeklyReportService.getLatestReport());
    });
    const unsubStatus = subscribeToSyncStatus((status) => {
      setSyncStatus(status);
    });
    return () => {
      window.removeEventListener('popstate', checkDeepLinkAction);
      window.removeEventListener('hashchange', checkDeepLinkAction);
      window.removeEventListener('focus', checkDeepLinkAction);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubDB();
      unsubStatus();
    };
  }, [refreshAll, handleRefreshWeeklyReport]);

  // Scorciatoie da tastiera Desktop per navigazione rapida tra le sezioni e nuova transazione
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Spotlight Global Shortcut: Ctrl+K / Cmd+K (funziona da qualsiasi schermata/input)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSpotlightOpen(prev => !prev);
        return;
      }

      // Non intercettare se l'utente sta digitando in un campo input, textarea, select o elemento editabile
      const target = e.target as HTMLElement | null;
      if (
        target && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          target.getAttribute('role') === 'textbox' ||
          target.getAttribute('role') === 'combobox'
        )
      ) {
        return;
      }

      // Non intercettare altre combinazioni con tasti modificatori (Cmd, Ctrl, Alt)
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      // Disabilita quando la scheda Nuova Transazione o una qualsiasi modale è aperta
      const isAnyModalActive = 
        isNewTxOpen || 
        editingMovement !== null || 
        isAccountsOpen || 
        isCategoriesOpen || 
        isControlOpen || 
        isBackupOpen || 
        isReconciliationOpen || 
        isSpotlightOpen ||
        isReceiptScannerOpen ||
        isPurchaseImpactOpen ||
        isExportSummaryOpen ||
        selectedAccountForDetail !== null;

      if (isAnyModalActive) {
        return;
      }

      const key = e.key.toLowerCase();

      switch (key) {
        case 'h':
          e.preventDefault();
          setActiveTab('DASHBOARD');
          break;
        case 'b':
          e.preventDefault();
          setActiveTab('BUDGET');
          break;
        case 'm':
          e.preventDefault();
          setActiveTab('TRANSAZIONI');
          break;
        case 'c':
          e.preventDefault();
          // Tasto 'c': apre Calendario, oppure alterna tra Calendario e Conti
          if (activeTab === 'CALENDARIO') {
            setActiveTab('CONTI');
          } else {
            setActiveTab('CALENDARIO');
          }
          break;
        case 'k':
          // Scorciatoia diretta alternativa per Conti
          e.preventDefault();
          setActiveTab('CONTI');
          break;
        case 'a':
          e.preventDefault();
          setActiveTab('ANALISI');
          break;
        case 'r':
          e.preventDefault();
          if (activeTab === 'RICORRENZE') {
            setActiveTab('REPORT_AI');
          } else {
            setActiveTab('RICORRENZE');
          }
          break;
        case 'p':
          e.preventDefault();
          setActiveTab('PROGETTI');
          break;
        case 'i':
          e.preventDefault();
          setActiveTab('NOTE');
          break;
        case 'n':
          e.preventDefault();
          setEditingMovement(null);
          setIsNewTxOpen(true);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    isNewTxOpen,
    editingMovement,
    isAccountsOpen,
    isCategoriesOpen,
    isControlOpen,
    isBackupOpen,
    isReconciliationOpen,
    selectedAccountForDetail,
    activeTab
  ]);

  // Current Financial Month Totals Calculation
  const currentFinancialMonth = getCurrentFinancialMonth();
  const currentFinancialPeriod = getFinancialPeriodInfo(currentFinancialMonth);

  const currentMonthMovements = movements.filter(m => isDateInFinancialMonth(m.data, currentFinancialMonth));
  const entrateMese = Math.round(
    currentMonthMovements.filter(m => m.tipologia === 'ENTRATA').reduce((sum, m) => sum + m.importo, 0) * 100
  ) / 100;
  const usciteMese = Math.round(
    currentMonthMovements.filter(m => m.tipologia === 'USCITA').reduce((sum, m) => sum + m.importo, 0) * 100
  ) / 100;

  // Actions
  const handleOpenEdit = (mov: Movement) => {
    setEditingMovement(mov);
    setIsNewTxOpen(true);
  };

  const handleDuplicate = async (mov: Movement) => {
    await MovementService.duplicate(mov.id);
    refreshAll();
  };

  const handleDelete = async (mov: Movement) => {
    if (confirm(`Sei sicuro di voler eliminare "${mov.descrizione}" (${formatCurrency(mov.importo)})?`)) {
      await MovementService.delete(mov.id);
      refreshAll();
    }
  };

  const handleChangeAccount = async (mov: Movement, newAccountId: string) => {
    await MovementService.quickChangeAccount(mov.id, newAccountId);
    refreshAll();
  };

  const handleAssignTag = async (mov: Movement, tagName: string, action: 'ADD' | 'REMOVE' | 'TOGGLE' = 'TOGGLE') => {
    let currentTags: string[] = Array.isArray(mov.tags) ? [...mov.tags] : [];
    if (mov.tag && !currentTags.some(t => t.toLowerCase() === mov.tag!.toLowerCase())) {
      currentTags.push(mov.tag);
    }
    const target = tagName.trim();
    const exists = currentTags.some(t => t.toLowerCase() === target.toLowerCase());

    if (action === 'TOGGLE') {
      if (exists) {
        currentTags = currentTags.filter(t => t.toLowerCase() !== target.toLowerCase());
      } else {
        currentTags.push(target);
      }
    } else if (action === 'ADD') {
      if (!exists) currentTags.push(target);
    } else if (action === 'REMOVE') {
      currentTags = currentTags.filter(t => t.toLowerCase() !== target.toLowerCase());
    }

    const primaryTag = currentTags.length > 0 ? currentTags[0] : null;
    await MovementService.update(mov.id, {
      tag: primaryTag,
      tags: currentTags
    });
    haptics.tap();
    refreshAll();
  };

  const handleClearTags = async (mov: Movement) => {
    await MovementService.update(mov.id, {
      tag: null,
      tags: []
    });
    haptics.tap();
    refreshAll();
  };

  const handleContextMenu = (e: React.MouseEvent, mov: Movement) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      movement: mov
    });
  };

  const handleAddOnCalendarDate = (dateStr: string) => {
    setEditingMovement({
      id: '',
      movimento_id: '',
      data: dateStr,
      descrizione: '',
      importo: 0,
      tipologia: 'USCITA',
      conto_origine: rawAccounts[0]?.id || '',
      sottocategoria_id: subcategories[0]?.id || '',
      stato: 'CONFERMATO',
      origine_dati: 'MANUALE',
      created_at: '',
      updated_at: ''
    });
    setIsNewTxOpen(true);
  };

  return (
    <div className="min-h-screen pb-28 sm:pb-12 text-slate-900">
      {/* Header Globale Sticky a tutta larghezza con bordo continuo */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        alertCount={alerts.length}
        syncStatus={syncStatus}
        onOpenNewTransaction={() => {
          setEditingMovement(null);
          setIsNewTxOpen(true);
        }}
        onOpenControlCenter={() => setIsControlOpen(true)}
        onOpenAccounts={() => setActiveTab('CONTI')}
        onOpenCategories={() => setActiveTab('IMPOSTAZIONI')}
        onOpenBackup={() => setIsBackupOpen(true)}
        onOpenReconciliation={() => handleOpenReconciliation()}
        onOpenBalanceCorrection={() => handleOpenBalanceCorrection()}
        onOpenSpotlight={() => setIsSpotlightOpen(true)}
        onOpenReceiptScanner={() => setIsReceiptScannerOpen(true)}
        onOpenPurchaseImpact={() => setIsPurchaseImpactOpen(true)}
        onOpenExportSummary={() => setIsExportSummaryOpen(true)}
        onOpenAIChat={() => setIsAIChatOpen(true)}
      />

      {/* Container fluido principale per i contenuti - Perfettamente allineato all'Header (max-w-7xl px-4 md:px-8) */}
      <main className="w-full max-w-7xl mx-auto px-4 md:px-8 pt-0 sm:pt-1 pb-20 sm:pb-10 max-w-[100vw] overflow-x-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 0 }}
            transition={{ duration: 0.15, ease: [0.25, 1, 0.5, 1] }}
          >
            {/* Tab 1: DASHBOARD */}
            {activeTab === 'DASHBOARD' && (
              isInitialLoading ? (
                <DashboardSkeleton />
              ) : (
                <div className="space-y-3 sm:space-y-5">
                  <BentoDashboard
                    totaleOggiCalcolato={forecasts.totale_oggi_calcolato}
                    totaleOggiReale={forecasts.totale_oggi_reale}
                    differenzaTotale={forecasts.differenza_totale}
                    totaleFineMese={forecasts.totale_fine_mese}
                    totaleAlNove={forecasts.totale_al_nove}
                    entrateMese={entrateMese}
                    usciteMese={usciteMese}
                    accounts={forecasts.accounts}
                    funds={forecasts.funds}
                    daily30Days={forecasts.daily30Days}
                    dailyForecastData={forecasts.daily30Days}
                    alerts={alerts}
                    movements={movements}
                    subcategories={subcategories}
                    planned={planned}
                    deadlines={deadlines}
                    weeklyReport={weeklyReport}
                    allWeeklyReports={allWeeklyReports}
                    isWeeklyReportLoading={isWeeklyReportLoading}
                    onRefreshWeeklyReport={() => handleRefreshWeeklyReport(true)}
                    onOpenControlCenter={() => setIsControlOpen(true)}
                    onOpenAccounts={() => setActiveTab('CONTI')}
                    onNavigateToCalendar={handleNavigateToCalendar}
                    onNavigateToProjects={() => setActiveTab('PROGETTI')}
                    onNavigateToNotes={() => setActiveTab('NOTE')}
                    onNavigateToReports={() => setActiveTab('REPORT_AI')}
                    onNavigateToAnalytics={() => setActiveTab('ANALISI')}
                    onRefresh={refreshAll}
                  />
                </div>
              )
            )}

            {/* Tab: ANALISI & GRAFICI (Tab Principale Dedicata) */}
            {activeTab === 'ANALISI' && (
              <AnalyticsView
                movements={movements}
                subcategories={subcategories}
                accounts={forecasts.accounts}
                funds={forecasts.funds}
                daily30Days={forecasts.daily30Days}
                planned={planned}
                deadlines={deadlines}
                totaleOggiCalcolato={forecasts.totale_oggi_calcolato}
                totaleFineMese={forecasts.totale_fine_mese}
                totaleAlNove={forecasts.totale_al_nove}
                onNavigateToTransactions={() => setActiveTab('TRANSAZIONI')}
                onNavigateToBudget={() => setActiveTab('BUDGET')}
              />
            )}

            {/* Tab 2: TUTTI I MOVIMENTI */}
            {activeTab === 'TRANSAZIONI' && (
              <TransactionListView
                movements={movements}
                subcategories={subcategories}
                accounts={rawAccounts}
                funds={rawFunds}
                onSelectMovement={handleOpenEdit}
                onDuplicateMovement={handleDuplicate}
                onDeleteMovement={handleDelete}
                onContextMenu={handleContextMenu}
                onAssignTag={handleAssignTag}
                initialTag={selectedTagFilter}
                initialSubcategoryId={selectedBudgetFilter?.subcategoryId}
                initialMonth={selectedBudgetFilter?.month}
                onClearBudgetFilter={() => setSelectedBudgetFilter(null)}
                onNavigateBackToBudget={() => setActiveTab('BUDGET')}
                onOpenNewTransaction={() => {
                  setEditingMovement(null);
                  setIsNewTxOpen(true);
                }}
                onOpenReconciliation={handleOpenReconciliation}
              />
            )}

            {/* Tab: REPORT AI (Storico Settimanale, Singoli Report & Trend Consigli) */}
            {activeTab === 'REPORT_AI' && (
              <WeeklyReportView
                reports={allWeeklyReports}
                isLoading={isWeeklyReportLoading}
                onRefreshReport={() => handleRefreshWeeklyReport(true)}
                onNavigateToMovements={() => setActiveTab('TRANSAZIONI')}
                onNavigateToBudget={() => setActiveTab('BUDGET')}
              />
            )}

            {/* Tab 3: CALENDARIO */}
            {activeTab === 'CALENDARIO' && (
              <CalendarView
                movements={movements}
                planned={planned}
                deadlines={deadlines}
                subcategories={subcategories}
                onSelectMovement={handleOpenEdit}
                onAddOnDate={handleAddOnCalendarDate}
                selectedDate={selectedCalendarDate}
              />
            )}

            {/* Tab 4: BUDGET */}
            {activeTab === 'BUDGET' && (
              <BudgetView
                onNavigateToTransactions={(filter) => {
                  setSelectedBudgetFilter(filter);
                  setActiveTab('TRANSAZIONI');
                }}
              />
            )}

            {/* Tab: RICORRENZE & RATE (Schermata dedicata sottocategorie con ricorrenza) */}
            {activeTab === 'RICORRENZE' && (
              <RecurrencesView
                subcategories={subcategories}
                accounts={rawAccounts}
                funds={rawFunds}
                onNavigateToCalendar={() => setActiveTab('CALENDARIO')}
                onNavigateToTransactions={() => setActiveTab('TRANSAZIONI')}
                onRefresh={refreshAll}
              />
            )}

            {/* Tab 5: PROGETTI & FINANZIAMENTI */}
            {activeTab === 'PROGETTI' && (
              <ProjectsView
                movements={movements}
                subcategories={subcategories}
                accounts={rawAccounts}
                funds={rawFunds}
                onOpenNewTransactionForProject={(sottocategoriaId, projectId) => {
                  setEditingMovement({
                    id: '',
                    movimento_id: '',
                    data: new Date().toISOString().split('T')[0],
                    descrizione: '',
                    importo: 0,
                    tipologia: 'USCITA',
                    conto_origine: rawAccounts[0]?.id || '',
                    sottocategoria_id: sottocategoriaId,
                    progetto_id: projectId,
                    stato: 'CONFERMATO',
                    origine_dati: 'MANUALE',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  });
                  setIsNewTxOpen(true);
                }}
                onFilterByTag={(tag) => {
                  setSelectedTagFilter(tag);
                  setActiveTab('TRANSAZIONI');
                }}
              />
            )}

            {/* Tab 6: BLOCCO NOTE & IDEE */}
            {activeTab === 'NOTE' && (
              <NotepadView
                onOpenNewTransaction={() => {
                  setEditingMovement(null);
                  setIsNewTxOpen(true);
                }}
                onNavigateToProjects={() => setActiveTab('PROGETTI')}
              />
            )}

            {/* Tab 7: IMPOSTAZIONI (Gestione Categorie, Icone, Conti, Backup) */}
            {activeTab === 'IMPOSTAZIONI' && (
              <SettingsView
                subcategories={subcategories}
                onRefresh={refreshAll}
                onOpenAccounts={() => setActiveTab('CONTI')}
                onOpenBackup={() => setIsBackupOpen(true)}
                onOpenControlCenter={() => setIsControlOpen(true)}
                onOpenRecurrences={() => setActiveTab('RICORRENZE')}
              />
            )}

            {/* Tab: PATRIMONIO & CONTI (Conti, Fondi e Progetti/Debiti) */}
            {activeTab === 'CONTI' && (
              <div className="space-y-4">
                {/* Header Viewing Area (One UI) per la sezione Patrimonio */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F5F5F7] tracking-tight">
                      Patrimonio & Conti <span className="hidden md:inline text-base font-mono font-normal text-slate-400 dark:text-slate-500">(C)</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-[#8E8E93] mt-0.5">
                      Panoramica saldi, disponibilità liquide, carte di pagamento e riserve
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('PROGETTI')}
                      className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-2xs"
                      title="Visualizza Progetti, Finanziamenti e Mutui"
                    >
                      <FolderKanban size={13} />
                      <span>Progetti & Mutui →</span>
                    </button>
                    <button
                      id="conti-back-to-dashboard-btn"
                      onClick={() => setActiveTab('DASHBOARD')}
                      className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-[#242426] dark:hover:bg-[#2A2A2E] text-slate-700 dark:text-[#F5F5F7] transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-2xs"
                      title="Torna alla Homepage"
                    >
                      <span>← Dashboard</span>
                    </button>
                  </div>
                </div>

                {/* Sezione Conti & Fondi ad alta capacità */}
                <AccountsFundsSection
                  accounts={forecasts.accounts}
                  funds={forecasts.funds}
                  totaleOggiCalcolato={forecasts.totale_oggi_calcolato}
                  onOpenAccountsModal={() => setIsAccountsOpen(true)}
                  onOpenNewTransaction={() => {
                    setEditingMovement(null);
                    setIsNewTxOpen(true);
                  }}
                  onOpenReconciliation={handleOpenReconciliation}
                  onOpenBalanceCorrection={handleOpenBalanceCorrection}
                  onSelectAccount={(acc) => setSelectedAccountForDetail(acc)}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Modale Nuova Transazione (con In-place creation di sottocategoria e conto) */}
      {isNewTxOpen && (
        <NewTransactionModal
          isOpen={isNewTxOpen}
          onClose={() => {
            setIsNewTxOpen(false);
            setEditingMovement(null);
          }}
          subcategories={subcategories}
          accounts={rawAccounts}
          funds={rawFunds}
          initialMovement={editingMovement}
          onSuccess={refreshAll}
        />
      )}

      {/* Modale Gestione Conti & Fondi */}
      {isAccountsOpen && (
        <AccountsModal
          isOpen={isAccountsOpen}
          onClose={() => setIsAccountsOpen(false)}
          accounts={forecasts.accounts}
          funds={forecasts.funds}
          onRefresh={refreshAll}
          onOpenReconciliation={handleOpenReconciliation}
          onOpenBalanceCorrection={handleOpenBalanceCorrection}
          onSelectAccount={(acc) => setSelectedAccountForDetail(acc)}
          onOpenCreateAccount={() => {
            setIsAccountsOpen(false);
            setEditingMovement(null);
            setIsNewTxOpen(true);
          }}
        />
      )}

      {/* Modale Dettaglio Conto e Tabella Movimenti per Mese */}
      {selectedAccountForDetail && (
        <AccountDetailModal
          isOpen={!!selectedAccountForDetail}
          onClose={() => setSelectedAccountForDetail(null)}
          account={activeDetailAccount}
          allAccounts={[...rawAccounts, ...rawFunds]}
          movements={movements}
          planned={planned}
          subcategories={subcategories}
          onSelectMovement={handleOpenEdit}
          onOpenNewTransactionForAccount={handleOpenNewTransactionForAccount}
          onOpenReconciliation={handleOpenReconciliation}
          onOpenBalanceCorrection={handleOpenBalanceCorrection}
          onEditAccount={() => setIsAccountsOpen(true)}
        />
      )}

      {/* Modale Centro Controllo */}
      {isControlOpen && (
        <ControlCenterModal
          isOpen={isControlOpen}
          onClose={() => setIsControlOpen(false)}
          alerts={alerts}
          onRefresh={refreshAll}
          onOpenReconciliation={handleOpenReconciliation}
          onOpenBalanceCorrection={handleOpenBalanceCorrection}
        />
      )}

      {/* Modale Correzione Saldo Conti / Fondi (Rettifica Automatica) */}
      {isBalanceCorrectionOpen && (
        <AccountBalanceCorrectionModal
          isOpen={isBalanceCorrectionOpen}
          onClose={() => {
            setIsBalanceCorrectionOpen(false);
            setBalanceCorrectionAccountId(undefined);
          }}
          accounts={rawAccounts}
          funds={rawFunds}
          initialAccountId={balanceCorrectionAccountId}
          onSuccess={refreshAll}
        />
      )}

      {/* Modale Riconciliazione Estratto Conto Bancario */}
      {isReconciliationOpen && (
        <StatementReconciliationModal
          isOpen={isReconciliationOpen}
          onClose={() => {
            setIsReconciliationOpen(false);
            setReconciliationAccountId(undefined);
          }}
          accounts={rawAccounts}
          funds={rawFunds}
          subcategories={subcategories}
          onSuccess={refreshAll}
          initialAccountId={reconciliationAccountId}
        />
      )}

      {/* Modale Categorie & Icone Personalizzate */}
      {isCategoriesOpen && (
        <CategoryManagerModal
          isOpen={isCategoriesOpen}
          onClose={() => setIsCategoriesOpen(false)}
          subcategories={subcategories}
          onRefresh={refreshAll}
        />
      )}

      {/* Modale Backup & Cloud Sync */}
      {isBackupOpen && (
        <BackupModal
          isOpen={isBackupOpen}
          onClose={() => setIsBackupOpen(false)}
          onSuccess={refreshAll}
        />
      )}

      {/* Spotlight Global Hub (Ctrl+K) */}
      <SpotlightSearchModal
        isOpen={isSpotlightOpen}
        onClose={() => setIsSpotlightOpen(false)}
        movements={movements}
        subcategories={subcategories}
        accounts={rawAccounts}
        funds={rawFunds}
        onSelectMovement={(mov) => {
          handleOpenEdit(mov);
        }}
        onNavigate={(tab) => {
          setActiveTab(tab as any);
        }}
        onOpenNewTransaction={() => {
          setEditingMovement(null);
          setIsNewTxOpen(true);
        }}
        onOpenScanner={() => {
          setIsReceiptScannerOpen(true);
        }}
        onOpenWhatIf={() => {
          setIsPurchaseImpactOpen(true);
        }}
        onOpenExport={() => {
          setIsExportSummaryOpen(true);
        }}
      />

      {/* Scanner Scontrini AI Vision */}
      <ReceiptScannerModal
        isOpen={isReceiptScannerOpen}
        onClose={() => setIsReceiptScannerOpen(false)}
        subcategories={subcategories}
        accounts={rawAccounts}
        onScanComplete={(parsed) => {
          setEditingMovement({
            id: '',
            movimento_id: '',
            data: parsed.data || new Date().toISOString().split('T')[0],
            descrizione: parsed.descrizione || '',
            importo: parsed.importo || 0,
            tipologia: 'USCITA',
            conto_origine: parsed.conto_origine || rawAccounts[0]?.id || '',
            sottocategoria_id: parsed.sottocategoria_id || subcategories[0]?.id || '',
            stato: 'CONFERMATO',
            origine_dati: 'MANUALE',
            note: parsed.note || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          setIsNewTxOpen(true);
        }}
      />

      {/* Simulatore di Impatto Acquisti "What-If" */}
      <PurchaseImpactModal
        isOpen={isPurchaseImpactOpen}
        onClose={() => setIsPurchaseImpactOpen(false)}
        accounts={rawAccounts}
        funds={rawFunds}
        subcategories={subcategories}
        onSimulatedPurchaseConfirmed={(purchase) => {
          setEditingMovement({
            id: '',
            movimento_id: '',
            data: purchase.data,
            descrizione: purchase.descrizione,
            importo: purchase.importo,
            tipologia: 'USCITA',
            conto_origine: purchase.conto_origine,
            sottocategoria_id: purchase.sottocategoria_id,
            stato: 'CONFERMATO',
            origine_dati: 'MANUALE',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          setIsNewTxOpen(true);
        }}
      />

      {/* Esportazione & Report Mensile Stampabile */}
      <MonthlySummaryExportModal
        isOpen={isExportSummaryOpen}
        onClose={() => setIsExportSummaryOpen(false)}
        movements={movements}
        subcategories={subcategories}
        accounts={rawAccounts}
        funds={rawFunds}
      />

      {/* Assistente Finanziario Gemini AI Modal */}
      <AIChatModal
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
        movements={movements}
        accounts={rawAccounts}
        subcategories={subcategories}
      />

      {/* Floating Action Button Gemini AI (sempre accessibile su desktop e mobile in basso a destra) */}
      <button
        id="floating-gemini-ai-fab"
        onClick={() => {
          haptics.tap();
          setIsAIChatOpen(true);
        }}
        className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40 h-11 sm:h-12 px-3.5 sm:px-4 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:opacity-95 text-white font-bold text-xs sm:text-sm shadow-xl flex items-center gap-2 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer border border-white/20 group"
        title="Apri Assistente AI Gemini"
      >
        <div className="relative flex items-center justify-center">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white animate-pulse" />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-yellow-300 ring-1 ring-white" />
        </div>
        <span className="font-extrabold tracking-wide">Chiedi a Gemini</span>
      </button>

      {/* Desktop Context Menu */}
      {contextMenu && (
        <DesktopContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          movement={contextMenu.movement}
          accounts={rawAccounts}
          funds={rawFunds}
          onClose={() => setContextMenu(null)}
          onEdit={handleOpenEdit}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onChangeAccount={handleChangeAccount}
          onAssignTag={handleAssignTag}
          onClearTags={handleClearTags}
        />
      )}
      {/* Mobile Bottom Navigation Bar con tasto centrale "+" */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={(tab) => {
          haptics.tap();
          setActiveTab(tab);
        }}
        onOpenNewTransaction={() => {
          haptics.tap();
          setEditingMovement(null);
          setIsNewTxOpen(true);
        }}
      />
    </div>
  );
}
