import React, { useState, useEffect, useMemo } from 'react';
import { 
  Repeat, 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Filter, 
  TrendingDown, 
  TrendingUp, 
  Sparkles, 
  Play, 
  Edit3, 
  Trash2, 
  Power, 
  Layers, 
  CalendarClock, 
  Check, 
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  Link2
} from 'lucide-react';
import { 
  Recurrence, 
  Subcategory, 
  Account, 
  Fund, 
  MovementType,
  Movement
} from '../types';
import { RecurrenceService } from '../services/RecurrenceService';
import { MovementService } from '../services/MovementService';
import { CategoryIcon } from './CategoryIcon';
import { RecurrenceModal } from './RecurrenceModal';
import { MovementLinkSelectorModal } from './MovementLinkSelectorModal';
import { TabHeaderInfo } from './TabHeaderInfo';
import { formatCurrency } from '../utils/formatters';
import { haptics } from '../utils/haptics';

interface RecurrencesViewProps {
  subcategories: Subcategory[];
  accounts: Account[];
  funds: Fund[];
  onNavigateToCalendar?: () => void;
  onNavigateToTransactions?: () => void;
  onRefresh?: () => void;
}

type FilterTab = 'ALL' | 'USCITE' | 'ENTRATE' | 'TOT_VOLTE' | 'INATTIVE';
type ViewMode = 'CARDS' | 'GROUPED_SUBCATEGORY';

