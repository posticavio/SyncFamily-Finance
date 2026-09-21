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
import { Movement, Subcategory, Planned, Deadline } from '../types';
import { DB } from '../services/store';
import { formatCurrency, formatItalianNumber } from '../utils/formatters';
import { useTheme } from '../context/ThemeContext';
import { 
  getFinancialPeriodInfo, 
  isDateInFinancialMonth,
  getCurrentFinancialMonth 
} from '../utils/financialDate';
import {
  TrendingDown,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
  BarChart2,
  Minus,
  Sparkles,
  Clock,
  Compass
} from 'lucide-react';
import { Carousel } from './Carousel';

interface MonthlySpendingTrendsChartProps {
  movements: Movement[];
  subcategories?: Subcategory[];
  planned?: Planned[];
  deadlines?: Deadline[];
}

export type MonthlyTimeHorizon = 'CENTERED_7M' | 'CENTERED_13M' | 'PAST_6M' | 'FUTURE_6M';

export interface MonthlyDataPoint {
  monthKey: string; // 'YYYY-MM'
  shortLabel: string; // 'Set' o 'Set '26'
  fullLabel: string; // 'Settembre 2026'
  year: number;
  monthIndex: number; // 0-11
  offsetFromCurrent: number; // 0 = mese corrente, < 0 passato, > 0 futuro
  isCurrentMonth: boolean;
  isPast: boolean;
  isFuture: boolean;

  // Dati Spese
  expensesReal: number | null; // Consuntivo reale (null per mesi futuri)
  expensesPlanned: number; // Uscite pianificate + scadenze del mese
  expensesProjected: number; // Per passato = reale, per corrente = reale + pianificato, per futuro = pianificato
  expensesDashedLine: number | null; // Serie tratteggiata che connette corrente a futuro (o dall'ultimo mese concluso)

  // Dati Entrate (per vista Spese vs Entrate)
  incomesReal: number | null;
  incomesPlanned: number;
  incomesProjected: number;
  incomesDashedLine: number | null;

  // Saldi e metriche
  netProjected: number;
  transactionCount: number;
  plannedCount: number;
  topCategoryName: string;
  topCategoryAmount: number;
  diffPercentPrev: number | null;
}

const MONTH_NAMES_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const MONTH_NAMES_FULL = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

