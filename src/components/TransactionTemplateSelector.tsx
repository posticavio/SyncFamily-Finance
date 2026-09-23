import React, { useState, useMemo } from 'react';
import { 
  Bookmark, 
  ChevronDown, 
  Search, 
  Sparkles, 
  Check, 
  X, 
  Repeat, 
  Plus, 
  Trash2,
  Calendar,
  Layers
} from 'lucide-react';
import { TransactionTemplate, Subcategory, Account, Fund } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { formatCurrency } from '../utils/formatters';
import { haptics } from '../utils/haptics';
import { TemplateService } from '../services/TemplateService';

interface TransactionTemplateSelectorProps {
  templates: TransactionTemplate[];
  selectedTemplateId: string | null;
  onSelectTemplate: (template: TransactionTemplate) => void;
  onClearTemplate: () => void;
  subcategories: Subcategory[];
  accounts: Account[];
  funds: Fund[];
}

export const TransactionTemplateSelector: React.FC<TransactionTemplateSelectorProps> = ({
  templates,
  selectedTemplateId,
  onSelectTemplate,
  onClearTemplate,
  subcategories,
  accounts,
  funds
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState<'ALL' | 'MENSILE' | 'SETTIMANALE' | 'RICORRENTE'>('ALL');
  const [showCreateCustom, setShowCreateCustom] = useState(false);

  // Form per nuovo modello personalizzato
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [customTipo, setCustomTipo] = useState<'USCITA' | 'ENTRATA' | 'GIROCONTO'>('USCITA');
  const [customSubId, setCustomSubId] = useState('');
  const [customAccId, setCustomAccId] = useState('');
  const [customFreq, setCustomFreq] = useState<'MENSILE' | 'SETTIMANALE' | 'RICORRENTE'>('MENSILE');

  const selectedTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplateId) || null;
  }, [templates, selectedTemplateId]);

  // Filtro modelli
  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchesSearch = 
        t.nome.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        t.descrizione.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (t.note && t.note.toLowerCase().includes(searchQuery.toLowerCase().trim()));

      if (!matchesSearch) return false;

      if (frequencyFilter === 'ALL') return true;
      return t.frequenza_suggerita === frequencyFilter;
    });
  }, [templates, searchQuery, frequencyFilter]);

  const handleApply = (tpl: TransactionTemplate) => {
    haptics.tap();
    onSelectTemplate(tpl);
    setIsExpanded(false);
  };

  const handleDeleteCustom = async (e: React.MouseEvent, tplId: string) => {
    e.stopPropagation();
    haptics.medium();
    if (confirm("Vuoi eliminare questo modello di transazione?")) {
      await TemplateService.delete(tplId);
      if (selectedTemplateId === tplId) {
        onClearTemplate();
      }
    }
  };

  const handleCreateCustomTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const amt = parseFloat(customAmount.replace(',', '.'));
    const chosenSub = subcategories.find(s => s.id === customSubId);

    const created = await TemplateService.create({
      nome: customName.trim(),
      descrizione: customDesc.trim() || customName.trim(),
      importo: isNaN(amt) ? undefined : amt,
      tipologia: customTipo,
      sottocategoria_id: customSubId || subcategories[0]?.id,
      conto_origine: customAccId || accounts[0]?.id,
      natura: customTipo === 'ENTRATA' ? 'FISSA' : (customFreq === 'MENSILE' ? 'FISSA' : 'VARIABILE'),
      necessita: 'DEVO',
      icon: chosenSub?.icon_name || 'Bookmark',
      colore: chosenSub?.colore || '#4f46e5',
      frequenza_suggerita: customFreq,
      is_predefined: false
    });

    handleApply(created);
    setShowCreateCustom(false);
    setCustomName('');
    setCustomDesc('');
    setCustomAmount('');
  };

  return (
    <div id="transaction-template-selector" className="space-y-2">
      {/* Intestazione e Toggle Selettore */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Bookmark size={14} className="text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Modelli Spese Ricorrenti
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold">
            {templates.length}
          </span>
        </div>

        <button
          type="button"
          id="btn-toggle-all-templates"
          onClick={() => {
            haptics.tap();
            setIsExpanded(!isExpanded);
          }}
          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 px-2.5 py-1 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
        >
          <span>{isExpanded ? 'Chiudi' : 'Sfoglia Tutti'}</span>
          <ChevronDown 
            size={13} 
            className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
          />
        </button>
      </div>

      {/* Banner se Modello Applicato */}
      {selectedTemplate && !isExpanded && (
        <div className="flex items-center justify-between px-3 py-2 bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-2xl text-xs text-indigo-950 dark:text-indigo-200 shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5 min-w-0">
            <CategoryIcon 
              name={selectedTemplate.icon || 'Tag'} 
              color={selectedTemplate.colore || '#4f46e5'} 
              size={14} 
              background={true}
            />
            <div className="truncate">
              <span className="font-bold text-slate-900 dark:text-white block truncate">
                {selectedTemplate.nome}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span>Campi precompilati</span>
                {selectedTemplate.importo !== undefined && selectedTemplate.importo > 0 && (
                  <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-300">
                    {formatCurrency(selectedTemplate.importo)}
                  </span>
                )}
                {selectedTemplate.frequenza_suggerita && (
                  <span className="uppercase text-[9px] font-bold px-1 rounded bg-indigo-100 dark:bg-indigo-900/60">
                    {selectedTemplate.frequenza_suggerita}
                  </span>
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                onClearTemplate();
              }}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Quick horizontal strip con i modelli più frequenti (se non espanso) */}
      {!isExpanded && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-0.5">
          {templates.slice(0, 8).map((tpl) => {
            const isSelected = selectedTemplateId === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleApply(tpl)}
                className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-2 flex-shrink-0 border transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700/80 hover:bg-white dark:hover:bg-slate-750 hover:border-indigo-300 dark:hover:border-indigo-600'
                }`}
              >
                <CategoryIcon 
                  name={tpl.icon || 'Tag'} 
                  color={isSelected ? '#ffffff' : (tpl.colore || '#4f46e5')} 
                  size={13} 
                  background={false} 
                />
                <span className="font-semibold">{tpl.nome}</span>
                {tpl.importo !== undefined && tpl.importo > 0 && (
                  <span className={`text-[10px] font-numeric tabular-nums ${isSelected ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-400'}`}>
                    {formatCurrency(tpl.importo)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Sezione Espansa: Ricerca, Filtri di Frequenza e Griglia Completa Modelli */}
      {isExpanded && (
        <div className="p-3.5 bg-slate-50 dark:bg-slate-850 border border-slate-200/90 dark:border-slate-800 rounded-2xl space-y-3 animate-in fade-in duration-200 shadow-sm">
          
          {/* Barra di ricerca e pulsante aggiungi */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca modello (es. Mutuo, Spesa, Luce, Benzina)..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowCreateCustom(!showCreateCustom)}
              className="px-2.5 py-1.5 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/80 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors flex items-center gap-1 flex-shrink-0 active:scale-95"
            >
              <Plus size={13} />
              <span>Nuovo Modello</span>
            </button>
          </div>

          {/* Filtri Frequenza */}
          <div className="flex gap-1 overflow-x-auto pb-0.5 no-scrollbar text-[11px] font-semibold">
            {[
              { id: 'ALL', label: 'Tutti' },
              { id: 'MENSILE', label: 'Mensili' },
              { id: 'SETTIMANALE', label: 'Settimanali' },
              { id: 'RICORRENTE', label: 'Periodici / Ricorrenti' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFrequencyFilter(tab.id as any)}
                className={`px-2.5 py-1 rounded-lg transition-all flex-shrink-0 ${
                  frequencyFilter === tab.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-750'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Form Rapido Creazione Nuovo Modello Personalizzato */}
          {showCreateCustom && (
            <form 
              onSubmit={handleCreateCustomTemplate}
              className="p-3 bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/60 rounded-xl space-y-2.5 animate-in fade-in duration-150"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1">
                  <Sparkles size={13} className="text-amber-500" />
                  Crea Modello Spesa Personalizzato
                </span>
                <button
                  type="button"
                  onClick={() => setShowCreateCustom(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Nome Modello *</label>
                  <input
                    type="text"
                    required
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="E.g. Bolletta Acqua, Assicurazione..."
                    className="w-full px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Importo Fisso (€)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="Opzionale (es. 45,00)"
                    className="w-full px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Sottocategoria</label>
                  <select
                    value={customSubId}
                    onChange={(e) => setCustomSubId(e.target.value)}
                    className="w-full px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 outline-none"
                  >
                    {subcategories.map(s => (
                      <option key={s.id} value={s.id}>{s.nome} ({s.categoria_padre})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Frequenza Tipica</label>
                  <select
                    value={customFreq}
                    onChange={(e) => setCustomFreq(e.target.value as any)}
                    className="w-full px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 outline-none"
                  >
                    <option value="MENSILE">Mensile</option>
                    <option value="SETTIMANALE">Settimanale</option>
                    <option value="RICORRENTE">Periodico / Ricorrente</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs active:scale-95 flex items-center justify-center gap-1"
              >
                <Check size={13} />
                <span>Salva e Applica Modello</span>
              </button>
            </form>
          )}

          {/* Griglia Card Modelli */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1 no-scrollbar">
            {filteredTemplates.map((tpl) => {
              const sub = subcategories.find(s => s.id === tpl.sottocategoria_id);
              const isSelected = selectedTemplateId === tpl.id;

              return (
                <div
                  key={tpl.id}
                  onClick={() => handleApply(tpl)}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all active:scale-[0.98] flex items-center justify-between gap-2.5 ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 dark:border-indigo-600 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CategoryIcon 
                      name={tpl.icon || sub?.icon_name || 'Tag'} 
                      color={tpl.colore || sub?.colore || '#4f46e5'} 
                      size={15} 
                      background={true} 
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {tpl.nome}
                        </span>
                        {tpl.tipologia === 'ENTRATA' && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                            +Entrata
                          </span>
                        )}
                        {tpl.tipologia === 'GIROCONTO' && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold">
                            Giroconto
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-400 truncate">
                        {sub?.nome || tpl.descrizione}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 flex items-center gap-2">
                    <div>
                      {tpl.importo !== undefined && tpl.importo > 0 ? (
                        <span className="text-xs font-numeric font-bold text-slate-800 dark:text-slate-100 block tabular-nums">
                          {formatCurrency(tpl.importo)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic block">
                          Var.
                        </span>
                      )}
                      {tpl.frequenza_suggerita && (
                        <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-400 uppercase block">
                          {tpl.frequenza_suggerita}
                        </span>
                      )}
                    </div>

                    {!tpl.is_predefined && (
                      <button
                        type="button"
                        title="Elimina modello personalizzato"
                        onClick={(e) => handleDeleteCustom(e, tpl.id)}
                        className="p-1 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredTemplates.length === 0 && (
              <div className="col-span-2 py-6 text-center text-xs text-slate-400">
                Nessun modello trovato per "{searchQuery}".
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
