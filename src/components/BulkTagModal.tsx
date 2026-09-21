import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Hash, X, Check, Plus, Trash2, Tag, Layers, RefreshCw, AlertCircle } from 'lucide-react';
import { Movement, TagItem } from '../types';
import { TagService, DEFAULT_TAG_PALETTE } from '../services/TagService';
import { formatCurrency } from '../utils/formatters';
import { haptics } from '../utils/haptics';

interface BulkTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMovementIds: string[];
  movements: Movement[];
  onSuccess: (count: number, tagName: string, mode: 'ADD' | 'REPLACE' | 'REMOVE') => void;
}

export const BulkTagModal: React.FC<BulkTagModalProps> = ({
  isOpen,
  onClose,
  selectedMovementIds,
  movements,
  onSuccess
}) => {
  const [savedTags, setSavedTags] = useState<TagItem[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [customTagInput, setCustomTagInput] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_TAG_PALETTE[0]);
  const [mode, setMode] = useState<'ADD' | 'REPLACE' | 'REMOVE'>('ADD');
  const [saveForReuse, setSaveForReuse] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Calcolo riassuntivo dei movimenti selezionati
  const selectedMovements = useMemo(() => {
    const idSet = new Set(selectedMovementIds);
    return movements.filter(m => idSet.has(m.id));
  }, [selectedMovementIds, movements]);

  const { totalAmount, usciteTotal, entrateTotal } = useMemo(() => {
    let uscite = 0;
    let entrate = 0;
    for (const m of selectedMovements) {
      if (m.tipologia === 'USCITA') uscite += m.importo;
      else if (m.tipologia === 'ENTRATA') entrate += m.importo;
    }
    return {
      totalAmount: entrate - uscite,
      usciteTotal: uscite,
      entrateTotal: entrate
    };
  }, [selectedMovements]);

  // Carica i tag salvati all'apertura
  useEffect(() => {
    if (isOpen) {
      TagService.getSavedTags().then(tags => {
        setSavedTags(tags);
        if (tags.length > 0 && !selectedTag && !customTagInput) {
          // Preseleziona il primo se opportuno
          setSelectedTag(tags[0].nome);
          setSelectedColor(tags[0].colore || DEFAULT_TAG_PALETTE[0]);
        }
      }).catch(console.error);
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const effectiveTag = (customTagInput.trim() || selectedTag || '').replace(/^#+/, '').trim();

  const handleSelectExistingTag = (t: TagItem) => {
    setSelectedTag(t.nome);
    setCustomTagInput('');
    setSelectedColor(t.colore || DEFAULT_TAG_PALETTE[0]);
    haptics.tap();
  };

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomTagInput(e.target.value);
    setSelectedTag('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTag) {
      setErrorMsg("Seleziona o digita il nome del tag.");
      haptics.error();
      return;
    }

    if (selectedMovementIds.length === 0) {
      setErrorMsg("Nessun movimento selezionato.");
      haptics.error();
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const result = await TagService.bulkAssignTag({
        movementIds: selectedMovementIds,
        tag: effectiveTag,
        mode,
        saveForReuse,
        color: selectedColor
      });

      haptics.success();
      onSuccess(result.affectedCount, effectiveTag, mode);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Errore durante l'assegnazione del tag.");
      haptics.error();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="w-full max-w-lg bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/10 rounded-[26px] shadow-2xl overflow-hidden flex flex-col my-auto"
        >
          {/* Header One UI Style */}
          <div className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-white/5 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Tag size={16} strokeWidth={2.2} />
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Assegna Tag in Blocco
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pl-10">
                Applica o aggiorna il tag su{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {selectedMovementIds.length} {selectedMovementIds.length === 1 ? 'movimento' : 'movimenti'}
                </strong>
              </p>
            </div>

            <button
              type="button"
              onClick={() => { onClose(); haptics.tap(); }}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle size={15} className="flex-shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Riassunto selezione */}
            <div className="bg-slate-50 dark:bg-[#242426] p-3.5 rounded-2xl border border-slate-200/60 dark:border-white/5 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 block text-[11px] font-medium">Movimenti selezionati</span>
                <span className="font-bold text-slate-800 dark:text-white text-sm">
                  {selectedMovementIds.length} operazioni
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[11px] font-medium">Totale Spese</span>
                <span className="font-bold text-rose-600 dark:text-rose-400 font-numeric text-sm">
                  - {formatCurrency(usciteTotal)}
                </span>
              </div>
              {entrateTotal > 0 && (
                <div className="text-right">
                  <span className="text-slate-400 block text-[11px] font-medium">Totale Entrate</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-numeric text-sm">
                    + {formatCurrency(entrateTotal)}
                  </span>
                </div>
              )}
            </div>

            {/* Inserimento o ricerca Tag */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Hash size={13} className="text-amber-500" />
                <span>Digita o Cerca Tag</span>
              </label>

              <div className="relative flex items-center">
                <Hash size={16} className="absolute left-3.5 text-amber-500 pointer-events-none" />
                <input
                  type="text"
                  value={customTagInput}
                  onChange={handleCustomInputChange}
                  placeholder="Es. Vacanza a Napoli, Compleanno, Lavoro..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-[#242426] text-slate-900 dark:text-white rounded-2xl border border-slate-200/80 dark:border-white/10 outline-none focus:border-amber-500 dark:focus:border-amber-400 font-medium placeholder:text-slate-400 transition-colors"
                />
                {customTagInput && (
                  <button
                    type="button"
                    onClick={() => { setCustomTagInput(''); haptics.tap(); }}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Tag Salvati e Riutilizzabili (Pillole Interattive) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag size={13} className="text-indigo-500" />
                  <span>Scegli dai Tag Salvati</span>
                </label>
                <span className="text-[11px] text-slate-400 font-medium">
                  {savedTags.length} disponibili
                </span>
              </div>

              {savedTags.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-1">
                  Nessun tag salvato ancora. Digita un nome sopra per crearlo e riutilizzarlo.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 rounded-2xl bg-slate-50/70 dark:bg-[#242426]/50 border border-slate-200/50 dark:border-white/5">
                  {savedTags.map(tagItem => {
                    const isSelected = effectiveTag.toLowerCase() === tagItem.nome.toLowerCase();
                    return (
                      <button
                        key={tagItem.id}
                        type="button"
                        onClick={() => handleSelectExistingTag(tagItem)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-white shadow-xs font-bold scale-[1.02]'
                            : 'bg-white dark:bg-[#1C1C1E] text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-white/10 hover:border-amber-400/60'
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: isSelected ? '#ffffff' : (tagItem.colore || '#f59e0b') }}
                        />
                        <span>#{tagItem.nome}</span>
                        {isSelected && <Check size={12} strokeWidth={3} className="ml-0.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tavolozza Colori per il Tag */}
            {effectiveTag && (
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Colore Identificativo Tag
                </label>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                  {DEFAULT_TAG_PALETTE.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setSelectedColor(c); haptics.tap(); }}
                      style={{ backgroundColor: c }}
                      className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center transition-transform cursor-pointer ${
                        selectedColor === c ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white scale-110' : 'hover:scale-105 opacity-80 hover:opacity-100'
                      }`}
                    >
                      {selectedColor === c && <Check size={13} strokeWidth={3} className="text-white drop-shadow-xs" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Modalità di Assegnazione (One UI Segmented Cards) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                Modalità Operativa
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* Aggiungi */}
                <button
                  type="button"
                  onClick={() => { setMode('ADD'); haptics.tap(); }}
                  className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    mode === 'ADD'
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 shadow-xs'
                      : 'bg-white dark:bg-[#242426] border-slate-200/80 dark:border-white/10 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1">
                      <Plus size={13} className="text-amber-500" />
                      Aggiungi
                    </span>
                    {mode === 'ADD' && <Check size={14} className="text-amber-500" />}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    Mantiene i tag attuali e aggiunge questo.
                  </span>
                </button>

                {/* Sostituisci */}
                <button
                  type="button"
                  onClick={() => { setMode('REPLACE'); haptics.tap(); }}
                  className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    mode === 'REPLACE'
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 shadow-xs'
                      : 'bg-white dark:bg-[#242426] border-slate-200/80 dark:border-white/10 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1">
                      <RefreshCw size={13} className="text-indigo-500" />
                      Sostituisci
                    </span>
                    {mode === 'REPLACE' && <Check size={14} className="text-indigo-500" />}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    Rimpiazza tutti i tag correnti con questo.
                  </span>
                </button>

                {/* Rimuovi */}
                <button
                  type="button"
                  onClick={() => { setMode('REMOVE'); haptics.tap(); }}
                  className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    mode === 'REMOVE'
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-600 shadow-xs'
                      : 'bg-white dark:bg-[#242426] border-slate-200/80 dark:border-white/10 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1">
                      <Trash2 size={13} className="text-rose-500" />
                      Rimuovi
                    </span>
                    {mode === 'REMOVE' && <Check size={14} className="text-rose-500" />}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    Cancella questo tag dai movimenti selezionati.
                  </span>
                </button>
              </div>
            </div>

            {/* Checkbox Salva per il futuro */}
            {mode !== 'REMOVE' && (
              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-[#242426] border border-slate-200/60 dark:border-white/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveForReuse}
                  onChange={(e) => setSaveForReuse(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Salva #{effectiveTag || 'questo tag'} nei preferiti per riutilizzarlo facilmente con 1 tap
                </span>
              </label>
            )}

            {/* CTA Button */}
            <div className="pt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => { onClose(); haptics.tap(); }}
                className="flex-1 py-3 px-4 rounded-full border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                Annulla
              </button>

              <button
                type="submit"
                disabled={loading || !effectiveTag}
                className="flex-[2] py-3 px-4 rounded-full bg-[#E31B23] hover:bg-red-700 text-white font-bold text-xs shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span>Applicazione in corso...</span>
                ) : (
                  <>
                    <Check size={16} strokeWidth={2.5} />
                    <span>
                      {mode === 'REMOVE' ? 'Rimuovi Tag da' : 'Applica Tag a'}{' '}
                      {selectedMovementIds.length} Movimenti
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
