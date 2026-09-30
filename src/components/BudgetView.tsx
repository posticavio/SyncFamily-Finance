import React, { useState, useEffect, useMemo } from 'react';
import { BudgetPerformanceItem, MovementType, Subcategory, getSubcategoryClassification, getSubcategoryNecessity, Movement, Planned } from '../types';
import { BudgetService } from '../services/BudgetService';
import { CategoryService } from '../services/CategoryService';
import { MovementService } from '../services/MovementService';
import { PlannedService } from '../services/PlannedService';
import { formatCurrency, getMonthName } from '../utils/formatters';
import { CategoryIcon } from './CategoryIcon';
import { TabHeaderInfo } from './TabHeaderInfo';
import { BudgetProgressBar, getSpendStatus, getIncomeStatus } from './BudgetProgressBar';
import { BudgetDetailedAnalysis } from './BudgetDetailedAnalysis';
import { SavingsSimulatorModal } from './SavingsSimulatorModal';
import { 
  getCurrentFinancialMonth, 
  getFinancialPeriodInfo, 
  formatDMY 
} from '../utils/financialDate';
import { 
  ChevronLeft, 
  ChevronRight, 
  Copy, 
  Check, 
  Edit2, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  X, 
  TrendingDown, 
  TrendingUp,
  Trash2,
  LayoutGrid,
  Activity,
  PieChart,
  ListFilter,
  PiggyBank,
  Sparkles,
  Calculator,
  ArrowUpRight,
  Zap,
  Clock,
  FileText,
  Search
} from 'lucide-react';

interface CategoryGroup {
  categoryName: string;
  budget: number;
  reale: number;
  pianificato: number;
  previsione: number;
  differenza: number;
  percentuale: number;
  iconName: string;
  color: string;
  items: BudgetPerformanceItem[];
}

interface BudgetViewProps {
  onNavigateToTransactions?: (filter: { subcategoryId?: string; month?: string }) => void;
}

