import React, { useState } from 'react';
import { Deadline, Subcategory } from '../types';
import { formatCurrency, formatDateIT } from '../utils/formatters';
import { CategoryIcon } from './CategoryIcon';
import { DeadlineService } from '../services/DeadlineService';
import { haptics } from '../utils/haptics';
import { 
  BellRing, 
  Calendar, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight, 
  Check, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

interface UpcomingDeadlinesIndicatorProps {
  deadlines?: Deadline[];
  subcategories?: Subcategory[];
  onNavigateToCalendar?: (dateStr?: string) => void;
  onRefresh?: () => void;
}

export const UpcomingDeadlinesIndicator: React.FC<UpcomingDeadlinesIndicatorProps> = ({
  deadlines = [],
  subcategories = [],
  onNavigateToCalendar,
  onRefresh
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Calcolo scadenze nei prossimi 3 giorni
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDaysDiff = (dateStr: string): number => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d);
    targetDate.setHours(0, 0, 0, 0);
    const diffMs = targetDate.getTime() - today.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  };

  // Filtra solo le scadenze non pagate che cadono nei prossimi 3 giorni (da oggi a +3 gg)
  // Includiamo anche eventuali scadenze scadute di recente per massima sicurezza se < 0
  const upcomingDeadlines = deadlines
    .filter(d => d.stato === 'DA_PAGARE')
    .map(d => ({
      ...d,
      daysUntil: getDaysDiff(d.data_scadenza)
    }))
    .filter(d => d.daysUntil >= 0 && d.daysUntil <= 3)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const overdueDeadlines = deadlines
    .filter(d => d.stato === 'DA_PAGARE')
    .map(d => ({
      ...d,
      daysUntil: getDaysDiff(d.data_scadenza)
    }))
    .filter(d => d.daysUntil < 0)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const totalUpcomingAmount = upcomingDeadlines.reduce((sum, d) => sum + d.importo_previsto, 0);

  const handleMarkAsPaid = async (scadenzaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setPayingId(scadenzaId);
      await DeadlineService.markAsPaid(scadenzaId);
      haptics.success();
      setToastMessage("Scadenza registrata come pagata!");
      setTimeout(() => setToastMessage(null), 3500);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Errore nel pagamento scadenza:", err);
      setToastMessage("Errore nella registrazione del pagamento");
      setTimeout(() => setToastMessage(null), 3500);
    } finally {
      setPayingId(null);
    }
  };

  // Se non ci sono scadenze nei prossimi 3 giorni
  if (upcomingDeadlines.length === 0) {
    return (
      <div 
        id="upcoming-deadlines-empty-indicator"
        className="bento-card p-3.5 bg-slate-50/70 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 text-xs transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={15} />
          </div>
          <div>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Nessuna scadenza nei prossimi 3 giorni
            </span>
            <span className="text-slate-400 dark:text-slate-500 text-[11px] block sm:inline sm:ml-1">
              • Tutti i pagamenti risultano regolari
            </span>
          </div>
        </div>

        {onNavigateToCalendar && (
          <button
            type="button"
            onClick={() => onNavigateToCalendar()}
            className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors flex items-center gap-1 active:scale-95"
          >
            <Calendar size={13} />
            <span>Calendario</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div 
      id="upcoming-deadlines-indicator-card"
      className="bento-card overflow-hidden border border-amber-200/90 dark:border-amber-800/80 bg-gradient-to-br from-amber-50/70 via-orange-50/30 to-amber-50/50 dark:from-amber-950/30 dark:via-slate-900/80 dark:to-slate-900 shadow-sm transition-all duration-200"
    >
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <Check size={14} />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header Indicator */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3.5 sm:p-4 cursor-pointer hover:bg-amber-100/30 dark:hover:bg-amber-900/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none"
      >
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-2xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <BellRing size={18} />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-amber-950 dark:text-amber-100 tracking-tight">
                Scadenze nei Prossimi 3 Giorni
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 dark:bg-amber-400/20 text-amber-800 dark:text-amber-300 border border-amber-300/50 dark:border-amber-700/60 font-numeric">
                {upcomingDeadlines.length} {upcomingDeadlines.length === 1 ? 'scadenza' : 'scadenze'}
              </span>
              {overdueDeadlines.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300/60 dark:border-rose-800/60 flex items-center gap-1">
                  <AlertCircle size={10} />
                  <span>{overdueDeadlines.length} arretrate</span>
                </span>
              )}
            </div>

            <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
              Totale da saldare a breve: <strong className="font-numeric font-bold text-amber-950 dark:text-amber-100">{formatCurrency(totalUpcomingAmount)}</strong>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {onNavigateToCalendar && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigateToCalendar(upcomingDeadlines[0]?.data_scadenza);
              }}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700/60 text-amber-900 dark:text-amber-200 text-xs font-semibold hover:bg-amber-50 dark:hover:bg-slate-750 transition-all flex items-center gap-1.5 shadow-2xs active:scale-95"
            >
              <Calendar size={13} className="text-amber-600 dark:text-amber-400" />
              <span className="hidden sm:inline">Vedi a Calendario</span>
              <ArrowRight size={12} />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-1.5 rounded-xl text-amber-800 dark:text-amber-300 hover:bg-amber-200/50 dark:hover:bg-amber-900/40 transition-colors"
            title={isExpanded ? "Comprimi dettagli" : "Espandi dettagli"}
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Expanded List of Upcoming Deadlines */}
      {isExpanded && (
        <div className="px-3.5 pb-3.5 pt-1 space-y-2 border-t border-amber-200/50 dark:border-amber-800/50 animate-in fade-in duration-150">
          {upcomingDeadlines.map((deadline) => {
            const sub = subcategories.find(s => s.id === deadline.sottocategoria_id);
            const isToday = deadline.daysUntil === 0;
            const isTomorrow = deadline.daysUntil === 1;

            return (
              <div
                key={deadline.id}
                className="p-3 rounded-2xl bg-white/80 dark:bg-slate-850/90 border border-amber-100 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs hover:shadow-xs group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Badge Giorni Mancanti */}
                  <div className={`px-2.5 py-1.5 rounded-xl text-center min-w-[70px] flex-shrink-0 flex flex-col items-center justify-center ${
                    isToday 
                      ? 'bg-rose-500 text-white shadow-xs font-bold' 
                      : isTomorrow 
                        ? 'bg-amber-500 text-white font-bold' 
                        : 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 font-semibold'
                  }`}>
                    <span className="text-[10px] uppercase tracking-wider leading-none">
                      {isToday ? 'Oggi' : isTomorrow ? 'Domani' : `Tra ${deadline.daysUntil} gg`}
                    </span>
                    <span className="text-[9px] opacity-85 mt-0.5 leading-none">
                      {formatDateIT(deadline.data_scadenza).slice(0, 5)}
                    </span>
                  </div>

                  {/* Icona Categoria */}
                  {sub && (
                    <div className="hidden xs:flex">
                      <CategoryIcon name={sub.icon_name} color={sub.colore} size={18} />
                    </div>
                  )}

                  {/* Descrizione & Dettagli */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate block">
                        {deadline.descrizione}
                      </span>
                      {deadline.priorita === 'ALTA' && (
                        <span className="px-1.5 py-0.2 rounded-md bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-[9px] font-bold">
                          ALTA
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate block">
                      {sub ? sub.nome : 'Spesa generica'} {deadline.note ? `• ${deadline.note}` : ''}
                    </span>
                  </div>
                </div>

                {/* Importo e Azione Rapida Paga */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/80">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-medium block leading-none">Importo</span>
                    <span className="font-numeric text-sm font-bold text-slate-900 dark:text-white">
                      {formatCurrency(deadline.importo_previsto)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {onNavigateToCalendar && (
                      <button
                        type="button"
                        onClick={() => onNavigateToCalendar(deadline.data_scadenza)}
                        className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors"
                        title="Vedi nel calendario"
                      >
                        <Calendar size={15} />
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={payingId === deadline.id}
                      onClick={(e) => handleMarkAsPaid(deadline.id, e)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-black dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                      title="Segna come pagata e crea movimento reale"
                    >
                      {payingId === deadline.id ? (
                        <Clock size={13} className="animate-spin" />
                      ) : (
                        <Check size={13} />
                      )}
                      <span>Paga Ora</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
