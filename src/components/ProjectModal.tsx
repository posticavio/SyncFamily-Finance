import React, { useState, useEffect } from 'react';
import { X, FolderKanban, Building, Car, Landmark, Hammer, CreditCard, DollarSign, Calendar, AlertCircle, History, CheckCircle2, Calculator } from 'lucide-react';
import { Project, ProjectType, ProjectStatus, Subcategory, Account, Fund } from '../types';
import { ProjectService } from '../services/ProjectService';
import { haptics } from '../utils/haptics';
import { formatCurrency } from '../utils/formatters';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingProject?: Project | null;
  subcategories: Subcategory[];
  accounts: Account[];
  funds?: Fund[];
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  editingProject,
  subcategories,
  accounts,
  funds = []
}) => {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<ProjectType>('FINANZIAMENTO');
  const [sottocategoriaId, setSottocategoriaId] = useState('');
  const [budgetPrevisto, setBudgetPrevisto] = useState<number | ''>('');
  const [rataMensile, setRataMensile] = useState<number | ''>('');
  const [numeroRateTotali, setNumeroRateTotali] = useState<number | ''>('');
  const [tassoInteresse, setTassoInteresse] = useState<number | ''>('');
  const [contoAddebitoId, setContoAddebitoId] = useState('');
  const [giornoAddebitoRata, setGiornoAddebitoRata] = useState<number | ''>(10);
  const [stato, setStato] = useState<ProjectStatus>('ATTIVO');
  const [dataInizio, setDataInizio] = useState(new Date().toISOString().split('T')[0]);
  const [dataFine, setDataFine] = useState('');
  const [note, setNote] = useState('');
  const [importoGiaPagato, setImportoGiaPagato] = useState<number | ''>('');
  const [rateGiaPagate, setRateGiaPagate] = useState<number | ''>('');
  const [isGiaIniziato, setIsGiaIniziato] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inizializza o resetta i dati quando il modal si apre
  useEffect(() => {
    if (editingProject) {
      setNome(editingProject.nome_progetto);
      setTipo(editingProject.tipo || 'FINANZIAMENTO');
      setSottocategoriaId(editingProject.sottocategoria_id || '');
      setBudgetPrevisto(editingProject.budget_previsto || '');
      setRataMensile(editingProject.rata_mensile || '');
      setNumeroRateTotali(editingProject.numero_rate_totali || '');
      setTassoInteresse(editingProject.tasso_interesse || '');
      setContoAddebitoId(editingProject.conto_addebito_id || '');
      setGiornoAddebitoRata(editingProject.giorno_addebito_rata || '');
      setStato(editingProject.stato || 'ATTIVO');
      setDataInizio(editingProject.data_inizio || new Date().toISOString().split('T')[0]);
      setDataFine(editingProject.data_fine || '');
      setNote(editingProject.note || '');

      const hasGiaPagato = Boolean(
        (editingProject.importo_gia_pagato !== undefined && editingProject.importo_gia_pagato > 0) ||
        (editingProject.rate_gia_pagate !== undefined && editingProject.rate_gia_pagate > 0)
      );
      setIsGiaIniziato(hasGiaPagato);
      setImportoGiaPagato(editingProject.importo_gia_pagato ?? '');
      setRateGiaPagate(editingProject.rate_gia_pagate ?? '');
    } else {
      setNome('');
      setTipo('FINANZIAMENTO');
      // Pre-seleziona la prima sottocategoria utile per finanziamenti o casa se presente
      const defaultSub = subcategories.find(s => 
        s.nome.toLowerCase().includes('finanziamento') || 
        s.nome.toLowerCase().includes('mutuo') ||
        s.categoria_padre.toLowerCase().includes('prestiti') ||
        s.categoria_padre.toLowerCase().includes('casa')
      ) || subcategories[0];
      setSottocategoriaId(defaultSub ? defaultSub.id : '');
      setBudgetPrevisto('');
      setRataMensile('');
      setNumeroRateTotali('');
      setTassoInteresse('');
      setContoAddebitoId(accounts[0]?.id || '');
      setGiornoAddebitoRata(10);
      setStato('ATTIVO');
      setDataInizio(new Date().toISOString().split('T')[0]);
      setDataFine('');
      setNote('');
      setIsGiaIniziato(false);
      setImportoGiaPagato('');
      setRateGiaPagate('');
    }
    setError(null);
  }, [isOpen, editingProject, subcategories, accounts]);

  if (!isOpen) return null;

  const isPrestitoOrFinanziamento = tipo === 'FINANZIAMENTO' || tipo === 'MUTUO' || tipo === 'PRESTITO' || tipo === 'DEBITO';

  // Raggruppa sottocategorie per categoria padre
  const subcategoriesByParent: Record<string, Subcategory[]> = {};
  subcategories.forEach(sub => {
    const parent = sub.categoria_padre || 'Altro';
    if (!subcategoriesByParent[parent]) subcategoriesByParent[parent] = [];
    subcategoriesByParent[parent].push(sub);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setError('Inserisci il nome del progetto o finanziamento.');
      return;
    }
    if (!sottocategoriaId) {
      setError('Seleziona la sottocategoria determinata a cui è legato.');
      return;
    }
    if (budgetPrevisto === '' || Number(budgetPrevisto) <= 0) {
      setError('Inserisci un importo totale o budget valido maggiore di 0.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (editingProject) {
        await ProjectService.update(editingProject.id, {
          nome_progetto: nome.trim(),
          tipo,
          sottocategoria_id: sottocategoriaId,
          budget_previsto: Number(budgetPrevisto),
          importo_gia_pagato: isGiaIniziato && importoGiaPagato !== '' ? Number(importoGiaPagato) : (isGiaIniziato ? undefined : 0),
          rate_gia_pagate: isGiaIniziato && rateGiaPagate !== '' ? Number(rateGiaPagate) : (isGiaIniziato ? undefined : 0),
          rata_mensile: rataMensile !== '' ? Number(rataMensile) : undefined,
          numero_rate_totali: numeroRateTotali !== '' ? Number(numeroRateTotali) : undefined,
          tasso_interesse: tassoInteresse !== '' ? Number(tassoInteresse) : undefined,
          conto_addebito_id: contoAddebitoId || undefined,
          giorno_addebito_rata: giornoAddebitoRata !== '' ? Number(giornoAddebitoRata) : undefined,
          stato,
          data_inizio: dataInizio || undefined,
          data_fine: dataFine || undefined,
          note: note.trim()
        });
      } else {
        await ProjectService.create({
          nome_progetto: nome.trim(),
          tipo,
          sottocategoria_id: sottocategoriaId,
          budget_previsto: Number(budgetPrevisto),
          importo_gia_pagato: isGiaIniziato && importoGiaPagato !== '' ? Number(importoGiaPagato) : undefined,
          rate_gia_pagate: isGiaIniziato && rateGiaPagate !== '' ? Number(rateGiaPagate) : undefined,
          rata_mensile: rataMensile !== '' ? Number(rataMensile) : undefined,
          numero_rate_totali: numeroRateTotali !== '' ? Number(numeroRateTotali) : undefined,
          tasso_interesse: tassoInteresse !== '' ? Number(tassoInteresse) : undefined,
          conto_addebito_id: contoAddebitoId || undefined,
          giorno_addebito_rata: giornoAddebitoRata !== '' ? Number(giornoAddebitoRata) : undefined,
          stato,
          data_inizio: dataInizio || undefined,
          data_fine: dataFine || undefined,
          note: note.trim()
        });
      }

      haptics.success();
      onSaved();
      onClose();
    } catch (err: any) {
      console.error("Errore salvataggio progetto:", err);
      setError(err?.message || 'Si è verificato un errore durante il salvataggio.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div 
        id="project-modal-container"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-8"
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              {tipo === 'MUTUO' && <Building size={20} />}
              {tipo === 'FINANZIAMENTO' && <Car size={20} />}
              {tipo === 'PRESTITO' && <Landmark size={20} />}
              {tipo === 'DEBITO' && <CreditCard size={20} />}
              {tipo === 'PROGETTO' && <FolderKanban size={20} />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {editingProject ? 'Modifica Progetto / Prestito' : 'Nuovo Progetto o Finanziamento'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Monitora prestiti, mutui e impegni a lungo termine legati a una sottocategoria
              </p>
            </div>
          </div>
          <button
            id="btn-close-project-modal"
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Tipo di Progetto / Debito */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Tipologia *
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {(['FINANZIAMENTO', 'MUTUO', 'PRESTITO', 'PROGETTO', 'DEBITO'] as ProjectType[]).map(t => {
                const isSelected = tipo === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      setTipo(t);
                    }}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-medium border transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {t === 'FINANZIAMENTO' && 'Finanziam.'}
                    {t === 'MUTUO' && 'Mutuo'}
                    {t === 'PRESTITO' && 'Prestito'}
                    {t === 'PROGETTO' && 'Progetto'}
                    {t === 'DEBITO' && 'Debito'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nome Progetto */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nome Progetto / Finanziamento *
            </label>
            <input
              id="input-project-name"
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="es. Finanziamento Auto Toyota, Mutuo Prima Casa, Ristrutturazione Bagno..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Sottocategoria Determinata (Perno Logico) */}
          <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 p-3.5 rounded-xl">
            <label className="block text-xs font-semibold text-indigo-950 dark:text-indigo-200 mb-1">
              Sottocategoria Determinata Collegata *
            </label>
            <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mb-2">
              I movimenti registrati con questa sottocategoria vengono conteggiati automaticamente nei pagamenti di questo impegno.
            </p>
            <select
              id="select-project-subcategory"
              value={sottocategoriaId}
              onChange={e => setSottocategoriaId(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              required
            >
              <option value="">-- Seleziona la sottocategoria collegata --</option>
              {Object.entries(subcategoriesByParent).map(([parentName, subs]) => (
                <optgroup key={parentName} label={parentName}>
                  {subs.map(sub => (
                    <option key={sub.id} value={sub.id}>
                      {sub.nome} ({parentName})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Importo Totale / Capitale Finanziato e Rata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isPrestitoOrFinanziamento ? 'Importo Totale Finanziato (€) *' : 'Budget Complessivo Previsto (€) *'}
              </label>
              <input
                id="input-project-budget"
                type="number"
                step="0.01"
                min="0"
                value={budgetPrevisto}
                onChange={e => setBudgetPrevisto(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="es. 12000.00"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            {isPrestitoOrFinanziamento && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Rata Mensile (€)
                </label>
                <input
                  id="input-project-rata"
                  type="number"
                  step="0.01"
                  min="0"
                  value={rataMensile}
                  onChange={e => setRataMensile(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="es. 240.00"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>

          {/* Dettagli Ammortamento (per prestiti/mutui/finanziamenti) */}
          {isPrestitoOrFinanziamento && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  N° Rate Totali
                </label>
                <input
                  id="input-project-num-rate"
                  type="number"
                  min="1"
                  value={numeroRateTotali}
                  onChange={e => setNumeroRateTotali(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  placeholder="es. 48, 60, 240"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Tasso TAN / TAEG (%)
                </label>
                <input
                  id="input-project-tasso"
                  type="number"
                  step="0.01"
                  min="0"
                  value={tassoInteresse}
                  onChange={e => setTassoInteresse(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="es. 3.45"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Giorno Addebito Rata
                </label>
                <input
                  id="input-project-giorno-addebito"
                  type="number"
                  min="1"
                  max="31"
                  value={giornoAddebitoRata}
                  onChange={e => setGiornoAddebitoRata(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  placeholder="es. 10"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* SEZIONE FINANZIAMENTO GIÀ INIZIATO (PARTE GIÀ PAGATA PREGRESSA) */}
          <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 mt-0.5">
                  <History size={16} />
                </div>
                <div>
                  <label htmlFor="chk-project-gia-iniziato" className="text-xs font-bold text-slate-900 dark:text-white cursor-pointer select-none">
                    Finanziamento o prestito già iniziato? (Quota già pagata)
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Attiva se questo finanziamento era già in corso prima di iniziare ad usare quest'app e ci sono rate o importi già saldati in precedenza.
                  </p>
                </div>
              </div>
              <input
                id="chk-project-gia-iniziato"
                type="checkbox"
                checked={isGiaIniziato}
                onChange={e => {
                  const checked = e.target.checked;
                  setIsGiaIniziato(checked);
                  if (!checked) {
                    setImportoGiaPagato('');
                    setRateGiaPagate('');
                  }
                }}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 dark:border-slate-700 mt-1 cursor-pointer"
              />
            </div>

            {isGiaIniziato && (
              <div className="mt-3.5 pt-3.5 border-t border-amber-200/60 dark:border-amber-900/40 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Importo Già Pagato / Rimborsato (€)
                    </label>
                    <input
                      id="input-project-already-paid-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={importoGiaPagato}
                      onChange={e => {
                        const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                        setImportoGiaPagato(val);
                        if (val !== '' && rataMensile !== '' && Number(rataMensile) > 0 && rateGiaPagate === '') {
                          setRateGiaPagate(Math.round(Number(val) / Number(rataMensile)));
                        }
                      }}
                      placeholder="es. 1200.00"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      N° Rate Già Saldate in Precedenza
                    </label>
                    <input
                      id="input-project-already-paid-installments"
                      type="number"
                      min="0"
                      value={rateGiaPagate}
                      onChange={e => {
                        const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                        setRateGiaPagate(val);
                        if (val !== '' && rataMensile !== '' && Number(rataMensile) > 0 && (importoGiaPagato === '' || importoGiaPagato === 0)) {
                          setImportoGiaPagato(Math.round(Number(val) * Number(rataMensile) * 100) / 100);
                        }
                      }}
                      placeholder="es. 12"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Calcolatori Rapidi se c'è rata mensile */}
                {rataMensile !== '' && Number(rataMensile) > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">Calcolo rapido:</span>
                    {rateGiaPagate !== '' && Number(rateGiaPagate) > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setImportoGiaPagato(Math.round(Number(rateGiaPagate) * Number(rataMensile) * 100) / 100);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 font-medium hover:bg-amber-200 transition-colors"
                      >
                        Imposta importo = {rateGiaPagate} rate × € {Number(rataMensile).toFixed(2)} (€ {(Number(rateGiaPagate) * Number(rataMensile)).toFixed(2)})
                      </button>
                    )}
                    {importoGiaPagato !== '' && Number(importoGiaPagato) > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setRateGiaPagate(Math.round(Number(importoGiaPagato) / Number(rataMensile)));
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 font-medium hover:bg-amber-200 transition-colors"
                      >
                        Stima rate = ~ {Math.round(Number(importoGiaPagato) / Number(rataMensile))} rate
                      </button>
                    )}
                  </div>
                )}

                {/* Badge Riepilogo Residuo Iniziale */}
                {(Number(importoGiaPagato) > 0 || Number(rateGiaPagate) > 0) && (
                  <div className="p-2.5 rounded-xl bg-amber-100/70 dark:bg-amber-900/30 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Debito residuo iniziale nell'app: <strong className="tabular-nums font-numeric">{formatCurrency(Math.max(0, (Number(budgetPrevisto) || 0) - (Number(importoGiaPagato) || 0)))}</strong>
                    </span>
                    {numeroRateTotali !== '' && rateGiaPagate !== '' && (
                      <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                        Rate residue: {Math.max(0, Number(numeroRateTotali) - Number(rateGiaPagate))} su {numeroRateTotali}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Conto di Addebito e Stato */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Conto di Addebito Abituale
              </label>
              <select
                id="select-project-account"
                value={contoAddebitoId}
                onChange={e => setContoAddebitoId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Nessun conto predefinito --</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.nome_conto}
                  </option>
                ))}
                {funds.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.nome_fondo} (Fondo)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Stato
              </label>
              <select
                id="select-project-status"
                value={stato}
                onChange={e => setStato(e.target.value as ProjectStatus)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ATTIVO">Attivo / In corso</option>
                <option value="COMPLETATO">Completato / Estinto</option>
                <option value="IN_PAUSA">In Pausa / Sospeso</option>
                <option value="ANNULLATO">Annullato</option>
              </select>
            </div>
          </div>

          {/* Date Inizio e Fine Prevista */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Data Accensione / Inizio
              </label>
              <input
                id="input-project-data-inizio"
                type="date"
                value={dataInizio}
                onChange={e => setDataInizio(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Data Fine Prevista / Scadenza
              </label>
              <input
                id="input-project-data-fine"
                type="date"
                value={dataFine}
                onChange={e => setDataFine(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Note & Dettagli Aggiuntivi
            </label>
            <textarea
              id="textarea-project-notes"
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="es. Tasso fisso, polizza inclusa, detrazione fiscale 50%..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Buttons Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              id="btn-cancel-project"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Annulla
            </button>
            <button
              id="btn-save-project"
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Salvataggio...' : editingProject ? 'Salva Modifiche' : 'Crea Impegno'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
