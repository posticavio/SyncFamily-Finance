import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import { AccountForecast, Movement, Planned, Deadline, AccountType } from '../types';
import { formatCurrency, formatItalianNumber, formatDateIT } from '../utils/formatters';
import { useTheme } from '../context/ThemeContext';
import { haptics } from '../utils/haptics';
import {
  Wallet,
  Calendar,
  Filter,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Layers,
  ChevronDown,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Building,
  Coins,
  PiggyBank,
  X,
  Check
} from 'lucide-react';
import { Carousel } from './Carousel';

interface AccountsBalanceTimelineChartProps {
  accounts: AccountForecast[];
  funds: AccountForecast[];
  movements?: Movement[];
  planned?: Planned[];
  deadlines?: Deadline[];
}

export type TimeWindow = 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';
export type ChartDisplayMode = 'TOTAL' | 'SINGLE' | 'ALL';
export type AccountFilterMode = 'ALL' | 'BY_TYPE' | 'SINGLE';
export type AccountTypeCategory = 'FONDI' | 'BANCA' | 'CARTE' | 'CONTANTI' | 'DEPOSITO';

const monthsShort = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

// Palette armoniosa ad alto contrasto per i grafici One UI
const DISTINCT_COLORS = [
  '#4F46E5', // Indigo
  '#059669', // Emerald
  '#D97706', // Amber
  '#0891B2', // Cyan
  '#E11D48', // Rose
  '#7C3AED', // Violet
  '#2563EB', // Blue
  '#EA580C', // Orange
  '#0D9488', // Teal
  '#DB2777', // Pink
  '#65A30D', // Lime
  '#9333EA', // Purple
];

