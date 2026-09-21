import React, { useState, useMemo, useRef, useEffect } from 'react';
import { sankey, sankeyJustify, sankeyLinkHorizontal } from 'd3-sankey';
import { Movement, Subcategory } from '../types';
import { formatCurrency, formatItalianNumber } from '../utils/formatters';
import { isDateInFinancialMonth, getCurrentFinancialMonth, getFinancialPeriodInfo } from '../utils/financialDate';
import { haptics } from '../utils/haptics';
import { 
  GitFork, 
  TrendingUp, 
  TrendingDown, 
  PiggyBank, 
  Calendar, 
  AlertCircle,
  ArrowRight,
  ListFilter
} from 'lucide-react';

interface CashflowSankeyChartProps {
  movements: Movement[];
  subcategories?: Subcategory[];
  className?: string;
}

export type SankeyPeriod = 'CURRENT_MONTH' | 'LAST_30_DAYS' | 'LAST_90_DAYS' | 'YEAR_TO_DATE' | 'ALL';
export type SankeyGrouping = 'CATEGORY' | 'SUBCATEGORY';

interface SankeyNodeData {
  id: string;
  name: string;
  parentCategory?: string;
  role: 'INCOME' | 'HUB' | 'EXPENSE' | 'SAVINGS' | 'DEFICIT';
  color: string;
  amount: number;
  count: number;
  percentage: number;
  // Filled by d3-sankey:
  x0?: number;
  x1?: number;
  y0?: number;
  y1?: number;
  value?: number;
  index?: number;
  sourceLinks?: any[];
  targetLinks?: any[];
}

interface SankeyLinkData {
  source: string | SankeyNodeData;
  target: string | SankeyNodeData;
  value: number;
  color?: string;
  sourceName?: string;
  targetName?: string;
  width?: number;
  y0?: number;
  y1?: number;
  index?: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  // Entrate
  'Lavoro': '#10b981',
  'Stipendio': '#10b981',
  'Entrate Extra': '#059669',
  'Rimborsi': '#06b6d4',
  'Investimenti': '#3b82f6',
  'Entrate Varie': '#14b8a6',
  'Altre Entrate': '#10b981',
  // Spese
  'Casa': '#6366f1',
  'Alimentazione': '#f97316',
  'Spesa': '#f97316',
  'Trasporti': '#0284c7',
  'Salute': '#10b981',
  'Tempo Libero': '#ec4899',
  'Svago': '#ec4899',
  'Istruzione': '#8b5cf6',
  'Abbigliamento': '#14b8a6',
  'Spese Personali': '#f59e0b',
  'Utenze': '#eab308',
  'Bollette': '#eab308',
  'Imposte e Tasse': '#ef4444',
  'Tasse': '#ef4444',
  'Banca e Finanza': '#06b6d4',
  'Altro': '#64748b',
  'Spese Varie': '#8b5cf6'
};

const PALETTE = [
  '#6366f1', '#f97316', '#0284c7', '#10b981', '#ec4899',
  '#8b5cf6', '#eab308', '#14b8a6', '#06b6d4', '#f43f5e',
  '#64748b', '#3b82f6', '#d946ef', '#84cc16'
];

function getCategoryColor(name: string, index: number): string {
  if (CATEGORY_COLORS[name]) return CATEGORY_COLORS[name];
  for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return PALETTE[index % PALETTE.length];
}

