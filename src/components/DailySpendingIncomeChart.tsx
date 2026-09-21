import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { Movement, DailyForecastPoint, DailySpendingIncomePoint, Planned, Deadline } from '../types';
import { formatCurrency, formatItalianNumber, formatDateIT } from '../utils/formatters';
import { useTheme } from '../context/ThemeContext';
import { TrendingUp, TrendingDown, Calendar, Percent, Clock, ArrowRight } from 'lucide-react';
import { Carousel } from './Carousel';

interface DailySpendingIncomeChartProps {
  movements: Movement[];
  daily30Days?: DailyForecastPoint[];
  planned?: Planned[];
  deadlines?: Deadline[];
}

type ViewRange = 'CENTERED_30' | 'CENTERED_60' | 'PAST_30' | 'FUTURE_30';

const monthsShort = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export const DailySpendingIncomeChart: React.FC<DailySpendingIncomeChartProps> = ({
  movements = [],
  daily30Days = [],
  planned = [],
  deadlines = []
}) => {
  const { isDark } = useTheme();
  // Predefinito: Centrato su Oggi (15 giorni prima, Oggi al centro, 15 giorni dopo)
  const [viewMode, setViewMode] = useState<ViewRange>('CENTERED_30');
  const [visibleSeries, setVisibleSeries] = useState<'ALL' | 'INCOME_ONLY' | 'EXPENSE_ONLY'>('ALL');
  const [showNetLine, setShowNetLine] = useState<boolean>(false);

  // Helper per calcolare i dati di un singolo giorno dato il suo offset rispetto a oggi
  const computeDayData = useMemo(() => {
    return (offset: number, today: Date): DailySpendingIncomePoint => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
      const yStr = d.getFullYear();
      const mStr = String(d.getMonth() + 1).padStart(2, '0');
      const dStr = String(d.getDate()).padStart(2, '0');
      const dateKey = `${yStr}-${mStr}-${dStr}`;

      const isToday = offset === 0;
      const isFuture = offset > 0;
      const displayDate = isToday ? 'Oggi' : `${d.getDate()} ${monthsShort[d.getMonth()]}`;

      let dayEntrate = 0;
      let dayUscite = 0;
      const events: string[] = [];

      // 1. Movimenti registrati (effettivi o già imputati in questa data)
      const dayMovs = (movements || []).filter(m => !(m as any).is_deleted && m.data === dateKey);
      for (const m of dayMovs) {
        if (m.tipologia === 'ENTRATA') {
          dayEntrate += m.importo;
          events.push(`+ ${formatCurrency(m.importo)}: ${m.descrizione}`);
        } else if (m.tipologia === 'USCITA') {
          dayUscite += m.importo;
          events.push(`- ${formatCurrency(m.importo)}: ${m.descrizione}`);
        }
      }

      // 2. Se è oggi o un giorno futuro, include anche pianificati e scadenze pendenti
      if (offset >= 0) {
        // Movimenti pianificati pendenti
        const dayPlanned = (planned || []).filter(
          p => !(p as any).is_deleted && p.stato === 'PENDENTE' && p.data_prevista === dateKey
        );
        for (const p of dayPlanned) {
          if (p.tipologia === 'ENTRATA') {
            dayEntrate += p.importo;
            events.push(`+ ${formatCurrency(p.importo)}: [Previsto] ${p.descrizione}`);
          } else if (p.tipologia === 'USCITA') {
            dayUscite += p.importo;
            events.push(`- ${formatCurrency(p.importo)}: [Previsto] ${p.descrizione}`);
          }
        }

        // Scadenze da pagare
        const dayDeadlines = (deadlines || []).filter(
          s => !(s as any).is_deleted && s.stato === 'DA_PAGARE' && s.data_scadenza === dateKey &&
               !dayPlanned.some(p => p.id === s.movimento_id) &&
               !dayMovs.some(m => m.id === s.movimento_id || m.descrizione === s.descrizione)
        );
        for (const s of dayDeadlines) {
          dayUscite += s.importo_previsto;
          events.push(`- ${formatCurrency(s.importo_previsto)}: [Scadenza] ${s.descrizione}`);
        }

        // Se planned e deadlines non hanno generato dati ma daily30Days contiene già valori da AccountService
        if (dayEntrate === 0 && dayUscite === 0 && daily30Days && daily30Days.length > 0) {
          const fp = daily30Days.find(p => p.date === dateKey);
          if (fp && (fp.entrate > 0 || fp.uscite > 0)) {
            dayEntrate = fp.entrate;
            dayUscite = fp.uscite;
            if (fp.events && fp.events.length > 0) {
              events.push(...fp.events);
            }
          }
        }
      }

      dayEntrate = Math.round(dayEntrate * 100) / 100;
      dayUscite = Math.round(dayUscite * 100) / 100;
      const netChange = Math.round((dayEntrate - dayUscite) * 100) / 100;

      return {
        date: dateKey,
        displayDate,
        entrate: dayEntrate,
        uscite: dayUscite,
        netChange,
        cumulativeNet: 0,
        events,
        isToday,
        isFuture
      };
    };
  }, [movements, planned, deadlines, daily30Days]);

  // Genera la serie attiva in base alla modalità selezionata
  const activeData = useMemo<DailySpendingIncomePoint[]>(() => {
    const today = new Date();
    const points: DailySpendingIncomePoint[] = [];

    let startOffset = -15;
    let endOffset = 15;

    if (viewMode === 'CENTERED_30') {
      // 15 giorni prima, Oggi al centro (offset 0, index 15), 15 giorni dopo = 31 punti
      startOffset = -15;
      endOffset = 15;
    } else if (viewMode === 'CENTERED_60') {
      // 30 giorni prima, Oggi al centro (offset 0, index 30), 30 giorni dopo = 61 punti
      startOffset = -30;
      endOffset = 30;
    } else if (viewMode === 'PAST_30') {
      // Solo ultimi 30 giorni (da -29 a 0)
      startOffset = -29;
      endOffset = 0;
    } else if (viewMode === 'FUTURE_30') {
      // Solo prossimi 30 giorni (da 0 a +30)
      startOffset = 0;
      endOffset = 30;
    }

    for (let offset = startOffset; offset <= endOffset; offset++) {
      points.push(computeDayData(offset, today));
    }

    // Calcola il cumulativo netto
    let cumulative = 0;
    return points.map(p => {
      cumulative = Math.round((cumulative + p.netChange) * 100) / 100;
      return {
        ...p,
        cumulativeNet: cumulative
      };
    });
  }, [viewMode, computeDayData]);

  // Ticks espliciti per la X-Axis per garantire che 'Oggi' compaia sempre al centro esatto
  const xAxisTicks = useMemo(() => {
    if (!activeData || activeData.length === 0) return undefined;

    if (viewMode === 'CENTERED_30') {
      // Array di 31 elementi: indici 0 (-15gg), 5 (-10gg), 10 (-5gg), 15 (Oggi), 20 (+5gg), 25 (+10gg), 30 (+15gg)
      return [
        activeData[0]?.displayDate,
        activeData[5]?.displayDate,
        activeData[10]?.displayDate,
        'Oggi',
        activeData[20]?.displayDate,
        activeData[25]?.displayDate,
        activeData[30]?.displayDate
      ].filter(Boolean);
    }

    if (viewMode === 'CENTERED_60') {
      // Array di 61 elementi: indici 0 (-30), 10 (-20), 20 (-10), 30 (Oggi), 40 (+10), 50 (+20), 60 (+30)
      return [
        activeData[0]?.displayDate,
        activeData[10]?.displayDate,
        activeData[20]?.displayDate,
        'Oggi',
        activeData[40]?.displayDate,
        activeData[50]?.displayDate,
        activeData[60]?.displayDate
      ].filter(Boolean);
    }

    if (viewMode === 'PAST_30') {
      // Indici a passi di 5 finendo con 'Oggi'
      const t: string[] = [];
      for (let i = 0; i < activeData.length; i += 5) {
        t.push(activeData[i].displayDate);
      }
      if (!t.includes('Oggi') && activeData[activeData.length - 1]) {
        t.push(activeData[activeData.length - 1].displayDate);
      }
      return t;
    }

    if (viewMode === 'FUTURE_30') {
      const t: string[] = [];
      for (let i = 0; i < activeData.length; i += 5) {
        t.push(activeData[i].displayDate);
      }
      if (activeData[activeData.length - 1] && !t.includes(activeData[activeData.length - 1].displayDate)) {
        t.push(activeData[activeData.length - 1].displayDate);
      }
      return t;
    }

    return undefined;
  }, [activeData, viewMode]);

  // Statistiche del periodo attivo (con distinzione tra passato reale e futuro previsto)
  const stats = useMemo(() => {
    const totalEntrate = Math.round(activeData.reduce((acc, p) => acc + p.entrate, 0) * 100) / 100;
    const totalUscite = Math.round(activeData.reduce((acc, p) => acc + p.uscite, 0) * 100) / 100;
    const netResult = Math.round((totalEntrate - totalUscite) * 100) / 100;
    const savingsRate = totalEntrate > 0 
      ? Math.round(((totalEntrate - totalUscite) / totalEntrate) * 100) 
      : 0;

    // Ripartizione tra effettivo (passato e oggi) e previsto (futuro)
    const pastEntrate = Math.round(activeData.filter(p => !p.isFuture).reduce((acc, p) => acc + p.entrate, 0) * 100) / 100;
    const pastUscite = Math.round(activeData.filter(p => !p.isFuture).reduce((acc, p) => acc + p.uscite, 0) * 100) / 100;

    const futureEntrate = Math.round(activeData.filter(p => p.isFuture).reduce((acc, p) => acc + p.entrate, 0) * 100) / 100;
    const futureUscite = Math.round(activeData.filter(p => p.isFuture).reduce((acc, p) => acc + p.uscite, 0) * 100) / 100;

    // Medie giornaliere
    const daysCount = activeData.length || 1;
    const avgDailyUscite = Math.round((totalUscite / daysCount) * 100) / 100;
    const avgDailyEntrate = Math.round((totalEntrate / daysCount) * 100) / 100;

    // Valore massimo per Y-Axis
    const allVals = activeData.flatMap(p => [p.entrate, p.uscite, showNetLine ? Math.abs(p.netChange) : 0]);
    const maxVal = Math.max(...allVals, 50);

    return {
      totalEntrate,
      totalUscite,
      netResult,
      savingsRate,
      pastEntrate,
      pastUscite,
      futureEntrate,
      futureUscite,
      avgDailyUscite,
      avgDailyEntrate,
      maxVal
    };
  }, [activeData, showNetLine]);

  // Calcolo dominio Y
  const yMax = Math.ceil((stats.maxVal * 1.15) / 50) * 50;

  // Custom Tick per evidenziare "Oggi" in modo evidente
  const renderCustomXAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const isOggi = payload.value === 'Oggi';

    return (
      <g transform={`translate(${x},${y})`}>
        {isOggi ? (
          <text
            x={0}
            y={0}
            dy={12}
            textAnchor="middle"
            fill={isDark ? '#E31B23' : '#dc2626'}
            fontSize={11}
            fontWeight={800}
          >
            ● Oggi
          </text>
        ) : (
          <text
            x={0}
            y={0}
            dy={12}
            textAnchor="middle"
            fill={isDark ? '#8E8E93' : '#64748b'}
            fontSize={10}
            fontWeight={500}
          >
            {payload.value}
          </text>
        )}
      </g>
    );
  };

  // Custom Dots per evidenziare con cerchio doppio pulsante il punto di "Oggi"
  const renderIncomeDot = (props: any) => {
    const { cx, cy, payload, index } = props;
    if (!cx || !cy) return null;
    if (payload?.isToday) {
      return (
        <g key={`income-dot-today-${index}`}>
          <circle cx={cx} cy={cy} r={6} fill="#10b981" stroke="#ffffff" strokeWidth={2} />
          <circle cx={cx} cy={cy} r={10} fill="none" stroke="#10b981" strokeWidth={1.5} opacity={0.6} />
        </g>
      );
    }
    return <circle key={`income-dot-${index}`} cx={cx} cy={cy} r={2.5} fill="#10b981" />;
  };

  const renderExpenseDot = (props: any) => {
    const { cx, cy, payload, index } = props;
    if (!cx || !cy) return null;
    if (payload?.isToday) {
      return (
        <g key={`expense-dot-today-${index}`}>
          <circle cx={cx} cy={cy} r={6} fill="#f43f5e" stroke="#ffffff" strokeWidth={2} />
          <circle cx={cx} cy={cy} r={10} fill="none" stroke="#f43f5e" strokeWidth={1.5} opacity={0.6} />
        </g>
      );
    }
    return <circle key={`expense-dot-${index}`} cx={cx} cy={cy} r={2.5} fill="#f43f5e" />;
  };

  const renderNetDot = (props: any) => {
    const { cx, cy, payload, index } = props;
    if (!cx || !cy) return null;
    if (payload?.isToday) {
      return (
        <g key={`net-dot-today-${index}`}>
          <circle cx={cx} cy={cy} r={5} fill="#6366f1" stroke="#ffffff" strokeWidth={2} />
          <circle cx={cx} cy={cy} r={9} fill="none" stroke="#6366f1" strokeWidth={1.5} opacity={0.6} />
        </g>
      );
    }
    return <circle key={`net-dot-${index}`} cx={cx} cy={cy} r={2} fill="#6366f1" />;
  };

  // Custom Tooltip Recharts
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload as DailySpendingIncomePoint;
      const hasMovs = point.events && point.events.length > 0;

      return (
        <div className="bg-white/95 dark:bg-[#1C1C1E] backdrop-blur-md px-3.5 py-3 rounded-2xl shadow-xl border border-slate-200/80 dark:border-white/10 text-xs min-w-[240px] z-50">
          <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-white/5">
            <span className="font-semibold text-slate-900 dark:text-[#F5F5F7] flex items-center gap-1.5">
              <Calendar size={13} className="text-indigo-600 dark:text-indigo-400" />
              {point.displayDate}
              {point.isToday && (
                <span className="px-2 py-0.5 rounded-full bg-[#E31B23]/15 text-[#E31B23] text-[10px] font-bold border border-[#E31B23]/30">
                  Oggi (Centro)
                </span>
              )}
              {point.isFuture && !point.isToday && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-medium border border-amber-500/30">
                  Previsto
                </span>
              )}
              {!point.isFuture && !point.isToday && (
                <span className="px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-600 dark:text-[#8E8E93] text-[10px] font-medium border border-slate-500/30">
                  Storico
                </span>
              )}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] font-numeric tabular-nums">
              {formatDateIT(point.date)}
            </span>
          </div>

          <div className="space-y-1.5 font-numeric tabular-nums">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-[#8E8E93] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Entrate:
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(point.entrate, { showSign: true })}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-[#8E8E93] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Spese:
              </span>
              <span className="font-bold text-rose-600 dark:text-rose-400">
                {formatCurrency(point.uscite)}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-white/5 text-[11px]">
              <span className="text-slate-600 dark:text-[#8E8E93] font-medium">Saldo Giornaliero:</span>
              <span className={`font-extrabold ${point.netChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {formatCurrency(point.netChange, { showSign: true })}
              </span>
            </div>
          </div>

          {hasMovs && (
            <div className="pt-2 mt-2 border-t border-slate-100 dark:border-white/5 text-[10px] space-y-1">
              <span className="text-slate-400 dark:text-[#8E8E93] block font-medium">Dettaglio eventi:</span>
              <div className="max-h-24 overflow-y-auto space-y-0.5 no-scrollbar">
                {point.events.slice(0, 4).map((ev, i) => (
                  <div key={i} className="text-slate-700 dark:text-[#F5F5F7] truncate">
                    • {ev}
                  </div>
                ))}
                {point.events.length > 4 && (
                  <span className="text-slate-400 dark:text-[#8E8E93] text-[9px] block">
                    + altri {point.events.length - 4} eventi
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div id="spending-income-line-chart-card" className="bento-card p-5 space-y-4">
      {/* Header con Titolo, Descrizione e Selettore Vista */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
              <TrendingUp size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#F5F5F7] tracking-tight">
                Entrate vs Uscite Giornaliere (30 Giorni)
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#8E8E93] mt-0.5">
                {viewMode === 'CENTERED_30' && '15 giorni precedenti • Oggi al centro • 15 giorni successivi (previsti)'}
                {viewMode === 'CENTERED_60' && '30 giorni precedenti • Oggi al centro • 30 giorni successivi (previsti)'}
                {viewMode === 'PAST_30' && 'Ultimi 30 giorni storici (conclusi a oggi)'}
                {viewMode === 'FUTURE_30' && 'Prossimi 30 giorni previsti (da oggi in poi)'}
              </p>
            </div>
          </div>
        </div>

        {/* Pulsanti Switch Range: Centrato su Oggi (Predefinito), Panoramica 60gg, Solo Passato, Solo Futuro */}
        <div className="flex bg-slate-100 dark:bg-[#1C1C1E] p-1 rounded-full text-xs font-semibold overflow-x-auto no-scrollbar border border-slate-200/60 dark:border-white/5 flex-shrink-0">
          <button
            onClick={() => setViewMode('CENTERED_30')}
            className={`px-3 py-1.5 rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
              viewMode === 'CENTERED_30'
                ? 'bg-[#E31B23] text-white shadow-xs'
                : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7]'
            }`}
          >
            <span>Centrato (±15gg • Centro)</span>
          </button>
          <button
            onClick={() => setViewMode('CENTERED_60')}
            className={`px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${
              viewMode === 'CENTERED_60'
                ? 'bg-[#E31B23] text-white shadow-xs'
                : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7]'
            }`}
          >
            <span>Panoramica 60gg</span>
          </button>
          <button
            onClick={() => setViewMode('PAST_30')}
            className={`px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${
              viewMode === 'PAST_30'
                ? 'bg-[#E31B23] text-white shadow-xs'
                : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7]'
            }`}
          >
            <span>Solo Passato</span>
          </button>
          <button
            onClick={() => setViewMode('FUTURE_30')}
            className={`px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${
              viewMode === 'FUTURE_30'
                ? 'bg-[#E31B23] text-white shadow-xs'
                : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7]'
            }`}
          >
            <span>Solo Futuro</span>
          </button>
        </div>
      </div>

      {/* Indicatore visivo di timeline (visibile in modalità centrata) */}
      {(viewMode === 'CENTERED_30' || viewMode === 'CENTERED_60') && (
        <div className="flex items-center justify-between text-xs px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-[#1C1C1E] border border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-[#8E8E93] text-[11px] font-medium">
            <span>◀ Storico ({viewMode === 'CENTERED_30' ? '15gg passati' : '30gg passati'})</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E31B23]/15 text-[#E31B23] border border-[#E31B23]/30 text-xs font-bold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#E31B23] animate-pulse" />
            <span>OGGI AL CENTRO</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-[#8E8E93] text-[11px] font-medium">
            <span>Previsioni ({viewMode === 'CENTERED_30' ? '15gg successivi' : '30gg successivi'}) ▶</span>
          </div>
        </div>
      )}

      {/* KPI Cards del Periodo Selezionato (Carousel su Mobile, Griglia su Desktop) */}
      <Carousel
        id="daily-spending-kpi-carousel"
        desktopGridClassName="sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3"
        showDots={true}
        showArrows={true}
        ariaLabel="Metriche Giornaliere del Periodo"
      >
        <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/80 dark:border-emerald-900/40 space-y-1 h-full">
          <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide block">
            Entrate Totali
          </span>
          <div className="font-numeric text-base sm:text-lg font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatCurrency(stats.totalEntrate, { showSign: true })}
          </div>
          <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 block tabular-nums">
            {viewMode === 'CENTERED_30' || viewMode === 'CENTERED_60' 
              ? `Reali: ${formatCurrency(stats.pastEntrate)} • Prev.: ${formatCurrency(stats.futureEntrate)}`
              : `Media: ${formatCurrency(stats.avgDailyEntrate)}/gg`}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-100/80 dark:border-rose-900/40 space-y-1 h-full">
          <span className="text-[11px] font-semibold text-rose-800 dark:text-rose-300 uppercase tracking-wide block">
            Spese Totali
          </span>
          <div className="font-numeric text-base sm:text-lg font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">
            {formatCurrency(stats.totalUscite)}
          </div>
          <span className="text-[11px] text-rose-700/80 dark:text-rose-400/80 block tabular-nums">
            {viewMode === 'CENTERED_30' || viewMode === 'CENTERED_60'
              ? `Reali: ${formatCurrency(stats.pastUscite)} • Prev.: ${formatCurrency(stats.futureUscite)}`
              : `Media: ${formatCurrency(stats.avgDailyUscite)}/gg`}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 space-y-1 h-full">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8E8E93] uppercase tracking-wide block">
            Flusso Netto
          </span>
          <div className={`font-numeric text-base sm:text-lg font-extrabold tabular-nums ${
            stats.netResult >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}>
            {formatCurrency(stats.netResult, { showSign: true })}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-[#8E8E93] block">
            {stats.netResult >= 0 ? 'Attivo di periodo' : 'Disavanzo temporaneo'}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100/80 dark:border-indigo-900/40 space-y-1 h-full">
          <span className="text-[11px] font-semibold text-indigo-800 dark:text-indigo-300 uppercase tracking-wide block flex items-center gap-1">
            <Percent size={12} />
            Tasso Risparmio
          </span>
          <div className={`font-numeric text-base sm:text-lg font-extrabold tabular-nums ${
            stats.savingsRate >= 20 ? 'text-emerald-600 dark:text-emerald-400' : stats.savingsRate >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'
          }`}>
            {stats.savingsRate}%
          </div>
          <span className="text-[11px] text-indigo-700/80 dark:text-indigo-400/80 block">
            {stats.savingsRate >= 20 ? 'Salute Ottimale' : stats.savingsRate >= 0 ? 'In pareggio' : 'Attenzione'}
          </span>
        </div>
      </Carousel>

      {/* Controlli Filtro Serie (Tutte, Solo Entrate, Solo Spese, Mostra Saldo Netto) */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setVisibleSeries('ALL')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              visibleSeries === 'ALL'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 dark:bg-[#1C1C1E] text-slate-600 dark:text-[#8E8E93] hover:bg-slate-200/70 dark:hover:bg-[#242426]'
            }`}
          >
            Tutte le Serie
          </button>
          <button
            onClick={() => setVisibleSeries('INCOME_ONLY')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all ${
              visibleSeries === 'INCOME_ONLY'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/60'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Solo Entrate
          </button>
          <button
            onClick={() => setVisibleSeries('EXPENSE_ONLY')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all ${
              visibleSeries === 'EXPENSE_ONLY'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100/70 dark:hover:bg-rose-900/60'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Solo Spese
          </button>
        </div>

        <button
          onClick={() => setShowNetLine(!showNetLine)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-all ${
            showNetLine
              ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-semibold'
              : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-[#8E8E93] hover:text-slate-800 dark:hover:text-[#F5F5F7]'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${showNetLine ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
          Mostra Linea Netta
        </button>
      </div>

      {/* Grafico Recharts con Oggi al Centro */}
      <div className="w-full h-68 sm:h-76 pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={activeData}
            margin={{ top: 16, right: 12, left: -6, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDark ? '#2A2A2E' : '#f1f5f9'}
              vertical={false}
            />

            <XAxis
              dataKey="displayDate"
              ticks={xAxisTicks}
              tick={renderCustomXAxisTick}
              tickLine={false}
              axisLine={{ stroke: isDark ? '#334155' : '#e2e8f0' }}
            />

            <YAxis
              domain={[0, yMax]}
              tick={{ fontSize: 10, fill: isDark ? '#8E8E93' : '#64748b' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={val => `${formatItalianNumber(val, { maximumFractionDigits: 0 })} €`}
            />

            <Tooltip content={<CustomTooltip />} />

            <ReferenceLine y={0} stroke={isDark ? '#334155' : '#e2e8f0'} strokeWidth={1} />

            {/* Linea Verticale di Riferimento su "OGGI" al centro del grafico */}
            <ReferenceLine
              x="Oggi"
              stroke={isDark ? '#E31B23' : '#dc2626'}
              strokeWidth={2}
              strokeDasharray="4 4"
              label={{
                value: '📍 OGGI (Centro)',
                position: 'top',
                fill: isDark ? '#E31B23' : '#dc2626',
                fontSize: 10,
                fontWeight: 700,
                offset: 8
              }}
            />

            {/* Linea Entrate (Verde Smeraldo) */}
            {(visibleSeries === 'ALL' || visibleSeries === 'INCOME_ONLY') && (
              <Line
                type="monotone"
                dataKey="entrate"
                name="Entrate"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={renderIncomeDot}
                activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2, fill: '#10b981' }}
                animationDuration={600}
              />
            )}

            {/* Linea Uscite (Rosa / Rosso) */}
            {(visibleSeries === 'ALL' || visibleSeries === 'EXPENSE_ONLY') && (
              <Line
                type="monotone"
                dataKey="uscite"
                name="Spese"
                stroke="#f43f5e"
                strokeWidth={2.5}
                dot={renderExpenseDot}
                activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2, fill: '#f43f5e' }}
                animationDuration={600}
              />
            )}

            {/* Linea Opzionale Risultato Netto Giornaliero (Indaco) */}
            {showNetLine && (
              <Line
                type="monotone"
                dataKey="netChange"
                name="Saldo Netto"
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={renderNetDot}
                activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2, fill: '#6366f1' }}
                animationDuration={600}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legenda inferiore */}
      <div className="flex flex-wrap items-center justify-center gap-5 pt-1 text-xs text-slate-500 dark:text-[#8E8E93]">
        {(visibleSeries === 'ALL' || visibleSeries === 'INCOME_ONLY') && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full bg-emerald-500" />
            <span className="font-medium text-slate-700 dark:text-[#F5F5F7]">Entrate Giornaliere</span>
          </div>
        )}
        {(visibleSeries === 'ALL' || visibleSeries === 'EXPENSE_ONLY') && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full bg-rose-500" />
            <span className="font-medium text-slate-700 dark:text-[#F5F5F7]">Spese Giornaliere</span>
          </div>
        )}
        {showNetLine && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full bg-indigo-500 border-dashed" />
            <span className="font-medium text-indigo-600 dark:text-indigo-400">Saldo Netto del Giorno</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full border border-dashed border-[#E31B23]" />
          <span className="font-medium text-[#E31B23]">Oggi (Centro)</span>
        </div>
      </div>
    </div>
  );
};
