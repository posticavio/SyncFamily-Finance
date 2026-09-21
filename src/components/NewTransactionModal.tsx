import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Plus, 
  Sparkles, 
  Check, 
  Calendar as CalendarIcon, 
  Bookmark, 
  ChevronDown, 
  ChevronUp,
  ChevronRight,
  Search,
  Tag,
  Wallet,
  ArrowRight,
  ArrowLeftRight,
  Clock,
  SlidersHorizontal,
  Info,
  Hash,
  FolderKanban
} from 'lucide-react';
import { Movement, Subcategory, Account, Fund, MovementType, TransactionTemplate, Project } from '../types';
import { MovementService } from '../services/MovementService';
import { CategoryService } from '../services/CategoryService';
import { AccountService } from '../services/AccountService';
import { TemplateService } from '../services/TemplateService';
import { ProjectService } from '../services/ProjectService';
import { subscribeToDB } from '../services/store';
import { CategoryIcon } from './CategoryIcon';
import { TransactionTemplateSelector } from './TransactionTemplateSelector';
import { haptics } from '../utils/haptics';
import { formatCurrency } from '../utils/formatters';

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  subcategories: Subcategory[];
  accounts: Account[];
  funds: Fund[];
  initialMovement?: Movement | null;
  onSuccess: () => void;
  templates?: TransactionTemplate[];
}

