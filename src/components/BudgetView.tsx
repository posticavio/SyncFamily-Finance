import React, { useState, useEffect, useMemo } from 'react';
import { BudgetPerformanceItem, MovementType, Subcategory } from '../types';
import { BudgetService } from '../services/BudgetService';
import { CategoryService } from '../services/CategoryService';
import { formatCurrency, getMonthName } from '../utils/formatters';
import { CategoryIcon } from './CategoryIcon';
import { TabHeaderInfo } from './TabHeaderInfo';
import { BudgetProgressBar, getSpendStatus, getIncomeStatus } from './BudgetProgressBar';
import { BudgetDetailedAnalysis } from './BudgetDetailedAnalysis';
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
  ListFilter
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

  // Modale Aggiungi Budget
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newBudgetSubId, setNewBudgetSubId] = useState<string>('');
  const [newBudgetAmount, setNewBudgetAmount] = useState<string>('');

  // Modalità Vista: Panoramica classica o Analisi Dettagliata & Proiezioni
  const [viewMode, setViewMode] = useState<'OVERVIEW' | 'DETAILED_ANALYSIS'>('OVERVIEW');

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
    const result = await BudgetService.getDetailedPerformance(selectedMonth);
    setData(result);
    const subs = await CategoryService.getAllSubcategories();
    setAllSubcategories(subs.filter(s => s.tipo !== 'GIROCONTO' && s.attiva));
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
    const filteredItems = data.items.filter(item => item.tipo === activeTab);
    const groupsMap = new Map<string, BudgetPerformanceItem[]>();

    filteredItems.forEach(item => {
      const cat = item.categoria_padre || 'Altro';
      if (!groupsMap.has(cat)) {
        groupsMap.set(cat, []);
      }
      groupsMap.get(cat)!.push(item);
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

    // Ordina prima le categorie con budget o con spesa/incasso maggiore
    return groups.sort((a, b) => b.budget - a.budget || b.previsione - a.previsione);
  }, [data.items, activeTab]);

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

        {/* Pulsante Nuovo Budget (Nascosto su smartphone, visibile da tablet/desktop) */}
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="hidden sm:flex bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-medium text-sm px-4 py-2 rounded-xl transition items-center gap-2 shadow-xs active:scale-95 self-start sm:self-auto shrink-0"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>Nuovo Budget</span>
        </button>
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

      {/* View Mode Switcher: Panoramica Categorie vs Analisi Dettagliata & Proiezioni (Nascosto su smartphone view) */}
      <div className="hidden sm:flex bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 rounded-2xl p-2 sm:p-2.5 flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setViewMode('OVERVIEW')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'OVERVIEW'
                ? 'bg-white dark:bg-[#2A2A2E] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LayoutGrid size={15} />
            <span>Panoramica Categorie</span>
          </button>
          <button
            onClick={() => setViewMode('DETAILED_ANALYSIS')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all relative cursor-pointer ${
              viewMode === 'DETAILED_ANALYSIS'
                ? 'bg-white dark:bg-[#2A2A2E] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Activity size={15} className="text-[#E31B23]" />
            <span>Analisi Scostamenti & Proiezioni</span>
            {isExpense && alertCategoriesCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-[#E31B23] text-white text-[10px] font-bold">
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
      ) : (
        <>
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
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>≥ 100% Sforamento</span>
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
            const isExpanded = !!expandedCategories[category.categoryName];
            const hasCatBudget = category.budget > 0;
            const isOverCat = isExpense && hasCatBudget && category.differenza < 0;
            const isNearCat = isExpense && hasCatBudget && category.differenza >= 0 && category.percentuale >= 85;
            const catStatus = isExpense 
              ? getSpendStatus(category.percentuale, hasCatBudget, category.differenza < 0)
              : getIncomeStatus(category.percentuale, hasCatBudget);

            return (
              <div
                key={category.categoryName}
                className={`bg-white dark:bg-[#1C1C1E] border ${
                  isOverCat
                    ? 'border-rose-500/60 dark:border-rose-500/50 ring-1 ring-rose-500/30 shadow-[0_0_16px_rgba(244,63,94,0.12)]'
                    : isNearCat
                    ? 'border-orange-400/50 dark:border-orange-500/30'
                    : 'border-slate-200/80 dark:border-white/5'
                } rounded-2xl overflow-hidden shadow-xs transition-all flex flex-col`}
              >
                {/* Category Header */}
                <div
                  onClick={() => toggleCategoryCollapse(category.categoryName)}
                  className="p-3 sm:p-3.5 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors border-b border-slate-100 dark:border-white/5 space-y-2"
                >
                  {/* Top Row: Icon + Name on Left | Residuo + Chevron on Right */}
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-slate-100 dark:bg-white/10">
                        <CategoryIcon name={category.iconName} color={category.color} size={16} />
                        {isOverCat && (
                          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-80"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600 border border-white dark:border-[#1C1C1E]"></span>
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#F5F5F7] truncate leading-tight">
                          {category.categoryName}
                        </h3>
                        <span className="text-[10px] sm:text-[11px] text-slate-400 dark:text-[#8E8E93] block leading-tight mt-0.5">
                          {category.items.length} {category.items.length === 1 ? 'sottocategoria' : 'sottocategorie'}
                        </span>
                      </div>
                    </div>

                    {/* Category Residuo & Chevron Toggle */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <span className="text-slate-400 dark:text-[#8E8E93] block text-[9px] font-medium leading-none mb-1">
                          {isExpense ? 'Residuo' : 'Differenza'}
                        </span>
                        <span className={`font-numeric tabular-nums text-xs sm:text-sm font-bold leading-none ${
                          category.differenza >= 0 
                            ? 'text-emerald-600 dark:text-emerald-400' 
                            : (isExpense ? 'text-rose-600 dark:text-rose-400 animate-pulse' : 'text-amber-600 dark:text-amber-400')
                        }`}>
                          {formatCurrency(category.differenza, { showSign: true })}
                        </span>
                      </div>

                      <div className="p-1 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 shrink-0">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </div>
                  </div>

                  {/* Second Row: Badges & Target Summary */}
                  <div className="flex items-center justify-between gap-1.5 text-xs pt-0.5">
                    <div className="flex items-center gap-1 flex-nowrap shrink-0">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold whitespace-nowrap border ${catStatus.badgeBg} ${catStatus.badgeText} ${catStatus.badgeBorder}`}>
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

                    <div className="text-[10px] sm:text-[11px] font-numeric tabular-nums text-slate-500 dark:text-slate-400 text-right truncate">
                      <span>Prev: </span>
                      <strong className="text-slate-800 dark:text-slate-200">{formatCurrency(category.previsione)}</strong>
                      <span className="text-slate-400 dark:text-slate-500 mx-1">/</span>
                      <span>Target: </span>
                      <strong className="text-slate-800 dark:text-slate-200">{hasCatBudget ? formatCurrency(category.budget) : '—'}</strong>
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
                    <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 pt-1 font-numeric">
                      <span className="truncate mr-2">
                        {isExpense ? (
                          category.reale === 0 && category.pianificato > 0 ? (
                            <>In programma: <strong className="text-amber-600 dark:text-amber-400 font-semibold">{formatCurrency(category.pianificato)}</strong></>
                          ) : (
                            <>Speso: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{formatCurrency(category.reale)}</strong>{category.pianificato > 0 ? ` (+${formatCurrency(category.pianificato)} p.)` : ''}</>
                          )
                        ) : (
                          <>Incassato: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{formatCurrency(category.reale)}</strong></>
                        )}
                      </span>
                      <span className="font-medium text-slate-500 dark:text-slate-400 shrink-0">
                        {catStatus.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Subcategories List */}
                {isExpanded && (
                  <div className="divide-y divide-slate-100/80 dark:divide-white/5 bg-slate-50/20 dark:bg-black/10">
                    {category.items.map(item => {
                      const isEditing = editingSubId === item.sottocategoria_id;
                      const hasSubBudget = item.budget > 0;
                      const isOverSub = isExpense && hasSubBudget && item.differenza < 0;
                      const subStatus = isExpense
                        ? getSpendStatus(item.percentuale, hasSubBudget, item.differenza < 0)
                        : getIncomeStatus(item.percentuale, hasSubBudget);

                      return (
                        <div
                          key={item.sottocategoria_id}
                          className="p-2.5 sm:px-3 flex items-center justify-between gap-2 hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors"
                        >
                          {/* Subcategory Info (Left, flex-1) */}
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="relative w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-slate-100 dark:bg-white/10">
                              <CategoryIcon name={item.icon_name} color={item.colore} size={14} />
                              {isOverSub && (
                                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-80"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600 border border-white dark:border-[#1C1C1E]"></span>
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1 flex-nowrap">
                                <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {item.sottocategoria_nome}
                                </h4>
                                {isOverSub && (
                                  <span className="px-1 py-0.2 rounded text-[8.5px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-300 dark:border-rose-800 flex items-center gap-0.5 animate-pulse shrink-0 whitespace-nowrap">
                                    +{formatCurrency(Math.abs(item.differenza))}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-numeric tabular-nums block truncate mt-0.5">
                                {isExpense ? (
                                  item.reale === 0 && item.pianificato > 0 ? (
                                    <>
                                      In programma: <strong className="text-amber-600 dark:text-amber-400 font-semibold">{formatCurrency(item.pianificato)}</strong>
                                    </>
                                  ) : (
                                    <>
                                      Speso: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{formatCurrency(item.reale)}</strong>
                                      {item.pianificato > 0 && (
                                        <span className="text-amber-600 dark:text-amber-400 ml-0.5"> (+{formatCurrency(item.pianificato)} p.)</span>
                                      )}
                                    </>
                                  )
                                ) : (
                                  <>
                                    Incassato: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{formatCurrency(item.reale)}</strong>
                                    {item.pianificato > 0 && (
                                      <span className="text-slate-400 dark:text-slate-500 ml-0.5"> (+{formatCurrency(item.pianificato)})</span>
                                    )}
                                  </>
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Subcategory Progress Bar & Percentage Pill (Center, compact) */}
                          <div className="w-18 sm:w-22 shrink-0 flex items-center gap-1.5">
                            <div className="flex-1 min-w-0">
                              <BudgetProgressBar
                                reale={item.reale}
                                pianificato={item.pianificato}
                                budget={item.budget}
                                size="sm"
                                showDetails={false}
                                isIncome={!isExpense}
                              />
                            </div>
                            <span className={`px-1 py-0.2 rounded text-[9px] font-mono font-bold whitespace-nowrap shrink-0 border ${subStatus.badgeBg} ${subStatus.badgeText} ${subStatus.badgeBorder}`}>
                              {hasSubBudget ? `${item.percentuale}%` : '—'}
                            </span>
                          </div>

                          {/* Edit / Set Budget (Right, compact width) */}
                          <div className="w-22 sm:w-24 flex items-center justify-end gap-1 shrink-0">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <div className="relative">
                                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">€</span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={editBudgetAmount}
                                    onChange={e => setEditBudgetAmount(e.target.value)}
                                    placeholder="0"
                                    autoFocus
                                    className="w-14 pl-4 pr-1 py-0.5 text-xs font-numeric tabular-nums font-semibold bg-white dark:bg-[#2A2A2E] text-slate-900 dark:text-white border border-indigo-400 rounded-lg outline-none"
                                  />
                                </div>
                                <button
                                  onClick={() => handleSaveBudget(item.sottocategoria_id)}
                                  className="p-1 bg-[#E31B23] text-white rounded-lg hover:bg-[#c9171e] transition-colors"
                                  title="Salva"
                                >
                                  <Check size={11} />
                                </button>
                                <button
                                  onClick={() => setEditingSubId(null)}
                                  className="p-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-300 transition-colors"
                                  title="Annulla"
                                >
                                  <X size={11} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingSubId(item.sottocategoria_id);
                                    setEditBudgetAmount(hasSubBudget ? item.budget.toString() : '');
                                  }}
                                  className="w-[66px] sm:w-[70px] py-1 px-1 rounded-lg border border-slate-200 dark:border-white/10 hover:border-[#E31B23] hover:bg-red-50/50 dark:hover:bg-red-950/20 text-slate-700 dark:text-slate-300 hover:text-[#E31B23] text-[10px] font-medium flex items-center justify-center gap-0.5 transition-all"
                                  title="Modifica importo budget"
                                >
                                  <Edit2 size={9} className="shrink-0 text-slate-400" />
                                  <span className="font-numeric tabular-nums truncate">
                                    {hasSubBudget ? formatCurrency(item.budget) : 'Imposta'}
                                  </span>
                                </button>
                                {hasSubBudget ? (
                                  <button
                                    onClick={() => handleDeleteBudget(item.sottocategoria_id)}
                                    className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors shrink-0"
                                    title="Rimuovi budget"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                ) : (
                                  <div className="w-6 h-6 shrink-0" />
                                )}

                                {onNavigateToTransactions && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onNavigateToTransactions({
                                        subcategoryId: item.sottocategoria_id,
                                        month: selectedMonth
                                      });
                                    }}
                                    className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors shrink-0"
                                    title="Vedi e isola i movimenti di questa sottocategoria in questo mese (cerca duplicati)"
                                  >
                                    <ListFilter size={11} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
    </div>
  );
};
