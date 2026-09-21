import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Tag, Hash, Plus, Trash2, Edit2, Check, X, Search, Filter, AlertCircle } from 'lucide-react';
import { TagItem } from '../types';
import { TagService, DEFAULT_TAG_PALETTE } from '../services/TagService';
import { haptics } from '../utils/haptics';

interface TagManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTagToFilter?: (tagName: string) => void;
}

export const TagManagerModal: React.FC<TagManagerModalProps> = ({
  isOpen,
  onClose,
  onSelectTagToFilter
}) => {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  
  // New tag form state
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(DEFAULT_TAG_PALETTE[0]);

  // Editing state
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('');

  // Delete popover state anchored to clicked button
  const [deleteAnchor, setDeleteAnchor] = useState<{
    tag: TagItem;
    top: number;
    left: number;
    placement: 'below' | 'above';
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const list = await TagService.getSavedTags();
      setTags(list);

      const counts: Record<string, number> = {};
      for (const t of list) {
        counts[t.nome] = await TagService.getTagUsageCount(t.nome);
      }
      setUsageCounts(counts);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setIsCreating(false);
      setEditingTagId(null);
      setDeleteAnchor(null);
      setErrorMsg(null);
    }
  }, [isOpen]);

  // Chiudi il popup di conferma con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && deleteAnchor) {
        setDeleteAnchor(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteAnchor]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTagName.trim().replace(/^#+/, '');
    if (!clean) {
      setErrorMsg("Inserisci il nome del tag.");
      haptics.error();
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      await TagService.createTag({
        nome: clean,
        colore: newTagColor
      });
      setNewTagName('');
      setIsCreating(false);
      await loadData();
      haptics.success();
    } catch (err: any) {
      setErrorMsg(err.message || "Errore nella creazione del tag.");
      haptics.error();
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (t: TagItem) => {
    setEditingTagId(t.id);
    setEditTagName(t.nome);
    setEditTagColor(t.colore || DEFAULT_TAG_PALETTE[0]);
    haptics.tap();
  };

  const handleSaveEdit = async () => {
    if (!editingTagId) return;
    const clean = editTagName.trim().replace(/^#+/, '');
    if (!clean) {
      setErrorMsg("Il nome non può essere vuoto.");
      haptics.error();
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      await TagService.updateTag(editingTagId, {
        nome: clean,
        colore: editTagColor
      });
      setEditingTagId(null);
      await loadData();
      haptics.success();
    } catch (err: any) {
      setErrorMsg(err.message || "Errore nel salvataggio.");
      haptics.error();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteButtonClick = (e: React.MouseEvent<HTMLButtonElement>, tagItem: TagItem) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const popupWidth = Math.min(300, window.innerWidth - 32);
    const popupHeight = 160;

    // Posizionamento orizzontale allineato al pulsante con padding dai bordi schermo
    let left = rect.right - popupWidth;
    if (left < 16) left = 16;
    if (left + popupWidth > window.innerWidth - 16) {
      left = window.innerWidth - popupWidth - 16;
    }

    // Posizionamento verticale: sotto al pulsante, oppure sopra se troppo vicino al fondo
    let top = rect.bottom + 8;
    let placement: 'below' | 'above' = 'below';
    if (top + popupHeight > window.innerHeight - 16) {
      top = Math.max(16, rect.top - popupHeight - 8);
      placement = 'above';
    }

    setDeleteAnchor({
      tag: tagItem,
      top,
      left,
      placement
    });
    haptics.tap();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteAnchor) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      await TagService.deleteTag(deleteAnchor.tag.id, true);
      setDeleteAnchor(null);
      await loadData();
      haptics.success();
    } catch (err: any) {
      setErrorMsg(err.message || "Errore nella cancellazione del tag.");
      haptics.error();
    } finally {
      setLoading(false);
    }
  };

  const filteredTags = tags.filter(t => 
    t.nome.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="w-full max-w-lg bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/10 rounded-[26px] shadow-2xl overflow-hidden flex flex-col my-auto"
        >
          {/* Header One UI */}
          <div className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Tag size={16} strokeWidth={2.2} />
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Tag Salvati e Riutilizzabili
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {tags.length} tag registrati per catalogazione e report rapidi
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => { onClose(); haptics.tap(); }}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle size={15} className="flex-shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Pulsante Nuovo Tag o Form di Creazione */}
            {!isCreating ? (
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cerca tag..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-[#242426] text-slate-900 dark:text-white rounded-full border border-slate-200/80 dark:border-white/10 outline-none placeholder:text-slate-400 focus:border-amber-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => { setIsCreating(true); haptics.tap(); }}
                  className="px-4 py-2 bg-[#E31B23] hover:bg-red-700 text-white rounded-full text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all flex-shrink-0"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  <span>Nuovo Tag</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="p-4 bg-slate-50 dark:bg-[#242426] rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                    <Plus size={13} className="text-amber-500" />
                    Crea Nuovo Tag
                  </span>
                  <button
                    type="button"
                    onClick={() => { setIsCreating(false); haptics.tap(); }}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Hash size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500" />
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="Nome tag (es. Viaggi, Regali, Casa...)"
                      autoFocus
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-[#1C1C1E] text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-white/10 outline-none focus:border-amber-500 font-medium"
                    />
                  </div>
                </div>

                {/* Colori rapidi */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  <span className="text-[10px] font-medium text-slate-400 mr-1 flex-shrink-0">Colore:</span>
                  {DEFAULT_TAG_PALETTE.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setNewTagColor(c); haptics.tap(); }}
                      style={{ backgroundColor: c }}
                      className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-transform cursor-pointer ${
                        newTagColor === c ? 'ring-2 ring-offset-1 ring-slate-800 dark:ring-white scale-110' : 'opacity-80 hover:opacity-100'
                      }`}
                    >
                      {newTagColor === c && <Check size={10} strokeWidth={3} className="text-white" />}
                    </button>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setIsCreating(false); haptics.tap(); }}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/5"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !newTagName.trim()}
                    className="px-4 py-1.5 bg-[#E31B23] hover:bg-red-700 text-white rounded-full text-xs font-bold disabled:opacity-50 transition-all flex items-center gap-1"
                  >
                    <Check size={12} strokeWidth={2.5} />
                    <span>Salva Tag</span>
                  </button>
                </div>
              </form>
            )}

            {/* Lista Tag Esistenti */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Tag Disponibili ({filteredTags.length})
              </span>

              {filteredTags.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Nessun tag trovato con questa ricerca.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/5 rounded-2xl bg-slate-50/60 dark:bg-[#242426]/60 border border-slate-200/60 dark:border-white/5 overflow-hidden">
                  {filteredTags.map(tagItem => {
                    const isEditing = editingTagId === tagItem.id;
                    const count = usageCounts[tagItem.nome] || 0;

                    if (isEditing) {
                      return (
                        <div key={tagItem.id} className="p-3 bg-amber-50/40 dark:bg-amber-950/20 space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editTagName}
                              onChange={(e) => setEditTagName(e.target.value)}
                              className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-[#1C1C1E] text-slate-900 dark:text-white rounded-xl border border-amber-400 outline-none font-medium"
                            />
                            <button
                              type="button"
                              onClick={handleSaveEdit}
                              className="p-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors"
                              title="Salva modifiche"
                            >
                              <Check size={14} strokeWidth={2.5} />
                            </button>
                            <button
                              type="button"
                              onClick={() => { setEditingTagId(null); haptics.tap(); }}
                              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
                              title="Annulla"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          {/* Colore edit */}
                          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                            {DEFAULT_TAG_PALETTE.map(c => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setEditTagColor(c)}
                                style={{ backgroundColor: c }}
                                className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center cursor-pointer ${
                                  editTagColor === c ? 'ring-2 ring-offset-1 ring-slate-800 dark:ring-white scale-110' : 'opacity-70'
                                }`}
                              >
                                {editTagColor === c && <Check size={8} strokeWidth={3} className="text-white" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={tagItem.id}
                        className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-white dark:hover:bg-[#1C1C1E] transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: tagItem.colore || '#f59e0b' }}
                          />
                          <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">
                            #{tagItem.nome}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-white/10 text-[10px] font-medium text-slate-600 dark:text-slate-400 flex-shrink-0">
                            {count} {count === 1 ? 'movimento' : 'movimenti'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* Quick Filter button */}
                          {onSelectTagToFilter && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectTagToFilter(tagItem.nome);
                                onClose();
                                haptics.tap();
                              }}
                              className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                              title={`Filtra movimenti con tag #${tagItem.nome}`}
                            >
                              <Filter size={13} />
                            </button>
                          )}

                          {/* Edit button */}
                          <button
                            type="button"
                            onClick={() => handleStartEdit(tagItem)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                            title="Modifica tag"
                          >
                            <Edit2 size={13} />
                          </button>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteButtonClick(e, tagItem)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              deleteAnchor?.tag.id === tagItem.id
                                ? 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
                                : 'text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-white/10'
                            }`}
                            title="Elimina tag"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Pop up di Conferma Eliminazione Tag ancorato esattamente dove l'utente ha cliccato */}
          <AnimatePresence>
            {deleteAnchor && (
              <>
                {/* Backdrop invisibile per chiudere cliccando all'esterno */}
                <div
                  className="fixed inset-0 z-[70]"
                  onClick={() => { setDeleteAnchor(null); haptics.tap(); }}
                />

                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: deleteAnchor.placement === 'below' ? -6 : 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: deleteAnchor.placement === 'below' ? -6 : 6 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  style={{ top: `${deleteAnchor.top}px`, left: `${deleteAnchor.left}px` }}
                  className="fixed z-[75] w-[290px] sm:w-[310px] p-4 bg-white dark:bg-[#1E1E20] border border-rose-200/90 dark:border-rose-900/80 rounded-[22px] shadow-2xl space-y-3 select-none text-left"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Freccia indicatrice del popup rivolta verso il pulsante */}
                  <div
                    className={`absolute right-4 w-3 h-3 bg-white dark:bg-[#1E1E20] border-rose-200/90 dark:border-rose-900/80 transform rotate-45 ${
                      deleteAnchor.placement === 'below'
                        ? '-top-1.5 border-t border-l'
                        : '-bottom-1.5 border-b border-r'
                    }`}
                  />

                  <div className="flex items-start gap-2.5 relative z-10">
                    <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center flex-shrink-0 text-[#E31B23]">
                      <Trash2 size={15} strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        Eliminare #{deleteAnchor.tag.nome}?
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                        Verrà eliminato dai tag salvati e rimosso da{' '}
                        <strong className="text-slate-800 dark:text-slate-200 font-numeric">
                          {usageCounts[deleteAnchor.tag.nome] || 0}
                        </strong>{' '}
                        {usageCounts[deleteAnchor.tag.nome] === 1 ? 'movimento' : 'movimenti'}.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 relative z-10">
                    <button
                      type="button"
                      onClick={() => { setDeleteAnchor(null); haptics.tap(); }}
                      className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteConfirm}
                      disabled={loading}
                      className="px-4 py-1.5 bg-[#E31B23] hover:bg-red-700 text-white rounded-full text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                      <Trash2 size={12} strokeWidth={2.5} />
                      <span>{loading ? 'Eliminazione...' : 'Conferma'}</span>
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-[#1C1C1E] flex justify-end">
            <button
              type="button"
              onClick={() => { onClose(); haptics.tap(); }}
              className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-xs"
            >
              Chiudi
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
