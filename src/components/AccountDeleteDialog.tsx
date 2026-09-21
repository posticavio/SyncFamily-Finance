import React, { useState, useMemo } from 'react';
import { AccountForecast, Account, Fund } from '../types';
import { AccountService } from '../services/AccountService';
import { haptics } from '../utils/haptics';
import { formatCurrency } from '../utils/formatters';
import {
  X,
  AlertTriangle,
  Trash2,
  Archive,
  ArrowRight,
  ShieldAlert,
  Info,
  CheckCircle2
} from 'lucide-react';

interface AccountDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entity: AccountForecast | Account | Fund | null;
  isFund: boolean;
  availableAccounts: { id: string; nome: string }[];
  onSuccess: () => void;
}

export const AccountDeleteDialog: React.FC<AccountDeleteDialogProps> = ({
  isOpen,
  onClose,
  entity,
  isFund,
  availableAccounts,
  onSuccess
}) => {
  const entityId = entity ? ((entity as any).id || (entity as any).conto_id || '') : '';
  const entityName = entity ? ((entity as any).nome_conto || (entity as any).nome_fondo || 'Conto') : 'Conto';
  const humanId = entity ? ((entity as any).human_id || (entity as any).conto_id || (entity as any).fondo_id || '') : '';

  // Calcola statistiche di utilizzo per questo conto
  const stats = useMemo(() => {
    if (!entityId) return { movementsCount: 0, plannedCount: 0, deadlinesCount: 0, totalLinked: 0 };
    return AccountService.getAccountUsage(entityId);
  }, [entityId]);

  // Altri conti disponibili escluso quello in eliminazione
  const otherAccounts = useMemo(() => {
    if (!entityId) return availableAccounts;
    return availableAccounts.filter(a => a.id !== entityId);
  }, [availableAccounts, entityId]);

  const isOnlyAccount = !isFund && otherAccounts.length === 0;

  const [deleteMode, setDeleteMode] = useState<'ARCHIVE' | 'REASSIGN' | 'PERMANENT'>(
    stats.totalLinked > 0 ? 'REASSIGN' : 'PERMANENT'
  );
  const [reassignTargetId, setReassignTargetId] = useState<string>(
    otherAccounts.length > 0 ? otherAccounts[0].id : ''
  );
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleExecute = async () => {
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      if (deleteMode === 'ARCHIVE') {
        if (isFund) {
          await AccountService.toggleFundActive(entityId);
        } else {
          await AccountService.toggleAccountActive(entityId);
        }
        haptics.success();
        onSuccess();
        onClose();
        return;
      }

      if (deleteMode === 'REASSIGN') {
        if (!reassignTargetId) {
          setErrorMessage('Seleziona un conto di destinazione per i movimenti');
          haptics.error();
          setIsDeleting(false);
          return;
        }

        if (isFund) {
          await AccountService.deleteFund(entityId, { reassignToAccountId: reassignTargetId });
        } else {
          await AccountService.deleteAccount(entityId, { reassignToAccountId: reassignTargetId });
        }
        haptics.success();
        onSuccess();
        onClose();
        return;
      }

      if (deleteMode === 'PERMANENT') {
        if (stats.totalLinked > 0 && !confirmCheckbox) {
          setErrorMessage('Conferma la rimozione definitiva spuntando la casella di sicurezza');
          haptics.error();
          setIsDeleting(false);
          return;
        }

        if (isFund) {
          await AccountService.deleteFund(entityId, { deleteLinkedMovements: true });
        } else {
          await AccountService.deleteAccount(entityId, { deleteLinkedMovements: true });
        }
        haptics.error(); // Haptic pattern for permanent deletion
        onSuccess();
        onClose();
        return;
      }
    } catch (err: any) {
      console.error("Errore durante l'eliminazione:", err);
      setErrorMessage(err.message || 'Si è verificato un errore');
      haptics.error();
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !entity) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        id="account-delete-dialog"
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-rose-100"
      >
        {/* Header di Avvertimento */}
        <div className="px-6 py-4 bg-rose-50/70 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
              <Trash2 size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-rose-950">
                Elimina {isFund ? 'Fondo' : 'Conto'}
              </h3>
              <p className="text-xs text-rose-600 font-medium">
                {entityName} {humanId && `(${humanId})`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Caso speciale: unico conto nel sistema */}
          {isOnlyAccount ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-amber-800 font-semibold text-xs">
                <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                <span>Impossibile eliminare l'unico conto</span>
              </div>
              <p className="text-xs text-amber-700 leading-relaxed">
                Il sistema richiede la presenza di almeno un conto bancario per registrare le spese, le entrate e calcolare i saldi.
                Se desideri sostituirlo, crea prima un nuovo conto e poi procedi con l'eliminazione.
              </p>
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-xl hover:bg-amber-700 transition-colors"
                >
                  Ho Capito
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Statistiche Utilizzo / Movimenti collegati */}
              {stats.totalLinked > 0 ? (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                    <span className="flex items-center gap-1.5">
                      <Info size={14} className="text-indigo-600" />
                      Elementi collegati a questo conto:
                    </span>
                    <span className="font-numeric font-bold text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                      {stats.totalLinked} in totale
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                    <div className="bg-white p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">Movimenti reali</span>
                      <span className="font-semibold text-slate-800 font-numeric">{stats.movementsCount}</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">Pianificati & Scadenze</span>
                      <span className="font-semibold text-slate-800 font-numeric">
                        {stats.plannedCount + stats.deadlinesCount}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Nessun movimento o spesa pianificata è collegata a questo conto. L'eliminazione è sicura.</span>
                </div>
              )}

              {/* Scelta Modalità di Eliminazione */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Cosa desideri fare?
                </label>

                {/* Opzione 1: Riassegna e poi Elimina (Se ci sono movimenti e altri conti) */}
                {otherAccounts.length > 0 && stats.totalLinked > 0 && (
                  <div
                    onClick={() => {
                      haptics.tap();
                      setDeleteMode('REASSIGN');
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 ${
                      deleteMode === 'REASSIGN'
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-500'
                        : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                          <ArrowRight size={14} />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-900">Riassegna movimenti ed elimina</div>
                          <div className="text-[10px] text-slate-500">Trasferisci lo storico su un altro conto attivo</div>
                        </div>
                      </div>
                      <input
                        type="radio"
                        checked={deleteMode === 'REASSIGN'}
                        onChange={() => setDeleteMode('REASSIGN')}
                        className="text-indigo-600"
                      />
                    </div>

                    {deleteMode === 'REASSIGN' && (
                      <div className="pt-1.5 border-t border-indigo-100">
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Sposta movimenti su:
                        </label>
                        <select
                          value={reassignTargetId}
                          onChange={e => setReassignTargetId(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-indigo-300 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                        >
                          {otherAccounts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                              {acc.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* Opzione 2: Archivia (Consigliato per mantenere storico) */}
                <div
                  onClick={() => {
                    haptics.tap();
                    setDeleteMode('ARCHIVE');
                  }}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    deleteMode === 'ARCHIVE'
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-500'
                      : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                      <Archive size={14} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900">Archivia invece di eliminare</div>
                      <div className="text-[10px] text-slate-500">Nascondi dalle nuove spese preservando i dati</div>
                    </div>
                  </div>
                  <input
                    type="radio"
                    checked={deleteMode === 'ARCHIVE'}
                    onChange={() => setDeleteMode('ARCHIVE')}
                    className="text-emerald-600"
                  />
                </div>

                {/* Opzione 3: Eliminazione Definitiva */}
                <div
                  onClick={() => {
                    haptics.tap();
                    setDeleteMode('PERMANENT');
                  }}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 ${
                    deleteMode === 'PERMANENT'
                      ? 'border-rose-600 bg-rose-50/50 shadow-xs ring-1 ring-rose-500'
                      : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center">
                        <Trash2 size={14} />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-900">Elimina definitivamente</div>
                        <div className="text-[10px] text-slate-500">
                          {stats.totalLinked > 0
                            ? `Cancella il conto e i relativi ${stats.totalLinked} elementi`
                            : 'Cancella definitivamente il conto dal sistema'}
                        </div>
                      </div>
                    </div>
                    <input
                      type="radio"
                      checked={deleteMode === 'PERMANENT'}
                      onChange={() => setDeleteMode('PERMANENT')}
                      className="text-rose-600"
                    />
                  </div>

                  {deleteMode === 'PERMANENT' && stats.totalLinked > 0 && (
                    <div className="pt-2 border-t border-rose-100">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={confirmCheckbox}
                          onChange={e => setConfirmCheckbox(e.target.checked)}
                          className="mt-0.5 text-rose-600 rounded"
                        />
                        <span className="text-[11px] text-rose-800 font-medium">
                          Confermo di voler cancellare questo conto e tutti i {stats.totalLinked} movimenti associati. Questa operazione è irreversibile.
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Pulsanti di Azione */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  disabled={isDeleting || (deleteMode === 'PERMANENT' && stats.totalLinked > 0 && !confirmCheckbox)}
                  onClick={handleExecute}
                  className={`px-5 py-2 text-white text-xs font-semibold rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95 ${
                    deleteMode === 'ARCHIVE'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                      : deleteMode === 'REASSIGN'
                        ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                        : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                  }`}
                >
                  {isDeleting ? (
                    <span>Elaborazione...</span>
                  ) : deleteMode === 'ARCHIVE' ? (
                    <>
                      <Archive size={14} />
                      <span>Archivia Conto</span>
                    </>
                  ) : deleteMode === 'REASSIGN' ? (
                    <>
                      <ArrowRight size={14} />
                      <span>Riassegna ed Elimina</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      <span>Elimina Definitivamente</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
