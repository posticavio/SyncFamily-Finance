import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  Cell
} from 'recharts';
import { 
  Movement, 
  MovementType,
  Planned, 
  Deadline, 
  Subcategory, 
  SubcategoryClassification,
  getSubcategoryClassification
} from '../types';
import { DB } from '../services/store';
import { formatCurrency, formatItalianPercent } from '../utils/formatters';
import { 
  TrendingUp, 
  ShieldCheck, 
  Sparkles, 
  Layers, 
  BarChart3, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Info, 
  CheckCircle2, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  Search,
  ArrowLeftRight,
  Receipt,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import { haptics } from '../utils/haptics';

export interface MonthMovementAuditItem {
  id: string;
  data: string;
  descrizione: string;
  importo: number;
  tipologia: MovementType;
  conto_origine?: string;
  conto_destinazione?: string | null;
  sottocategoria_id?: string;
  subName: string;
  subColor?: string;
  macroClassification: 'GUADAGNI' | 'SPESE_ESSENZIALI' | 'SPESE_EXTRA' | 'GIROCONTO';
}

interface MonthlyMacroBreakdownChartProps {
  movements: Movement[];
  planned?: Planned[];
  deadlines?: Deadline[];
  subcategories: Subcategory[];
}

export interface MacroMonthData {
  monthKey: string;
  label: string;
  fullLabel: string;
  year: number;
  monthIndex: number; // 0-11
  isCurrent: boolean;
  isPast: boolean;
  isFuture: boolean;

  // Valori Consuntivo (Transazioni Reali)
  guadagniReal: number;
  speseEssenzialiReal: number;
  speseExtraReal: number;
  totaleSpeseReal: number;
  nettoReal: number;
  girocontiReal: number;
  girocontiCount: number;

  // Valori Pianificati (Impegni futuri e scadenze)
  guadagniPlanned: number;
  speseEssenzialiPlanned: number;
  speseExtraPlanned: number;

  // Valori Totali (Consuntivo + Eventuali Pianificati per mese corrente/futuro)
  guadagniTotal: number;
  speseEssenzialiTotal: number;
  speseExtraTotal: number;
  totaleSpeseTotal: number;
  nettoTotal: number;

  // Dettagli per drilldown e verifica analitica
  topEssenziali: { name: string; amount: number; color?: string }[];
  topExtra: { name: string; amount: number; color?: string }[];
  topGuadagni: { name: string; amount: number; color?: string }[];
  monthMovements: MonthMovementAuditItem[];
}

// Palette di colori ufficiale:
// - Guadagni: Verde smeraldo One UI (#10B981)
// - Spese Essenziali (Bisogni): Rosso One UI (#EF4444)
// - Spese Extra (Desideri): Giallo-Arancione ambrato caldo (#F59E0B)
const COLOR_GUADAGNI = '#10B981';
const COLOR_ESSENZIALI = '#EF4444';
const COLOR_EXTRA = '#F59E0B';

// Funzione per generare il path SVG con angoli superiori arrotondati e base dritta
function getTopRoundedPath(x: number, y: number, width: number, height: number, radius = 6) {
  if (height <= 0 || width <= 0) return '';
  const r = Math.min(radius, width / 2, height);
  if (r <= 0) {
    return `M${x},${y + height} L${x},${y} L${x + width},${y} L${x + width},${y + height} Z`;
  }
  return `M${x},${y + height} L${x},${y + r} A${r},${r} 0 0,1 ${x + r},${y} L${x + width - r},${y} A${r},${r} 0 0,1 ${x + width},${y + r} L${x + width},${y + height} Z`;
}

const MONTH_NAMES_SHORT = [
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'
];

const MONTH_NAMES_FULL = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

export const MonthlyMacroBreakdownChart: React.FC<MonthlyMacroBreakdownChartProps> = ({
  movements,
  planned = [],
  deadlines = [],
  subcategories,
  financialSettings
}) => {
  // Modalità di visualizzazione:
  // 'SIDE_BY_SIDE' = 3 barre separate (Guadagni, Essenziali, Extra)
  // 'STACKED_EXPENSES' = 2 barre: Guadagni a fianco delle Spese Composte (Essenziali + Extra impilate)
  // 'LINES' = Andamento a Linee (linea continua per consuntivo, linea tratteggiata per pianificato)
  const [chartMode, setChartMode] = useState<'SIDE_BY_SIDE' | 'STACKED_EXPENSES' | 'LINES'>('SIDE_BY_SIDE');
  
  // Toggle: includi pianificati / scadenze per mesi correnti e futuri
  const [includePlanned, setIncludePlanned] = useState<boolean>(true);

  // Tipo di periodo selezionato:
  // 'TRIMESTRALE' = 3 mesi centrati sul mese corrente
  // 'SEMESTRALE' = 6 mesi centrati sul mese corrente
  // 'ANNUALE' = 12 mesi con il mese corrente centrato (default)
  // 'ANNO_SOLARE' = Gennaio - Dicembre per l'anno solare selezionato
  const [periodType, setPeriodType] = useState<'TRIMESTRALE' | 'SEMESTRALE' | 'ANNUALE' | 'ANNO_SOLARE'>('ANNUALE');

  // Offset rispetto al mese corrente per la finestra centrata (0 = mese corrente al centro)
  const [centerMonthOffset, setCenterMonthOffset] = useState<number>(0);

  // Anno solare per la modalità ANNO_SOLARE (default: anno corrente)
  const [selectedCalendarYear, setSelectedCalendarYear] = useState<number>(() => new Date().getFullYear());

  // Mese selezionato per il drill-down dettagliato e analisi 50/30/20
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  // Stati interattivi per effetti al passaggio del mouse (hover effects)
  const [hoveredMonthKey, setHoveredMonthKey] = useState<string | null>(null);
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null);

  // Stati per la sezione di audit analitico e verifica trasparente dei singoli movimenti del mese
  const [auditFilter, setAuditFilter] = useState<'ALL' | 'GUADAGNI' | 'SPESE_ESSENZIALI' | 'SPESE_EXTRA' | 'GIROCONTO'>('ALL');
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [showAllAuditMovements, setShowAllAuditMovements] = useState<boolean>(false);

  // Renderizzatore Barra Reale (Consuntivo - Pieno) con effetti hover e bagliore
  const renderSolidBar = (plannedKey: string, seriesKey: string) => {
    return (props: any) => {
      const { x, y, width, height, fill, payload } = props;
      if (!width || height <= 0) return null;
      const hasPlannedAbove = payload && (payload[plannedKey] || 0) > 0;
      const r = hasPlannedAbove ? 0 : Math.min(6, width / 2, height / 2);
      const d = getTopRoundedPath(x, y, width, height, r);

      const isMonthHovered = hoveredMonthKey === payload?.monthKey;
      const isThisSeriesHovered = hoveredSeries === seriesKey;

      let opacity = 1;
      if (hoveredSeries) {
        opacity = isThisSeriesHovered ? 1 : 0.32;
      } else if (hoveredMonthKey) {
        opacity = isMonthHovered ? 1 : 0.42;
      }

      const isGlow = isThisSeriesHovered || (isMonthHovered && (!hoveredSeries || isThisSeriesHovered));
      const filter = isGlow
        ? `brightness(1.22) drop-shadow(0 4px 10px ${fill}75)`
        : undefined;

      return (
        <path
          d={d}
          fill={fill}
          opacity={opacity}
          stroke={isThisSeriesHovered ? '#FFFFFF' : (isMonthHovered ? fill : 'none')}
          strokeWidth={isThisSeriesHovered ? 1.5 : (isMonthHovered ? 1 : 0)}
          style={{
            filter,
            transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            cursor: 'pointer'
          }}
          onMouseEnter={() => {
            if (payload?.monthKey) setHoveredMonthKey(payload.monthKey);
            setHoveredSeries(seriesKey);
          }}
          onMouseLeave={() => setHoveredSeries(null)}
        />
      );
    };
  };

  // Renderizzatore Barra Pianificata (Pianificato & Scadenze - Motivo tratteggiato/zebrato con stessi colori) con effetti hover
  const renderDashedBar = (seriesKey: string) => {
    return (props: any) => {
      const { x, y, width, height, fill, payload } = props;
      if (!width || height <= 0) return null;
      const r = Math.min(6, width / 2, height / 2);
      const d = getTopRoundedPath(x, y, width, height, r);

      const isMonthHovered = hoveredMonthKey === payload?.monthKey;
      const isThisSeriesHovered = hoveredSeries === seriesKey;

      let opacity = 1;
      if (hoveredSeries) {
        opacity = isThisSeriesHovered ? 1 : 0.35;
      } else if (hoveredMonthKey) {
        opacity = isMonthHovered ? 1 : 0.45;
      }

      const isGlow = isThisSeriesHovered || (isMonthHovered && (!hoveredSeries || isThisSeriesHovered));
      const filter = isGlow
        ? `brightness(1.25) drop-shadow(0 4px 10px ${fill}70)`
        : undefined;

      const patternId = seriesKey === 'guadagni'
        ? 'pattern-planned-guadagni'
        : seriesKey === 'speseEssenziali'
          ? 'pattern-planned-essenziali'
          : 'pattern-planned-extra';

      return (
        <path
          d={d}
          fill={`url(#${patternId})`}
          stroke={isThisSeriesHovered ? '#FFFFFF' : fill}
          strokeWidth={isGlow ? 2.5 : 2}
          strokeDasharray="4 3"
          opacity={opacity}
          style={{
            filter,
            transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            cursor: 'pointer'
          }}
          onMouseEnter={() => {
            if (payload?.monthKey) setHoveredMonthKey(payload.monthKey);
            setHoveredSeries(seriesKey);
          }}
          onMouseLeave={() => setHoveredSeries(null)}
        />
      );
    };
  };

  // Renderizzatore Barra per modalità Spese Composte Stacked con effetti hover
  const renderStackedExpense = (isDashed: boolean, seriesKey: string, isTopCheck: (payload: any) => boolean) => {
    return (props: any) => {
      const { x, y, width, height, fill, payload } = props;
      if (!width || height <= 0) return null;
      const isAtTop = isTopCheck(payload);
      const r = isAtTop ? Math.min(6, width / 2, height / 2) : 0;
      const d = getTopRoundedPath(x, y, width, height, r);

      const isMonthHovered = hoveredMonthKey === payload?.monthKey;
      const isThisSeriesHovered = hoveredSeries === seriesKey;

      let opacity = 1;
      if (hoveredSeries) {
        opacity = isThisSeriesHovered ? 1 : 0.35;
      } else if (hoveredMonthKey) {
        opacity = isMonthHovered ? 1 : 0.45;
      }

      const isGlow = isThisSeriesHovered || (isMonthHovered && (!hoveredSeries || isThisSeriesHovered));
      const filter = isGlow
        ? `brightness(1.22) drop-shadow(0 4px 10px ${fill}70)`
        : undefined;

      if (isDashed) {
        const patternId = seriesKey === 'speseEssenziali'
          ? 'pattern-planned-essenziali'
          : 'pattern-planned-extra';

        return (
          <path
            d={d}
            fill={`url(#${patternId})`}
            stroke={isThisSeriesHovered ? '#FFFFFF' : fill}
            strokeWidth={isGlow ? 2.5 : 2}
            strokeDasharray="4 3"
            opacity={opacity}
            style={{
              filter,
              transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
              cursor: 'pointer'
            }}
            onMouseEnter={() => {
              if (payload?.monthKey) setHoveredMonthKey(payload.monthKey);
              setHoveredSeries(seriesKey);
            }}
            onMouseLeave={() => setHoveredSeries(null)}
          />
        );
      }

      return (
        <path
          d={d}
          fill={fill}
          opacity={opacity}
          stroke={isThisSeriesHovered ? '#FFFFFF' : (isMonthHovered ? fill : 'none')}
          strokeWidth={isThisSeriesHovered ? 1.5 : (isMonthHovered ? 1 : 0)}
          style={{
            filter,
            transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            cursor: 'pointer'
          }}
          onMouseEnter={() => {
            if (payload?.monthKey) setHoveredMonthKey(payload.monthKey);
            setHoveredSeries(seriesKey);
          }}
          onMouseLeave={() => setHoveredSeries(null)}
        />
      );
    };
  };

  // Mappa rapida per sottocategorie
  const subMap = useMemo(() => {
    const map = new Map<string, Subcategory>();
    subcategories.forEach(s => map.set(s.id, s));
    return map;
  }, [subcategories]);

  // Calcolo dati mensili con centratura sul mese corrente e supporto tipologie periodo
  const monthlyData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const nowDate = new Date(currentYear, currentMonth, 1);

    type MonthDescriptor = {
      year: number;
      mIdx: number;
      monthKey: string;
      isCurrent: boolean;
      isPast: boolean;
      isFuture: boolean;
    };

    const targetMonths: MonthDescriptor[] = [];

    if (periodType === 'ANNO_SOLARE') {
      for (let mIdx = 0; mIdx < 12; mIdx++) {
        const d = new Date(selectedCalendarYear, mIdx, 1);
        const year = selectedCalendarYear;
        const monthKey = `${year}-${String(mIdx + 1).padStart(2, '0')}`;
        const isCurrent = monthKey === currentKey;
        const isPast = d < nowDate;
        const isFuture = d > nowDate;
        targetMonths.push({ year, mIdx, monthKey, isCurrent, isPast, isFuture });
      }
    } else {
      // Finestre temporali centrate sul mese corrente (o con offset navigato)
      let pastCount = 6;
      let futureCount = 5;
      if (periodType === 'TRIMESTRALE') {
        pastCount = 1;
        futureCount = 1; // 3 Mesi: -1, 0 (centro), +1
      } else if (periodType === 'SEMESTRALE') {
        pastCount = 3;
        futureCount = 2; // 6 Mesi: -3, -2, -1, 0 (centro), +1, +2
      } else {
        // ANNUALE (12 Mesi): 6 mesi prima, mese corrente esattamente al centro, 5 mesi dopo
        pastCount = 6;
        futureCount = 5;
      }

      const centerDate = new Date(currentYear, currentMonth + centerMonthOffset, 1);
      const centerYear = centerDate.getFullYear();
      const centerMIdx = centerDate.getMonth();

      for (let offset = -pastCount; offset <= futureCount; offset++) {
        const d = new Date(centerYear, centerMIdx + offset, 1);
        const year = d.getFullYear();
        const mIdx = d.getMonth();
        const monthKey = `${year}-${String(mIdx + 1).padStart(2, '0')}`;
        const isCurrent = monthKey === currentKey;
        const isPast = d < nowDate;
        const isFuture = d > nowDate;
        targetMonths.push({ year, mIdx, monthKey, isCurrent, isPast, isFuture });
      }
    }

    const result: MacroMonthData[] = [];

    for (const item of targetMonths) {
      const { year, mIdx, monthKey, isCurrent, isPast, isFuture } = item;

      // Aggregatori per questo mese
      let guadagniReal = 0;
      let speseEssenzialiReal = 0;
      let speseExtraReal = 0;
      let girocontiReal = 0;
      let girocontiCount = 0;

      let guadagniPlanned = 0;
      let speseEssenzialiPlanned = 0;
      let speseExtraPlanned = 0;

      const essenzialiSubBreakdown: Record<string, { name: string; amount: number; color?: string }> = {};
      const extraSubBreakdown: Record<string, { name: string; amount: number; color?: string }> = {};
      const guadagniSubBreakdown: Record<string, { name: string; amount: number; color?: string }> = {};
      const monthMovementsList: MonthMovementAuditItem[] = [];

      // 1. Transazioni Reali (Movements)
      movements.forEach(m => {
        if (m.is_deleted) return;
        if (!m.data) return;
        const mKey = m.data.slice(0, 7);
        if (mKey !== monthKey) return;

        const sub = m.sottocategoria_id ? subMap.get(m.sottocategoria_id) : undefined;
        const macro = getSubcategoryClassification(sub);
        const subName = sub?.nome || (m.tipologia === 'ENTRATA' ? 'Entrata generica' : m.tipologia === 'GIROCONTO' ? 'Giroconto' : 'Spesa generica');
        const subColor = sub?.colore;
        const absAmount = Math.abs(m.importo || 0);

        // Identificazione rigorosa di GIROCONTO / Trasferimento interno tra propri conti:
        // I trasferimenti NON aumentano il reddito né costituiscono spese a fondo perduto per la famiglia
        const isTransfer = 
          m.tipologia === 'GIROCONTO' || 
          sub?.tipo === 'GIROCONTO' || 
          Boolean(sub?.categoria_padre && sub.categoria_padre.toLowerCase().includes('trasferiment')) || 
          Boolean(sub?.nome && sub.nome.toLowerCase().includes('giroconto')) ||
          Boolean(m.conto_destinazione && m.conto_destinazione !== m.conto_origine && m.tipologia !== 'ENTRATA' && m.tipologia !== 'USCITA');

        if (isTransfer) {
          girocontiReal += absAmount;
          girocontiCount += 1;
          monthMovementsList.push({
            id: m.id,
            data: m.data,
            descrizione: m.descrizione || 'Giroconto tra conti',
            importo: absAmount,
            tipologia: 'GIROCONTO',
            conto_origine: m.conto_origine,
            conto_destinazione: m.conto_destinazione,
            sottocategoria_id: m.sottocategoria_id,
            subName: sub?.nome || 'Giroconto',
            subColor: subColor || '#6366f1',
            macroClassification: 'GIROCONTO'
          });
          return;
        }

        if (m.tipologia === 'ENTRATA') {
          guadagniReal += absAmount;
          if (!guadagniSubBreakdown[subName]) {
            guadagniSubBreakdown[subName] = { name: subName, amount: 0, color: subColor };
          }
          guadagniSubBreakdown[subName].amount += absAmount;
          monthMovementsList.push({
            id: m.id,
            data: m.data,
            descrizione: m.descrizione || 'Entrata',
            importo: absAmount,
            tipologia: 'ENTRATA',
            conto_origine: m.conto_origine,
            conto_destinazione: m.conto_destinazione,
            sottocategoria_id: m.sottocategoria_id,
            subName,
            subColor: subColor || COLOR_GUADAGNI,
            macroClassification: 'GUADAGNI'
          });
        } else if (m.tipologia === 'USCITA') {
          if (macro === 'SPESE_ESSENZIALI') {
            speseEssenzialiReal += absAmount;
            if (!essenzialiSubBreakdown[subName]) {
              essenzialiSubBreakdown[subName] = { name: subName, amount: 0, color: subColor };
            }
            essenzialiSubBreakdown[subName].amount += absAmount;
            monthMovementsList.push({
              id: m.id,
              data: m.data,
              descrizione: m.descrizione || 'Spesa essenziale',
              importo: absAmount,
              tipologia: 'USCITA',
              conto_origine: m.conto_origine,
              conto_destinazione: m.conto_destinazione,
              sottocategoria_id: m.sottocategoria_id,
              subName,
              subColor: subColor || COLOR_ESSENZIALI,
              macroClassification: 'SPESE_ESSENZIALI'
            });
          } else {
            // SPESE_EXTRA
            speseExtraReal += absAmount;
            if (!extraSubBreakdown[subName]) {
              extraSubBreakdown[subName] = { name: subName, amount: 0, color: subColor };
            }
            extraSubBreakdown[subName].amount += absAmount;
            monthMovementsList.push({
              id: m.id,
              data: m.data,
              descrizione: m.descrizione || 'Spesa extra',
              importo: absAmount,
              tipologia: 'USCITA',
              conto_origine: m.conto_origine,
              conto_destinazione: m.conto_destinazione,
              sottocategoria_id: m.sottocategoria_id,
              subName,
              subColor: subColor || COLOR_EXTRA,
              macroClassification: 'SPESE_EXTRA'
            });
          }
        }
      });

      // Ordina i movimenti per data discendente
      monthMovementsList.sort((a, b) => (b.data || '').localeCompare(a.data || ''));

      // 2. Transazioni Pianificate e Scadenze (se abilitate, per mese corrente e futuri)
      if (isCurrent || isFuture) {
        // Movimenti pianificati
        planned.forEach(p => {
          if (p.is_deleted) return;
          if (!p.data_prevista) return;
          const pKey = p.data_prevista.slice(0, 7);
          if (pKey !== monthKey) return;

          const sub = p.sottocategoria_id ? subMap.get(p.sottocategoria_id) : undefined;
          const isPlanTransfer = 
            p.tipologia === 'GIROCONTO' || 
            sub?.tipo === 'GIROCONTO' || 
            Boolean(sub?.categoria_padre && sub.categoria_padre.toLowerCase().includes('trasferiment')) || 
            Boolean(sub?.nome && sub.nome.toLowerCase().includes('giroconto')) ||
            Boolean(p.conto_destinazione && p.conto_destinazione !== p.conto_origine && p.tipologia !== 'ENTRATA' && p.tipologia !== 'USCITA');

          if (isPlanTransfer) return;

          const macro = getSubcategoryClassification(sub);
          const subName = sub?.nome || (p.tipologia === 'ENTRATA' ? 'Pianificato Entrata' : 'Pianificato Spesa');
          const subColor = sub?.colore;
          const absAmount = Math.abs(p.importo || 0);

          if (p.tipologia === 'ENTRATA') {
            guadagniPlanned += absAmount;
            if (!guadagniSubBreakdown[subName]) {
              guadagniSubBreakdown[subName] = { name: subName, amount: 0, color: subColor };
            }
            guadagniSubBreakdown[subName].amount += absAmount;
          } else if (p.tipologia === 'USCITA') {
            if (macro === 'SPESE_ESSENZIALI') {
              speseEssenzialiPlanned += absAmount;
              if (!essenzialiSubBreakdown[subName]) {
                essenzialiSubBreakdown[subName] = { name: subName, amount: 0, color: subColor };
              }
              essenzialiSubBreakdown[subName].amount += absAmount;
            } else {
              speseExtraPlanned += absAmount;
              if (!extraSubBreakdown[subName]) {
                extraSubBreakdown[subName] = { name: subName, amount: 0, color: subColor };
              }
              extraSubBreakdown[subName].amount += absAmount;
            }
          }
        });

        // Scadenze aperte
        deadlines.forEach(dl => {
          if (dl.is_deleted || dl.stato === 'PAGATO') return;
          if (!dl.data_scadenza) return;
          const dlKey = dl.data_scadenza.slice(0, 7);
          if (dlKey !== monthKey) return;

          const sub = dl.sottocategoria_id ? subMap.get(dl.sottocategoria_id) : undefined;
          if (sub?.tipo === 'GIROCONTO') return;

          const macro = getSubcategoryClassification(sub);
          const subName = sub?.nome || dl.titolo || 'Scadenza';
          const subColor = sub?.colore;
          const absAmount = Math.abs(dl.importo_previsto || 0);

          if (macro === 'SPESE_ESSENZIALI') {
            speseEssenzialiPlanned += absAmount;
            if (!essenzialiSubBreakdown[subName]) {
              essenzialiSubBreakdown[subName] = { name: subName, amount: 0, color: subColor };
            }
            essenzialiSubBreakdown[subName].amount += absAmount;
          } else {
            speseExtraPlanned += absAmount;
            if (!extraSubBreakdown[subName]) {
              extraSubBreakdown[subName] = { name: subName, amount: 0, color: subColor };
            }
            extraSubBreakdown[subName].amount += absAmount;
          }
        });
      }

      // Consuntivo
      const totaleSpeseReal = Math.round((speseEssenzialiReal + speseExtraReal) * 100) / 100;
      const nettoReal = Math.round((guadagniReal - totaleSpeseReal) * 100) / 100;

      // Totale con pianificato
      const guadagniTotal = Math.round((guadagniReal + (isPast ? 0 : guadagniPlanned)) * 100) / 100;
      const speseEssenzialiTotal = Math.round((speseEssenzialiReal + (isPast ? 0 : speseEssenzialiPlanned)) * 100) / 100;
      const speseExtraTotal = Math.round((speseExtraReal + (isPast ? 0 : speseExtraPlanned)) * 100) / 100;
      const totaleSpeseTotal = Math.round((speseEssenzialiTotal + speseExtraTotal) * 100) / 100;
      const nettoTotal = Math.round((guadagniTotal - totaleSpeseTotal) * 100) / 100;

      // Top categorie per drilldown
      const topEssenziali = Object.values(essenzialiSubBreakdown)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      const topExtra = Object.values(extraSubBreakdown)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      const topGuadagni = Object.values(guadagniSubBreakdown)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      result.push({
        monthKey,
        label: `${MONTH_NAMES_SHORT[mIdx]} '${String(year).slice(-2)}`,
        fullLabel: `${MONTH_NAMES_FULL[mIdx]} ${year}`,
        year,
        monthIndex: mIdx,
        isCurrent,
        isPast,
        isFuture,
        guadagniReal: Math.round(guadagniReal * 100) / 100,
        speseEssenzialiReal: Math.round(speseEssenzialiReal * 100) / 100,
        speseExtraReal: Math.round(speseExtraReal * 100) / 100,
        totaleSpeseReal,
        nettoReal,
        girocontiReal: Math.round(girocontiReal * 100) / 100,
        girocontiCount,
        guadagniPlanned: Math.round((isPast ? 0 : guadagniPlanned) * 100) / 100,
        speseEssenzialiPlanned: Math.round((isPast ? 0 : speseEssenzialiPlanned) * 100) / 100,
        speseExtraPlanned: Math.round((isPast ? 0 : speseExtraPlanned) * 100) / 100,
        guadagniTotal,
        speseEssenzialiTotal,
        speseExtraTotal,
        totaleSpeseTotal,
        nettoTotal,
        topEssenziali,
        topExtra,
        topGuadagni,
        monthMovements: monthMovementsList
      });
    }

    return result;
  }, [movements, planned, deadlines, subMap, periodType, centerMonthOffset, selectedCalendarYear]);

  // Etichetta descrittiva del periodo visualizzato
  const periodWindowLabel = useMemo(() => {
    if (periodType === 'ANNO_SOLARE') {
      return `Anno ${selectedCalendarYear}`;
    }
    if (!monthlyData.length) return '';
    const first = monthlyData[0]?.label || '';
    const last = monthlyData[monthlyData.length - 1]?.label || '';
    const isCenteredOnToday = centerMonthOffset === 0;

    if (isCenteredOnToday) {
      const currentMonth = monthlyData.find(m => m.isCurrent);
      return `${first} – ${last} • ${currentMonth?.label || 'Mese corrente'} al centro`;
    }
    return `${first} – ${last}`;
  }, [periodType, selectedCalendarYear, monthlyData, centerMonthOffset]);

  // Se nessun mese è esplicitamente selezionato, usiamo il mese corrente
  const currentMonthData = useMemo(() => {
    if (selectedMonthKey) {
      const found = monthlyData.find(m => m.monthKey === selectedMonthKey);
      if (found) return found;
    }
    return monthlyData.find(m => m.isCurrent) || monthlyData[monthlyData.length - 1] || monthlyData[0];
  }, [monthlyData, selectedMonthKey]);

  // Calcolo totali cumulativi dell'intero periodo per i riassunti in alto
  const periodSummary = useMemo(() => {
    let totGuadagni = 0;
    let totEssenziali = 0;
    let totExtra = 0;

    monthlyData.forEach(m => {
      const g = includePlanned ? m.guadagniTotal : m.guadagniReal;
      const ess = includePlanned ? m.speseEssenzialiTotal : m.speseEssenzialiReal;
      const ext = includePlanned ? m.speseExtraTotal : m.speseExtraReal;

      totGuadagni += g;
      totEssenziali += ess;
      totExtra += ext;
    });

    const totSpese = totEssenziali + totExtra;
    const netto = totGuadagni - totSpese;

    const essenzialiPercent = totGuadagni > 0 ? (totEssenziali / totGuadagni) * 100 : 0;
    const extraPercent = totGuadagni > 0 ? (totExtra / totGuadagni) * 100 : 0;
    const risparmioPercent = totGuadagni > 0 ? Math.max(0, (netto / totGuadagni) * 100) : 0;

    return {
      totGuadagni: Math.round(totGuadagni * 100) / 100,
      totEssenziali: Math.round(totEssenziali * 100) / 100,
      totExtra: Math.round(totExtra * 100) / 100,
      totSpese: Math.round(totSpese * 100) / 100,
      netto: Math.round(netto * 100) / 100,
      essenzialiPercent: Math.round(essenzialiPercent * 10) / 10,
      extraPercent: Math.round(extraPercent * 10) / 10,
      risparmioPercent: Math.round(risparmioPercent * 10) / 10
    };
  }, [monthlyData, includePlanned]);

  // Formattatore di valuta italiano conforme agli standard One UI (#.##0,00 €)
  const formatCur = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return '0,00\u00A0€';
    return formatCurrency(val);
  };

  // 50/30/20 per il mese correntemente selezionato
  const activeMonth503020 = useMemo(() => {
    if (!currentMonthData) {
      return { essPercent: 0, extPercent: 0, savePercent: 0, income: 0, ess: 0, ext: 0, net: 0 };
    }
    const income = includePlanned ? currentMonthData.guadagniTotal : currentMonthData.guadagniReal;
    const ess = includePlanned ? currentMonthData.speseEssenzialiTotal : currentMonthData.speseEssenzialiReal;
    const ext = includePlanned ? currentMonthData.speseExtraTotal : currentMonthData.speseExtraReal;
    const net = income - (ess + ext);

    const essPercent = income > 0 ? Math.round((ess / income) * 100) : 0;
    const extPercent = income > 0 ? Math.round((ext / income) * 100) : 0;
    const savePercent = income > 0 ? Math.max(0, Math.round((net / income) * 100)) : 0;

    return { essPercent, extPercent, savePercent, income, ess, ext, net };
  }, [currentMonthData, includePlanned]);

  // Mappa dei conti per etichette e nomi nelle righe di audit
  const accountMap = useMemo(() => {
    return new Map((DB.CONTI || []).map(a => [a.id, a]));
  }, []);

  // Movimenti del mese selezionato filtrati per categoria/macro e per testo di ricerca
  const filteredAuditMovements = useMemo(() => {
    if (!currentMonthData) return [];
    let list = currentMonthData.monthMovements || [];
    if (auditFilter !== 'ALL') {
      list = list.filter(m => m.macroClassification === auditFilter);
    }
    if (auditSearch.trim()) {
      const q = auditSearch.trim().toLowerCase();
      list = list.filter(m => {
        const originName = (m.conto_origine ? (accountMap.get(m.conto_origine)?.nome_conto || '') : '').toLowerCase();
        const destName = (m.conto_destinazione ? (accountMap.get(m.conto_destinazione)?.nome_conto || '') : '').toLowerCase();
        return (
          m.descrizione.toLowerCase().includes(q) ||
          m.subName.toLowerCase().includes(q) ||
          originName.includes(q) ||
          destName.includes(q)
        );
      });
    }
    return list;
  }, [currentMonthData, auditFilter, auditSearch, accountMap]);

  // Preparazione punti per Recharts
  const chartPoints = useMemo(() => {
    return monthlyData.map(m => {
      const gReal = m.guadagniReal;
      const essReal = m.speseEssenzialiReal;
      const extReal = m.speseExtraReal;

      // Se includePlanned è attivo, mostriamo la quota tratteggiata pianificata
      const gPlanned = includePlanned ? m.guadagniPlanned : 0;
      const essPlanned = includePlanned ? m.speseEssenzialiPlanned : 0;
      const extPlanned = includePlanned ? m.speseExtraPlanned : 0;

      const gTotal = gReal + gPlanned;
      const essTotal = essReal + essPlanned;
      const extTotal = extReal + extPlanned;
      const totaleSpese = essTotal + extTotal;
      const netto = gTotal - totaleSpese;

      return {
        monthKey: m.monthKey,
        label: m.label,
        fullLabel: m.fullLabel,
        isCurrent: m.isCurrent,
        isFuture: m.isFuture,
        // Dati suddivisi per serie
        guadagniReal: gReal,
        guadagniPlanned: gPlanned,
        guadagniTotal: gTotal,

        speseEssenzialiReal: essReal,
        speseEssenzialiPlanned: essPlanned,
        speseEssenzialiTotal: essTotal,

        speseExtraReal: extReal,
        speseExtraPlanned: extPlanned,
        speseExtraTotal: extTotal,

        totaleSpese,
        netto
      };
    });
  }, [monthlyData, includePlanned]);

  // Renderizzatore etichette asse X personalizzato con pillola hover/selezionato/corrente One UI
  const renderCustomXAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const item = chartPoints.find(p => p.label === payload.value);
    const isHovered = item && item.monthKey === hoveredMonthKey;
    const isSelected = item && item.monthKey === selectedMonthKey;
    const isCurrent = item && item.isCurrent;

    return (
      <g transform={`translate(${x},${y})`}>
        {/* Pillola sfondo al passaggio del mouse */}
        {isHovered && (
          <rect
            x={-20}
            y={2}
            width={40}
            height={18}
            rx={9}
            fill="rgba(255, 255, 255, 0.14)"
            stroke="rgba(255, 255, 255, 0.25)"
            strokeWidth={1}
          />
        )}
        {/* Pillola evidente One UI per il Mese Corrente Centrato */}
        {isCurrent && !isHovered && (
          <rect
            x={-22}
            y={2}
            width={44}
            height={18}
            rx={9}
            fill="rgba(239, 68, 68, 0.16)"
            stroke="rgba(239, 68, 68, 0.5)"
            strokeWidth={1.2}
          />
        )}
        <text
          x={0}
          y={15}
          textAnchor="middle"
          fill={isHovered ? '#FFFFFF' : isSelected ? '#3B82F6' : isCurrent ? '#EF4444' : '#8E8E93'}
          fontSize={11}
          fontWeight={isHovered || isSelected || isCurrent ? '700' : '500'}
          fontFamily="Google Sans, sans-serif"
        >
          {payload.value}
        </text>
        {/* Indicatore dot per il mese corrente */}
        {isCurrent && (
          <circle cx={0} cy={23} r={2} fill="#EF4444" />
        )}
      </g>
    );
  };

  // Renderizzatore Tooltip interattivo One UI
  const renderCustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    if (!data) return null;
    const gTotal = data.guadagniTotal;
    const gReal = data.guadagniReal;
    const gPlanned = data.guadagniPlanned;

    const essTotal = data.speseEssenzialiTotal;
    const essReal = data.speseEssenzialiReal;
    const essPlanned = data.speseEssenzialiPlanned;

    const extTotal = data.speseExtraTotal;
    const extReal = data.speseExtraReal;
    const extPlanned = data.speseExtraPlanned;

    const totSpese = essTotal + extTotal;
    const net = gTotal - totSpese;

    return (
      <div className="p-3 bg-[#1C1C1E]/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl text-xs space-y-2.5 min-w-[240px]">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
          <span className="font-bold text-slate-200">
            {data.fullLabel}
          </span>
          <div className="flex items-center gap-1">
            {data.isCurrent && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-[#E31B23]/20 text-[#E31B23]">
                Mese Corrente
              </span>
            )}
            {data.isFuture && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-400">
                Pianificato
              </span>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          {/* Guadagni */}
          <div className={`p-1.5 rounded-xl transition-all ${hoveredSeries === 'guadagni' ? 'bg-emerald-500/15 ring-1 ring-emerald-500/40' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Guadagni:
              </span>
              <span className="font-bold text-slate-100 tabular-nums font-numeric">
                {formatCur(gTotal)}
              </span>
            </div>
            {includePlanned && gPlanned > 0 && (
              <div className="flex items-center justify-between text-[11px] text-slate-400 pl-3.5 pt-0.5">
                <span>{gReal > 0 ? `Reale: ${formatCur(gReal)}` : 'Nessun incasso consuntivo'}</span>
                <span className="text-emerald-400/90 font-medium font-numeric">
                  +{formatCur(gPlanned)} <span className="text-[10px] text-emerald-400/70">(tratteggiato)</span>
                </span>
              </div>
            )}
          </div>

          {/* Spese Essenziali (Rosso One UI) */}
          <div className={`p-1.5 rounded-xl transition-all ${hoveredSeries === 'speseEssenziali' ? 'bg-red-500/15 ring-1 ring-red-500/40' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-red-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Spese Essenziali:
              </span>
              <span className="font-bold text-slate-100 tabular-nums font-numeric">
                {formatCur(essTotal)}
              </span>
            </div>
            {includePlanned && essPlanned > 0 && (
              <div className="flex items-center justify-between text-[11px] text-slate-400 pl-3.5 pt-0.5">
                <span>{essReal > 0 ? `Reale: ${formatCur(essReal)}` : 'Nessuna spesa consuntiva'}</span>
                <span className="text-red-400/90 font-medium font-numeric">
                  +{formatCur(essPlanned)} <span className="text-[10px] text-red-400/70">(tratteggiato)</span>
                </span>
              </div>
            )}
          </div>

          {/* Spese Extra (Arancione / Giallo Ambrato Caldo) */}
          <div className={`p-1.5 rounded-xl transition-all ${hoveredSeries === 'speseExtra' ? 'bg-amber-500/15 ring-1 ring-amber-500/40' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Spese Extra:
              </span>
              <span className="font-bold text-slate-100 tabular-nums font-numeric">
                {formatCur(extTotal)}
              </span>
            </div>
            {includePlanned && extPlanned > 0 && (
              <div className="flex items-center justify-between text-[11px] text-slate-400 pl-3.5 pt-0.5">
                <span>{extReal > 0 ? `Reale: ${formatCur(extReal)}` : 'Nessuna spesa consuntiva'}</span>
                <span className="text-amber-400/90 font-medium font-numeric">
                  +{formatCur(extPlanned)} <span className="text-[10px] text-amber-400/70">(tratteggiato)</span>
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 flex items-center justify-between font-bold">
          <span className="text-slate-400">Saldo Netto:</span>
          <span className={`tabular-nums font-numeric ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {net >= 0 ? `+${formatCur(net)}` : formatCur(net)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-4">
      {/* Testata della Scheda Grafico Macro One UI */}
      <div className="p-4 sm:p-5 rounded-[24px] bg-slate-50/80 dark:bg-[#1C1C1E] border border-slate-200/70 dark:border-slate-800 space-y-4 shadow-sm">
        
        {/* Barra Superiore: Titolo & Controlli */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <PieChart size={20} className="text-red-500" />
                Guadagni, Spese Essenziali & Spese Extra
              </span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                50/30/20: Devo • Ho bisogno • Voglio
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Confronto mensile e ripartizione delle uscite tra bisogni essenziali e desideri extra
            </p>
          </div>

          {/* Selettori Modalità & Periodo */}
          <div className="flex flex-col gap-2.5 w-full sm:w-auto">
            {/* Riga 1: Tipo Periodo & Modalità Grafico */}
            <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
              {/* Selettore Tipo Periodo */}
              <div className="flex bg-slate-200/70 dark:bg-slate-800/80 p-0.5 rounded-full text-xs font-semibold overflow-x-auto max-w-full">
                <button
                  type="button"
                  onClick={() => { haptics.tap(); setPeriodType('TRIMESTRALE'); }}
                  className={`px-2.5 sm:px-3 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                    periodType === 'TRIMESTRALE'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Trimestrale (3M)
                </button>
                <button
                  type="button"
                  onClick={() => { haptics.tap(); setPeriodType('SEMESTRALE'); }}
                  className={`px-2.5 sm:px-3 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                    periodType === 'SEMESTRALE'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Semestrale (6M)
                </button>
                <button
                  type="button"
                  onClick={() => { haptics.tap(); setPeriodType('ANNUALE'); }}
                  className={`px-2.5 sm:px-3 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                    periodType === 'ANNUALE'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Annuale (12M)
                </button>
                <button
                  type="button"
                  onClick={() => { haptics.tap(); setPeriodType('ANNO_SOLARE'); }}
                  className={`px-2.5 sm:px-3 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                    periodType === 'ANNO_SOLARE'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Anno Solare
                </button>
              </div>

              {/* Modalità Grafico: 3 Colonne vs Composte vs Linee */}
              <div className="flex bg-slate-200/70 dark:bg-slate-800/80 p-0.5 rounded-full text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => { haptics.tap(); setChartMode('SIDE_BY_SIDE'); }}
                  title="Visualizza 3 colonne separate: Guadagni, Spese Essenziali, Spese Extra"
                  className={`px-2.5 sm:px-3 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                    chartMode === 'SIDE_BY_SIDE'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <BarChart3 size={12} />
                  <span>3 Colonne</span>
                </button>
                <button
                  type="button"
                  onClick={() => { haptics.tap(); setChartMode('STACKED_EXPENSES'); }}
                  title="Visualizza Guadagni a confronto con le Spese Totali composte da Essenziali + Extra"
                  className={`px-2.5 sm:px-3 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                    chartMode === 'STACKED_EXPENSES'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Layers size={12} />
                  <span>Composte</span>
                </button>
                <button
                  type="button"
                  onClick={() => { haptics.tap(); setChartMode('LINES'); }}
                  title="Visualizza l'andamento a linee: linea continua per consuntivo reale, linea tratteggiata per spese programmate"
                  className={`px-2.5 sm:px-3 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                    chartMode === 'LINES'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <TrendingUp size={12} />
                  <span>Linee</span>
                </button>
              </div>
            </div>

            {/* Riga 2: Navigazione Temporale & Centratura sul Mese Corrente */}
            <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
              {/* Stepper di navigazione del periodo */}
              <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-slate-800/60 px-2 py-0.5 rounded-full text-xs">
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    if (periodType === 'ANNO_SOLARE') {
                      setSelectedCalendarYear(y => y - 1);
                    } else {
                      setCenterMonthOffset(o => o - (periodType === 'TRIMESTRALE' ? 1 : periodType === 'SEMESTRALE' ? 2 : 3));
                    }
                  }}
                  className="p-1 rounded-full hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                  title="Periodo precedente"
                >
                  <ChevronLeft size={14} />
                </button>

                <span className="font-semibold text-slate-800 dark:text-slate-200 px-1.5 tabular-nums text-[11px] sm:text-xs">
                  {periodWindowLabel}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    if (periodType === 'ANNO_SOLARE') {
                      setSelectedCalendarYear(y => y + 1);
                    } else {
                      setCenterMonthOffset(o => o + (periodType === 'TRIMESTRALE' ? 1 : periodType === 'SEMESTRALE' ? 2 : 3));
                    }
                  }}
                  className="p-1 rounded-full hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                  title="Periodo successivo"
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* Pulsante Centra Mese Corrente */}
              <button
                type="button"
                onClick={() => {
                  haptics.tap();
                  setCenterMonthOffset(0);
                  setSelectedCalendarYear(new Date().getFullYear());
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                  (periodType !== 'ANNO_SOLARE' && centerMonthOffset !== 0) || (periodType === 'ANNO_SOLARE' && selectedCalendarYear !== new Date().getFullYear())
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-xs'
                    : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-500/25'
                }`}
                title="Centra il grafico sul mese corrente"
              >
                <Calendar size={13} />
                <span>Centra Mese Corrente</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3 Metric Cards One UI con Interazione al Passaggio del Mouse */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Card Guadagni */}
          <div 
            onMouseEnter={() => setHoveredSeries('guadagni')}
            onMouseLeave={() => setHoveredSeries(null)}
            className={`p-3.5 rounded-2xl bg-emerald-500/10 dark:bg-[#1E2923] border border-emerald-500/20 flex items-center justify-between transition-all duration-200 cursor-pointer ${
              hoveredSeries === 'guadagni' ? 'scale-[1.02] shadow-md ring-1 ring-emerald-500/50' : 'hover:scale-[1.01]'
            }`}
          >
            <div>
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <TrendingUp size={14} />
                <span>Totale Guadagni</span>
              </div>
              <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-1">
                {formatCur(periodSummary.totGuadagni)}
              </div>
              <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 font-medium mt-0.5">
                100% base di calcolo
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <TrendingUp size={20} />
            </div>
          </div>

          {/* Card Spese Essenziali - In Rosso One UI */}
          <div 
            onMouseEnter={() => setHoveredSeries('speseEssenziali')}
            onMouseLeave={() => setHoveredSeries(null)}
            className={`p-3.5 rounded-2xl bg-red-500/10 dark:bg-[#2A1D1D] border border-red-500/20 flex items-center justify-between transition-all duration-200 cursor-pointer ${
              hoveredSeries === 'speseEssenziali' ? 'scale-[1.02] shadow-md ring-1 ring-red-500/50' : 'hover:scale-[1.01]'
            }`}
          >
            <div>
              <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck size={14} />
                <span>Spese Essenziali</span>
              </div>
              <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums font-numeric mt-1">
                {formatCur(periodSummary.totEssenziali)}
              </div>
              <div className="text-[11px] text-red-600/80 dark:text-red-400/80 font-medium mt-0.5 flex items-center gap-1">
                <span>{formatItalianPercent(periodSummary.essenzialiPercent, { decimals: 1 })} sui guadagni</span>
                <span className="text-slate-400">(target 50%)</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={20} />
            </div>
          </div>

          {/* Card Spese Extra - In Arancione/Giallo Ambrato Caldo */}
          <div 
            onMouseEnter={() => setHoveredSeries('speseExtra')}
            onMouseLeave={() => setHoveredSeries(null)}
            className={`p-3.5 rounded-2xl bg-amber-500/10 dark:bg-[#2B231A] border border-amber-500/20 flex items-center justify-between transition-all duration-200 cursor-pointer ${
              hoveredSeries === 'speseExtra' ? 'scale-[1.02] shadow-md ring-1 ring-amber-500/50' : 'hover:scale-[1.01]'
            }`}
          >
            <div>
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
                <Sparkles size={14} />
                <span>Spese Extra</span>
              </div>
              <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums font-numeric mt-1">
                {formatCur(periodSummary.totExtra)}
              </div>
              <div className="text-[11px] text-amber-600/80 dark:text-amber-400/80 font-medium mt-0.5 flex items-center gap-1">
                <span>{formatItalianPercent(periodSummary.extraPercent, { decimals: 1 })} sui guadagni</span>
                <span className="text-slate-400">(target 30%)</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
              <Sparkles size={20} />
            </div>
          </div>
        </div>

        {/* Legend / Info Bar & Toggle Pianificati con Interattività al Passaggio del Mouse */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1.5 border-t border-slate-200/60 dark:border-slate-800 text-xs text-slate-500">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div 
              onMouseEnter={() => setHoveredSeries('guadagni')}
              onMouseLeave={() => setHoveredSeries(null)}
              className={`flex items-center gap-1.5 font-medium cursor-pointer px-2 py-1 rounded-lg transition-all ${
                hoveredSeries === 'guadagni' ? 'bg-emerald-500/15 ring-1 ring-emerald-500/40' : 'hover:bg-slate-200/50 dark:hover:bg-white/5'
              }`}
            >
              <span className="w-3 h-3 rounded-md bg-[#10B981] inline-block shadow-xs" />
              <span className="text-slate-700 dark:text-slate-300">Guadagni</span>
            </div>

            <div 
              onMouseEnter={() => setHoveredSeries('speseEssenziali')}
              onMouseLeave={() => setHoveredSeries(null)}
              className={`flex items-center gap-1.5 font-medium cursor-pointer px-2 py-1 rounded-lg transition-all ${
                hoveredSeries === 'speseEssenziali' ? 'bg-red-500/15 ring-1 ring-red-500/40' : 'hover:bg-slate-200/50 dark:hover:bg-white/5'
              }`}
            >
              <span className="w-3 h-3 rounded-md bg-[#EF4444] inline-block shadow-xs" />
              <span className="text-slate-700 dark:text-slate-300">Spese Essenziali (Bisogni)</span>
            </div>

            <div 
              onMouseEnter={() => setHoveredSeries('speseExtra')}
              onMouseLeave={() => setHoveredSeries(null)}
              className={`flex items-center gap-1.5 font-medium cursor-pointer px-2 py-1 rounded-lg transition-all ${
                hoveredSeries === 'speseExtra' ? 'bg-amber-500/15 ring-1 ring-amber-500/40' : 'hover:bg-slate-200/50 dark:hover:bg-white/5'
              }`}
            >
              <span className="w-3 h-3 rounded-md bg-[#F59E0B] inline-block shadow-xs" />
              <span className="text-slate-700 dark:text-slate-300">Spese Extra (Desideri)</span>
            </div>

            {/* Distinzione Visiva Reale vs Programmato (Stessi colori: pieno vs tratteggiato) */}
            <div className="flex items-center gap-2.5 pl-2.5 sm:border-l border-slate-300 dark:border-slate-700 text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium">
                <span className="w-3.5 h-3 rounded-xs bg-slate-400 dark:bg-slate-300 inline-block shadow-xs" />
                <span>Reale (pieno / continua)</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium">
                <span 
                  className="w-3.5 h-3 rounded-xs border-1.5 border-dashed border-red-500 inline-block shadow-xs"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, rgba(239,68,68,0.4) 0, rgba(239,68,68,0.4) 2px, transparent 2px, transparent 5px)'
                  }}
                />
                <span>Programmato (tratteggiato)</span>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
            <input
              type="checkbox"
              checked={includePlanned}
              onChange={(e) => {
                haptics.tap();
                setIncludePlanned(e.target.checked);
              }}
              className="accent-red-500 rounded"
            />
            <span className="text-[11px] font-medium">Includi impegni pianificati e scadenze future (tratteggiate)</span>
          </label>
        </div>

        {/* Area del Grafico Recharts con Effetti Hover */}
        <div className="h-72 sm:h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === 'LINES' ? (
              <LineChart
                data={chartPoints}
                margin={{ top: 12, right: 10, left: -10, bottom: 0 }}
                onMouseMove={(state: any) => {
                  if (state && state.activePayload && state.activePayload.length > 0) {
                    const mKey = state.activePayload[0].payload?.monthKey;
                    if (mKey && mKey !== hoveredMonthKey) {
                      setHoveredMonthKey(mKey);
                    }
                  }
                }}
                onMouseLeave={() => {
                  setHoveredMonthKey(null);
                  setHoveredSeries(null);
                }}
                onClick={(state: any) => {
                  if (state && state.activePayload && state.activePayload.length > 0) {
                    const mKey = state.activePayload[0].payload?.monthKey;
                    if (mKey) {
                      haptics.tap();
                      setSelectedMonthKey(mKey);
                    }
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2e" vertical={false} opacity={0.4} />
                <XAxis 
                  dataKey="label" 
                  tick={renderCustomXAxisTick}
                  axisLine={{ stroke: '#3A3A3C' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: '#8E8E93', fontSize: 10, fontFamily: 'Google Sans, sans-serif' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => `${val >= 1000 ? Math.round(val / 1000) + 'k' : val} €`}
                />
                <Tooltip 
                  cursor={{
                    stroke: 'rgba(255, 255, 255, 0.15)',
                    strokeWidth: 1,
                    strokeDasharray: '4 4'
                  }}
                  content={renderCustomTooltip}
                />

                {/* Linea Guadagni: Consuntivo Reale (Linea Continua) */}
                <Line
                  type="monotone"
                  dataKey="guadagniReal"
                  name="Guadagni (Consuntivo)"
                  stroke={COLOR_GUADAGNI}
                  strokeWidth={hoveredSeries === 'guadagni' ? 3.5 : 2.5}
                  dot={{ r: 3.5, fill: COLOR_GUADAGNI, stroke: '#121212', strokeWidth: 1.5 }}
                  activeDot={{ r: 6, fill: COLOR_GUADAGNI, stroke: '#FFFFFF', strokeWidth: 2 }}
                />
                {/* Linea Guadagni: Programmati/Pianificati (Linea Tratteggiata - Stesso Colore Verde) */}
                {includePlanned && (
                  <Line
                    type="monotone"
                    dataKey="guadagniTotal"
                    name="Guadagni (Pianificato Totale)"
                    stroke={COLOR_GUADAGNI}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={{ r: 3, fill: '#121212', stroke: COLOR_GUADAGNI, strokeWidth: 1.5 }}
                    activeDot={{ r: 5, fill: COLOR_GUADAGNI }}
                  />
                )}

                {/* Linea Spese Essenziali: Consuntivo Reale (Linea Continua in Rosso) */}
                <Line
                  type="monotone"
                  dataKey="speseEssenzialiReal"
                  name="Spese Essenziali (Consuntivo)"
                  stroke={COLOR_ESSENZIALI}
                  strokeWidth={hoveredSeries === 'speseEssenziali' ? 3.5 : 2.5}
                  dot={{ r: 3.5, fill: COLOR_ESSENZIALI, stroke: '#121212', strokeWidth: 1.5 }}
                  activeDot={{ r: 6, fill: COLOR_ESSENZIALI, stroke: '#FFFFFF', strokeWidth: 2 }}
                />
                {/* Linea Spese Essenziali: Programmate/Pianificate (Linea Tratteggiata - Stesso Colore Rosso) */}
                {includePlanned && (
                  <Line
                    type="monotone"
                    dataKey="speseEssenzialiTotal"
                    name="Spese Essenziali (Pianificato Totale)"
                    stroke={COLOR_ESSENZIALI}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={{ r: 3, fill: '#121212', stroke: COLOR_ESSENZIALI, strokeWidth: 1.5 }}
                    activeDot={{ r: 5, fill: COLOR_ESSENZIALI }}
                  />
                )}

                {/* Linea Spese Extra: Consuntivo Reale (Linea Continua in Arancione/Giallo) */}
                <Line
                  type="monotone"
                  dataKey="speseExtraReal"
                  name="Spese Extra (Consuntivo)"
                  stroke={COLOR_EXTRA}
                  strokeWidth={hoveredSeries === 'speseExtra' ? 3.5 : 2.5}
                  dot={{ r: 3.5, fill: COLOR_EXTRA, stroke: '#121212', strokeWidth: 1.5 }}
                  activeDot={{ r: 6, fill: COLOR_EXTRA, stroke: '#FFFFFF', strokeWidth: 2 }}
                />
                {/* Linea Spese Extra: Programmate/Pianificate (Linea Tratteggiata - Stesso Colore Arancione/Giallo) */}
                {includePlanned && (
                  <Line
                    type="monotone"
                    dataKey="speseExtraTotal"
                    name="Spese Extra (Pianificato Totale)"
                    stroke={COLOR_EXTRA}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={{ r: 3, fill: '#121212', stroke: COLOR_EXTRA, strokeWidth: 1.5 }}
                    activeDot={{ r: 5, fill: COLOR_EXTRA }}
                  />
                )}
              </LineChart>
            ) : (
              <BarChart
                data={chartPoints}
                margin={{ top: 12, right: 10, left: -10, bottom: 0 }}
                onMouseMove={(state: any) => {
                  if (state && state.activePayload && state.activePayload.length > 0) {
                    const mKey = state.activePayload[0].payload?.monthKey;
                    if (mKey && mKey !== hoveredMonthKey) {
                      setHoveredMonthKey(mKey);
                    }
                  }
                }}
                onMouseLeave={() => {
                  setHoveredMonthKey(null);
                  setHoveredSeries(null);
                }}
                onClick={(state: any) => {
                  if (state && state.activePayload && state.activePayload.length > 0) {
                    const mKey = state.activePayload[0].payload?.monthKey;
                    if (mKey) {
                      haptics.tap();
                      setSelectedMonthKey(mKey);
                    }
                  }
                }}
              >
                <defs>
                  {/* Pattern Tratteggiato Diagonale per Guadagni Pianificati (Verde) */}
                  <pattern id="pattern-planned-guadagni" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="10" height="10" fill={COLOR_GUADAGNI} fillOpacity="0.16" />
                    <line x1="0" y1="0" x2="0" y2="10" stroke={COLOR_GUADAGNI} strokeWidth="3" strokeDasharray="3 2" />
                  </pattern>

                  {/* Pattern Tratteggiato Diagonale per Spese Essenziali Pianificate (Rosso) */}
                  <pattern id="pattern-planned-essenziali" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="10" height="10" fill={COLOR_ESSENZIALI} fillOpacity="0.16" />
                    <line x1="0" y1="0" x2="0" y2="10" stroke={COLOR_ESSENZIALI} strokeWidth="3" strokeDasharray="3 2" />
                  </pattern>

                  {/* Pattern Tratteggiato Diagonale per Spese Extra Pianificate (Arancione / Giallo) */}
                  <pattern id="pattern-planned-extra" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="10" height="10" fill={COLOR_EXTRA} fillOpacity="0.16" />
                    <line x1="0" y1="0" x2="0" y2="10" stroke={COLOR_EXTRA} strokeWidth="3" strokeDasharray="3 2" />
                  </pattern>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2e" vertical={false} opacity={0.4} />
                
                <XAxis 
                  dataKey="label" 
                  tick={renderCustomXAxisTick}
                  axisLine={{ stroke: '#3A3A3C' }}
                  tickLine={false}
                />
                
                <YAxis 
                  tick={{ fill: '#8E8E93', fontSize: 10, fontFamily: 'Google Sans, sans-serif' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => `${val >= 1000 ? Math.round(val / 1000) + 'k' : val} €`}
                />

                <Tooltip 
                  cursor={{
                    fill: 'rgba(255, 255, 255, 0.04)',
                    stroke: 'rgba(255, 255, 255, 0.12)',
                    strokeWidth: 1,
                    strokeDasharray: '4 4',
                    rx: 12,
                    ry: 12
                  }}
                  content={renderCustomTooltip}
                />

                {chartMode === 'SIDE_BY_SIDE' ? (
                  <>
                    {/* Guadagni: Reale (Pieno) + Pianificato (Tratteggiato dello stesso colore) */}
                    <Bar 
                      dataKey="guadagniReal" 
                      stackId="guadagni"
                      name="Guadagni (Consuntivo)" 
                      fill={COLOR_GUADAGNI} 
                      shape={renderSolidBar('guadagniPlanned', 'guadagni')}
                      maxBarSize={28}
                    />
                    <Bar 
                      dataKey="guadagniPlanned" 
                      stackId="guadagni"
                      name="Guadagni (Pianificati)" 
                      fill={COLOR_GUADAGNI} 
                      shape={renderDashedBar('guadagni')}
                      maxBarSize={28}
                    />

                    {/* Spese Essenziali: Reale (Pieno in Rosso) + Pianificato (Tratteggiato in Rosso) */}
                    <Bar 
                      dataKey="speseEssenzialiReal" 
                      stackId="speseEssenziali"
                      name="Spese Essenziali (Consuntivo)" 
                      fill={COLOR_ESSENZIALI} 
                      shape={renderSolidBar('speseEssenzialiPlanned', 'speseEssenziali')}
                      maxBarSize={28}
                    />
                    <Bar 
                      dataKey="speseEssenzialiPlanned" 
                      stackId="speseEssenziali"
                      name="Spese Essenziali (Pianificate)" 
                      fill={COLOR_ESSENZIALI} 
                      shape={renderDashedBar('speseEssenziali')}
                      maxBarSize={28}
                    />

                    {/* Spese Extra: Reale (Pieno in Arancione/Giallo) + Pianificato (Tratteggiato in Arancione/Giallo) */}
                    <Bar 
                      dataKey="speseExtraReal" 
                      stackId="speseExtra"
                      name="Spese Extra (Consuntivo)" 
                      fill={COLOR_EXTRA} 
                      shape={renderSolidBar('speseExtraPlanned', 'speseExtra')}
                      maxBarSize={28}
                    />
                    <Bar 
                      dataKey="speseExtraPlanned" 
                      stackId="speseExtra"
                      name="Spese Extra (Pianificate)" 
                      fill={COLOR_EXTRA} 
                      shape={renderDashedBar('speseExtra')}
                      maxBarSize={28}
                    />
                  </>
                ) : (
                  <>
                    {/* Colonna 1: Guadagni (Reale pieno + Pianificato tratteggiato) */}
                    <Bar 
                      dataKey="guadagniReal" 
                      stackId="guadagni"
                      name="Guadagni (Consuntivo)" 
                      fill={COLOR_GUADAGNI} 
                      shape={renderSolidBar('guadagniPlanned', 'guadagni')}
                      maxBarSize={32}
                    />
                    <Bar 
                      dataKey="guadagniPlanned" 
                      stackId="guadagni"
                      name="Guadagni (Pianificati)" 
                      fill={COLOR_GUADAGNI} 
                      shape={renderDashedBar('guadagni')}
                      maxBarSize={32}
                    />

                    {/* Colonna 2 Stacked: Spese Totali Composte */}
                    {/* Base 1: Spese Essenziali Reali (Rosso) */}
                    <Bar 
                      dataKey="speseEssenzialiReal" 
                      stackId="spese" 
                      name="Spese Essenziali (Consuntivo)" 
                      fill={COLOR_ESSENZIALI} 
                      shape={renderStackedExpense(false, 'speseEssenziali', (p) => (p?.speseEssenzialiPlanned || 0) === 0 && (p?.speseExtraReal || 0) === 0 && (p?.speseExtraPlanned || 0) === 0)}
                      maxBarSize={32}
                    />
                    {/* Base 2: Spese Essenziali Pianificate (Rosso Tratteggiato) */}
                    <Bar 
                      dataKey="speseEssenzialiPlanned" 
                      stackId="spese" 
                      name="Spese Essenziali (Pianificate)" 
                      fill={COLOR_ESSENZIALI} 
                      shape={renderStackedExpense(true, 'speseEssenziali', (p) => (p?.speseExtraReal || 0) === 0 && (p?.speseExtraPlanned || 0) === 0)}
                      maxBarSize={32}
                    />
                    {/* Cima 1: Spese Extra Reali (Arancione/Giallo) */}
                    <Bar 
                      dataKey="speseExtraReal" 
                      stackId="spese" 
                      name="Spese Extra (Consuntivo)" 
                      fill={COLOR_EXTRA} 
                      shape={renderStackedExpense(false, 'speseExtra', (p) => (p?.speseExtraPlanned || 0) === 0)}
                      maxBarSize={32}
                    />
                    {/* Cima 2: Spese Extra Pianificate (Arancione/Giallo Tratteggiato) */}
                    <Bar 
                      dataKey="speseExtraPlanned" 
                      stackId="spese" 
                      name="Spese Extra (Pianificate)" 
                      fill={COLOR_EXTRA} 
                      shape={renderStackedExpense(true, 'speseExtra', () => true)}
                      maxBarSize={32}
                    />
                  </>
                )}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        <p className="text-[11px] text-slate-400 text-center italic">
          Suggerimento: clicca su una colonna nel grafico per visualizzare l'approfondimento 50/30/20 e le categorie del mese.
        </p>
      </div>

      {/* Scheda Approfondimento Mese Selezionato & Regola 50/30/20 */}
      {currentMonthData && (
        <div className="p-4 sm:p-5 rounded-[24px] bg-slate-50/80 dark:bg-[#1C1C1E] border border-slate-200/70 dark:border-slate-800 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                  Dettaglio Mese: {currentMonthData.fullLabel}
                </h3>
                {currentMonthData.isCurrent && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-500/20 text-red-400">
                    Mese Attuale
                  </span>
                )}
                {currentMonthData.isFuture && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-400">
                    Previsione Futura
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Analisi dell'aderenza ai principi di finanza personale 50% bisogni, 30% desideri, 20% risparmio
              </p>
            </div>

            {/* Pulsanti per scorrere i mesi */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  const idx = monthlyData.findIndex(m => m.monthKey === currentMonthData.monthKey);
                  if (idx > 0) {
                    haptics.tap();
                    setSelectedMonthKey(monthlyData[idx - 1].monthKey);
                  }
                }}
                className="p-1.5 rounded-full bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                title="Mese Precedente"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  const idx = monthlyData.findIndex(m => m.monthKey === currentMonthData.monthKey);
                  if (idx < monthlyData.length - 1) {
                    haptics.tap();
                    setSelectedMonthKey(monthlyData[idx + 1].monthKey);
                  }
                }}
                className="p-1.5 rounded-full bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                title="Mese Successivo"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Barra Visiva Ripartizione Percentuale 50/30/20 del Mese */}
          <div className="space-y-2 p-4 rounded-2xl bg-slate-100 dark:bg-[#242426] border border-slate-200/50 dark:border-slate-750">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-700 dark:text-slate-300">
                Ripartizione Effettiva del Mese vs Modello 50/30/20 (Devo • Ho bisogno • Voglio)
              </span>
              <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                Entrate: {formatCur(activeMonth503020.income)}
              </span>
            </div>

            {/* Barra a 3 colori */}
            <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
              {activeMonth503020.essPercent > 0 && (
                <div 
                  style={{ width: `${Math.min(100, activeMonth503020.essPercent)}%` }}
                  className="bg-red-500 h-full transition-all"
                  title={`Devo (Spese Fisse/Essenziali): ${activeMonth503020.essPercent}%`}
                />
              )}
              {activeMonth503020.extPercent > 0 && (
                <div 
                  style={{ width: `${Math.min(100 - activeMonth503020.essPercent, activeMonth503020.extPercent)}%` }}
                  className="bg-amber-500 h-full transition-all"
                  title={`Ho bisogno / Extra: ${activeMonth503020.extPercent}%`}
                />
              )}
              {activeMonth503020.savePercent > 0 && (
                <div 
                  style={{ width: `${Math.min(100 - (activeMonth503020.essPercent + activeMonth503020.extPercent), activeMonth503020.savePercent)}%` }}
                  className="bg-emerald-500 h-full transition-all"
                  title={`Voglio / Risparmio: ${activeMonth503020.savePercent}%`}
                />
              )}
            </div>

            {/* Indicatori a confronto col benchmark (Devo / Ho bisogno / Voglio) */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20">
                <div className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400">
                  Devo (50%)
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums font-numeric">
                  {formatItalianPercent(activeMonth503020.essPercent, { decimals: 0 })}
                </div>
                <div className="text-[10px] text-slate-400">
                  Spese fisse • Target: max 50%
                </div>
              </div>

              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">
                  Ho bisogno (30%)
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums font-numeric">
                  {formatItalianPercent(activeMonth503020.extPercent, { decimals: 0 })}
                </div>
                <div className="text-[10px] text-slate-400">
                  Bisogni • Target: max 30%
                </div>
              </div>

              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
                  Voglio (20%)
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums font-numeric">
                  {formatItalianPercent(activeMonth503020.savePercent, { decimals: 0 })}
                </div>
                <div className="text-[10px] text-slate-400">
                  Desideri & Risparmio • Target: min 20%
                </div>
              </div>
            </div>
          </div>

          {/* Dettaglio Top Categorie del Mese: Spese Essenziali vs Extra */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Top Spese Essenziali */}
            <div className="p-3.5 rounded-2xl bg-slate-100/70 dark:bg-[#242426] border border-slate-200/60 dark:border-slate-750 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <ShieldCheck size={14} />
                  Top Spese Essenziali del Mese
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums font-numeric">
                  {formatCur(includePlanned ? currentMonthData.speseEssenzialiTotal : currentMonthData.speseEssenzialiReal)}
                </span>
              </div>

              {currentMonthData.topEssenziali.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">
                  Nessuna spesa essenziale registrata per questo mese.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {currentMonthData.topEssenziali.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-200/40 dark:border-slate-800 last:border-0">
                      <span className="text-slate-700 dark:text-slate-300 truncate max-w-[170px]">
                        {item.name}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                        {formatCur(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Spese Extra */}
            <div className="p-3.5 rounded-2xl bg-slate-100/70 dark:bg-[#242426] border border-slate-200/60 dark:border-slate-750 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Sparkles size={14} />
                  Top Spese Extra del Mese
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {formatCur(includePlanned ? currentMonthData.speseExtraTotal : currentMonthData.speseExtraReal)}
                </span>
              </div>

              {currentMonthData.topExtra.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">
                  Nessuna spesa extra registrata per questo mese.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {currentMonthData.topExtra.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-200/40 dark:border-slate-800 last:border-0">
                      <span className="text-slate-700 dark:text-slate-300 truncate max-w-[170px]">
                        {item.name}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                        {formatCur(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sezione Audit e Verifica Movimenti del Mese Selezionato */}
          <div className="pt-3 border-t border-slate-200/60 dark:border-white/5 space-y-3">
            {/* Header Sezione */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center text-[#E31B23]">
                  <Receipt size={16} strokeWidth={2.2} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Controllo Movimenti {currentMonthData.fullLabel}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                      {currentMonthData.monthMovements.length} totali
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Trasparenza su entrate, spese essenziali, extra e trasferimenti interni
                  </p>
                </div>
              </div>

              {/* Barra di ricerca interna */}
              <div className="relative min-w-[200px]">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Cerca per voce, categoria o conto..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-100 dark:bg-[#1C1C1E] text-slate-900 dark:text-white rounded-full border border-slate-200/80 dark:border-white/10 focus:outline-none focus:border-[#E31B23]"
                />
                {auditSearch && (
                  <button
                    type="button"
                    onClick={() => setAuditSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Avviso Giroconti se presenti */}
            {currentMonthData.girocontiCount > 0 && (
              <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-700 dark:text-indigo-300 flex items-start gap-2.5">
                <ArrowLeftRight size={15} className="mt-0.5 flex-shrink-0 text-indigo-500" />
                <div className="space-y-0.5 leading-relaxed">
                  <span className="font-bold">
                    {currentMonthData.girocontiCount} {currentMonthData.girocontiCount === 1 ? 'giroconto rilevato' : 'giroconti rilevati'} ({formatCur(currentMonthData.girocontiReal)}):
                  </span>{' '}
                  <span>
                    I trasferimenti tra propri conti (es. MPS, ING, Revolut, Contanti) sono stati esclusi dal conteggio di Entrate e Spese per non gonfiare artificiosamente il bilancio familiare.
                  </span>
                </div>
              </div>
            )}

            {/* Filtri Macro per Chip */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => { setAuditFilter('ALL'); haptics.tap(); }}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                  auditFilter === 'ALL'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                    : 'bg-white dark:bg-[#242426] text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-white/5 hover:border-slate-300'
                }`}
              >
                Tutti ({currentMonthData.monthMovements.length})
              </button>

              <button
                type="button"
                onClick={() => { setAuditFilter('GUADAGNI'); haptics.tap(); }}
                className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                  auditFilter === 'GUADAGNI'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white dark:bg-[#242426] text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-white/5 hover:border-slate-300'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Entrate ({currentMonthData.monthMovements.filter(m => m.macroClassification === 'GUADAGNI').length})</span>
              </button>

              <button
                type="button"
                onClick={() => { setAuditFilter('SPESE_ESSENZIALI'); haptics.tap(); }}
                className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                  auditFilter === 'SPESE_ESSENZIALI'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white dark:bg-[#242426] text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-white/5 hover:border-slate-300'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>Essenziali ({currentMonthData.monthMovements.filter(m => m.macroClassification === 'SPESE_ESSENZIALI').length})</span>
              </button>

              <button
                type="button"
                onClick={() => { setAuditFilter('SPESE_EXTRA'); haptics.tap(); }}
                className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                  auditFilter === 'SPESE_EXTRA'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white dark:bg-[#242426] text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-white/5 hover:border-slate-300'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Extra ({currentMonthData.monthMovements.filter(m => m.macroClassification === 'SPESE_EXTRA').length})</span>
              </button>

              {currentMonthData.girocontiCount > 0 && (
                <button
                  type="button"
                  onClick={() => { setAuditFilter('GIROCONTO'); haptics.tap(); }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                    auditFilter === 'GIROCONTO'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-[#242426] text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-white/5 hover:border-slate-300'
                  }`}
                >
                  <ArrowLeftRight size={11} className={auditFilter === 'GIROCONTO' ? 'text-white' : 'text-indigo-500'} />
                  <span>Giroconti ({currentMonthData.girocontiCount})</span>
                </button>
              )}
            </div>

            {/* Lista delle transazioni */}
            {filteredAuditMovements.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-slate-50 dark:bg-[#1C1C1E] border border-slate-200/60 dark:border-white/5">
                <p className="text-xs text-slate-400">
                  Nessun movimento trovato con i filtri selezionati.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {(showAllAuditMovements ? filteredAuditMovements : filteredAuditMovements.slice(0, 8)).map(m => {
                  const isEntrata = m.macroClassification === 'GUADAGNI';
                  const isEssenziale = m.macroClassification === 'SPESE_ESSENZIALI';
                  const isExtra = m.macroClassification === 'SPESE_EXTRA';
                  const isGiro = m.macroClassification === 'GIROCONTO';

                  const accOrigineName = m.conto_origine ? (accountMap.get(m.conto_origine)?.nome_conto || 'Conto') : 'Conto';
                  const accDestName = m.conto_destinazione ? (accountMap.get(m.conto_destinazione)?.nome_conto || 'Conto') : null;

                  // Formattazione data DD/MM/YYYY
                  const dateParts = m.data.split('-');
                  const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : m.data;

                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-[#1C1C1E] border border-slate-200/60 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 transition-colors gap-2"
                    >
                      {/* Sinistra: Dettagli */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold ${
                            isEntrata ? 'bg-emerald-500' : isEssenziale ? 'bg-red-500' : isExtra ? 'bg-amber-500' : 'bg-indigo-500'
                          }`}
                        >
                          {isEntrata ? '+' : isGiro ? '⇄' : '−'}
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {m.descrizione}
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            <span>{formattedDate}</span>
                            <span>•</span>
                            <span className="truncate">{m.subName}</span>
                            <span>•</span>
                            <span className="text-slate-600 dark:text-slate-300 truncate">
                              {isGiro && accDestName ? `${accOrigineName} ➔ ${accDestName}` : accOrigineName}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Destra: Importo */}
                      <div className="text-right flex-shrink-0">
                        <span
                          className={`text-xs font-bold tabular-nums font-numeric ${
                            isEntrata 
                              ? 'text-emerald-600 dark:text-emerald-400' 
                              : isGiro 
                                ? 'text-indigo-600 dark:text-indigo-400' 
                                : isEssenziale 
                                  ? 'text-red-600 dark:text-red-400' 
                                  : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {isEntrata ? `+ ${formatCur(m.importo)}` : isGiro ? `⇄ ${formatCur(m.importo)}` : `- ${formatCur(m.importo)}`}
                        </span>
                        <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                          {isEntrata ? 'Entrata' : isGiro ? 'Giroconto' : isEssenziale ? 'Essenziale' : 'Extra'}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Pulsante Mostra Tutti se > 8 */}
                {filteredAuditMovements.length > 8 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAllAuditMovements(!showAllAuditMovements);
                      haptics.tap();
                    }}
                    className="w-full py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center gap-1 bg-slate-100/80 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/5 hover:bg-slate-200/80 cursor-pointer transition-colors"
                  >
                    <span>
                      {showAllAuditMovements 
                        ? 'Riduci visualizzazione' 
                        : `Mostra tutti i ${filteredAuditMovements.length} movimenti di ${currentMonthData.label}`}
                    </span>
                    {showAllAuditMovements ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
