import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Repeat, 
  Calendar, 
  Check, 
  Sparkles, 
  Trash2, 
  Clock, 
  Hash, 
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Info,
  CalendarClock,
  Link2,
  Search,
  CheckSquare,
  Square,
  Maximize2
} from 'lucide-react';
import { 
  Recurrence, 
  Subcategory, 
  Account, 
  Fund, 
  MovementType, 
  RecurrenceFrequency, 
  RecurrenceLimitType,
  Movement
} from '../types';
import { RecurrenceService } from '../services/RecurrenceService';
import { MovementService } from '../services/MovementService';
import { CategoryIcon } from './CategoryIcon';
import { MovementLinkSelectorModal } from './MovementLinkSelectorModal';
import { haptics } from '../utils/haptics';
import { formatCurrency } from '../utils/formatters';

interface RecurrenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  subcategories: Subcategory[];
  accounts: Account[];
  funds: Fund[];
  recurrenceToEdit?: Recurrence | null;
  initialSubcategoryId?: string;
  onSuccess: () => void;
}

const FREQUENCY_OPTIONS: Array<{ value: RecurrenceFrequency; label: string; desc: string }> = [
  { value: 'MENSILE', label: 'Mensile', desc: 'Ogni mese nel giorno stabilito' },
  { value: 'BIMESTRALE', label: 'Bimestrale', desc: 'Ogni 2 mesi (es. bollette)' },
  { value: 'TRIMESTRALE', label: 'Trimestrale', desc: 'Ogni 3 mesi (es. canone/tasse)' },
  { value: 'SEMESTRALE', label: 'Semestrale', desc: 'Ogni 6 mesi (es. assicurazioni)' },
  { value: 'ANNUALE', label: 'Annuale', desc: 'Una volta all\'anno (es. bollo)' },
  { value: 'SETTIMANALE', label: 'Settimanale', desc: 'Ogni 7 giorni' },
  { value: 'QUATTORDICINALE', label: 'Quattordicinale', desc: 'Ogni 14 giorni' },
];