export const RecurrencesView: React.FC<RecurrencesViewProps> = ({
  subcategories,
  accounts,
  funds,
  onNavigateToCalendar,
  onNavigateToTransactions,
  onRefresh
}) => {
  const [recurrences, setRecurrences] = useState<Recurrence[]>([]);
  const [linkedCounts, setLinkedCounts] = useState<Record<string, number>>({});
  const [metrics, setMetrics] = useState({
    totaleRicorrenze: 0,
    attiveCount: 0,
    usciteMensiliStimate: 0,
    entrateMensiliStimate: 0,
    aTermineCount: 0,
    subcategoriesMap: {} as Record<string, { count: number; totaleImporto: number }>
  });
  const [loading, setLoading] = useState(true);

  // Filter & Search States
  const [activeFilter, setActiveFilter] = useState<FilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('CARDS');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecurrence, setSelectedRecurrence] = useState<Recurrence | null>(null);
  const [initialSubId, setInitialSubId] = useState<string | undefined>(undefined);

  // Direct Movement Linking Modal State
  const [linkingRecurrence, setLinkingRecurrence] = useState<Recurrence | null>(null);
  const [linkingMovementsAll, setLinkingMovementsAll] = useState<Movement[]>([]);
  const [linkingSelectedIds, setLinkingSelectedIds] = useState<string[]>([]);

  // Success message toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allRecs, stats] = await Promise.all([
        RecurrenceService.getAll(),
        RecurrenceService.getMetrics()
      ]);
      setRecurrences(allRecs);
      setMetrics(stats);

      // Calcola quanti movimenti sono collegati per ciascuna ricorrenza
      const counts: Record<string, number> = {};
      await Promise.all(
        allRecs.map(async (r) => {
          const linked = await RecurrenceService.getLinkedMovements(r.id);
          counts[r.id] = linked.length;
        })
      );
      setLinkedCounts(counts);
    } catch (e) {
      console.error("Errore caricamento ricorrenze:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleOpenNew = (subId?: string) => {
    setSelectedRecurrence(null);
    setInitialSubId(subId);
    setIsModalOpen(true);
    haptics.tap();
  };

  const handleOpenEdit = (rec: Recurrence) => {
    setSelectedRecurrence(rec);
    setInitialSubId(undefined);
    setIsModalOpen(true);
    haptics.tap();
  };

  const handleOpenDirectLinkModal = async (rec: Recurrence, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    haptics.tap();
    try {
      const [allList, linked] = await Promise.all([
        MovementService.getAll(),
        RecurrenceService.getLinkedMovements(rec.id)
      ]);
      setLinkingRecurrence(rec);
      setLinkingMovementsAll(allList);
      setLinkingSelectedIds(linked.map(m => m.id));
    } catch (err) {
      console.error("Errore apertura finestra collegamento movimenti:", err);
    }
  };

  const handleConfirmDirectLink = async (selectedIds: string[]) => {
    if (!linkingRecurrence) return;
    try {
      haptics.impact();
      await RecurrenceService.linkMovements(linkingRecurrence.id, selectedIds, true);
      showToast(`Aggiornati ${selectedIds.length} movimenti collegati per "${linkingRecurrence.nome}".`);
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Errore durante il collegamento dei movimenti.");
    } finally {
      setLinkingRecurrence(null);
    }
  };

  const handleToggleActive = async (rec: Recurrence, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      haptics.tap();
      const newState = await RecurrenceService.toggleActive(rec.id);
      showToast(`Ricorrenza "${rec.nome}" ${newState ? 'riattivata' : 'messa in pausa'}.`);
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleExecuteOccurrence = async (rec: Recurrence, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      haptics.impact();
      const mov = await RecurrenceService.executeOccurrence(rec.id);
      showToast(`Registrato movimento: ${mov.descrizione} (${formatCurrency(mov.importo)})`);
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Errore durante la registrazione.');
    }
  };

  const handleSyncPlanned = async () => {
    try {
      haptics.impact();
      await RecurrenceService.syncAllActiveRecurrences();
      showToast('Movimenti pianificati sincronizzati nel calendario.');
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  // Sottocategorie map
  const subMap = useMemo(() => {
    const map = new Map<string, Subcategory>();
    subcategories.forEach(s => map.set(s.id, s));
    return map;
  }, [subcategories]);

  // Account map
  const accountMap = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach(a => map.set(a.id, a.nome_conto));
    funds.forEach(f => map.set(f.id, f.nome_fondo));
    return map;
  }, [accounts, funds]);

  // Filtro ricorrenze
  const filteredRecurrences = useMemo(() => {
    return recurrences.filter(r => {
      // 1. Filtro Tab
      if (activeFilter === 'USCITE' && r.tipologia !== 'USCITA') return false;
      if (activeFilter === 'ENTRATE' && r.tipologia !== 'ENTRATA') return false;
      if (activeFilter === 'TOT_VOLTE' && r.tipo_limite !== 'TOT_VOLTE') return false;
      if (activeFilter === 'INATTIVE' && r.attiva) return false;

      // 2. Ricerca
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const sub = subMap.get(r.sottocategoria_id);
        const subName = sub?.nome.toLowerCase() || '';
        const parentName = sub?.categoria_padre.toLowerCase() || '';
        const recName = r.nome.toLowerCase();
        const note = (r.note || '').toLowerCase();
        if (!recName.includes(q) && !subName.includes(q) && !parentName.includes(q) && !note.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [recurrences, activeFilter, searchQuery, subMap]);

  // Raggruppamento per Sottocategoria
  const groupedBySubcategory = useMemo(() => {
    const map = new Map<string, { subcategory: Subcategory | undefined; items: Recurrence[]; totale: number }>();
    
    filteredRecurrences.forEach(rec => {
      const subId = rec.sottocategoria_id;
      if (!map.has(subId)) {
        map.set(subId, {
          subcategory: subMap.get(subId),
          items: [],
          totale: 0
        });
      }
      const group = map.get(subId)!;
      group.items.push(rec);
      group.totale += rec.importo;
    });

    return Array.from(map.values()).sort((a, b) => {
      const nameA = a.subcategory?.nome || '';
      const nameB = b.subcategory?.nome || '';
      return nameA.localeCompare(nameB);
    });
  }, [filteredRecurrences, subMap]);

  return (
    <div 
      className="space-y-4 sm:space-y-6 animate-fadeIn pb-12"
      style={{ fontFamily: "'Google Sans', 'Product Sans', sans-serif" }}
    >
      {/* Toast Notifica Flottante */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-50 bg-slate-900/95 dark:bg-[#222428]/95 backdrop-blur-md border border-slate-800 dark:border-[#2F3136] text-white dark:text-[#EAEBED] px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-slideUp">
          <div className="w-7 h-7 rounded-xl bg-[#E31B23]/20 flex items-center justify-center text-[#E31B23]">
            <Check size={16} />
          </div>
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* 1. HERO VIEWING AREA (Samsung One UI) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#EAEBED] tracking-tight flex items-center gap-2.5">
            <span>Gestione Ricorrenze</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-[#E31B23]/15 text-[#E31B23] border border-[#E31B23]/30">
              {metrics.attiveCount} attive
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-[#9A9DA5] mt-0.5">
            Sottocategorie con pagamenti periodici, abbonamenti fissi o rate a termine
          </p>
        </div>

        {/* Action Buttons Header */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSyncPlanned}
            className="px-3.5 py-2 rounded-2xl text-xs font-semibold bg-white dark:bg-[#222428] hover:bg-slate-50 dark:hover:bg-[#2A2C31] text-slate-700 dark:text-[#9A9DA5] hover:text-slate-900 dark:hover:text-[#EAEBED] border border-slate-200 dark:border-[#2F3136] transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
            title="Sincronizza le date future nel calendario pianificato"
          >
            <CalendarClock size={15} />
            <span className="hidden sm:inline">Sincronizza Calendario</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenNew()}
            className="px-4 py-2 rounded-2xl text-xs font-bold bg-[#E31B23] hover:bg-[#c9151c] text-white shadow-lg shadow-red-950/20 dark:shadow-red-950/40 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Plus size={16} />
            <span>Nuova Ricorrenza</span>
          </button>
        </div>
      </div>

      {/* 2. KPI ACCORDION & CARDS SINTETICHE (One UI Insights) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Uscite Mensili Stimate */}
        <div className="p-4 rounded-3xl bg-white dark:bg-[#222428] border border-slate-200/80 dark:border-[#2F3136] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-[#9A9DA5] uppercase tracking-wider">
              Uscite Ricorrenti
            </span>
            <div className="w-7 h-7 rounded-xl bg-red-500/10 dark:bg-red-500/15 flex items-center justify-center text-red-600 dark:text-red-400">
              <TrendingDown size={14} />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-[#EAEBED] tabular-nums">
            {formatCurrency(metrics.usciteMensiliStimate)}
          </div>
          <div className="text-[10.5px] text-slate-400 dark:text-[#9A9DA5] mt-0.5">
            Impegno fisso stimato al mese
          </div>
        </div>

        {/* KPI 2: Entrate Ricorrenti Stimate */}
        <div className="p-4 rounded-3xl bg-white dark:bg-[#222428] border border-slate-200/80 dark:border-[#2F3136] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-[#9A9DA5] uppercase tracking-wider">
              Entrate Ricorrenti
            </span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <TrendingUp size={14} />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatCurrency(metrics.entrateMensiliStimate)}
          </div>
          <div className="text-[10.5px] text-slate-400 dark:text-[#9A9DA5] mt-0.5">
            Stipendi e rendite fisse mensili
          </div>
        </div>

        {/* KPI 3: A Termine / Con Limite Rate */}
        <div className="p-4 rounded-3xl bg-white dark:bg-[#222428] border border-slate-200/80 dark:border-[#2F3136] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-[#9A9DA5] uppercase tracking-wider">
              A Scadenza (Tot Rate)
            </span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <CalendarClock size={14} />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-[#EAEBED] tabular-nums">
            {metrics.aTermineCount}
          </div>
          <div className="text-[10.5px] text-slate-400 dark:text-[#9A9DA5] mt-0.5">
            Spese che termineranno
          </div>
        </div>

        {/* KPI 4: Sottocategorie Coinvolte */}
        <div className="p-4 rounded-3xl bg-white dark:bg-[#222428] border border-slate-200/80 dark:border-[#2F3136] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-[#9A9DA5] uppercase tracking-wider">
              Sottocategorie Attive
            </span>
            <div className="w-7 h-7 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/15 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Layers size={14} />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-[#EAEBED] tabular-nums">
            {Object.keys(metrics.subcategoriesMap).length}
          </div>
          <div className="text-[10.5px] text-slate-400 dark:text-[#9A9DA5] mt-0.5">
            Con almeno 1 regola periodica
          </div>
        </div>
      </div>

      {/* 3. STICKY FILTER BAR & SEARCH (One UI Capsule Bar) */}
      <div className="p-3 rounded-2xl bg-white dark:bg-[#222428] border border-slate-200/80 dark:border-[#2F3136] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Filtri a pillola */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => {
              setActiveFilter('ALL');
              haptics.tap();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeFilter === 'ALL'
                ? 'bg-[#E31B23] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-[#18191B] text-slate-600 dark:text-[#9A9DA5] hover:text-slate-900 dark:hover:text-[#EAEBED] border border-slate-200/80 dark:border-[#2F3136]'
            }`}
          >
            Tutte ({recurrences.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveFilter('USCITE');
              haptics.tap();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeFilter === 'USCITE'
                ? 'bg-[#E31B23] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-[#18191B] text-slate-600 dark:text-[#9A9DA5] hover:text-slate-900 dark:hover:text-[#EAEBED] border border-slate-200/80 dark:border-[#2F3136]'
            }`}
          >
            Uscite
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveFilter('ENTRATE');
              haptics.tap();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeFilter === 'ENTRATE'
                ? 'bg-[#E31B23] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-[#18191B] text-slate-600 dark:text-[#9A9DA5] hover:text-slate-900 dark:hover:text-[#EAEBED] border border-slate-200/80 dark:border-[#2F3136]'
            }`}
          >
            Entrate
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveFilter('TOT_VOLTE');
              haptics.tap();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeFilter === 'TOT_VOLTE'
                ? 'bg-[#E31B23] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-[#18191B] text-slate-600 dark:text-[#9A9DA5] hover:text-slate-900 dark:hover:text-[#EAEBED] border border-slate-200/80 dark:border-[#2F3136]'
            }`}
          >
            A Rate (Tot volte)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveFilter('INATTIVE');
              haptics.tap();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeFilter === 'INATTIVE'
                ? 'bg-[#E31B23] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-[#18191B] text-slate-600 dark:text-[#9A9DA5] hover:text-slate-900 dark:hover:text-[#EAEBED] border border-slate-200/80 dark:border-[#2F3136]'
            }`}
          >
            In Pausa
          </button>
        </div>

        {/* Ricerca e Selettore Vista */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search size={14} className="absolute left-3 top-3 text-slate-400 dark:text-[#9A9DA5]" />
            <input
              type="text"
              placeholder="Cerca ricorrenza o categoria..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-8 pr-3 rounded-xl bg-slate-100 dark:bg-[#18191B] border border-slate-200/80 dark:border-[#2F3136] text-xs text-slate-900 dark:text-[#EAEBED] placeholder-slate-400 dark:placeholder-[#6E7179] focus:outline-none focus:border-[#E31B23] transition-all"
            />
          </div>

          <div className="flex items-center p-0.5 bg-slate-100 dark:bg-[#18191B] rounded-xl border border-slate-200/80 dark:border-[#2F3136] shrink-0">
            <button
              type="button"
              onClick={() => {
                setViewMode('CARDS');
                haptics.tap();
              }}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === 'CARDS'
                  ? 'bg-white dark:bg-[#2A2C31] text-slate-900 dark:text-[#EAEBED] shadow-xs'
                  : 'text-slate-500 dark:text-[#9A9DA5] hover:text-slate-900 dark:hover:text-[#EAEBED]'
              }`}
              title="Vista Card Singole"
            >
              Singole
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('GROUPED_SUBCATEGORY');
                haptics.tap();
              }}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === 'GROUPED_SUBCATEGORY'
                  ? 'bg-white dark:bg-[#2A2C31] text-slate-900 dark:text-[#EAEBED] shadow-xs'
                  : 'text-slate-500 dark:text-[#9A9DA5] hover:text-slate-900 dark:hover:text-[#EAEBED]'
              }`}
              title="Raggruppa per Sottocategoria"
            >
              Per Categoria
            </button>
          </div>
        </div>
      </div>

      {/* 4. LISTA RICORRENZE (ISLAND CONTAINER) */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 dark:text-[#9A9DA5] text-sm">
          Caricamento ricorrenze in corso...
        </div>
      ) : filteredRecurrences.length === 0 ? (
        <div className="p-10 rounded-3xl bg-white dark:bg-[#222428] border border-slate-200/80 dark:border-[#2F3136] shadow-xs text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-[#18191B] border border-slate-200/80 dark:border-[#2F3136] mx-auto flex items-center justify-center text-slate-400 dark:text-[#9A9DA5]">
            <Repeat size={24} />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-[#EAEBED]">
            Nessuna ricorrenza trovata
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#9A9DA5] max-w-md mx-auto">
            Non ci sono spese o entrate ricorrenti che corrispondono ai filtri selezionati. Crea una nuova regola per gestire rate o pagamenti periodici.
          </p>
          <button
            type="button"
            onClick={() => handleOpenNew()}
            className="mt-2 px-4 py-2 rounded-2xl text-xs font-bold bg-[#E31B23] text-white inline-flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-md shadow-red-950/20"
          >
            <Plus size={16} />
            <span>Crea la prima ricorrenza</span>
          </button>
        </div>
      ) : viewMode === 'GROUPED_SUBCATEGORY' ? (
        /* VISTA RAGGRUPPATA PER SOTTOCATEGORIA */
        <div className="space-y-4">
          {groupedBySubcategory.map(({ subcategory, items, totale }) => {
            if (!subcategory) return null;
            return (
              <div 
                key={subcategory.id}
                className="rounded-3xl bg-white dark:bg-[#222428] border border-slate-200/80 dark:border-[#2F3136] overflow-hidden shadow-xs"
              >
                {/* Header Gruppo Sottocategoria */}
                <div className="p-4 bg-slate-50 dark:bg-[#1E2024] border-b border-slate-200/80 dark:border-[#2F3136] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xs"
                      style={{ backgroundColor: subcategory.colore || '#E31B23' }}
                    >
                      <CategoryIcon iconName={subcategory.icon_name} className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-[#EAEBED]">
                        {subcategory.nome}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-[#9A9DA5]">
                        {subcategory.categoria_padre} • {items.length} {items.length === 1 ? 'regola ricorrente' : 'regole ricorrenti'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-bold font-mono text-slate-900 dark:text-[#EAEBED] tabular-nums">
                        {formatCurrency(totale)}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-[#9A9DA5]">
                        totale cumulato
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenNew(subcategory.id)}
                      className="w-8 h-8 rounded-xl bg-white dark:bg-[#2A2C31] hover:bg-slate-100 dark:hover:bg-[#34373D] border border-slate-200/80 dark:border-[#2F3136] text-slate-700 dark:text-[#EAEBED] flex items-center justify-center transition-all cursor-pointer shadow-xs"
                      title="Aggiungi ricorrenza per questa sottocategoria"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>

                {/* Items interni alla sottocategoria */}
                <div className="divide-y divide-slate-100 dark:divide-[#2F3136]/60">
                  {items.map(rec => renderRecurrenceCard(rec, subcategory))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VISTA CARD SINGOLE (ISOLA UNICA) */
        <div className="rounded-3xl bg-white dark:bg-[#222428] border border-slate-200/80 dark:border-[#2F3136] overflow-hidden divide-y divide-slate-100 dark:divide-[#2F3136]/60 shadow-xs">
          {filteredRecurrences.map(rec => {
            const sub = subMap.get(rec.sottocategoria_id);
            return renderRecurrenceCard(rec, sub);
          })}
        </div>
      )}

      {/* MODALE CREAZIONE / MODIFICA */}
      {isModalOpen && (
        <RecurrenceModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          subcategories={subcategories}
          accounts={accounts}
          funds={funds}
          recurrenceToEdit={selectedRecurrence}
          initialSubcategoryId={initialSubId}
          onSuccess={() => {
            loadData();
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {/* Finestra Estesa a Schermo Intero per Collegamento Movimenti */}
      {linkingRecurrence && (
        <MovementLinkSelectorModal
          isOpen={!!linkingRecurrence}
          onClose={() => setLinkingRecurrence(null)}
          onConfirm={handleConfirmDirectLink}
          allMovements={linkingMovementsAll}
          initialSelectedIds={linkingSelectedIds}
          currentSubcategoryId={linkingRecurrence.sottocategoria_id}
          subcategories={subcategories}
          accounts={accounts}
          funds={funds}
          recurrenceName={linkingRecurrence.nome}
          targetAmount={linkingRecurrence.importo}
          targetType={linkingRecurrence.tipologia}
          recurrenceLimitType={linkingRecurrence.tipo_limite}
          totalRepetitions={linkingRecurrence.ripetizioni_totali}
        />
      )}
    </div>
  );

  function renderRecurrenceCard(rec: Recurrence, sub?: Subcategory) {
    const isTotVolte = rec.tipo_limite === 'TOT_VOLTE' && rec.ripetizioni_totali;
    const eseguite = rec.ripetizioni_eseguite || 0;
    const totali = rec.ripetizioni_totali || 1;
    const percentuale = Math.min(100, Math.round((eseguite / totali) * 100));
    const rimanenti = Math.max(0, totali - eseguite);

    const isUscita = rec.tipologia === 'USCITA';
    const accountName = accountMap.get(rec.conto_id) || 'Conto Principale';

    return (
      <div 
        key={rec.id}
        onClick={() => handleOpenEdit(rec)}
        className={`p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer ${
          rec.attiva ? 'hover:bg-slate-50 dark:hover:bg-[#2A2C31]/50' : 'bg-slate-50/50 dark:bg-[#18191B]/40 opacity-70 hover:opacity-100'
        }`}
      >
        {/* Sinistra: Micro-Squircle + Info Base */}
        <div className="flex items-start gap-3 min-w-0">
          {/* Micro-Squircle Categoria */}
          <div 
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 border border-black/10 dark:border-[#3A3D45]/60 shadow-xs"
            style={{ backgroundColor: sub?.colore || '#E31B23' }}
          >
            <CategoryIcon iconName={sub?.icon_name || 'Tag'} className="w-5 h-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-900 dark:text-[#EAEBED] truncate">
                {rec.nome}
              </span>
              
              {!rec.attiva && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                  In Pausa
                </span>
              )}

              {/* Pillola Frequenza */}
              <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-slate-100 dark:bg-[#18191B] text-slate-600 dark:text-[#9A9DA5] border border-slate-200 dark:border-[#2F3136]">
                {rec.frequenza.toLowerCase()} • giorno {rec.giorno_esecuzione}
              </span>

              {/* Se a tot volte: badge progresso */}
              {isTotVolte && (
                <span className="text-[10.5px] px-2 py-0.5 rounded-md font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  Rata {eseguite} di {totali}
                </span>
              )}

              {/* Pillola Movimenti Collegati (Cliccabile per apertura rapida selettore) */}
              {linkedCounts[rec.id] !== undefined && (
                <button
                  type="button"
                  onClick={(e) => handleOpenDirectLinkModal(rec, e)}
                  className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-md font-bold border transition-all cursor-pointer ${
                    linkedCounts[rec.id] > 0
                      ? 'bg-blue-500/10 dark:bg-blue-500/15 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/25'
                      : 'bg-slate-100 dark:bg-[#18191B] hover:bg-slate-200 dark:hover:bg-[#2A2C31] text-slate-500 dark:text-[#9A9DA5] border-slate-200 dark:border-[#2F3136]'
                  }`}
                  title="Clicca per aprire la finestra di collegamento e filtro movimenti"
                >
                  <Link2 size={10} />
                  <span>{linkedCounts[rec.id]} {linkedCounts[rec.id] === 1 ? 'movimento collegato' : 'movimenti collegati'}</span>
                </button>
              )}
            </div>

            {/* Metadati Sottocategoria & Conto */}
            <div className="text-xs text-slate-500 dark:text-[#9A9DA5] mt-1 flex items-center gap-2 flex-wrap">
              <span>{sub?.nome || 'Sottocategoria'}</span>
              <span>•</span>
              <span>{accountName}</span>
              {rec.prossima_data && (
                <>
                  <span>•</span>
                  <span className="text-blue-600 dark:text-blue-400 font-mono">
                    Prossima: {rec.prossima_data.split('-').reverse().join('/')}
                  </span>
                </>
              )}
            </div>

            {/* Barra di Completamento Rate per TOT_VOLTE */}
            {isTotVolte && (
              <div className="mt-2.5 max-w-xs space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-[#9A9DA5]">
                  <span>Progresso rate saldate</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-[#EAEBED]">{percentuale}% ({rimanenti} rimaste)</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-[#18191B] rounded-full overflow-hidden border border-slate-200 dark:border-[#2F3136]">
                  <div 
                    className="h-full bg-[#E31B23] transition-all duration-500"
                    style={{ width: `${percentuale}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Destra: Importo & Azioni Rapide */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-[#2F3136]/40">
          <div className="text-left sm:text-right">
            <div className={`text-base font-bold font-mono tabular-nums ${
              isUscita ? 'text-slate-900 dark:text-[#EAEBED]' : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {isUscita ? '-' : '+'}{formatCurrency(rec.importo)}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-[#9A9DA5]">
              per ciascuna volta
            </div>
          </div>

          {/* Azioni Rapide One UI */}
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {/* Esegui Adesso Rata */}
            {rec.attiva && (
              <button
                type="button"
                onClick={(e) => handleExecuteOccurrence(rec, e)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                title="Registra subito il movimento reale per questa ricorrenza"
              >
                <Play size={13} fill="currentColor" />
                <span className="hidden md:inline">Registra Rata</span>
              </button>
            )}

            {/* Collega Movimenti Passati */}
            <button
              type="button"
              onClick={(e) => handleOpenDirectLinkModal(rec, e)}
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#18191B] hover:bg-slate-200 dark:hover:bg-[#2A2C31] border border-slate-200 dark:border-[#2F3136] text-slate-600 dark:text-[#9A9DA5] hover:text-[#E31B23] flex items-center justify-center transition-all cursor-pointer shadow-2xs"
              title="Cerca e associa movimenti passati a questa ricorrenza"
            >
              <Link2 size={14} />
            </button>

            {/* Toggle Attiva / Pausa */}
            <button
              type="button"
              onClick={(e) => handleToggleActive(rec, e)}
              className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                rec.attiva
                  ? 'bg-slate-100 dark:bg-[#18191B] hover:bg-slate-200 dark:hover:bg-[#2A2C31] border-slate-200 dark:border-[#2F3136] text-slate-600 dark:text-[#9A9DA5] hover:text-slate-900 dark:hover:text-[#EAEBED]'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
              }`}
              title={rec.attiva ? 'Metti in pausa la ricorrenza' : 'Riattiva la ricorrenza'}
            >
              <Power size={14} />
            </button>

            {/* Modifica */}
            <button
              type="button"
              onClick={() => handleOpenEdit(rec)}
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#18191B] hover:bg-slate-200 dark:hover:bg-[#2A2C31] border border-slate-200 dark:border-[#2F3136] text-slate-600 dark:text-[#9A9DA5] hover:text-slate-900 dark:hover:text-[#EAEBED] flex items-center justify-center transition-all cursor-pointer shadow-2xs"
              title="Modifica regola di ricorrenza"
            >
              <Edit3 size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }
};
