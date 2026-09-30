import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Search,
  Filter,
  Check,
  Calendar,
  Layers,
  ArrowUpDown,
  RotateCcw,
  SlidersHorizontal,
  DollarSign,
  Wallet,
  CheckSquare,
  Square,
  Sparkles,
  Link2,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { Movement, Subcategory, Account, Fund, Recurrence, MovementType } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { formatCurrency } from '../utils/formatters';
import { haptics } from '../utils/haptics';

interface MovementLinkSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedIds: string[]) => void;
  allMovements: Movement[];
  initialSelectedIds: string[];
  currentSubcategoryId?: string;
  subcategories: Subcategory[];
  accounts: Account[];
  funds: Fund[];
  recurrenceName?: string;
  targetAmount?: number;
  targetType?: MovementType;
  recurrenceLimitType?: string;
  totalRepetitions?: number;
}

type DateRangePreset = 'ALL' | 'THIS_MONTH' | 'LAST_3_MONTHS' | 'LAST_6_MONTHS' | 'THIS_YEAR' | 'LAST_YEAR' | 'CUSTOM';
type AmountFilterPreset = 'ALL' | 'EXACT' | 'SIMILAR' | 'CUSTOM';
type SortField = 'DATA_DESC' | 'DATA_ASC' | 'IMPORTO_DESC' | 'IMPORTO_ASC' | 'NOME_ASC';
type SelectionFilter = 'ALL' | 'SELECTED_ONLY' | 'UNSELECTED_ONLY';