export const NewTransactionModal: React.FC<NewTransactionModalProps> = ({
  isOpen,
  onClose,
  subcategories,
  accounts,
  funds,
  initialMovement,
  onSuccess,
  templates: initialTemplates
}) => {
  const isEditing = !!initialMovement && Boolean(initialMovement.id && initialMovement.id.trim() !== '');

  // Core Form State
  const [tipologia, setTipologia] = useState<MovementType>(initialMovement?.tipologia || 'USCITA');
  const [importoStr, setImportoStr] = useState<string>(
    initialMovement && initialMovement.importo > 0 ? initialMovement.importo.toString() : ''
  );
  const [descrizione, setDescrizione] = useState<string>(initialMovement?.descrizione || '');
  const [sottocategoriaId, setSottocategoriaId] = useState<string>(
    initialMovement?.sottocategoria_id || (subcategories.find(s => s.preferita)?.id || subcategories[0]?.id || '')
  );
  const [contoOrigine, setContoOrigine] = useState<string>(
    initialMovement?.conto_origine || (accounts.find(a => a.conto_principale)?.id || accounts[0]?.id || '')
  );
  const [contoDestinazione, setContoDestinazione] = useState<string>(
    initialMovement?.conto_destinazione || (accounts[1]?.id || '')
  );
  const [dataMovimento, setDataMovimento] = useState<string>(
    initialMovement?.data || new Date().toISOString().split('T')[0]
  );
  const [natura, setNatura] = useState<'FISSA' | 'VARIABILE'>(initialMovement?.natura || 'VARIABILE');
  const [necessita, setNecessita] = useState<'BISOGNO' | 'DESIDERIO' | 'RISPARMIO'>(initialMovement?.necessita || 'BISOGNO');
  const [note, setNote] = useState<string>(initialMovement?.note || '');
  const [tag, setTag] = useState<string>(
    initialMovement?.tag || (initialMovement?.tags && initialMovement?.tags[0]) || ''
  );
  const [progettoId, setProgettoId] = useState<string | null>(initialMovement?.progetto_id || null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(
    isEditing ? Boolean(initialMovement?.note || initialMovement?.natura === 'FISSA' || initialMovement?.necessita !== 'BISOGNO' || initialMovement?.progetto_id) : false
  );

  // Template State
  const [templates, setTemplates] = useState<TransactionTemplate[]>(initialTemplates || []);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showTemplateSheet, setShowTemplateSheet] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState<boolean>(false);
  const [newTemplateName, setNewTemplateName] = useState<string>('');

  // UI Flow States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  
  // In-Place Subcategory Creation State
  const [showNewSubModal, setShowNewSubModal] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubParent, setNewSubParent] = useState('Spese Varie');
  const [newSubTipo, setNewSubTipo] = useState<MovementType>('USCITA');

  // In-Place Account Creation State
  const [showNewAccountModal, setShowNewAccountModal] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState<'BANCA' | 'CARTA_DEBITO' | 'CARTA_CREDITO' | 'CONTANTI' | 'FONDO'>('BANCA');
  const [newAccountInitialBalance, setNewAccountInitialBalance] = useState('0');
  const [newAccountColor, setNewAccountColor] = useState('#E31B23');
  const [creatingAccount, setCreatingAccount] = useState(false);

  const amountInputRef = useRef<HTMLInputElement>(null);

  // Caricamento modelli con sincronizzazione real-time
  useEffect(() => {
    let isMounted = true;
    TemplateService.getAll().then(list => {
      if (isMounted) setTemplates(list);
    });
    MovementService.getAllTags().then(tags => {
      if (isMounted) setAvailableTags(tags);
    });
    ProjectService.getAll().then(projects => {
      if (isMounted) setAllProjects(projects);
    });
    const unsubscribe = subscribeToDB(() => {
      TemplateService.getAll().then(list => {
        if (isMounted) setTemplates(list);
      });
      MovementService.getAllTags().then(tags => {
        if (isMounted) setAvailableTags(tags);
      });
      ProjectService.getAll().then(projects => {
        if (isMounted) setAllProjects(projects);
      });
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Chiusura rapida con tasto Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Sync sottocategoria quando cambia tipologia
  useEffect(() => {
    const validSubs = subcategories.filter(s => {
      if (tipologia === 'GIROCONTO') return s.tipo === 'GIROCONTO';
      return s.tipo === tipologia;
    });

    const isCurrentValid = validSubs.some(s => s.id === sottocategoriaId);
    if (!isCurrentValid && validSubs.length > 0) {
      const fav = validSubs.find(s => s.preferita) || validSubs[0];
      setSottocategoriaId(fav.id);
    }
  }, [tipologia, subcategories]);

  // Lista unificata conti e fondi attivi
  const allSources = useMemo(() => [
    ...accounts.filter(a => a.attivo !== false).map(a => ({ 
      id: a.id, 
      name: a.nome_conto, 
      color: a.colore || '#E31B23', 
      isFund: false,
      typeLabel: a.tipo_conto === 'BANCA' ? 'Banca' : a.tipo_conto === 'CONTANTI' ? 'Contanti' : 'Carta'
    })),
    ...funds.filter(f => f.attivo !== false).map(f => ({ 
      id: f.id, 
      name: f.nome_fondo, 
      color: f.colore || '#10b981', 
      isFund: true,
      typeLabel: 'Fondo'
    }))
  ], [accounts, funds]);

  // Conto selezionato
  const selectedOriginAccount = useMemo(() => {
    return allSources.find(s => s.id === contoOrigine) || allSources[0];
  }, [allSources, contoOrigine]);

  const selectedDestAccount = useMemo(() => {
    return allSources.find(s => s.id === contoDestinazione) || allSources[1] || allSources[0];
  }, [allSources, contoDestinazione]);

  // Sottocategorie filtrate per la tipologia corrente
  const filteredSubcategories = useMemo(() => {
    return subcategories.filter(s => {
      if (tipologia === 'GIROCONTO') return s.tipo === 'GIROCONTO';
      return s.tipo === tipologia;
    });
  }, [subcategories, tipologia]);

  const selectedSub = useMemo(() => {
    return subcategories.find(s => s.id === sottocategoriaId);
  }, [subcategories, sottocategoriaId]);

  // Quick favorite chips per 1-tap selection (top 6 favorite / frequent)
  const quickSubcategories = useMemo(() => {
    const list = [...filteredSubcategories];
    return list.sort((a, b) => {
      if (a.preferita && !b.preferita) return -1;
      if (!a.preferita && b.preferita) return 1;
      return a.nome.localeCompare(b.nome);
    }).slice(0, 7);
  }, [filteredSubcategories]);

  // Raggruppamento per categoria padre per il drawer completo
  const subcategoriesByParent = useMemo(() => {
    const map = new Map<string, Subcategory[]>();
    const query = categorySearch.toLowerCase().trim();

    filteredSubcategories.forEach(sub => {
      if (query && !sub.nome.toLowerCase().includes(query) && !sub.categoria_padre.toLowerCase().includes(query)) {
        return;
      }
      const parent = sub.categoria_padre || 'Altro';
      if (!map.has(parent)) {
        map.set(parent, []);
      }
      map.get(parent)!.push(sub);
    });

    return Array.from(map.entries());
  }, [filteredSubcategories, categorySearch]);

  const parentCategories = useMemo(() => {
    return Array.from(new Set(subcategories.map(s => s.categoria_padre))).filter(Boolean);
  }, [subcategories]);

  // Collegamento automatico o manuale a Progetto / Finanziamento
  const linkedProject = useMemo(() => {
    if (progettoId) {
      return allProjects.find(p => p.id === progettoId) || null;
    }
    return allProjects.find(p => p.sottocategoria_id === sottocategoriaId && p.stato === 'ATTIVO') || null;
  }, [progettoId, sottocategoriaId, allProjects]);

  // Quick Date Helpers
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const handleSelectTemplate = (tpl: TransactionTemplate) => {
    setSelectedTemplateId(tpl.id);
    setTipologia(tpl.tipologia);
    if (tpl.importo && tpl.importo > 0) setImportoStr(tpl.importo.toString());
    if (tpl.descrizione || tpl.nome) setDescrizione(tpl.descrizione || tpl.nome);
    if (tpl.sottocategoria_id && subcategories.some(s => s.id === tpl.sottocategoria_id)) {
      setSottocategoriaId(tpl.sottocategoria_id);
    }
    if (tpl.conto_origine) setContoOrigine(tpl.conto_origine);
    if (tpl.conto_destinazione) setContoDestinazione(tpl.conto_destinazione);
    if (tpl.natura) setNatura(tpl.natura);
    if (tpl.necessita) setNecessita(tpl.necessita);
    if (tpl.note) setNote(tpl.note);
    if (tpl.tag) setTag(tpl.tag);
    setShowTemplateSheet(false);
    haptics.success();
  };

  const suggestedTags = useMemo(() => {
    const list = [...availableTags];
    const defaultSuggestions = ['Vacanza a Napoli', 'Cena Fuori', 'Weekend Fuori', 'Spesa Straordinaria', 'Regali & Compleanni'];
    for (const d of defaultSuggestions) {
      if (!list.some(t => t.toLowerCase() === d.toLowerCase())) {
        list.push(d);
      }
    }
    return list.slice(0, 8);
  }, [availableTags]);

  const handleQuickAddAmount = (addVal: number) => {
    haptics.tap();
    const current = parseFloat(importoStr.replace(',', '.')) || 0;
    const nextVal = Math.round((current + addVal) * 100) / 100;
    setImportoStr(nextVal.toString());
  };

  // Creazione in-place sottocategoria rapida
  const handleCreateSubcategoryInPlace = async () => {
    if (!newSubName.trim()) {
      setErrorMsg("Inserisci il nome della sottocategoria.");
      return;
    }
    try {
      const created = await CategoryService.createSubcategory({
        nome: newSubName.trim(),
        categoria_padre: newSubParent.trim() || 'Spese Varie',
        tipo: newSubTipo,
        preferita: true
      });
      setSottocategoriaId(created.id);
      setTipologia(created.tipo);
      setShowNewSubModal(false);
      setShowCategoryPicker(false);
      setNewSubName('');
      setErrorMsg(null);
      haptics.success();
    } catch (e: any) {
      setErrorMsg(e.message || "Errore nella creazione della sottocategoria.");
    }
  };

  // Creazione in-place conto rapido
  const handleCreateAccountInPlace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim()) return;
    setCreatingAccount(true);
    try {
      const parsedBalance = parseFloat(newAccountInitialBalance.replace(',', '.')) || 0;
      if (newAccountType === 'FONDO') {
        const newFund = await AccountService.createFund({
          nome_fondo: newAccountName.trim(),
          saldo_iniziale: parsedBalance,
          colore: newAccountColor,
        });
        setContoOrigine(newFund.id);
      } else {
        const newAcc = await AccountService.createAccount({
          nome_conto: newAccountName.trim(),
          tipo_conto: newAccountType,
          saldo_iniziale: parsedBalance,
          colore: newAccountColor,
        });
        setContoOrigine(newAcc.id);
      }
      haptics.success();
      setShowNewAccountModal(false);
      setNewAccountName('');
      setNewAccountInitialBalance('0');
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Errore nella creazione del conto');
    } finally {
      setCreatingAccount(false);
    }
  };

  // Salvataggio movimento
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    const amount = parseFloat(importoStr.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      setErrorMsg("Inserisci un importo valido superiore a 0 €.");
      haptics.error();
      amountInputRef.current?.focus();
      return;
    }

    if (!sottocategoriaId) {
      setErrorMsg("Seleziona una categoria per l'operazione.");
      haptics.error();
      return;
    }

    if (!contoOrigine) {
      setErrorMsg("Seleziona il conto o fondo di origine.");
      haptics.error();
      return;
    }

    if (tipologia === 'GIROCONTO' && contoOrigine === contoDestinazione) {
      setErrorMsg("Per un giroconto i due conti devono essere differenti.");
      haptics.error();
      return;
    }

    const finalDescription = descrizione.trim() || (selectedSub?.nome || 'Operazione');
    const cleanTag = tag.trim() || null;
    const cleanTags = cleanTag ? [cleanTag] : [];
    const targetProjectId = progettoId || linkedProject?.id || null;

    setLoading(true);
    try {
      if (isEditing && initialMovement) {
        await MovementService.update(initialMovement.id, {
          data: dataMovimento,
          descrizione: finalDescription,
          importo: amount,
          tipologia,
          conto_origine: contoOrigine,
          conto_destinazione: tipologia === 'GIROCONTO' ? contoDestinazione : null,
          sottocategoria_id: sottocategoriaId,
          natura,
          necessita,
          progetto_id: targetProjectId,
          tag: cleanTag,
          tags: cleanTags,
          note
        });
      } else {
        await MovementService.create({
          data: dataMovimento,
          descrizione: finalDescription,
          importo: amount,
          tipologia,
          conto_origine: contoOrigine,
          conto_destinazione: tipologia === 'GIROCONTO' ? contoDestinazione : null,
          sottocategoria_id: sottocategoriaId,
          natura,
          necessita,
          progetto_id: targetProjectId,
          tag: cleanTag,
          tags: cleanTags,
          note,
          origine_dati: 'MANUALE'
        });
      }

      // Salvataggio opzionale come modello ricorrente
      if (saveAsTemplate && (newTemplateName.trim() || finalDescription.trim())) {
        try {
          const chosenSub = subcategories.find(s => s.id === sottocategoriaId);
          await TemplateService.create({
            nome: newTemplateName.trim() || finalDescription.trim(),
            descrizione: finalDescription.trim(),
            importo: amount,
            tipologia,
            sottocategoria_id: sottocategoriaId,
            conto_origine: contoOrigine,
            conto_destinazione: tipologia === 'GIROCONTO' ? contoDestinazione : null,
            natura,
            necessita,
            tag: cleanTag || undefined,
            tags: cleanTags.length > 0 ? cleanTags : undefined,
            note: note.trim() || undefined,
            icon: chosenSub?.icon_name || 'Bookmark',
            colore: chosenSub?.colore || '#4f46e5',
            frequenza_suggerita: natura === 'FISSA' ? 'MENSILE' : 'RICORRENTE',
            is_predefined: false
          });
        } catch (templateErr) {
          console.warn("Impossibile salvare modello:", templateErr);
        }
      }

      haptics.success();
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Errore durante il salvataggio.");
      haptics.error();
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="new-transaction-dialog"
        className="w-full sm:max-w-xl md:max-w-5xl lg:max-w-6xl bg-white dark:bg-[#121212] rounded-t-[32px] sm:rounded-[28px] shadow-2xl overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[92vh] md:max-h-[88vh] border-t sm:border border-slate-200/80 dark:border-white/10 relative transition-all"
      >
        {/* Mobile Drag Indicator Bar */}
        <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 sm:hidden flex-shrink-0" />

        {/* Top Header: Title, Templates Chip & Close */}
        <div className="px-4 py-2.5 sm:px-5 sm:py-3 flex items-center justify-between gap-2 border-b border-slate-100 dark:border-[#222224] flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              {isEditing ? 'Modifica Operazione' : 'Nuova Operazione'}
            </h2>
            {templates.length > 0 && !isEditing && (
              <button
                type="button"
                onClick={() => {
                  setShowTemplateSheet(true);
                  haptics.tap();
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-all ${
                  selectedTemplateId
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                    : 'bg-slate-100 dark:bg-[#202022] text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <Sparkles size={12} className="text-amber-500" />
                <span>Modelli</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#202022] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-colors"
            title="Chiudi (Esc)"
          >
            <X size={17} strokeWidth={2.2} />
          </button>
        </div>

        {/* Error Notification Banner */}
        {errorMsg && (
          <div className="mx-4 mt-3 px-3 py-2 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-2xl text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center gap-2 animate-in slide-in-from-top-2">
            <Info size={14} className="flex-shrink-0 text-rose-500" />
            <span className="flex-1">{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="p-1 hover:opacity-75">
              <X size={12} />
            </button>
          </div>
        )}

        {/* Form Body - Scrollable on mobile, horizontal 3-column layout on desktop with zero scroll */}
        <form 
          onSubmit={handleSubmit} 
          onKeyDown={handleKeyDown} 
          className="p-3.5 sm:p-4 md:p-5 overflow-y-auto no-scrollbar flex-1 flex flex-col md:grid md:grid-cols-3 gap-3.5 md:gap-4 md:items-start"
        >
          {/* ==================== COLONNA 1: TIPO, IMPORTO & CONTO ==================== */}
          <div className="flex flex-col gap-3.5">
            {/* 1. TYPE SELECTOR - Samsung One UI Segmented Pill */}
            <div className="bg-slate-100 dark:bg-[#1E1E20] p-1 rounded-full flex gap-1 border border-slate-200/60 dark:border-white/5">
              <button
                type="button"
                onClick={() => { setTipologia('USCITA'); haptics.tap(); }}
                className={`flex-1 py-1.5 sm:py-2 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  tipologia === 'USCITA'
                    ? 'bg-[#E31B23] text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>Uscita</span>
              </button>
              <button
                type="button"
                onClick={() => { setTipologia('ENTRATA'); haptics.tap(); }}
                className={`flex-1 py-1.5 sm:py-2 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  tipologia === 'ENTRATA'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>Entrata</span>
              </button>
              <button
                type="button"
                onClick={() => { setTipologia('GIROCONTO'); haptics.tap(); }}
                className={`flex-1 py-1.5 sm:py-2 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  tipologia === 'GIROCONTO'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>Giroconto</span>
              </button>
            </div>

            {/* 2. HERO AMOUNT CARD */}
            <div className="py-3.5 px-3 bg-slate-50 dark:bg-[#1C1C1E] rounded-[22px] border border-slate-200/70 dark:border-white/5 flex flex-col items-center justify-center shadow-xs">
              <div className="flex items-center justify-center gap-1 w-full">
                <span className={`text-2xl sm:text-3xl font-black ${
                  tipologia === 'ENTRATA' ? 'text-emerald-500' : (tipologia === 'GIROCONTO' ? 'text-indigo-500' : 'text-[#E31B23]')
                }`}>
                  {tipologia === 'ENTRATA' ? '+' : (tipologia === 'GIROCONTO' ? '⇄' : '-')}
                </span>
                <span className="text-2xl font-bold text-slate-400 dark:text-slate-500">€</span>
                <input
                  ref={amountInputRef}
                  id="hero-amount-input"
                  type="text"
                  inputMode="decimal"
                  value={importoStr}
                  onChange={(e) => setImportoStr(e.target.value)}
                  placeholder="0,00"
                  autoFocus
                  className="font-numeric text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 dark:text-white bg-transparent border-none outline-none text-center max-w-[200px] placeholder:text-slate-300 dark:placeholder:text-slate-700 tracking-tight"
                />
              </div>

              {/* Fast Presets Pills */}
              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap justify-center">
                {[5, 10, 20, 50, 100].map(val => (
                  <button
                    type="button"
                    key={val}
                    onClick={() => handleQuickAddAmount(val)}
                    className="px-2 py-0.5 rounded-full bg-white dark:bg-[#252528] text-[11px] font-bold text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/10 hover:border-slate-400 active:scale-90 transition-all font-numeric shadow-2xs cursor-pointer"
                  >
                    +{val}€
                  </button>
                ))}
                {importoStr && importoStr !== '0' && (
                  <button
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      setImportoStr('');
                      amountInputRef.current?.focus();
                    }}
                    className="px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 active:scale-90 transition-all cursor-pointer"
                  >
                    Azzera
                  </button>
                )}
              </div>
            </div>

            {/* 3. CONTI DI ADDEBITO / ACCREDITO */}
            <div className="bg-slate-50 dark:bg-[#1C1C1E] rounded-[22px] border border-slate-200/70 dark:border-white/5 p-3 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {tipologia === 'USCITA' 
                    ? 'Addebito su Conto' 
                    : tipologia === 'ENTRATA' 
                      ? 'Accredito su Conto' 
                      : 'Da Conto Origine'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewAccountModal(true);
                    haptics.tap();
                  }}
                  className="text-[11px] font-bold text-[#E31B23] dark:text-red-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus size={12} strokeWidth={2.5} />
                  <span>Nuovo</span>
                </button>
              </div>

              {/* Wrapping Grid of Active Accounts / Funds */}
              <div className="flex flex-wrap items-center gap-1.5 py-1 max-h-48 overflow-y-auto pr-1">
                {allSources.map(acc => {
                  const isSelected = contoOrigine === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        setContoOrigine(acc.id);
                        haptics.tap();
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-all flex-shrink-0 active:scale-95 cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs ring-1 ring-slate-900/20 dark:ring-white/30'
                          : 'bg-white dark:bg-[#242426] text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: acc.color }} />
                      <span className="whitespace-nowrap">{acc.name}</span>
                      {acc.isFund && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                          isSelected ? 'bg-slate-800 text-slate-200 dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>
                          Fondo
                        </span>
                      )}
                      {isSelected && <Check size={12} strokeWidth={2.5} className="flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Giroconto Conto Destinazione */}
              {tipologia === 'GIROCONTO' && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                      <ArrowLeftRight size={11} />
                      <span>A Conto Destinazione</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 py-1 max-h-48 overflow-y-auto pr-1">
                    {allSources.filter(acc => acc.id !== contoOrigine).map(acc => {
                      const isSelected = contoDestinazione === acc.id;
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => {
                            setContoDestinazione(acc.id);
                            haptics.tap();
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-all flex-shrink-0 active:scale-95 cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-1 ring-indigo-500/30'
                              : 'bg-white dark:bg-[#242426] text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20'
                          }`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: acc.color }} />
                          <span className="whitespace-nowrap">{acc.name}</span>
                          {acc.isFund && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                              isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}>
                              Fondo
                            </span>
                          )}
                          {isSelected && <Check size={12} strokeWidth={2.5} className="flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ==================== COLONNA 2: CATEGORIA, DATA & DESCRIZIONE ==================== */}
          <div className="flex flex-col gap-3.5">
            {/* Categoria Card */}
            <div className="bg-slate-50 dark:bg-[#1C1C1E] rounded-[22px] border border-slate-200/70 dark:border-white/5 p-3 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Categoria
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryPicker(true);
                    haptics.tap();
                  }}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <span>Tutte le categorie</span>
                  <ChevronRight size={12} strokeWidth={2.5} />
                </button>
              </div>

              {/* Selected Category Highlight Banner */}
              <div 
                onClick={() => {
                  setShowCategoryPicker(true);
                  haptics.tap();
                }}
                className="flex items-center justify-between p-2.5 bg-white dark:bg-[#242426] rounded-xl border border-slate-200/80 dark:border-white/10 cursor-pointer hover:border-slate-300 dark:hover:border-white/20 transition-all active:scale-[0.99]"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <CategoryIcon 
                    name={selectedSub?.icon_name} 
                    color={selectedSub?.colore || '#E31B23'} 
                    size={18} 
                    background={true} 
                  />
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {selectedSub?.nome || 'Seleziona Categoria'}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {selectedSub?.categoria_padre || 'Nessuna macro-categoria'}
                    </p>
                  </div>
                </div>

                <div className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1 flex-shrink-0">
                  <span>Cambia</span>
                  <ChevronRight size={10} />
                </div>
              </div>

              {/* Quick Favorite Category Chips */}
              {quickSubcategories.length > 0 && (
                <div className="pt-0.5">
                  <div className="flex flex-wrap items-center gap-1.5 py-0.5">
                    {quickSubcategories.slice(0, 8).map(sub => {
                      const isSelected = sub.id === sottocategoriaId;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            setSottocategoriaId(sub.id);
                            haptics.tap();
                          }}
                          className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all active:scale-95 border flex-shrink-0 cursor-pointer ${
                            isSelected
                              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs'
                              : 'bg-white dark:bg-[#242426] text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-white/5 hover:border-slate-300'
                          }`}
                        >
                          <CategoryIcon name={sub.icon_name} color={isSelected ? undefined : sub.colore} size={12} background={false} />
                          <span className="whitespace-nowrap">{sub.nome}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Indicatore Progetto Collegato */}
              {linkedProject && (
                <div className="p-2 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between text-xs mt-1">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <FolderKanban size={13} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                      {linkedProject.nome_progetto}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 flex-shrink-0 tabular-nums font-numeric">
                    {formatCurrency(linkedProject.budget_previsto)}
                  </span>
                </div>
              )}
            </div>

            {/* Data & Descrizione Card */}
            <div className="bg-slate-50 dark:bg-[#1C1C1E] rounded-[22px] border border-slate-200/70 dark:border-white/5 p-3 space-y-2.5 shadow-xs">
              {/* Data Operazione */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Data Operazione
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => { setDataMovimento(todayStr); haptics.tap(); }}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                        dataMovimento === todayStr
                          ? 'bg-[#E31B23] text-white shadow-2xs'
                          : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Oggi
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDataMovimento(yesterdayStr); haptics.tap(); }}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                        dataMovimento === yesterdayStr
                          ? 'bg-[#E31B23] text-white shadow-2xs'
                          : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Ieri
                    </button>
                  </div>
                </div>
                <div className="relative flex items-center">
                  <CalendarIcon size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
                  <input
                    type="date"
                    value={dataMovimento}
                    onChange={(e) => setDataMovimento(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs font-semibold bg-white dark:bg-[#242426] text-slate-900 dark:text-white rounded-xl border border-slate-200/80 dark:border-white/10 outline-none focus:border-[#E31B23]"
                  />
                </div>
              </div>

              {/* Descrizione */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Descrizione (opzionale)
                </label>
                <div className="relative flex items-center">
                  <Tag size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={descrizione}
                    onChange={(e) => setDescrizione(e.target.value)}
                    placeholder={selectedSub ? `Es. ${selectedSub.nome}` : "Es. Pranzo, Spesa, Carburante..."}
                    className="w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-[#242426] text-slate-900 dark:text-white rounded-xl border border-slate-200/80 dark:border-white/10 outline-none focus:border-[#E31B23] dark:focus:border-red-500 font-medium"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ==================== COLONNA 3: TAG, DETTAGLI AVANZATI & NOTE ==================== */}
          <div className="flex flex-col gap-3.5">
            {/* Tag / Evento Card */}
            <div className="bg-slate-50 dark:bg-[#1C1C1E] rounded-[22px] border border-slate-200/70 dark:border-white/5 p-3 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Hash size={11} className="text-amber-500" />
                  <span>Tag / Evento</span>
                </label>
                {tag && (
                  <button
                    type="button"
                    onClick={() => { setTag(''); haptics.tap(); }}
                    className="text-[10px] font-semibold text-rose-500 hover:text-rose-600 cursor-pointer"
                  >
                    Rimuovi
                  </button>
                )}
              </div>
              <div className="relative flex items-center">
                <Hash size={14} className="absolute left-3 text-amber-500 pointer-events-none" />
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="Es. Vacanze, Compleanno, Lavori Casa..."
                  className="w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-[#242426] text-slate-900 dark:text-white rounded-xl border border-slate-200/80 dark:border-white/10 outline-none focus:border-amber-500 font-medium placeholder:text-slate-400"
                />
              </div>
              {/* Tag Rapidi */}
              {suggestedTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 py-0.5">
                  {suggestedTags.slice(0, 6).map(suggested => {
                    const isSelected = tag.trim().toLowerCase() === suggested.toLowerCase();
                    return (
                      <button
                        key={suggested}
                        type="button"
                        onClick={() => {
                          setTag(isSelected ? '' : suggested);
                          haptics.tap();
                        }}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-all border cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-white border-amber-500 font-semibold shadow-2xs'
                            : 'bg-white dark:bg-[#242426] text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-white/10 hover:border-amber-400/80'
                        }`}
                      >
                        <span>#{suggested}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Opzioni Avanzate: Natura, Regola 50/30/20, Note & Modello */}
            <div className="bg-slate-50 dark:bg-[#1C1C1E] rounded-[22px] border border-slate-200/70 dark:border-white/5 p-3 space-y-2.5 shadow-xs">
              {/* Mobile Accordion Toggle Button */}
              <button
                type="button"
                onClick={() => {
                  setShowAdvanced(!showAdvanced);
                  haptics.tap();
                }}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 md:hidden cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal size={13} className="text-slate-400" />
                  <span>Natura, Regola 50/30/20 & Note</span>
                </div>
                {showAdvanced ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>

              <div className={`space-y-2.5 ${showAdvanced ? 'block' : 'hidden md:block'}`}>
                {/* Natura Spesa & 50/30/20 Side-by-Side */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Natura Spesa */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Natura Spesa
                    </label>
                    <div className="grid grid-cols-2 gap-1 bg-white dark:bg-[#242426] p-0.5 rounded-lg border border-slate-200/80 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => { setNatura('VARIABILE'); haptics.tap(); }}
                        className={`py-1 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                          natura === 'VARIABILE'
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Variabile
                      </button>
                      <button
                        type="button"
                        onClick={() => { setNatura('FISSA'); haptics.tap(); }}
                        className={`py-1 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                          natura === 'FISSA'
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Fissa
                      </button>
                    </div>
                  </div>

                  {/* Regola 50/30/20 */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      50 / 30 / 20
                    </label>
                    <div className="grid grid-cols-3 gap-0.5 bg-white dark:bg-[#242426] p-0.5 rounded-lg border border-slate-200/80 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => { setNecessita('BISOGNO'); haptics.tap(); }}
                        className={`py-1 rounded text-[9px] font-semibold transition-all cursor-pointer ${
                          necessita === 'BISOGNO'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                        title="Bisogno primario (50%)"
                      >
                        Bisogno
                      </button>
                      <button
                        type="button"
                        onClick={() => { setNecessita('DESIDERIO'); haptics.tap(); }}
                        className={`py-1 rounded text-[9px] font-semibold transition-all cursor-pointer ${
                          necessita === 'DESIDERIO'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                        title="Svago e desideri (30%)"
                      >
                        Svago
                      </button>
                      <button
                        type="button"
                        onClick={() => { setNecessita('RISPARMIO'); haptics.tap(); }}
                        className={`py-1 rounded text-[9px] font-semibold transition-all cursor-pointer ${
                          necessita === 'RISPARMIO'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                        title="Risparmio e investimenti (20%)"
                      >
                        Risparmio
                      </button>
                    </div>
                  </div>
                </div>

                {/* Note */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Note Aggiuntive
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Dettagli, scontrino o riferimento..."
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#242426] text-slate-900 dark:text-white rounded-lg border border-slate-200/80 dark:border-white/10 outline-none focus:border-[#E31B23]"
                  />
                </div>

                {/* Progetto select se esistente */}
                {allProjects.length > 0 && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                      Associa a Progetto o Finanziamento
                    </label>
                    <select
                      value={progettoId || (linkedProject?.id ?? '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProgettoId(val || null);
                        if (val) {
                          const p = allProjects.find(item => item.id === val);
                          if (p) setSottocategoriaId(p.sottocategoria_id);
                        }
                      }}
                      className="w-full px-2 py-1.5 text-xs bg-white dark:bg-[#242426] text-slate-900 dark:text-white rounded-lg border border-slate-200/80 dark:border-white/10 outline-none focus:border-indigo-500 font-medium"
                    >
                      <option value="">Rilevamento automatico</option>
                      {allProjects.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.tipo}: {p.nome_progetto}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Salva come Modello Ricorrente */}
                <div className="pt-0.5">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={saveAsTemplate}
                      onChange={(e) => setSaveAsTemplate(e.target.checked)}
                      className="rounded text-[#E31B23] focus:ring-red-500 w-3.5 h-3.5 accent-[#E31B23]"
                    />
                    <Bookmark size={12} className="text-[#E31B23]" />
                    <span>Salva come Modello Ricorrente</span>
                  </label>
                  {saveAsTemplate && (
                    <input
                      type="text"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder={descrizione || "Nome del modello..."}
                      className="w-full mt-1 px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 outline-none"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* 6. FIXED BOTTOM ACTION BAR (Samsung One UI Tactile Bar) */}
        <div className="p-3 sm:p-3.5 md:px-5 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md border-t border-slate-100 dark:border-[#222224] flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 sm:py-2.5 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-[#202022] dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
            >
              Annulla (Esc)
            </button>
            <span className="hidden md:inline text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              Premi <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-[#202022] rounded text-[10px] font-mono border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300">Invio</kbd> per salvare rapidamente
            </span>
          </div>

          <button
            id="btn-save-transaction-main"
            type="button"
            disabled={loading}
            onClick={() => handleSubmit()}
            className="px-6 py-2.5 sm:py-3 bg-slate-950 hover:bg-black dark:bg-[#E31B23] dark:hover:bg-red-700 text-white rounded-full text-xs sm:text-sm font-bold shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <span>Salvataggio...</span>
            ) : (
              <>
                <Check size={16} strokeWidth={2.5} />
                <span>
                  {isEditing 
                    ? 'Salva Modifiche' 
                    : tipologia === 'ENTRATA' 
                      ? 'Registra Entrata' 
                      : tipologia === 'GIROCONTO' 
                        ? 'Registra Giroconto' 
                        : 'Registra Spesa'}
                </span>
              </>
            )}
          </button>
        </div>

        {/* --- OVERLAYS & MODALS --- */}

        {/* CATEGORY PICKER DRAWER / SHEET */}
        {showCategoryPicker && (
          <div className="absolute inset-0 z-30 bg-white dark:bg-[#121212] flex flex-col animate-in slide-in-from-bottom duration-200">
            {/* Category Picker Header */}
            <div className="p-3.5 border-b border-slate-100 dark:border-[#222224] flex items-center justify-between gap-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryPicker(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#202022] text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200"
                >
                  <X size={16} />
                </button>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Scegli Categoria ({filteredSubcategories.length})
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setShowNewSubModal(true)}
                className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-bold flex items-center gap-1 border border-indigo-200 dark:border-indigo-800"
              >
                <Plus size={13} strokeWidth={2.5} />
                <span>Nuova</span>
              </button>
            </div>

            {/* Category Search Input */}
            <div className="p-3 border-b border-slate-100 dark:border-[#222224] flex-shrink-0">
              <div className="relative flex items-center">
                <Search size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  placeholder="Cerca categoria o macro-gruppo..."
                  autoFocus
                  className="w-full pl-9 pr-8 py-2 text-xs bg-slate-100 dark:bg-[#202022] text-slate-900 dark:text-white rounded-xl outline-none font-medium placeholder:text-slate-400"
                />
                {categorySearch && (
                  <button
                    type="button"
                    onClick={() => setCategorySearch('')}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Category Groups List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
              {subcategoriesByParent.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Nessuna categoria trovata per "{categorySearch}".
                </div>
              ) : (
                subcategoriesByParent.map(([parentName, subs]) => (
                  <div key={parentName} className="space-y-1.5">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                      {parentName}
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {subs.map(sub => {
                        const isSelected = sub.id === sottocategoriaId;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => {
                              setSottocategoriaId(sub.id);
                              setShowCategoryPicker(false);
                              haptics.tap();
                            }}
                            className={`p-2.5 rounded-2xl border text-left flex items-center gap-2.5 transition-all active:scale-95 ${
                              isSelected
                                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs'
                                : 'bg-slate-50 dark:bg-[#1E1E20] text-slate-800 dark:text-slate-200 border-slate-200/60 dark:border-white/5 hover:border-slate-300'
                            }`}
                          >
                            <CategoryIcon name={sub.icon_name} color={isSelected ? undefined : sub.colore} size={18} background={!isSelected} />
                            <span className="text-xs font-semibold truncate flex-1">
                              {sub.nome}
                            </span>
                            {isSelected && <Check size={14} strokeWidth={2.5} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TEMPLATES DRAWER / SHEET */}
        {showTemplateSheet && (
          <div className="absolute inset-0 z-30 bg-white dark:bg-[#121212] flex flex-col animate-in slide-in-from-bottom duration-200">
            <div className="p-3.5 border-b border-slate-100 dark:border-[#222224] flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowTemplateSheet(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#202022] text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200"
                >
                  <X size={16} />
                </button>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles size={15} className="text-amber-500" />
                  <span>Modelli Rapidi ({templates.length})</span>
                </h3>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
              <TransactionTemplateSelector
                templates={templates}
                selectedTemplateId={selectedTemplateId}
                onSelectTemplate={handleSelectTemplate}
                onClearTemplate={() => {
                  setSelectedTemplateId(null);
                  setShowTemplateSheet(false);
                }}
                subcategories={subcategories}
                accounts={accounts}
                funds={funds}
              />
            </div>
          </div>
        )}

        {/* IN-PLACE NEW SUBCATEGORY MODAL */}
        {showNewSubModal && (
          <div className="absolute inset-0 z-40 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-xs bg-white dark:bg-[#1E1E20] rounded-[24px] p-4 shadow-2xl border border-slate-200 dark:border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Nuova Sottocategoria
                </h4>
                <button onClick={() => setShowNewSubModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  placeholder="Nome (es. Sushi, Bollo Auto...)"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                />

                <select
                  value={newSubParent}
                  onChange={(e) => setNewSubParent(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-200"
                >
                  {parentCategories.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                  <option value="Altro">Altro</option>
                </select>

                <select
                  value={newSubTipo}
                  onChange={(e) => setNewSubTipo(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-200"
                >
                  <option value="USCITA">Spesa / Uscita</option>
                  <option value="ENTRATA">Entrata</option>
                  <option value="GIROCONTO">Giroconto</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewSubModal(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleCreateSubcategoryInPlace}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#E31B23] text-white shadow-xs"
                >
                  Crea
                </button>
              </div>
            </div>
          </div>
        )}

        {/* IN-PLACE NEW ACCOUNT MODAL */}
        {showNewAccountModal && (
          <div className="absolute inset-0 z-40 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-xs bg-white dark:bg-[#1E1E20] rounded-[24px] p-4 shadow-2xl border border-slate-200 dark:border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Nuovo Conto o Fondo
                </h4>
                <button onClick={() => setShowNewAccountModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="Nome (es. Revolut, CASH | Vio...)"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                />

                <select
                  value={newAccountType}
                  onChange={(e) => setNewAccountType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-200"
                >
                  <option value="BANCA">Conto Bancario</option>
                  <option value="CARTA_DEBITO">Carta Debito</option>
                  <option value="CARTA_CREDITO">Carta Credito</option>
                  <option value="CONTANTI">Contanti</option>
                  <option value="FONDO">Fondo / Salvadanaio</option>
                </select>

                <input
                  type="text"
                  inputMode="decimal"
                  value={newAccountInitialBalance}
                  onChange={(e) => setNewAccountInitialBalance(e.target.value)}
                  placeholder="Saldo iniziale (€)"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 outline-none font-numeric"
                />

                <div className="flex items-center justify-center gap-2 pt-1">
                  {['#E31B23', '#4f46e5', '#0284c7', '#10b981', '#f59e0b', '#8b5cf6'].map(col => (
                    <button
                      type="button"
                      key={col}
                      onClick={() => setNewAccountColor(col)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        newAccountColor === col ? 'scale-125 border-slate-900 dark:border-white shadow-xs' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewAccountModal(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  disabled={creatingAccount || !newAccountName.trim()}
                  onClick={handleCreateAccountInPlace}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#E31B23] text-white shadow-xs disabled:opacity-50"
                >
                  {creatingAccount ? '...' : 'Crea'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