export const MonthlySpendingTrendsChart: React.FC<MonthlySpendingTrendsChartProps> = ({
  movements = [],
  subcategories = [],
  planned = [],
  deadlines = []
}) => {
  const { isDark } = useTheme();

  // Orizzonte temporale: DEFAULT con Mese Attuale AL CENTRO (±3 Mesi = 7 Mesi)
  const [timeHorizon, setTimeHorizon] = useState<MonthlyTimeHorizon>('CENTERED_7M');
  const [viewMode, setViewMode] = useState<'EXPENSES_ONLY' | 'COMPARE_INCOME'>('EXPENSES_ONLY');
  const [showPlannedLine, setShowPlannedLine] = useState<boolean>(true);
  const [showAverageLine, setShowAverageLine] = useState<boolean>(false);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Calcolo dati dell'orizzonte temporale selezionato con Mese Attuale centrato
  const {
    monthlyData,
    currentMonthPoint,
    totalExpensesHistorical,
    totalExpensesPlannedFuture,
    currentMonthProjection,
    avgMonthlyExpenses,
    maxMonth,
    minMonth,
    yMax
  } = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonthIndex = today.getMonth();
    const currentFinancialMonthKey = getCurrentFinancialMonth();

    // Determina gli offset in base all'orizzonte temporale
    let startOffset = -3;
    let endOffset = 3;

    if (timeHorizon === 'CENTERED_7M') {
      // Mese Attuale al centro: 3 mesi prima (-3, -2, -1), Mese Attuale (0), 3 mesi dopo (+1, +2, +3) = 7 mesi
      startOffset = -3;
      endOffset = 3;
    } else if (timeHorizon === 'CENTERED_13M') {
      // Mese Attuale al centro: 6 mesi prima (-6..-1), Mese Attuale (0), 6 mesi dopo (+1..+6) = 13 mesi (un anno intero)
      startOffset = -6;
      endOffset = 6;
    } else if (timeHorizon === 'PAST_6M') {
      // Solo Passato: da 5 mesi fa fino al mese corrente
      startOffset = -5;
      endOffset = 0;
    } else if (timeHorizon === 'FUTURE_6M') {
      // Solo Futuro: dal mese corrente fino a 5 mesi futuri
      startOffset = 0;
      endOffset = 5;
    }

    // Risorse pianificate e scadenze (con fallback al database globale se vuoti)
    const effectivePlanned = (planned && planned.length > 0) ? planned : (DB.PIANIFICATI || []);
    const effectiveDeadlines = (deadlines && deadlines.length > 0) ? deadlines : (DB.SCADENZE || []);

    const rawPoints: MonthlyDataPoint[] = [];

    for (let offset = startOffset; offset <= endOffset; offset++) {
      const d = new Date(currentYear, currentMonthIndex + offset, 1);
      const year = d.getFullYear();
      const monthIndex = d.getMonth();
      const monthStr = String(monthIndex + 1).padStart(2, '0');
      const monthKey = `${year}-${monthStr}`;
      const periodInfo = getFinancialPeriodInfo(monthKey);

      const shortLabel = year !== currentYear
        ? `${MONTH_NAMES_SHORT[monthIndex]} '${String(year).slice(-2)}`
        : MONTH_NAMES_SHORT[monthIndex];

      const fullLabel = periodInfo.label;
      const isCurrentMonth = offset === 0;
      const isPast = offset < 0;
      const isFuture = offset > 0;

      // 1. Movimenti Reali Confermati (inclusi nel mese finanziario)
      const monthMovs = (movements || []).filter(
        m => m.data && isDateInFinancialMonth(m.data, monthKey) && !(m as any).is_deleted
      );

      let expensesRealVal = 0;
      let incomesRealVal = 0;
      let txCount = 0;
      const catTotals: Record<string, number> = {};

      for (const m of monthMovs) {
        if (m.tipologia === 'USCITA') {
          expensesRealVal += m.importo;
          txCount++;

          const sub = subcategories.find(s => s.id === m.sottocategoria_id);
          const catName = sub?.categoria_padre?.trim() || sub?.nome?.trim() || 'Altro';
          catTotals[catName] = (catTotals[catName] || 0) + m.importo;
        } else if (m.tipologia === 'ENTRATA') {
          incomesRealVal += m.importo;
        }
      }

      expensesRealVal = Math.round(expensesRealVal * 100) / 100;
      incomesRealVal = Math.round(incomesRealVal * 100) / 100;

      // Trova la categoria con spesa maggiore
      let topCategoryName = 'Nessuna';
      let topCategoryAmount = 0;
      for (const [cName, cAmt] of Object.entries(catTotals)) {
        if (cAmt > topCategoryAmount) {
          topCategoryAmount = cAmt;
          topCategoryName = cName;
        }
      }

      // 2. Calcolo Spese e Entrate Pianificate / a Budget del mese finanziario
      // Inclusione di: Budget configurati (DB.BUDGET), Movimenti Pianificati pendenti (DB.PIANIFICATI), Scadenze e Ricorrenze
      const expenseSubIds = new Set((subcategories || DB.SOTTOCATEGORIE || []).filter(s => s.tipo === 'USCITA').map(s => s.id));
      const incomeSubIds = new Set((subcategories || DB.SOTTOCATEGORIE || []).filter(s => s.tipo === 'ENTRATA').map(s => s.id));

      // A. Budget configurato per le categorie di uscita
      const monthBudgets = (DB.BUDGET || []).filter(b => b.mese === monthKey && !(b as any).is_deleted && expenseSubIds.has(b.sottocategoria_id));
      let budgetExpVal = monthBudgets.reduce((sum, b) => sum + (b.importo_budget || 0), 0);

      // Se questo mese non ha budget configurati singolarmente (es. mesi futuri o passati),
      // ereditiamo il budget del mese corrente o l'ultimo mese noto come riferimento pianificato
      if (budgetExpVal === 0) {
        const curMonthBudgets = (DB.BUDGET || []).filter(b => b.mese === currentFinancialMonthKey && !(b as any).is_deleted && expenseSubIds.has(b.sottocategoria_id));
        const curSum = curMonthBudgets.reduce((sum, b) => sum + (b.importo_budget || 0), 0);
        if (curSum > 0) {
          budgetExpVal = curSum;
        } else {
          // Eventuale fallback su qualsiasi budget attivo in DB
          const anyBudgets = (DB.BUDGET || []).filter(b => !(b as any).is_deleted && expenseSubIds.has(b.sottocategoria_id));
          const anySum = anyBudgets.reduce((sum, b) => sum + (b.importo_budget || 0), 0);
          if (anySum > 0) budgetExpVal = anySum;
        }
      }

      // B. Movimenti Pianificati pendenti e Scadenze che cadono nel mese
      const monthPlanned = effectivePlanned.filter(p =>
        p.data_prevista &&
        isDateInFinancialMonth(p.data_prevista, monthKey) &&
        p.stato === 'PENDENTE' &&
        !(p as any).is_deleted
      );

      const monthDeadlines = effectiveDeadlines.filter(d =>
        d.data_scadenza &&
        isDateInFinancialMonth(d.data_scadenza, monthKey) &&
        d.stato === 'APERTA' &&
        !(d as any).is_deleted
      );

      let plannedCommitmentsExp = 0;
      let plannedCommitmentsInc = 0;
      let plannedCount = 0;

      for (const p of monthPlanned) {
        if (p.tipologia === 'USCITA') {
          plannedCommitmentsExp += p.importo;
          plannedCount++;
        } else if (p.tipologia === 'ENTRATA') {
          plannedCommitmentsInc += p.importo;
        }
      }

      for (const d of monthDeadlines) {
        plannedCommitmentsExp += d.importo_previsto;
        plannedCount++;
      }

      // C. Ricorrenze mensili attive (es. Mutuo, Fibra, Stipendio)
      const recurringExp = (DB.RICORRENZE || [])
        .filter(r => r.attiva && r.tipologia === 'USCITA' && !(r as any).is_deleted)
        .reduce((sum, r) => sum + r.importo, 0);

      const recurringInc = (DB.RICORRENZE || [])
        .filter(r => r.attiva && r.tipologia === 'ENTRATA' && !(r as any).is_deleted)
        .reduce((sum, r) => sum + r.importo, 0);

      // Totale Spese Pianificate del mese (da mostrare in tratteggiato)
      // Se c'è un budget impostato, esso costituisce l'obiettivo pianificato primario;
      // altrimenti usiamo gli impegni di spesa programmati e le ricorrenze
      let plannedExpVal = budgetExpVal > 0 
        ? budgetExpVal 
        : Math.round((plannedCommitmentsExp + recurringExp) * 100) / 100;

      let plannedIncVal = plannedCommitmentsInc > 0 
        ? plannedCommitmentsInc 
        : recurringInc;

      plannedExpVal = Math.round(plannedExpVal * 100) / 100;
      plannedIncVal = Math.round(plannedIncVal * 100) / 100;

      // 3. Calcolo Proiezioni di Spesa e Entrata
      let expensesProjected = 0;
      let incomesProjected = 0;
      let expensesReal: number | null = null;
      let incomesReal: number | null = null;

      if (isPast) {
        // Mese passato: consuntivo reale definitivo
        expensesReal = expensesRealVal;
        incomesReal = incomesRealVal;
        expensesProjected = expensesRealVal;
        incomesProjected = incomesRealVal;
      } else if (isCurrentMonth) {
        // Mese corrente: speso reale finora + eventuali uscite pianificate pendenti rimanenti
        expensesReal = expensesRealVal;
        incomesReal = incomesRealVal;
        expensesProjected = Math.round((expensesRealVal + plannedCommitmentsExp) * 100) / 100;
        incomesProjected = Math.round((incomesRealVal + plannedCommitmentsInc) * 100) / 100;
      } else {
        // Mese futuro: spesa reale non ancora avvenuta (null), la proiezione è il totale pianificato
        expensesReal = null;
        incomesReal = null;
        expensesProjected = plannedExpVal;
        incomesProjected = plannedIncVal;
      }

      const netProjected = Math.round((incomesProjected - expensesProjected) * 100) / 100;

      rawPoints.push({
        monthKey,
        shortLabel,
        fullLabel,
        year,
        monthIndex,
        offsetFromCurrent: offset,
        isCurrentMonth,
        isPast,
        isFuture,
        expensesReal,
        expensesPlanned: plannedExpVal,
        expensesProjected,
        // La linea tratteggiata riporta il valore pianificato autonomo di ciascun mese
        expensesDashedLine: plannedExpVal,
        incomesReal,
        incomesPlanned: plannedIncVal,
        incomesProjected,
        incomesDashedLine: plannedIncVal,
        netProjected,
        transactionCount: txCount,
        plannedCount,
        topCategoryName,
        topCategoryAmount: Math.round(topCategoryAmount * 100) / 100,
        diffPercentPrev: null
      });
    }

    // Calcolo variazione % rispetto al mese precedente per i punti
    const pointsWithDashed = rawPoints;

    // Calcolo variazione % rispetto al mese precedente
    for (let i = 1; i < pointsWithDashed.length; i++) {
      const prev = pointsWithDashed[i - 1].expensesProjected;
      const curr = pointsWithDashed[i].expensesProjected;
      if (prev > 0) {
        pointsWithDashed[i].diffPercentPrev = Math.round(((curr - prev) / prev) * 1000) / 10;
      } else if (curr > 0) {
        pointsWithDashed[i].diffPercentPrev = 100;
      } else {
        pointsWithDashed[i].diffPercentPrev = 0;
      }
    }

    // Calcolo Metriche di Sintesi
    const curPoint = pointsWithDashed.find(p => p.isCurrentMonth) || pointsWithDashed[0];
    const totalHistorical = Math.round(
      pointsWithDashed
        .filter(p => !p.isFuture)
        .reduce((sum, item) => sum + (item.expensesReal || 0), 0) * 100
    ) / 100;

    const calculatedPlannedFuture = Math.round(
      pointsWithDashed
        .filter(p => p.isFuture)
        .reduce((sum, item) => sum + item.expensesPlanned, 0) * 100
    ) / 100;

    const currentProj = curPoint ? curPoint.expensesProjected : 0;

    const allProjected = pointsWithDashed.map(p => p.expensesProjected);
    const avgExp = Math.round(
      (allProjected.reduce((sum, val) => sum + val, 0) / (allProjected.length || 1)) * 100
    ) / 100;

    let maxM = pointsWithDashed[0];
    let minM = pointsWithDashed[0];
    for (const item of pointsWithDashed) {
      if (item.expensesProjected > maxM.expensesProjected) maxM = item;
      if (item.expensesProjected < minM.expensesProjected) minM = item;
    }

    // Calcolo YMax per domain grafico Recharts
    const allNumericVals: number[] = [];
    pointsWithDashed.forEach(p => {
      if (p.expensesReal !== null) allNumericVals.push(p.expensesReal);
      if (p.expensesProjected > 0) allNumericVals.push(p.expensesProjected);
      if (viewMode === 'COMPARE_INCOME') {
        if (p.incomesReal !== null) allNumericVals.push(p.incomesReal);
        if (p.incomesProjected > 0) allNumericVals.push(p.incomesProjected);
      }
    });

    const maxChartVal = Math.max(...allNumericVals, 100);
    const calculatedYMax = Math.ceil((maxChartVal * 1.15) / 100) * 100;

    return {
      monthlyData: pointsWithDashed,
      currentMonthPoint: curPoint,
      totalExpensesHistorical: totalHistorical,
      totalExpensesPlannedFuture: calculatedPlannedFuture,
      currentMonthProjection: currentProj,
      avgMonthlyExpenses: avgExp,
      maxMonth: maxM,
      minMonth: minM,
      yMax: calculatedYMax
    };
  }, [timeHorizon, movements, subcategories, planned, deadlines, viewMode]);

  // Mese attualmente evidenziato al click
  const activePoint = useMemo(() => {
    if (selectedMonthKey) {
      return monthlyData.find(m => m.monthKey === selectedMonthKey) || currentMonthPoint;
    }
    return currentMonthPoint;
  }, [selectedMonthKey, monthlyData, currentMonthPoint]);

  // Custom Tick X-Axis per evidenziare il "Mese Attuale" al centro
  const renderCustomXAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const point = monthlyData.find(m => m.shortLabel === payload.value);
    const isCurrent = point?.isCurrentMonth;

    return (
      <g transform={`translate(${x},${y})`}>
        {isCurrent ? (
          <>
            <rect
              x={-24}
              y={2}
              width={48}
              height={19}
              rx={9.5}
              fill={isDark ? 'rgba(227, 27, 35, 0.25)' : 'rgba(244, 63, 94, 0.15)'}
              stroke={isDark ? '#E31B23' : '#f43f5e'}
              strokeWidth={1.2}
            />
            <text
              x={0}
              y={0}
              dy={15}
              textAnchor="middle"
              fill={isDark ? '#F5F5F7' : '#991b1b'}
              fontSize={11}
              fontWeight={800}
            >
              {payload.value}
            </text>
          </>
        ) : (
          <text
            x={0}
            y={0}
            dy={15}
            textAnchor="middle"
            fill={isDark ? (point?.isFuture ? '#71717A' : '#A1A1AA') : (point?.isFuture ? '#94a3b8' : '#64748b')}
            fontSize={11}
            fontWeight={point?.isFuture ? 500 : 600}
          >
            {payload.value}
          </text>
        )}
      </g>
    );
  };

  // Tooltip personalizzato Recharts ad alta leggibilità One UI
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as MonthlyDataPoint;
      return (
        <div className="bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-md px-3.5 py-3 rounded-2xl shadow-xl border border-slate-200/80 dark:border-white/10 text-xs min-w-[240px] z-50 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2 mb-2">
            <span className="font-bold text-slate-900 dark:text-[#F5F5F7] text-xs flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-400" />
              {data.fullLabel}
            </span>
            {data.isCurrentMonth ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E31B23]/15 text-[#E31B23] border border-[#E31B23]/30">
                📍 Mese Attuale
              </span>
            ) : data.isFuture ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center gap-1">
                <Clock size={10} />
                Pianificato
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-[#8E8E93]">
                Concluso
              </span>
            )}
          </div>

          <div className="space-y-1.5 font-numeric text-xs">
            {/* Dettaglio Spese */}
            {data.isCurrentMonth ? (
              <div className="space-y-1.5 pb-1 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1.5 font-medium text-[11px]">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    Speso Reale Finora:
                  </span>
                  <strong className="font-extrabold text-rose-600 dark:text-rose-400 text-sm">
                    {formatCurrency(data.expensesReal || 0)}
                  </strong>
                </div>

                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 border-t-2 border-dashed border-rose-400" />
                    Budget / Pianificato:
                  </span>
                  <span className="font-bold text-rose-500 dark:text-rose-300">
                    {formatCurrency(data.expensesPlanned)}
                  </span>
                </div>

                {data.expensesReal !== null && data.expensesPlanned > 0 && (
                  <div className="flex items-center justify-between text-[11px] pt-0.5 text-slate-500 dark:text-slate-400">
                    <span>Scostamento vs Budget:</span>
                    <span className={`font-bold ${data.expensesReal > data.expensesPlanned ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {data.expensesReal > data.expensesPlanned ? '+' : ''}{formatCurrency(data.expensesReal - data.expensesPlanned)} ({Math.round(((data.expensesReal - data.expensesPlanned) / data.expensesPlanned) * 100)}%)
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-dashed border-slate-100 dark:border-white/5 text-slate-900 dark:text-white font-bold text-xs">
                  <span>Totale Stimato Fine Mese:</span>
                  <span className="text-sm text-rose-600 dark:text-rose-400">
                    {formatCurrency(data.expensesProjected)}
                  </span>
                </div>
              </div>
            ) : data.isFuture ? (
              <div className="space-y-1.5 pb-1">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-3 h-0.5 border-t-2 border-dashed border-rose-500" />
                    Spese Pianificate (Budget):
                  </span>
                  <strong className="font-extrabold text-rose-600 dark:text-rose-400 text-sm">
                    {formatCurrency(data.expensesPlanned)}
                  </strong>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 pb-1">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    Spese Effettive:
                  </span>
                  <strong className="font-extrabold text-rose-600 dark:text-rose-400 text-sm">
                    {formatCurrency(data.expensesReal || 0)}
                  </strong>
                </div>

                {data.expensesPlanned > 0 && (
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 border-t-2 border-dashed border-rose-400" />
                      Budget Pianificato:
                    </span>
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      {formatCurrency(data.expensesPlanned)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Dettaglio Entrate (se attivo) */}
            {viewMode === 'COMPARE_INCOME' && (
              <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    {data.isFuture ? 'Entrate Pianificate:' : 'Entrate Totali:'}
                  </span>
                  <strong className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(data.incomesProjected)}
                  </strong>
                </div>

                <div className="flex items-center justify-between pt-0.5 text-[11px] text-slate-500 dark:text-[#8E8E93]">
                  <span>Saldo Netto Stimato:</span>
                  <span className={`font-bold ${data.netProjected >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {formatCurrency(data.netProjected, { showSign: true })}
                  </span>
                </div>
              </div>
            )}

            {/* Variazione rispetto al mese precedente */}
            {data.diffPercentPrev !== null && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-white/5 text-[11px]">
                <span className="text-slate-400 dark:text-slate-500">Vs Mese Prec.:</span>
                <span
                  className={`font-semibold flex items-center gap-0.5 ${
                    data.diffPercentPrev < 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : data.diffPercentPrev > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-500'
                  }`}
                >
                  {data.diffPercentPrev < 0 ? (
                    <ArrowDownRight size={13} />
                  ) : data.diffPercentPrev > 0 ? (
                    <ArrowUpRight size={13} />
                  ) : (
                    <Minus size={13} />
                  )}
                  {data.diffPercentPrev > 0 ? `+${data.diffPercentPrev}%` : `${data.diffPercentPrev}%`}
                </span>
              </div>
            )}

            {/* Categoria principale */}
            {data.topCategoryAmount > 0 && (
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#8E8E93] pt-1 border-t border-slate-100 dark:border-white/5">
                <span className="text-slate-400 truncate max-w-[100px]">Top Categoria:</span>
                <span className="font-medium text-slate-700 dark:text-slate-200 truncate max-w-[130px]">
                  {data.topCategoryName} ({formatCurrency(data.topCategoryAmount)})
                </span>
              </div>
            )}

            <div className="text-[10px] text-slate-400 dark:text-slate-500 pt-0.5 flex items-center justify-between">
              <span>{data.transactionCount} spese reali</span>
              {data.plannedCount > 0 && (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  {data.plannedCount} pianificate
                </span>
              )}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      id="monthly-spending-trends-card"
      className="bento-card p-4 sm:p-5 space-y-4 rounded-3xl bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 shadow-xs"
    >
      {/* Header con Titolo, Micro-Squircle e Controlli Interattivi */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold shrink-0">
              <TrendingDown size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#F5F5F7] tracking-tight flex items-center gap-2">
                Trend Spese Mensili
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E31B23]/10 text-[#E31B23] border border-[#E31B23]/20">
                  Mese al Centro
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#8E8E93]">
                Evoluzione con Mese Attuale centrato e proiezioni future pianificate tratteggiate
              </p>
            </div>
          </div>
        </div>

        {/* Toolbar Controlli: Orizzonte Temporale + Modalità + Toggle Tratteggio */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Selettore Orizzonte Temporale (Centratura Mese Attuale) */}
          <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200/70 dark:border-white/5 text-xs">
            <button
              onClick={() => setTimeHorizon('CENTERED_7M')}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
                timeHorizon === 'CENTERED_7M'
                  ? 'bg-white dark:bg-[#2A2A2E] text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 dark:text-[#8E8E93] hover:text-slate-800 dark:hover:text-white'
              }`}
              title="3 mesi passati, Mese Corrente al centro, 3 mesi futuri"
            >
              <Compass size={12} className={timeHorizon === 'CENTERED_7M' ? 'text-[#E31B23]' : ''} />
              <span>±3 Mesi (Centro)</span>
            </button>
            <button
              onClick={() => setTimeHorizon('CENTERED_13M')}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all ${
                timeHorizon === 'CENTERED_13M'
                  ? 'bg-white dark:bg-[#2A2A2E] text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 dark:text-[#8E8E93] hover:text-slate-800 dark:hover:text-white'
              }`}
              title="6 mesi passati, Mese Corrente al centro, 6 mesi futuri (13 mesi)"
            >
              ±6 Mesi
            </button>
            <button
              onClick={() => setTimeHorizon('PAST_6M')}
              className={`hidden sm:inline-block px-2.5 py-1 rounded-xl text-xs font-semibold transition-all ${
                timeHorizon === 'PAST_6M'
                  ? 'bg-white dark:bg-[#2A2A2E] text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 dark:text-[#8E8E93] hover:text-slate-800 dark:hover:text-white'
              }`}
              title="Solo passati: ultimi 6 mesi"
            >
              Passati 6M
            </button>
          </div>

          {/* Toggle Solo Spese vs Entrate */}
          <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200/70 dark:border-white/5 text-xs">
            <button
              onClick={() => setViewMode('EXPENSES_ONLY')}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all ${
                viewMode === 'EXPENSES_ONLY'
                  ? 'bg-white dark:bg-[#2A2A2E] text-rose-600 dark:text-rose-400 shadow-xs font-bold'
                  : 'text-slate-500 dark:text-[#8E8E93] hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Spese
            </button>
            <button
              onClick={() => setViewMode('COMPARE_INCOME')}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all ${
                viewMode === 'COMPARE_INCOME'
                  ? 'bg-white dark:bg-[#2A2A2E] text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                  : 'text-slate-500 dark:text-[#8E8E93] hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Spese vs Entrate
            </button>
          </div>

          {/* Toggle Linea Pianificato Tratteggiata */}
          <button
            onClick={() => setShowPlannedLine(!showPlannedLine)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
              showPlannedLine
                ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50 shadow-xs font-bold'
                : 'bg-white dark:bg-[#1C1C1E] text-slate-500 dark:text-[#8E8E93] border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
            title="Mostra o nascondi le linee tratteggiate del pianificato"
          >
            <span className="w-2.5 h-0.5 border-t-2 border-dashed border-rose-500" />
            <span className="hidden sm:inline">Pianificato</span>
          </button>

          {/* Toggle Media Mensile */}
          <button
            onClick={() => setShowAverageLine(!showAverageLine)}
            className={`px-2 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1 ${
              showAverageLine
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white shadow-xs'
                : 'bg-white dark:bg-[#1C1C1E] text-slate-600 dark:text-[#8E8E93] border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
            title="Mostra la linea della media mensile"
          >
            <BarChart2 size={13} />
            <span className="hidden md:inline">Media</span>
          </button>

          {/* Accordion Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            title={isCollapsed ? 'Espandi grafico trend' : 'Comprimi grafico trend'}
          >
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Griglia Metriche di Sintesi (Bento KPI Cards One UI con Carousel su Mobile) */}
          <Carousel
            id="monthly-spending-kpi-carousel"
            desktopGridClassName="sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 pt-1"
            showDots={true}
            showArrows={true}
            ariaLabel="Metriche di Sintesi Mensili"
          >
            {/* KPI 1: Storico Reale */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#242426] border border-slate-100 dark:border-white/5 space-y-1 h-full">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8E8E93] uppercase tracking-wide block">
                Consuntivo Storico Reale
              </span>
              <span className="font-numeric text-base sm:text-lg font-extrabold text-slate-900 dark:text-[#F5F5F7] block tabular-nums">
                {formatCurrency(totalExpensesHistorical)}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 block">
                Transazioni passate e finora
              </span>
            </div>

            {/* KPI 2: Mese Attuale (Reale + Pianificato) */}
            <div className="p-3.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 space-y-1 h-full">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wide block">
                  Mese Attuale (Stima)
                </span>
                <span className="w-2 h-2 rounded-full bg-[#E31B23]" />
              </div>
              <span className="font-numeric text-base sm:text-lg font-extrabold text-rose-700 dark:text-rose-300 block tabular-nums">
                {formatCurrency(currentMonthProjection)}
              </span>
              <span className="text-[11px] text-rose-600/80 dark:text-rose-400/80 block tabular-nums">
                Reale {formatCurrency(currentMonthPoint?.expensesReal || 0)} • Pianif. {formatCurrency(currentMonthPoint?.expensesPlanned || 0)}
              </span>
            </div>

            {/* KPI 3: Pianificato Futuro */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#242426] border border-slate-100 dark:border-white/5 space-y-1 h-full">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8E8E93] uppercase tracking-wide block">
                Pianificato Mesi Futuri
              </span>
              <span className="font-numeric text-base sm:text-lg font-extrabold text-amber-700 dark:text-amber-400 block tabular-nums">
                {formatCurrency(totalExpensesPlannedFuture)}
              </span>
              <span className="text-[11px] text-amber-600 dark:text-amber-500 block">
                Impegni e scadenze a venire
              </span>
            </div>

            {/* KPI 4: Media del Periodo */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#242426] border border-slate-100 dark:border-white/5 space-y-1 h-full">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8E8E93] uppercase tracking-wide block">
                Media Mensile Stimata
              </span>
              <span className="font-numeric text-base sm:text-lg font-extrabold text-slate-900 dark:text-[#F5F5F7] block tabular-nums">
                {formatCurrency(avgMonthlyExpenses)}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 block">
                Parametro di riferimento
              </span>
            </div>
          </Carousel>

          {/* Grafico Recharts Line Chart con Mese Attuale AL CENTRO */}
          <div className="w-full h-68 sm:h-76 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={monthlyData}
                margin={{ top: 18, right: 14, left: -10, bottom: 4 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload.length) {
                    const clickedMonth = e.activePayload[0].payload.monthKey;
                    setSelectedMonthKey(selectedMonthKey === clickedMonth ? null : clickedMonth);
                  }
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={isDark ? '#2A2A2E' : '#f1f5f9'}
                />

                <XAxis
                  dataKey="shortLabel"
                  tick={renderCustomXAxisTick}
                  tickLine={false}
                  axisLine={{ stroke: isDark ? '#334155' : '#e2e8f0' }}
                  dy={4}
                />

                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: isDark ? '#8E8E93' : '#64748b', fontSize: 10 }}
                  tickFormatter={(val) => val >= 1000 ? `${formatItalianNumber(val / 1000, { maximumFractionDigits: 1 })}k €` : `${formatItalianNumber(val, { maximumFractionDigits: 0 })} €`}
                  domain={[0, yMax]}
                />

                <Tooltip content={<CustomTooltip />} />

                {/* Linea Verticale di Riferimento su MESE ATTUALE al centro del grafico */}
                {currentMonthPoint && (
                  <ReferenceLine
                    x={currentMonthPoint.shortLabel}
                    stroke={isDark ? '#E31B23' : '#dc2626'}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    label={{
                      value: '📍 MESE ATTUALE',
                      position: 'top',
                      fill: isDark ? '#E31B23' : '#dc2626',
                      fontSize: 10,
                      fontWeight: 800,
                      offset: 8
                    }}
                  />
                )}

                {/* Linea di Riferimento della Media Mensile */}
                {showAverageLine && avgMonthlyExpenses > 0 && (
                  <ReferenceLine
                    y={avgMonthlyExpenses}
                    stroke={isDark ? '#64748b' : '#94a3b8'}
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: `Media: ${formatCurrency(avgMonthlyExpenses)}`,
                      position: 'top',
                      fill: isDark ? '#8E8E93' : '#64748b',
                      fontSize: 10,
                      fontWeight: 600
                    }}
                  />
                )}

                {/* 1. Serie Continua: SPESE REALI (Fino al Mese Corrente) */}
                <Line
                  type="monotone"
                  dataKey="expensesReal"
                  name="Spese Reali"
                  stroke="#f43f5e"
                  strokeWidth={3}
                  dot={{
                    r: 4.5,
                    fill: '#f43f5e',
                    stroke: isDark ? '#1C1C1E' : '#ffffff',
                    strokeWidth: 2
                  }}
                  activeDot={{
                    r: 7,
                    fill: '#f43f5e',
                    stroke: isDark ? '#1C1C1E' : '#ffffff',
                    strokeWidth: 3,
                    style: { filter: 'drop-shadow(0 2px 8px rgba(244, 63, 94, 0.45))' }
                  }}
                  animationDuration={800}
                />

                {/* 2. Serie Tratteggiata: SPESE PIANIFICATE / PROIETTATE (Mese Corrente e Futuro) */}
                {showPlannedLine && (
                  <Line
                    type="monotone"
                    dataKey="expensesDashedLine"
                    name="Spese Pianificate (Proiezione)"
                    stroke="#fb7185"
                    strokeWidth={2.5}
                    strokeDasharray="5 5"
                    dot={{
                      r: 4,
                      fill: isDark ? '#1C1C1E' : '#ffffff',
                      stroke: '#fb7185',
                      strokeWidth: 2
                    }}
                    activeDot={{
                      r: 6.5,
                      fill: '#fb7185',
                      stroke: isDark ? '#1C1C1E' : '#ffffff',
                      strokeWidth: 2.5
                    }}
                    animationDuration={800}
                  />
                )}

                {/* 3. Serie Continua: ENTRATE REALI (Se attivo confronto) */}
                {viewMode === 'COMPARE_INCOME' && (
                  <Line
                    type="monotone"
                    dataKey="incomesReal"
                    name="Entrate Reali"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{
                      r: 4,
                      fill: '#10b981',
                      stroke: isDark ? '#1C1C1E' : '#ffffff',
                      strokeWidth: 2
                    }}
                    activeDot={{
                      r: 6.5,
                      fill: '#10b981',
                      stroke: isDark ? '#1C1C1E' : '#ffffff',
                      strokeWidth: 2.5,
                      style: { filter: 'drop-shadow(0 2px 8px rgba(16, 185, 129, 0.45))' }
                    }}
                    animationDuration={800}
                  />
                )}

                {/* 4. Serie Tratteggiata: ENTRATE PIANIFICATE (Se attivo confronto) */}
                {viewMode === 'COMPARE_INCOME' && showPlannedLine && (
                  <Line
                    type="monotone"
                    dataKey="incomesDashedLine"
                    name="Entrate Pianificate"
                    stroke="#34d399"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{
                      r: 3.5,
                      fill: isDark ? '#1C1C1E' : '#ffffff',
                      stroke: '#34d399',
                      strokeWidth: 2
                    }}
                    activeDot={{
                      r: 6,
                      fill: '#34d399',
                      stroke: isDark ? '#1C1C1E' : '#ffffff',
                      strokeWidth: 2
                    }}
                    animationDuration={800}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Legenda del Grafico con indicazione delle Linee Tratteggiate */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-1 text-xs text-slate-500 dark:text-[#8E8E93]">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-1 rounded-full bg-rose-500" />
              <span className="font-semibold text-slate-700 dark:text-[#F5F5F7]">Spese Effettive (Consuntivo)</span>
            </div>

            {showPlannedLine && (
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 border-t-2 border-dashed border-rose-400" />
                <span className="font-semibold text-rose-600 dark:text-rose-400">Spese Pianificate (Tratteggiato)</span>
              </div>
            )}

            {viewMode === 'COMPARE_INCOME' && (
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-1 rounded-full bg-emerald-500" />
                <span className="font-semibold text-slate-700 dark:text-[#F5F5F7]">Entrate Effettive</span>
              </div>
            )}

            {viewMode === 'COMPARE_INCOME' && showPlannedLine && (
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 border-t-2 border-dashed border-emerald-400" />
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Entrate Pianificate</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
              <span className="w-2 h-2 rounded-full bg-[#E31B23]" />
              <span>Centro = Mese Attuale</span>
            </div>
          </div>

          {/* Schede Dettagliate Mese per Mese (One UI Grid) */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#8E8E93]">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Dettaglio Periodo Centrato</span>
              <span className="text-[11px] text-slate-400">Clicca su un mese per visualizzare il focus</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
              {monthlyData.map((item) => {
                const isSelected = activePoint.monthKey === item.monthKey;
                const isCurrent = item.isCurrentMonth;
                const isFut = item.isFuture;

                return (
                  <button
                    key={item.monthKey}
                    onClick={() => setSelectedMonthKey(isSelected ? null : item.monthKey)}
                    className={`p-2.5 rounded-2xl text-left transition-all border relative ${
                      isCurrent
                        ? 'bg-rose-50/60 dark:bg-rose-950/30 border-[#E31B23] shadow-xs ring-2 ring-[#E31B23]/20'
                        : isSelected
                        ? 'bg-slate-100 dark:bg-white/10 border-slate-400 dark:border-white/30 shadow-xs'
                        : 'bg-slate-50/70 dark:bg-[#242426]/70 hover:bg-slate-100/70 dark:hover:bg-[#2A2A2E] border-slate-200/70 dark:border-white/5'
                    }`}
                  >
                    {/* Badge Mese Attuale */}
                    {isCurrent && (
                      <div className="absolute -top-2 right-2 px-1.5 py-0.2 rounded-full bg-[#E31B23] text-white text-[9px] font-bold">
                        Attuale
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`text-xs font-bold truncate ${isCurrent ? 'text-[#E31B23]' : 'text-slate-900 dark:text-white'}`}>
                        {item.shortLabel}
                      </span>

                      {isFut ? (
                        <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1 py-0.2 rounded-md">
                          Pianif.
                        </span>
                      ) : item.diffPercentPrev !== null ? (
                        <span
                          className={`text-[10px] font-bold flex items-center font-numeric ${
                            item.diffPercentPrev < 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : item.diffPercentPrev > 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {item.diffPercentPrev > 0 ? `+${item.diffPercentPrev}%` : `${item.diffPercentPrev}%`}
                        </span>
                      ) : null}
                    </div>

                    <div className="font-numeric text-xs sm:text-sm font-extrabold text-slate-900 dark:text-[#F5F5F7] truncate">
                      {formatCurrency(item.expensesProjected)}
                    </div>

                    {isCurrent ? (
                      <div className="font-numeric text-[10px] text-slate-500 dark:text-[#8E8E93] truncate mt-0.5">
                        Reale: {formatCurrency(item.expensesReal || 0)} | Budget: {formatCurrency(item.expensesPlanned)}
                      </div>
                    ) : isFut ? (
                      <div className="font-numeric text-[10px] text-amber-600 dark:text-amber-400 truncate mt-0.5">
                        Pianificato: {formatCurrency(item.expensesPlanned)}
                      </div>
                    ) : item.expensesPlanned > 0 ? (
                      <div className="font-numeric text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        Budget: {formatCurrency(item.expensesPlanned)}
                      </div>
                    ) : null}

                    {viewMode === 'COMPARE_INCOME' && (
                      <div className="font-numeric text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold truncate mt-0.5">
                        +{formatCurrency(item.incomesProjected)}
                      </div>
                    )}

                    <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-1">
                      {item.isFuture ? `${item.plannedCount} impegni` : (item.topCategoryAmount > 0 ? item.topCategoryName : `${item.transactionCount} spese`)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
