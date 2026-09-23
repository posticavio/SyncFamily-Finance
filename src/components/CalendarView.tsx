import React, { useState, useEffect, useMemo } from 'react';
import { Movement, Planned, Deadline, Subcategory, getSubcategoryClassification } from '../types';
import { formatCurrency, formatDateIT, getAmountDisplay, formatItalianNumber } from '../utils/formatters';
import { CategoryIcon } from './CategoryIcon';
import { TabHeaderInfo } from './TabHeaderInfo';
import { AccountService } from '../services/AccountService';
import { DB } from '../services/store';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Calendar as CalendarIcon, 
  Flame, 
  LayoutGrid, 
  Columns3, 
  ListFilter, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Filter,
  ShieldCheck,
  Sparkles,
  Wallet,
  LineChart,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  EyeOff
} from 'lucide-react';

export type CalendarViewMode = 'MESE' | 'SETTIMANA' | 'AGENDA';
export type DayInspectorFilter = 'ALL' | 'ENTRATE' | 'ESSENZIALI' | 'EXTRA' | 'GIROCONTI' | 'PIANIFICATI' | 'SCADENZE';

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
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [selectedDayStr, setSelectedDayStr] = useState<string>(
    selectedDate || new Date().toISOString().split('T')[0]
  );
  const [viewMode, setViewMode] = useState<CalendarViewMode>('MESE');
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [showDailyBalance, setShowDailyBalance] = useState<boolean>(true);
  const [showBalanceTimelineModal, setShowBalanceTimelineModal] = useState<boolean>(false);
  const [inspectorFilter, setInspectorFilter] = useState<DayInspectorFilter>('ALL');
  const [agendaFilter, setAgendaFilter] = useState<'ALL' | 'ENTRATE' | 'ESSENZIALI' | 'EXTRA' | 'USCITE' | 'PIANIFICATI' | 'SCADENZE'>('ALL');

  useEffect(() => {
    if (selectedDate) {
      setSelectedDayStr(selectedDate);
      const [y, m, d] = selectedDate.split('-').map(Number);
      if (y && m) {
        setCurrentDate(new Date(y, m - 1, d || 1));
      }
    }
  }, [selectedDate]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // Header month title
  const monthTitle = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(currentDate);
  const capitalizedTitle = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);

  // Helper date conversions
  const toDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Calcolo della settimana corrente (da Lunedì a Domenica)
  const currentWeekDays = useMemo(() => {
    const curr = new Date(currentDate);
    const dayOfWeek = (curr.getDay() + 6) % 7; // Lunedì = 0, Domenica = 6
    const monday = new Date(curr);
    monday.setDate(curr.getDate() - dayOfWeek);

    const week: { date: Date; dateStr: string; dayNum: number; dayName: string; isToday: boolean }[] = [];
    const dayNames = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = toDateKey(d);
      week.push({
        date: d,
        dateStr,
        dayNum: d.getDate(),
        dayName: dayNames[i],
        isToday: dateStr === todayStr
      });
    }
    return week;
  }, [currentDate, todayStr]);

  // Settimana Title
  const weekTitle = useMemo(() => {
    if (currentWeekDays.length === 0) return '';
    const start = currentWeekDays[0].date;
    const end = currentWeekDays[6].date;
    const startStr = `${start.getDate()} ${new Intl.DateTimeFormat('it-IT', { month: 'short' }).format(start)}`;
    const endStr = `${end.getDate()} ${new Intl.DateTimeFormat('it-IT', { month: 'short' }).format(end)} ${end.getFullYear()}`;
    return `Settimana · ${startStr} - ${endStr}`;
  }, [currentWeekDays]);

  // Navigazione temporale flessibile in base alla modalità
  const handlePrev = () => {
    if (viewMode === 'SETTIMANA') {
      const prevWeek = new Date(currentDate);
      prevWeek.setDate(currentDate.getDate() - 7);
      setCurrentDate(prevWeek);
    } else {
      setCurrentDate(new Date(year, month - 1, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'SETTIMANA') {
      const nextWeek = new Date(currentDate);
      nextWeek.setDate(currentDate.getDate() + 7);
      setCurrentDate(nextWeek);
    } else {
      setCurrentDate(new Date(year, month + 1, 1));
    }
  };

  const handleGoToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDayStr(todayStr);
  };

  // Navigazione rapida giorno nel pannello dettagli
  const handleStepDay = (step: number) => {
    const [y, m, d] = selectedDayStr.split('-').map(Number);
    const curr = new Date(y, m - 1, d);
    curr.setDate(curr.getDate() + step);
    const newStr = toDateKey(curr);
    setSelectedDayStr(newStr);
    setCurrentDate(curr);
  };

  // Costruzione griglia mensile completa
  const monthDaysMatrix = useMemo(() => {
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Lunedì = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Padding mese precedente
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevMonthIdx = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dateStr = `${prevYear}-${(prevMonthIdx + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      days.push({ dateStr, dayNum: d, isCurrentMonth: false });
    }

    // Giorni mese corrente
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      days.push({ dateStr, dayNum: d, isCurrentMonth: true });
    }

    // Padding mese successivo per completare la griglia a 35 o 42
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextMonthIdx = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const dateStr = `${nextYear}-${(nextMonthIdx + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      days.push({ dateStr, dayNum: d, isCurrentMonth: false });
    }

    return days;
  }, [year, month]);

  // Calcolo KPI aggregati del Mese Corrente
  const monthStats = useMemo(() => {
    const prefix = `${year}-${(month + 1).toString().padStart(2, '0')}`;
    const monthlyMovs = movements.filter(m => m.data.startsWith(prefix));
    const monthlyPlanned = planned.filter(p => p.data_prevista.startsWith(prefix) && p.stato === 'PENDENTE');
    const monthlyDeadlines = deadlines.filter(d => d.data_scadenza.startsWith(prefix));

    const totalEntrate = monthlyMovs
      .filter(m => m.tipologia === 'ENTRATA')
      .reduce((sum, m) => sum + m.importo, 0);

    const totalUscite = monthlyMovs
      .filter(m => m.tipologia === 'USCITA')
      .reduce((sum, m) => sum + m.importo, 0);

    const saldoNetto = totalEntrate - totalUscite;

    const plannedPendingTotal = monthlyPlanned
      .filter(p => p.tipologia === 'USCITA')
      .reduce((sum, p) => sum + p.importo, 0);

    const deadlinesTotal = monthlyDeadlines
      .reduce((sum, d) => sum + (d.importo_previsto || 0), 0);

    // Trova la spesa massima giornaliera del mese per normalizzare la heatmap
    let maxDailyExpense = 0;
    const dailyExpensesMap: Record<string, number> = {};

    monthlyMovs.forEach(m => {
      if (m.tipologia === 'USCITA') {
        dailyExpensesMap[m.data] = (dailyExpensesMap[m.data] || 0) + m.importo;
        if (dailyExpensesMap[m.data] > maxDailyExpense) {
          maxDailyExpense = dailyExpensesMap[m.data];
        }
      }
    });

    return {
      totalEntrate,
      totalUscite,
      saldoNetto,
      plannedCount: monthlyPlanned.length,
      plannedPendingTotal,
      deadlinesCount: monthlyDeadlines.length,
      deadlinesTotal,
      maxDailyExpense: maxDailyExpense || 100,
      dailyExpensesMap
    };
  }, [year, month, movements, planned, deadlines]);

  // =========================================================================
  // DATI DEL GIORNO SELEZIONATO CON ORDINAMENTO E SUDDIVISIONE RICHIESTA:
  // 1. Entrate: ordinate dal più grande al più piccolo (b.importo - a.importo)
  // 2. Spese Essenziali: ordinate dal più grande al più piccolo (b.importo - a.importo)
  // 3. Spese Extra: ordinate dal più grande al più piccolo (b.importo - a.importo)
  // 4. Trasferimenti / Giroconti: ordinati dal più grande al più piccolo (b.importo - a.importo)
  // 5. Pianificate e Scadenze ordinate per importo decrescente
  // =========================================================================

  const dayMovements = useMemo(() => movements.filter(m => m.data === selectedDayStr), [movements, selectedDayStr]);
  
  const dayPlanned = useMemo(() => {
    return planned
      .filter(p => p.data_prevista === selectedDayStr && p.stato === 'PENDENTE')
      .sort((a, b) => b.importo - a.importo);
  }, [planned, selectedDayStr]);

  const dayDeadlines = useMemo(() => {
    return deadlines
      .filter(d => d.data_scadenza === selectedDayStr)
      .sort((a, b) => (b.importo_previsto || 0) - (a.importo_previsto || 0));
  }, [deadlines, selectedDayStr]);

  // 1. Entrate ordinate dal più grande al più piccolo
  const dayEntrate = useMemo(() => {
    return dayMovements
      .filter(m => m.tipologia === 'ENTRATA')
      .sort((a, b) => b.importo - a.importo);
  }, [dayMovements]);

  // 2. Spese suddivise in Essenziali ed Extra (entrambe ordinate dal più grande al più piccolo)
  const dayUsciteEssenziali = useMemo(() => {
    return dayMovements
      .filter(m => {
        if (m.tipologia !== 'USCITA') return false;
        const sub = subcategories.find(s => s.id === m.sottocategoria_id);
        const macro = sub?.classificazione || getSubcategoryClassification(sub);
        return macro === 'SPESE_ESSENZIALI';
      })
      .sort((a, b) => b.importo - a.importo);
  }, [dayMovements, subcategories]);

  const dayUsciteExtra = useMemo(() => {
    return dayMovements
      .filter(m => {
        if (m.tipologia !== 'USCITA') return false;
        const sub = subcategories.find(s => s.id === m.sottocategoria_id);
        const macro = sub?.classificazione || getSubcategoryClassification(sub);
        return macro === 'SPESE_EXTRA';
      })
      .sort((a, b) => b.importo - a.importo);
  }, [dayMovements, subcategories]);

  // 3. Trasferimenti / Giroconti ordinati dal più grande al più piccolo
  const dayGiroconti = useMemo(() => {
    return dayMovements
      .filter(m => m.tipologia === 'GIROCONTO')
      .sort((a, b) => b.importo - a.importo);
  }, [dayMovements]);

  // Totali Giornalieri
  const dayTotalEntrate = useMemo(() => dayEntrate.reduce((sum, m) => sum + m.importo, 0), [dayEntrate]);
  const dayTotalEssenziali = useMemo(() => dayUsciteEssenziali.reduce((sum, m) => sum + m.importo, 0), [dayUsciteEssenziali]);
  const dayTotalExtra = useMemo(() => dayUsciteExtra.reduce((sum, m) => sum + m.importo, 0), [dayUsciteExtra]);
  const dayTotalUscite = dayTotalEssenziali + dayTotalExtra;
  const dayTotalGiroconti = useMemo(() => dayGiroconti.reduce((sum, m) => sum + m.importo, 0), [dayGiroconti]);
  const dayNet = dayTotalEntrate - dayTotalUscite;

  // =========================================================================
  // CALCOLO DEL SALDO GIORNO PER GIORNO FINO A FINE MESE CORRENTE
  // Include il saldo cumulativo reale fino ad oggi e la proiezione con
  // movimenti futuri + pianificati/scadenze da oggi fino all'ultimo giorno del mese
  // =========================================================================
  const dailyBalancesMap = useMemo(() => {
    const map: Record<string, { 
      balance: number; 
      isProjected: boolean; 
      netDay: number; 
      entrate: number; 
      usciteEssenziali: number; 
      usciteExtra: number; 
      usciteTotali: number;
      planned: number;
    }> = {};
    
    const activeAccounts = (DB.CONTI || []).filter(c => c.attivo && !(c as any).is_deleted);
    const activeFunds = (DB.FONDI || []).filter(f => f.attivo && !(f as any).is_deleted);

    monthDaysMatrix.forEach(day => {
      const isFuture = day.dateStr > todayStr;
      const [y, m, d] = day.dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d, 23, 59, 59);

      let totalBal = 0;
      for (const acc of activeAccounts) {
        totalBal += AccountService.calculateBalanceAtDate(acc.id, dateObj, {
          includeFutureMovements: isFuture,
          includePlanned: isFuture
        });
      }
      for (const f of activeFunds) {
        totalBal += AccountService.calculateBalanceAtDate(f.id, dateObj, {
          includeFutureMovements: isFuture,
          includePlanned: isFuture
        });
      }

      const dayMovs = movements.filter(mv => mv.data === day.dateStr);
      const ent = dayMovs.filter(mv => mv.tipologia === 'ENTRATA').reduce((s, mv) => s + mv.importo, 0);
      
      const ess = dayMovs.filter(mv => {
        if (mv.tipologia !== 'USCITA') return false;
        const sub = subcategories.find(s => s.id === mv.sottocategoria_id);
        const macro = sub?.classificazione || getSubcategoryClassification(sub);
        return macro === 'SPESE_ESSENZIALI';
      }).reduce((s, mv) => s + mv.importo, 0);

      const ext = dayMovs.filter(mv => {
        if (mv.tipologia !== 'USCITA') return false;
        const sub = subcategories.find(s => s.id === mv.sottocategoria_id);
        const macro = sub?.classificazione || getSubcategoryClassification(sub);
        return macro === 'SPESE_EXTRA';
      }).reduce((s, mv) => s + mv.importo, 0);

      const pln = planned.filter(p => p.data_prevista === day.dateStr && p.stato === 'PENDENTE' && p.tipologia === 'USCITA').reduce((s, p) => s + p.importo, 0);

      map[day.dateStr] = {
        balance: Math.round(totalBal * 100) / 100,
        isProjected: isFuture,
        netDay: Math.round((ent - (ess + ext)) * 100) / 100,
        entrate: ent,
        usciteEssenziali: ess,
        usciteExtra: ext,
        usciteTotali: ess + ext,
        planned: pln
      };
    });

    return map;
  }, [monthDaysMatrix, todayStr, movements, planned, deadlines, subcategories]);

  // Prospetto cronologico giorno per giorno per tutto il mese (giorno 1..Fine Mese)
  const currentMonthDailyBalances = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list = [];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dateObj = new Date(year, month, d);
      const dayData = dailyBalancesMap[dateStr] || {
        balance: 0,
        isProjected: dateStr > todayStr,
        netDay: 0,
        entrate: 0,
        usciteEssenziali: 0,
        usciteExtra: 0,
        usciteTotali: 0,
        planned: 0
      };

      list.push({
        dayNum: d,
        dateStr,
        dayName: dayNames[dateObj.getDay()],
        isToday: dateStr === todayStr,
        isPast: dateStr < todayStr,
        isFuture: dateStr > todayStr,
        ...dayData
      });
    }
    return list;
  }, [year, month, dailyBalancesMap, todayStr]);

  // Saldo stimato all'ultimo giorno del mese visualizzato
  const monthEndBalance = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const lastDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    return dailyBalancesMap[lastDayStr]?.balance ?? 0;
  }, [dailyBalancesMap, year, month]);

  // Saldo odierno
  const todayBalance = useMemo(() => {
    return dailyBalancesMap[todayStr]?.balance ?? (DB.CONTI.reduce((s, c) => s + (c.saldo_reale ?? c.saldo_iniziale), 0));
  }, [dailyBalancesMap, todayStr]);

  // Dati per la vista AGENDA (giorni del mese con attività e ordinamento rigoroso)
  const agendaDays = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      const movs = movements.filter(m => m.data === dateStr);
      const plans = planned.filter(p => p.data_prevista === dateStr && p.stato === 'PENDENTE').sort((a, b) => b.importo - a.importo);
      const deads = deadlines.filter(dead => dead.data_scadenza === dateStr).sort((a, b) => (b.importo_previsto || 0) - (a.importo_previsto || 0));

      const entrate = movs.filter(m => m.tipologia === 'ENTRATA').sort((a, b) => b.importo - a.importo);
      
      const essenziali = movs.filter(m => {
        if (m.tipologia !== 'USCITA') return false;
        const sub = subcategories.find(s => s.id === m.sottocategoria_id);
        const macro = sub?.classificazione || getSubcategoryClassification(sub);
        return macro === 'SPESE_ESSENZIALI';
      }).sort((a, b) => b.importo - a.importo);

      const extra = movs.filter(m => {
        if (m.tipologia !== 'USCITA') return false;
        const sub = subcategories.find(s => s.id === m.sottocategoria_id);
        const macro = sub?.classificazione || getSubcategoryClassification(sub);
        return macro === 'SPESE_EXTRA';
      }).sort((a, b) => b.importo - a.importo);

      const giroconti = movs.filter(m => m.tipologia === 'GIROCONTO').sort((a, b) => b.importo - a.importo);

      const sumEntrate = entrate.reduce((s, m) => s + m.importo, 0);
      const sumEssenziali = essenziali.reduce((s, m) => s + m.importo, 0);
      const sumExtra = extra.reduce((s, m) => s + m.importo, 0);
      const sumUscite = sumEssenziali + sumExtra;

      // Applica filtro agenda
      let hasVisibleItems = false;
      if (agendaFilter === 'ALL') {
        hasVisibleItems = movs.length > 0 || plans.length > 0 || deads.length > 0;
      } else if (agendaFilter === 'ENTRATE') {
        hasVisibleItems = entrate.length > 0;
      } else if (agendaFilter === 'ESSENZIALI') {
        hasVisibleItems = essenziali.length > 0;
      } else if (agendaFilter === 'EXTRA') {
        hasVisibleItems = extra.length > 0;
      } else if (agendaFilter === 'USCITE') {
        hasVisibleItems = essenziali.length > 0 || extra.length > 0;
      } else if (agendaFilter === 'PIANIFICATI') {
        hasVisibleItems = plans.length > 0;
      } else if (agendaFilter === 'SCADENZE') {
        hasVisibleItems = deads.length > 0;
      }

      if (hasVisibleItems) {
        list.push({
          dateStr,
          dayNum: d,
          dateObj: new Date(year, month, d),
          movs,
          entrate,
          essenziali,
          extra,
          giroconti,
          plans,
          deads,
          sumEntrate,
          sumEssenziali,
          sumExtra,
          sumUscite,
          net: sumEntrate - sumUscite,
          isToday: dateStr === todayStr,
          isSelected: dateStr === selectedDayStr
        });
      }
    }
    return list;
  }, [year, month, movements, planned, deadlines, subcategories, todayStr, selectedDayStr, agendaFilter]);

  return (
    <div id="calendar-view-container" className="space-y-4">
      {/* 1. SEZIONE TITOLO & BARRA DI CONTROLLO UNIFICATA */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Titolo e icona */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 shadow-xs border border-indigo-100 dark:border-indigo-900/40">
            <CalendarIcon size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                {viewMode === 'SETTIMANA' ? weekTitle : capitalizedTitle}
              </h1>
              <TabHeaderInfo text="Visualizzazione con ordinamento decrescente per importo, suddivisione Spese Essenziali/Extra e mappa termica" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {viewMode === 'MESE' && 'Panoramica mensile con distribuzione termica delle spese e dettaglio giornaliero ordinato per importo'}
              {viewMode === 'SETTIMANA' && 'Pianificazione orizzontale a 7 colonne verticali con flussi ordinati per importo'}
              {viewMode === 'AGENDA' && 'Timeline cronologica progressiva con suddivisione Spese Essenziali ed Extra'}
            </p>
          </div>
        </div>

        {/* Controlli Desktop: Switch Modalità + Heatmap + Navigazione */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Selettore a pillola 3 Modalità One UI */}
          <div className="flex bg-slate-100 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
            <button
              onClick={() => setViewMode('MESE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'MESE'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Vista Griglia Mensile"
            >
              <LayoutGrid size={14} />
              <span>Mese</span>
            </button>

            <button
              onClick={() => setViewMode('SETTIMANA')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'SETTIMANA'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Vista Settimanale a Colonne"
            >
              <Columns3 size={14} />
              <span>Settimana</span>
            </button>

            <button
              onClick={() => setViewMode('AGENDA')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'AGENDA'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Vista Agenda e Timeline"
            >
              <ListFilter size={14} />
              <span>Agenda</span>
            </button>
          </div>

          {/* Toggle Saldo Giornaliero nelle celle */}
          {viewMode === 'MESE' && (
            <button
              onClick={() => setShowDailyBalance(prev => !prev)}
              className={`px-3 py-2 rounded-2xl text-xs font-semibold flex items-center gap-1.5 border transition-all shadow-xs ${
                showDailyBalance
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/60 ring-1 ring-indigo-500/20'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
              }`}
              title="Mostra/Nascondi saldo cumulativo giorno per giorno nelle celle"
            >
              <Wallet size={14} className={showDailyBalance ? 'text-indigo-600 dark:text-indigo-400' : ''} />
              <span className="hidden sm:inline">Saldo Giornaliero</span>
            </button>
          )}

          {/* Pulsante Prospetto Saldo Fine Mese */}
          <button
            onClick={() => setShowBalanceTimelineModal(true)}
            className="px-3 py-2 rounded-2xl text-xs font-semibold flex items-center gap-1.5 border bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all shadow-xs"
            title="Visualizza la tabella con l'evoluzione del saldo giorno per giorno fino a fine mese"
          >
            <LineChart size={14} className="text-indigo-600 dark:text-indigo-400" />
            <span className="hidden md:inline">Prospetto Saldi Mese</span>
          </button>

          {/* Toggle Heatmap (Attivo solo in vista Mese) */}
          {viewMode === 'MESE' && (
            <button
              onClick={() => setShowHeatmap(prev => !prev)}
              className={`px-3 py-2 rounded-2xl text-xs font-semibold flex items-center gap-1.5 border transition-all shadow-xs ${
                showHeatmap
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60 ring-1 ring-rose-500/20'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
              }`}
              title="Attiva/Disattiva mappa termica intensità delle uscite"
            >
              <Flame size={14} className={showHeatmap ? 'text-rose-600 dark:text-rose-400 animate-pulse' : ''} />
              <span className="hidden sm:inline">Mappa Spese</span>
            </button>
          )}

          {/* Navigazione Oggi + Frecce */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleGoToday}
              className="px-3 py-2 rounded-2xl text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs active:scale-95"
            >
              Oggi
            </button>
            <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <button
                onClick={handlePrev}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all active:scale-90"
                title={viewMode === 'SETTIMANA' ? 'Settimana precedente' : 'Mese precedente'}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all active:scale-90"
                title={viewMode === 'SETTIMANA' ? 'Settimana successiva' : 'Mese successivo'}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TOP KPI SUMMARY BAR DEL MESE (One UI Squircles) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card Entrate */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-3.5 sm:p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
              Entrate {capitalizedTitle}
            </span>
            <span className="text-base sm:text-lg font-bold font-numeric text-emerald-600 dark:text-emerald-400 tabular-nums">
              +{formatCurrency(monthStats.totalEntrate, { hideSymbol: false })}
            </span>
          </div>
          <div className="w-9 h-9 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={18} />
          </div>
        </div>

        {/* Card Uscite */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-3.5 sm:p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
              Uscite {capitalizedTitle}
            </span>
            <span className="text-base sm:text-lg font-bold font-numeric text-rose-600 dark:text-rose-400 tabular-nums">
              -{formatCurrency(monthStats.totalUscite, { hideSymbol: false })}
            </span>
          </div>
          <div className="w-9 h-9 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
            <TrendingDown size={18} />
          </div>
        </div>

        {/* Card Saldo Netto */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-3.5 sm:p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
              Flusso Netto Mese
            </span>
            <span className={`text-base sm:text-lg font-bold font-numeric tabular-nums ${
              monthStats.saldoNetto >= 0 
                ? 'text-indigo-600 dark:text-indigo-400' 
                : 'text-amber-600 dark:text-amber-400'
            }`}>
              {formatCurrency(monthStats.saldoNetto, { showSign: true })}
            </span>
          </div>
          <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
            <Flame size={18} />
          </div>
        </div>

        {/* Card Saldo a Fine Mese (Proiettato Giorno per Giorno) */}
        <div 
          onClick={() => setShowBalanceTimelineModal(true)}
          className="bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 rounded-3xl p-3.5 sm:p-4 shadow-xs flex items-center justify-between cursor-pointer hover:border-indigo-400 transition-all group"
          title="Clicca per visualizzare la proiezione giorno per giorno del saldo"
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300 block uppercase tracking-wider">
                Saldo Fine Mese
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-indigo-200 dark:bg-indigo-800 text-indigo-900 dark:text-indigo-100 font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                Prospetto →
              </span>
            </div>
            <span className={`text-base sm:text-lg font-bold font-numeric tabular-nums ${
              monthEndBalance >= 0 ? 'text-indigo-950 dark:text-indigo-200' : 'text-rose-600 dark:text-rose-400'
            }`}>
              {formatCurrency(monthEndBalance)}
            </span>
          </div>
          <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs group-hover:scale-105 transition-transform">
            <Wallet size={18} />
          </div>
        </div>

        {/* Card Impegni & Scadenze */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-3.5 sm:p-4 shadow-xs flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
              Pianificati / Scad.
            </span>
            <span className="text-base sm:text-lg font-bold font-numeric text-purple-600 dark:text-purple-400 tabular-nums">
              {monthStats.plannedCount + monthStats.deadlinesCount} voci ({formatCurrency(monthStats.plannedPendingTotal + monthStats.deadlinesTotal)})
            </span>
          </div>
          <div className="w-9 h-9 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
            <Clock size={18} />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISTA 1: MESE (Griglia con Heatmap Spese + Master-Detail a Destra)        */}
      {/* ========================================================================= */}
      {viewMode === 'MESE' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Griglia Mensile Widescreen */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm">
            {/* Header Giorni della Settimana */}
            <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-400 mb-2.5">
              <div>Lun</div>
              <div>Mar</div>
              <div>Mer</div>
              <div>Gio</div>
              <div>Ven</div>
              <div className="text-indigo-500 font-bold">Sab</div>
              <div className="text-indigo-500 font-bold">Dom</div>
            </div>

            {/* Matrice dei Giorni */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {monthDaysMatrix.map(day => {
                const dayMovs = movements.filter(m => m.data === day.dateStr);
                const dayPlans = planned.filter(p => p.data_prevista === day.dateStr && p.stato === 'PENDENTE');
                const dayDeads = deadlines.filter(d => d.data_scadenza === day.dateStr);

                const hasEntrate = dayMovs.some(m => m.tipologia === 'ENTRATA');
                const hasUscite = dayMovs.some(m => m.tipologia === 'USCITA');
                const hasPlanned = dayPlans.length > 0;
                const hasDeadlines = dayDeads.length > 0;

                const isSelected = day.dateStr === selectedDayStr;
                const isToday = day.dateStr === todayStr;
                const isFuture = day.dateStr > todayStr && day.isCurrentMonth;
                const isPast = day.dateStr < todayStr && day.isCurrentMonth;

                const expensesSum = dayMovs
                  .filter(m => m.tipologia === 'USCITA')
                  .reduce((s, m) => s + m.importo, 0);

                const incomeSum = dayMovs
                  .filter(m => m.tipologia === 'ENTRATA')
                  .reduce((s, m) => s + m.importo, 0);

                // Calcolo intensità Heatmap (solo su giorni passati o odierni con spese reali)
                const intensityRatio = Math.min(expensesSum / (monthStats.maxDailyExpense || 1), 1);
                const heatmapBg = showHeatmap && expensesSum > 0 && day.isCurrentMonth
                  ? {
                      backgroundColor: `rgba(227, 27, 35, ${Math.max(0.04, intensityRatio * 0.18)})`
                    }
                  : undefined;

                // Ordinamento rigoroso micro-items cella: 1. Entrate, 2. Spese Essenziali, 3. Spese Extra, 4. Giroconti (tutti decrescenti per importo)
                const cellEnts = dayMovs.filter(m => m.tipologia === 'ENTRATA').sort((a, b) => b.importo - a.importo);
                const cellEss = dayMovs.filter(m => {
                  if (m.tipologia !== 'USCITA') return false;
                  const sub = subcategories.find(s => s.id === m.sottocategoria_id);
                  const macro = sub?.classificazione || getSubcategoryClassification(sub);
                  return macro === 'SPESE_ESSENZIALI';
                }).sort((a, b) => b.importo - a.importo);
                const cellExt = dayMovs.filter(m => {
                  if (m.tipologia !== 'USCITA') return false;
                  const sub = subcategories.find(s => s.id === m.sottocategoria_id);
                  const macro = sub?.classificazione || getSubcategoryClassification(sub);
                  return macro === 'SPESE_EXTRA';
                }).sort((a, b) => b.importo - a.importo);
                const cellGiro = dayMovs.filter(m => m.tipologia === 'GIROCONTO').sort((a, b) => b.importo - a.importo);

                const sortedCellMovs = [...cellEnts, ...cellEss, ...cellExt, ...cellGiro];
                const topItems = sortedCellMovs.slice(0, 2);

                const hasEssenziali = cellEss.length > 0;
                const hasExtra = cellExt.length > 0;

                return (
                  <button
                    key={day.dateStr}
                    onClick={() => setSelectedDayStr(day.dateStr)}
                    style={heatmapBg}
                    className={`w-full h-[106px] sm:h-[116px] min-h-[106px] sm:min-h-[116px] max-h-[106px] sm:max-h-[116px] p-1.5 sm:p-2 rounded-2xl flex flex-col justify-between text-left transition-all border group relative active:scale-95 cursor-pointer overflow-hidden ${
                      isSelected
                        ? 'bg-indigo-50/90 dark:bg-indigo-950/70 border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/30 shadow-sm z-10'
                        : isToday
                        ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50/25 dark:bg-indigo-950/30 ring-1 ring-indigo-500/20 shadow-xs'
                        : isFuture
                        ? 'border-dashed border-slate-200/90 dark:border-slate-800/80 bg-slate-50/30 dark:bg-[#161618]/40 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/60'
                        : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#1C1C1E] hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                    } ${!day.isCurrentMonth ? 'opacity-25 pointer-events-none' : ''}`}
                    title={`Visualizza ${formatDateIT(day.dateStr)} ${isFuture ? '(Giorno Futuro / Proiezione)' : ''}`}
                  >
                    {/* Intestazione Cella: Numero Giorno + Indicatori di Stato */}
                    <div className="flex items-center justify-between w-full h-5 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full ${
                            isToday
                              ? 'bg-indigo-600 text-white font-bold shadow-xs'
                              : isSelected
                              ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                              : isFuture
                              ? 'text-slate-400 dark:text-slate-500 font-normal'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {day.dayNum}
                        </span>
                        {isFuture && (
                          <span className="hidden xl:inline-block text-[8px] text-slate-400/80 font-normal">
                            futuro
                          </span>
                        )}
                      </div>

                      {/* Indicator Dots con distinzione colore */}
                      <div className="flex items-center gap-1">
                        <div className={`flex items-center gap-0.5 ${isFuture ? 'opacity-70' : 'opacity-100'}`}>
                          {hasEntrate && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Entrate" />}
                          {hasEssenziali && <span className="w-1.5 h-1.5 rounded-full bg-red-800 dark:bg-red-500" title="Spese Essenziali (Rosso Scuro)" />}
                          {hasExtra && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" title="Spese Extra (Arancione)" />}
                          {!hasEssenziali && !hasExtra && hasUscite && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" title="Spese" />}
                          {hasPlanned && <span className="w-1.5 h-1.5 rounded-full bg-purple-600" title="Pianificate" />}
                          {hasDeadlines && <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 dark:bg-neutral-100" title="Scadenze" />}
                        </div>

                        {/* Pulsante rapido + in cella */}
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDayStr(day.dateStr);
                            onAddOnDate(day.dateStr);
                          }}
                          className="w-4 h-4 rounded flex items-center justify-center text-slate-300 dark:text-slate-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:bg-indigo-100/80 dark:group-hover:bg-indigo-950/80 transition-all"
                          title="Aggiungi movimento in questa data"
                        >
                          <Plus size={11} />
                        </span>
                      </div>
                    </div>

                    {/* Micro Tag Movimenti Ordinati (Altezza Fissa Controllata per Evitare Distorsioni) */}
                    <div className="hidden sm:flex flex-col gap-0.5 w-full h-[32px] sm:h-[34px] my-auto overflow-hidden">
                      {topItems.map(m => {
                        const sub = subcategories.find(s => s.id === m.sottocategoria_id);
                        const macro = sub?.classificazione || getSubcategoryClassification(sub);
                        const isEssenziale = m.tipologia === 'USCITA' && macro === 'SPESE_ESSENZIALI';
                        const isExtra = m.tipologia === 'USCITA' && macro === 'SPESE_EXTRA';

                        return (
                          <div
                            key={m.id}
                            className={`text-[8.5px] truncate px-1 py-0.5 rounded-md flex items-center gap-1 font-medium ${
                              isFuture ? 'opacity-85' : 'opacity-100'
                            } ${
                              m.tipologia === 'ENTRATA'
                                ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/50'
                                : m.tipologia === 'GIROCONTO'
                                ? 'text-slate-600 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-800/60'
                                : isEssenziale
                                ? 'text-red-900 dark:text-red-200 bg-red-100/80 dark:bg-red-950/60 font-semibold'
                                : 'text-orange-900 dark:text-orange-200 bg-orange-100/80 dark:bg-orange-950/60 font-semibold'
                            }`}
                          >
                            <span className="truncate">{m.descrizione || sub?.nome}</span>
                          </div>
                        );
                      })}
                      {dayMovs.length > 2 && (
                        <span className="text-[7.5px] text-slate-400 font-semibold pl-0.5 leading-none">
                          +{dayMovs.length - 2} altri
                        </span>
                      )}
                      {topItems.length === 0 && isFuture && dayPlans.length > 0 && (
                        <div className="text-[8.5px] truncate px-1 py-0.5 rounded-md text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200/50 dark:border-purple-900/40 font-medium">
                          <span className="truncate">Prev: {dayPlans[0].descrizione}</span>
                        </div>
                      )}
                    </div>

                    {/* Totale giornaliero o flusso + Saldo Fine Giorno (Altezza Fissa Protetta) */}
                    <div className="flex flex-col gap-0.5 w-full text-[10px] font-numeric pt-0.5 mt-auto flex-shrink-0">
                      <div className="flex items-center justify-between w-full h-[14px]">
                        {expensesSum > 0 ? (
                          <span className={`font-semibold whitespace-nowrap ml-auto tabular-nums text-[9px] ${
                            isFuture ? 'text-rose-500/80 dark:text-rose-400/80' : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            -{formatItalianNumber(Math.round(expensesSum), { maximumFractionDigits: 0 })} €
                          </span>
                        ) : incomeSum > 0 ? (
                          <span className={`font-semibold whitespace-nowrap ml-auto tabular-nums text-[9px] ${
                            isFuture ? 'text-emerald-500/80 dark:text-emerald-400/80' : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            +{formatItalianNumber(Math.round(incomeSum), { maximumFractionDigits: 0 })} €
                          </span>
                        ) : (
                          <span className="text-[8.5px] text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                            -
                          </span>
                        )}
                      </div>

                      {/* Badge Saldo Progressivo a Fine Giorno */}
                      {showDailyBalance && (
                        <div 
                          className={`flex items-center justify-between w-full px-1.5 py-0.5 rounded-lg text-[8.5px] font-semibold transition-all border ${
                            day.dateStr === todayStr
                              ? 'bg-indigo-100/95 dark:bg-indigo-950/90 text-indigo-900 dark:text-indigo-200 border-indigo-300 dark:border-indigo-800'
                              : isFuture
                              ? 'bg-indigo-50/30 dark:bg-indigo-950/20 text-indigo-700/80 dark:text-indigo-300/80 border-dashed border-indigo-200/60 dark:border-indigo-900/40'
                              : (dailyBalancesMap[day.dateStr]?.balance ?? 0) >= 0
                              ? 'bg-slate-100/90 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-slate-200/80 dark:border-slate-700/80'
                              : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/40'
                          }`}
                          title={`Saldo a fine giorno ${formatDateIT(day.dateStr)}: ${formatCurrency(dailyBalancesMap[day.dateStr]?.balance ?? 0)} ${isFuture ? '(Proiezione futura)' : ''}`}
                        >
                          <span className="text-[7.5px] text-slate-400 dark:text-slate-500 font-medium truncate">
                            {isFuture ? '~Prev.' : 'Saldo'}
                          </span>
                          <span className="tabular-nums font-bold ml-auto">
                            {formatItalianNumber(Math.round(dailyBalancesMap[day.dateStr]?.balance ?? 0), { maximumFractionDigits: 0 })} €
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Legenda Colori */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Entrate</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-800 dark:bg-red-500" />
                  <span>Essenziali</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  <span>Extra</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                  <span>Pianificate</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-2.5 rounded-md border border-dashed border-slate-400 dark:border-slate-500 bg-slate-100/50 dark:bg-slate-800/40" />
                  <span>Futuro (Proiezione)</span>
                </div>
              </div>

              {showHeatmap && (
                <div className="flex items-center gap-2 text-[10px] text-slate-400 bg-rose-50/50 dark:bg-rose-950/30 px-2.5 py-1 rounded-xl border border-rose-100 dark:border-rose-900/40">
                  <Flame size={12} className="text-rose-500" />
                  <span>Intensità rosso = spesa consolidata</span>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* Master-Detail Inspector: Dettaglio Giorno con Ordinamento e Suddivisione  */}
          {/* ========================================================================= */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              {/* Header Giorno Selezionato con Navigatore Freccia */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Dettaglio Giornaliero
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold font-numeric">
                      {formatDateIT(selectedDayStr)}
                    </span>
                    {selectedDayStr === todayStr && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold">
                        Oggi
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleStepDay(-1)}
                    className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                    title="Giorno precedente"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => handleStepDay(1)}
                    className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                    title="Giorno successivo"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button
                    onClick={() => onAddOnDate(selectedDayStr)}
                    className="ml-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs active:scale-95"
                  >
                    <Plus size={14} />
                    <span>Aggiungi</span>
                  </button>
                </div>
              </div>

              {/* Card Saldo a Fine Giornata (Con Proiezione e Link al Prospetto) */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-900/60 shadow-xs flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] text-indigo-300 font-medium">
                    <Wallet size={13} className="text-indigo-400" />
                    <span>Saldo a Fine Giornata</span>
                    {selectedDayStr > todayStr ? (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
                        Proiezione
                      </span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                        Consolidato
                      </span>
                    )}
                  </div>
                  <div className="text-base sm:text-lg font-bold font-numeric text-white mt-0.5 tabular-nums">
                    {formatCurrency(dailyBalancesMap[selectedDayStr]?.balance ?? 0)}
                  </div>
                </div>

                <button
                  onClick={() => setShowBalanceTimelineModal(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-indigo-200 hover:text-white flex items-center gap-1 transition-all border border-white/10"
                  title="Apri l'evoluzione giorno per giorno fino a fine mese"
                >
                  <LineChart size={13} />
                  <span>Prospetto</span>
                </button>
              </div>

              {/* Totali Giornalieri Entrate / Uscite Essenziali / Extra / Netto */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                  <span className="text-[9px] text-slate-400 block uppercase font-bold">Entrate</span>
                  <span className="font-numeric font-bold text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm tabular-nums">
                    +{formatCurrency(dayTotalEntrate, { hideSymbol: true })}
                  </span>
                </div>
                <div className="p-2.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40">
                  <span className="text-[9px] text-slate-400 block uppercase font-bold">Uscite Totali</span>
                  <span className="font-numeric font-bold text-rose-600 dark:text-rose-400 text-xs sm:text-sm tabular-nums">
                    -{formatCurrency(dayTotalUscite, { hideSymbol: true })}
                  </span>
                </div>
                <div className="p-2.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                  <span className="text-[9px] text-slate-400 block uppercase font-bold">Netto Giorno</span>
                  <span className={`font-numeric font-bold text-xs sm:text-sm tabular-nums ${
                    dayNet >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {formatCurrency(dayNet, { showSign: true, hideSymbol: true })}
                  </span>
                </div>
              </div>

              {/* Filtri Rapidi nel pannello di destra */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] no-scrollbar">
                <button
                  onClick={() => setInspectorFilter('ALL')}
                  className={`px-2.5 py-1 rounded-full font-semibold whitespace-nowrap transition-all ${
                    inspectorFilter === 'ALL'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Tutti ({dayMovements.length + dayPlanned.length + dayDeadlines.length})
                </button>
                {dayEntrate.length > 0 && (
                  <button
                    onClick={() => setInspectorFilter('ENTRATE')}
                    className={`px-2.5 py-1 rounded-full font-semibold whitespace-nowrap transition-all ${
                      inspectorFilter === 'ENTRATE'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    Entrate ({dayEntrate.length})
                  </button>
                )}
                {dayUsciteEssenziali.length > 0 && (
                  <button
                    onClick={() => setInspectorFilter('ESSENZIALI')}
                    className={`px-2.5 py-1 rounded-full font-semibold whitespace-nowrap transition-all ${
                      inspectorFilter === 'ESSENZIALI'
                        ? 'bg-red-900 dark:bg-red-800 text-white shadow-xs'
                        : 'bg-red-50 dark:bg-red-950/60 text-red-900 dark:text-red-300 border border-red-200/60 dark:border-red-900/40'
                    }`}
                  >
                    Essenziali ({dayUsciteEssenziali.length})
                  </button>
                )}
                {dayUsciteExtra.length > 0 && (
                  <button
                    onClick={() => setInspectorFilter('EXTRA')}
                    className={`px-2.5 py-1 rounded-full font-semibold whitespace-nowrap transition-all ${
                      inspectorFilter === 'EXTRA'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'bg-orange-50 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border border-orange-200/60 dark:border-orange-900/40'
                    }`}
                  >
                    Extra ({dayUsciteExtra.length})
                  </button>
                )}
                {dayGiroconti.length > 0 && (
                  <button
                    onClick={() => setInspectorFilter('GIROCONTI')}
                    className={`px-2.5 py-1 rounded-full font-semibold whitespace-nowrap transition-all ${
                      inspectorFilter === 'GIROCONTI'
                        ? 'bg-slate-700 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Trasferimenti ({dayGiroconti.length})
                  </button>
                )}
                {dayPlanned.length > 0 && (
                  <button
                    onClick={() => setInspectorFilter('PIANIFICATI')}
                    className={`px-2.5 py-1 rounded-full font-semibold whitespace-nowrap transition-all ${
                      inspectorFilter === 'PIANIFICATI'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                    }`}
                  >
                    Pianificati ({dayPlanned.length})
                  </button>
                )}
              </div>

              {/* Lista Dettagliata delle Transazioni del Giorno: 1. Entrate, 2. Spese Essenziali, 3. Spese Extra, 4. Trasferimenti */}
              <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
                {/* 1. SEZIONE ENTRATE (Ordinate dal più grande al più piccolo) */}
                {(inspectorFilter === 'ALL' || inspectorFilter === 'ENTRATE') && dayEntrate.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>1. Entrate Realizzate ({dayEntrate.length})</span>
                      </div>
                      <span className="font-numeric font-semibold">+{formatCurrency(dayTotalEntrate)}</span>
                    </div>
                    {dayEntrate.map(m => {
                      const sub = subcategories.find(s => s.id === m.sottocategoria_id);
                      const amt = getAmountDisplay(m.importo, 'ENTRATA');
                      return (
                        <div
                          key={m.id}
                          onClick={() => onSelectMovement(m)}
                          className="p-2.5 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 hover:border-emerald-300 cursor-pointer flex items-center justify-between gap-2 transition-all shadow-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
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

                {/* 2. SEZIONE SPESE ESSENZIALI (Rosso Scuro - Ordinate dal più grande al più piccolo) */}
                {(inspectorFilter === 'ALL' || inspectorFilter === 'ESSENZIALI') && dayUsciteEssenziali.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-red-900 dark:text-red-400 uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck size={13} className="text-red-900 dark:text-red-400" />
                        <span>2. Spese Essenziali ({dayUsciteEssenziali.length})</span>
                      </div>
                      <span className="font-numeric font-semibold text-red-900 dark:text-red-400">-{formatCurrency(dayTotalEssenziali)}</span>
                    </div>
                    {dayUsciteEssenziali.map(m => {
                      const sub = subcategories.find(s => s.id === m.sottocategoria_id);
                      return (
                        <div
                          key={m.id}
                          onClick={() => onSelectMovement(m)}
                          className="p-2.5 rounded-2xl bg-red-50/50 dark:bg-red-950/25 border border-red-200/80 dark:border-red-900/50 hover:border-red-400 cursor-pointer flex items-center justify-between gap-2 transition-all shadow-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <CategoryIcon name={sub?.icon_name} color="#991B1B" tipo="USCITA" size={15} />
                            <div className="min-w-0">
                              <span className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate block">
                                {m.descrizione}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate block">
                                {sub?.nome || 'Spesa Essenziale'} • {sub?.categoria_padre}
                              </span>
                            </div>
                          </div>
                          <span className="font-numeric text-xs font-bold whitespace-nowrap text-red-900 dark:text-red-300 tabular-nums">
                            -{formatCurrency(m.importo)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 3. SEZIONE SPESE EXTRA (Arancione Leggibile - Ordinate dal più grande al più piccolo) */}
                {(inspectorFilter === 'ALL' || inspectorFilter === 'EXTRA') && dayUsciteExtra.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <Sparkles size={13} className="text-orange-600 dark:text-orange-400" />
                        <span>3. Spese Extra ({dayUsciteExtra.length})</span>
                      </div>
                      <span className="font-numeric font-semibold text-orange-600 dark:text-orange-400">-{formatCurrency(dayTotalExtra)}</span>
                    </div>
                    {dayUsciteExtra.map(m => {
                      const sub = subcategories.find(s => s.id === m.sottocategoria_id);
                      return (
                        <div
                          key={m.id}
                          onClick={() => onSelectMovement(m)}
                          className="p-2.5 rounded-2xl bg-orange-50/40 dark:bg-orange-950/20 border border-orange-200/70 dark:border-orange-900/40 hover:border-orange-400 cursor-pointer flex items-center justify-between gap-2 transition-all shadow-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <CategoryIcon name={sub?.icon_name} color="#EA580C" tipo="USCITA" size={15} />
                            <div className="min-w-0">
                              <span className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate block">
                                {m.descrizione}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate block">
                                {sub?.nome || 'Spesa Extra'} • {sub?.categoria_padre}
                              </span>
                            </div>
                          </div>
                          <span className="font-numeric text-xs font-bold whitespace-nowrap text-orange-600 dark:text-orange-400 tabular-nums">
                            -{formatCurrency(m.importo)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 4. SEZIONE TRASFERIMENTI / GIROCONTI (Ordinati dal più grande al più piccolo) */}
                {(inspectorFilter === 'ALL' || inspectorFilter === 'GIROCONTI') && dayGiroconti.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                        <span>4. Trasferimenti / Giroconti ({dayGiroconti.length})</span>
                      </div>
                      <span className="font-numeric font-semibold">{formatCurrency(dayTotalGiroconti)}</span>
                    </div>
                    {dayGiroconti.map(m => {
                      const amt = getAmountDisplay(m.importo, 'GIROCONTO');
                      return (
                        <div
                          key={m.id}
                          onClick={() => onSelectMovement(m)}
                          className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 hover:border-slate-400 cursor-pointer flex items-center justify-between gap-2 transition-all shadow-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
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

                {/* 5. PIANIFICATI (Ordinati per importo decrescente) */}
                {(inspectorFilter === 'ALL' || inspectorFilter === 'PIANIFICATI') && dayPlanned.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                      Pianificate Pendenti ({dayPlanned.length})
                    </div>
                    {dayPlanned.map(p => (
                      <div
                        key={p.id}
                        className="p-2.5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/60 flex items-center justify-between gap-2"
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

                {/* 6. SCADENZE (Ordinate per importo decrescente) */}
                {(inspectorFilter === 'ALL' || inspectorFilter === 'SCADENZE') && dayDeadlines.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
                      Scadenze Imminenti ({dayDeadlines.length})
                    </div>
                    {dayDeadlines.map(d => (
                      <div
                        key={d.id}
                        className="p-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 flex items-center justify-between gap-2"
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
                  <div className="text-center py-10 text-xs text-slate-400">
                    Nessuna transazione o scadenza in questo giorno.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: SETTIMANA (7 Colonne Verticali ad Altezza Estesa)               */}
      {/* ========================================================================= */}
      {viewMode === 'SETTIMANA' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {currentWeekDays.map(colDay => {
              const colMovs = movements.filter(m => m.data === colDay.dateStr);
              const colPlans = planned.filter(p => p.data_prevista === colDay.dateStr && p.stato === 'PENDENTE').sort((a, b) => b.importo - a.importo);
              const colDeads = deadlines.filter(d => d.data_scadenza === colDay.dateStr).sort((a, b) => (b.importo_previsto || 0) - (a.importo_previsto || 0));

              const colEntrate = colMovs.filter(m => m.tipologia === 'ENTRATA').sort((a, b) => b.importo - a.importo);
              
              const colEssenziali = colMovs.filter(m => {
                if (m.tipologia !== 'USCITA') return false;
                const sub = subcategories.find(s => s.id === m.sottocategoria_id);
                const macro = sub?.classificazione || getSubcategoryClassification(sub);
                return macro === 'SPESE_ESSENZIALI';
              }).sort((a, b) => b.importo - a.importo);

              const colExtra = colMovs.filter(m => {
                if (m.tipologia !== 'USCITA') return false;
                const sub = subcategories.find(s => s.id === m.sottocategoria_id);
                const macro = sub?.classificazione || getSubcategoryClassification(sub);
                return macro === 'SPESE_EXTRA';
              }).sort((a, b) => b.importo - a.importo);

              const colGiroconti = colMovs.filter(m => m.tipologia === 'GIROCONTO').sort((a, b) => b.importo - a.importo);

              const sumEntrate = colEntrate.reduce((s, m) => s + m.importo, 0);
              const sumUscite = colEssenziali.reduce((s, m) => s + m.importo, 0) + colExtra.reduce((s, m) => s + m.importo, 0);
              const netDay = sumEntrate - sumUscite;

              const isColSelected = colDay.dateStr === selectedDayStr;

              return (
                <div
                  key={colDay.dateStr}
                  onClick={() => setSelectedDayStr(colDay.dateStr)}
                  className={`flex flex-col justify-between rounded-2xl p-3 border transition-all ${
                    isColSelected
                      ? 'bg-indigo-50/40 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-500/20'
                      : colDay.isToday
                      ? 'bg-slate-50 dark:bg-slate-850 border-indigo-300 dark:border-indigo-700'
                      : 'bg-slate-50/60 dark:bg-slate-850/60 border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  {/* Intestazione Colonna Giorno */}
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          {colDay.dayName}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-base font-bold font-numeric ${colDay.isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>
                            {colDay.dayNum}
                          </span>
                          {colDay.isToday && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-indigo-600 text-white font-bold">
                              Oggi
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDayStr(colDay.dateStr);
                          onAddOnDate(colDay.dateStr);
                        }}
                        className="p-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-slate-600 hover:text-indigo-600 dark:text-slate-300 transition-all shadow-xs"
                        title="Aggiungi movimento"
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    {/* Bilancio Giorno */}
                    <div className="my-2 p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] font-numeric font-semibold">
                      <span className="text-emerald-600 dark:text-emerald-400">+{formatItalianNumber(Math.round(sumEntrate), { maximumFractionDigits: 0 })} €</span>
                      <span className="text-rose-600 dark:text-rose-400">-{formatItalianNumber(Math.round(sumUscite), { maximumFractionDigits: 0 })} €</span>
                    </div>

                    {/* Cards Lista Movimenti Ordinati */}
                    <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-0.5">
                      {/* Entrate */}
                      {colEntrate.map(m => (
                        <div
                          key={m.id}
                          onClick={() => onSelectMovement(m)}
                          className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/60 cursor-pointer hover:scale-[1.02] transition-transform"
                        >
                          <div className="text-[11px] font-medium text-slate-900 dark:text-slate-100 truncate">
                            {m.descrizione}
                          </div>
                          <div className="text-[10px] font-bold font-numeric text-emerald-600 dark:text-emerald-400">
                            +{formatCurrency(m.importo)}
                          </div>
                        </div>
                      ))}

                      {/* Spese Essenziali (Rosso Scuro) */}
                      {colEssenziali.map(m => (
                        <div
                          key={m.id}
                          onClick={() => onSelectMovement(m)}
                          className="p-2 rounded-xl bg-red-50/60 dark:bg-red-950/30 border border-red-200/80 dark:border-red-900/60 cursor-pointer hover:border-red-400 transition-all"
                        >
                          <div className="text-[11px] font-medium text-slate-900 dark:text-slate-100 truncate">
                            {m.descrizione}
                          </div>
                          <div className="text-[10px] font-bold font-numeric text-red-900 dark:text-red-300 flex items-center justify-between">
                            <span>-{formatCurrency(m.importo)}</span>
                            <span className="text-[9px] text-red-800 dark:text-red-400 font-normal">Essenziale</span>
                          </div>
                        </div>
                      ))}

                      {/* Spese Extra (Arancione Leggibile) */}
                      {colExtra.map(m => (
                        <div
                          key={m.id}
                          onClick={() => onSelectMovement(m)}
                          className="p-2 rounded-xl bg-orange-50/60 dark:bg-orange-950/30 border border-orange-200/80 dark:border-orange-900/60 cursor-pointer hover:border-orange-400 transition-all"
                        >
                          <div className="text-[11px] font-medium text-slate-900 dark:text-slate-100 truncate">
                            {m.descrizione}
                          </div>
                          <div className="text-[10px] font-bold font-numeric text-orange-600 dark:text-orange-400 flex items-center justify-between">
                            <span>-{formatCurrency(m.importo)}</span>
                            <span className="text-[9px] text-orange-600 dark:text-orange-400 font-normal">Extra</span>
                          </div>
                        </div>
                      ))}

                      {/* Giroconti */}
                      {colGiroconti.map(m => (
                        <div
                          key={m.id}
                          onClick={() => onSelectMovement(m)}
                          className="p-2 rounded-xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer"
                        >
                          <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">
                            {m.descrizione}
                          </div>
                          <div className="text-[10px] font-bold font-numeric text-slate-500 dark:text-slate-400">
                            ⇄ {formatCurrency(m.importo)}
                          </div>
                        </div>
                      ))}

                      {/* Pianificate */}
                      {colPlans.map(p => (
                        <div
                          key={p.id}
                          className="p-2 rounded-xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/80 text-[10px]"
                        >
                          <div className="font-medium text-purple-950 dark:text-purple-200 truncate">
                            🕒 {p.descrizione}
                          </div>
                          <div className="font-bold font-numeric text-purple-700 dark:text-purple-300">
                            {formatCurrency(p.importo)}
                          </div>
                        </div>
                      ))}

                      {/* Scadenze */}
                      {colDeads.map(d => (
                        <div
                          key={d.id}
                          className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-[10px]"
                        >
                          <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                            ⚠️ {d.descrizione}
                          </div>
                          <div className="font-bold font-numeric text-neutral-800 dark:text-neutral-200">
                            {formatCurrency(d.importo_previsto)}
                          </div>
                        </div>
                      ))}

                      {colMovs.length === 0 && colPlans.length === 0 && colDeads.length === 0 && (
                        <div className="text-center py-10 text-[11px] text-slate-400">
                          Nessuna voce
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Netto Giornaliero e Saldo Footer Colonna */}
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 space-y-1 text-[11px] font-numeric">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Netto:</span>
                      <span className={`font-bold tabular-nums ${netDay >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {formatCurrency(netDay, { showSign: true })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className="text-slate-400">Saldo:</span>
                      <span className="font-bold tabular-nums text-indigo-900 dark:text-indigo-200">
                        {formatCurrency(dailyBalancesMap[colDay.dateStr]?.balance ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 3: AGENDA (Timeline Cronologica Continua con Essenziali / Extra)     */}
      {/* ========================================================================= */}
      {viewMode === 'AGENDA' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
          {/* Barra Filtri Agenda */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Filtra Timeline:
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                onClick={() => setAgendaFilter('ALL')}
                className={`px-3 py-1.5 rounded-full font-semibold transition-all ${
                  agendaFilter === 'ALL'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                Tutti i Giorni Attivi
              </button>
              <button
                onClick={() => setAgendaFilter('ENTRATE')}
                className={`px-3 py-1.5 rounded-full font-semibold transition-all ${
                  agendaFilter === 'ENTRATE'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                Solo Entrate
              </button>
              <button
                onClick={() => setAgendaFilter('ESSENZIALI')}
                className={`px-3 py-1.5 rounded-full font-semibold transition-all ${
                  agendaFilter === 'ESSENZIALI'
                    ? 'bg-red-900 dark:bg-red-800 text-white shadow-xs'
                    : 'bg-red-50 dark:bg-red-950/60 text-red-900 dark:text-red-300'
                }`}
              >
                Solo Essenziali
              </button>
              <button
                onClick={() => setAgendaFilter('EXTRA')}
                className={`px-3 py-1.5 rounded-full font-semibold transition-all ${
                  agendaFilter === 'EXTRA'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-orange-50 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300'
                }`}
              >
                Solo Extra
              </button>
              <button
                onClick={() => setAgendaFilter('PIANIFICATI')}
                className={`px-3 py-1.5 rounded-full font-semibold transition-all ${
                  agendaFilter === 'PIANIFICATI'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                }`}
              >
                Pianificati & Ricorrenti
              </button>
            </div>
          </div>

          {/* Lista Giorni Timeline Continua */}
          <div className="space-y-3">
            {agendaDays.map(item => (
              <div
                key={item.dateStr}
                onClick={() => setSelectedDayStr(item.dateStr)}
                className={`p-4 rounded-2xl border transition-all ${
                  item.isSelected
                    ? 'bg-indigo-50/50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-500/20'
                    : item.isToday
                    ? 'bg-slate-50 dark:bg-slate-850 border-indigo-300 dark:border-indigo-700'
                    : 'bg-white dark:bg-slate-850/40 border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                {/* Header Data Giorno con Saldo Netto */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800 gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold font-numeric ${item.isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>
                      {formatDateIT(item.dateStr)} ({new Intl.DateTimeFormat('it-IT', { weekday: 'long' }).format(item.dateObj)})
                    </span>
                    {item.isToday && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold">
                        Oggi
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs font-numeric font-semibold">
                    {item.sumEntrate > 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        +{formatCurrency(item.sumEntrate)}
                      </span>
                    )}
                    {item.sumUscite > 0 && (
                      <span className="text-rose-600 dark:text-rose-400">
                        -{formatCurrency(item.sumUscite)}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                      item.net >= 0 
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' 
                        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                    }`}>
                      Netto: {formatCurrency(item.net, { showSign: true })}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center gap-1">
                      <Wallet size={11} className="text-indigo-500" />
                      <span>Saldo fine giorno:</span>
                      <span className="tabular-nums font-bold">{formatCurrency(dailyBalancesMap[item.dateStr]?.balance ?? 0)}</span>
                    </span>
                  </div>
                </div>

                {/* Griglia elementi del giorno ordinati per importo */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {/* Entrate */}
                  {item.entrate.map(m => {
                    const sub = subcategories.find(s => s.id === m.sottocategoria_id);
                    return (
                      <div
                        key={m.id}
                        onClick={() => onSelectMovement(m)}
                        className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 hover:border-emerald-300 cursor-pointer flex items-center justify-between gap-2 shadow-xs transition-all"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CategoryIcon 
                            name={sub?.icon_name} 
                            color="#10B981" 
                            tipo="ENTRATA" 
                            size={16} 
                          />
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate block">
                              {m.descrizione}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate block">
                              {sub?.nome || 'Entrata'}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-bold font-numeric whitespace-nowrap text-emerald-600 dark:text-emerald-400">
                          +{formatCurrency(m.importo)}
                        </span>
                      </div>
                    );
                  })}

                  {/* Spese Essenziali (Rosso Scuro) */}
                  {item.essenziali.map(m => {
                    const sub = subcategories.find(s => s.id === m.sottocategoria_id);
                    return (
                      <div
                        key={m.id}
                        onClick={() => onSelectMovement(m)}
                        className="p-2.5 rounded-xl bg-red-50/50 dark:bg-red-950/25 border border-red-200/80 dark:border-red-900/50 hover:border-red-400 cursor-pointer flex items-center justify-between gap-2 shadow-xs transition-all"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CategoryIcon 
                            name={sub?.icon_name} 
                            color="#991B1B" 
                            tipo="USCITA" 
                            size={16} 
                          />
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate block">
                              {m.descrizione}
                            </span>
                            <span className="text-[10px] text-red-900/70 dark:text-red-400/80 truncate block">
                              {sub?.nome || 'Spesa Essenziale'}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-bold font-numeric whitespace-nowrap text-red-900 dark:text-red-300">
                          -{formatCurrency(m.importo)}
                        </span>
                      </div>
                    );
                  })}

                  {/* Spese Extra (Arancione Leggibile) */}
                  {item.extra.map(m => {
                    const sub = subcategories.find(s => s.id === m.sottocategoria_id);
                    return (
                      <div
                        key={m.id}
                        onClick={() => onSelectMovement(m)}
                        className="p-2.5 rounded-xl bg-orange-50/40 dark:bg-orange-950/20 border border-orange-200/70 dark:border-orange-900/40 hover:border-orange-400 cursor-pointer flex items-center justify-between gap-2 shadow-xs transition-all"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CategoryIcon 
                            name={sub?.icon_name} 
                            color="#EA580C" 
                            tipo="USCITA" 
                            size={16} 
                          />
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate block">
                              {m.descrizione}
                            </span>
                            <span className="text-[10px] text-orange-950/60 dark:text-orange-300/80 truncate block">
                              {sub?.nome || 'Spesa Extra'}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-bold font-numeric whitespace-nowrap text-orange-600 dark:text-orange-400">
                          -{formatCurrency(m.importo)}
                        </span>
                      </div>
                    );
                  })}

                  {/* Giroconti */}
                  {item.giroconti.map(m => (
                    <div
                      key={m.id}
                      onClick={() => onSelectMovement(m)}
                      className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center justify-between gap-2 shadow-xs transition-all"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CategoryIcon 
                          name="ArrowLeftRight" 
                          color="#64748B" 
                          tipo="GIROCONTO" 
                          isGiroconto={true}
                          size={16} 
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate block">
                            {m.descrizione}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate block">
                            Giroconto tra conti
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-bold font-numeric whitespace-nowrap text-slate-500">
                        ⇄ {formatCurrency(m.importo)}
                      </span>
                    </div>
                  ))}

                  {/* Pianificati */}
                  {item.plans.map(p => (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-purple-950 dark:text-purple-200 truncate block">
                          🕒 {p.descrizione}
                        </span>
                        <span className="text-[10px] text-purple-600 dark:text-purple-400 block">
                          Pianificato • {p.stato}
                        </span>
                      </div>
                      <span className="text-xs font-bold font-numeric text-purple-900 dark:text-purple-200 whitespace-nowrap">
                        {p.tipologia === 'ENTRATA' ? '+' : '-'} {formatCurrency(p.importo)}
                      </span>
                    </div>
                  ))}

                  {/* Scadenze */}
                  {item.deads.map(d => (
                    <div
                      key={d.id}
                      className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate block">
                          ⚠️ {d.descrizione}
                        </span>
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">
                          Scadenza • Priorità: {d.priorita}
                        </span>
                      </div>
                      <span className="text-xs font-bold font-numeric text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                        - {formatCurrency(d.importo_previsto)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {agendaDays.length === 0 && (
              <div className="text-center py-12 text-sm text-slate-400">
                Nessun movimento o impegno trovato per i filtri selezionati nel mese.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALE DI PROSPETTO: SALDO GIORNO PER GIORNO FINO A FINE MESE CORRENTE    */}
      {/* ========================================================================= */}
      {showBalanceTimelineModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
          <div className="max-w-4xl w-full bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header Modale */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                  <Wallet size={20} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                    Prospetto Saldo Giorno per Giorno
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Evoluzione dettagliata del patrimonio fino al termine di {capitalizedTitle}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowBalanceTimelineModal(false)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="Chiudi"
              >
                <X size={20} />
              </button>
            </div>

            {/* Top KPI Cards nel Modale */}
            <div className="p-4 sm:p-5 bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-white dark:bg-[#242426] border border-slate-200/60 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Inizio Mese (1°)
                </span>
                <span className="text-sm sm:text-base font-bold font-numeric text-slate-900 dark:text-slate-100 tabular-nums">
                  {formatCurrency(currentMonthDailyBalances[0]?.balance ?? 0)}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-white dark:bg-[#242426] border border-slate-200/60 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Saldo Odierno
                </span>
                <span className="text-sm sm:text-base font-bold font-numeric text-indigo-600 dark:text-indigo-400 tabular-nums">
                  {formatCurrency(todayBalance)}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/60 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-300 block tracking-wider">
                  Previsto a Fine Mese
                </span>
                <span className={`text-sm sm:text-base font-bold font-numeric tabular-nums ${
                  monthEndBalance >= 0 ? 'text-indigo-950 dark:text-indigo-200' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {formatCurrency(monthEndBalance)}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-white dark:bg-[#242426] border border-slate-200/60 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Flusso Netto Mese
                </span>
                <span className={`text-sm sm:text-base font-bold font-numeric tabular-nums ${
                  monthStats.saldoNetto >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                }`}>
                  {formatCurrency(monthStats.saldoNetto, { showSign: true })}
                </span>
              </div>
            </div>

            {/* Tabella Cronologica Giorno per Giorno */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                      <th className="py-2.5 px-3">Giorno</th>
                      <th className="py-2.5 px-3 text-right">Entrate</th>
                      <th className="py-2.5 px-3 text-right">Spese Essenziali</th>
                      <th className="py-2.5 px-3 text-right">Spese Extra</th>
                      <th className="py-2.5 px-3 text-right">Pianificati</th>
                      <th className="py-2.5 px-3 text-right">Flusso Netto</th>
                      <th className="py-2.5 px-3 text-right">Saldo a Fine Giorno</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-numeric">
                    {currentMonthDailyBalances.map((item, index) => {
                      const isSelected = item.dateStr === selectedDayStr;
                      return (
                        <tr
                          key={item.dateStr}
                          onClick={() => {
                            setSelectedDayStr(item.dateStr);
                            setShowBalanceTimelineModal(false);
                          }}
                          className={`cursor-pointer transition-colors group ${
                            item.isToday
                              ? 'bg-indigo-50/80 dark:bg-indigo-950/40 font-semibold'
                              : isSelected
                              ? 'bg-slate-100/70 dark:bg-slate-800/50'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          {/* Data e Giorno */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {String(item.dayNum).padStart(2, '0')} {item.dayName}
                              </span>
                              {item.isToday && (
                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold">
                                  Oggi
                                </span>
                              )}
                              {item.isFuture && (
                                <span className="text-[8.5px] px-1.5 py-0.2 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                  Prev.
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Entrate */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums">
                            {item.entrate > 0 ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                +{formatCurrency(item.entrate, { hideSymbol: false })}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600">-</span>
                            )}
                          </td>

                          {/* Spese Essenziali (Rosso Scuro) */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums">
                            {item.usciteEssenziali > 0 ? (
                              <span className="text-red-900 dark:text-red-300 font-bold">
                                -{formatCurrency(item.usciteEssenziali, { hideSymbol: false })}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600">-</span>
                            )}
                          </td>

                          {/* Spese Extra (Arancione) */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums">
                            {item.usciteExtra > 0 ? (
                              <span className="text-orange-900 dark:text-orange-300 font-bold">
                                -{formatCurrency(item.usciteExtra, { hideSymbol: false })}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600">-</span>
                            )}
                          </td>

                          {/* Pianificati */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums">
                            {item.planned > 0 ? (
                              <span className="text-purple-600 dark:text-purple-400 font-medium">
                                -{formatCurrency(item.planned, { hideSymbol: false })}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600">-</span>
                            )}
                          </td>

                          {/* Netto Giorno */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums font-semibold">
                            {item.netDay !== 0 ? (
                              <span className={item.netDay > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                {formatCurrency(item.netDay, { showSign: true })}
                              </span>
                            ) : (
                              <span className="text-slate-400">0,00 €</span>
                            )}
                          </td>

                          {/* Saldo a Fine Giorno */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums font-bold">
                            <span className={`px-2 py-1 rounded-xl text-xs ${
                              item.isToday
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : item.balance >= 0
                                ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border border-slate-200/60 dark:border-slate-700/60'
                                : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/40'
                            }`}>
                              {formatCurrency(item.balance)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Modale con Note e Azione */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#242426]/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <span className="text-indigo-500 font-bold">ℹ️</span>
                <span>
                  I saldi futuri integrano le entrate e spese inserite e gli impegni pianificati fino all'ultimo giorno del mese.
                </span>
              </div>

              <button
                onClick={() => setShowBalanceTimelineModal(false)}
                className="px-5 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shadow-xs"
              >
                Chiudi Prospetto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