export const MovementLinkSelectorModal: React.FC<MovementLinkSelectorModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  allMovements,
  initialSelectedIds,
  currentSubcategoryId,
  subcategories,
  accounts,
  funds,
  recurrenceName = '',
  targetAmount = 0,
  targetType = 'USCITA',
  recurrenceLimitType,
  totalRepetitions
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubcategoryId, setFilterSubcategoryId] = useState<string>(currentSubcategoryId || 'ALL');
  const [onlyCurrentSubcategory, setOnlyCurrentSubcategory] = useState<boolean>(!!currentSubcategoryId);
  const [filterAccountId, setFilterAccountId] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>(targetType || 'ALL');
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [amountPreset, setAmountPreset] = useState<AmountFilterPreset>('ALL');
  const [customMinAmount, setCustomMinAmount] = useState('');
  const [customMaxAmount, setCustomMaxAmount] = useState('');
  const [selectionFilter, setSelectionFilter] = useState<SelectionFilter>('ALL');
  const [sortOption, setSortOption] = useState<SortField>('DATA_DESC');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Sync initial state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(initialSelectedIds);
      if (currentSubcategoryId) {
        setFilterSubcategoryId(currentSubcategoryId);
        setOnlyCurrentSubcategory(true);
      } else {
        setFilterSubcategoryId('ALL');
        setOnlyCurrentSubcategory(false);
      }
      setFilterType(targetType || 'ALL');
    }
  }, [isOpen, initialSelectedIds, currentSubcategoryId, targetType]);

  // Keyboard shortcut: Esc to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const currentSubcategoryObj = useMemo(() => {
    return subcategories.find(s => s.id === currentSubcategoryId);
  }, [subcategories, currentSubcategoryId]);

  // Compute calculated date boundaries for presets
  const dateBoundaries = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (dateRangePreset === 'THIS_MONTH') {
      const start = new Date(y, m, 1).toISOString().split('T')[0];
      const end = new Date(y, m + 1, 0).toISOString().split('T')[0];
      return { start, end };
    }
    if (dateRangePreset === 'LAST_3_MONTHS') {
      const start = new Date(y, m - 2, 1).toISOString().split('T')[0];
      return { start, end: undefined };
    }
    if (dateRangePreset === 'LAST_6_MONTHS') {
      const start = new Date(y, m - 5, 1).toISOString().split('T')[0];
      return { start, end: undefined };
    }
    if (dateRangePreset === 'THIS_YEAR') {
      const start = `${y}-01-01`;
      const end = `${y}-12-31`;
      return { start, end };
    }
    if (dateRangePreset === 'LAST_YEAR') {
      const start = `${y - 1}-01-01`;
      const end = `${y - 1}-12-31`;
      return { start, end };
    }
    if (dateRangePreset === 'CUSTOM') {
      return { start: customStartDate || undefined, end: customEndDate || undefined };
    }
    return { start: undefined, end: undefined };
  }, [dateRangePreset, customStartDate, customEndDate]);

  // Filter and sort movements
  const filteredMovements = useMemo(() => {
    return allMovements
      .filter(mov => {
        // 1. Text Search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchDesc = mov.descrizione?.toLowerCase().includes(q);
          const matchNote = mov.note?.toLowerCase().includes(q);
          const matchImporto = mov.importo?.toString().includes(q);
          const matchDate = mov.data?.includes(q) || mov.data?.split('-').reverse().join('/').includes(q);
          const matchId = mov.movimento_id?.toLowerCase().includes(q);
          const subObj = subcategories.find(s => s.id === mov.sottocategoria_id);
          const matchSub = subObj?.nome?.toLowerCase().includes(q) || subObj?.categoria_padre?.toLowerCase().includes(q);

          if (!matchDesc && !matchNote && !matchImporto && !matchDate && !matchId && !matchSub) {
            return false;
          }
        }

        // 2. Subcategory Filter
        if (onlyCurrentSubcategory && currentSubcategoryId) {
          if (mov.sottocategoria_id !== currentSubcategoryId) return false;
        } else if (filterSubcategoryId !== 'ALL') {
          if (mov.sottocategoria_id !== filterSubcategoryId) return false;
        }

        // 3. Conto / Fondo Filter
        if (filterAccountId !== 'ALL') {
          if (mov.conto_origine !== filterAccountId && mov.conto_destinazione !== filterAccountId) {
            return false;
          }
        }

        // 4. Movement Type Filter
        if (filterType !== 'ALL') {
          if (mov.tipologia !== filterType) return false;
        }

        // 5. Date Filter
        if (dateBoundaries.start && mov.data < dateBoundaries.start) return false;
        if (dateBoundaries.end && mov.data > dateBoundaries.end) return false;

        // 6. Amount Filter
        if (amountPreset === 'EXACT' && targetAmount > 0) {
          if (Math.abs(mov.importo - targetAmount) > 0.01) return false;
        } else if (amountPreset === 'SIMILAR' && targetAmount > 0) {
          const min = targetAmount * 0.85;
          const max = targetAmount * 1.15;
          if (mov.importo < min || mov.importo > max) return false;
        } else if (amountPreset === 'CUSTOM') {
          const min = customMinAmount ? parseFloat(customMinAmount.replace(',', '.')) : null;
          const max = customMaxAmount ? parseFloat(customMaxAmount.replace(',', '.')) : null;
          if (min !== null && !isNaN(min) && mov.importo < min) return false;
          if (max !== null && !isNaN(max) && mov.importo > max) return false;
        }

        // 7. Selection Status Filter
        const isSelected = selectedIds.includes(mov.id);
        if (selectionFilter === 'SELECTED_ONLY' && !isSelected) return false;
        if (selectionFilter === 'UNSELECTED_ONLY' && isSelected) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortOption === 'DATA_DESC') {
          if (b.data !== a.data) return b.data.localeCompare(a.data);
          return (b.created_at || '').localeCompare(a.created_at || '');
        }
        if (sortOption === 'DATA_ASC') {
          if (a.data !== b.data) return a.data.localeCompare(b.data);
          return (a.created_at || '').localeCompare(b.created_at || '');
        }
        if (sortOption === 'IMPORTO_DESC') {
          return b.importo - a.importo;
        }
        if (sortOption === 'IMPORTO_ASC') {
          return a.importo - b.importo;
        }
        if (sortOption === 'NOME_ASC') {
          return a.descrizione.localeCompare(b.descrizione);
        }
        return 0;
      });
  }, [
    allMovements,
    searchQuery,
    onlyCurrentSubcategory,
    currentSubcategoryId,
    filterSubcategoryId,
    filterAccountId,
    filterType,
    dateBoundaries,
    amountPreset,
    targetAmount,
    customMinAmount,
    customMaxAmount,
    selectionFilter,
    sortOption,
    selectedIds,
    subcategories
  ]);

  // Selection toggle
  const handleToggleRow = (movId: string) => {
    haptics.tap();
    setSelectedIds(prev =>
      prev.includes(movId) ? prev.filter(id => id !== movId) : [...prev, movId]
    );
  };

  // Batch selections
  const handleSelectAllFiltered = () => {
    haptics.tap();
    const idsToAdd = filteredMovements.map(m => m.id);
    setSelectedIds(prev => Array.from(new Set([...prev, ...idsToAdd])));
  };

  const handleDeselectAllFiltered = () => {
    haptics.tap();
    const idsToRemove = new Set(filteredMovements.map(m => m.id));
    setSelectedIds(prev => prev.filter(id => !idsToRemove.has(id)));
  };

  const handleClearAllSelections = () => {
    haptics.tap();
    setSelectedIds([]);
  };

  const handleResetFilters = () => {
    haptics.tap();
    setSearchQuery('');
    setFilterSubcategoryId(currentSubcategoryId || 'ALL');
    setOnlyCurrentSubcategory(!!currentSubcategoryId);
    setFilterAccountId('ALL');
    setFilterType(targetType || 'ALL');
    setDateRangePreset('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
    setAmountPreset('ALL');
    setCustomMinAmount('');
    setCustomMaxAmount('');
    setSelectionFilter('ALL');
    setSortOption('DATA_DESC');
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (!onlyCurrentSubcategory && filterSubcategoryId !== 'ALL') count++;
    if (filterAccountId !== 'ALL') count++;
    if (filterType !== 'ALL' && filterType !== targetType) count++;
    if (dateRangePreset !== 'ALL') count++;
    if (amountPreset !== 'ALL') count++;
    if (selectionFilter !== 'ALL') count++;
    return count;
  }, [
    searchQuery,
    onlyCurrentSubcategory,
    filterSubcategoryId,
    filterAccountId,
    filterType,
    targetType,
    dateRangePreset,
    amountPreset,
    selectionFilter
  ]);

  // Financial summary of selected movements
  const { totalSelectedAmount, selectedCount } = useMemo(() => {
    const selectedMovements = allMovements.filter(m => selectedIds.includes(m.id));
    const total = selectedMovements.reduce((acc, m) => acc + m.importo, 0);
    return {
      totalSelectedAmount: total,
      selectedCount: selectedIds.length
    };
  }, [allMovements, selectedIds]);

  const handleConfirmAndClose = () => {
    haptics.impact();
    onConfirm(selectedIds);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/75 backdrop-blur-sm overflow-hidden">
      <div
        className="relative w-full max-w-5xl bg-white dark:bg-[#18191B] text-slate-900 dark:text-[#EAEBED] rounded-3xl border border-slate-200 dark:border-[#2F3136] shadow-2xl flex flex-col h-[94vh] max-h-[94vh] overflow-hidden"
        style={{ fontFamily: "'Google Sans', 'Product Sans', sans-serif" }}
      >
        {/* 1. Header One UI */}
        <div className="px-5 py-4 border-b border-slate-200/80 dark:border-[#2F3136] bg-slate-50 dark:bg-[#1E2024] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#E31B23]/10 dark:bg-[#E31B23]/15 border border-[#E31B23]/25 flex items-center justify-center text-[#E31B23] shrink-0">
              <Link2 size={22} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#EAEBED] truncate">
                  Collega Movimenti alla Ricorrenza
                </h2>
                {recurrenceName && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-[#E31B23]/15 text-[#E31B23] border border-[#E31B23]/30 truncate max-w-[200px]">
                    {recurrenceName}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-[#9A9DA5] truncate">
                Trova e seleziona le transazioni passate già registrate da associare a questa regola
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              haptics.tap();
              onClose();
            }}
            className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-[#2A2C31] hover:bg-slate-200 dark:hover:bg-[#34373D] border border-slate-200/80 dark:border-[#2F3136] text-slate-600 dark:text-[#9A9DA5] hover:text-slate-900 dark:hover:text-[#EAEBED] flex items-center justify-center transition-all cursor-pointer shrink-0"
            title="Chiudi (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* 2. Top Summary KPI Bar */}
        <div className="px-5 py-3 bg-white dark:bg-[#222428] border-b border-slate-200/80 dark:border-[#2F3136] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#18191B] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#2F3136]">
              <span className="text-xs text-slate-500 dark:text-[#9A9DA5] font-medium">Selezionati:</span>
              <span className="text-xs font-bold text-[#E31B23] font-mono tabular-nums">
                {selectedCount}
              </span>
              <span className="text-xs text-slate-400 dark:text-[#6E7179]">|</span>
              <span className="text-xs text-slate-500 dark:text-[#9A9DA5] font-medium">Totale:</span>
              <span className="text-xs font-bold text-slate-900 dark:text-[#EAEBED] font-mono tabular-nums">
                {formatCurrency(totalSelectedAmount)}
              </span>
            </div>

            {recurrenceLimitType === 'TOT_VOLTE' && totalRepetitions && totalRepetitions > 0 && (
              <div className="flex items-center gap-2 bg-amber-500/10 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-xl border border-amber-500/25 text-xs font-medium">
                <Sparkles size={14} className="text-amber-500 shrink-0" />
                <span>
                  Rate coperte: <b>{selectedCount}</b> di <b>{totalRepetitions}</b> (rimanenti:{' '}
                  <b>{Math.max(0, totalRepetitions - selectedCount)}</b>)
                </span>
              </div>
            )}
          </div>

          {/* Quick Selection Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              disabled={filteredMovements.length === 0}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-[#2A2C31] hover:bg-slate-200 dark:hover:bg-[#34373D] text-slate-700 dark:text-[#EAEBED] border border-slate-200 dark:border-[#2F3136] transition-all cursor-pointer disabled:opacity-40"
            >
              Seleziona Filtrati ({filteredMovements.length})
            </button>
            {selectedCount > 0 && (
              <button
                type="button"
                onClick={handleClearAllSelections}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-900/40 transition-all cursor-pointer"
              >
                Deseleziona Tutto
              </button>
            )}
          </div>
        </div>

        {/* 3. Filter Bar (Always visible & responsive) */}
        <div className="p-4 bg-slate-50/70 dark:bg-[#1E2024]/70 border-b border-slate-200/80 dark:border-[#2F3136] space-y-3 shrink-0">
          {/* Row 1: Search, Subcategory Pill, Date Preset chips, Toggle Advanced */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
            {/* Main Search Input */}
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#9A9DA5]"
              />
              <input
                type="text"
                placeholder="Cerca per testo, note, data (es. 24/09), importo (es. 150)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-9 rounded-2xl bg-white dark:bg-[#18191B] border border-slate-200 dark:border-[#2F3136] text-xs font-medium text-slate-900 dark:text-[#EAEBED] placeholder-slate-400 dark:placeholder-[#6E7179] focus:outline-none focus:border-[#E31B23] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Subcategory toggle chip */}
            {currentSubcategoryObj && (
              <button
                type="button"
                onClick={() => {
                  haptics.tap();
                  setOnlyCurrentSubcategory(!onlyCurrentSubcategory);
                }}
                className={`h-10 px-3 rounded-2xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                  onlyCurrentSubcategory
                    ? 'bg-[#E31B23]/10 dark:bg-[#E31B23]/15 text-[#E31B23] border-[#E31B23]/40 shadow-xs'
                    : 'bg-white dark:bg-[#18191B] text-slate-600 dark:text-[#9A9DA5] border-slate-200 dark:border-[#2F3136] hover:border-slate-300'
                }`}
                title="Attiva/disattiva filtro sulla sottocategoria della ricorrenza"
              >
                <div
                  className="w-4 h-4 rounded-md flex items-center justify-center text-white text-[10px]"
                  style={{ backgroundColor: currentSubcategoryObj.colore || '#E31B23' }}
                >
                  <CategoryIcon iconName={currentSubcategoryObj.icon_name} className="w-2.5 h-2.5" />
                </div>
                <span>{currentSubcategoryObj.nome}</span>
                <span className="text-[10px] opacity-75">
                  ({onlyCurrentSubcategory ? 'Solo questa' : 'Tutte'})
                </span>
              </button>
            )}

            {/* Toggle Advanced Filters Button */}
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                setShowAdvancedFilters(!showAdvancedFilters);
              }}
              className={`h-10 px-3.5 rounded-2xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                showAdvancedFilters || activeFiltersCount > 0
                  ? 'bg-[#E31B23]/15 text-[#E31B23] border-[#E31B23]/40'
                  : 'bg-white dark:bg-[#18191B] text-slate-600 dark:text-[#9A9DA5] border-slate-200 dark:border-[#2F3136] hover:bg-slate-100 dark:hover:bg-[#2A2C31]'
              }`}
            >
              <SlidersHorizontal size={14} />
              <span>Filtri</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#E31B23] text-white text-[10px] flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
              {showAdvancedFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-10 px-2.5 rounded-2xl text-xs font-medium text-slate-500 dark:text-[#9A9DA5] hover:text-[#E31B23] hover:bg-red-50 dark:hover:bg-red-950/20 transition-all flex items-center gap-1 cursor-pointer shrink-0"
                title="Azzera tutti i filtri"
              >
                <RotateCcw size={13} />
                <span className="hidden sm:inline">Azzera</span>
              </button>
            )}
          </div>

          {/* Quick Date Presets Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            <span className="text-[11px] font-bold text-slate-400 dark:text-[#9A9DA5] uppercase tracking-wider mr-1 shrink-0">
              Periodo:
            </span>
            {(
              [
                { id: 'ALL', label: 'Tutto' },
                { id: 'THIS_MONTH', label: 'Questo Mese' },
                { id: 'LAST_3_MONTHS', label: 'Ultimi 3 Mesi' },
                { id: 'LAST_6_MONTHS', label: 'Ultimi 6 Mesi' },
                { id: 'THIS_YEAR', label: "Quest'Anno" },
                { id: 'LAST_YEAR', label: 'Anno Scorso' },
                { id: 'CUSTOM', label: 'Personalizzato' }
              ] as const
            ).map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  haptics.tap();
                  setDateRangePreset(preset.id);
                  if (preset.id === 'CUSTOM' && !showAdvancedFilters) {
                    setShowAdvancedFilters(true);
                  }
                }}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  dateRangePreset === preset.id
                    ? 'bg-[#E31B23] text-white shadow-xs'
                    : 'bg-white dark:bg-[#18191B] text-slate-600 dark:text-[#9A9DA5] border border-slate-200 dark:border-[#2F3136] hover:border-slate-300 dark:hover:border-[#3A3D45]'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Expanded Advanced Filters Panel */}
          {showAdvancedFilters && (
            <div className="p-3.5 bg-white dark:bg-[#18191B] rounded-2xl border border-slate-200 dark:border-[#2F3136] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Conto / Fondo Filter */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-slate-500 dark:text-[#9A9DA5] uppercase tracking-wider flex items-center gap-1">
                  <Wallet size={12} />
                  <span>Conto / Fondo</span>
                </label>
                <select
                  value={filterAccountId}
                  onChange={e => setFilterAccountId(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-xl bg-slate-50 dark:bg-[#222428] border border-slate-200 dark:border-[#2F3136] text-xs text-slate-900 dark:text-[#EAEBED] focus:outline-none focus:border-[#E31B23]"
                >
                  <option value="ALL">Tutti i conti e fondi</option>
                  <optgroup label="Conti Correnti">
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.nome_conto}
                      </option>
                    ))}
                  </optgroup>
                  {funds.length > 0 && (
                    <optgroup label="Fondi">
                      {funds.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.nome_fondo}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Sottocategoria (se non bloccata sulla corrente) */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-slate-500 dark:text-[#9A9DA5] uppercase tracking-wider flex items-center gap-1">
                  <Layers size={12} />
                  <span>Sottocategoria</span>
                </label>
                <select
                  disabled={onlyCurrentSubcategory}
                  value={onlyCurrentSubcategory ? currentSubcategoryId : filterSubcategoryId}
                  onChange={e => setFilterSubcategoryId(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-xl bg-slate-50 dark:bg-[#222428] border border-slate-200 dark:border-[#2F3136] text-xs text-slate-900 dark:text-[#EAEBED] focus:outline-none focus:border-[#E31B23] disabled:opacity-50"
                >
                  <option value="ALL">Tutte le sottocategorie</option>
                  {subcategories.map(sub => (
                    <option key={sub.id} value={sub.id}>
                      {sub.nome} ({sub.categoria_padre})
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro Importo */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-slate-500 dark:text-[#9A9DA5] uppercase tracking-wider flex items-center gap-1">
                  <DollarSign size={12} />
                  <span>Filtro Importo</span>
                </label>
                <select
                  value={amountPreset}
                  onChange={e => setAmountPreset(e.target.value as AmountFilterPreset)}
                  className="w-full h-9 px-2.5 rounded-xl bg-slate-50 dark:bg-[#222428] border border-slate-200 dark:border-[#2F3136] text-xs text-slate-900 dark:text-[#EAEBED] focus:outline-none focus:border-[#E31B23]"
                >
                  <option value="ALL">Qualsiasi importo</option>
                  {targetAmount > 0 && (
                    <>
                      <option value="EXACT">Esattamente {formatCurrency(targetAmount)}</option>
                      <option value="SIMILAR">Simile a {formatCurrency(targetAmount)} (±15%)</option>
                    </>
                  )}
                  <option value="CUSTOM">Intervallo Min / Max</option>
                </select>
              </div>

              {/* Stato Selezione & Ordinamento */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-slate-500 dark:text-[#9A9DA5] uppercase tracking-wider flex items-center gap-1">
                  <ArrowUpDown size={12} />
                  <span>Ordinamento & Stato</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    value={selectionFilter}
                    onChange={e => setSelectionFilter(e.target.value as SelectionFilter)}
                    className="w-full h-9 px-2 rounded-xl bg-slate-50 dark:bg-[#222428] border border-slate-200 dark:border-[#2F3136] text-[11px] text-slate-900 dark:text-[#EAEBED] focus:outline-none focus:border-[#E31B23]"
                  >
                    <option value="ALL">Tutti gli stati</option>
                    <option value="SELECTED_ONLY">Solo Selezionati ({selectedCount})</option>
                    <option value="UNSELECTED_ONLY">Non Selezionati</option>
                  </select>
                  <select
                    value={sortOption}
                    onChange={e => setSortOption(e.target.value as SortField)}
                    className="w-full h-9 px-2 rounded-xl bg-slate-50 dark:bg-[#222428] border border-slate-200 dark:border-[#2F3136] text-[11px] text-slate-900 dark:text-[#EAEBED] focus:outline-none focus:border-[#E31B23]"
                  >
                    <option value="DATA_DESC">Data (recente)</option>
                    <option value="DATA_ASC">Data (vecchia)</option>
                    <option value="IMPORTO_DESC">Importo (alto)</option>
                    <option value="IMPORTO_ASC">Importo (basso)</option>
                  </select>
                </div>
              </div>

              {/* Custom Date Inputs if CUSTOM is active */}
              {dateRangePreset === 'CUSTOM' && (
                <div className="sm:col-span-2 md:col-span-2 p-2 rounded-xl bg-slate-50 dark:bg-[#222428] border border-slate-200 dark:border-[#2F3136] grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-[#9A9DA5]">
                      Data Inizio
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={e => setCustomStartDate(e.target.value)}
                      className="w-full h-8 px-2 rounded-lg bg-white dark:bg-[#18191B] border border-slate-200 dark:border-[#2F3136] text-xs text-slate-900 dark:text-[#EAEBED]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-[#9A9DA5]">
                      Data Fine
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={e => setCustomEndDate(e.target.value)}
                      className="w-full h-8 px-2 rounded-lg bg-white dark:bg-[#18191B] border border-slate-200 dark:border-[#2F3136] text-xs text-slate-900 dark:text-[#EAEBED]"
                    />
                  </div>
                </div>
              )}

              {/* Custom Min/Max Amount Inputs if CUSTOM is active */}
              {amountPreset === 'CUSTOM' && (
                <div className="sm:col-span-2 md:col-span-2 p-2 rounded-xl bg-slate-50 dark:bg-[#222428] border border-slate-200 dark:border-[#2F3136] grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-[#9A9DA5]">
                      Importo Minimo (€)
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={customMinAmount}
                      onChange={e => setCustomMinAmount(e.target.value)}
                      className="w-full h-8 px-2 rounded-lg bg-white dark:bg-[#18191B] border border-slate-200 dark:border-[#2F3136] text-xs text-slate-900 dark:text-[#EAEBED]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-[#9A9DA5]">
                      Importo Massimo (€)
                    </label>
                    <input
                      type="number"
                      placeholder="9999"
                      value={customMaxAmount}
                      onChange={e => setCustomMaxAmount(e.target.value)}
                      className="w-full h-8 px-2 rounded-lg bg-white dark:bg-[#18191B] border border-slate-200 dark:border-[#2F3136] text-xs text-slate-900 dark:text-[#EAEBED]"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. Movements List / Table Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-2">
          {filteredMovements.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-slate-50/50 dark:bg-[#222428]/30 rounded-3xl border border-dashed border-slate-300 dark:border-[#2F3136] p-6">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-[#2A2C31] text-slate-400 dark:text-[#9A9DA5] mx-auto flex items-center justify-center">
                <Search size={22} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-[#EAEBED]">
                  Nessun movimento trovato con i filtri attuali
                </h4>
                <p className="text-xs text-slate-500 dark:text-[#9A9DA5] mt-1 max-w-md mx-auto">
                  Prova ad allargare il periodo temporale, disattivare il filtro sulla sottocategoria o azzerare la ricerca testuale.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#E31B23] text-white hover:bg-[#c9151c] transition-all cursor-pointer shadow-xs"
              >
                Azzera Tutti i Filtri
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredMovements.map(mov => {
                const isSelected = selectedIds.includes(mov.id);
                const subObj = subcategories.find(s => s.id === mov.sottocategoria_id);
                const accName =
                  accounts.find(a => a.id === mov.conto_origine)?.nome_conto ||
                  funds.find(f => f.id === mov.conto_origine)?.nome_fondo ||
                  'Conto';

                return (
                  <div
                    key={mov.id}
                    onClick={() => handleToggleRow(mov.id)}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3.5 cursor-pointer select-none ${
                      isSelected
                        ? 'bg-[#E31B23]/10 dark:bg-[#E31B23]/15 border-[#E31B23]/40 shadow-xs'
                        : 'bg-white dark:bg-[#222428] hover:bg-slate-50 dark:hover:bg-[#2A2C31] border-slate-200/90 dark:border-[#2F3136]'
                    }`}
                  >
                    {/* Left: Checkbox + Squircle Icon + Info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Samsung One UI Checkbox */}
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ${
                          isSelected
                            ? 'bg-[#E31B23] text-white ring-2 ring-[#E31B23]/30 scale-105'
                            : 'border-2 border-slate-300 dark:border-[#3F4248] text-transparent hover:border-slate-400'
                        }`}
                      >
                        <Check size={14} strokeWidth={3} />
                      </div>

                      {/* Micro-Squircle Sottocategoria */}
                      {subObj && (
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                          style={{ backgroundColor: subObj.colore || '#E31B23' }}
                        >
                          <CategoryIcon iconName={subObj.icon_name} className="w-5 h-5" />
                        </div>
                      )}

                      {/* Text details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#EAEBED] truncate">
                            {mov.descrizione}
                          </span>
                          {mov.numero_rata && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-[#E31B23]/15 text-[#E31B23] border border-[#E31B23]/30 shrink-0">
                              Rata #{mov.numero_rata}
                            </span>
                          )}
                          {mov.id_ricorrenza && (
                            <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-[#18191B] text-slate-600 dark:text-[#9A9DA5] border border-slate-200 dark:border-[#2F3136] shrink-0">
                              Già collegato
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-[#9A9DA5] flex items-center gap-2 flex-wrap mt-0.5">
                          <span className="font-mono font-medium">
                            {mov.data.split('-').reverse().join('/')}
                          </span>
                          <span>•</span>
                          <span className="font-medium text-slate-700 dark:text-[#CBD5E1]">
                            {accName}
                          </span>
                          {subObj && (
                            <>
                              <span>•</span>
                              <span>{subObj.nome}</span>
                            </>
                          )}
                          {mov.note && (
                            <>
                              <span>•</span>
                              <span className="italic truncate max-w-[200px]">{mov.note}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount & Selection status */}
                    <div className="text-right shrink-0">
                      <div
                        className={`text-sm sm:text-base font-bold font-mono tabular-nums ${
                          mov.tipologia === 'USCITA'
                            ? 'text-slate-900 dark:text-[#EAEBED]'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {mov.tipologia === 'USCITA' ? '-' : '+'}
                        {formatCurrency(mov.importo)}
                      </div>
                      <div className="text-[10.5px] font-bold mt-0.5">
                        {isSelected ? (
                          <span className="text-[#E31B23] flex items-center justify-end gap-1">
                            <Check size={12} strokeWidth={3} />
                            Selezionato
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-[#6E7179]">Tocca per unire</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 5. Sticky Footer Actions One UI */}
        <div className="p-4 md:px-6 border-t border-slate-200/80 dark:border-[#2F3136] bg-slate-50 dark:bg-[#1E2024] flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900 dark:text-[#EAEBED]">
              {selectedCount} movimenti selezionati
            </div>
            <div className="text-[11px] text-slate-500 dark:text-[#9A9DA5]">
              Totale contabile: <b className="font-mono tabular-nums text-slate-900 dark:text-[#EAEBED]">{formatCurrency(totalSelectedAmount)}</b>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                onClose();
              }}
              className="px-4 py-2.5 rounded-2xl text-xs font-semibold text-slate-600 dark:text-[#9A9DA5] hover:text-slate-900 dark:hover:text-[#EAEBED] hover:bg-slate-200/70 dark:hover:bg-[#2A2C31] transition-all cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleConfirmAndClose}
              className="px-5 py-2.5 rounded-2xl text-xs font-bold bg-[#E31B23] hover:bg-[#c9151c] text-white shadow-lg shadow-red-950/20 dark:shadow-red-950/40 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Check size={16} strokeWidth={2.5} />
              <span>Conferma Selezione ({selectedCount})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
