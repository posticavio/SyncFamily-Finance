import React, { useState, useEffect, useMemo } from 'react';
import { 
  FolderKanban, 
  Building, 
  Car, 
  Landmark, 
  Hammer, 
  CreditCard, 
  Plus, 
  Search, 
  Calendar, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  SlidersHorizontal, 
  AlertCircle, 
  Trash2, 
  Edit3, 
  Receipt,
  Layers,
  Sparkles,
  TrendingUp,
  Percent,
  FileText,
  RefreshCw,
  History
} from 'lucide-react';
import { Project, ProjectStats, ProjectType, ProjectStatus, Subcategory, Account, Fund, Movement } from '../types';
import { ProjectService } from '../services/ProjectService';
import { ProjectModal } from './ProjectModal';
import { TabHeaderInfo } from './TabHeaderInfo';
import { haptics } from '../utils/haptics';
import { subscribeToDB } from '../services/store';
import { formatCurrency, formatItalianPercent } from '../utils/formatters';

interface ProjectsViewProps {
  movements: Movement[];
  subcategories: Subcategory[];
  accounts: Account[];
  funds?: Fund[];
  onOpenNewTransactionForProject?: (sottocategoriaId: string, projectId: string) => void;
  onFilterByTag?: (tag: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  movements,
  subcategories,
  accounts,
  funds = [],
  onOpenNewTransactionForProject
}) => {
  const [projectStatsList, setProjectStatsList] = useState<ProjectStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'ALL' | 'FINANZIAMENTI' | 'PRESTITI' | 'MUTUI' | 'PROGETTI'>('ALL');
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  
  // Expanded project movements drawer/accordion
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [expandedTabs, setExpandedTabs] = useState<Record<string, 'movimenti' | 'scadenze' | 'note'>>({});

  // Ricarica le statistiche dei progetti ogni volta che cambiano movimenti o progetti
  const loadStats = async () => {
    try {
      setIsLoading(true);
      const stats = await ProjectService.getAllProjectStats();
      setProjectStatsList(stats);
    } catch (err) {
      console.error("Errore caricamento statistiche progetti:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    const unsubscribe = subscribeToDB(() => {
      loadStats();
    });
    return () => {
      unsubscribe();
    };
  }, [movements]);

  // Sommario generale debiti e progetti
  const overallSummary = useMemo(() => {
    let debitoResiduoTotale = 0;
    let debitoFinanziatoTotale = 0;
    let debitoRimborsatoTotale = 0;
    let rataMensileTotale = 0;
    let budgetProgettiTotale = 0;
    let spesoProgettiTotale = 0;
    let countFinanziamentiAttivi = 0;
    let countProgettiAttivi = 0;

    projectStatsList.forEach(stat => {
      const p = stat.project;
      if (p.stato === 'ATTIVO') {
        const isDebt = p.tipo === 'FINANZIAMENTO' || p.tipo === 'MUTUO' || p.tipo === 'PRESTITO' || p.tipo === 'DEBITO';
        if (isDebt) {
          debitoResiduoTotale += stat.residuo;
          debitoFinanziatoTotale += p.budget_previsto;
          debitoRimborsatoTotale += stat.totaleSpeso;
          if (p.rata_mensile) rataMensileTotale += p.rata_mensile;
          countFinanziamentiAttivi += 1;
        } else {
          budgetProgettiTotale += p.budget_previsto;
          spesoProgettiTotale += stat.totaleSpeso;
          countProgettiAttivi += 1;
        }
      }
    });

    const debitoPercentuale = debitoFinanziatoTotale > 0 
      ? Math.min(100, Math.round((debitoRimborsatoTotale / debitoFinanziatoTotale) * 100)) 
      : 0;

    return {
      debitoResiduoTotale: Math.round(debitoResiduoTotale * 100) / 100,
      debitoFinanziatoTotale: Math.round(debitoFinanziatoTotale * 100) / 100,
      debitoRimborsatoTotale: Math.round(debitoRimborsatoTotale * 100) / 100,
      debitoPercentuale,
      rataMensileTotale: Math.round(rataMensileTotale * 100) / 100,
      budgetProgettiTotale: Math.round(budgetProgettiTotale * 100) / 100,
      spesoProgettiTotale: Math.round(spesoProgettiTotale * 100) / 100,
      countFinanziamentiAttivi,
      countProgettiAttivi
    };
  }, [projectStatsList]);

  // Filtra progetti
  const filteredProjects = useMemo(() => {
    return projectStatsList.filter(stat => {
      const p = stat.project;

      // Filtro stato attivo
      if (showOnlyActive && p.stato !== 'ATTIVO') return false;

      // Filtro per tipologia
      if (selectedTypeFilter === 'FINANZIAMENTI' && p.tipo !== 'FINANZIAMENTO') return false;
      if (selectedTypeFilter === 'MUTUI' && p.tipo !== 'MUTUO') return false;
      if (selectedTypeFilter === 'PRESTITI' && p.tipo !== 'PRESTITO' && p.tipo !== 'DEBITO') return false;
      if (selectedTypeFilter === 'PROGETTI' && p.tipo !== 'PROGETTO') return false;

      // Ricerca testuale
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = p.nome_progetto.toLowerCase().includes(query);
        const matchSub = stat.sottocategoriaNome.toLowerCase().includes(query);
        const matchCat = stat.categoriaPadre.toLowerCase().includes(query);
        const matchNotes = p.note ? p.note.toLowerCase().includes(query) : false;
        if (!matchName && !matchSub && !matchCat && !matchNotes) return false;
      }

      return true;
    });
  }, [projectStatsList, selectedTypeFilter, showOnlyActive, searchQuery]);

  const handleDeleteProject = async (id: string, name: string) => {
    if (confirm(`Sei sicuro di voler eliminare "${name}"? I movimenti registrati non verranno cancellati.`)) {
      try {
        await ProjectService.delete(id);
        haptics.medium();
        await loadStats();
      } catch (err) {
        console.error("Errore eliminazione progetto:", err);
      }
    }
  };

  const getAccountName = (accId?: string) => {
    if (!accId) return null;
    const acc = accounts.find(a => a.id === accId);
    if (acc) return acc.nome_conto;
    const fund = funds.find(f => f.id === accId);
    if (fund) return fund.nome_fondo;
    return null;
  };

  const getTypeIcon = (tipo: ProjectType) => {
    switch (tipo) {
      case 'MUTUO': return <Building size={16} className="text-indigo-600 dark:text-indigo-400" />;
      case 'FINANZIAMENTO': return <Car size={16} className="text-rose-600 dark:text-rose-400" />;
      case 'PRESTITO': return <Landmark size={16} className="text-purple-600 dark:text-purple-400" />;
      case 'DEBITO': return <CreditCard size={16} className="text-amber-600 dark:text-amber-400" />;
      case 'PROGETTO': return <FolderKanban size={16} className="text-amber-600 dark:text-amber-400" />;
    }
  };

  const getTypeBadge = (tipo: ProjectType) => {
    switch (tipo) {
      case 'MUTUO':
        return <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">Mutuo</span>;
      case 'FINANZIAMENTO':
        return <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">Finanziamento</span>;
      case 'PRESTITO':
        return <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">Prestito</span>;
      case 'DEBITO':
        return <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200 dark:border-orange-800/60">Debito</span>;
      case 'PROGETTO':
        return <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">Progetto</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 4. SEZIONE TITOLO PAGINA & AZIONI CONTESTUALI */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
            <FolderKanban size={22} />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Progetti & Finanziamenti <span className="hidden md:inline text-base font-mono font-normal text-slate-400 dark:text-slate-500">(P)</span>
            </h1>
            <TabHeaderInfo text="Monitoraggio centralizzato di prestiti, mutui, debiti e progetti legati a sottocategorie" />
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            id="btn-refresh-projects"
            onClick={() => {
              haptics.tap();
              loadStats();
            }}
            title="Ricarica Progetti e Finanziamenti"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition active:scale-95 shadow-xs"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin text-indigo-600" : ""} />
          </button>

          <button
            id="btn-new-project-open"
            onClick={() => {
              haptics.tap();
              setEditingProject(null);
              setIsModalOpen(true);
            }}
            className="bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-medium text-sm px-4 py-2 rounded-xl transition flex items-center gap-2 shadow-xs active:scale-95"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Nuovo Impegno o Progetto</span>
          </button>
        </div>
      </div>

      {/* 5. METRICHE & STATS CARDS (KPI) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Card 1: Debito Residuo Totale Finanziamenti */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Debito Residuo Totale
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 mb-1 tracking-tight font-numeric tabular-nums">
            {formatCurrency(overallSummary.debitoResiduoTotale)}
          </div>
          <div className="mt-2">
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>Rimborsato: <strong className="tabular-nums font-numeric">{formatCurrency(overallSummary.debitoRimborsatoTotale)}</strong></span>
              <span className="font-semibold tabular-nums font-numeric">{formatItalianPercent(overallSummary.debitoPercentuale, { decimals: 0 })}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                style={{ width: `${overallSummary.debitoPercentuale}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              Su <span className="tabular-nums font-numeric font-medium">{formatCurrency(overallSummary.debitoFinanziatoTotale)}</span> finanziati ({overallSummary.countFinanziamentiAttivi} attivi)
            </p>
          </div>
        </div>

        {/* Card 2: Rata Mensile Complessiva */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Uscite Rate Mensili
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Calendar size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 mb-1 tracking-tight font-numeric tabular-nums">
            {formatCurrency(overallSummary.rataMensileTotale)}
            <span className="text-xs font-normal text-slate-400 ml-1">/mese</span>
          </div>
          <div className="mt-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Rate complessive addebitate per mutui e prestiti in corso.
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
              <Clock size={13} />
              <span>Addebito mensile programmato</span>
            </div>
          </div>
        </div>

        {/* Card 3: Progetti a Lungo Termine */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Progetti a Lungo Termine
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <FolderKanban size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 mb-1 tracking-tight font-numeric tabular-nums">
            {formatCurrency(overallSummary.spesoProgettiTotale)}
          </div>
          <div className="mt-2">
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>Budget previsto: <strong className="tabular-nums font-numeric">{formatCurrency(overallSummary.budgetProgettiTotale)}</strong></span>
              <span className="font-semibold tabular-nums font-numeric">
                {formatItalianPercent(overallSummary.budgetProgettiTotale > 0 ? Math.min(100, Math.round((overallSummary.spesoProgettiTotale / overallSummary.budgetProgettiTotale) * 100)) : 0, { decimals: 0 })}
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                style={{ 
                  width: `${overallSummary.budgetProgettiTotale > 0 ? Math.min(100, Math.round((overallSummary.spesoProgettiTotale / overallSummary.budgetProgettiTotale) * 100)) : 0}%` 
                }}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              {overallSummary.countProgettiAttivi} progetti attivi monitorati
            </p>
          </div>
        </div>
      </div>

      {/* 6. FILTRI, RICERCA E TABELLE / LISTE */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        {/* Gruppo Segmenti */}
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700/60 overflow-x-auto no-scrollbar">
          {[
            { id: 'ALL', label: 'Tutti' },
            { id: 'FINANZIAMENTI', label: 'Finanziamenti' },
            { id: 'MUTUI', label: 'Mutui' },
            { id: 'PRESTITI', label: 'Prestiti' },
            { id: 'PROGETTI', label: 'Progetti' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                haptics.tap();
                setSelectedTypeFilter(tab.id as any);
              }}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all font-medium whitespace-nowrap ${
                selectedTypeFilter === tab.id
                  ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Ricerca e Toggle Stato */}
        <div className="flex items-center gap-2 flex-1 sm:flex-initial">
          <div className="relative flex-1 sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cerca progetti o sottocategorie..."
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs placeholder:text-slate-400"
            />
          </div>

          <button
            onClick={() => {
              haptics.tap();
              setShowOnlyActive(prev => !prev);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all whitespace-nowrap shadow-xs ${
              showOnlyActive
                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/80 font-semibold'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {showOnlyActive ? 'Solo Attivi' : 'Tutti gli stati'}
          </button>
        </div>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-slate-500">
          Caricamento progetti e finanziamenti in corso...
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800">
          <FolderKanban size={36} className="mx-auto text-slate-400 mb-3" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            Nessun progetto o finanziamento trovato
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
            {searchQuery
              ? 'Nessun elemento corrisponde ai filtri di ricerca selezionati.'
              : 'Non hai ancora creato progetti o finanziamenti legati a sottocategorie.'}
          </p>
          <button
            onClick={() => {
              setEditingProject(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs"
          >
            Crea il tuo primo progetto o prestito
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredProjects.map(stat => {
            const p = stat.project;
            const isDebt = p.tipo === 'FINANZIAMENTO' || p.tipo === 'MUTUO' || p.tipo === 'PRESTITO' || p.tipo === 'DEBITO';
            const isExpanded = expandedProjectId === p.id;
            const accountName = getAccountName(p.conto_addebito_id);

            return (
              <div
                key={p.id}
                id={`project-card-${p.id}`}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between overflow-hidden"
              >
                {/* Card Top */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                        {getTypeIcon(p.tipo)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                            {p.nome_progetto}
                          </h3>
                          {getTypeBadge(p.tipo)}
                        </div>
                        {/* Sottocategoria Collegata Determinata */}
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900/30">
                            Sottocategoria: {stat.sottocategoriaNome} ({stat.categoriaPadre})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        title="Modifica"
                        onClick={() => {
                          haptics.tap();
                          setEditingProject(p);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        title="Elimina"
                        onClick={() => handleDeleteProject(p.id, p.nome_progetto)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Financial Numbers Highlight */}
                  <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800/80 mb-3.5">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        {isDebt ? 'Debito Residuo' : 'Budget Rimanente'}
                      </span>
                      <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5 tabular-nums font-numeric">
                        {formatCurrency(stat.residuo)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        {isDebt ? 'Totale Rimborsato' : 'Totale Speso'}
                      </span>
                      <div className="text-lg font-black text-slate-600 dark:text-slate-300 mt-0.5 tabular-nums font-numeric">
                        {formatCurrency(stat.totaleSpeso)}
                      </div>
                      {(Number(p.importo_gia_pagato) > 0 || Number(p.rate_gia_pagate) > 0) && (
                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 block mt-0.5 tabular-nums font-numeric">
                          (incluso {formatCurrency(Number(p.importo_gia_pagato || 0))} pregresso)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-3.5">
                    <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                      <span>{isDebt ? 'Progresso Rimborso' : 'Avanzamento Spesa'}</span>
                      <span className="tabular-nums font-numeric">{formatItalianPercent(stat.percentuale, { decimals: 0 })}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          isDebt ? 'bg-indigo-600' : 'bg-emerald-600'
                        }`}
                        style={{ width: `${stat.percentuale}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>Inizio: {p.data_inizio || 'Non specificata'}</span>
                      <span className="tabular-nums font-numeric">Totale: {formatCurrency(p.budget_previsto)}</span>
                    </div>
                  </div>

                  {/* Banner / Pulsante Finanziamento Già Iniziato */}
                  {(Number(p.importo_gia_pagato) > 0 || Number(p.rate_gia_pagate) > 0) ? (
                    <div className="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 mb-3">
                      <div className="flex items-center gap-2">
                        <History size={14} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <div>
                          <span className="font-bold block text-[11px] sm:text-xs">Finanziamento iniziato prima dell'app</span>
                          <span className="text-[11px] text-amber-700 dark:text-amber-300">
                            Già saldati: <strong className="tabular-nums font-numeric">{formatCurrency(Number(p.importo_gia_pagato || 0))}</strong>
                            {p.rate_gia_pagate ? ` (~ ${p.rate_gia_pagate} rate)` : ''}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          haptics.tap();
                          setEditingProject(p);
                          setIsModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-100 text-[11px] font-semibold transition-colors flex-shrink-0"
                      >
                        Modifica
                      </button>
                    </div>
                  ) : (
                    isDebt && (
                      <div className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 mb-3">
                        <span className="text-[11px]">Finanziamento già iniziato prima dell'app?</span>
                        <button
                          onClick={() => {
                            haptics.tap();
                            setEditingProject(p);
                            setIsModalOpen(true);
                          }}
                          className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline text-[11px] flex items-center gap-1"
                        >
                          + Aggiungi parte già pagata
                        </button>
                      </div>
                    )
                  )}

                  {/* Loan / Installment Details */}
                  {isDebt && (p.rata_mensile || p.numero_rate_totali || p.tasso_interesse) && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100/60 dark:border-indigo-900/30 text-xs mb-3">
                      {p.rata_mensile && (
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">Rata Mensile</span>
                          <span className="font-bold text-indigo-900 dark:text-indigo-200 tabular-nums font-numeric">
                            {formatCurrency(p.rata_mensile)}
                            {p.giorno_addebito_rata && (
                              <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400 block">
                                il {p.giorno_addebito_rata} del mese
                              </span>
                            )}
                          </span>
                        </div>
                      )}

                      {stat.rateRimanentiStimate > 0 && (
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">Rate Rimanenti</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            ~ {stat.rateRimanentiStimate} {p.numero_rate_totali ? `su ${p.numero_rate_totali}` : 'rate'}
                          </span>
                        </div>
                      )}

                      {p.tasso_interesse && (
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">Tasso TAN / TAEG</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {p.tasso_interesse}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Conto addebito & Note */}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                    {accountName && (
                      <span className="flex items-center gap-1">
                        <Landmark size={12} className="text-slate-400" />
                        Addebito: <strong className="text-slate-700 dark:text-slate-300">{accountName}</strong>
                      </span>
                    )}
                    {p.data_fine && (
                      <span className="flex items-center gap-1">
                        <Calendar size={12} className="text-slate-400" />
                        Scadenza: <strong className="text-slate-700 dark:text-slate-300">{p.data_fine}</strong>
                      </span>
                    )}
                  </div>

                  {p.note && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-2.5 bg-slate-50 dark:bg-slate-850 p-2 rounded-lg">
                      "{p.note}"
                    </p>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/40 px-5 py-3 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      haptics.tap();
                      setExpandedProjectId(isExpanded ? null : p.id);
                    }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    <Receipt size={14} />
                    <span>Dettagli ({stat.movimentiCount} mov, {(stat.scadenzeCollegate?.length || 0) + (stat.pianificatiCollegati?.length || 0)} scadenze/pian, {stat.noteCollegate?.length || 0} note)</span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  <button
                    id={`btn-add-movement-project-${p.id}`}
                    onClick={() => {
                      haptics.tap();
                      if (onOpenNewTransactionForProject) {
                        onOpenNewTransactionForProject(p.sottocategoria_id, p.id);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs active:scale-95 transition-all"
                  >
                    <Plus size={14} />
                    <span>{isDebt ? 'Registra Rata' : 'Registra Spesa'}</span>
                  </button>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 p-4 space-y-3">
                    {/* Drawer Tabs */}
                    <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-2">
                      <button
                        onClick={() => setExpandedTabs(prev => ({ ...prev, [p.id]: 'movimenti' }))}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          (expandedTabs[p.id] || 'movimenti') === 'movimenti'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Receipt size={13} />
                        <span>Movimenti ({stat.movimentiCount})</span>
                      </button>

                      <button
                        onClick={() => setExpandedTabs(prev => ({ ...prev, [p.id]: 'scadenze' }))}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          expandedTabs[p.id] === 'scadenze'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Clock size={13} />
                        <span>Scadenze & Pianificati ({(stat.scadenzeCollegate?.length || 0) + (stat.pianificatiCollegati?.length || 0)})</span>
                      </button>

                      <button
                        onClick={() => setExpandedTabs(prev => ({ ...prev, [p.id]: 'note' }))}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          expandedTabs[p.id] === 'note'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        <FileText size={13} />
                        <span>Note ({stat.noteCollegate?.length || 0})</span>
                      </button>
                    </div>

                    {/* Tab 1: Movimenti */}
                    {(expandedTabs[p.id] || 'movimenti') === 'movimenti' && (
                      <div className="space-y-1.5">
                        {/* Voce Quota Già Pagata Pregressa se Finanziamento Già Iniziato */}
                        {(Number(p.importo_gia_pagato) > 0 || Number(p.rate_gia_pagate) > 0) && (
                          <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
                            <div className="flex items-center gap-2">
                              <History size={14} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
                              <div>
                                <span className="font-bold text-amber-900 dark:text-amber-200 block">
                                  Quota già rimborsata prima dell'app
                                </span>
                                <span className="text-[11px] text-amber-700 dark:text-amber-300">
                                  Finanziamento iniziato {p.rate_gia_pagate ? `(${p.rate_gia_pagate} rate pregresse)` : 'in precedenza'}
                                </span>
                              </div>
                            </div>
                            <span className="font-bold text-amber-700 dark:text-amber-300 font-numeric tabular-nums">
                              - {formatCurrency(Number(p.importo_gia_pagato || 0))}
                            </span>
                          </div>
                        )}

                        {stat.movimenti.length === 0 ? (
                          (!p.importo_gia_pagato && !p.rate_gia_pagate) && (
                            <p className="text-xs text-slate-400 italic py-2">
                              Nessun movimento registrato ancora per questo progetto o sottocategoria.
                            </p>
                          )
                        ) : (
                          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                            {stat.movimenti.map(m => (
                              <div 
                                key={m.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-mono text-slate-400">{m.data}</span>
                                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px] sm:max-w-xs">
                                    {m.descrizione}
                                  </span>
                                  {m.tag && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                      #{m.tag}
                                    </span>
                                  )}
                                </div>
                                <span className={`font-bold font-numeric tabular-nums ${
                                  m.tipologia === 'ENTRATA' ? 'text-emerald-600' : 'text-slate-900 dark:text-white'
                                }`}>
                                  {m.tipologia === 'ENTRATA' ? '+' : '-'} {formatCurrency(m.importo)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 2: Scadenze & Pianificati */}
                    {expandedTabs[p.id] === 'scadenze' && (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {(!stat.scadenzeCollegate || stat.scadenzeCollegate.length === 0) &&
                         (!stat.pianificatiCollegati || stat.pianificatiCollegati.length === 0) ? (
                          <p className="text-xs text-slate-400 italic py-2">
                            Nessuna scadenza o movimento pianificato per questo progetto.
                          </p>
                        ) : (
                          <>
                            {stat.scadenzeCollegate && stat.scadenzeCollegate.length > 0 && (
                              <div className="space-y-1.5">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Scadenze</span>
                                {stat.scadenzeCollegate.map(s => (
                                  <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-mono text-slate-400">{s.data_scadenza}</span>
                                      <span className="font-medium text-slate-800 dark:text-slate-200">{s.descrizione}</span>
                                      <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded ${
                                        s.priorita === 'ALTA' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                                        s.priorita === 'MEDIA' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                                        'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                      }`}>
                                        {s.priorita}
                                      </span>
                                    </div>
                                    <span className="font-bold text-slate-900 dark:text-white font-numeric tabular-nums">{formatCurrency(s.importo_previsto)}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {stat.pianificatiCollegati && stat.pianificatiCollegati.length > 0 && (
                              <div className="space-y-1.5 mt-2">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Movimenti Pianificati</span>
                                {stat.pianificatiCollegati.map(pia => (
                                  <div key={pia.id} className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-mono text-slate-400">{pia.data_prevista}</span>
                                      <span className="font-medium text-slate-800 dark:text-slate-200">{pia.descrizione}</span>
                                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.2 rounded">
                                        {pia.stato}
                                      </span>
                                    </div>
                                    <span className="font-bold text-slate-900 dark:text-white font-numeric tabular-nums">{formatCurrency(pia.importo)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Tab 3: Note */}
                    {expandedTabs[p.id] === 'note' && (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {!stat.noteCollegate || stat.noteCollegate.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-2">
                            Nessuna nota o appunto collegato a questo progetto.
                          </p>
                        ) : (
                          stat.noteCollegate.map(n => (
                            <div key={n.id} className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-xs">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-slate-900 dark:text-white">{n.titolo}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{n.data_creazione}</span>
                              </div>
                              {n.contenuto && (
                                <p className="text-slate-600 dark:text-slate-300 text-[11px] line-clamp-2">
                                  {n.contenuto}
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Creazione / Modifica Progetto */}
      {isModalOpen && (
        <ProjectModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSaved={loadStats}
          editingProject={editingProject}
          subcategories={subcategories}
          accounts={accounts}
          funds={funds}
        />
      )}
    </div>
  );
};