export const RecurrenceModal: React.FC<RecurrenceModalProps> = ({
  isOpen,
  onClose,
  subcategories,
  accounts,
  funds,
  recurrenceToEdit,
  initialSubcategoryId,
  onSuccess
}) => {
  const isEditing = !!recurrenceToEdit;

  // Form State
  const [nome, setNome] = useState('');
  const [importoStr, setImportoStr] = useState<string>('');
  const [tipologia, setTipologia] = useState<MovementType>('USCITA');
  const [sottocategoriaId, setSottocategoriaId] = useState('');
  const [contoId, setContoId] = useState('');
  const [frequenza, setFrequenza] = useState<RecurrenceFrequency>('MENSILE');
  const [giornoEsecuzione, setGiornoEsecuzione] = useState<number>(1);
  const [tipoLimite, setTipoLimite] = useState<RecurrenceLimitType>('ILLIMITATA');
  const [ripetizioniTotaliStr, setRipetizioniTotaliStr] = useState<string>('12');
  const [ripetizioniEseguiteStr, setRipetizioniEseguiteStr] = useState<string>('0');
  const [dataInizio, setDataInizio] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dataFine, setDataFine] = useState<string>('');
  const [generaPianificato, setGeneraPianificato] = useState<boolean>(true);
  const [attiva, setAttiva] = useState<boolean>(true);
  const [note, setNote] = useState('');

  const [searchSub, setSearchSub] = useState('');
  const [isSubDropdownOpen, setIsSubDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Existing movements linking state
  const [allMovements, setAllMovements] = useState<Movement[]>([]);
  const [selectedMovementIds, setSelectedMovementIds] = useState<string[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [isMovementPickerOpen, setIsMovementPickerOpen] = useState(false);

  // Carica tutti i movimenti per la finestra di selezione e filtri
  useEffect(() => {
    if (!isOpen) return;

    const fetchMovements = async () => {
      try {
        setLoadingMovements(true);
        const currentRecId = recurrenceToEdit?.id;
        const [allList, linked] = await Promise.all([
          MovementService.getAll(),
          currentRecId ? RecurrenceService.getLinkedMovements(currentRecId) : Promise.resolve([])
        ]);

        setAllMovements(allList);

        if (recurrenceToEdit) {
          const linkedIds = linked.map(m => m.id);
          setSelectedMovementIds(linkedIds);
        } else {
          setSelectedMovementIds([]);
        }
      } catch (e) {
        console.error("Errore caricamento movimenti:", e);
      } finally {
        setLoadingMovements(false);
      }
    };

    fetchMovements();
  }, [isOpen, recurrenceToEdit]);

  const prevIsOpenRef = useRef(false);
  const prevRecurrenceToEditRef = useRef<Recurrence | null | undefined>(undefined);

  // Initialize form
  useEffect(() => {
    const isOpening = isOpen && !prevIsOpenRef.current;
    const recChanged = isOpen && recurrenceToEdit !== prevRecurrenceToEditRef.current;

    if (isOpening || recChanged) {
      if (recurrenceToEdit) {
        setNome(recurrenceToEdit.nome || '');
        setImportoStr(recurrenceToEdit.importo > 0 ? recurrenceToEdit.importo.toString() : '');
        setTipologia(recurrenceToEdit.tipologia || 'USCITA');
        setSottocategoriaId(recurrenceToEdit.sottocategoria_id || '');
        setContoId(recurrenceToEdit.conto_id || (accounts[0]?.id || ''));
        setFrequenza(recurrenceToEdit.frequenza || 'MENSILE');
        setGiornoEsecuzione(recurrenceToEdit.giorno_esecuzione || 1);
        setTipoLimite(recurrenceToEdit.tipo_limite || 'ILLIMITATA');
        setRipetizioniTotaliStr(
          recurrenceToEdit.ripetizioni_totali !== undefined ? recurrenceToEdit.ripetizioni_totali.toString() : '12'
        );
        setRipetizioniEseguiteStr(
          recurrenceToEdit.ripetizioni_eseguite !== undefined ? recurrenceToEdit.ripetizioni_eseguite.toString() : '0'
        );
        setDataInizio(recurrenceToEdit.data_inizio || new Date().toISOString().split('T')[0]);
        setDataFine(recurrenceToEdit.data_fine || '');
        setGeneraPianificato(recurrenceToEdit.genera_pianificato_automatico !== false);
        setAttiva(recurrenceToEdit.attiva !== false);
        setNote(recurrenceToEdit.note || '');
      } else {
        const defaultSubId = initialSubcategoryId || subcategories[0]?.id || '';
        const defaultSub = subcategories.find(s => s.id === defaultSubId);
        const defaultType = defaultSub?.tipo || 'USCITA';
        
        setNome('');
        setImportoStr('');
        setTipologia(defaultType);
        setSottocategoriaId(defaultSubId);
        setContoId(accounts.find(a => a.conto_principale)?.id || accounts[0]?.id || '');
        setFrequenza('MENSILE');
        setGiornoEsecuzione(new Date().getDate());
        setTipoLimite('ILLIMITATA');
        setRipetizioniTotaliStr('12');
        setRipetizioniEseguiteStr('0');
        setDataInizio(new Date().toISOString().split('T')[0]);
        setDataFine('');
        setGeneraPianificato(true);
        setAttiva(true);
        setNote('');
      }
      setErrorMsg(null);
      setSearchSub('');
      setIsSubDropdownOpen(false);
    }

    prevIsOpenRef.current = isOpen;
    prevRecurrenceToEditRef.current = recurrenceToEdit;
  }, [isOpen, recurrenceToEdit, initialSubcategoryId]);

  const selectedSubcategory = useMemo(() => {
    return subcategories.find(s => s.id === sottocategoriaId);
  }, [subcategories, sottocategoriaId]);

  // Sincronizza tipo quando cambia la sottocategoria
  const handleSelectSubcategory = (sub: Subcategory) => {
    setSottocategoriaId(sub.id);
    setTipologia(sub.tipo);
    if (!nome.trim()) {
      setNome(sub.nome);
    }
    setIsSubDropdownOpen(false);
    setSearchSub('');
    haptics.tap();
  };

  const filteredSubcategories = useMemo(() => {
    return subcategories.filter(s => {
      if (searchSub.trim() === '') return true;
      const q = searchSub.toLowerCase();
      return (
        s.nome.toLowerCase().includes(q) ||
        s.categoria_padre.toLowerCase().includes(q)
      );
    });
  }, [subcategories, searchSub]);

  const numericImporto = parseFloat(importoStr.replace(',', '.')) || 0;
  const numericTotali = parseInt(ripetizioniTotaliStr, 10) || 0;
  const numericEseguite = parseInt(ripetizioniEseguiteStr, 10) || 0;

  const selectedMovementsList = useMemo(() => {
    return allMovements.filter(m => selectedMovementIds.includes(m.id)).sort((a, b) => {
      if (b.data !== a.data) return b.data.localeCompare(a.data);
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
  }, [allMovements, selectedMovementIds]);

  const totalSelectedMovementsAmount = useMemo(() => {
    return selectedMovementsList.reduce((sum, m) => sum + m.importo, 0);
  }, [selectedMovementsList]);

  const handleRemoveSelectedMovement = (movId: string) => {
    haptics.tap();
    setSelectedMovementIds(prev => {
      const updated = prev.filter(id => id !== movId);
      if (tipoLimite === 'TOT_VOLTE') {
        setRipetizioniEseguiteStr(updated.length.toString());
      }
      return updated;
    });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    if (!nome.trim()) {
      haptics.error();
      setErrorMsg('Inserisci un nome o descrizione per la ricorrenza.');
      return;
    }
    if (numericImporto <= 0) {
      haptics.error();
      setErrorMsg('Inserisci un importo valido maggiore di zero.');
      return;
    }
    if (!sottocategoriaId) {
      haptics.error();
      setErrorMsg('Seleziona la sottocategoria associata.');
      return;
    }
    if (!contoId) {
      haptics.error();
      setErrorMsg('Seleziona il conto o fondo di riferimento.');
      return;
    }
    if (tipoLimite === 'TOT_VOLTE' && numericTotali <= 0) {
      haptics.error();
      setErrorMsg('Specifica quante volte è ripetibile la spesa/entrata (almeno 1).');
      return;
    }

    try {
      setIsSubmitting(true);
      haptics.impact();

      const payload = {
        nome: nome.trim(),
        importo: numericImporto,
        tipologia,
        sottocategoria_id: sottocategoriaId,
        conto_id: contoId,
        frequenza,
        giorno_esecuzione: Number(giornoEsecuzione),
        tipo_limite: tipoLimite,
        ripetizioni_totali: tipoLimite === 'TOT_VOLTE' ? numericTotali : undefined,
        ripetizioni_eseguite: tipoLimite === 'TOT_VOLTE' ? numericEseguite : undefined,
        data_inizio: dataInizio,
        data_fine: tipoLimite === 'DATA_FINE' ? dataFine : undefined,
        genera_pianificato_automatico: generaPianificato,
        attiva,
        note: note.trim() || undefined,
        linked_movement_ids: selectedMovementIds
      };

      if (isEditing && recurrenceToEdit) {
        await RecurrenceService.update(recurrenceToEdit.id, payload);
      } else {
        await RecurrenceService.create(payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      haptics.error();
      setErrorMsg(err.message || 'Errore durante il salvataggio della ricorrenza.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!recurrenceToEdit) return;

    try {
      setIsSubmitting(true);
      haptics.impact();
      await RecurrenceService.delete(recurrenceToEdit.id, true);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Impossibile eliminare la ricorrenza.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/70 backdrop-blur-xs overflow-y-auto">
      <div 
        className="relative w-full max-w-lg bg-white dark:bg-[#222428] text-slate-900 dark:text-[#EAEBED] rounded-3xl border border-slate-200/90 dark:border-[#2F3136] shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]"
        style={{ fontFamily: "'Google Sans', 'Product Sans', sans-serif" }}
      >
        {/* Header Modale One UI */}
        <div className="px-5 py-4 border-b border-slate-200/80 dark:border-[#2F3136] bg-slate-50 dark:bg-[#1E2024] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 dark:bg-[#E31B23]/15 border border-red-500/20 dark:border-[#E31B23]/30 flex items-center justify-center text-[#E31B23]">
              <Repeat size={20} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#EAEBED] leading-tight">
                {isEditing ? 'Modifica Ricorrenza' : 'Nuova Ricorrenza'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#9A9DA5]">
                Ripetizione periodica o a rate per sottocategoria
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              onClose();
            }}
            className="w-9 h-9 rounded-2xl bg-slate-100 dark:bg-[#2A2C31] hover:bg-slate-200 dark:hover:bg-[#34373D] border border-slate-200/80 dark:border-[#2F3136] text-slate-600 dark:text-[#9A9DA5] hover:text-slate-900 dark:hover:text-[#EAEBED] flex items-center justify-center transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body Scrollabile */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-300 text-xs font-medium flex items-center gap-2">
              <Info size={15} className="shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Selezione Sottocategoria (Il Perno) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-[#9A9DA5] uppercase tracking-wider flex items-center justify-between">
              <span>Sottocategoria di Riferimento</span>
              {selectedSubcategory && (
                <span className="text-[11px] font-normal text-[#E31B23]">
                  {selectedSubcategory.categoria_padre}
                </span>
              )}
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSubDropdownOpen(!isSubDropdownOpen)}
                className="w-full h-13 px-3.5 rounded-2xl bg-slate-50 dark:bg-[#18191B] border border-slate-200 dark:border-[#2F3136] hover:border-slate-300 dark:hover:border-[#3A3D45] flex items-center justify-between transition-all cursor-pointer text-left"
              >
                {selectedSubcategory ? (
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs"
                      style={{ backgroundColor: selectedSubcategory.colore || '#E31B23' }}
                    >
                      <CategoryIcon iconName={selectedSubcategory.icon_name} className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-[#EAEBED] leading-none">
                        {selectedSubcategory.nome}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-[#9A9DA5] mt-0.5">
                        {selectedSubcategory.categoria_padre} • {selectedSubcategory.tipo === 'ENTRATA' ? 'Entrata' : 'Uscita'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-slate-400 dark:text-[#9A9DA5]">Seleziona una sottocategoria...</span>
                )}
                <ChevronDown size={18} className="text-slate-400 dark:text-[#9A9DA5]" />
              </button>

              {/* Tendina Sottocategorie */}
              {isSubDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-white dark:bg-[#1E2024] border border-slate-200 dark:border-[#2F3136] rounded-2xl shadow-2xl z-30 max-h-60 overflow-y-auto space-y-1">
                  <input
                    type="text"
                    placeholder="Cerca sottocategoria..."
                    value={searchSub}
                    onChange={(e) => setSearchSub(e.target.value)}
                    className="w-full h-9 px-3 mb-1.5 rounded-xl bg-slate-100 dark:bg-[#18191B] border border-slate-200 dark:border-[#2F3136] text-xs text-slate-900 dark:text-[#EAEBED] focus:outline-none focus:border-[#E31B23]"
                    autoFocus
                  />
                  {filteredSubcategories.map(sub => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => handleSelectSubcategory(sub)}
                      className={`w-full p-2 rounded-xl flex items-center justify-between text-left transition-all ${
                        sub.id === sottocategoriaId 
                          ? 'bg-[#E31B23]/10 dark:bg-[#E31B23]/15 border border-[#E31B23]/30 dark:border-[#E31B23]/40' 
                          : 'hover:bg-slate-100 dark:hover:bg-[#2A2C31]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-2xs"
                          style={{ backgroundColor: sub.colore || '#E31B23' }}
                        >
                          <CategoryIcon iconName={sub.icon_name} className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-[#EAEBED]">{sub.nome}</div>
                          <div className="text-[10px] text-slate-500 dark:text-[#9A9DA5]">{sub.categoria_padre}</div>
                        </div>
                      </div>
                      {sub.id === sottocategoriaId && (
                        <Check size={16} className="text-[#E31B23]" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. Nome Ricorrenza / Causale */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-[#9A9DA5] uppercase tracking-wider">
              Nome o Descrizione Ricorrenza
            </label>
            <input
              type="text"
              required
              placeholder="es. Rata Finanziamento, Canone Fibra, Stipendio..."
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 dark:bg-[#18191B] border border-slate-200 dark:border-[#2F3136] text-sm text-slate-900 dark:text-[#EAEBED] placeholder-slate-400 dark:placeholder-[#6E7179] focus:outline-none focus:border-[#E31B23] transition-all"
            />
          </div>

          {/* 3. Tipologia & Importo Singola Occorrenza */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Tipologia */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-[#9A9DA5] uppercase tracking-wider">
                Tipo Movimento
              </label>
              <div className="grid grid-cols-2 gap-2 h-11">
                <button
                  type="button"
                  onClick={() => {
                    setTipologia('USCITA');
                    haptics.tap();
                  }}
                  className={`rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    tipologia === 'USCITA'
                      ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/40 dark:border-red-500/50'
                      : 'bg-slate-50 dark:bg-[#18191B] text-slate-600 dark:text-[#9A9DA5] border border-slate-200 dark:border-[#2F3136] hover:bg-slate-100 dark:hover:bg-[#2A2C31]'
                  }`}
                >
                  <span>Spesa / Uscita</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTipologia('ENTRATA');
                    haptics.tap();
                  }}
                  className={`rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    tipologia === 'ENTRATA'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 dark:border-emerald-500/50'
                      : 'bg-slate-50 dark:bg-[#18191B] text-slate-600 dark:text-[#9A9DA5] border border-slate-200 dark:border-[#2F3136] hover:bg-slate-100 dark:hover:bg-[#2A2C31]'
                  }`}
                >
                  <span>Entrata</span>
                </button>
              </div>
            </div>

            {/* Importo */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-[#9A9DA5] uppercase tracking-wider">
                Importo per Volta (€)
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={importoStr}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setImportoStr(e.target.value)}
                  className="w-full h-11 px-3.5 pr-8 rounded-2xl bg-slate-50 dark:bg-[#18191B] border border-slate-200 dark:border-[#2F3136] text-right font-mono text-base font-bold text-slate-900 dark:text-[#EAEBED] placeholder-slate-400 dark:placeholder-[#6E7179] focus:outline-none focus:border-[#E31B23] transition-all"
                />
                <span className="absolute right-3 top-3 text-xs font-bold text-slate-400 dark:text-[#9A9DA5] pointer-events-none">
                  €
                </span>
              </div>
            </div>
          </div>

          {/* 4. Conto di Addebito/Accredito */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-[#9A9DA5] uppercase tracking-wider">
              Conto o Fondo di Riferimento
            </label>
            <select
              value={contoId}
              onChange={(e) => setContoId(e.target.value)}
              className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 dark:bg-[#18191B] border border-slate-200 dark:border-[#2F3136] text-sm text-slate-900 dark:text-[#EAEBED] focus:outline-none focus:border-[#E31B23] transition-all"
            >
              <optgroup label="Conti Correnti & Carte">
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.nome_conto} ({formatCurrency(acc.saldo_reale || acc.saldo_iniziale)})
                  </option>
                ))}
              </optgroup>
              {funds.length > 0 && (
                <optgroup label="Fondi di Riserva">
                  {funds.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.nome_fondo} ({formatCurrency(f.saldo_reale || f.saldo_iniziale)})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* 5. Frequenza e Giorno del Mese */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-[#9A9DA5] uppercase tracking-wider">
                Frequenza
              </label>
              <select
                value={frequenza}
                onChange={(e) => setFrequenza(e.target.value as RecurrenceFrequency)}
                className="w-full h-11 px-3 rounded-2xl bg-slate-50 dark:bg-[#18191B] border border-slate-200 dark:border-[#2F3136] text-xs font-semibold text-slate-900 dark:text-[#EAEBED] focus:outline-none focus:border-[#E31B23]"
              >
                {FREQUENCY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-[#9A9DA5] uppercase tracking-wider">
                Giorno di Esecuzione (1-31)
              </label>
              <input
                type="number"
                min={1}
                max={31}
                value={giornoEsecuzione}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setGiornoEsecuzione(Number(e.target.value))}
                className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 dark:bg-[#18191B] border border-slate-200 dark:border-[#2F3136] text-center font-mono text-sm font-bold text-slate-900 dark:text-[#EAEBED] focus:outline-none focus:border-[#E31B23]"
              />
            </div>
          </div>

          {/* 6. REGOLA DI RIPETIZIONE: Illimitata vs Tot Volte vs Fino a Data */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#18191B] border border-slate-200 dark:border-[#2F3136] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-[#EAEBED] uppercase tracking-wider flex items-center gap-1.5">
                <CalendarClock size={14} className="text-[#E31B23]" />
                Regola di Ripetizione & Scadenza
              </span>
            </div>

            {/* Segmented Control per Tipo Limite */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-white dark:bg-[#222428] rounded-xl border border-slate-200 dark:border-[#2F3136]">
              <button
                type="button"
                onClick={() => {
                  setTipoLimite('ILLIMITATA');
                  haptics.tap();
                }}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  tipoLimite === 'ILLIMITATA'
                    ? 'bg-[#E31B23] text-white shadow-xs'
                    : 'text-slate-500 dark:text-[#9A9DA5] hover:text-slate-900 dark:hover:text-[#EAEBED]'
                }`}
              >
                Illimitata
              </button>
              <button
                type="button"
                onClick={() => {
                  setTipoLimite('TOT_VOLTE');
                  haptics.tap();
                }}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  tipoLimite === 'TOT_VOLTE'
                    ? 'bg-[#E31B23] text-white shadow-xs'
                    : 'text-slate-500 dark:text-[#9A9DA5] hover:text-slate-900 dark:hover:text-[#EAEBED]'
                }`}
              >
                Per Tot Volte
              </button>
              <button
                type="button"
                onClick={() => {
                  setTipoLimite('DATA_FINE');
                  haptics.tap();
                }}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  tipoLimite === 'DATA_FINE'
                    ? 'bg-[#E31B23] text-white shadow-xs'
                    : 'text-slate-500 dark:text-[#9A9DA5] hover:text-slate-900 dark:hover:text-[#EAEBED]'
                }`}
              >
                Fino a Data
              </button>
            </div>

            {/* Se TOT_VOLTE */}
            {tipoLimite === 'TOT_VOLTE' && (
              <div className="pt-2 border-t border-slate-200 dark:border-[#2F3136] grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-500 dark:text-[#9A9DA5]">
                    Numero Totale Ripetizioni (Rate/Mesi)
                  </label>
                  <input
                    type="number"
                    min={1}
                    placeholder="es. 12"
                    value={ripetizioniTotaliStr}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setRipetizioniTotaliStr(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#222428] border border-slate-200 dark:border-[#2F3136] text-center font-mono font-bold text-sm text-slate-900 dark:text-[#EAEBED] focus:outline-none focus:border-[#E31B23]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-500 dark:text-[#9A9DA5]">
                    Già Eseguite / Pagate
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={ripetizioniEseguiteStr}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setRipetizioniEseguiteStr(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#222428] border border-slate-200 dark:border-[#2F3136] text-center font-mono font-bold text-sm text-slate-900 dark:text-[#EAEBED] focus:outline-none focus:border-[#E31B23]"
                  />
                </div>
                {numericTotali > 0 && (
                  <div className="sm:col-span-2 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-xl border border-amber-200 dark:border-amber-900/50">
                    💡 La spesa si ripeterà per <b>{numericTotali}</b> volte in totale. Rimanenti: <b>{Math.max(0, numericTotali - numericEseguite)}</b>. Totale stimato: <b>{formatCurrency(numericTotali * numericImporto)}</b>.
                  </div>
                )}
              </div>
            )}

            {/* Se DATA_FINE */}
            {tipoLimite === 'DATA_FINE' && (
              <div className="pt-2 border-t border-slate-200 dark:border-[#2F3136] space-y-1">
                <label className="text-[11px] font-medium text-slate-500 dark:text-[#9A9DA5]">
                  Data di Scadenza Finale
                </label>
                <input
                  type="date"
                  value={dataFine}
                  onChange={(e) => setDataFine(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#222428] border border-slate-200 dark:border-[#2F3136] text-sm text-slate-900 dark:text-[#EAEBED] focus:outline-none focus:border-[#E31B23]"
                />
              </div>
            )}
          </div>

          {/* 7. MOVIMENTI PASSATI GIÀ REGISTRATI (Collega Movimenti Esistenti) */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#18191B] border border-slate-200 dark:border-[#2F3136] space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#E31B23]/10 dark:bg-[#E31B23]/15 border border-[#E31B23]/25 flex items-center justify-center text-[#E31B23]">
                  <Link2 size={16} />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-[#EAEBED] flex items-center gap-2">
                    <span>Movimenti Passati Già Registrati</span>
                    <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold border ${
                      selectedMovementIds.length > 0
                        ? 'bg-[#E31B23] text-white border-[#E31B23]'
                        : 'bg-slate-200 dark:bg-[#2A2C31] text-slate-600 dark:text-[#9A9DA5] border-slate-300 dark:border-[#3A3D45]'
                    }`}>
                      {selectedMovementIds.length} collegati
                    </span>
                  </div>
                  <div className="text-[10.5px] text-slate-500 dark:text-[#9A9DA5]">
                    Associa transazioni o rate passate a questa regola
                  </div>
                </div>
              </div>

              {selectedMovementIds.length > 0 && (
                <div className="text-right">
                  <div className="text-xs font-bold font-mono text-slate-900 dark:text-[#EAEBED] tabular-nums">
                    {formatCurrency(totalSelectedMovementsAmount)}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-[#9A9DA5]">
                    Totale collegato
                  </div>
                </div>
              )}
            </div>

            {/* Pulsante Principale per Aprire la Finestra a Schermo Intero / Spaziosa */}
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                setIsMovementPickerOpen(true);
              }}
              className="w-full py-3 px-4 rounded-2xl bg-white dark:bg-[#222428] hover:bg-slate-100 dark:hover:bg-[#2A2C31] border border-slate-200 dark:border-[#2F3136] hover:border-[#E31B23]/50 dark:hover:border-[#E31B23]/50 text-slate-900 dark:text-[#EAEBED] transition-all flex items-center justify-between gap-3 group cursor-pointer shadow-xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#18191B] group-hover:bg-[#E31B23]/15 group-hover:text-[#E31B23] flex items-center justify-center text-slate-500 dark:text-[#9A9DA5] transition-all">
                  <Search size={16} />
                </div>
                <div className="text-left min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-[#EAEBED] group-hover:text-[#E31B23] transition-colors truncate">
                    🔍 Cerca e Filtra Movimenti da Associare
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-[#9A9DA5] truncate">
                    Filtri per data, importo, conto e ricerca libera
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs font-bold text-[#E31B23] bg-[#E31B23]/10 px-2.5 py-1 rounded-xl">
                  {selectedMovementIds.length > 0 ? `${selectedMovementIds.length} Selezionati` : 'Scegli'}
                </span>
                <Maximize2 size={15} className="text-slate-400 group-hover:text-[#E31B23] transition-colors" />
              </div>
            </button>

            {/* Preview dei Movimenti Selezionati */}
            {selectedMovementsList.length > 0 ? (
              <div className="space-y-1.5 pt-1">
                <div className="text-[10.5px] font-bold text-slate-400 dark:text-[#9A9DA5] uppercase tracking-wider">
                  Movimenti Attualmente Collegati ({selectedMovementsList.length}):
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                  {selectedMovementsList.map(mov => {
                    const accName = accounts.find(a => a.id === mov.conto_origine)?.nome_conto || 
                                    funds.find(f => f.id === mov.conto_origine)?.nome_fondo || 
                                    'Conto';
                    return (
                      <div
                        key={mov.id}
                        className="p-2 rounded-xl bg-white dark:bg-[#222428] border border-slate-200 dark:border-[#2F3136] flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-900 dark:text-[#EAEBED] truncate">
                            {mov.descrizione}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-[#9A9DA5] flex items-center gap-1.5">
                            <span className="font-mono">{mov.data.split('-').reverse().join('/')}</span>
                            <span>•</span>
                            <span>{accName}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-bold text-slate-900 dark:text-[#EAEBED] tabular-nums">
                            {formatCurrency(mov.importo)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSelectedMovement(mov.id)}
                            className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-[#18191B] hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-500 flex items-center justify-center transition-all cursor-pointer"
                            title="Rimuovi collegamento"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 dark:text-[#9A9DA5] bg-white dark:bg-[#222428] p-3 rounded-xl border border-slate-200/80 dark:border-[#2F3136]">
                💡 Se hai già pagato delle rate o registrato transazioni nel passato per questa spesa/entrata, puoi trovarle e collegarle rapidamente con la finestra di ricerca.
              </div>
            )}
          </div>

          {/* 8. Opzioni Aggiuntive: Genera Pianificato & Attiva */}
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-[#18191B] border border-slate-200 dark:border-[#2F3136] cursor-pointer hover:bg-slate-100 dark:hover:bg-[#2A2C31]/50 transition-all">
              <input
                type="checkbox"
                checked={generaPianificato}
                onChange={(e) => setGeneraPianificato(e.target.checked)}
                className="w-5 h-5 rounded-md accent-[#E31B23] cursor-pointer"
              />
              <div className="text-xs">
                <div className="font-bold text-slate-900 dark:text-[#EAEBED]">Genera automaticamente movimenti pianificati</div>
                <div className="text-slate-500 dark:text-[#9A9DA5]">Mostra le future occorrenze nel calendario e nei calcoli budget</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-[#18191B] border border-slate-200 dark:border-[#2F3136] cursor-pointer hover:bg-slate-100 dark:hover:bg-[#2A2C31]/50 transition-all">
              <input
                type="checkbox"
                checked={attiva}
                onChange={(e) => setAttiva(e.target.checked)}
                className="w-5 h-5 rounded-md accent-[#E31B23] cursor-pointer"
              />
              <div className="text-xs">
                <div className="font-bold text-slate-900 dark:text-[#EAEBED]">Ricorrenza attiva</div>
                <div className="text-slate-500 dark:text-[#9A9DA5]">Se disattivata, rimane memorizzata ma non genera addebiti futuri</div>
              </div>
            </label>
          </div>

          {/* 8. Note Facoltative */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-[#9A9DA5] uppercase tracking-wider">
              Note o Dettagli (opzionale)
            </label>
            <input
              type="text"
              placeholder="es. Codice contratto, note addebito RID..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full h-10 px-3.5 rounded-2xl bg-slate-50 dark:bg-[#18191B] border border-slate-200 dark:border-[#2F3136] text-xs text-slate-900 dark:text-[#EAEBED] placeholder-slate-400 dark:placeholder-[#6E7179] focus:outline-none focus:border-[#E31B23]"
            />
          </div>
        </form>

        {/* Sticky Footer Actions One UI */}
        <div className="p-4 border-t border-slate-200/80 dark:border-[#2F3136] bg-slate-50 dark:bg-[#1E2024] flex items-center justify-between shrink-0">
          {isEditing ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/40 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Trash2 size={15} />
              <span>Elimina</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-[#9A9DA5] hover:text-slate-900 dark:hover:text-[#EAEBED] hover:bg-slate-100 dark:hover:bg-[#2A2C31] transition-all cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-[#E31B23] hover:bg-[#c9151c] text-white shadow-lg shadow-red-950/20 dark:shadow-red-950/40 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Check size={16} />
              <span>{isEditing ? 'Salva Modifiche' : 'Crea Ricorrenza'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Finestra Estesa a Schermo Intero per Ricerca & Filtri Movimenti */}
      <MovementLinkSelectorModal
        isOpen={isMovementPickerOpen}
        onClose={() => setIsMovementPickerOpen(false)}
        onConfirm={(newSelectedIds) => {
          setSelectedMovementIds(newSelectedIds);
          if (tipoLimite === 'TOT_VOLTE') {
            setRipetizioniEseguiteStr(newSelectedIds.length.toString());
          }
        }}
        allMovements={allMovements}
        initialSelectedIds={selectedMovementIds}
        currentSubcategoryId={sottocategoriaId}
        subcategories={subcategories}
        accounts={accounts}
        funds={funds}
        recurrenceName={nome}
        targetAmount={numericImporto}
        targetType={tipologia}
        recurrenceLimitType={tipoLimite}
        totalRepetitions={tipoLimite === 'TOT_VOLTE' ? numericTotali : undefined}
      />
    </div>
  );
};