export const BudgetView: React.FC<BudgetViewProps> = ({ onNavigateToTransactions }) => {
  const currentFinMonth = getCurrentFinancialMonth();
  const [selectedMonth, setSelectedMonth] = useState<string>(currentFinMonth);
  const [activeTab, setActiveTab] = useState<MovementType>('USCITA');

  const [data, setData] = useState<{
    items: BudgetPerformanceItem[];
    totaleBudget: number;
    totaleReale: number;
    totalePianificato: number;
    totalePrevisione: number;
    totaleDifferenza: number;
    totaleBudgetEntrate: number;
    totaleRealeEntrate: number;
    totalePianificatoEntrate: number;
    totalePrevisioneEntrate: number;
    totaleDifferenzaEntrate: number;
  }>({
    items: [],
    totaleBudget: 0,
    totaleReale: 0,
    totalePianificato: 0,
    totalePrevisione: 0,
    totaleDifferenza: 0,
    totaleBudgetEntrate: 0,
    totaleRealeEntrate: 0,
    totalePianificatoEntrate: 0,
    totalePrevisioneEntrate: 0,
    totaleDifferenzaEntrate: 0
  });

  const [allSubcategories, setAllSubcategories] = useState<Subcategory[]>([]);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editBudgetAmount, setEditBudgetAmount] = useState<string>('');
  const [cloneStatus, setCloneStatus] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [selectedDetailCategory, setSelectedDetailCategory] = useState<CategoryGroup | null>(null);
  const [subcategorySearch, setSubcategorySearch] = useState<string>('');

  // Stati per la visualizzazione dei movimenti integrati nel modal di dettaglio
  const [selectedSubIdMovements, setSelectedSubIdMovements] = useState<string | null>(null);
  const [selectedSubNameMovements, setSelectedSubNameMovements] = useState<string | null>(null);
  const [subMovements, setSubMovements] = useState<Movement[]>([]);
  const [subPlanned, setSubPlanned] = useState<Planned[]>([]);
  const [isLoadingMovements, setIsLoadingMovements] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedSubIdMovements) {
      setSubMovements([]);
      setSubPlanned([]);
      return;
    }

    const fetchMovements = async () => {
      setIsLoadingMovements(true);
      try {
        const period = getFinancialPeriodInfo(selectedMonth);
        
        // 1. Carica movimenti reali
        const reals = await MovementService.getAll({
          startDate: period.startDate,
          endDate: period.endDate,
          sottocategoriaId: selectedSubIdMovements
        });

        // 2. Carica pianificati pendenti
        const allPlanned = await PlannedService.getAll();
        const plannedPendings = allPlanned.filter(p => 
          p.sottocategoria_id === selectedSubIdMovements &&
          p.stato === 'PENDENTE' &&
          p.data_prevista >= period.startDate &&
          p.data_prevista <= period.endDate
        );

        setSubMovements(reals);
        setSubPlanned(plannedPendings);
      } catch (err) {
        console.error("Errore nel caricamento dei movimenti:", err);
      } finally {
        setIsLoadingMovements(false);
      }
    };

    fetchMovements();
  }, [selectedSubIdMovements, selectedMonth]);

  // Modale Aggiungi Budget
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newBudgetSubId, setNewBudgetSubId] = useState<string>('');
  const [newBudgetAmount, setNewBudgetAmount] = useState<string>('');

  // Modalità Vista: Panoramica per Categorie Macro, Tutte le Sottocategorie o Analisi Dettagliata & Proiezioni
  const [viewMode, setViewMode] = useState<'OVERVIEW' | 'SUBCATEGORIES' | 'DETAILED_ANALYSIS'>('OVERVIEW');

  // Modale Simulatore di Risparmio 6 & 12 Mesi
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);

  const alertCategoriesCount = useMemo(() => {
    const filtered = data.items.filter(item => item.tipo === activeTab);
    const groupsMap = new Map<string, { budget: number; reale: number; pianificato: number }>();
    filtered.forEach(i => {
      const cat = i.categoria_padre || 'Altro';
      if (!groupsMap.has(cat)) groupsMap.set(cat, { budget: 0, reale: 0, pianificato: 0 });
      const entry = groupsMap.get(cat)!;
      entry.budget += i.budget;
      entry.reale += i.reale;
      entry.pianificato += i.pianificato;
    });
    let count = 0;
    groupsMap.forEach(g => {
      if (activeTab === 'USCITA') {
        if (g.budget > 0 && (g.reale > g.budget || (g.reale + g.pianificato) > g.budget)) {
          count++;
        }
      }
    });
    return count;
  }, [data.items, activeTab]);

  const loadData = async () => {
    const [result, subs] = await Promise.all([
      BudgetService.getDetailedPerformance(selectedMonth),
      CategoryService.getAllSubcategories()
    ]);
    setAllSubcategories(subs.filter(s => s.tipo !== 'GIROCONTO' && s.attiva));
    setData(result);
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevD = new Date(y, m - 2, 1);
    setSelectedMonth(`${prevD.getFullYear()}-${(prevD.getMonth() + 1).toString().padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextD = new Date(y, m, 1);
    setSelectedMonth(`${nextD.getFullYear()}-${(nextD.getMonth() + 1).toString().padStart(2, '0')}`);
  };

  const handleClonePrevious = async () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevD = new Date(y, m - 2, 1);
    const prevMonthStr = `${prevD.getFullYear()}-${(prevD.getMonth() + 1).toString().padStart(2, '0')}`;
    const res = await BudgetService.cloneMonth(prevMonthStr, selectedMonth);
    setCloneStatus(`Clonati ${res.clonedCount} budget dal mese precedente!`);
    setTimeout(() => setCloneStatus(null), 3500);
    await loadData();
  };

  const handleSaveBudget = async (sottocategoria_id: string) => {
    const parsed = parseFloat(editBudgetAmount.replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0) {
      await BudgetService.setBudget(selectedMonth, sottocategoria_id, parsed);
      setEditingSubId(null);
      await loadData();
    }
  };

  const handleDeleteBudget = async (sottocategoria_id: string) => {
    await BudgetService.setBudget(selectedMonth, sottocategoria_id, 0);
    await loadData();
  };

  const handleAlignBudgetToForecast = async (sottocategoria_id: string, forecastAmount: number) => {
    await BudgetService.setBudget(selectedMonth, sottocategoria_id, forecastAmount);
    await loadData();
  };

  const handleCreateNewBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(newBudgetAmount.replace(',', '.'));
    if (!newBudgetSubId || isNaN(parsed) || parsed <= 0) return;

    await BudgetService.setBudget(selectedMonth, newBudgetSubId, parsed);
    setIsAddModalOpen(false);
    setNewBudgetSubId('');
    setNewBudgetAmount('');
    await loadData();
  };

  const toggleCategoryCollapse = (catName: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catName]: !prev[catName]
    }));
  };

  // Subcategories available to add for activeTab
  const availableSubcategoriesToAdd = useMemo(() => {
    const existingSubIds = new Set(
      data.items.filter(i => i.tipo === activeTab && i.budget > 0).map(i => i.sottocategoria_id)
    );
    return allSubcategories.filter(s => s.tipo === activeTab && !existingSubIds.has(s.id));
  }, [allSubcategories, data.items, activeTab]);

  // Raggruppamento per Categoria Padre filtrato rigorosamente per activeTab (USCITA o ENTRATA)
  const categoryGroups = useMemo(() => {
    // 1. Prendi tutte le sottocategorie del tipo corrente
    const currentTabSubcategories = allSubcategories.filter(sub => sub.tipo === activeTab);

    // 2. Mappa le performance reali del mese corrente (da data.items) per ID sottocategoria
    const performanceMap = new Map<string, BudgetPerformanceItem>();
    data.items.forEach(item => {
      performanceMap.set(item.sottocategoria_id, item);
    });

    // 3. Raggruppa per categoria_padre
    const groupsMap = new Map<string, BudgetPerformanceItem[]>();

    currentTabSubcategories.forEach(sub => {
      const parentCatName = sub.categoria_padre || 'Altro';
      
      if (!groupsMap.has(parentCatName)) {
        groupsMap.set(parentCatName, []);
      }

      // Se esiste una performance registrata in questo mese, usala
      const existingPerf = performanceMap.get(sub.id);
      if (existingPerf) {
        groupsMap.get(parentCatName)!.push(existingPerf);
      } else {
        // Altrimenti, crea un elemento con budget e consumi a 0
        groupsMap.get(parentCatName)!.push({
          sottocategoria_id: sub.id,
          sottocategoria_nome: sub.nome,
          categoria_padre: parentCatName,
          tipo: sub.tipo,
          icon_name: sub.icon_name || 'Tag',
          colore: sub.colore || (activeTab === 'ENTRATA' ? '#10b981' : '#6366f1'),
          budget: 0,
          reale: 0,
          pianificato: 0,
          previsione: 0,
          differenza: 0,
          percentuale: 0,
          stato: 'OK'
        });
      }
    });

    // Gestisci eventuali transazioni o budget di sottocategorie che non sono più attive o non trovate in allSubcategories
    data.items.forEach(item => {
      if (item.tipo === activeTab) {
        const parentCatName = item.categoria_padre || 'Altro';
        const group = groupsMap.get(parentCatName);
        if (group) {
          const hasItem = group.some(g => g.sottocategoria_id === item.sottocategoria_id);
          if (!hasItem) {
            group.push(item);
          }
        } else {
          groupsMap.set(parentCatName, [item]);
        }
      }
    });

    const groups: CategoryGroup[] = [];

    groupsMap.forEach((subItems, categoryName) => {
      const budget = Math.round(subItems.reduce((acc, i) => acc + i.budget, 0) * 100) / 100;
      const reale = Math.round(subItems.reduce((acc, i) => acc + i.reale, 0) * 100) / 100;
      const pianificato = Math.round(subItems.reduce((acc, i) => acc + i.pianificato, 0) * 100) / 100;
      const previsione = Math.round((reale + pianificato) * 100) / 100;
      
      const diff = activeTab === 'USCITA'
        ? Math.round((budget - previsione) * 100) / 100
        : Math.round((previsione - budget) * 100) / 100;

      const perc = budget > 0 
        ? Math.round((previsione / budget) * 100) 
        : (previsione > 0 ? 100 : 0);

      const firstItem = subItems[0];
      const iconName = firstItem?.icon_name || 'Tag';
      const color = firstItem?.colore || (activeTab === 'ENTRATA' ? '#10b981' : '#6366f1');

      groups.push({
        categoryName,
        budget,
        reale,
        pianificato,
        previsione,
        differenza: diff,
        percentuale: perc,
        iconName,
        color,
        items: subItems
      });
    });

    // Ordina le categorie da speso/incassato più grande a più piccolo
    return groups.sort((a, b) => b.reale - a.reale || b.budget - a.budget);
  }, [data.items, allSubcategories, activeTab]);

  // Lista piatta di tutte le singole sottocategorie del tipo attivo (per la vista elenco completo)
  const flatSubcategoryItems = useMemo(() => {
    const currentTabSubcategories = allSubcategories.filter(sub => sub.tipo === activeTab);
    const performanceMap = new Map<string, BudgetPerformanceItem>();
    data.items.forEach(item => {
      if (item.tipo === activeTab) {
        performanceMap.set(item.sottocategoria_id, item);
      }
    });

    const list: BudgetPerformanceItem[] = currentTabSubcategories.map(sub => {
      const existing = performanceMap.get(sub.id);
      if (existing) return existing;

      return {
        sottocategoria_id: sub.id,
        sottocategoria_nome: sub.nome,
        categoria_padre: sub.categoria_padre || 'Altro',
        tipo: sub.tipo,
        icon_name: sub.icon_name || 'Tag',
        colore: sub.colore || (activeTab === 'ENTRATA' ? '#10b981' : '#6366f1'),
        budget: 0,
        reale: 0,
        pianificato: 0,
        previsione: 0,
        differenza: 0,
        percentuale: 0,
        stato: 'OK'
      };
    });

    data.items.forEach(item => {
      if (item.tipo === activeTab && !list.some(l => l.sottocategoria_id === item.sottocategoria_id)) {
        list.push(item);
      }
    });

    let filtered = list;
    if (subcategorySearch.trim()) {
      const q = subcategorySearch.toLowerCase().trim();
      filtered = filtered.filter(i =>
        i.sottocategoria_nome.toLowerCase().includes(q) ||
        i.categoria_padre.toLowerCase().includes(q)
      );
    }

    return filtered.sort((a, b) => {
      if (b.budget !== a.budget) return b.budget - a.budget;
      if (b.reale !== a.reale) return b.reale - a.reale;
      return a.sottocategoria_nome.localeCompare(b.sottocategoria_nome);
    });
  }, [allSubcategories, data.items, activeTab, subcategorySearch]);

  const activeDetailCategory = useMemo(() => {
    if (!selectedDetailCategory) return null;
    return categoryGroups.find(c => c.categoryName === selectedDetailCategory.categoryName) || null;
  }, [categoryGroups, selectedDetailCategory]);

  // Avanzamento globale in base alla scheda attiva
  const isExpense = activeTab === 'USCITA';
  const currentTotalBudget = isExpense ? data.totaleBudget : data.totaleBudgetEntrate;
  const currentTotalReale = isExpense ? data.totaleReale : data.totaleRealeEntrate;
  const currentTotalPianificato = isExpense ? data.totalePianificato : data.totalePianificatoEntrate;
  const currentTotalPrevisione = isExpense ? data.totalePrevisione : data.totalePrevisioneEntrate;
  const currentTotalDiff = isExpense ? data.totaleDifferenza : data.totaleDifferenzaEntrate;

  const overallPercentage = currentTotalBudget > 0
    ? Math.round((currentTotalPrevisione / currentTotalBudget) * 100)
    : 0;

  const overallRealePercentage = currentTotalBudget > 0
    ? Math.round((currentTotalReale / currentTotalBudget) * 100)
    : 0;

  const isOverallOver = isExpense && currentTotalBudget > 0 && currentTotalDiff < 0;

  const currentStatus = isExpense 
    ? getSpendStatus(overallPercentage, currentTotalBudget > 0, isOverallOver)
    : getIncomeStatus(overallPercentage, currentTotalBudget > 0);

  // Calcolo di simulazione rapida per Risparmio 6 e 12 mesi basato su entrate e spese essenziali
  const savingsSimulationPreview = useMemo(() => {
    const income = data.totalePrevisioneEntrate > 0 
      ? data.totalePrevisioneEntrate 
      : (data.totaleBudgetEntrate > 0 ? data.totaleBudgetEntrate : data.totaleRealeEntrate);

    let essentialExpenses = 0;
    let extraExpenses = 0;

    const subMap = new Map<string, Subcategory>();
    allSubcategories.forEach(s => subMap.set(s.id, s));

    data.items.forEach(item => {
      if (item.tipo === 'USCITA') {
        const sub = subMap.get(item.sottocategoria_id);
        const val = item.previsione > 0 ? item.previsione : (item.budget > 0 ? item.budget : item.reale);
        const classification = sub?.classificazione || (sub ? getSubcategoryClassification(sub) : 'SPESE_ESSENZIALI');
        const necessity = sub?.necessita || (sub ? getSubcategoryNecessity(sub) : 'DEVO');

        if (classification === 'SPESE_ESSENZIALI' || necessity === 'DEVO' || necessity === 'HO_BISOGNO') {
          essentialExpenses += val;
        } else {
          extraExpenses += val;
        }
      }
    });

    if (essentialExpenses === 0 && data.totalePrevisione > 0) {
      essentialExpenses = data.totalePrevisione * 0.7;
      extraExpenses = data.totalePrevisione * 0.3;
    }

    const monthlyPotential = Math.round((income - essentialExpenses) * 100) / 100;
    const accumulated6M = Math.round(monthlyPotential * 6 * 100) / 100;
    const accumulated12M = Math.round(monthlyPotential * 12 * 100) / 100;
    const emergencyRunwayMonths = essentialExpenses > 0 ? Math.round((accumulated12M / essentialExpenses) * 10) / 10 : 0;

    return {
      income,
      essentialExpenses,
      extraExpenses,
      monthlyPotential,
      accumulated6M,
      accumulated12M,
      emergencyRunwayMonths
    };
  }, [data, allSubcategories]);

  return (
    <div id="budget-view-container" className="mt-0 space-y-2 sm:space-y-3.5 max-w-7xl mx-auto w-full overflow-x-hidden no-scrollbar">
      {/* 4. SEZIONE TITOLO PAGINA & AZIONI CONTESTUALI */}
      <div className="flex items-center justify-between gap-2.5 mb-0.5 sm:mb-2">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
            <PieChart size={20} className="sm:w-[22px] sm:h-[22px]" />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
              Pianificazione Budget & Spese <span className="hidden md:inline text-base font-mono font-normal text-slate-400 dark:text-slate-500">(B)</span>
            </h1>
            <TabHeaderInfo text="Controllo tetti di spesa, obiettivi di risparmio e monitoraggio scostamenti" />
          </div>
        </div>

        {/* Pulsanti Azione Header (Nuovo Budget & Simulatore) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSimulatorOpen(true)}
            className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold text-xs sm:text-sm px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl transition shadow-xs active:scale-95 shrink-0 cursor-pointer"
            title="Simula quanto risparmio accumuleresti in 6 o 12 mesi"
          >
            <PiggyBank size={15} />
            <span>Simulatore 6/12M</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="hidden sm:flex bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-medium text-sm px-4 py-2 rounded-xl transition items-center gap-2 shadow-xs active:scale-95 self-start sm:self-auto shrink-0 cursor-pointer"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Nuovo Budget</span>
          </button>
        </div>
      </div>

      {/* Month Selector, Tab Switcher and Action Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 sm:p-4 md:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4 shadow-sm">
        {/* Month Selector */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
              title="Mese precedente"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
              title="Mese successivo"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="min-w-0">
            {(() => {
              const pInfo = getFinancialPeriodInfo(selectedMonth);
              return (
                <>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">
                      Budget {pInfo.monthName}
                    </h2>
                    {pInfo.isCustom && (
                      <span className="hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-900/40">
                        {pInfo.shortLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {pInfo.isCustom 
                      ? `Periodo contabile dal ${formatDMY(pInfo.startDate)} al ${formatDMY(pInfo.endDate)}` 
                      : (isExpense ? 'Monitoraggio uscite e limiti di spesa' : 'Obiettivi di incasso ed entrate previste')}
                  </p>
                </>
              );
            })()}
          </div>
        </div>

        {/* Tab Switcher (Spese vs Entrate) - Ottimizzato a larghezza piena proporzionata su smartphone */}
        <div className="grid grid-cols-2 sm:inline-flex items-center justify-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 shrink-0 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('USCITA')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'USCITA'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <TrendingDown size={14} className="text-rose-500" />
            <span>Spese (Uscite)</span>
          </button>
          <button
            onClick={() => setActiveTab('ENTRATA')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'ENTRATA'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <TrendingUp size={14} className="text-emerald-500" />
            <span>Entrate (Obiettivi)</span>
          </button>
        </div>

        {/* Actions (Nascoste su smartphone view per snellire il layout) */}
        <div className="hidden sm:flex flex-wrap items-center gap-2">
          {cloneStatus && (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl animate-in fade-in">
              {cloneStatus}
            </span>
          )}
          <button
            onClick={handleClonePrevious}
            className="hidden sm:flex px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium items-center gap-1.5 transition-colors cursor-pointer"
            title="Copia i budget impostati dal mese precedente"
          >
            <Copy size={13} />
            <span>Clona mese</span>
          </button>
        </div>
      </div>

      {/* View Mode Switcher: Panoramica Categorie, Tutte le Sottocategorie, Analisi Scostamenti & Proiezioni */}
      <div className="flex bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 rounded-2xl p-1.5 sm:p-2.5 flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 shadow-xs">
        <div className="grid grid-cols-3 sm:flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl w-full sm:w-auto gap-1">
          <button
            onClick={() => setViewMode('OVERVIEW')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'OVERVIEW'
                ? 'bg-white dark:bg-[#2A2A2E] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LayoutGrid size={15} />
            <span className="truncate">Categorie</span>
          </button>

          <button
            onClick={() => setViewMode('SUBCATEGORIES')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'SUBCATEGORIES'
                ? 'bg-white dark:bg-[#2A2A2E] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ListFilter size={15} />
            <span className="truncate">Sottocategorie</span>
          </button>

          <button
            onClick={() => setViewMode('DETAILED_ANALYSIS')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all relative cursor-pointer ${
              viewMode === 'DETAILED_ANALYSIS'
                ? 'bg-white dark:bg-[#2A2A2E] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Activity size={15} className="text-[#E31B23]" />
            <span className="truncate">Analisi</span>
            {isExpense && alertCategoriesCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-[#E31B23] text-white text-[9.5px] font-bold">
                {alertCategoriesCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {viewMode === 'DETAILED_ANALYSIS' ? (
        <BudgetDetailedAnalysis
          selectedMonth={selectedMonth}
          activeTab={activeTab}
          items={data.items}
          allSubcategories={allSubcategories}
          onOpenNewBudget={() => setIsAddModalOpen(true)}
          onNavigateToTransactions={onNavigateToTransactions}
        />
      ) : viewMode === 'SUBCATEGORIES' ? (
        <div className="space-y-4">
          {/* Barra di ricerca e azione Aggiungi Budget */}
          <div className="bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 rounded-2xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={subcategorySearch}
                onChange={e => setSubcategorySearch(e.target.value)}
                placeholder="Cerca sottocategoria o categoria padre..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-[#2A2A2E] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#E31B23]"
              />
              {subcategorySearch && (
                <button
                  onClick={() => setSubcategorySearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
              <span className="text-xs font-semibold text-slate-500 dark:text-[#8E8E93]">
                {flatSubcategoryItems.length} sottocategorie
              </span>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-[#E31B23] hover:bg-[#c9171e] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95"
              >
                <Plus size={14} />
                <span>Nuovo Budget</span>
              </button>
            </div>
          </div>

          {/* Elenco completo Sottocategorie */}
          {flatSubcategoryItems.length === 0 ? (
            <div className="bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 rounded-2xl p-8 text-center space-y-3">
              <p className="text-sm text-slate-500 dark:text-[#8E8E93]">
                {subcategorySearch 
                  ? `Nessuna sottocategoria trovata per "${subcategorySearch}".`
                  : `Nessuna sottocategoria per ${isExpense ? 'le uscite' : 'le entrate'}.`}
              </p>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#E31B23] text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>Imposta un budget</span>
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-white/5 shadow-xs">
              {flatSubcategoryItems.map(item => {
                const isEditing = editingSubId === item.sottocategoria_id;
                const hasSubBudget = item.budget > 0;
                const isOverSub = isExpense && hasSubBudget && item.differenza < 0;
                const subStatus = isExpense
                  ? getSpendStatus(item.percentuale, hasSubBudget, item.differenza < 0)
                  : getIncomeStatus(item.percentuale, hasSubBudget);

                return (
                  <div
                    key={item.sottocategoria_id}
                    className="p-3.5 sm:p-4 hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors flex flex-col gap-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Dettagli Sottocategoria */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="relative w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-slate-100 dark:bg-[#2A2A2E] border border-slate-200/60 dark:border-white/10">
                          <CategoryIcon name={item.icon_name} color={item.colore} size={18} />
                          {isOverSub && (
                            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-80"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600 border border-white dark:border-[#1C1C1E]"></span>
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#F5F5F7] truncate">
                              {item.sottocategoria_nome}
                            </h4>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-[#8E8E93] truncate">
                              {item.categoria_padre}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${subStatus.badgeBg} ${subStatus.badgeText} ${subStatus.badgeBorder}`}>
                              {hasSubBudget ? `${item.percentuale}%` : 'Senza Budget'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-[#8E8E93] font-numeric mt-1">
                            {isExpense ? (
                              <>
                                <span>Speso: <strong className="text-slate-800 dark:text-[#F5F5F7] font-semibold">{formatCurrency(item.reale)}</strong></span>
                                {item.pianificato > 0 && (
                                  <>
                                    <span>•</span>
                                    <span>In prog: <strong className="text-amber-500 font-semibold">{formatCurrency(item.pianificato)}</strong></span>
                                  </>
                                )}
                                <span>•</span>
                                <span>Target: <strong className="text-slate-800 dark:text-[#F5F5F7] font-semibold">{hasSubBudget ? formatCurrency(item.budget) : '—'}</strong></span>
                              </>
                            ) : (
                              <>
                                <span>Incassato: <strong className="text-slate-800 dark:text-[#F5F5F7] font-semibold">{formatCurrency(item.reale)}</strong></span>
                                {item.pianificato > 0 && (
                                  <>
                                    <span>•</span>
                                    <span>In prog: <strong className="text-emerald-500 font-semibold">{formatCurrency(item.pianificato)}</strong></span>
                                  </>
                                )}
                                <span>•</span>
                                <span>Target: <strong className="text-slate-800 dark:text-[#F5F5F7] font-semibold">{hasSubBudget ? formatCurrency(item.budget) : '—'}</strong></span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Azioni Modifica Budget / Dettagli */}
                      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">€</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={editBudgetAmount}
                                onChange={e => setEditBudgetAmount(e.target.value)}
                                placeholder="0"
                                autoFocus
                                onFocus={(e) => e.target.select()}
                                className="w-24 pl-5 pr-2 py-1.5 text-xs font-numeric font-semibold bg-white dark:bg-[#2A2A2E] text-slate-900 dark:text-white border border-[#E31B23] rounded-xl outline-none"
                              />
                            </div>
                            <button
                              onClick={() => handleSaveBudget(item.sottocategoria_id)}
                              className="p-1.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                              title="Salva"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setEditingSubId(null)}
                              className="p-1.5 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300"
                              title="Annulla"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setEditingSubId(item.sottocategoria_id);
                                setEditBudgetAmount(item.budget > 0 ? item.budget.toString() : '');
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#2A2A2E] dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-[#F5F5F7] text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Modifica Budget"
                            >
                              <Edit2 size={12} />
                              <span>{hasSubBudget ? formatCurrency(item.budget) : 'Imposta'}</span>
                            </button>

                            {hasSubBudget && (
                              <button
                                onClick={() => handleDeleteBudget(item.sottocategoria_id)}
                                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 transition-colors"
                                title="Rimuovi Budget"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setSelectedSubIdMovements(item.sottocategoria_id);
                                setSelectedSubNameMovements(item.sottocategoria_nome);
                              }}
                              className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40 hover:bg-indigo-100 transition-colors"
                              title="Vedi movimenti"
                            >
                              <ArrowUpRight size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <BudgetProgressBar
                      reale={item.reale}
                      pianificato={item.pianificato}
                      budget={item.budget}
                      size="sm"
                      showDetails={false}
                      isIncome={!isExpense}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* One UI Squircle Card: Simulazione Risparmio 6 & 12 Mesi (Entrate vs Spese Essenziali) */}
          <div className="bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 hover:border-emerald-500/40 rounded-2xl p-3.5 sm:p-4 shadow-xs transition-all flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 relative overflow-hidden">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center justify-center shrink-0">
                <PiggyBank size={20} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#F5F5F7] tracking-tight truncate">
                    Simulatore di Risparmio & Accumulo
                  </h3>
                  <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                    Entrate vs Spese Essenziali
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-[#8E8E93] truncate mt-0.5">
                  Potenziale: <strong className="text-slate-800 dark:text-[#F5F5F7] font-numeric">{formatCurrency(savingsSimulationPreview.monthlyPotential)}</strong>/mese • Proiezione a 6 e 12 mesi
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between md:justify-end gap-3.5 shrink-0 pt-2.5 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="text-left md:text-right">
                  <span className="text-[9.5px] text-slate-400 dark:text-[#8E8E93] block leading-none mb-1 font-medium">In 6 Mesi</span>
                  <span className="font-numeric tabular-nums text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 block leading-none">
                    {formatCurrency(savingsSimulationPreview.accumulated6M, { showSign: true })}
                  </span>
                </div>
                <div className="w-px h-6 bg-slate-200 dark:bg-white/10 hidden sm:block" />
                <div className="text-left md:text-right">
                  <span className="text-[9.5px] text-slate-400 dark:text-[#8E8E93] block leading-none mb-1 font-medium">In 12 Mesi</span>
                  <span className="font-numeric tabular-nums text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 block leading-none">
                    {formatCurrency(savingsSimulationPreview.accumulated12M, { showSign: true })}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSimulatorOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 shadow-2xs"
              >
                <Sparkles size={13} />
                <span>Simula Scenari</span>
              </button>
            </div>
          </div>

          {/* Overview KPI Cards - Griglia responsive 2x2 perfetta su smartphone e 5 colonne su desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5 lg:gap-3 w-full">
            {/* KPI 1: Budget Fissato */}
            <div className="min-w-0 bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 rounded-2xl p-2.5 sm:p-3.5 lg:p-4 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8E8E93] block mb-1 truncate">
                {isExpense ? 'Budget Fissato' : 'Obiettivo Totale'}
              </span>
              <span className="font-numeric tabular-nums text-sm sm:text-base lg:text-xl font-bold text-slate-900 dark:text-[#F5F5F7] block truncate">
                {formatCurrency(currentTotalBudget)}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate mt-0.5">
                {isExpense ? 'Somma tetti' : 'Target incasso'}
              </span>
            </div>

            {/* KPI 2: Speso Reale */}
            <div className="min-w-0 bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 rounded-2xl p-2.5 sm:p-3.5 lg:p-4 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8E8E93] block mb-1 truncate">
                {isExpense ? 'Speso Reale' : 'Incassato Reale'}
              </span>
              <span className="font-numeric tabular-nums text-sm sm:text-base lg:text-xl font-bold text-slate-800 dark:text-slate-200 block truncate">
                {formatCurrency(currentTotalReale)}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate mt-0.5">
                Fino ad oggi
              </span>
            </div>

            {/* KPI 3: In Programma */}
            <div className="min-w-0 bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 rounded-2xl p-2.5 sm:p-3.5 lg:p-4 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 block mb-1 truncate">
                {isExpense ? 'In Programma' : 'In Arrivo'}
              </span>
              <span className="font-numeric tabular-nums text-sm sm:text-base lg:text-xl font-bold text-amber-600 dark:text-amber-400 block truncate">
                {formatCurrency(currentTotalPianificato)}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate mt-0.5">
                {isExpense ? 'Uscite future' : 'Entrate future'}
              </span>
            </div>

            {/* KPI 4: Impegnato Mese (Nascosto su smartphone view, visibile su desktop) */}
            <div className="hidden sm:flex min-w-0 bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 rounded-2xl p-3 sm:p-3.5 lg:p-4 shadow-xs flex-col justify-between">
              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 block mb-1 truncate">
                {isExpense ? 'Impegnato Mese' : 'Previsione Mese'}
              </span>
              <span className={`font-numeric tabular-nums text-sm sm:text-base lg:text-xl font-bold block truncate ${isExpense ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {formatCurrency(currentTotalPrevisione)}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate mt-0.5">
                Reale + In programma
              </span>
            </div>

            {/* KPI 5: Margine Residuo - Griglia equilibrata 2x2 su mobile */}
            <div className={`col-span-1 min-w-0 bg-white dark:bg-[#1C1C1E] border ${
              isExpense && currentTotalDiff < 0
                ? 'border-rose-500/50 dark:border-rose-500/40 ring-1 ring-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.15)]'
                : 'border-slate-200/80 dark:border-white/5'
            } rounded-2xl p-2.5 sm:p-3.5 lg:p-4 shadow-xs flex flex-col justify-between transition-all`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8E8E93] block truncate">
                  {isExpense ? 'Margine Residuo' : 'Scostamento Target'}
                </span>
                {isExpense && currentTotalDiff < 0 && (
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-80"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                )}
              </div>
              <span className={`font-numeric tabular-nums text-sm sm:text-base lg:text-xl font-bold block truncate ${
                isExpense 
                  ? (currentTotalDiff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400 animate-pulse')
                  : (currentTotalDiff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')
              }`}>
                {formatCurrency(currentTotalDiff, { showSign: true })}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate mt-0.5">
                {isExpense 
                  ? (currentTotalDiff >= 0 ? 'Disponibile da spendere' : 'Sforamento stimato')
                  : (currentTotalDiff >= 0 ? 'Obiettivo raggiunto' : 'Ancora da incassare')
                }
              </span>
            </div>
          </div>

      {/* Overall Progress Bar */}
      <div className={`bg-white dark:bg-[#1C1C1E] border ${
        isOverallOver
          ? 'border-rose-500/50 dark:border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.12)]'
          : 'border-slate-200/80 dark:border-white/5'
      } rounded-2xl p-4 sm:p-5 shadow-xs transition-all`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span>{isExpense ? 'Avanzamento Globale Spese' : 'Raggiungimento Target Entrate'}</span>
            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border ${currentStatus.badgeBg} ${currentStatus.badgeText} ${currentStatus.badgeBorder} flex items-center gap-1.5 ${
              isOverallOver ? 'animate-pulse ring-1 ring-rose-500/40' : ''
            }`}>
              {isOverallOver && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-80"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-600"></span>
                </span>
              )}
              {overallPercentage}% • {currentStatus.label}
            </span>
          </div>
          <span className="text-slate-500 dark:text-slate-400 font-numeric tabular-nums text-xs">
            {formatCurrency(currentTotalPrevisione)} / {currentTotalBudget > 0 ? formatCurrency(currentTotalBudget) : 'Nessun target'}
          </span>
        </div>

        <div className="w-full h-3 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden flex shadow-inner">
          {/* Barra Reale */}
          <div
            className={`h-full transition-all duration-500 rounded-full bg-gradient-to-r ${currentStatus.gradientClass} ${
              isOverallOver ? 'shadow-[0_0_12px_rgba(239,68,68,0.8)] animate-pulse' : ''
            }`}
            style={{ width: `${Math.min(overallRealePercentage, 100)}%` }}
            title={`Speso reale ad oggi: ${formatCurrency(currentTotalReale)} (${overallRealePercentage}%)`}
          />
          {/* Barra In Programma (tratteggiata) */}
          {currentTotalPianificato > 0 && currentTotalBudget > 0 && (
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${Math.max(0, Math.min(overallPercentage, 100) - Math.min(overallRealePercentage, 100))}%`,
                background: isExpense
                  ? isOverallOver
                    ? 'repeating-linear-gradient(45deg, #f43f5e, #f43f5e 4px, rgba(244, 63, 94, 0.35) 4px, rgba(244, 63, 94, 0.35) 8px)'
                    : 'repeating-linear-gradient(45deg, #f59e0b, #f59e0b 4px, rgba(245, 158, 11, 0.35) 4px, rgba(245, 158, 11, 0.35) 8px)'
                  : 'repeating-linear-gradient(45deg, #10b981, #10b981 4px, rgba(16, 185, 129, 0.35) 4px, rgba(16, 185, 129, 0.35) 8px)'
              }}
              title={`In programma: +${formatCurrency(currentTotalPianificato)} (totale previsto ${overallPercentage}%)`}
            />
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-end gap-x-3.5 gap-y-1 mt-2.5 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
          {isExpense ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>&lt; 50% Ottimale</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-lime-500" />
                <span>50% - 69% Moderato</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>70% - 84% Attenzione</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                <span>85% - 99% In esaurimento</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>100% Allineato</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>&gt; 100% Sforamento</span>
              </div>
              <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200 dark:border-white/10">
                <span
                  className="w-3.5 h-2 rounded-xs border border-amber-500/40 shrink-0"
                  style={{
                    background: 'repeating-linear-gradient(45deg, #f59e0b, #f59e0b 2px, rgba(245, 158, 11, 0.35) 2px, rgba(245, 158, 11, 0.35) 5px)'
                  }}
                />
                <span>Tratteggio: In programma</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>&lt; 70% In corso</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-lime-500" />
                <span>70% - 99% A buon punto</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>≥ 100% Target Raggiunto</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Category Groups Breakdown - Tre per riga su schermi medi/grandi */}
      {categoryGroups.length === 0 ? (
        <div className="bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 rounded-2xl p-8 text-center">
          <p className="text-sm text-slate-500 dark:text-[#8E8E93] mb-3">
            Nessun budget o transazione presente per {isExpense ? 'le uscite' : 'le entrate'} in questo mese.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#E31B23] text-white text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Aggiungi il primo budget</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5 lg:gap-4 items-start">
          {categoryGroups.map(category => {
            const hasCatBudget = category.budget > 0;
            const isOverCat = isExpense && hasCatBudget && category.differenza < 0;
            const isNearCat = isExpense && hasCatBudget && category.differenza >= 0 && category.percentuale >= 85 && category.percentuale < 100;
            const catStatus = isExpense 
              ? getSpendStatus(category.percentuale, hasCatBudget, category.differenza < 0)
              : getIncomeStatus(category.percentuale, hasCatBudget);

            return (
              <div
                key={category.categoryName}
                onClick={() => setSelectedDetailCategory(category)}
                className={`bg-white dark:bg-[#222428] border ${
                  isOverCat
                    ? 'border-rose-500/50 ring-1 ring-rose-500/30 shadow-[0_0_16px_rgba(244,63,94,0.12)]'
                    : isNearCat
                    ? 'border-orange-500/30'
                    : 'border-slate-200/80 dark:border-[#2F3136]'
                } rounded-3xl p-4 cursor-pointer hover:scale-[1.01] hover:brightness-105 active:scale-99 transition-all shadow-sm flex flex-col space-y-3`}
              >
                {/* Top Row: Icon + Name on Left | Residuo + Detail Indicator on Right */}
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative w-9 h-9 rounded-2xl bg-slate-100 dark:bg-[#2A2C31] flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-[#3A3D45]/60">
                      <CategoryIcon name={category.iconName} color={category.color} size={18} />
                      {isOverCat && (
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-80"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600 border border-white dark:border-[#222428]"></span>
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#EAEBED] truncate leading-tight">
                        {category.categoryName}
                      </h3>
                      <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-[#9A9DA5] block leading-tight mt-0.5">
                        {category.items.length} {category.items.length === 1 ? 'sottocategoria' : 'sottocategorie'}
                      </span>
                    </div>
                  </div>

                  {/* Category Residuo & Detail Arrow Indicator */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <span className="text-slate-400 dark:text-[#9A9DA5] block text-[9px] font-medium leading-none mb-1">
                        {isExpense ? 'Residuo' : 'Differenza'}
                      </span>
                      <span className={`font-numeric tabular-nums text-xs sm:text-sm font-bold leading-none ${
                        category.differenza >= 0 
                          ? 'text-[#10b981]' 
                          : 'text-rose-500 animate-pulse'
                      }`}>
                        {formatCurrency(category.differenza, { showSign: true })}
                      </span>
                    </div>

                    <div className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#2A2C31] dark:hover:bg-[#32353B] border border-slate-200/80 dark:border-[#2F3136] text-slate-500 dark:text-[#9A9DA5] shrink-0 transition-colors">
                      <ArrowUpRight size={13} className="text-[#E31B23]" />
                    </div>
                  </div>
                </div>

                {/* Second Row: Badges & Target Summary */}
                <div className="flex items-center justify-between gap-x-2 gap-y-1 text-xs pt-0.5 flex-wrap">
                  <div className="flex items-center gap-1 flex-wrap shrink-0">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${catStatus.badgeBg} ${catStatus.badgeText} ${catStatus.badgeBorder}`}>
                      {category.percentuale}%
                    </span>
                    {isOverCat && (
                      <span className="px-1 py-0.5 rounded text-[8.5px] font-bold whitespace-nowrap bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-300 dark:border-rose-800 flex items-center gap-0.5 animate-pulse">
                        <AlertCircle size={8} className="shrink-0" />
                        Sforato
                      </span>
                    )}
                    {isNearCat && (
                      <span className="px-1 py-0.5 rounded text-[8.5px] font-bold whitespace-nowrap bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400 border border-orange-300 dark:border-orange-800 flex items-center gap-0.5">
                        In esaurimento
                      </span>
                    )}
                  </div>

                  <div className="text-[10px] sm:text-[11px] font-numeric tabular-nums text-slate-500 dark:text-[#9A9DA5] text-right truncate">
                    <span>Prev: </span>
                    <strong className="text-slate-800 dark:text-[#EAEBED]">{formatCurrency(category.previsione)}</strong>
                    <span className="text-slate-400 dark:text-[#9A9DA5]/60 mx-1">/</span>
                    <span>Target: </span>
                    <strong className="text-slate-800 dark:text-[#EAEBED]">{hasCatBudget ? formatCurrency(category.budget) : '—'}</strong>
                  </div>
                </div>

                {/* Third Row: Progress Bar of Category */}
                <div className="pt-0.5">
                  <BudgetProgressBar
                    reale={category.reale}
                    pianificato={category.pianificato}
                    budget={category.budget}
                    size="md"
                    showDetails={false}
                    isIncome={!isExpense}
                  />
                  <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-[#9A9DA5] pt-1.5 font-numeric">
                    <span className="truncate mr-2">
                      {isExpense ? (
                        category.reale === 0 && category.pianificato > 0 ? (
                          <>In programma: <strong className="text-amber-500 font-semibold">{formatCurrency(category.pianificato)}</strong></>
                        ) : (
                          <>Speso: <strong className="text-slate-800 dark:text-[#EAEBED] font-semibold">{formatCurrency(category.reale)}</strong>{category.pianificato > 0 ? ` (+${formatCurrency(category.pianificato)} p.)` : ''}</>
                        )
                      ) : (
                        <>Incassato: <strong className="text-slate-800 dark:text-[#EAEBED] font-semibold">{formatCurrency(category.reale)}</strong></>
                      )}
                    </span>
                    <span className="font-semibold text-slate-500 dark:text-[#9A9DA5] shrink-0">
                      {catStatus.label}
                    </span>
                  </div>
                </div>

                {/* Subcategory Chips Preview (visibile direttamente nelle card anche su smartphone) */}
                <div className="pt-2 border-t border-slate-100 dark:border-[#2F3136] flex flex-wrap items-center gap-1.5">
                  {category.items.map(subItem => (
                    <span
                      key={subItem.sottocategoria_id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSubIdMovements(subItem.sottocategoria_id);
                        setSelectedSubNameMovements(subItem.sottocategoria_nome);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-slate-100/90 dark:bg-[#2A2C31] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200/80 dark:border-[#3A3D45] text-[10px] font-semibold text-slate-700 dark:text-[#EAEBED] hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                      title={`Clicca per vedere i movimenti di ${subItem.sottocategoria_nome}`}
                    >
                      <CategoryIcon name={subItem.icon_name} color={subItem.colore} size={11} />
                      <span className="truncate max-w-[110px]">{subItem.sottocategoria_nome}</span>
                      <span className="font-numeric text-[9.5px] opacity-75">
                        ({subItem.budget > 0 ? formatCurrency(subItem.budget) : formatCurrency(subItem.reale)})
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {/* Modal Aggiungi Nuovo Budget */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-md p-5 shadow-xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-[#F5F5F7]">
                Aggiungi Budget per {isExpense ? 'Spese' : 'Entrate'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateNewBudget} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Sottocategoria
                </label>
                <select
                  value={newBudgetSubId}
                  onChange={e => setNewBudgetSubId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#2A2A2E] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#E31B23]"
                >
                  <option value="">Seleziona una categoria...</option>
                  {availableSubcategoriesToAdd.map(sub => (
                    <option key={sub.id} value={sub.id}>
                      {sub.categoria_padre} → {sub.nome}
                    </option>
                  ))}
                </select>
                {availableSubcategoriesToAdd.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    Tutte le sottocategorie hanno già un budget impostato in questo mese.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Importo Budget Mensile (€)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">€</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newBudgetAmount}
                    onChange={e => setNewBudgetAmount(e.target.value)}
                    placeholder="Es. 250,00"
                    required
                    className="w-full pl-8 pr-3 py-2 text-sm font-numeric tabular-nums font-semibold bg-slate-50 dark:bg-[#2A2A2E] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[#E31B23]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={!newBudgetSubId || !newBudgetAmount}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#E31B23] hover:bg-[#c9171e] disabled:opacity-50 rounded-xl transition-colors shadow-xs"
                >
                  Salva Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Simulatore Risparmio 6 & 12 Mesi */}
      <SavingsSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        selectedMonthName={getFinancialPeriodInfo(selectedMonth).monthName}
        items={data.items}
        allSubcategories={allSubcategories}
        defaultTotalIncome={data.totalePrevisioneEntrate > 0 ? data.totalePrevisioneEntrate : (data.totaleBudgetEntrate > 0 ? data.totaleBudgetEntrate : data.totaleRealeEntrate)}
        defaultTotalExpenses={data.totalePrevisione > 0 ? data.totalePrevisione : (data.totaleBudget > 0 ? data.totaleBudget : data.totaleReale)}
      />

      {/* Category Detail Modal Window ("Finestra più grande con tutta la situazione") */}
      {activeDetailCategory && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-[#18191B]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`bg-white dark:bg-[#222428] border border-slate-200 dark:border-[#2F3136] rounded-3xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 transition-all duration-300 ${selectedSubIdMovements ? 'max-w-5xl' : 'max-w-2xl'}`}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#2F3136] pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-[#2A2C31] flex items-center justify-center text-slate-900 dark:text-[#EAEBED] border border-slate-200/60 dark:border-[#3A3D45]/60">
                  <CategoryIcon name={activeDetailCategory.iconName} color={activeDetailCategory.color} size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-[#EAEBED]">
                    {activeDetailCategory.categoryName}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#9A9DA5]">
                    Situazione di dettaglio • {activeDetailCategory.items.length} {activeDetailCategory.items.length === 1 ? 'sottocategoria' : 'sottocategorie'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedDetailCategory(null);
                  setSelectedSubIdMovements(null);
                  setSelectedSubNameMovements(null);
                }}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#2A2C31] dark:hover:bg-[#32353B] border border-slate-200 dark:border-[#2F3136] text-slate-500 dark:text-[#9A9DA5] hover:text-slate-900 dark:hover:text-[#EAEBED] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Split Layout Body */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 gap-6">
              
              {/* Left Column (Stats & Subcategories) */}
              <div className={`flex-1 flex flex-col overflow-y-auto no-scrollbar py-4 space-y-6 ${selectedSubIdMovements ? 'lg:flex-1 lg:pr-6 lg:border-r lg:border-slate-200 lg:dark:border-[#2F3136]' : 'w-full'}`}>
                {/* Macro stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 dark:bg-[#18191B]/50 border border-slate-200 dark:border-[#2F3136] rounded-2xl p-3">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-[#9A9DA5] uppercase tracking-wider block mb-1">Budget Target</span>
                    <span className="font-numeric tabular-nums text-base font-bold text-slate-900 dark:text-[#EAEBED] block">
                      {activeDetailCategory.budget > 0 ? formatCurrency(activeDetailCategory.budget) : 'Senza Target'}
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-[#18191B]/50 border border-slate-200 dark:border-[#2F3136] rounded-2xl p-3">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-[#9A9DA5] uppercase tracking-wider block mb-1">Speso/Incassato Reale</span>
                    <span className="font-numeric tabular-nums text-base font-bold text-slate-900 dark:text-[#EAEBED] block">
                      {formatCurrency(activeDetailCategory.reale)}
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-[#18191B]/50 border border-slate-200 dark:border-[#2F3136] rounded-2xl p-3">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-[#9A9DA5] uppercase tracking-wider block mb-1">In Programma</span>
                    <span className="font-numeric tabular-nums text-base font-bold text-amber-500 block">
                      {formatCurrency(activeDetailCategory.pianificato)}
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-[#18191B]/50 border border-slate-200 dark:border-[#2F3136] rounded-2xl p-3">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-[#9A9DA5] uppercase tracking-wider block mb-1">
                      {isExpense ? 'Margine Residuo' : 'Differenza'}
                    </span>
                    <span className={`font-numeric tabular-nums text-base font-bold block ${
                      activeDetailCategory.differenza >= 0 ? 'text-[#10b981]' : 'text-rose-500 animate-pulse'
                    }`}>
                      {formatCurrency(activeDetailCategory.differenza, { showSign: true })}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="bg-slate-50 dark:bg-[#18191B]/40 border border-slate-200 dark:border-[#2F3136]/60 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#9A9DA5]">
                    <span className="font-semibold">Progresso Categoria</span>
                    <span className="font-bold text-slate-900 dark:text-[#EAEBED] font-mono">{activeDetailCategory.percentuale}%</span>
                  </div>
                  <BudgetProgressBar
                    reale={activeDetailCategory.reale}
                    pianificato={activeDetailCategory.pianificato}
                    budget={activeDetailCategory.budget}
                    size="md"
                    showDetails={false}
                    isIncome={!isExpense}
                  />
                </div>

                {/* Subcategories title */}
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-[#9A9DA5] uppercase tracking-wider">
                    Dettaglio Sottocategorie
                  </span>
                  <div className="h-[1px] bg-slate-200 dark:bg-[#2F3136] flex-1" />
                </div>

                {/* List of subcategories inside modal */}
                <div className="border border-slate-200 dark:border-[#2F3136] rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-[#2F3136] bg-slate-50/50 dark:bg-[#18191B]/20">
                  {[...activeDetailCategory.items]
                    .sort((a, b) => b.reale - a.reale)
                    .map(item => {
                    const isEditing = editingSubId === item.sottocategoria_id;
                    const hasSubBudget = item.budget > 0;
                    const isOverSub = isExpense && hasSubBudget && item.differenza < 0;
                    const subStatus = isExpense
                      ? getSpendStatus(item.percentuale, hasSubBudget, item.differenza < 0)
                      : getIncomeStatus(item.percentuale, hasSubBudget);

                    return (
                      <div
                        key={item.sottocategoria_id}
                        className="p-3 sm:p-4 hover:bg-slate-100/50 dark:hover:bg-[#2A2C31]/40 transition-colors flex flex-col gap-2.5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Left Side */}
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-slate-100 dark:bg-[#2A2C31]">
                              <CategoryIcon name={item.icon_name} color={item.colore} size={16} />
                              {isOverSub && (
                                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-80"></span>
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600 border border-white dark:border-[#222428]"></span>
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#EAEBED] truncate">
                                  {item.sottocategoria_nome}
                                </h4>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${subStatus.badgeBg} ${subStatus.badgeText} ${subStatus.badgeBorder}`}>
                                  {hasSubBudget ? `${item.percentuale}%` : 'Senza Budget'}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-slate-500 dark:text-[#9A9DA5] font-numeric mt-1">
                                {isExpense ? (
                                  <>
                                    <span>Speso: <strong className="text-slate-800 dark:text-[#EAEBED] font-semibold">{formatCurrency(item.reale)}</strong></span>
                                    <span className="text-slate-300 dark:text-slate-700/60">•</span>
                                    <span>In programma: <strong className="text-amber-500 font-semibold">{formatCurrency(item.pianificato)}</strong></span>
                                    <span className="text-slate-300 dark:text-slate-700/60">•</span>
                                    <span>Previsione: <strong className="text-slate-700 dark:text-[#F5F5F7] font-semibold">{formatCurrency(item.previsione)}</strong></span>
                                  </>
                                ) : (
                                  <>
                                    <span>Incassato: <strong className="text-slate-800 dark:text-[#EAEBED] font-semibold">{formatCurrency(item.reale)}</strong></span>
                                    <span className="text-slate-300 dark:text-slate-700/60">•</span>
                                    <span>In programma: <strong className="text-emerald-500 font-semibold">{formatCurrency(item.pianificato)}</strong></span>
                                    <span className="text-slate-300 dark:text-slate-700/60">•</span>
                                    <span>Previsione: <strong className="text-slate-700 dark:text-[#F5F5F7] font-semibold">{formatCurrency(item.previsione)}</strong></span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right Side (Budget info / Inline Edit) */}
                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            {isEditing ? (
                              <div className="flex items-center gap-1.5">
                                <div className="relative">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-[#9A9DA5]">€</span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={editBudgetAmount}
                                    onChange={e => setEditBudgetAmount(e.target.value)}
                                    placeholder="0"
                                    autoFocus
                                    onFocus={(e) => e.target.select()}
                                    className="w-24 pl-5 pr-2 py-1.5 text-xs font-numeric font-semibold bg-white dark:bg-[#2A2C31] text-slate-900 dark:text-[#EAEBED] border border-[#E31B23] rounded-xl outline-none"
                                  />
                                </div>
                                <button
                                  onClick={() => handleSaveBudget(item.sottocategoria_id)}
                                  className="p-1.5 bg-[#E31B23] text-white rounded-lg hover:bg-[#c9171e] transition-colors cursor-pointer"
                                  title="Salva"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => setEditingSubId(null)}
                                  className="p-1.5 bg-slate-100 dark:bg-[#2A2C31] text-slate-500 dark:text-[#9A9DA5] rounded-lg hover:bg-slate-200 dark:hover:bg-[#32353B] transition-colors cursor-pointer"
                                  title="Annulla"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setEditingSubId(item.sottocategoria_id);
                                    setEditBudgetAmount(hasSubBudget ? item.budget.toString() : '');
                                  }}
                                  className="py-1.5 px-3 rounded-xl border border-slate-200 dark:border-[#2F3136] hover:border-[#E31B23] hover:bg-[#E31B23]/10 text-slate-700 dark:text-[#EAEBED] text-xs font-bold flex items-center justify-center gap-1.5 transition-all bg-slate-50 dark:bg-[#2A2C31] cursor-pointer"
                                >
                                  <Edit2 size={11} className="text-slate-400 dark:text-[#9A9DA5]" />
                                  <span className="font-numeric">
                                    {hasSubBudget ? formatCurrency(item.budget) : 'Imposta'}
                                  </span>
                                </button>

                                {/* Zap button to instantly align budget with forecast amount */}
                                <button
                                  onClick={() => handleAlignBudgetToForecast(item.sottocategoria_id, item.previsione)}
                                  className={`w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-[#2A2C31] border border-slate-200 dark:border-[#2F3136] transition-colors cursor-pointer ${
                                    item.budget === item.previsione
                                      ? 'text-emerald-500 hover:bg-emerald-500/10 border-emerald-500/30'
                                      : 'text-amber-500 hover:text-[#E31B23] hover:bg-amber-500/10 hover:border-amber-500/30'
                                  }`}
                                  title="Pareggia budget alla spesa reale + programmata (Azzera scostamento)"
                                >
                                  <Zap size={13} className={item.budget !== item.previsione ? "animate-pulse" : ""} />
                                </button>

                                {hasSubBudget && (
                                  <button
                                    onClick={() => handleDeleteBudget(item.sottocategoria_id)}
                                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-[#2A2C31] text-slate-400 dark:text-[#9A9DA5] hover:text-rose-500 hover:bg-rose-500/10 border border-slate-200 dark:border-[#2F3136] transition-colors cursor-pointer"
                                    title="Rimuovi budget"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (selectedSubIdMovements === item.sottocategoria_id) {
                                      setSelectedSubIdMovements(null);
                                      setSelectedSubNameMovements(null);
                                    } else {
                                      setSelectedSubIdMovements(item.sottocategoria_id);
                                      setSelectedSubNameMovements(item.sottocategoria_nome);
                                    }
                                  }}
                                  className={`w-8 h-8 flex items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                                    selectedSubIdMovements === item.sottocategoria_id
                                      ? 'bg-[#E31B23]/15 border-[#E31B23]/30 text-[#E31B23]'
                                      : 'bg-slate-50 dark:bg-[#2A2C31] text-slate-400 dark:text-[#9A9DA5] hover:text-[#E31B23] hover:bg-[#E31B23]/10 border-slate-200 dark:border-[#2F3136]'
                                  }`}
                                  title="Vedi movimenti qui"
                                >
                                  <ListFilter size={13} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Thin progress bar underneath */}
                        {hasSubBudget && (
                          <div className="w-full h-1 bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ease-out ${
                                isOverSub
                                  ? 'bg-[#E31B23]'
                                  : isExpense
                                  ? 'bg-emerald-500'
                                  : 'bg-indigo-500'
                              }`}
                              style={{ width: `${Math.min(100, item.percentuale)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column (Direct inline movements list) */}
              {selectedSubIdMovements && (
                <div className="w-full lg:w-[380px] lg:flex-shrink-0 flex flex-col h-full overflow-hidden py-4 border-t lg:border-t-0 border-slate-200 dark:border-[#2F3136]">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-[#2F3136] shrink-0">
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#EAEBED] truncate">
                        Movimenti: {selectedSubNameMovements}
                      </h4>
                      <p className="text-[10.5px] text-slate-500 dark:text-[#9A9DA5]">
                        {subMovements.length + subPlanned.length} record in questo mese
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubIdMovements(null);
                        setSelectedSubNameMovements(null);
                      }}
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#2A2C31] dark:hover:bg-[#32353B] text-slate-500 dark:text-[#9A9DA5] flex items-center justify-center transition-colors cursor-pointer"
                      title="Chiudi movimenti"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Scrollable movements list */}
                  <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pr-1">
                    {isLoadingMovements ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400 dark:text-[#9A9DA5]">
                        <div className="w-5 h-5 border-2 border-[#E31B23] border-t-transparent rounded-full animate-spin" />
                        <span className="text-[11px]">Caricamento...</span>
                      </div>
                    ) : subMovements.length === 0 && subPlanned.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 dark:text-[#9A9DA5] flex flex-col items-center gap-2">
                        <Activity size={24} className="opacity-40 text-slate-400" />
                        <span className="text-xs font-semibold">Nessun movimento trovato per questo mese.</span>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* 1. Planned / Pending section */}
                        {subPlanned.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-[10px] font-bold text-amber-500 tracking-wider uppercase block px-1">In Programma</span>
                            {subPlanned.map(p => (
                              <div
                                key={p.id}
                                className="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-3 flex items-center justify-between gap-3"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <Clock size={12} className="text-amber-500 shrink-0" />
                                    <h5 className="text-xs font-bold text-slate-800 dark:text-[#EAEBED] truncate">{p.descrizione}</h5>
                                  </div>
                                  <div className="text-[10.5px] text-slate-500 dark:text-[#9A9DA5] mt-1 font-numeric">
                                    Previsione: {formatDMY(p.data_prevista)}
                                  </div>
                                  {p.note && (
                                    <p className="text-[9.5px] italic text-slate-400 dark:text-[#9A9DA5]/70 mt-0.5 truncate">{p.note}</p>
                                  )}
                                </div>
                                <div className="shrink-0 text-right">
                                  <span className="font-numeric font-bold text-xs text-amber-500 block">
                                    {formatCurrency(p.importo)}
                                  </span>
                                  <span className="text-[8px] uppercase tracking-wider font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1 py-0.5 rounded">
                                    Pendente
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 2. Real movements section */}
                        {subMovements.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-[#9A9DA5] tracking-wider uppercase block px-1">Effettuati</span>
                            {subMovements.map(m => (
                              <div
                                key={m.id}
                                className="bg-slate-50/50 dark:bg-[#1C1E22] border border-slate-100 dark:border-[#2F3136]/50 rounded-2xl p-3 flex items-center justify-between gap-3"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <FileText size={12} className="text-slate-400 dark:text-[#9A9DA5] shrink-0" />
                                    <h5 className="text-xs font-bold text-slate-800 dark:text-[#EAEBED] truncate">{m.descrizione}</h5>
                                  </div>
                                  <div className="text-[10.5px] text-slate-500 dark:text-[#9A9DA5] mt-1 font-numeric">
                                    Data: {formatDMY(m.data)}
                                  </div>
                                  {m.note && (
                                    <p className="text-[9.5px] italic text-slate-400 dark:text-[#9A9DA5]/70 mt-0.5 truncate">{m.note}</p>
                                  )}
                                </div>
                                <div className="shrink-0 text-right">
                                  <span className={`font-numeric font-bold text-xs block ${
                                    m.tipologia === 'ENTRATA' ? 'text-emerald-500' : 'text-slate-800 dark:text-[#EAEBED]'
                                  }`}>
                                    {m.tipologia === 'ENTRATA' ? '+' : '-'}{formatCurrency(m.importo)}
                                  </span>
                                  <span className="text-[8.5px] font-mono font-medium text-slate-400 dark:text-[#9A9DA5]">
                                    {m.origine_dati}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Footer / Close action */}
            <div className="border-t border-slate-100 dark:border-[#2F3136] pt-4 flex justify-end shrink-0">
              <button
                onClick={() => {
                  setSelectedDetailCategory(null);
                  setSelectedSubIdMovements(null);
                  setSelectedSubNameMovements(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-[#E31B23] hover:bg-[#c9171e] text-white text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-md"
              >
                Chiudi Dettaglio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
