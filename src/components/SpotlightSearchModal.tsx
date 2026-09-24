import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  X, 
  ArrowRight, 
  Plus, 
  PieChart, 
  ListFilter, 
  Calendar, 
  Sparkles, 
  Landmark, 
  FolderKanban, 
  StickyNote, 
  FileSpreadsheet, 
  Database, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Tag, 
  Calculator, 
  ShieldAlert,
  LineChart
} from 'lucide-react';
import { Movement, Subcategory, Account, Fund, Project, NoteItem } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { haptics } from '../utils/haptics';

interface SpotlightSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  movements: Movement[];
  subcategories: Subcategory[];
  accounts: Account[];
  funds: Fund[];
  projects?: Project[];
  notes?: NoteItem[];
  onNavigateTab: (tab: any) => void;
  onOpenNewTransaction: () => void;
  onOpenReconciliation: () => void;
  onOpenBackup: () => void;
  onOpenPurchaseImpact?: () => void;
  onOpenExportSummary?: () => void;
}

export const SpotlightSearchModal: React.FC<SpotlightSearchModalProps> = ({
  isOpen,
  onClose,
  movements,
  subcategories,
  accounts,
  funds,
  projects = [],
  notes = [],
  onNavigateTab,
  onOpenNewTransaction,
  onOpenReconciliation,
  onOpenBackup,
  onOpenPurchaseImpact,
  onOpenExportSummary
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Azioni veloci globali
  const quickActions = useMemo(() => [
    {
      id: 'act-new-tx',
      title: 'Nuova Operazione (Spesa / Entrata / Giroconto)',
      subtitle: 'Registra un nuovo movimento o trasferimento',
      icon: Plus,
      color: 'bg-[#E31B23] text-white',
      action: () => { onClose(); onOpenNewTransaction(); }
    },
    {
      id: 'act-analisi',
      title: 'Analisi & Grafici Finanziari',
      subtitle: 'Flussi Sankey, entrate vs uscite 50/30/20 e proiezioni saldi',
      icon: LineChart,
      color: 'bg-[#E31B23]/15 text-[#E31B23]',
      action: () => { onClose(); onNavigateTab('ANALISI'); }
    },
    {
      id: 'act-whatif',
      title: 'Simulatore Impatto Nuovo Acquisto (What-If)',
      subtitle: 'Valuta come una spesa straordinaria impatta budget e liquidità',
      icon: Calculator,
      color: 'bg-indigo-500/15 text-indigo-500',
      action: () => { onClose(); onOpenPurchaseImpact?.(); }
    },
    {
      id: 'act-export-pdf',
      title: 'Esporta Report Mensile (PDF / Stampa)',
      subtitle: 'Genera il prospetto riassuntivo elegante del mese',
      icon: FileSpreadsheet,
      color: 'bg-emerald-500/15 text-emerald-500',
      action: () => { onClose(); onOpenExportSummary?.(); }
    },
    {
      id: 'act-reconcile',
      title: 'Riconciliazione Estratto Conto Bancario',
      subtitle: 'Verifica e allinea i movimenti del conto',
      icon: Landmark,
      color: 'bg-blue-500/15 text-blue-500',
      action: () => { onClose(); onOpenReconciliation(); }
    },
    {
      id: 'act-report-ai',
      title: 'Report Finanziario Settimanale AI Gemini',
      subtitle: 'Consigli pratici e analisi di salute economica',
      icon: Sparkles,
      color: 'bg-purple-500/15 text-purple-500',
      action: () => { onClose(); onNavigateTab('REPORT_AI'); }
    },
    {
      id: 'act-backup',
      title: 'Backup & Ripristino Dati JSON',
      subtitle: 'Esporta o carica archivio delle finanze',
      icon: Database,
      color: 'bg-amber-500/15 text-amber-500',
      action: () => { onClose(); onOpenBackup(); }
    }
  ], [onClose, onOpenNewTransaction, onOpenPurchaseImpact, onOpenExportSummary, onOpenReconciliation, onNavigateTab, onOpenBackup]);

  // Risultati filtrati
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return {
        actions: quickActions,
        movements: movements.slice(0, 5),
        accounts: [...accounts, ...funds].slice(0, 4),
        subcategories: subcategories.slice(0, 4),
        projects: projects.slice(0, 3),
        notes: notes.slice(0, 3)
      };
    }

    return {
      actions: quickActions.filter(a => a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q)),
      movements: movements.filter(m => 
        (m.descrizione && m.descrizione.toLowerCase().includes(q)) ||
        (m.importo && m.importo.toString().includes(q)) ||
        (m.tag && m.tag.toLowerCase().includes(q)) ||
        (m.tags && m.tags.some(t => t.toLowerCase().includes(q)))
      ).slice(0, 8),
      accounts: [...accounts, ...funds].filter(a => {
        const name = 'nome_conto' in a ? a.nome_conto : a.nome_fondo;
        return name && name.toLowerCase().includes(q);
      }).slice(0, 5),
      subcategories: subcategories.filter(s => 
        (s.nome && s.nome.toLowerCase().includes(q)) ||
        (s.categoria_padre && s.categoria_padre.toLowerCase().includes(q))
      ).slice(0, 6),
      projects: projects.filter(p => p.nome && p.nome.toLowerCase().includes(q)).slice(0, 4),
      notes: notes.filter(n => (n.titolo && n.titolo.toLowerCase().includes(q)) || (n.contenuto && n.contenuto.toLowerCase().includes(q))).slice(0, 4)
    };
  }, [query, quickActions, movements, accounts, funds, subcategories, projects, notes]);

  const flatList = useMemo(() => {
    const list: Array<{ type: string; item: any; execute: () => void }> = [];
    results.actions.forEach(a => list.push({ type: 'action', item: a, execute: a.action }));
    results.movements.forEach(m => list.push({ 
      type: 'movement', 
      item: m, 
      execute: () => { onClose(); onNavigateTab('TRANSAZIONI'); }
    }));
    results.accounts.forEach(a => list.push({ 
      type: 'account', 
      item: a, 
      execute: () => { onClose(); onNavigateTab('CONTI'); }
    }));
    results.subcategories.forEach(s => list.push({ 
      type: 'subcategory', 
      item: s, 
      execute: () => { onClose(); onNavigateTab('BUDGET'); }
    }));
    results.projects.forEach(p => list.push({ 
      type: 'project', 
      item: p, 
      execute: () => { onClose(); onNavigateTab('PROGETTI'); }
    }));
    results.notes.forEach(n => list.push({ 
      type: 'note', 
      item: n, 
      execute: () => { onClose(); onNavigateTab('NOTE'); }
    }));
    return list;
  }, [results, onClose, onNavigateTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, flatList.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + flatList.length) % Math.max(1, flatList.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (flatList[selectedIndex]) {
          flatList[selectedIndex].execute();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, flatList, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 md:pt-20 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-white dark:bg-[#1C1C1E] rounded-[26px] shadow-2xl border border-slate-200/90 dark:border-white/10 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Barra di Ricerca Primaria */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-white/5 flex items-center gap-3 bg-slate-50/70 dark:bg-[#242426]/50">
          <div className="w-9 h-9 rounded-[12px] bg-[#E31B23]/15 text-[#E31B23] flex items-center justify-center shrink-0">
            <Search size={18} strokeWidth={2.5} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="Cerca qualsiasi cosa (spese, conti, progetti, azioni rapide)..."
            className="flex-1 bg-transparent text-sm sm:text-base font-medium text-slate-900 dark:text-[#F5F5F7] placeholder-slate-400 dark:placeholder-[#8E8E93] outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-[#F5F5F7] rounded-full"
            >
              <X size={16} />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10.5px] font-mono font-semibold text-slate-400 dark:text-[#8E8E93] bg-white dark:bg-[#1C1C1E] rounded-md border border-slate-200 dark:border-white/10">
            ESC
          </kbd>
        </div>

        {/* Corpo Risultati */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-3 no-scrollbar">
          {flatList.length === 0 ? (
            <div className="p-8 text-center text-slate-400 dark:text-[#8E8E93] space-y-2">
              <Search size={32} className="mx-auto opacity-40" />
              <p className="text-sm font-medium">Nessun risultato trovato per "{query}"</p>
              <p className="text-xs">Prova con un commerciante, un importo, una categoria o un conto.</p>
            </div>
          ) : (
            <>
              {/* Sezione Azioni Rapide */}
              {results.actions.length > 0 && (
                <div className="space-y-1">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-[#8E8E93] uppercase tracking-wider">
                    Azioni & Strumenti Rapidi
                  </div>
                  <div className="space-y-1">
                    {results.actions.map(act => {
                      const Icon = act.icon;
                      return (
                        <button
                          key={act.id}
                          type="button"
                          onClick={() => { haptics.tap(); act.action(); }}
                          className="w-full px-3 py-2.5 rounded-[16px] text-left flex items-center gap-3 transition-colors hover:bg-slate-100 dark:hover:bg-[#242426] cursor-pointer group"
                        >
                          <div className={`w-8 h-8 rounded-[11px] flex items-center justify-center shrink-0 ${act.color}`}>
                            <Icon size={16} strokeWidth={2} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="block text-xs sm:text-sm font-bold text-slate-900 dark:text-[#F5F5F7] truncate">
                              {act.title}
                            </span>
                            <span className="block text-[11px] text-slate-500 dark:text-[#8E8E93] truncate">
                              {act.subtitle}
                            </span>
                          </div>
                          <ArrowRight size={14} className="text-slate-300 dark:text-[#8E8E93] opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sezione Movimenti */}
              {results.movements.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-white/5">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-[#8E8E93] uppercase tracking-wider">
                    Movimenti & Transazioni ({results.movements.length})
                  </div>
                  <div className="space-y-1">
                    {results.movements.map(m => {
                      const sub = subcategories.find(s => s.id === m.sottocategoria_id);
                      return (
                        <button
                          key={m.id || m.movimento_id}
                          type="button"
                          onClick={() => {
                            haptics.tap();
                            onClose();
                            onNavigateTab('TRANSAZIONI');
                          }}
                          className="w-full px-3 py-2 rounded-[16px] text-left flex items-center justify-between gap-2 hover:bg-slate-100 dark:hover:bg-[#242426] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className={`w-7 h-7 rounded-[10px] flex items-center justify-center shrink-0 ${
                              m.tipologia === 'ENTRATA' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-200 dark:bg-[#2A2A2E] text-slate-700 dark:text-[#8E8E93]'
                            }`}>
                              {m.tipologia === 'ENTRATA' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="block text-xs sm:text-sm font-semibold text-slate-900 dark:text-[#F5F5F7] truncate">
                                {m.descrizione || 'Senza descrizione'}
                              </span>
                              <span className="block text-[10.5px] text-slate-400 dark:text-[#8E8E93]">
                                {formatDate(m.data)} • {sub?.nome || 'Generica'}
                              </span>
                            </div>
                          </div>
                          <span className={`text-xs sm:text-sm font-bold font-numeric tabular-nums whitespace-nowrap ${
                            m.tipologia === 'ENTRATA' ? 'text-emerald-500' : 'text-slate-900 dark:text-[#F5F5F7]'
                          }`}>
                            {m.tipologia === 'ENTRATA' ? '+' : '-'}{formatCurrency(m.importo)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sezione Conti & Fondi */}
              {results.accounts.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-white/5">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-[#8E8E93] uppercase tracking-wider">
                    Conti & Fondi Risparmio
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {results.accounts.map((acc: any) => {
                      const name = acc.nome_conto || acc.nome_fondo;
                      const balance = acc.saldo_reale ?? acc.saldo_iniziale ?? 0;
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => {
                            haptics.tap();
                            onClose();
                            onNavigateTab('CONTI');
                          }}
                          className="px-3 py-2 rounded-[16px] text-left flex items-center justify-between gap-2 bg-slate-50 dark:bg-[#242426]/70 hover:bg-slate-100 dark:hover:bg-[#242426] border border-slate-200/60 dark:border-white/5 transition-colors cursor-pointer"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="block text-xs font-bold text-slate-900 dark:text-[#F5F5F7] truncate">{name}</span>
                            <span className="text-[10px] text-slate-400 dark:text-[#8E8E93]">{acc.tipo_conto || 'Fondo Risparmio'}</span>
                          </div>
                          <span className="text-xs font-bold font-numeric tabular-nums text-slate-900 dark:text-[#F5F5F7] whitespace-nowrap">
                            {formatCurrency(balance)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer con suggerimenti navigazione */}
        <div className="p-2.5 px-4 bg-slate-50 dark:bg-[#242426]/60 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-400 dark:text-[#8E8E93]">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono bg-white dark:bg-[#1C1C1E] px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10">↑↓</kbd> Naviga</span>
            <span><kbd className="font-mono bg-white dark:bg-[#1C1C1E] px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10">↵</kbd> Seleziona</span>
          </div>
          <span className="text-[10px] font-medium">Spotlight Search • One UI</span>
        </div>
      </div>
    </div>
  );
};
