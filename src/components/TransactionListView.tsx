import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Movement, Subcategory, Account, Fund } from '../types';
import { TransactionItem } from './TransactionItem';
import { BulkTagModal } from './BulkTagModal';
import { TagManagerModal } from './TagManagerModal';
import { 
  Search, 
  ArrowUpDown, 
  Plus, 
  Hash, 
  X, 
  Layers, 
  CheckSquare, 
  Tag, 
  Sparkles,
  ListFilter,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  FolderTree,
  Calendar,
  CreditCard,
  ChevronsUpDown,
  CalendarClock,
  Clock,
  Check
} from 'lucide-react';
import { formatCurrency, getMonthName } from '../utils/formatters';
import { haptics } from '../utils/haptics';
import { 
  getCurrentFinancialMonth, 
  getFinancialPeriodInfo, 
  isDateInFinancialMonth, 
  formatYMD 
} from '../utils/financialDate';
import { TabHeaderInfo } from './TabHeaderInfo';

export type GroupByOption = 'NONE' | 'SUBCATEGORY' | 'CATEGORY' | 'MONTH' | 'ACCOUNT' | 'TYPE' | 'TAG' | 'DATE';

interface GroupData {
  id: string;
  title: string;
  subtitle?: string;
  color?: string;
  count: number;
  totalUscite: number;
  totalEntrate: number;
  totalGiroconto: number;
  hasSuspectDuplicates: boolean;
  duplicateCount: number;
  items: Movement[];
}

/**
 * Converte qualsiasi data in timestamp numerico per un ordinamento cronologico rigoroso ed esatto.
 * Supporta:
 * - YYYY-MM-DD o ISO string (es. "2026-09-20", "2026-09-20T12:00:00.000Z")
 * - DD/MM/YYYY o DD-MM-YYYY (es. "20/09/2026", "20-09-2026")
 * - DD/MM/YY (es. "20/09/26")
 */
function parseComparableDate(dateStr: string | undefined | null): number {
  if (!dateStr) return 0;
  const clean = String(dateStr).trim();

  // Pattern YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    return new Date(y, m, d).getTime();
  }

  // Pattern DD/MM/YYYY
  const itMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (itMatch) {
    const d = parseInt(itMatch[1], 10);
    const m = parseInt(itMatch[2], 10) - 1;
    const y = parseInt(itMatch[3], 10);
    return new Date(y, m, d).getTime();
  }

  // Pattern DD/MM/YY
  const itShort = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (itShort) {
    const d = parseInt(itShort[1], 10);
    const m = parseInt(itShort[2], 10) - 1;
    const rawY = parseInt(itShort[3], 10);
    const y = rawY >= 70 ? 1900 + rawY : 2000 + rawY;
    return new Date(y, m, d).getTime();
  }

  const fallback = new Date(clean).getTime();
  return isNaN(fallback) ? 0 : fallback;
}

interface TransactionListViewProps {
  movements: Movement[];
  subcategories: Subcategory[];
  accounts: Account[];
  funds: Fund[];
  onSelectMovement: (mov: Movement) => void;
  onDuplicateMovement: (mov: Movement) => void;
  onDeleteMovement: (mov: Movement) => void;
  onContextMenu: (e: React.MouseEvent, mov: Movement) => void;
  onOpenNewTransaction: () => void;
  onAssignTag?: (mov: Movement, tagName: string, action?: 'ADD' | 'REMOVE' | 'TOGGLE') => void;
  initialTag?: string | null;
  initialSubcategoryId?: string | null;
  initialMonth?: string | null;
  onClearBudgetFilter?: () => void;
  onNavigateBackToBudget?: () => void;
  onOpenReconciliation?: (accountId?: string) => void;
}

const VIEW_PRESETS: { id: GroupByOption; label: string; icon: React.ComponentType<{ size: number; className?: string }> }[] = [
  { id: 'NONE', label: 'Tutti', icon: ListFilter },
  { id: 'SUBCATEGORY', label: 'Sottocategorie', icon: FolderTree },
  { id: 'CATEGORY', label: 'Categorie', icon: Layers },
  { id: 'MONTH', label: 'Per Mese', icon: Calendar },
  { id: 'ACCOUNT', label: 'Per Conto', icon: CreditCard },
  { id: 'TAG', label: 'Per Tag', icon: Tag },
  { id: 'TYPE', label: 'Tipologia', icon: ArrowUpDown },
  { id: 'DATE', label: 'Per Giorno', icon: Calendar }
];

