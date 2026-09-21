import React, { useState, useEffect } from 'react';
import { Movement, Planned, Deadline, Subcategory } from '../types';
import { formatCurrency, formatDateIT, getAmountDisplay, formatItalianNumber } from '../utils/formatters';
import { CategoryIcon } from './CategoryIcon';
import { TabHeaderInfo } from './TabHeaderInfo';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, ArrowRight, ArrowLeftRight } from 'lucide-react';

interface CalendarViewProps {
  movements: Movement[];
  planned: Planned[];
  deadlines: Deadline[];
  subcategories: Subcategory[];
  onSelectMovement: (mov: Movement) => void;
  onAddOnDate: (dateStr: string) => void;
  selectedDate?: string;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  movements,
  planned,
  deadlines,
  subcategories,
  onSelectMovement,
  onAddOnDate,
  selectedDate
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayStr, setSelectedDayStr] = useState<string>(
    selectedDate || new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    if (selectedDate) {
      setSelectedDayStr(selectedDate);
      const [y, m] = selectedDate.split('-').map(Number);
      if (y && m) {
        setCurrentDate(new Date(y, m - 1, 1));
      }
    }
  }, [selectedDate]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // Header month title
  const monthTitle = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(currentDate);
  const capitalizedTitle = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);

  // Month navigation
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDayStr(today.toISOString().split('T')[0]);
  };

  // Build days matrix
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Lunedì = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  // Previous month padding
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const prevMonthIdx = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const dateStr = `${prevYear}-${(prevMonthIdx + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    days.push({ dateStr, dayNum: d, isCurrentMonth: false });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    days.push({ dateStr, dayNum: d, isCurrentMonth: true });
  }

  // Next month padding (to fill 35 or 42 grid cells)
  const remaining = (7 - (days.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const nextMonthIdx = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const dateStr = `${nextYear}-${(nextMonthIdx + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    days.push({ dateStr, dayNum: d, isCurrentMonth: false });
  }

  const todayStr = new Date().toISOString().split('T')[0];

  // Selected Day Items
  const dayMovements = movements.filter(m => m.data === selectedDayStr);
  const dayPlanned = planned.filter(p => p.data_prevista === selectedDayStr && p.stato === 'PENDENTE');
  const dayDeadlines = deadlines.filter(d => d.data_scadenza === selectedDayStr);

  // Suddivisione rigorosa per gerarchia:
  // 1. Entrate / Guadagni
  const dayEntrate = dayMovements.filter(m => m.tipologia === 'ENTRATA');
  // 2. Uscite / Spese
  const dayUscite = dayMovements.filter(m => m.tipologia === 'USCITA');
  // 3. Trasferimenti / Giroconti
  const dayGiroconti = dayMovements.filter(m => m.tipologia === 'GIROCONTO');

  const dayTotalUscite = dayUscite.reduce((sum, m) => sum + m.importo, 0);
  const dayTotalEntrate = dayEntrate.reduce((sum, m) => sum + m.importo, 0);

  return (
    <div id="calendar-view-container" className="space-y-4">
      {/* 4. SEZIONE TITOLO PAGINA & AZIONI CONTESTUALI */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
            <CalendarIcon size={22} />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {capitalizedTitle} <span className="hidden md:inline text-base font-mono font-normal text-slate-400 dark:text-slate-500">(C)</span>
            </h1>
            <TabHeaderInfo text="Visualizzazione temporale di entrate, spese, movimenti pianificati e scadenze" />
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={goToday}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 transition shadow-xs active:scale-95"
          >
            Oggi
          </button>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all"
              title="Mese precedente"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all"
              title="Mese successivo"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout: Grid on Left, Selected Day Inspector on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Grid */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-400 mb-2">
            <div>Lun</div>
            <div>Mar</div>
            <div>Mer</div>
            <div>Gio</div>
            <div>Ven</div>
            <div className="text-indigo-500">Sab</div>
            <div className="text-indigo-500">Dom</div>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {days.map(day => {
              const dayMovs = movements.filter(m => m.data === day.dateStr);
              const dayPlans = planned.filter(p => p.data_prevista === day.dateStr && p.stato === 'PENDENTE');
              const dayDeads = deadlines.filter(d => d.data_scadenza === day.dateStr);

              const hasEntrate = dayMovs.some(m => m.tipologia === 'ENTRATA');
              const hasUscite = dayMovs.some(m => m.tipologia === 'USCITA');
              const hasPlanned = dayPlans.length > 0;
              const hasDeadlines = dayDeads.length > 0;

              const isSelected = day.dateStr === selectedDayStr;
              const isToday = day.dateStr === todayStr;

              const expensesSum = dayMovs
                .filter(m => m.tipologia === 'USCITA')
                .reduce((s, m) => s + m.importo, 0);

              const incomeSum = dayMovs
                .filter(m => m.tipologia === 'ENTRATA')
                .reduce((s, m) => s + m.importo, 0);

              return (
                <button
                  key={day.dateStr}
                  onClick={() => {
                    setSelectedDayStr(day.dateStr);
                  }}
                  className={`min-h-[64px] sm:min-h-[76px] p-1.5 rounded-2xl flex flex-col justify-between text-left transition-all border group relative active:scale-95 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                      : (isToday ? 'border-indigo-400/60 dark:border-indigo-500/60 bg-white dark:bg-slate-900' : 'border-transparent hover:bg-slate-100/70 dark:hover:bg-slate-800/60')
                  } ${!day.isCurrentMonth ? 'opacity-35' : ''}`}
                  title={`Visualizza dettagli per il ${formatDateIT(day.dateStr)}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-indigo-600 text-white' : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {day.dayNum}
                    </span>

                    {/* Indicator Dots con i 4 colori da specifiche */}
                    <div className="flex items-center gap-1">
                      <div className="flex items-center gap-0.5">
                        {/* Verde: Entrate realizzate */}
                        {hasEntrate && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Entrate" />}
                        {/* Rosso: Spese effettuate */}
                        {hasUscite && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" title="Spese" />}
                        {/* Viola: Transazioni pianificate */}
                        {hasPlanned && <span className="w-1.5 h-1.5 rounded-full bg-purple-600" title="Pianificate" />}
                        {/* Nero: Scadenze imminenti */}
                        {hasDeadlines && <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 dark:bg-neutral-100" title="Scadenze" />}
                      </div>

                      {/* Micro Plus Icon */}
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDayStr(day.dateStr);
                          onAddOnDate(day.dateStr);
                        }}
                        className="w-4 h-4 rounded flex items-center justify-center text-slate-300 dark:text-slate-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:bg-indigo-100/80 dark:group-hover:bg-indigo-950/80 transition-all"
                        title="Nuovo movimento in questa data"
                      >
                        <Plus size={11} />
                      </span>
                    </div>
                  </div>

                  {/* Daily indicator sum */}
                  {expensesSum > 0 ? (
                    <span className="font-numeric text-[11px] font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap self-end tabular-nums">
                      -{formatItalianNumber(Math.round(expensesSum), { maximumFractionDigits: 0 })} €
                    </span>
                  ) : incomeSum > 0 ? (
                    <span className="font-numeric text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap self-end tabular-nums">
                      +{formatItalianNumber(Math.round(incomeSum), { maximumFractionDigits: 0 })} €
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity self-end">
                      Dettaglio
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legenda Colori Stato Calendario (Requisito 4) */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 text-[11px] text-slate-500 dark:text-slate-400 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Verde: Entrate e guadagni</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Rosso: Spese effettuate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
              <span>Viola: Pianificate / Programmate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-neutral-900 dark:bg-neutral-100" />
              <span>Nero: Scadenze imminenti</span>
            </div>
          </div>
        </div>

        {/* Selected Day Details Panel (Ordinamento e Raggruppamento Giornaliero) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Dettaglio Giornaliero
                </h3>
                {/* Formato rigoroso GG/MM/AA */}
                <span className="text-xs text-slate-400 font-numeric">
                  {formatDateIT(selectedDayStr)}
                </span>
              </div>
              <button
                onClick={() => onAddOnDate(selectedDayStr)}
                className="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold flex items-center gap-1 transition-colors active:scale-95"
              >
                <Plus size={14} />
                <span>Aggiungi</span>
              </button>
            </div>

            {/* Daily Totals */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block">Entrate Realizzate</span>
                <span className="font-numeric font-semibold text-emerald-600 dark:text-emerald-400 text-sm tabular-nums">
                  {formatCurrency(dayTotalEntrate, { showSign: true })}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block">Spese Effettuate</span>
                <span className="font-numeric font-semibold text-rose-600 dark:text-rose-400 text-sm tabular-nums">
                  {formatCurrency(-dayTotalUscite, { showSign: true })}
                </span>
              </div>
            </div>

            {/* List of items in this day - Raggruppati rigorosamente per gerarchia */}
            <div className="space-y-3.5 max-h-[380px] overflow-y-auto no-scrollbar">
              
              {/* 1. SEZIONE ENTRATE / GUADAGNI */}
              {dayEntrate.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>1. Entrate / Guadagni ({dayEntrate.length})</span>
                  </div>
                  {dayEntrate.map(m => {
                    const sub = subcategories.find(s => s.id === m.sottocategoria_id);
                    const amt = getAmountDisplay(m.importo, 'ENTRATA');
                    return (
                      <div
                        key={m.id}
                        onClick={() => onSelectMovement(m)}
                        className="p-2.5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 hover:border-emerald-300 cursor-pointer flex items-center justify-between gap-2 transition-all shadow-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Icona verde da specifiche */}
                          <CategoryIcon name={sub?.icon_name} color="#10B981" tipo="ENTRATA" size={15} />
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate block">
                              {m.descrizione}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate block">
                              {sub?.nome || 'Entrata'}
                            </span>
                          </div>
                        </div>
                        <span className={`font-numeric text-xs font-semibold whitespace-nowrap ${amt.colorClass}`}>
                          {amt.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 2. SEZIONE USCITE / SPESE */}
              {dayUscite.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <span>2. Uscite / Spese ({dayUscite.length})</span>
                  </div>
                  {dayUscite.map(m => {
                    const sub = subcategories.find(s => s.id === m.sottocategoria_id);
                    const amt = getAmountDisplay(m.importo, 'USCITA');
                    return (
                      <div
                        key={m.id}
                        onClick={() => onSelectMovement(m)}
                        className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-rose-200 dark:hover:border-rose-900 cursor-pointer flex items-center justify-between gap-2 transition-all shadow-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Icona rossa da specifiche */}
                          <CategoryIcon name={sub?.icon_name} color="#E31B23" tipo="USCITA" size={15} />
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate block">
                              {m.descrizione}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate block">
                              {sub?.nome || 'Spesa'}
                            </span>
                          </div>
                        </div>
                        <span className={`font-numeric text-xs font-semibold whitespace-nowrap ${amt.colorClass}`}>
                          {amt.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 3. SEZIONE TRASFERIMENTI / GIROCONTI */}
              {dayGiroconti.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                    <span>3. Trasferimenti / Giroconti ({dayGiroconti.length})</span>
                  </div>
                  {dayGiroconti.map(m => {
                    const amt = getAmountDisplay(m.importo, 'GIROCONTO');
                    return (
                      <div
                        key={m.id}
                        onClick={() => onSelectMovement(m)}
                        className="p-2.5 rounded-xl bg-slate-50/60 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 hover:border-slate-400 cursor-pointer flex items-center justify-between gap-2 transition-all shadow-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Icona unificata giroconto e grigio scuro */}
                          <CategoryIcon name="ArrowLeftRight" tipo="GIROCONTO" isGiroconto={true} size={15} />
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate block">
                              {m.descrizione}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate block">
                              Giroconto tra conti
                            </span>
                          </div>
                        </div>
                        <span className={`font-numeric text-xs font-semibold whitespace-nowrap ${amt.colorClass}`}>
                          {amt.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 4. TRANSAZIONI PIANIFICATE / PROGRAMMATE (VIOLA) */}
              {dayPlanned.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                    <span>Pianificate / Programmate ({dayPlanned.length})</span>
                  </div>
                  {dayPlanned.map(p => (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/60 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate block">
                          {p.descrizione}
                        </span>
                        <span className="text-[10px] text-purple-600 dark:text-purple-400 block">
                          {p.tipologia} • {p.stato}
                        </span>
                      </div>
                      <span className="font-numeric text-xs font-semibold text-purple-900 dark:text-purple-200 whitespace-nowrap tabular-nums">
                        {p.tipologia === 'ENTRATA' ? '+ ' : '- '}{formatCurrency(p.importo)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* 5. SCADENZE IMMINENTI (NERO) */}
              {dayDeadlines.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 dark:bg-neutral-100" />
                    <span>Scadenze Imminenti ({dayDeadlines.length})</span>
                  </div>
                  {dayDeadlines.map(d => (
                    <div
                      key={d.id}
                      className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate block">
                          {d.descrizione}
                        </span>
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">
                          Priorità: {d.priorita} • {d.stato}
                        </span>
                      </div>
                      <span className="font-numeric text-xs font-semibold text-neutral-900 dark:text-neutral-100 whitespace-nowrap tabular-nums">
                        - {formatCurrency(d.importo_previsto)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {dayMovements.length === 0 && dayPlanned.length === 0 && dayDeadlines.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400">
                  Nessuna transazione registrata o prevista per questo giorno.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