export const CashflowSankeyChart: React.FC<CashflowSankeyChartProps> = ({
  movements,
  subcategories = [],
  className = ''
}) => {
  const [period, setPeriod] = useState<SankeyPeriod>('CURRENT_MONTH');
  const [grouping, setGrouping] = useState<SankeyGrouping>('CATEGORY');

  // Tooltip & Hover state
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<SankeyLinkData | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Responsive dimensions for the SVG diagram
  const svgWrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 600,
    height: 270
  });

  useEffect(() => {
    if (!svgWrapperRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 0) {
          // Compact, balanced height on desktop and mobile
          const calcHeight = width < 480 ? 250 : width < 768 ? 270 : 285;
          setDimensions({ width, height: calcHeight });
        }
      }
    });
    observer.observe(svgWrapperRef.current);
    return () => observer.disconnect();
  }, []);

  // Mappa sottocategorie
  const subcategoryMap = useMemo(() => {
    const map = new Map<string, Subcategory>();
    subcategories.forEach(sub => {
      map.set(sub.id, sub);
      map.set(sub.sottocategoria_id, sub);
      map.set(sub.nome.toLowerCase().trim(), sub);
    });
    return map;
  }, [subcategories]);

  // Filtra movimenti per periodo selezionato
  const filteredMovements = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const curYear = now.getFullYear().toString();
    const curFinancialMonth = getCurrentFinancialMonth();

    return movements.filter(m => {
      if (m.tipologia === 'GIROCONTO') return false;
      if (!m.data) return false;

      const movDate = m.data.slice(0, 10);

      switch (period) {
        case 'CURRENT_MONTH': {
          return isDateInFinancialMonth(movDate, curFinancialMonth);
        }
        case 'LAST_30_DAYS': {
          const limitDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          return movDate >= limitDate && movDate <= todayStr;
        }
        case 'LAST_90_DAYS': {
          const limitDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          return movDate >= limitDate && movDate <= todayStr;
        }
        case 'YEAR_TO_DATE': {
          return movDate.startsWith(curYear) && movDate <= todayStr;
        }
        case 'ALL':
        default:
          return true;
      }
    });
  }, [movements, period]);

  // Calcolo aggregazioni per Entrate e Spese
  const {
    incomeNodes,
    expenseNodes,
    totalIncome,
    totalExpenses,
    netSavings,
    netDeficit
  } = useMemo(() => {
    const incomeMap = new Map<string, { name: string; parentCategory: string; amount: number; count: number; color?: string }>();
    const expenseMap = new Map<string, { name: string; parentCategory: string; amount: number; count: number; color?: string }>();

    let totInc = 0;
    let totExp = 0;

    for (const mov of filteredMovements) {
      const sub = mov.sottocategoria_id ? subcategoryMap.get(mov.sottocategoria_id) : undefined;
      const amount = Math.abs(mov.importo || 0);
      if (amount <= 0) continue;

      if (mov.tipologia === 'ENTRATA') {
        totInc += amount;
        let key = '';
        let name = '';
        let parentCat = 'Entrate';

        if (grouping === 'CATEGORY') {
          key = sub?.categoria_padre || 'Altre Entrate';
          name = key;
          parentCat = key;
        } else {
          name = sub?.nome || mov.descrizione || 'Entrata Generica';
          key = sub?.id || name;
          parentCat = sub?.categoria_padre || 'Entrate';
        }

        const existing = incomeMap.get(key);
        if (existing) {
          existing.amount += amount;
          existing.count += 1;
        } else {
          incomeMap.set(key, {
            name,
            parentCategory: parentCat,
            amount,
            count: 1,
            color: sub?.colore
          });
        }
      } else if (mov.tipologia === 'USCITA') {
        totExp += amount;
        let key = '';
        let name = '';
        let parentCat = 'Spese Varie';

        if (grouping === 'CATEGORY') {
          key = sub?.categoria_padre || 'Spese Varie';
          name = key;
          parentCat = key;
        } else {
          name = sub?.nome || mov.descrizione || 'Uscita Generica';
          key = sub?.id || name;
          parentCat = sub?.categoria_padre || 'Spese Varie';
        }

        const existing = expenseMap.get(key);
        if (existing) {
          existing.amount += amount;
          existing.count += 1;
        } else {
          expenseMap.set(key, {
            name,
            parentCategory: parentCat,
            amount,
            count: 1,
            color: sub?.colore
          });
        }
      }
    }

    totInc = Math.round(totInc * 100) / 100;
    totExp = Math.round(totExp * 100) / 100;
    const diff = Math.round((totInc - totExp) * 100) / 100;

    return {
      incomeNodes: Array.from(incomeMap.entries()).map(([k, v], idx) => ({
        id: `inc_${k}`,
        name: v.name,
        parentCategory: v.parentCategory,
        amount: Math.round(v.amount * 100) / 100,
        count: v.count,
        color: v.color || getCategoryColor(v.parentCategory || v.name, idx),
        percentage: totInc > 0 ? (v.amount / totInc) * 100 : 0
      })).sort((a, b) => b.amount - a.amount),

      expenseNodes: Array.from(expenseMap.entries()).map(([k, v], idx) => ({
        id: `exp_${k}`,
        name: v.name,
        parentCategory: v.parentCategory,
        amount: Math.round(v.amount * 100) / 100,
        count: v.count,
        color: v.color || getCategoryColor(v.parentCategory || v.name, idx + 4),
        percentage: totExp > 0 ? (v.amount / totExp) * 100 : 0
      })).sort((a, b) => b.amount - a.amount),

      totalIncome: totInc,
      totalExpenses: totExp,
      netSavings: diff > 0 ? diff : 0,
      netDeficit: diff < 0 ? Math.abs(diff) : 0
    };
  }, [filteredMovements, grouping, subcategoryMap]);

  // Generazione del grafo per d3-sankey
  const sankeyGraph = useMemo(() => {
    if (totalIncome === 0 && totalExpenses === 0) {
      return null;
    }

    const nodes: SankeyNodeData[] = [];
    const links: SankeyLinkData[] = [];

    // Nodo Hub Centrale (Disponibilità di Flusso del Periodo)
    const hubId = 'node_hub_disponibilita';
    const hubTotal = Math.max(totalIncome, totalExpenses);

    nodes.push({
      id: hubId,
      name: 'Disponibilità',
      role: 'HUB',
      color: '#3b82f6',
      amount: hubTotal,
      count: filteredMovements.length,
      percentage: 100
    });

    // 1. Nodi di Entrata (Left Column)
    incomeNodes.forEach(inc => {
      nodes.push({
        id: inc.id,
        name: inc.name,
        parentCategory: inc.parentCategory,
        role: 'INCOME',
        color: inc.color,
        amount: inc.amount,
        count: inc.count,
        percentage: inc.percentage
      });

      links.push({
        source: inc.id,
        target: hubId,
        value: inc.amount,
        color: inc.color,
        sourceName: inc.name,
        targetName: 'Disponibilità'
      });
    });

    // Se le spese superano le entrate, nodo di bilanciamento "Attingimento Riserve"
    if (netDeficit > 0) {
      const deficitId = 'node_deficit_riserve';
      nodes.push({
        id: deficitId,
        name: 'Riserve',
        role: 'DEFICIT',
        color: '#f43f5e',
        amount: netDeficit,
        count: 1,
        percentage: hubTotal > 0 ? (netDeficit / hubTotal) * 100 : 0
      });

      links.push({
        source: deficitId,
        target: hubId,
        value: netDeficit,
        color: '#f43f5e',
        sourceName: 'Riserve',
        targetName: 'Disponibilità'
      });
    }

    // 2. Nodi di Uscita (Right Column)
    expenseNodes.forEach(exp => {
      nodes.push({
        id: exp.id,
        name: exp.name,
        parentCategory: exp.parentCategory,
        role: 'EXPENSE',
        color: exp.color,
        amount: exp.amount,
        count: exp.count,
        percentage: exp.percentage
      });

      links.push({
        source: hubId,
        target: exp.id,
        value: exp.amount,
        color: exp.color,
        sourceName: 'Disponibilità',
        targetName: exp.name
      });
    });

    // Se c'è un risparmio netto positivo, nodo "Risparmio Netto"
    if (netSavings > 0) {
      const savingsId = 'node_risparmio_netto';
      nodes.push({
        id: savingsId,
        name: 'Risparmio',
        role: 'SAVINGS',
        color: '#10b981',
        amount: netSavings,
        count: 1,
        percentage: totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0
      });

      links.push({
        source: hubId,
        target: savingsId,
        value: netSavings,
        color: '#10b981',
        sourceName: 'Disponibilità',
        targetName: 'Risparmio'
      });
    }

    // Calcolo layout D3 Sankey proporzionato
    const { width, height } = dimensions;
    const margin = {
      top: 12,
      right: width < 500 ? 10 : 16,
      bottom: 14,
      left: width < 500 ? 10 : 16
    };

    const sankeyGenerator = sankey<SankeyNodeData, SankeyLinkData>()
      .nodeId(d => d.id)
      .nodeAlign(sankeyJustify)
      .nodeWidth(width < 500 ? 12 : 15)
      .nodePadding(width < 500 ? 8 : 10)
      .extent([
        [margin.left, margin.top],
        [width - margin.right, height - margin.bottom]
      ]);

    try {
      const graphCopy = {
        nodes: nodes.map(n => ({ ...n })),
        links: links.map(l => ({ ...l }))
      };

      const computed = sankeyGenerator(graphCopy);
      return computed;
    } catch (err) {
      console.warn('Errore generazione Sankey layout:', err);
      return null;
    }
  }, [incomeNodes, expenseNodes, totalIncome, totalExpenses, netSavings, netDeficit, dimensions, filteredMovements.length]);

  // Gestione coordinate Tooltip relativo a SVG
  const handleSvgMouseMove = (e: React.MouseEvent) => {
    if (!svgWrapperRef.current) return;
    const rect = svgWrapperRef.current.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const periodLabel = useMemo(() => {
    switch (period) {
      case 'CURRENT_MONTH': {
        const p = getFinancialPeriodInfo(getCurrentFinancialMonth());
        return p.label;
      }
      case 'LAST_30_DAYS':
        return 'Ultimi 30 Giorni';
      case 'LAST_90_DAYS':
        return 'Ultimi 90 Giorni';
      case 'YEAR_TO_DATE':
        return `Anno ${new Date().getFullYear()}`;
      case 'ALL':
        return 'Tutto lo Storico';
    }
  }, [period]);

  const pathGenerator = useMemo(() => sankeyLinkHorizontal(), []);

  // Nodo attualmente evidenziato
  const activeHoveredNode = useMemo(() => {
    if (!hoveredNodeId || !sankeyGraph) return null;
    return (sankeyGraph.nodes as SankeyNodeData[]).find(n => n.id === hoveredNodeId) || null;
  }, [hoveredNodeId, sankeyGraph]);

  return (
    <div
      id="cashflow-sankey-compact-card"
      className={`bento-card p-3.5 sm:p-4 rounded-[22px] border border-slate-200/80 dark:border-white/5 shadow-2xs space-y-3 transition-all duration-300 ${className}`}
    >
      {/* 1. Header Compatto: Controlli Periodo, Switch Categorie e Pillole di Sintesi */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/5">
        {/* Titolo e Badge di Stato */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[11px] bg-[#E31B23]/10 dark:bg-[#2A2A2E] text-[#E31B23] flex items-center justify-center flex-shrink-0">
            <GitFork size={16} strokeWidth={2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#F5F5F7] tracking-tight">
                Flusso Guadagni & Spese
              </h4>
              <span className="text-[11px] text-slate-400 font-numeric">
                ({periodLabel})
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-[#8E8E93]">
              Dinamico: passa con il mouse sui nodi per importi e categorie
            </p>
          </div>
        </div>

        {/* Barra Controlli Compatta Inline */}
        <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
          {/* Switch Categorie vs Sottocategorie */}
          <div className="flex bg-slate-100 dark:bg-[#242426] p-0.5 rounded-full text-xs font-medium border border-slate-200/60 dark:border-white/5">
            <button
              type="button"
              onClick={() => {
                setGrouping('CATEGORY');
                haptics.tap();
              }}
              className={`px-2.5 py-1 rounded-full transition-all whitespace-nowrap cursor-pointer active:scale-95 text-[11px] ${
                grouping === 'CATEGORY'
                  ? 'bg-white dark:bg-[#1C1C1E] text-slate-900 dark:text-[#F5F5F7] shadow-2xs font-bold'
                  : 'text-slate-500 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7]'
              }`}
            >
              Macro
            </button>
            <button
              type="button"
              onClick={() => {
                setGrouping('SUBCATEGORY');
                haptics.tap();
              }}
              className={`px-2.5 py-1 rounded-full transition-all whitespace-nowrap cursor-pointer active:scale-95 text-[11px] ${
                grouping === 'SUBCATEGORY'
                  ? 'bg-white dark:bg-[#1C1C1E] text-slate-900 dark:text-[#F5F5F7] shadow-2xs font-bold'
                  : 'text-slate-500 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7]'
              }`}
            >
              Dettaglio
            </button>
          </div>

          {/* Switch Periodo a Pillola */}
          <div className="flex bg-slate-100 dark:bg-[#242426] p-0.5 rounded-full text-xs font-medium overflow-x-auto no-scrollbar border border-slate-200/60 dark:border-white/5">
            {(['CURRENT_MONTH', 'LAST_30_DAYS', 'YEAR_TO_DATE', 'ALL'] as SankeyPeriod[]).map(pKey => {
              const labels: Record<SankeyPeriod, string> = {
                CURRENT_MONTH: 'Mese',
                LAST_30_DAYS: '30gg',
                LAST_90_DAYS: '90gg',
                YEAR_TO_DATE: 'Anno',
                ALL: 'Tutto'
              };
              return (
                <button
                  key={pKey}
                  type="button"
                  onClick={() => {
                    setPeriod(pKey);
                    haptics.tap();
                  }}
                  className={`px-2.5 py-1 rounded-full transition-all whitespace-nowrap cursor-pointer active:scale-95 text-[11px] ${
                    period === pKey
                      ? 'bg-[#E31B23] text-white shadow-2xs font-semibold'
                      : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7]'
                  }`}
                >
                  {labels[pKey]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Strip di KPI Sintetici Compatti (Inline Pill Strip per eliminare altezza verticale superflua) */}
      <div className="flex items-center justify-between gap-2 py-2.5 px-3 my-2.5 bg-slate-50 dark:bg-[#242426] rounded-[16px] border border-slate-200/60 dark:border-white/5 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-4 flex-wrap text-xs">
          {/* Entrate */}
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-500 dark:text-[#8E8E93]">Entrate:</span>
            <span className="font-numeric font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalIncome, { showSign: true })}
            </span>
          </div>

          {/* Spese */}
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" />
            <span className="text-slate-500 dark:text-[#8E8E93]">Spese:</span>
            <span className="font-numeric font-bold text-slate-800 dark:text-[#F5F5F7]">
              {formatCurrency(totalExpenses)}
            </span>
          </div>

          {/* Risultato Netto */}
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className={`w-2 h-2 rounded-full ${netSavings > 0 ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            <span className="text-slate-500 dark:text-[#8E8E93]">
              {netSavings > 0 ? 'Risparmio:' : 'Deficit:'}
            </span>
            <span className={`font-numeric font-bold ${netSavings > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {formatCurrency(totalIncome - totalExpenses, { showSign: true })}
            </span>
          </div>
        </div>

        {/* Percentuale di Risparmio a destra */}
        {totalIncome > 0 && (
          <div className="text-[11px] font-numeric font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap hidden sm:block">
            {formatItalianNumber(Math.max(0, ((totalIncome - totalExpenses) / totalIncome) * 100))}% risparmiato
          </div>
        )}
      </div>

      {/* 3. Sezione Contenuto: Su Desktop layout Split a griglia bilanciata (Sankey a Sinistra + Ripartizione Top a Destra) */}
      {!sankeyGraph || (sankeyGraph.nodes.length === 0) ? (
        <div className="py-12 text-center bg-slate-50/50 dark:bg-[#242426]/50 rounded-[18px] border border-dashed border-slate-200 dark:border-white/10 my-2 space-y-2">
          <AlertCircle size={24} className="mx-auto text-slate-400" />
          <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Nessun movimento registrato nel periodo {periodLabel}
          </h5>
          <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
            Seleziona un intervallo più ampio per visualizzare il diagramma di flusso.
          </p>
          <button
            onClick={() => setPeriod('ALL')}
            className="px-3 py-1 rounded-full bg-slate-200 dark:bg-[#2A2A2E] text-slate-700 dark:text-slate-200 text-[11px] font-semibold hover:bg-slate-300 transition-colors"
          >
            Tutto lo storico
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start mt-2">
          {/* Colonna Sinistra / Principale: Grafico Sankey SVG Compatto */}
          <div 
            ref={svgWrapperRef}
            className="lg:col-span-8 xl:col-span-9 relative w-full select-none overflow-visible bg-slate-50/30 dark:bg-[#242426]/30 rounded-[18px] p-2 border border-slate-100 dark:border-white/5"
            onMouseMove={handleSvgMouseMove}
            onMouseLeave={() => {
              setHoveredNodeId(null);
              setHoveredLink(null);
              setTooltipPos(null);
            }}
          >
            {/* Intestazioni Colonne Micro */}
            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 pb-1">
              <span className="text-emerald-600 dark:text-emerald-400">Fonti Guadagno</span>
              <span className="text-slate-400 hidden sm:inline">Flusso</span>
              <span className="text-slate-700 dark:text-slate-300">Destinazioni Spesa</span>
            </div>

            <svg
              width={dimensions.width}
              height={dimensions.height}
              className="overflow-visible block w-full"
            >
              <defs>
                {sankeyGraph.links.map((link: any, idx: number) => {
                  const sourceNode = link.source as SankeyNodeData;
                  const targetNode = link.target as SankeyNodeData;
                  const gradId = `sankey-compact-grad-${idx}`;
                  return (
                    <linearGradient
                      key={gradId}
                      id={gradId}
                      gradientUnits="userSpaceOnUse"
                      x1={sourceNode.x1 || 0}
                      y1={(link.y0 || 0)}
                      x2={targetNode.x0 || 0}
                      y2={(link.y1 || 0)}
                    >
                      <stop offset="0%" stopColor={sourceNode.color || '#6366f1'} stopOpacity={0.65} />
                      <stop offset="100%" stopColor={targetNode.color || '#f97316'} stopOpacity={0.65} />
                    </linearGradient>
                  );
                })}
              </defs>

              {/* Nastri di Flusso */}
              <g className="sankey-links">
                {sankeyGraph.links.map((link: any, idx: number) => {
                  const sourceNode = link.source as SankeyNodeData;
                  const targetNode = link.target as SankeyNodeData;
                  const isHovered = hoveredLink === link || 
                    (hoveredNodeId && (hoveredNodeId === sourceNode.id || hoveredNodeId === targetNode.id));
                  const isAnyHovered = hoveredNodeId !== null || hoveredLink !== null;

                  const opacity = isHovered 
                    ? 0.85 
                    : isAnyHovered 
                      ? 0.12 
                      : 0.35;

                  const pathData = pathGenerator(link) || '';

                  return (
                    <path
                      key={`compact-link-${idx}`}
                      d={pathData}
                      fill="none"
                      stroke={`url(#sankey-compact-grad-${idx})`}
                      strokeWidth={Math.max(1.5, link.width || 1)}
                      strokeOpacity={opacity}
                      className="transition-all duration-150 cursor-pointer"
                      onMouseEnter={() => {
                        setHoveredLink(link);
                        haptics.tap();
                      }}
                      onMouseLeave={() => setHoveredLink(null)}
                    />
                  );
                })}
              </g>

              {/* Nodi del Grafo */}
              <g className="sankey-nodes">
                {sankeyGraph.nodes.map((node: any) => {
                  const isNodeHovered = hoveredNodeId === node.id;
                  const isConnected = hoveredLink && 
                    ((hoveredLink.source as SankeyNodeData)?.id === node.id || (hoveredLink.target as SankeyNodeData)?.id === node.id);
                  const isAnyHovered = hoveredNodeId !== null || hoveredLink !== null;
                  const opacity = (isNodeHovered || isConnected) ? 1 : isAnyHovered ? 0.4 : 1;

                  const nodeWidth = (node.x1 || 0) - (node.x0 || 0);
                  const nodeHeight = Math.max(7, (node.y1 || 0) - (node.y0 || 0));

                  const isLeftColumn = (node.x0 || 0) < dimensions.width * 0.25;
                  const isRightColumn = (node.x1 || 0) > dimensions.width * 0.75;

                  return (
                    <g
                      key={`compact-node-${node.id}`}
                      className="cursor-pointer transition-all duration-150"
                      style={{ opacity }}
                      onMouseEnter={() => {
                        setHoveredNodeId(node.id);
                        haptics.tap();
                      }}
                      onMouseLeave={() => setHoveredNodeId(null)}
                    >
                      <rect
                        x={node.x0}
                        y={node.y0}
                        width={nodeWidth}
                        height={nodeHeight}
                        rx={4}
                        ry={4}
                        fill={node.color || '#6366f1'}
                        stroke={isNodeHovered ? '#ffffff' : 'rgba(255,255,255,0.2)'}
                        strokeWidth={isNodeHovered ? 2 : 0.75}
                        className="transition-all duration-150"
                      />

                      {/* Etichette dei Nodi */}
                      {nodeHeight >= 10 && (
                        <text
                          x={
                            isLeftColumn
                              ? (node.x1 || 0) + 5
                              : isRightColumn
                                ? (node.x0 || 0) - 5
                                : (node.x0 || 0) + nodeWidth / 2
                          }
                          y={(node.y0 || 0) + nodeHeight / 2}
                          textAnchor={
                            isLeftColumn ? 'start' : isRightColumn ? 'end' : 'middle'
                          }
                          dy="0.35em"
                          className={`text-[10px] font-sans font-medium select-none pointer-events-none ${
                            isNodeHovered
                              ? 'fill-slate-900 dark:fill-white font-bold'
                              : 'fill-slate-600 dark:fill-slate-300'
                          }`}
                        >
                          {node.name.length > (dimensions.width < 500 ? 11 : 16)
                            ? `${node.name.slice(0, dimensions.width < 500 ? 10 : 15)}…`
                            : node.name}
                          {nodeHeight >= 22 && (
                            <tspan
                              x={
                                isLeftColumn
                                  ? (node.x1 || 0) + 5
                                  : isRightColumn
                                    ? (node.x0 || 0) - 5
                                    : (node.x0 || 0) + nodeWidth / 2
                              }
                              dy="1.2em"
                              className="font-numeric text-[9px] fill-slate-400 font-bold"
                            >
                              {formatCurrency(node.amount)}
                            </tspan>
                          )}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Tooltip Dinamico al Mouse */}
            {(activeHoveredNode || hoveredLink) && tooltipPos && (
              <div
                className="absolute z-30 pointer-events-none transition-all duration-75 shadow-lg rounded-[14px] p-2.5 bg-white/95 dark:bg-[#242426]/95 backdrop-blur-md border border-slate-200 dark:border-white/10 min-w-[190px] max-w-[260px]"
                style={{
                  left: Math.min(
                    Math.max(8, tooltipPos.x - 90),
                    dimensions.width - 200
                  ),
                  top: Math.max(6, tooltipPos.y - 95)
                }}
              >
                {activeHoveredNode && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span 
                        className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1"
                        style={{
                          backgroundColor: `${activeHoveredNode.color}20`,
                          color: activeHoveredNode.color
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: activeHoveredNode.color }} />
                        {activeHoveredNode.role === 'INCOME' && 'Guadagno'}
                        {activeHoveredNode.role === 'EXPENSE' && (grouping === 'CATEGORY' ? 'Categoria' : 'Sottocategoria')}
                        {activeHoveredNode.role === 'HUB' && 'Disponibilità'}
                        {activeHoveredNode.role === 'SAVINGS' && 'Risparmio'}
                        {activeHoveredNode.role === 'DEFICIT' && 'Riserve'}
                      </span>
                      {activeHoveredNode.count > 0 && activeHoveredNode.role !== 'HUB' && (
                        <span className="text-[9px] text-slate-400">
                          {activeHoveredNode.count} mov.
                        </span>
                      )}
                    </div>

                    <div>
                      <h5 className="text-xs font-bold text-slate-900 dark:text-[#F5F5F7] leading-tight">
                        {activeHoveredNode.name}
                      </h5>
                      {activeHoveredNode.parentCategory && activeHoveredNode.parentCategory !== activeHoveredNode.name && (
                        <span className="text-[9px] text-slate-400 block">
                          Macro: {activeHoveredNode.parentCategory}
                        </span>
                      )}
                    </div>

                    <div className="pt-1 border-t border-slate-100 dark:border-white/5 flex items-baseline justify-between gap-2">
                      <span className="font-numeric text-sm font-extrabold text-slate-900 dark:text-[#F5F5F7]">
                        {formatCurrency(activeHoveredNode.amount)}
                      </span>
                      {activeHoveredNode.percentage > 0 && activeHoveredNode.role !== 'HUB' && (
                        <span className="text-[10px] font-numeric font-semibold text-indigo-600 dark:text-indigo-400">
                          {formatItalianNumber(activeHoveredNode.percentage)}%
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {hoveredLink && !activeHoveredNode && (
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold uppercase text-slate-400 block">
                      Flusso
                    </span>
                    <div className="text-[11px] text-slate-700 dark:text-slate-200 font-medium">
                      {(hoveredLink.source as SankeyNodeData)?.name} → {(hoveredLink.target as SankeyNodeData)?.name}
                    </div>
                    <div className="pt-1 border-t border-slate-100 dark:border-white/5 font-numeric text-xs font-bold text-slate-900 dark:text-white">
                      {formatCurrency(hoveredLink.value)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Colonna Destra: Pannello Sintetico di Dettaglio con sincronizzazione Hover */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-3 bg-slate-50/40 dark:bg-[#242426]/40 rounded-[18px] p-3 border border-slate-100 dark:border-white/5 flex flex-col justify-between">
            {/* Top Guadagni */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp size={12} />
                  <span>Principali Entrate</span>
                </span>
                <span className="text-[10px] text-slate-400 font-numeric">{incomeNodes.length} voci</span>
              </div>
              <div className="space-y-1 max-h-[110px] overflow-y-auto no-scrollbar pr-0.5">
                {incomeNodes.slice(0, 4).map(item => {
                  const isHovered = hoveredNodeId === item.id;
                  return (
                    <div
                      key={item.id}
                      onMouseEnter={() => setHoveredNodeId(item.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      className={`p-1.5 rounded-[10px] transition-all cursor-pointer flex items-center justify-between text-[11px] ${
                        isHovered 
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 ring-1 ring-emerald-500/40' 
                          : 'hover:bg-slate-100/80 dark:hover:bg-[#2A2A2E]/60'
                      }`}
                    >
                      <div className="min-w-0 pr-1 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                          {item.name}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0 font-numeric">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Spese */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                  <TrendingDown size={12} />
                  <span>Principali Spese</span>
                </span>
                <span className="text-[10px] text-slate-400 font-numeric">{expenseNodes.length} voci</span>
              </div>
              <div className="space-y-1 max-h-[110px] overflow-y-auto no-scrollbar pr-0.5">
                {expenseNodes.slice(0, 4).map(item => {
                  const isHovered = hoveredNodeId === item.id;
                  return (
                    <div
                      key={item.id}
                      onMouseEnter={() => setHoveredNodeId(item.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      className={`p-1.5 rounded-[10px] transition-all cursor-pointer flex items-center justify-between text-[11px] ${
                        isHovered 
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 ring-1 ring-indigo-500/40' 
                          : 'hover:bg-slate-100/80 dark:hover:bg-[#2A2A2E]/60'
                      }`}
                    >
                      <div className="min-w-0 pr-1 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                          {item.name}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0 font-numeric">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
