import React, { useState } from 'react';
import { Subcategory, MovementType, MovementNecessity, SubcategoryClassification, getSubcategoryClassification, getSubcategoryNecessity } from '../types';
import { CategoryService } from '../services/CategoryService';
import { CategoryIcon, AVAILABLE_ICONS, AVAILABLE_EMOJIS } from './CategoryIcon';
import { X, Tag, Plus, Check, Edit2, Sparkles, Palette, ShieldCheck, TrendingUp, AlertCircle, ShoppingBag } from 'lucide-react';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  subcategories: Subcategory[];
  onRefresh: () => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  subcategories,
  onRefresh
}) => {
  const [selectedSub, setSelectedSub] = useState<Subcategory | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [parentCategory, setParentCategory] = useState('');
  const [tipo, setTipo] = useState<MovementType>('USCITA');
  const [classificazione, setClassificazione] = useState<SubcategoryClassification>('SPESE_ESSENZIALI');
  const [necessita, setNecessita] = useState<MovementNecessity>('DEVO');
  const [iconName, setIconName] = useState('Tag');
  const [colore, setColore] = useState('#E31B23');
  const [iconMode, setIconMode] = useState<'EMOJI' | 'ICONS'>('EMOJI');
  const [filterTipo, setFilterTipo] = useState<'ALL' | 'USCITA' | 'ENTRATA'>('ALL');
  const [iconSearch, setIconSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const startEdit = (sub: Subcategory) => {
    setSelectedSub(sub);
    setName(sub.nome);
    setParentCategory(sub.categoria_padre);
    setTipo(sub.tipo);
    setClassificazione(sub.classificazione || getSubcategoryClassification(sub));
    setNecessita(getSubcategoryNecessity(sub));
    setIconName(sub.icon_name || 'Tag');
    setColore(sub.colore || (sub.tipo === 'ENTRATA' ? '#10B981' : '#E31B23'));
    setIsEditing(true);
    setMessage(null);
  };

  const startNew = () => {
    setSelectedSub(null);
    setName('');
    setParentCategory('Varie');
    setTipo('USCITA');
    setClassificazione('SPESE_ESSENZIALI');
    setNecessita('DEVO');
    setIconName('🛒');
    setColore('#E31B23');
    setIsEditing(true);
    setMessage(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const resolvedClassificazione: SubcategoryClassification = tipo === 'ENTRATA'
      ? 'GUADAGNI'
      : (classificazione === 'GUADAGNI' ? 'SPESE_ESSENZIALI' : classificazione);

    try {
      if (selectedSub) {
        // Aggiornamento
        await CategoryService.updateSubcategory(selectedSub.id, {
          nome: name.trim(),
          categoria_padre: parentCategory.trim() || 'Varie',
          tipo,
          classificazione: resolvedClassificazione,
          necessita,
          icon_name: iconName,
          colore
        });
        setMessage("Categoria aggiornata con successo!");
      } else {
        // Creazione nuova
        await CategoryService.createSubcategory({
          nome: name.trim(),
          categoria_padre: parentCategory.trim() || 'Varie',
          tipo,
          classificazione: resolvedClassificazione,
          necessita,
          icon_name: iconName,
          colore,
          preferita: true
        });
        setMessage("Nuova categoria creata con successo!");
      }

      onRefresh();
      setTimeout(() => {
        setIsEditing(false);
        setMessage(null);
      }, 700);
    } catch (err: any) {
      setMessage(err.message || "Errore nel salvataggio.");
    }
  };

  const filtered = subcategories.filter(s => {
    if (filterTipo === 'ALL') return true;
    return s.tipo === filterTipo;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#1C1C1E] w-full max-w-xl rounded-[26px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Tag size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                Personalizza Categorie & Icone
              </h2>
              <p className="text-xs text-slate-400">
                Assegna emoji o icone dedicate alle categorie standard e personalizzate
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-5 overflow-y-auto no-scrollbar space-y-4">
          {message && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {message}
            </div>
          )}

          {isEditing ? (
            /* Editing / Creation Form */
            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {selectedSub ? `Modifica: ${selectedSub.nome}` : 'Nuova Sottocategoria'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  Annulla
                </button>
              </div>

              {/* Live Preview */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 flex items-center justify-center gap-3 border border-slate-200/80 dark:border-slate-750">
                <CategoryIcon name={iconName} color={colore} tipo={tipo} size={28} />
                <div className="min-w-0">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100 block truncate">
                    {name || 'Nome Sottocategoria'}
                  </span>
                  <span className="text-xs text-slate-400">
                    {parentCategory || 'Categoria Padre'} • {tipo === 'ENTRATA' ? 'Entrata' : 'Spesa'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                    Nome Sottocategoria
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    placeholder="Es. Palestra, Spesa..."
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                    Categoria Padre
                  </label>
                  <input
                    type="text"
                    value={parentCategory}
                    onChange={e => setParentCategory(e.target.value)}
                    placeholder="Es. Salute, Casa, Alimentari..."
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                    Tipologia
                  </label>
                  <select
                    value={tipo}
                    onChange={e => {
                      const newTipo = e.target.value as MovementType;
                      setTipo(newTipo);
                      if (newTipo === 'ENTRATA') setClassificazione('GUADAGNI');
                      else if (classificazione === 'GUADAGNI') setClassificazione('SPESE_ESSENZIALI');
                    }}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-slate-100"
                  >
                    <option value="USCITA">Spesa / Uscita</option>
                    <option value="ENTRATA">Entrata / Guadagno</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                    Colore di Accento
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colore}
                      onChange={e => setColore(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 dark:border-slate-700"
                    />
                    <span className="text-xs font-mono text-slate-500">{colore}</span>
                  </div>
                </div>
              </div>

              {/* Classificazione Macro & Regola 50/30/20 */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Regola 50/30/20 (Assegnazione Automatica)
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Applicata automaticamente alle nuove transazioni
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNecessita('DEVO');
                        if (tipo === 'USCITA') setClassificazione('SPESE_ESSENZIALI');
                      }}
                      className={`p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer ${
                        necessita === 'DEVO'
                          ? 'bg-[#E31B23] text-white border-[#E31B23] shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-red-400'
                      }`}
                    >
                      <span className="text-xs font-bold">Devo (50%)</span>
                      <span className={`text-[10px] ${necessita === 'DEVO' ? 'text-red-100' : 'text-slate-400'}`}>
                        Spese fisse & rate
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNecessita('HO_BISOGNO');
                        if (tipo === 'USCITA') setClassificazione('SPESE_ESSENZIALI');
                      }}
                      className={`p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer ${
                        necessita === 'HO_BISOGNO'
                          ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                      }`}
                    >
                      <span className="text-xs font-bold">Ho bisogno (30%)</span>
                      <span className={`text-[10px] ${necessita === 'HO_BISOGNO' ? 'text-amber-100' : 'text-slate-400'}`}>
                        Spesa & necessità
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNecessita('VOGLIO');
                        if (tipo === 'USCITA') setClassificazione('SPESE_EXTRA');
                      }}
                      className={`p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer ${
                        necessita === 'VOGLIO'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                      }`}
                    >
                      <span className="text-xs font-bold">Voglio (20%)</span>
                      <span className={`text-[10px] ${necessita === 'VOGLIO' ? 'text-emerald-100' : 'text-slate-400'}`}>
                        Svago & extra
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1.5">
                    Classificazione Budget & Grafici
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (tipo !== 'ENTRATA') setTipo('ENTRATA');
                        setClassificazione('GUADAGNI');
                      }}
                      className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer ${
                        classificazione === 'GUADAGNI' || tipo === 'ENTRATA'
                          ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                      }`}
                    >
                      <TrendingUp size={15} />
                      <span className="text-[11px] font-bold">Guadagni</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (tipo !== 'USCITA') setTipo('USCITA');
                        setClassificazione('SPESE_ESSENZIALI');
                      }}
                      className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer ${
                        tipo === 'USCITA' && classificazione === 'SPESE_ESSENZIALI'
                          ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                      }`}
                    >
                      <ShieldCheck size={15} />
                      <span className="text-[11px] font-bold">Spesa Essenziale</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (tipo !== 'USCITA') setTipo('USCITA');
                        setClassificazione('SPESE_EXTRA');
                      }}
                      className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer ${
                        tipo === 'USCITA' && classificazione === 'SPESE_EXTRA'
                          ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                      }`}
                    >
                      <Sparkles size={15} />
                      <span className="text-[11px] font-bold">Spesa Extra</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Icon / Emoji Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Seleziona Icona o Emoji
                  </label>
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setIconMode('EMOJI')}
                      className={`px-3 py-1 rounded-md transition-all ${iconMode === 'EMOJI' ? 'bg-white dark:bg-slate-700 shadow-xs text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}
                    >
                      Emoji ({AVAILABLE_EMOJIS.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setIconMode('ICONS')}
                      className={`px-3 py-1 rounded-md transition-all ${iconMode === 'ICONS' ? 'bg-white dark:bg-slate-700 shadow-xs text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}
                    >
                      Icone Lucide ({AVAILABLE_ICONS.length})
                    </button>
                  </div>
                </div>

                {/* Quick Search for Icons */}
                {iconMode === 'ICONS' && (
                  <input
                    type="text"
                    value={iconSearch}
                    onChange={e => setIconSearch(e.target.value)}
                    placeholder="Cerca icona (es. Car, Pizza, Home, Dog, Bank, Music)..."
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-slate-100"
                  />
                )}

                {iconMode === 'EMOJI' ? (
                  <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5 p-2 bg-slate-50 dark:bg-slate-850 rounded-2xl max-h-48 overflow-y-auto no-scrollbar border border-slate-200/80 dark:border-slate-750">
                    {AVAILABLE_EMOJIS.map(em => (
                      <button
                        type="button"
                        key={em}
                        onClick={() => setIconName(em)}
                        className={`h-10 text-xl flex items-center justify-center rounded-xl transition-transform active:scale-95 ${
                          iconName === em
                            ? 'bg-indigo-100 dark:bg-indigo-900/60 ring-2 ring-indigo-500'
                            : 'hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 p-2 bg-slate-50 dark:bg-slate-850 rounded-2xl max-h-48 overflow-y-auto no-scrollbar border border-slate-200/80 dark:border-slate-750">
                    {AVAILABLE_ICONS.filter(ic => !iconSearch.trim() || ic.toLowerCase().includes(iconSearch.toLowerCase().trim())).map(ic => (
                      <button
                        type="button"
                        key={ic}
                        onClick={() => setIconName(ic)}
                        className={`h-10 flex items-center justify-center rounded-xl transition-transform active:scale-95 ${
                          iconName === ic
                            ? 'bg-indigo-100 dark:bg-indigo-900/60 ring-2 ring-indigo-500 text-indigo-600'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                        title={ic}
                      >
                        <CategoryIcon name={ic} color={colore} background={false} size={18} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Check size={14} />
                  Salva Personalizzazione
                </button>
              </div>
            </form>
          ) : (
            /* Subcategories List */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setFilterTipo('ALL')}
                    className={`px-3 py-1 rounded-lg transition-all ${filterTipo === 'ALL' ? 'bg-white dark:bg-slate-700 shadow-xs text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}
                  >
                    Tutte
                  </button>
                  <button
                    onClick={() => setFilterTipo('USCITA')}
                    className={`px-3 py-1 rounded-lg transition-all ${filterTipo === 'USCITA' ? 'bg-white dark:bg-slate-700 shadow-xs text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}
                  >
                    Solo Spese
                  </button>
                  <button
                    onClick={() => setFilterTipo('ENTRATA')}
                    className={`px-3 py-1 rounded-lg transition-all ${filterTipo === 'ENTRATA' ? 'bg-white dark:bg-slate-700 shadow-xs text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}
                  >
                    Solo Entrate
                  </button>
                </div>

                <button
                  onClick={startNew}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow-xs"
                >
                  <Plus size={13} />
                  <span>Nuova Categoria</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto no-scrollbar">
                {filtered.map(sub => {
                  const nec = getSubcategoryNecessity(sub);
                  return (
                    <div
                      key={sub.id}
                      onClick={() => startEdit(sub)}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-750 flex items-center justify-between gap-2.5 cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <CategoryIcon name={sub.icon_name} color={sub.colore} tipo={sub.tipo} size={18} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block truncate">
                              {sub.nome}
                            </span>
                            {sub.tipo === 'USCITA' && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md shrink-0 ${
                                nec === 'DEVO' 
                                  ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20' 
                                  : nec === 'HO_BISOGNO'
                                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {nec === 'DEVO' ? 'Devo 50%' : nec === 'HO_BISOGNO' ? 'Ho bisogno 30%' : 'Voglio 20%'}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {sub.categoria_padre}
                          </span>
                        </div>
                      </div>
                      <span className="p-1.5 rounded-lg text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/60 transition-all shrink-0">
                        <Edit2 size={13} />
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