export const TransactionListView: React.FC<TransactionListViewProps> = ({
  movements,
  subcategories,
  accounts,
  funds,
  onSelectMovement,
  onDuplicateMovement,
  onDeleteMovement,
  onContextMenu,
  onOpenNewTransaction,
  onAssignTag,
  initialTag,
  initialSubcategoryId,
  initialMonth,
  onClearBudgetFilter,
  onNavigateBackToBudget
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConto, setSelectedConto] = useState<string>('ALL');
  const [selectedTipo, setSelectedTipo] = useState<string>('ALL');
  const [selectedTag, setSelectedTag] = useState<string>(initialTag || 'ALL');
  const [selectedPeriod, setSelectedPeriod] = useState<'CURRENT_MONTH' | 'PREV_MONTH' | 'LAST_30' | 'FUTURE' | 'ALL'>('CURRENT_MONTH');

  // Conteggio transazioni con data futura rispetto ad oggi
  const futureMovementsCount = useMemo(() => {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return movements.filter(m => parseComparableDate(m.data) > todayMidnight).length;
  }, [movements]);
  
  // Filtri da Budget (Sottocategoria e Mese specifico)
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>(initialSubcategoryId || 'ALL');
  const [selectedSpecificMonth, setSelectedSpecificMonth] = useState<string | null>(initialMonth || null);
  
  // Google Sheets-like Grouping View
  const [groupBy, setGroupBy] = useState<GroupByOption>('NONE');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Filtro rapido duplicati
  const [onlyDuplicatesFilter, setOnlyDuplicatesFilter] = useState<boolean>(false);

  // Ordinamento predefinito: Data operazione decrescente (la transazione con data più recente è sempre al primo posto)
  const [sortBy, setSortBy] = useState<'DATE_DESC' | 'DATE_ASC' | 'INSERTION_DESC' | 'AMOUNT_DESC' | 'AMOUNT_ASC'>('DATE_DESC');
  // Paginazione
  const [visibleCount, setVisibleCount] = useState<number>(30);

  // Modal Filtri & Ricerca dedicato
  const [isFilterModalOpen, setIsFilterModalOpen] = useState<boolean>(false);
  // Modal Pop-up Raggruppamento dedicato
  const [isGroupingModalOpen, setIsGroupingModalOpen] = useState<boolean>(false);

  // Multi-Selection State per Tag in blocco
  const [isSelectMode, setIsSelectMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkTagModalOpen, setIsBulkTagModalOpen] = useState<boolean>(false);
  const [isTagManagerModalOpen, setIsTagManagerModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sincronizza quando arrivano props iniziali da Budget
  useEffect(() => {
    if (initialSubcategoryId) {
      setSelectedSubcategoryId(initialSubcategoryId);
      // Imposta vista raggruppata per data o sottocategoria per facilitare il controllo dei duplicati
      setGroupBy('DATE');
    }
    if (initialMonth) {
      setSelectedSpecificMonth(initialMonth);
    }
  }, [initialSubcategoryId, initialMonth]);

  useEffect(() => {
    if (initialTag) {
      setSelectedTag(initialTag);
    }
  }, [initialTag]);

  const handleToggleSelect = (mov: Movement) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(mov.id)) {
        next.delete(mov.id);
      } else {
        next.add(mov.id);
      }
      return next;
    });
    haptics.tap();
  };

  const handleBulkTagSuccess = (count: number, tagName: string, mode: 'ADD' | 'REPLACE' | 'REMOVE') => {
    setSelectedIds(new Set());
    setIsSelectMode(false);
    const verb = mode === 'REMOVE' ? 'rimosso da' : (mode === 'REPLACE' ? 'sostituito su' : 'assegnato a');
    setToastMessage(`Tag #${tagName} ${verb} ${count} movimenti con successo!`);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Estrai tutti i tag univoci presenti nei movimenti
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    movements.forEach(m => {
      if (m.tag && m.tag.trim()) set.add(m.tag.trim());
      if (m.tags && Array.isArray(m.tags)) {
        m.tags.forEach(t => t && t.trim() && set.add(t.trim()));
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
  }, [movements]);

  // Calcolo date per i filtri di periodo basati sul mese finanziario attivo
  const currentFinMonth = getCurrentFinancialMonth();
  const [curY, curM] = currentFinMonth.split('-').map(Number);
  const prevFinYear = curM === 1 ? curY - 1 : curY;
  const prevFinMonthNum = curM === 1 ? 12 : curM - 1;
  const prevFinMonth = `${prevFinYear}-${String(prevFinMonthNum).padStart(2, '0')}`;

  const last30Date = new Date();
  last30Date.setDate(last30Date.getDate() - 30);
  const last30Str = formatYMD(last30Date);

  // Filtra movimenti
  const filtered = useMemo(() => {
    return movements.filter(m => {
      // Ricerca testuale
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const sub = subcategories.find(s => s.id === m.sottocategoria_id);
        const matchDesc = m.descrizione.toLowerCase().includes(q);
        const matchNotes = m.note?.toLowerCase().includes(q);
        const matchId = m.movimento_id.toLowerCase().includes(q);
        const matchSub = sub?.nome.toLowerCase().includes(q);
        const matchTag = m.tag?.toLowerCase().includes(q) || (m.tags && m.tags.some(t => t.toLowerCase().includes(q)));
        if (!matchDesc && !matchNotes && !matchId && !matchSub && !matchTag) return false;
      }

      // Filtro per Sottocategoria specifica (es. da Budget o filtro dedicato)
      if (selectedSubcategoryId !== 'ALL') {
        if (m.sottocategoria_id !== selectedSubcategoryId) return false;
      }

      // Filtro Tag
      if (selectedTag !== 'ALL') {
        const qTag = selectedTag.toLowerCase().trim();
        const hasTag = (m.tag && m.tag.toLowerCase().trim() === qTag) ||
                       (m.tags && m.tags.some(t => t.toLowerCase().trim() === qTag));
        if (!hasTag) return false;
      }

      // Filtro Mese Specifico (es. mese cliccato da Budget)
      if (selectedSpecificMonth) {
        if (!isDateInFinancialMonth(m.data, selectedSpecificMonth) && !m.data.startsWith(selectedSpecificMonth)) {
          return false;
        }
      } else {
        // Filtro Periodo Finanziario Standard
        if (selectedPeriod === 'CURRENT_MONTH') {
          if (!isDateInFinancialMonth(m.data, currentFinMonth)) return false;
        } else if (selectedPeriod === 'PREV_MONTH') {
          if (!isDateInFinancialMonth(m.data, prevFinMonth)) return false;
        } else if (selectedPeriod === 'LAST_30') {
          if (m.data < last30Str) return false;
        } else if (selectedPeriod === 'FUTURE') {
          const now = new Date();
          const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          if (parseComparableDate(m.data) <= todayMidnight) return false;
        }
      }

      // Filtro Conto
      if (selectedConto !== 'ALL') {
        if (m.conto_origine !== selectedConto && m.conto_destinazione !== selectedConto) return false;
      }

      // Filtro Tipo
      if (selectedTipo !== 'ALL') {
        if (m.tipologia !== selectedTipo) return false;
      }

      return true;
    });
  }, [
    movements, 
    searchQuery, 
    selectedSubcategoryId, 
    selectedTag, 
    selectedSpecificMonth, 
    selectedPeriod, 
    currentFinMonth, 
    prevFinMonth, 
    last30Str, 
    selectedConto, 
    selectedTipo, 
    subcategories
  ]);

  // Rilevamento automatico di possibili duplicati: movimenti con stesso importo e categoria in date identiche o ravvicinate
  const { duplicateMovementIds, duplicateCount } = useMemo(() => {
    const map = new Map<string, Movement[]>();
    filtered.forEach(m => {
      // Chiave: importo arrotondato + sottocategoria o tipo
      const key = `${Math.round(m.importo * 100)}_${m.sottocategoria_id || m.tipologia}`;
      const arr = map.get(key) || [];
      arr.push(m);
      map.set(key, arr);
    });

    const dupSet = new Set<string>();
    map.forEach((items) => {
      if (items.length > 1) {
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            const d1 = new Date(items[i].data).getTime();
            const d2 = new Date(items[j].data).getTime();
            const diffDays = Math.abs(d1 - d2) / (1000 * 3600 * 24);
            // Considera sospetti duplicati movimenti entro 3 giorni con identico importo e categoria
            if (diffDays <= 3) {
              dupSet.add(items[i].id);
              dupSet.add(items[j].id);
            }
          }
        }
      }
    });

    return { duplicateMovementIds: dupSet, duplicateCount: dupSet.size };
  }, [filtered]);

  // Lista finale con eventuale filtro solo duplicati
  const processedMovements = useMemo(() => {
    if (onlyDuplicatesFilter) {
      return filtered.filter(m => duplicateMovementIds.has(m.id));
    }
    return filtered;
  }, [filtered, onlyDuplicatesFilter, duplicateMovementIds]);

  // Ordinamento
  const sortedMovements = useMemo(() => {
    return [...processedMovements].sort((a, b) => {
      if (sortBy === 'DATE_DESC') {
        const timeA = parseComparableDate(a.data);
        const timeB = parseComparableDate(b.data);
        if (timeB !== timeA) return timeB - timeA;
        // A parità di data operazione, ordina per creazione/inserimento più recente
        const createA = new Date(a.created_at || a.data || '').getTime() || 0;
        const createB = new Date(b.created_at || b.data || '').getTime() || 0;
        if (createB !== createA) return createB - createA;
        return (b.movimento_id || '').localeCompare(a.movimento_id || '');
      } else if (sortBy === 'DATE_ASC') {
        const timeA = parseComparableDate(a.data);
        const timeB = parseComparableDate(b.data);
        if (timeA !== timeB) return timeA - timeB;
        const createA = new Date(a.created_at || a.data || '').getTime() || 0;
        const createB = new Date(b.created_at || b.data || '').getTime() || 0;
        return createA - createB;
      } else if (sortBy === 'INSERTION_DESC') {
        const createA = new Date(a.created_at || a.data || '').getTime() || 0;
        const createB = new Date(b.created_at || b.data || '').getTime() || 0;
        if (createB !== createA) return createB - createA;
        return parseComparableDate(b.data) - parseComparableDate(a.data);
      } else if (sortBy === 'AMOUNT_DESC') {
        if (b.importo !== a.importo) return b.importo - a.importo;
        return parseComparableDate(b.data) - parseComparableDate(a.data);
      } else if (sortBy === 'AMOUNT_ASC') {
        if (a.importo !== b.importo) return a.importo - b.importo;
        return parseComparableDate(b.data) - parseComparableDate(a.data);
      }
      return 0;
    });
  }, [processedMovements, sortBy]);

  // Calcolo Gruppi in stile Google Sheets Views
  const groups = useMemo<GroupData[]>(() => {
    if (groupBy === 'NONE') return [];

    const map = new Map<string, GroupData>();

    sortedMovements.forEach(m => {
      let key = '';
      let title = '';
      let subtitle = '';
      let color: string | undefined = undefined;

      if (groupBy === 'SUBCATEGORY') {
        const sub = subcategories.find(s => s.id === m.sottocategoria_id);
        key = m.sottocategoria_id || 'altro';
        title = sub ? sub.nome : (m.tipologia === 'GIROCONTO' ? 'Giroconto' : 'Non categorizzato');
        subtitle = sub?.categoria_padre || 'Generale';
        color = sub?.colore;
      } else if (groupBy === 'CATEGORY') {
        const sub = subcategories.find(s => s.id === m.sottocategoria_id);
        key = sub?.categoria_padre || 'Altro';
        title = key;
        subtitle = 'Macro-Categoria';
      } else if (groupBy === 'MONTH') {
        const yyyymm = m.data.slice(0, 7);
        key = yyyymm;
        title = getMonthName(yyyymm);
        subtitle = `Anno ${yyyymm.slice(0, 4)}`;
      } else if (groupBy === 'ACCOUNT') {
        const acc = accounts.find(a => a.id === m.conto_origine) || funds.find(f => f.id === m.conto_origine);
        key = m.conto_origine || 'sconosciuto';
        title = acc ? ('nome_conto' in acc ? acc.nome_conto : acc.nome_fondo) : 'Conto non specificato';
        subtitle = acc && 'tipo_conto' in acc ? acc.tipo_conto : 'Fondo';
      } else if (groupBy === 'TYPE') {
        key = m.tipologia;
        title = m.tipologia === 'USCITA' ? 'Uscite / Spese' : (m.tipologia === 'ENTRATA' ? 'Entrate' : 'Giroconti');
        subtitle = m.tipologia;
        color = m.tipologia === 'USCITA' ? '#e11d48' : (m.tipologia === 'ENTRATA' ? '#10b981' : '#6366f1');
      } else if (groupBy === 'TAG') {
        const primaryTag = m.tag || (m.tags && m.tags[0]) || 'Senza Tag';
        key = primaryTag;
        title = primaryTag === 'Senza Tag' ? 'Senza Tag' : `#${primaryTag}`;
        subtitle = primaryTag === 'Senza Tag' ? 'Nessun tag assegnato' : 'Tag tematico';
        color = '#f59e0b';
      } else if (groupBy === 'DATE') {
        key = m.data;
        title = m.data;
        const todayStr = formatYMD(new Date());
        const yestDate = new Date();
        yestDate.setDate(yestDate.getDate() - 1);
        const yestStr = formatYMD(yestDate);
        if (m.data === todayStr) {
          subtitle = 'Oggi';
        } else if (m.data === yestStr) {
          subtitle = 'Ieri';
        } else {
          subtitle = 'Data operazione';
        }
      }

      const existing = map.get(key) || {
        id: key,
        title,
        subtitle,
        color,
        count: 0,
        totalUscite: 0,
        totalEntrate: 0,
        totalGiroconto: 0,
        hasSuspectDuplicates: false,
        duplicateCount: 0,
        items: []
      };

      existing.count += 1;
      existing.items.push(m);
      if (m.tipologia === 'USCITA') existing.totalUscite += m.importo;
      else if (m.tipologia === 'ENTRATA') existing.totalEntrate += m.importo;
      else existing.totalGiroconto += m.importo;

      if (duplicateMovementIds.has(m.id)) {
        existing.hasSuspectDuplicates = true;
        existing.duplicateCount += 1;
      }

      map.set(key, existing);
    });

    const list = Array.from(map.values());
    if (groupBy === 'MONTH' || groupBy === 'DATE') {
      list.sort((a, b) => b.id.localeCompare(a.id));
    } else if (groupBy === 'TYPE') {
      const order: Record<string, number> = { USCITA: 1, ENTRATA: 2, GIROCONTO: 3 };
      list.sort((a, b) => (order[a.id] || 9) - (order[b.id] || 9));
    } else {
      list.sort((a, b) => b.totalUscite - a.totalUscite || b.count - a.count);
    }

    return list;
  }, [groupBy, sortedMovements, subcategories, accounts, funds, duplicateMovementIds]);

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
    haptics.tap();
  };

  const handleExpandAll = () => {
    setCollapsedGroups(new Set());
    haptics.tap();
  };

  const handleCollapseAll = () => {
    setCollapsedGroups(new Set(groups.map(g => g.id)));
    haptics.tap();
  };

  // Paginazione per vista standard (senza raggruppamento)
  const displayedMovements = useMemo(() => {
    return sortedMovements.slice(0, visibleCount);
  }, [sortedMovements, visibleCount]);

  // Multi-selezione
  const selectedMovements = useMemo(() => {
    return movements.filter(m => selectedIds.has(m.id));
  }, [movements, selectedIds]);

  const selectedTotal = useMemo(() => {
    let tot = 0;
    for (const m of selectedMovements) {
      if (m.tipologia === 'USCITA') tot -= m.importo;
      else if (m.tipologia === 'ENTRATA') tot += m.importo;
    }
    return tot;
  }, [selectedMovements]);

  const handleSelectAllVisible = () => {
    const allIds = new Set(sortedMovements.map(m => m.id));
    setSelectedIds(allIds);
    haptics.tap();
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
    haptics.tap();
  };

  const allAccountsAndFunds = [
    ...accounts.map(a => ({ id: a.id, name: a.nome_conto, type: 'Conto' })),
    ...funds.map(f => ({ id: f.id, name: f.nome_fondo, type: 'Fondo' }))
  ];

  // Calcolo filtri attivi
  const isSearchActive = searchQuery.trim() !== '';
  const isSubcategoryFiltered = selectedSubcategoryId !== 'ALL';
  const isSpecificMonthFiltered = selectedSpecificMonth !== null;
  const isPeriodFiltered = !isSpecificMonthFiltered && selectedPeriod !== 'CURRENT_MONTH';
  const isTipoFiltered = selectedTipo !== 'ALL';
  const isContoFiltered = selectedConto !== 'ALL';
  const isTagFiltered = selectedTag !== 'ALL';
  const isBudgetDrillDownActive = isSubcategoryFiltered || isSpecificMonthFiltered;

  const activeFiltersCount = 
    (isSearchActive ? 1 : 0) +
    (isSubcategoryFiltered ? 1 : 0) +
    (isSpecificMonthFiltered ? 1 : 0) +
    (isPeriodFiltered ? 1 : 0) +
    (isTipoFiltered ? 1 : 0) +
    (isContoFiltered ? 1 : 0) +
    (isTagFiltered ? 1 : 0) +
    (onlyDuplicatesFilter ? 1 : 0);

  const hasActiveFilters = activeFiltersCount > 0;

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedSubcategoryId('ALL');
    setSelectedSpecificMonth(null);
    setSelectedPeriod('CURRENT_MONTH');
    setSelectedTipo('ALL');
    setSelectedConto('ALL');
    setSelectedTag('ALL');
    setOnlyDuplicatesFilter(false);
    if (onClearBudgetFilter) onClearBudgetFilter();
    haptics.tap();
  };

  const activeSubcategory = subcategories.find(s => s.id === selectedSubcategoryId);

  return (
    <div id="transaction-list-view-container" className="space-y-2.5 sm:space-y-3 w-full max-w-full">
      {/* HEADER & FILTRI */}
      <div className="w-full space-y-2">
        {/* RIGA 1: Titolo, Badge conteggio e Toolbar compatta */}
        <div className="bg-white dark:bg-[#1C1C1E] py-2 px-3 sm:py-2.5 sm:px-4 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-xs flex flex-col gap-1.5 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
            {/* Sinistra: Icona + Titolo + Conteggio */}
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                <ListFilter size={18} className="sm:w-5 sm:h-5" />
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">
                  Movimenti
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-[11px] font-bold font-numeric">
                  {sortedMovements.length}
                </span>
                <TabHeaderInfo text="Visualizzazione transazioni con raggruppamenti in stile Google Fogli, filtri avanzati e controllo duplicati" />
                {groupBy !== 'NONE' && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsGroupingModalOpen(true);
                      haptics.tap();
                    }}
                    className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10.5px] font-semibold hover:bg-indigo-100 transition cursor-pointer"
                    title="Modifica raggruppamento"
                  >
                    <Layers size={10} />
                    <span>{VIEW_PRESETS.find(p => p.id === groupBy)?.label}</span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setGroupBy('NONE');
                        haptics.tap();
                      }}
                      className="hover:text-indigo-950 dark:hover:text-white p-0.5 -mr-0.5"
                      title="Rimuovi raggruppamento"
                    >
                      <X size={10} />
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Destra: Azioni Toolbar (Filtri, Raggruppa in pop-up, Ordinamento, Selezione, Tag) */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap sm:flex-nowrap">
              {/* Pulsante Filtro con Badge Contatore */}
              <button
                id="transaction-filter-toggle-btn"
                type="button"
                onClick={() => {
                  setIsFilterModalOpen(true);
                  haptics.tap();
                }}
                className={`h-8 px-2.5 sm:px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95 border ${
                  hasActiveFilters
                    ? 'bg-[#E31B23] hover:bg-[#c9141b] text-white border-[#E31B23] shadow-[#E31B23]/20'
                    : 'bg-slate-100 dark:bg-[#242426] hover:bg-slate-200 dark:hover:bg-[#2E2E32] text-slate-700 dark:text-[#F5F5F7] border-slate-200/70 dark:border-white/5'
                }`}
                title={hasActiveFilters ? `${activeFiltersCount} filtri applicati` : "Apri pannello ricerca e filtri"}
              >
                <Search size={13} strokeWidth={hasActiveFilters ? 2.5 : 2} className={hasActiveFilters ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
                <span>{hasActiveFilters ? `Filtri (${activeFiltersCount})` : 'Filtra'}</span>
              </button>

              {/* Pulsante Raggruppamento con Icona che apre il Pop-up dedicato */}
              <button
                id="transaction-grouping-menu-btn"
                type="button"
                onClick={() => {
                  setIsGroupingModalOpen(true);
                  haptics.tap();
                }}
                className={`h-8 px-2.5 sm:px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95 border ${
                  groupBy !== 'NONE'
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 shadow-indigo-600/20 font-bold'
                    : 'bg-slate-100 dark:bg-[#242426] hover:bg-slate-200 dark:hover:bg-[#2E2E32] text-slate-700 dark:text-[#F5F5F7] border-slate-200/70 dark:border-white/5'
                }`}
                title="Raggruppa movimenti per data, categoria, conto, mese o tag"
              >
                <Layers size={13} className={groupBy !== 'NONE' ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
                <span>{groupBy === 'NONE' ? 'Raggruppa' : VIEW_PRESETS.find(p => p.id === groupBy)?.label || 'Raggruppato'}</span>
                {groupBy !== 'NONE' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white ml-0.5 animate-pulse" />
                )}
              </button>

              {/* Reset filtri rapido */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="h-8 px-2.5 rounded-full text-[11px] font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200/60 dark:border-rose-800/60 transition flex items-center gap-1 cursor-pointer"
                  title="Azzera tutti i filtri"
                >
                  <X size={12} />
                  <span>Azzera</span>
                </button>
              )}

              {/* Ordinamento compatto */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#242426] border border-slate-200/70 dark:border-white/5 rounded-full px-2 sm:px-2.5 h-8">
                <ArrowUpDown size={12} className="text-slate-400 flex-shrink-0" />
                <select
                  id="transaction-sort-by-select"
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="bg-transparent text-xs font-medium text-slate-700 dark:text-slate-300 outline-none cursor-pointer pr-1"
                >
                  <option value="DATE_DESC">Data: più recenti in cima</option>
                  <option value="DATE_ASC">Data: meno recenti in cima</option>
                  <option value="INSERTION_DESC">Ultimi inseriti nel sistema</option>
                  <option value="AMOUNT_DESC">Importo: maggiore prima</option>
                  <option value="AMOUNT_ASC">Importo: minore prima</option>
                </select>
              </div>

              {/* Bulk Selection Toggle */}
              <button
                type="button"
                id="transaction-bulk-select-toggle-btn"
                onClick={() => {
                  const nextMode = !isSelectMode;
                  setIsSelectMode(nextMode);
                  if (!nextMode) setSelectedIds(new Set());
                  haptics.tap();
                }}
                className={`h-8 px-2 sm:px-2.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  isSelectMode
                    ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                    : 'bg-slate-100 dark:bg-[#242426] text-slate-700 dark:text-[#F5F5F7] hover:bg-slate-200 dark:hover:bg-[#2E2E32] border-slate-200/70 dark:border-white/5'
                }`}
                title="Seleziona movimenti per tag in blocco"
              >
                <CheckSquare size={13} />
                <span className="hidden sm:inline">{isSelectMode ? 'Fine' : 'Seleziona'}</span>
                {selectedIds.size > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-white/30 text-[10px] font-bold font-numeric">
                    {selectedIds.size}
                  </span>
                )}
              </button>

              {/* Gestisci Tag */}
              <button
                type="button"
                id="transaction-tags-manager-btn"
                onClick={() => {
                  setIsTagManagerModalOpen(true);
                  haptics.tap();
                }}
                className="h-8 px-2 sm:px-2.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-[#242426] text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7] hover:bg-slate-200 dark:hover:bg-[#2E2E32] border border-slate-200/70 dark:border-white/5 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Gestisci la libreria dei tag"
              >
                <Tag size={12} className="text-amber-500" />
                <span className="hidden md:inline">Tag</span>
              </button>

              {/* Filtro Rapido Spese / Movimenti Futuri */}
              {futureMovementsCount > 0 && (
                <button
                  type="button"
                  id="transaction-future-filter-btn"
                  onClick={() => {
                    setSelectedPeriod(prev => prev === 'FUTURE' ? 'CURRENT_MONTH' : 'FUTURE');
                    setSelectedSpecificMonth(null);
                    haptics.tap();
                  }}
                  className={`h-8 px-2 sm:px-2.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                    selectedPeriod === 'FUTURE'
                      ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                      : 'bg-amber-50/80 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 border-amber-300/70 dark:border-amber-700/60'
                  }`}
                  title="Filtra solo le spese e transazioni con data futura"
                >
                  <CalendarClock size={12} className={selectedPeriod === 'FUTURE' ? 'text-white' : 'text-amber-600 dark:text-amber-400'} />
                  <span>{futureMovementsCount}</span>
                  <span className="hidden sm:inline">{futureMovementsCount === 1 ? 'futura' : 'future'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Chip dei filtri attivi e controlli di raggruppamento rapido */}
        {(hasActiveFilters || groupBy !== 'NONE') && (
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar text-xs pt-0.5">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                Attivi:
              </span>

              {/* Chip Raggruppamento attivo */}
              {groupBy !== 'NONE' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-200 border border-indigo-300/80 dark:border-indigo-700 text-[11px] font-bold no-scrollbar">
                  <Layers size={11} className="text-indigo-600 dark:text-indigo-400" />
                  <span>Gruppo: {VIEW_PRESETS.find(p => p.id === groupBy)?.label}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setGroupBy('NONE');
                      haptics.tap();
                    }}
                    className="hover:text-indigo-950 dark:hover:text-white ml-0.5 cursor-pointer"
                    title="Rimuovi raggruppamento"
                  >
                    <X size={11} />
                  </button>
                </span>
              )}

              {/* Chip Sottocategoria (es. da Budget) */}
              {isSubcategoryFiltered && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-200 border border-indigo-300/80 dark:border-indigo-700 text-[11px] font-bold no-scrollbar">
                  <FolderTree size={11} className="text-indigo-600 dark:text-indigo-400" />
                  <span>{activeSubcategory?.nome || 'Sottocategoria'}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedSubcategoryId('ALL')}
                    className="hover:text-indigo-950 dark:hover:text-white ml-0.5"
                    title="Rimuovi filtro sottocategoria"
                  >
                    <X size={11} />
                  </button>
                </span>
              )}

              {/* Chip Mese Specifico (es. da Budget) */}
              {isSpecificMonthFiltered && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-200 border border-indigo-300/80 dark:border-indigo-700 text-[11px] font-bold no-scrollbar">
                  <Calendar size={11} className="text-indigo-600 dark:text-indigo-400" />
                  <span>{getMonthName(selectedSpecificMonth!)}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedSpecificMonth(null)}
                    className="hover:text-indigo-950 dark:hover:text-white ml-0.5"
                    title="Rimuovi filtro mese specifico"
                  >
                    <X size={11} />
                  </button>
                </span>
              )}

              {/* Chip Solo Duplicati */}
              {onlyDuplicatesFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700 text-[11px] font-bold no-scrollbar">
                  <AlertTriangle size={11} className="text-amber-600" />
                  <span>Solo duplicati</span>
                  <button
                    type="button"
                    onClick={() => setOnlyDuplicatesFilter(false)}
                    className="hover:text-amber-950 dark:hover:text-white ml-0.5"
                    title="Mostra tutti i movimenti"
                  >
                    <X size={11} />
                  </button>
                </span>
              )}

            {isSearchActive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800 text-[11px] font-medium no-scrollbar">
                <span>"{searchQuery}"</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="hover:text-indigo-900 dark:hover:text-white ml-0.5"
                  title="Rimuovi ricerca testo"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {isPeriodFiltered && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium no-scrollbar border ${
                selectedPeriod === 'FUTURE'
                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border-amber-300/80 dark:border-amber-700 font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}>
                {selectedPeriod === 'FUTURE' && <CalendarClock size={11} className="text-amber-600 dark:text-amber-400" />}
                <span>
                  {selectedPeriod === 'PREV_MONTH'
                    ? 'Mese Scorso'
                    : selectedPeriod === 'LAST_30'
                    ? 'Ultimi 30gg'
                    : selectedPeriod === 'FUTURE'
                    ? 'Solo future / programmate'
                    : 'Tutti i periodi'}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedPeriod('CURRENT_MONTH')}
                  className="hover:text-slate-900 dark:hover:text-white ml-0.5"
                  title="Torna al mese corrente"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {isTipoFiltered && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] font-medium no-scrollbar">
                <span>{selectedTipo === 'USCITA' ? 'Solo Spese' : selectedTipo === 'ENTRATA' ? 'Solo Entrate' : 'Solo Giroconti'}</span>
                <button
                  type="button"
                  onClick={() => setSelectedTipo('ALL')}
                  className="hover:text-slate-900 dark:hover:text-white ml-0.5"
                  title="Rimuovi filtro tipologia"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {isContoFiltered && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] font-medium no-scrollbar">
                <span>{allAccountsAndFunds.find(c => c.id === selectedConto)?.name || 'Conto selezionato'}</span>
                <button
                  type="button"
                  onClick={() => setSelectedConto('ALL')}
                  className="hover:text-slate-900 dark:hover:text-white ml-0.5"
                  title="Rimuovi filtro conto"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {isTagFiltered && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/70 dark:border-amber-800 text-[11px] font-medium no-scrollbar">
                <Hash size={10} className="text-amber-500" />
                <span>{selectedTag}</span>
                <button
                  type="button"
                  onClick={() => setSelectedTag('ALL')}
                  className="hover:text-amber-950 dark:hover:text-white ml-0.5"
                  title="Rimuovi filtro tag"
                >
                  <X size={11} />
                </button>
              </span>
            )}
          </div>

          {/* Controlli rapidi Espandi/Comprimi per gruppi attivi */}
          {groupBy !== 'NONE' && groups.length > 0 && (
            <div className="flex items-center gap-1 bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 rounded-xl px-2 py-0.5 ml-auto shrink-0 shadow-2xs">
              <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 font-numeric whitespace-nowrap mr-1 hidden sm:inline">
                {groups.length} gruppi
              </span>
              <button
                type="button"
                onClick={handleExpandAll}
                className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-1 py-0.5 cursor-pointer"
                title="Espandi tutti i gruppi"
              >
                Espandi
              </button>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:underline px-1 py-0.5 cursor-pointer"
                title="Comprimi tutti i gruppi"
              >
                Comprimi
              </button>
            </div>
          )}
        </div>
      )}
    </div>

      {/* 
        BANNER DEDICATO CONTROLLO BUDGET
        Compare quando l'utente arriva dal Budget per verificare transazioni o duplicati
      */}
      {isBudgetDrillDownActive && (
        <div className="p-3 bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <div className="w-8.5 h-8.5 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <FolderTree size={17} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-indigo-950 dark:text-indigo-100">
                  Controllo Movimenti Budget: {activeSubcategory?.nome || 'Sottocategoria selezionata'}
                </span>
                {selectedSpecificMonth && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-200/80 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-200">
                    {getMonthName(selectedSpecificMonth)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-indigo-700/90 dark:text-indigo-300/90 mt-0.5">
                Stai visualizzando esclusivamente i movimenti di questa voce. Verifica sotto se ci sono importi duplicati o voci errate.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {onNavigateBackToBudget && (
              <button
                type="button"
                onClick={onNavigateBackToBudget}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              >
                <span>← Torna al Budget</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSelectedSubcategoryId('ALL');
                setSelectedSpecificMonth(null);
                if (onClearBudgetFilter) onClearBudgetFilter();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-white/10 hover:bg-indigo-100 dark:hover:bg-white/20 text-indigo-800 dark:text-indigo-200 text-xs font-medium transition flex items-center gap-1 border border-indigo-200/80 dark:border-white/10 cursor-pointer"
            >
              <X size={12} />
              <span>Rimuovi filtro</span>
            </button>
          </div>
        </div>
      )}

      {/* 
        BANNER RILEVAMENTO POSSIBILI DUPLICATI
        Aiuta l'utente a individuare subito transazioni doppie con lo stesso importo
      */}
      {duplicateCount > 0 && (
        <div className="p-2.5 sm:p-3 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle size={15} />
            </div>
            <div>
              <span className="font-bold">Attenzione possibili duplicati:</span> Rilevate {duplicateCount} transazioni con lo stesso importo e categoria in date ravvicinate.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOnlyDuplicatesFilter(prev => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer active:scale-95 ${
              onlyDuplicatesFilter
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-200/80 dark:bg-amber-900/60 hover:bg-amber-300 text-amber-900 dark:text-amber-100'
            }`}
          >
            {onlyDuplicatesFilter ? 'Mostra tutti i movimenti' : 'Isola solo i sospetti duplicati'}
          </button>
        </div>
      )}

      {/* BANNER INFORMATIVO MOVIMENTI FUTURI / PROGRAMMATI */}
      {selectedPeriod === 'FUTURE' && (
        <div className="p-2.5 sm:p-3 bg-amber-50/90 dark:bg-amber-950/40 border border-dashed border-amber-400/80 dark:border-amber-700/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-dashed border-amber-400/50">
              <CalendarClock size={16} />
            </div>
            <div>
              <div className="font-bold text-amber-950 dark:text-amber-100 flex items-center gap-1.5">
                <span>Movimenti con data futura ({sortedMovements.length})</span>
                <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-dashed border-amber-400">
                  Bordo tratteggiato & sfondo dedicato
                </span>
              </div>
              <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 mt-0.5">
                Spese, entrate e giroconti con data successiva a oggi. Sono distinti dalle transazioni passate tramite sfondo colorato e bordo tratteggiato.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedPeriod('CURRENT_MONTH')}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-white/10 hover:bg-amber-100 text-amber-900 dark:text-amber-100 text-xs font-semibold transition border border-amber-300/80 dark:border-white/10 shrink-0 cursor-pointer self-end sm:self-auto"
          >
            Torna al mese corrente
          </button>
        </div>
      )}

      {/* Floating Bulk Actions Bar (posizionato in basso per non sovrapporsi mai ai contenuti superiori) */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-20 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:w-auto sm:max-w-xl z-40 p-2.5 sm:p-3 bg-slate-900/95 dark:bg-[#1C1C1E]/95 backdrop-blur-md text-white border border-white/10 rounded-2xl shadow-2xl flex flex-wrap items-center justify-between gap-2 sm:gap-2.5"
          >
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0">
                <CheckSquare size={14} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="font-numeric">{selectedIds.size}</span>
                  <span>{selectedIds.size === 1 ? 'movimento selezionato' : 'movimenti selezionati'}</span>
                </div>
                <div className="text-[10.5px] sm:text-[11px] text-slate-400 truncate">
                  Importo netto: <strong className="text-white font-numeric">{formatCurrency(selectedTotal)}</strong>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <button
                type="button"
                onClick={selectedIds.size === sortedMovements.length ? handleDeselectAll : handleSelectAllVisible}
                className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-full text-xs font-medium bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer"
              >
                {selectedIds.size === sortedMovements.length ? 'Deseleziona' : `Tutti (${sortedMovements.length})`}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsBulkTagModalOpen(true);
                  haptics.tap();
                }}
                className="px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-xs font-bold bg-[#E31B23] hover:bg-red-700 text-white transition-all shadow-md flex items-center gap-1 active:scale-95 cursor-pointer"
              >
                <Tag size={12} strokeWidth={2.5} />
                <span>Assegna Tag</span>
              </button>

              <button
                type="button"
                onClick={handleDeselectAll}
                className="p-1 sm:p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Deseleziona tutto"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-2.5 sm:p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-xs font-medium text-emerald-800 dark:text-emerald-200 flex items-center gap-2 shadow-xs"
          >
            <Sparkles size={15} className="text-emerald-500 flex-shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 
        CORPO PRINCIPALE LISTA TRANSAZIONI
        1. Se groupBy === 'NONE': Lista tabellare standard con paginazione
        2. Se groupBy !== 'NONE': Sezioni raggruppate in stile Google Sheets Views con sub-totali e collapsibility
      */}
      {sortedMovements.length === 0 ? (
        <div className="bento-card py-10 sm:py-12 flex flex-col items-center justify-center text-center p-4 sm:p-6 rounded-[22px]">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-slate-100 dark:bg-[#242426] text-slate-400 flex items-center justify-center mb-2.5">
            <Search size={20} />
          </div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-[#F5F5F7]">Nessun movimento trovato</h4>
          <p className="text-xs text-slate-400 max-w-xs mt-1">
            Modifica i filtri, il periodo o la ricerca per visualizzare le transazioni.
          </p>
          <button
            onClick={onOpenNewTransaction}
            className="mt-3 sm:mt-4 px-4 py-2 bg-[#E31B23] hover:bg-red-700 text-white rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={14} />
            <span>Nuovo Movimento</span>
          </button>
        </div>
      ) : groupBy === 'NONE' ? (
        /* VISTA STANDARD FLAT */
        <div className="mt-2.5 sm:mt-3.5 bento-card overflow-hidden divide-y divide-slate-100 dark:divide-white/5 rounded-[20px] sm:rounded-[22px] w-full max-w-full">
          {displayedMovements.map((mov, idx) => (
            <TransactionItem
              key={mov.id}
              movement={mov}
              subcategories={subcategories}
              accounts={accounts}
              funds={funds}
              onContextMenu={onContextMenu}
              onClick={onSelectMovement}
              onDuplicate={onDuplicateMovement}
              onDelete={onDeleteMovement}
              onTagClick={(tag) => setSelectedTag(tag)}
              onRemoveTag={(mov, tag) => onAssignTag?.(mov, tag, 'REMOVE')}
              index={idx}
              isSelectMode={isSelectMode || selectedIds.size > 0}
              isSelected={selectedIds.has(mov.id)}
              onToggleSelect={handleToggleSelect}
            />
          ))}

          {/* Paginazione One UI */}
          {sortedMovements.length > visibleCount && (
            <div className="p-2.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-2 bg-slate-50/50 dark:bg-[#1C1C1E]/50">
              <span className="text-[11px] sm:text-xs text-slate-400 font-numeric">
                Visualizzati {displayedMovements.length} di {sortedMovements.length} movimenti
              </span>
              <button
                type="button"
                onClick={() => {
                  setVisibleCount(prev => prev + 30);
                  haptics.tap();
                }}
                className="px-4 py-1.5 sm:px-5 sm:py-2 rounded-full bg-slate-100 dark:bg-[#2A2A2E] hover:bg-slate-200 dark:hover:bg-[#323236] text-slate-800 dark:text-[#F5F5F7] font-semibold text-xs transition active:scale-95 border border-slate-200/60 dark:border-white/5 cursor-pointer shadow-2xs"
              >
                Carica altri 30 movimenti
              </button>
            </div>
          )}
        </div>
      ) : (
        /* VISTA RAGGRUPPATA (Google Sheets Pivot Views Style) */
        <div className="mt-2.5 sm:mt-3.5 space-y-3 w-full max-w-full">
          {groups.map(group => {
            const isCollapsed = collapsedGroups.has(group.id);

            return (
              <div
                key={group.id}
                className="bento-card overflow-hidden rounded-[20px] sm:rounded-[22px] border border-slate-200/80 dark:border-white/5 shadow-xs transition-all"
              >
                {/* Header del Gruppo (Click per espandere/collassare) */}
                <div
                  onClick={() => toggleGroupCollapse(group.id)}
                  className="p-2.5 sm:p-3.5 bg-slate-50/80 dark:bg-[#1C1C1E] hover:bg-slate-100/80 dark:hover:bg-[#242426] cursor-pointer transition-colors flex items-center justify-between gap-2 select-none border-b border-slate-100 dark:border-white/5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-transform">
                      {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    </div>

                    {group.color && (
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {group.title}
                        </span>
                        {group.hasSuspectDuplicates && (
                          <span className="px-1.5 py-0.2 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold text-[9.5px] flex items-center gap-0.5 shrink-0">
                            <AlertTriangle size={9} />
                            <span>{group.duplicateCount} duplicati</span>
                          </span>
                        )}
                      </div>
                      {group.subtitle && (
                        <span className="text-[10px] text-slate-400 block truncate">
                          {group.subtitle}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Sub-totali del gruppo a destra */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <span className="px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-white/10 text-slate-700 dark:text-slate-300 text-[10.5px] font-bold font-numeric">
                      {group.count} mov.
                    </span>

                    <div className="text-right">
                      {group.totalUscite > 0 && (
                        <div className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 font-numeric">
                          - {formatCurrency(group.totalUscite)}
                        </div>
                      )}
                      {group.totalEntrate > 0 && (
                        <div className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 font-numeric">
                          + {formatCurrency(group.totalEntrate)}
                        </div>
                      )}
                      {group.totalUscite === 0 && group.totalEntrate === 0 && group.totalGiroconto > 0 && (
                        <div className="text-xs sm:text-sm font-semibold text-slate-500 font-numeric">
                          {formatCurrency(group.totalGiroconto)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Transazioni del gruppo (visibili se non collassato) */}
                {!isCollapsed && (
                  <div className="divide-y divide-slate-100 dark:divide-white/5">
                    {group.items.map((mov, idx) => (
                      <TransactionItem
                        key={mov.id}
                        movement={mov}
                        subcategories={subcategories}
                        accounts={accounts}
                        funds={funds}
                        onContextMenu={onContextMenu}
                        onClick={onSelectMovement}
                        onDuplicate={onDuplicateMovement}
                        onDelete={onDeleteMovement}
                        onTagClick={(tag) => setSelectedTag(tag)}
                        onRemoveTag={(mov, tag) => onAssignTag?.(mov, tag, 'REMOVE')}
                        index={idx}
                        isSelectMode={isSelectMode || selectedIds.size > 0}
                        isSelected={selectedIds.has(mov.id)}
                        onToggleSelect={handleToggleSelect}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Helper text */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 px-2">
        <span className="hidden sm:inline">💡 Clicca con tasto destro su una transazione per il menu rapido o per assegnare tag.</span>
        <span className="sm:hidden">💡 Seleziona per assegnare tag in blocco, oppure usa le viste raggruppate.</span>
        <span>Ordinamento verificato</span>
      </div>

      {/* Modal / Menù a comparsa dedicato Filtri & Ricerca (One UI Style) */}
      <AnimatePresence>
        {isFilterModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15 }}
              className="bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header del Modal */}
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Search size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Filtri & Ricerca
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Imposta parametri per isolare transazioni, verificare scostamenti e duplicati
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFilterModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center transition"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Corpo dei filtri scorrevole */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 no-scrollbar">
                {/* 1. Ricerca Testuale */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Cerca per testo o note
                  </label>
                  <div className="relative">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Descrizione, note, ID..."
                      className="w-full pl-9 pr-9 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-500 text-slate-900 dark:text-white placeholder:text-slate-400"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Filtro Sottocategoria specifica */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Sottocategoria</span>
                    {selectedSubcategoryId !== 'ALL' && (
                      <button
                        type="button"
                        onClick={() => setSelectedSubcategoryId('ALL')}
                        className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Tutte le sottocategorie
                      </button>
                    )}
                  </label>
                  <select
                    value={selectedSubcategoryId}
                    onChange={e => setSelectedSubcategoryId(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    <option value="ALL">Tutte le sottocategorie</option>
                    {subcategories.map(sub => (
                      <option key={sub.id} value={sub.id}>
                        {sub.nome} ({sub.categoria_padre})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Filtro Periodo Finanziario */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Periodo di Riferimento
                    </label>
                    {selectedSpecificMonth && (
                      <button
                        type="button"
                        onClick={() => setSelectedSpecificMonth(null)}
                        className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Ripristina periodo standard
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5">
                    {[
                      { id: 'CURRENT_MONTH', label: 'Questo Mese' },
                      { id: 'PREV_MONTH', label: 'Mese Scorso' },
                      { id: 'LAST_30', label: 'Ultimi 30gg' },
                      { id: 'FUTURE', label: 'Solo Future' },
                      { id: 'ALL', label: 'Tutti i periodi' }
                    ].map(period => (
                      <button
                        key={period.id}
                        type="button"
                        onClick={() => {
                          setSelectedPeriod(period.id as any);
                          setSelectedSpecificMonth(null);
                          haptics.tap();
                        }}
                        className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-all text-center ${
                          !selectedSpecificMonth && selectedPeriod === period.id
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 text-indigo-700 dark:text-indigo-300 font-bold shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        {period.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Filtro Solo Possibili Duplicati */}
                <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-200 block">
                      Rilevatore Duplicati
                    </span>
                    <span className="text-[11px] text-amber-700/80 dark:text-amber-300/80 block">
                      Isola le transazioni con stesso importo e categoria ravvicinate
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOnlyDuplicatesFilter(!onlyDuplicatesFilter)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      onlyDuplicatesFilter
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                    }`}
                  >
                    {onlyDuplicatesFilter ? 'Attivo' : 'Disattivo'}
                  </button>
                </div>

                {/* 5. Tipologia Movimento */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Tipologia
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {[
                      { id: 'ALL', label: 'Tutte' },
                      { id: 'USCITA', label: 'Solo Spese' },
                      { id: 'ENTRATA', label: 'Solo Entrate' },
                      { id: 'GIROCONTO', label: 'Giroconti' }
                    ].map(tipo => (
                      <button
                        key={tipo.id}
                        type="button"
                        onClick={() => {
                          setSelectedTipo(tipo.id);
                          haptics.tap();
                        }}
                        className={`py-2 px-2 rounded-xl text-xs font-medium border transition-all text-center ${
                          selectedTipo === tipo.id
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 text-indigo-700 dark:text-indigo-300 font-bold shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        {tipo.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 6. Conto o Fondo */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Conto o Fondo
                  </label>
                  <select
                    value={selectedConto}
                    onChange={e => setSelectedConto(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    <option value="ALL">Tutti i conti e fondi</option>
                    {allAccountsAndFunds.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 7. Filtro Tag */}
                {availableTags.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Tag (#)
                      </label>
                      {selectedTag !== 'ALL' && (
                        <button
                          type="button"
                          onClick={() => setSelectedTag('ALL')}
                          className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline"
                        >
                          Rimuovi tag
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap max-h-32 overflow-y-auto no-scrollbar pt-0.5">
                      <button
                        type="button"
                        onClick={() => setSelectedTag('ALL')}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                          selectedTag === 'ALL'
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 font-bold'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Tutti
                      </button>
                      {availableTags.map(tag => {
                        const isSelected = selectedTag.toLowerCase().trim() === tag.toLowerCase().trim();
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setSelectedTag(isSelected ? 'ALL' : tag)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 border transition-all ${
                              isSelected
                                ? 'bg-amber-500 text-white border-amber-500 font-bold shadow-xs'
                                : 'bg-amber-50/50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/50 hover:border-amber-400'
                            }`}
                          >
                            <Hash size={11} className={isSelected ? 'text-white' : 'text-amber-500'} />
                            <span>{tag}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Modal con Azioni */}
              <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#1C1C1E]/50 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-3.5 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-white transition"
                >
                  Azzera filtri
                </button>
                <button
                  type="button"
                  onClick={() => setIsFilterModalOpen(false)}
                  className="px-5 py-2 bg-[#E31B23] hover:bg-red-700 text-white rounded-full text-xs font-semibold shadow-xs transition active:scale-95"
                >
                  Applica filtri ({filtered.length} risultati)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modale Pop-up Raggruppamento Movimenti */}
      <AnimatePresence>
        {isGroupingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header Pop-up */}
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Layers size={20} />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                      Raggruppamento Movimenti
                    </h2>
                    <p className="text-xs text-slate-400">
                      Organizza la tabella in sezioni con subtotali dedicati
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsGroupingModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Lista opzioni di raggruppamento */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-2">
                {VIEW_PRESETS.map(preset => {
                  const Icon = preset.icon;
                  const isSelected = groupBy === preset.id;
                  
                  let description = 'Elenco standard continuo senza divisioni';
                  if (preset.id === 'SUBCATEGORY') description = 'Raggruppa per specifica sottocategoria di spesa/entrata';
                  if (preset.id === 'CATEGORY') description = 'Raggruppa per macro categoria (Spese, Casa, Lavoro, ecc.)';
                  if (preset.id === 'MONTH') description = 'Suddividi per mese contabile con totali mensili';
                  if (preset.id === 'ACCOUNT') description = 'Separa per conto bancario, carta o fondo';
                  if (preset.id === 'TAG') description = 'Raggruppa secondo i tag tematici assegnati';
                  if (preset.id === 'TYPE') description = 'Separa per Uscite, Entrate e Giroconti';
                  if (preset.id === 'DATE') description = 'Raggruppa giorno per giorno con riepilogo giornaliero';

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setGroupBy(preset.id);
                        setCollapsedGroups(new Set());
                        setIsGroupingModalOpen(false);
                        haptics.tap();
                      }}
                      className={`w-full p-3 sm:p-3.5 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 text-indigo-950 dark:text-indigo-100 shadow-xs'
                          : 'bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/80 dark:hover:bg-slate-800 border-slate-200/70 dark:border-slate-700/60 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300'
                        }`}>
                          <Icon size={17} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs sm:text-sm font-bold block truncate">
                            {preset.label}
                          </span>
                          <span className="text-[11px] text-slate-400 block truncate">
                            {description}
                          </span>
                        </div>
                      </div>
                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 ml-2 shadow-xs">
                          <Check size={14} strokeWidth={2.5} />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })}

                {/* Controlli rapidi se un raggruppamento è attivo */}
                {groupBy !== 'NONE' && (
                  <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-500 font-numeric">
                      {groups.length} {groups.length === 1 ? 'gruppo generato' : 'gruppi generati'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          handleExpandAll();
                          setIsGroupingModalOpen(false);
                        }}
                        className="px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition cursor-pointer"
                      >
                        Espandi tutti
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleCollapseAll();
                          setIsGroupingModalOpen(false);
                        }}
                        className="px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                      >
                        Comprimi tutti
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3.5 sm:p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#1C1C1E]/50 flex items-center justify-between gap-2">
                {groupBy !== 'NONE' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setGroupBy('NONE');
                      setIsGroupingModalOpen(false);
                      haptics.tap();
                    }}
                    className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    Azzera raggruppamento
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => setIsGroupingModalOpen(false)}
                  className="px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-full text-xs font-semibold transition cursor-pointer"
                >
                  Chiudi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modale Assegnazione Tag in Blocco */}
      {isBulkTagModalOpen && (
        <BulkTagModal
          isOpen={isBulkTagModalOpen}
          onClose={() => setIsBulkTagModalOpen(false)}
          selectedMovementIds={Array.from(selectedIds)}
          movements={movements}
          onSuccess={handleBulkTagSuccess}
        />
      )}

      {/* Modale Libreria e Gestione Tag Salvati */}
      {isTagManagerModalOpen && (
        <TagManagerModal
          isOpen={isTagManagerModalOpen}
          onClose={() => setIsTagManagerModalOpen(false)}
          onSelectTag={(tag) => {
            setSelectedTag(tag);
            setIsTagManagerModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
