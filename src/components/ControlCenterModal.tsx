import React from 'react';
import { ControlAlert } from '../types';
import { X, AlertTriangle, ShieldCheck, CheckCircle2, ArrowRight, FileSpreadsheet, Sparkles } from 'lucide-react';
import { PlannedService } from '../services/PlannedService';
import { DeadlineService } from '../services/DeadlineService';
import { AccountService } from '../services/AccountService';

interface ControlCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: ControlAlert[];
  onRefresh: () => void;
  onOpenReconciliation?: (accountId?: string) => void;
  onOpenBalanceCorrection?: (accountId?: string) => void;
}

export const ControlCenterModal: React.FC<ControlCenterModalProps> = ({
  isOpen,
  onClose,
  alerts,
  onRefresh,
  onOpenReconciliation,
  onOpenBalanceCorrection
}) => {
  if (!isOpen) return null;

  const handleExecutePlanned = async (plannedId: string) => {
    try {
      await PlannedService.execute(plannedId);
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePayDeadline = async (deadlineId: string) => {
    try {
      await DeadlineService.markAsPaid(deadlineId);
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAlignAccountBalance = async (accountId: string) => {
    try {
      const calculated = AccountService.calculateBalanceAtDate(accountId, new Date());
      await AccountService.updateRealBalance(accountId, calculated);
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        id="control-center-dialog"
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-100"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Centro di Controllo</h3>
              <p className="text-xs text-slate-400">Verifica coerenza e avvisi automatici</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-3 no-scrollbar">
          {alerts.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                <ShieldCheck size={28} />
              </div>
              <h4 className="text-sm font-semibold text-slate-800">Tutto perfettamente allineato!</h4>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Nessuna anomalia riscontrata: tutti i saldi coincidono, nessun conto in rosso e nessuna scadenza arretrata.
              </p>
            </div>
          ) : (
            alerts.map(alert => {
              const isHigh = alert.severita === 'HIGH';
              return (
                <div
                  key={alert.id}
                  className={`p-4 rounded-2xl border flex flex-col gap-2 transition-all ${
                    isHigh 
                      ? 'bg-rose-50/60 border-rose-200' 
                      : 'bg-amber-50/60 border-amber-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className={`text-[10px] font-bold uppercase tracking-wider block ${isHigh ? 'text-rose-700' : 'text-amber-700'}`}>
                        {alert.tipo.replace(/_/g, ' ')}
                      </span>
                      <h4 className="text-xs font-semibold text-slate-900 mt-0.5">
                        {alert.titolo}
                      </h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {alert.messaggio}
                      </p>
                    </div>
                  </div>

                  {/* Azioni rapide di risoluzione */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/50">
                    {alert.tipo === 'PIANIFICATO_SCADUTO' && alert.id_riferimento && (
                      <button
                        onClick={() => handleExecutePlanned(alert.id_riferimento!)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <CheckCircle2 size={13} />
                        <span>Esegui Movimento Ora</span>
                      </button>
                    )}

                    {alert.tipo === 'SCADENZA_SCADUTA' && alert.id_riferimento && (
                      <button
                        onClick={() => handlePayDeadline(alert.id_riferimento!)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <CheckCircle2 size={13} />
                        <span>Segna come Pagata</span>
                      </button>
                    )}

                    {alert.tipo === 'DIFFERENZA_SALDO' && alert.id_riferimento && (
                      <div className="flex items-center gap-2">
                        {onOpenBalanceCorrection && (
                          <button
                            onClick={() => {
                              onClose();
                              onOpenBalanceCorrection(alert.id_riferimento);
                            }}
                            className="px-3 py-1.5 bg-[#E31B23] hover:bg-[#c9151c] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                            title="Inserisci saldo reale e genera movimento di rettifica automatico"
                          >
                            <Sparkles size={13} />
                            <span>Correggi Saldo (Rettifica)</span>
                          </button>
                        )}
                        {onOpenReconciliation && (
                          <button
                            onClick={() => {
                              onClose();
                              onOpenReconciliation(alert.id_riferimento);
                            }}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-indigo-200"
                            title="Carica estratto conto bancario e riconcilia le transazioni mancanti"
                          >
                            <FileSpreadsheet size={13} />
                            <span>Riconcilia Estratto</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleAlignAccountBalance(alert.id_riferimento!)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <ArrowRight size={13} />
                          <span>Allinea Saldo Reale</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