function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const AccountsBalanceTimelineChart: React.FC<AccountsBalanceTimelineChartProps> = ({
  accounts = [],
  funds = [],
  movements = [],
  planned = [],
  deadlines = []
}) => {
  const { isDark } = useTheme();

  // Rilevamento viewport mobile per layout responsive One UI
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 640;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Modalità di visualizzazione:
  // - ALL: Confronto multi-linea con filtri per conto (Default come da mockup)
  // - SINGLE: Focus su un singolo conto selezionato
  // - TOTAL: Curva unica ad area di liquidità totale
  const [viewMode, setViewMode] = useState<ChartDisplayMode>('ALL');

  // Riferimento container grafico e larghezza misurata dinamicamente con ResizeObserver
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState<number>(360);

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const updateWidth = () => {
      if (el) {
        setChartWidth(el.clientWidth || 360);
      }
    };
    updateWidth();
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setChartWidth(Math.round(entry.contentRect.width));
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Finestra temporale selezionata: Settimanale (±7gg), Mensile (±30gg), Trimestrale (±90gg), Annuale (±180gg)
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('MONTH');

  // Modalità filtro selezione conti: Tutti, Per Tipologia, Singolo Conto
  const [filterMode, setFilterMode] = useState<AccountFilterMode>('ALL');
  const [selectedType, setSelectedType] = useState<AccountTypeCategory>('BANCA');
  const [selectedSingleAccountId, setSelectedSingleAccountId] = useState<string>('');

  // Set di ID conti disattivati manualmente cliccando sulla legenda interattiva
  const [hiddenAccountIds, setHiddenAccountIds] = useState<Set<string>>(new Set());

  // Menu a comparsa per filtrare e mostrare/nascondere singole linee
  const [isLinesMenuOpen, setIsLinesMenuOpen] = useState<boolean>(false);
  const linesMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (linesMenuRef.current && !linesMenuRef.current.contains(event.target as Node)) {
        setIsLinesMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLinesMenuOpen(false);
      }
    };
    if (isLinesMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLinesMenuOpen]);

  // Lista unificata di tutti i conti e fondi attivi
  const allItems = useMemo(() => {
    const list = [...accounts, ...funds];
    // Seleziona il primo conto di default per la modalità singolo conto
    if (list.length > 0 && !selectedSingleAccountId) {
      const primary = list.find(a => a.conto_principale) || list[0];
      setSelectedSingleAccountId(primary.conto_id);
    }
    return list;
  }, [accounts, funds, selectedSingleAccountId]);

  // Helper per ottenere l'icona della tipologia
  const getTypeIcon = (cat: AccountTypeCategory) => {
    switch (cat) {
      case 'FONDI': return <PiggyBank size={13} />;
      case 'BANCA': return <Building size={13} />;
      case 'CARTE': return <CreditCard size={13} />;
      case 'CONTANTI': return <Coins size={13} />;
      case 'DEPOSITO': return <ShieldCheck size={13} />;
      default: return <Wallet size={13} />;
    }
  };

  // Helper per classificare un account in una categoria
  const matchCategory = (item: AccountForecast, cat: AccountTypeCategory): boolean => {
    if (cat === 'FONDI') return !!item.is_fund;
    if (item.is_fund) return false;
    if (cat === 'BANCA') return item.tipo_conto === 'BANCA' || !item.tipo_conto;
    if (cat === 'CARTE') return item.tipo_conto === 'CARTA_DEBITO' || item.tipo_conto === 'CARTA_CREDITO';
    if (cat === 'CONTANTI') return item.tipo_conto === 'CONTANTI';
    if (cat === 'DEPOSITO') return item.tipo_conto === 'CONTO_DEPOSITO';
    return false;
  };

  // Filtra i conti da mostrare in base a filterMode
  const activeItemsToDisplay = useMemo(() => {
    if (filterMode === 'ALL') {
      return allItems;
    }
    if (filterMode === 'BY_TYPE') {
      return allItems.filter(item => matchCategory(item, selectedType));
    }
    if (filterMode === 'SINGLE') {
      const found = allItems.find(item => item.conto_id === selectedSingleAccountId);
      return found ? [found] : (allItems.slice(0, 1));
    }
    return allItems;
  }, [allItems, filterMode, selectedType, selectedSingleAccountId]);

  // Assegnazione colori stabili ai conti
  const accountColors = useMemo(() => {
    const map = new Map<string, string>();
    allItems.forEach((item, idx) => {
      const color = item.colore || DISTINCT_COLORS[idx % DISTINCT_COLORS.length];
      map.set(item.conto_id, color);
    });
    return map;
  }, [allItems]);

  // Toggle singola linea dalla legenda interattiva
  const toggleAccountVisibility = (contoId: string) => {
    haptics.tap();
    setHiddenAccountIds(prev => {
      const next = new Set(prev);
      if (next.has(contoId)) {
        next.delete(contoId);
      } else {
        // Non nascondere se è l'unico rimasto visibile
        if (activeItemsToDisplay.filter(i => !next.has(i.conto_id)).length > 1) {
          next.add(contoId);
        }
      }
      return next;
    });
  };

  // Calcolo della timeline centrata su OGGI
  const timelineData = useMemo(() => {
    const today = new Date();
    const todayStr = formatYMD(today);

    // Parametri della finestra temporale (tutti strettamente simmetrici con Oggi al centro esatto)
    let maxOffset = 30;
    let step = 1;

    switch (timeWindow) {
      case 'WEEK':
        maxOffset = 7;
        step = 1;
        break;
      case 'MONTH':
        maxOffset = 30;
        step = 1;
        break;
      case 'QUARTER':
        maxOffset = 90;
        step = 3;
        break;
      case 'YEAR':
        maxOffset = 180;
        step = 5;
        break;
    }

    // Genera gli offset simmetrici: da -maxOffset a 0 (Oggi) fino a +maxOffset
    const offsets: number[] = [];
    for (let o = -maxOffset; o < 0; o += step) {
      offsets.push(o);
    }
    offsets.push(0); // OGGI: indice centrale esatto
    for (let o = step; o <= maxOffset; o += step) {
      offsets.push(o);
    }

    // Costruisci gli ID equivalenti per ciascun conto per match rapido
    const accountIdSets = new Map<string, Set<string>>();
    activeItemsToDisplay.forEach(item => {
      accountIdSets.set(
        item.conto_id,
        new Set([item.conto_id, item.id, item.human_id].filter(Boolean) as string[])
      );
    });

    // 1. Prepara i movimenti passati indicizzati per data
    const nonDeletedMovs = movements.filter(m => !(m as any).is_deleted);

    // 2. Prepara i pianificati futuri
    const pendingPlanned = planned.filter(
      p => p.stato === 'PENDENTE' && !(p as any).is_deleted
    );

    // 3. Prepara le scadenze future
    const pendingDeadlines = deadlines.filter(
      s => s.stato === 'DA_PAGARE' && !(s as any).is_deleted
    );

    // Mappa progressiva per i saldi futuri da oggi in poi (offset da 1 a maxOffset)
    const futureBalancesByDay = new Map<number, Map<string, number>>();
    const runningFuture = new Map<string, number>();
    activeItemsToDisplay.forEach(item => {
      runningFuture.set(item.conto_id, item.saldo_oggi);
    });

    for (let off = 1; off <= maxOffset; off++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + off);
      const dStr = formatYMD(d);

      activeItemsToDisplay.forEach(item => {
        const ids = accountIdSets.get(item.conto_id)!;
        let bal = runningFuture.get(item.conto_id)!;

        // Pianificati per questa data
        const dayPlanned = pendingPlanned.filter(
          p => p.data_prevista === dStr && p.conto_id && ids.has(p.conto_id)
        );
        for (const p of dayPlanned) {
          if (p.tipologia === 'ENTRATA') bal += p.importo;
          else if (p.tipologia === 'USCITA') bal -= p.importo;
          else if (p.tipologia === 'GIROCONTO') bal -= p.importo;
        }

        // Scadenze per questa data
        const dayDeadlines = pendingDeadlines.filter(s => {
          const matches = (s.conto_id && ids.has(s.conto_id)) || 
            (!s.conto_id && !item.is_fund && item.conto_principale);
          if (!matches) return false;
          const already = dayPlanned.some(p => p.id === s.movimento_id);
          return !already && s.data_scadenza === dStr;
        });

        for (const s of dayDeadlines) {
          bal -= s.importo_previsto;
        }

        bal = Math.round(bal * 100) / 100;
        runningFuture.set(item.conto_id, bal);
      });

      // Salva snapshot
      const snapshot = new Map<string, number>();
      runningFuture.forEach((val, k) => snapshot.set(k, val));
      futureBalancesByDay.set(off, snapshot);
    }

    // Costruisci i punti del grafico per ciascun offset
    const points = offsets.map(offset => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
      const dStr = formatYMD(d);
      const isToday = offset === 0;
      const isFuture = offset > 0;

      let displayDate = `${d.getDate()} ${monthsShort[d.getMonth()]}`;
      if (isToday) {
        displayDate = 'Oggi';
      }

      const pointObj: Record<string, any> = {
        dateKey: dStr,
        displayDate,
        offset,
        isToday,
        isFuture,
        fullDate: formatDateIT(dStr)
      };

      let sumBalance = 0;

      activeItemsToDisplay.forEach(item => {
        const contoId = item.conto_id;
        let balance = item.saldo_oggi;

        if (isToday) {
          balance = item.saldo_oggi;
        } else if (isFuture) {
          // Recupera dalla mappa futura
          balance = futureBalancesByDay.get(offset)?.get(contoId) ?? item.saldo_oggi;
        } else {
          // Calcola a ritroso dal saldo odierno
          // saldo_at_d = saldo_oggi - (movimenti avvenuti tra d+1 e oggi)
          const ids = accountIdSets.get(contoId)!;
          let delta = 0;

          const movsAfter = nonDeletedMovs.filter(m => m.data > dStr && m.data <= todayStr);
          for (const m of movsAfter) {
            const isOrigine = m.conto_origine && ids.has(m.conto_origine);
            const isDest = m.conto_destinazione && ids.has(m.conto_destinazione);

            if (m.tipologia === 'ENTRATA') {
              if (isDest || isOrigine) delta -= m.importo;
            } else if (m.tipologia === 'USCITA') {
              if (isOrigine) delta += m.importo;
            } else if (m.tipologia === 'GIROCONTO') {
              if (isOrigine && isDest) {
                // interno, zero
              } else if (isOrigine) {
                delta += m.importo;
              } else if (isDest) {
                delta -= m.importo;
              }
            }
          }

          balance = Math.round((item.saldo_oggi + delta) * 100) / 100;
        }

        pointObj[contoId] = balance;
        if (!hiddenAccountIds.has(contoId)) {
          sumBalance += balance;
        }
      });

      pointObj.total = Math.round(sumBalance * 100) / 100;

      return pointObj;
    });

    return {
      points,
      todayStr,
      firstDateStr: points[0]?.dateKey,
      lastDateStr: points[points.length - 1]?.dateKey
    };
  }, [timeWindow, activeItemsToDisplay, hiddenAccountIds, movements, planned, deadlines]);

  // Conto singolo selezionato per la modalità SINGLE
  const selectedSingleAccount = useMemo(() => {
    return allItems.find(item => item.conto_id === selectedSingleAccountId) || allItems[0];
  }, [allItems, selectedSingleAccountId]);

  const activeSingleColor = useMemo(() => {
    if (!selectedSingleAccount) return '#E31B23';
    return accountColors.get(selectedSingleAccount.conto_id) || selectedSingleAccount.colore || '#4F46E5';
  }, [selectedSingleAccount, accountColors]);

  // Calcolo estremi per il dominio asse Y dinamico
  const yDomain = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;

    if (viewMode === 'TOTAL') {
      timelineData.points.forEach(pt => {
        const val = pt.total;
        if (typeof val === 'number') {
          if (val < min) min = val;
          if (val > max) max = val;
        }
      });
    } else if (viewMode === 'SINGLE') {
      const accId = selectedSingleAccount?.conto_id;
      if (accId) {
        timelineData.points.forEach(pt => {
          const val = pt[accId];
          if (typeof val === 'number') {
            if (val < min) min = val;
            if (val > max) max = val;
          }
        });
      }
    } else {
      timelineData.points.forEach(pt => {
        activeItemsToDisplay.forEach(item => {
          if (!hiddenAccountIds.has(item.conto_id)) {
            const val = pt[item.conto_id];
            if (typeof val === 'number') {
              if (val < min) min = val;
              if (val > max) max = val;
            }
          }
        });
      });
    }

    if (min === Infinity || max === -Infinity) {
      return [0, 1000];
    }

    const range = max - min;
    const padding = Math.max(Math.round(range * 0.14), 80);
    const domainMin = Math.floor((min - padding) / 100) * 100;
    const domainMax = Math.ceil((max + padding) / 100) * 100;

    return [domainMin, domainMax];
  }, [timelineData, activeItemsToDisplay, hiddenAccountIds, viewMode, selectedSingleAccount]);

  // Metriche di riepilogo del periodo selezionato in base alla modalità attiva
  const summaryMetrics = useMemo(() => {
    const pts = timelineData.points;
    if (pts.length === 0) return { startTotal: 0, todayTotal: 0, endTotal: 0, delta: 0, deltaPct: 0 };

    const firstPt = pts[0];
    const todayPt = pts.find(p => p.isToday) || pts[Math.floor(pts.length / 2)];
    const lastPt = pts[pts.length - 1];

    let startTotal = 0;
    let todayTotal = 0;
    let endTotal = 0;

    if (viewMode === 'TOTAL') {
      startTotal = Number(firstPt.total || 0);
      todayTotal = Number(todayPt.total || 0);
      endTotal = Number(lastPt.total || 0);
    } else if (viewMode === 'SINGLE') {
      const accId = selectedSingleAccount?.conto_id;
      if (accId) {
        startTotal = Number(firstPt[accId] || 0);
        todayTotal = Number(todayPt[accId] || 0);
        endTotal = Number(lastPt[accId] || 0);
      }
    } else {
      activeItemsToDisplay.forEach(item => {
        if (!hiddenAccountIds.has(item.conto_id)) {
          startTotal += Number(firstPt[item.conto_id] || 0);
          todayTotal += Number(todayPt[item.conto_id] || 0);
          endTotal += Number(lastPt[item.conto_id] || 0);
        }
      });
    }

    startTotal = Math.round(startTotal * 100) / 100;
    todayTotal = Math.round(todayTotal * 100) / 100;
    endTotal = Math.round(endTotal * 100) / 100;

    const delta = Math.round((endTotal - startTotal) * 100) / 100;
    const deltaPct = startTotal !== 0 ? Math.round((delta / Math.abs(startTotal)) * 1000) / 10 : 0;

    return {
      startTotal,
      todayTotal,
      endTotal,
      delta,
      deltaPct
    };
  }, [timelineData, activeItemsToDisplay, hiddenAccountIds, viewMode, selectedSingleAccount]);

  // Formattazione asse Y: compatta e leggibile su smartphone per non rubare spazio
  const formatYAxisTick = (val: number) => {
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (chartWidth < 480 || isMobile) {
      if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(1).replace('.0', '')}M€`;
      if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(0)}k€`;
      return `${sign}${Math.round(abs)}€`;
    }
    return `${formatItalianNumber(val, { maximumFractionDigits: 0 })} €`;
  };

  // Calcolo dinamico e adattivo dei tick dell'asse X:
  // Garantisce che il punto 'OGGI' sia SEMPRE incluso al centro esatto
  // e che il numero e la spaziatura delle date si adatti perfettamente alla larghezza dello schermo
  const xAxisTicks = useMemo(() => {
    const pts = timelineData.points;
    if (!pts || pts.length === 0) return [];
    const todayKey = timelineData.todayStr;
    const todayIdx = pts.findIndex(p => p.dateKey === todayKey);
    const mid = todayIdx >= 0 ? todayIdx : Math.floor(pts.length / 2);
    const last = pts.length - 1;

    // Se lo schermo è molto compatto (< 330px), mostriamo 3 punti cardine: Inizio, Oggi, Fine
    if (chartWidth < 330) {
      return [pts[0].dateKey, pts[mid].dateKey, pts[last].dateKey];
    }

    // Su smartphone standard (< 560px), 5 punti simmetrici ed equidistanti:
    // [Inizio, 1° intermedio passato, OGGI (centro esatto), 2° intermedio futuro, Fine]
    if (chartWidth < 560) {
      const q1 = Math.round(mid / 2);
      const q3 = mid + Math.round((last - mid) / 2);
      return [
        pts[0].dateKey,
        pts[q1].dateKey,
        pts[mid].dateKey,
        pts[q3].dateKey,
        pts[last].dateKey
      ];
    }

    // Su tablet e desktop (>= 560px), 7 punti equidistanti con OGGI perfettamente al centro:
    const p1 = Math.round(mid / 3);
    const p2 = Math.round((mid * 2) / 3);
    const p3 = mid + Math.round((last - mid) / 3);
    const p4 = mid + Math.round(((last - mid) * 2) / 3);
    return [
      pts[0].dateKey,
      pts[p1].dateKey,
      pts[p2].dateKey,
      pts[mid].dateKey,
      pts[p3].dateKey,
      pts[p4].dateKey,
      pts[last].dateKey
    ];
  }, [timelineData.points, timelineData.todayStr, chartWidth]);

  // Componente tick personalizzato per l'asse X:
  // - Evidenzia 'OGGI' con una pill rossa brand perfettamente centrata sulla linea verticale
  // - Formatta le altre date in modo nitido e proporzionato
  const CustomXAxisTick = ({ x, y, payload }: any) => {
    if (!payload || !payload.value) return null;
    const dateKey = payload.value;
    const isToday = dateKey === timelineData.todayStr;
    const pt = timelineData.points.find(p => p.dateKey === dateKey);

    if (isToday) {
      return (
        <g transform={`translate(${x},${y})`}>
          <rect
            x={-19}
            y={4}
            width={38}
            height={17}
            rx={8.5}
            fill="#E31B23"
          />
          <text
            x={0}
            y={15.5}
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize={9}
            fontWeight="bold"
            letterSpacing="0.03em"
          >
            OGGI
          </text>
        </g>
      );
    }

    const label = pt ? pt.displayDate : dateKey;

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={16}
          textAnchor="middle"
          fill={isDark ? '#8E8E93' : '#64748B'}
          fontSize={chartWidth < 380 ? 9 : 10}
          fontWeight="500"
        >
          {label}
        </text>
      </g>
    );
  };

  // Tooltip custom dettagliato con estetica One UI
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0]?.payload;
      if (!point) return null;

      const isToday = point.isToday;
      const isFuture = point.isFuture;

      return (
        <div className="bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl shadow-xl border border-slate-200/80 dark:border-white/10 text-xs min-w-[210px] max-w-[290px] z-50">
          {/* Header data con indicazione temporale */}
          <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-slate-100 dark:border-white/10">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-[#F5F5F7]">
              <Calendar size={13} className="text-[#E31B23]" />
              <span>{point.displayDate}</span>
              <span className="text-[10px] text-slate-400 font-normal">({point.fullDate})</span>
            </div>

            <div>
              {isToday ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E31B23] text-white tracking-wide shadow-2xs">
                  OGGI
                </span>
              ) : isFuture ? (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40">
                  +{point.offset} gg
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                  {point.offset} gg
                </span>
              )}
            </div>
          </div>

          {/* Dettaglio del punto in base a viewMode */}
          {viewMode === 'TOTAL' ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-[#8E8E93] text-[11px]">Liquidità Totale:</span>
                <span className="font-numeric font-bold text-sm text-[#E31B23]">
                  {formatCurrency(point.total)}
                </span>
              </div>
              {!isToday && (
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Diff. da oggi:</span>
                  <span className={`font-numeric font-semibold ${point.total - summaryMetrics.todayTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {formatCurrency(point.total - summaryMetrics.todayTotal, { showSign: true })}
                  </span>
                </div>
              )}
            </div>
          ) : viewMode === 'SINGLE' && selectedSingleAccount ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 text-[11px]">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: activeSingleColor }} />
                <span className="font-medium truncate">{selectedSingleAccount.nome_conto}</span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-slate-500 text-[11px]">Saldo stimato:</span>
                <span className="font-numeric font-bold text-sm text-slate-900 dark:text-[#F5F5F7]">
                  {formatCurrency(point[selectedSingleAccount.conto_id] ?? 0)}
                </span>
              </div>
              {!isToday && (
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Diff. da oggi:</span>
                  <span className={`font-numeric font-semibold ${(point[selectedSingleAccount.conto_id] ?? 0) - selectedSingleAccount.saldo_oggi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {formatCurrency((point[selectedSingleAccount.conto_id] ?? 0) - selectedSingleAccount.saldo_oggi, { showSign: true })}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1 max-h-[190px] overflow-y-auto no-scrollbar pr-0.5">
              {activeItemsToDisplay
                .filter(item => !hiddenAccountIds.has(item.conto_id))
                .map(item => {
                  const bal = point[item.conto_id] ?? 0;
                  const color = accountColors.get(item.conto_id) || '#4F46E5';
                  return (
                    <div key={item.conto_id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-slate-700 dark:text-slate-300 truncate text-[11px]">
                          {item.nome_conto}
                        </span>
                      </div>
                      <span className="font-numeric font-semibold text-slate-900 dark:text-[#F5F5F7]">
                        {formatCurrency(bal)}
                      </span>
                    </div>
                  );
                })}
              <div className="pt-1.5 mt-1 border-t border-slate-100 dark:border-white/10 flex items-center justify-between font-semibold">
                <span className="text-slate-500 text-[11px]">Totale Visibili:</span>
                <span className="font-numeric text-xs text-[#E31B23]">{formatCurrency(point.total)}</span>
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div id="accounts-balance-timeline-chart-root" className="bg-white dark:bg-[#1C1C1E] rounded-[22px] border border-slate-200/80 dark:border-white/5 p-3.5 sm:p-5 shadow-2xs space-y-3 sm:space-y-4">
      {/* 1. Header con Descrizione e Indicatore Passato / Oggi / Futuro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 pb-2.5 sm:pb-3 border-b border-slate-100 dark:border-white/5">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-[12px] bg-[#E31B23]/10 dark:bg-[#2A2A2E] text-[#E31B23] flex items-center justify-center flex-shrink-0">
              <Wallet size={15} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-[#F5F5F7] tracking-tight">
                Andamento Saldi per Conto
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-[#8E8E93]">
                Evoluzione dinamica con giorno corrente al centro
              </p>
            </div>
          </div>
        </div>

        {/* Indicatore Visivo Direzionale Passato / OGGI / Futuro */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 dark:bg-[#242426] px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-medium text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-white/5">
          <span className="text-slate-400">Passato ←</span>
          <span className="px-2 py-0.5 rounded-full bg-[#E31B23] text-white text-[9px] sm:text-[10px] font-bold shadow-2xs">
            OGGI
          </span>
          <span className="text-indigo-500 dark:text-indigo-400 font-semibold">→ Futuro</span>
        </div>
      </div>

      {/* 2. Controlli Segmentati Touch-Friendly a Due Livelli */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Livello 1: Selezione Conti (Tutti i Conti / Per Tipologia / Singolo Conto) */}
          <div className="flex bg-slate-100 dark:bg-[#242426] p-1 rounded-full text-xs font-medium border border-slate-200/60 dark:border-white/5 max-w-full overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => {
                setViewMode('ALL');
                setFilterMode('ALL');
                haptics.tap();
              }}
              className={`px-2.5 sm:px-3 py-1 rounded-full transition-all whitespace-nowrap cursor-pointer text-xs font-semibold ${
                viewMode === 'ALL' && filterMode === 'ALL'
                  ? 'bg-[#E31B23] text-white shadow-2xs'
                  : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7]'
              }`}
            >
              Tutti i Conti ({allItems.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setViewMode('ALL');
                setFilterMode('BY_TYPE');
                haptics.tap();
              }}
              className={`px-2.5 sm:px-3 py-1 rounded-full transition-all whitespace-nowrap cursor-pointer text-xs font-semibold ${
                viewMode === 'ALL' && filterMode === 'BY_TYPE'
                  ? 'bg-[#E31B23] text-white shadow-2xs'
                  : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7]'
              }`}
            >
              Per Tipologia
            </button>

            <button
              type="button"
              onClick={() => {
                setViewMode('SINGLE');
                haptics.tap();
              }}
              className={`px-2.5 sm:px-3 py-1 rounded-full transition-all whitespace-nowrap cursor-pointer text-xs font-semibold ${
                viewMode === 'SINGLE'
                  ? 'bg-[#E31B23] text-white shadow-2xs'
                  : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7]'
              }`}
            >
              Singolo Conto
            </button>
          </div>

          {/* Livello 2: Finestra Temporale */}
          <div className="flex bg-slate-100 dark:bg-[#242426] p-1 rounded-full text-xs font-medium border border-slate-200/60 dark:border-white/5">
            <button
              type="button"
              onClick={() => {
                setTimeWindow('WEEK');
                haptics.tap();
              }}
              className={`px-2 sm:px-2.5 py-1 rounded-full transition-all whitespace-nowrap cursor-pointer text-xs font-semibold ${
                timeWindow === 'WEEK'
                  ? 'bg-[#E31B23] text-white shadow-2xs'
                  : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7]'
              }`}
            >
              <span>{isMobile ? '7G' : 'Settimana'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTimeWindow('MONTH');
                haptics.tap();
              }}
              className={`px-2 sm:px-2.5 py-1 rounded-full transition-all whitespace-nowrap cursor-pointer text-xs font-semibold ${
                timeWindow === 'MONTH'
                  ? 'bg-[#E31B23] text-white shadow-2xs'
                  : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7]'
              }`}
            >
              <span>{isMobile ? '30G' : 'Mese'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTimeWindow('QUARTER');
                haptics.tap();
              }}
              className={`px-2 sm:px-2.5 py-1 rounded-full transition-all whitespace-nowrap cursor-pointer text-xs font-semibold ${
                timeWindow === 'QUARTER'
                  ? 'bg-[#E31B23] text-white shadow-2xs'
                  : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7]'
              }`}
            >
              <span>{isMobile ? '90G' : 'Trimestre'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTimeWindow('YEAR');
                haptics.tap();
              }}
              className={`px-2 sm:px-2.5 py-1 rounded-full transition-all whitespace-nowrap cursor-pointer text-xs font-semibold ${
                timeWindow === 'YEAR'
                  ? 'bg-[#E31B23] text-white shadow-2xs'
                  : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7]'
              }`}
            >
              <span>{isMobile ? '180G' : 'Anno'}</span>
            </button>
          </div>
        </div>

        {/* Barra di navigazione rapida orizzontale a pillole quando "Singolo Conto" è attivo */}
        {viewMode === 'SINGLE' && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
            {allItems.map(item => {
              const isSelected = item.conto_id === selectedSingleAccountId;
              const color = accountColors.get(item.conto_id) || '#4F46E5';

              return (
                <button
                  key={item.conto_id}
                  type="button"
                  onClick={() => {
                    setSelectedSingleAccountId(item.conto_id);
                    haptics.tap();
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer border flex-shrink-0 active:scale-95 ${
                    isSelected
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs font-semibold'
                      : 'bg-slate-100 dark:bg-[#242426] text-slate-700 dark:text-slate-300 border-slate-200/60 dark:border-white/5 hover:border-slate-300'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span>{item.nome_conto}</span>
                  <span className="font-numeric text-[10px] opacity-80">
                    {formatCurrency(item.saldo_oggi)}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Filtri categoria se "Per Tipologia" & selettore dropdown compatto linee */}
        {viewMode === 'ALL' && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            {filterMode === 'BY_TYPE' ? (
              <div className="flex bg-slate-100 dark:bg-[#242426] p-1 rounded-full text-xs font-medium border border-slate-200/60 dark:border-white/5 overflow-x-auto no-scrollbar">
                {(['BANCA', 'FONDI', 'CARTE', 'CONTANTI'] as AccountTypeCategory[]).map(cat => {
                  const count = allItems.filter(i => matchCategory(i, cat)).length;
                  if (count === 0) return null;
                  const labelMap: Record<string, string> = {
                    BANCA: 'Banche',
                    FONDI: 'Fondi',
                    CARTE: 'Carte',
                    CONTANTI: 'Contanti'
                  };
                  const isCatActive = selectedType === cat;

                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setSelectedType(cat);
                        haptics.tap();
                      }}
                      className={`px-2.5 py-0.5 rounded-full transition-all whitespace-nowrap cursor-pointer text-[11px] font-medium flex items-center gap-1 ${
                        isCatActive
                          ? 'bg-[#E31B23] text-white font-semibold shadow-2xs'
                          : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>{labelMap[cat]}</span>
                      <span className="text-[10px] opacity-75">({count})</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 dark:text-[#8E8E93] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Multi-linea attiva ({activeItemsToDisplay.filter(i => !hiddenAccountIds.has(i.conto_id)).length} conti)</span>
              </div>
            )}

            {/* Menu a comparsa linee */}
            <div ref={linesMenuRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsLinesMenuOpen(prev => !prev);
                  haptics.tap();
                }}
                className={`px-2.5 sm:px-3 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer border ${
                  isLinesMenuOpen
                    ? 'bg-[#E31B23] text-white border-[#E31B23]'
                    : 'bg-slate-100 dark:bg-[#242426] text-slate-700 dark:text-[#F5F5F7] border-slate-200/80 dark:border-white/10'
                }`}
              >
                <Filter size={11} className={isLinesMenuOpen ? 'text-white' : 'text-[#E31B23]'} />
                <span>Linee conti:</span>
                <span className="font-bold">
                  {activeItemsToDisplay.filter(i => !hiddenAccountIds.has(i.conto_id)).length}/{activeItemsToDisplay.length} attivi
                </span>
                <ChevronDown size={11} className={`transition-transform ${isLinesMenuOpen ? 'rotate-180 text-white' : 'text-slate-400'}`} />
              </button>

              <AnimatePresence>
                {isLinesMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-1.5 p-3 bg-white dark:bg-[#202022] border border-slate-200/90 dark:border-white/10 rounded-[20px] shadow-xl z-30 min-w-[240px] space-y-2"
                  >
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-white/5">
                      <span className="text-xs font-semibold text-slate-800 dark:text-[#F5F5F7]">
                        Filtra Linee
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setHiddenAccountIds(new Set());
                            haptics.tap();
                          }}
                          className="text-[10px] text-[#E31B23] hover:underline cursor-pointer font-medium"
                        >
                          Tutti
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsLinesMenuOpen(false)}
                          className="w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 max-h-[180px] overflow-y-auto no-scrollbar">
                      {activeItemsToDisplay.map(item => {
                        const isHidden = hiddenAccountIds.has(item.conto_id);
                        const color = accountColors.get(item.conto_id) || '#4F46E5';
                        return (
                          <button
                            key={item.conto_id}
                            type="button"
                            onClick={() => toggleAccountVisibility(item.conto_id)}
                            className={`px-2 py-1 rounded-full text-[10px] font-medium flex items-center gap-1 border cursor-pointer ${
                              !isHidden
                                ? 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-800 dark:text-[#F5F5F7]'
                                : 'opacity-40 line-through border-dashed border-slate-300 dark:border-white/10'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                            <span className="truncate max-w-[120px]">{item.nome_conto}</span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* 3. Il Riquadro Protetto del Grafico (Framed Box One UI) */}
      <div className="bg-slate-50/70 dark:bg-[#151516] rounded-2xl sm:rounded-[22px] border border-slate-200/70 dark:border-white/5 p-2 sm:p-3.5 relative overflow-hidden shadow-2xs">
        {/* Header informativo all'interno del riquadro */}
        <div className="flex items-center justify-between px-1 pb-1 text-[11px] text-slate-500 dark:text-[#8E8E93]">
          <div className="flex items-center gap-1.5 font-medium min-w-0">
            {viewMode === 'TOTAL' && (
              <span className="flex items-center gap-1 text-[#E31B23] font-semibold text-xs truncate">
                <Sparkles size={12} className="flex-shrink-0" />
                <span>Liquidità Complessiva</span>
              </span>
            )}
            {viewMode === 'SINGLE' && selectedSingleAccount && (
              <span className="flex items-center gap-1.5 text-slate-800 dark:text-[#F5F5F7] font-semibold text-xs truncate">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: activeSingleColor }} />
                <span className="truncate">{selectedSingleAccount.nome_conto}</span>
              </span>
            )}
            {viewMode === 'ALL' && (
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Confronto ({activeItemsToDisplay.filter(i => !hiddenAccountIds.has(i.conto_id)).length} attivi)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[10px] font-numeric flex-shrink-0">
            <span className="px-1.5 py-0.5 rounded-full bg-[#E31B23]/10 text-[#E31B23] font-bold">
              • OGGI al centro •
            </span>
          </div>
        </div>

        {/* Canvas Recharts con proporzioni ottimali per non schiacciare il grafico */}
        <div ref={chartContainerRef} className="h-[260px] sm:h-[340px] w-full pt-1 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={timelineData.points}
              margin={{
                top: 18,
                right: chartWidth < 380 ? 12 : 20,
                left: chartWidth < 380 ? -4 : 4,
                bottom: 2
              }}
            >
              <defs>
                <linearGradient id="totalAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E31B23" stopOpacity={isDark ? 0.25 : 0.16} />
                  <stop offset="70%" stopColor="#E31B23" stopOpacity={isDark ? 0.05 : 0.02} />
                  <stop offset="100%" stopColor="#E31B23" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="singleAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={activeSingleColor} stopOpacity={isDark ? 0.28 : 0.18} />
                  <stop offset="70%" stopColor={activeSingleColor} stopOpacity={isDark ? 0.06 : 0.02} />
                  <stop offset="100%" stopColor={activeSingleColor} stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'}
                vertical={false}
              />

              {/* Sfumatura area futura (a destra di Oggi) per evidenziare la componente previsionale */}
              {timelineData.todayStr && timelineData.lastDateStr && (
                <ReferenceArea
                  x1={timelineData.todayStr}
                  x2={timelineData.lastDateStr}
                  {...({
                    fill: '#E31B23',
                    fillOpacity: isDark ? 0.035 : 0.02
                  } as any)}
                />
              )}

              {/* Linea verticale OGGI centrata con corrispondenza esatta al tick dell'asse X */}
              {timelineData.todayStr && (
                <ReferenceLine
                  x={timelineData.todayStr}
                  stroke="#E31B23"
                  strokeWidth={1.8}
                  strokeDasharray="4 3"
                  label={{
                    value: 'OGGI',
                    position: 'top',
                    fill: '#E31B23',
                    fontSize: chartWidth < 380 ? 9 : 10,
                    fontWeight: 'bold',
                    offset: 4
                  }}
                />
              )}

              {/* Linea dello zero per riferimento visivo */}
              <ReferenceLine
                y={0}
                stroke={isDark ? 'rgba(255,255,255,0.15)' : '#CBD5E1'}
                strokeWidth={1}
              />

              <XAxis
                dataKey="dateKey"
                ticks={xAxisTicks}
                interval={0}
                stroke={isDark ? '#8E8E93' : '#94A3B8'}
                tickLine={false}
                axisLine={{ stroke: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }}
                tick={<CustomXAxisTick />}
                height={30}
              />

              <YAxis
                domain={yDomain}
                stroke={isDark ? '#8E8E93' : '#94A3B8'}
                tick={{ fontSize: chartWidth < 380 ? 8.5 : 9.5, fill: isDark ? '#8E8E93' : '#64748B' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatYAxisTick}
                width={chartWidth < 380 ? 38 : 48}
              />

              <Tooltip content={<CustomTooltip />} />

              {/* Vista TOTAL: Curva unica ad area di liquidità totale */}
              {viewMode === 'TOTAL' && (
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Liquidità Totale"
                  stroke="#E31B23"
                  strokeWidth={2.4}
                  fill="url(#totalAreaGrad)"
                  fillOpacity={1}
                  activeDot={{
                    r: isMobile ? 5 : 6,
                    stroke: '#E31B23',
                    strokeWidth: 2,
                    fill: isDark ? '#1C1C1E' : '#FFFFFF'
                  }}
                  isAnimationActive={true}
                  animationDuration={350}
                />
              )}

              {/* Vista SINGLE: Curva ad area per il singolo conto selezionato */}
              {viewMode === 'SINGLE' && selectedSingleAccount && (
                <Area
                  type="monotone"
                  dataKey={selectedSingleAccount.conto_id}
                  name={selectedSingleAccount.nome_conto}
                  stroke={activeSingleColor}
                  strokeWidth={2.4}
                  fill="url(#singleAreaGrad)"
                  fillOpacity={1}
                  activeDot={{
                    r: isMobile ? 5 : 6,
                    stroke: activeSingleColor,
                    strokeWidth: 2,
                    fill: isDark ? '#1C1C1E' : '#FFFFFF'
                  }}
                  isAnimationActive={true}
                  animationDuration={350}
                />
              )}

              {/* Vista ALL: Linee multiple distinte per conto */}
              {viewMode === 'ALL' &&
                activeItemsToDisplay.map(item => {
                  if (hiddenAccountIds.has(item.conto_id)) return null;
                  const color = accountColors.get(item.conto_id) || '#4F46E5';

                  return (
                    <Line
                      key={item.conto_id}
                      type="monotone"
                      dataKey={item.conto_id}
                      name={item.nome_conto}
                      stroke={color}
                      strokeWidth={1.9}
                      dot={false}
                      activeDot={{
                        r: isMobile ? 4 : 5,
                        stroke: color,
                        strokeWidth: 2,
                        fill: isDark ? '#1C1C1E' : '#FFFFFF'
                      }}
                      connectNulls={true}
                      isAnimationActive={true}
                      animationDuration={350}
                    />
                  );
                })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Griglia KPI Riassuntiva (2x2) fedele al mockup */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 pt-3 border-t border-slate-100 dark:border-white/5">
        {/* Inizio Periodo */}
        <div className="bg-[#F8F9FA] dark:bg-white/5 rounded-[20px] p-3 sm:p-3.5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block uppercase tracking-wider font-semibold">
            INIZIO PERIODO
          </span>
          <span className="font-numeric text-sm sm:text-base font-bold text-slate-900 dark:text-[#F5F5F7] mt-1">
            {formatCurrency(summaryMetrics.startTotal)}
          </span>
        </div>

        {/* Saldo Oggi */}
        <div className="bg-white dark:bg-[#1E1E24] rounded-[20px] p-3 sm:p-3.5 border border-rose-300/80 dark:border-[#E31B23]/50 flex flex-col justify-between relative shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#E31B23] block uppercase tracking-wider font-bold">
              SALDO OGGI
            </span>
            <span className="w-2 h-2 rounded-full bg-[#E31B23]" />
          </div>
          <span className="font-numeric text-sm sm:text-base font-extrabold text-slate-900 dark:text-[#F5F5F7] mt-1">
            {formatCurrency(summaryMetrics.todayTotal)}
          </span>
        </div>

        {/* Fine Periodo (Previsto) */}
        <div className="bg-[#F8F9FA] dark:bg-white/5 rounded-[20px] p-3 sm:p-3.5 flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block uppercase tracking-wider font-semibold">
              FINE PERIODO
            </span>
            <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block">
              (Previsto)
            </span>
          </div>
          <span className="font-numeric text-sm sm:text-base font-bold text-indigo-600 dark:text-indigo-400 mt-1">
            {formatCurrency(summaryMetrics.endTotal)}
          </span>
        </div>

        {/* Variazione Netta */}
        <div className="bg-[#F8F9FA] dark:bg-white/5 rounded-[20px] p-3 sm:p-3.5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block uppercase tracking-wider font-semibold">
            VARIAZIONE NETTA
          </span>
          <div className={`mt-1 font-numeric flex flex-col ${
            summaryMetrics.delta >= 0 
              ? 'text-emerald-600 dark:text-emerald-400' 
              : 'text-rose-600 dark:text-rose-400'
          }`}>
            <div className="flex items-center gap-1 text-sm sm:text-base font-bold">
              {summaryMetrics.delta >= 0 ? <TrendingUp size={14} className="flex-shrink-0" /> : <TrendingDown size={14} className="flex-shrink-0" />}
              <span>{formatCurrency(summaryMetrics.delta, { showSign: true })}</span>
            </div>
            <span className="text-[10px] font-semibold opacity-90">
              ({summaryMetrics.deltaPct >= 0 ? '+' : ''}{summaryMetrics.deltaPct}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
