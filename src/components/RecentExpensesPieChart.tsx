import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Sector
} from 'recharts';
import { Movement, Subcategory } from '../types';
import { formatCurrency, formatItalianNumber } from '../utils/formatters';
import {
  PieChart as PieChartIcon,
  ChevronDown,
  ChevronUp,
  Calendar,
  Tag,
  Layers,
  Sparkles,
  Filter
} from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';
import { useTheme } from '../context/ThemeContext';
import { 
  getCurrentFinancialMonth, 
  isDateInFinancialMonth, 
  getFinancialPeriodInfo 
} from '../utils/financialDate';

interface RecentExpensesPieChartProps {
  movements: Movement[];
  subcategories: Subcategory[];
}

export type GroupMode = 'CATEGORY' | 'SUBCATEGORY';

export interface ExpenseDistributionItem {
  id: string;
  name: string; // Nome categoria o sottocategoria
  parentCategory: string; // Nome categoria genitore
  parentBaseColor: string;
  amount: number;
  count: number;
  percentage: number; // Percentuale sul totale generale delle spese
  categoryPercentage?: number; // Percentuale all'interno della propria categoria padre
  color: string; // Colore sfumato in base alla dimensione ("più scuro se più grande, meno scuro se più piccolo")
  iconName: string;
  isSubcategory: boolean;
  subRank?: number; // 0 = più grande della categoria padre
  subTotalInCat?: number;
}

const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  'Alimentazione': '#f97316', // Arancione
  'Casa': '#6366f1', // Indaco
  'Trasporti': '#0284c7', // Sky Blue
  'Salute': '#10b981', // Smeraldo
  'Tempo Libero': '#ec4899', // Rosa
  'Lavoro': '#3b82f6', // Blu
  'Istruzione': '#8b5cf6', // Viola
  'Abbigliamento': '#14b8a6', // Teal
  'Spese Personali': '#f59e0b', // Ambra
  'Utenze': '#eab308', // Giallo
  'Imposte e Tasse': '#ef4444', // Rosso
  'Banca e Finanza': '#06b6d4', // Ciano
  'Altro': '#64748b', // Slate
};

const PALETTE = [
  '#E31B23', '#f97316', '#6366f1', '#0284c7', '#10b981', '#ec4899',
  '#8b5cf6', '#eab308', '#14b8a6', '#06b6d4', '#f43f5e', '#64748b'
];

/**
 * Converte un colore HEX in HSL
 */
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  let c = hex.trim().replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

/**
 * Converte HSL in HEX
 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/**
 * Genera una sfumatura armoniosa per una sottocategoria appartenente alla stessa categoria padre:
 * "più scuro se più grande, meno scuro se più piccolo"
 * @param baseHex Colore base della categoria padre
 * @param index Indice ordinato della sottocategoria per importo (0 = importo maggiore)
 * @param totalCount Numero totale di sottocategorie in quella categoria padre
 */
export function getSubcategoryShade(baseHex: string, index: number, totalCount: number): string {
  if (!baseHex || !baseHex.startsWith('#')) {
    baseHex = '#64748b';
  }
  if (totalCount <= 1) {
    return baseHex;
  }

  const { h, s } = hexToHSL(baseHex);

  // Range di luminosità:
  // index = 0 (spesa più grande): più scuro e profondo (L = 28%)
  // index = totalCount - 1 (spesa più piccola): meno scuro / più chiaro (L = 72%)
  const minL = 28;
  const maxL = 72;

  const fraction = index / (totalCount - 1);
  const lightness = Math.round(minL + fraction * (maxL - minL));
  const saturation = Math.max(55, Math.min(95, s));

  return hslToHex(h, saturation, lightness);
}

export const RecentExpensesPieChart: React.FC<RecentExpensesPieChartProps> = ({
  movements = [],
  subcategories = []
}) => {
  const { isDark } = useTheme();

  // Modalità di raggruppamento: Categorie vs Sottocategorie
  const [groupMode, setGroupMode] = useState<GroupMode>('CATEGORY');
  // Filtro periodo: Ultimi 30 giorni vs Mese Corrente
  const [period, setPeriod] = useState<'LAST_30' | 'CURRENT_MONTH'>('CURRENT_MONTH');
  // Filtro opzionale per categoria padre (solo quando in modalità sottocategorie)
  const [selectedParentFilter, setSelectedParentFilter] = useState<string | null>(null);

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);

  // Calcolo dati di distribuzione spese
  const {
    displayData,
    totalExpenses,
    periodLabel,
    availableParentCategories
  } = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonthNum = today.getMonth() + 1;
    const currentMonthStr = String(currentMonthNum).padStart(2, '0');

    const thirtyDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    const isMonthView = period === 'CURRENT_MONTH';
    const currentFinMonth = getCurrentFinancialMonth();
    const periodInfo = getFinancialPeriodInfo(currentFinMonth);

    const periodLabel = isMonthView
      ? periodInfo.label
      : 'Ultimi 30 Giorni';

    // 1. Filtra movimenti di spesa nel periodo (inclusivo del mese finanziario personalizzato)
    const expenseMovements = (movements || []).filter(m => {
      if (m.tipologia !== 'USCITA') return false;
      if ((m as any).is_deleted) return false;
      if (isMonthView) {
        return m.data && isDateInFinancialMonth(m.data, currentFinMonth);
      } else {
        return m.data && m.data >= thirtyDaysAgoStr && m.data <= todayStr;
      }
    });

    const total = expenseMovements.reduce((sum, m) => sum + m.importo, 0);

    // Mappa categorie padre disponibili
    const parentCatsSet = new Set<string>();

    if (groupMode === 'CATEGORY') {
      // --- MODALITÀ: CATEGORIE PADRE ---
      const groups: Record<string, {
        amount: number;
        count: number;
        subIds: string[];
        iconName?: string;
        color?: string;
      }> = {};

      expenseMovements.forEach(m => {
        const sub = subcategories.find(s => s.id === m.sottocategoria_id);
        const catName = sub?.categoria_padre?.trim() || sub?.nome?.trim() || 'Altro';
        parentCatsSet.add(catName);

        if (!groups[catName]) {
          groups[catName] = {
            amount: 0,
            count: 0,
            subIds: [],
            iconName: sub?.icon_name || 'Tag',
            color: DEFAULT_CATEGORY_COLORS[catName] || sub?.colore
          };
        }
        groups[catName].amount += m.importo;
        groups[catName].count += 1;
        if (sub && !groups[catName].subIds.includes(sub.id)) {
          groups[catName].subIds.push(sub.id);
        }
      });

      const entries: ExpenseDistributionItem[] = Object.entries(groups)
        .map(([name, data], idx) => {
          const amt = Math.round(data.amount * 100) / 100;
          const pct = total > 0 ? Math.round((amt / total) * 1000) / 10 : 0;
          const color = data.color || DEFAULT_CATEGORY_COLORS[name] || PALETTE[idx % PALETTE.length];
          return {
            id: `cat-${name}`,
            name,
            parentCategory: name,
            parentBaseColor: color,
            amount: amt,
            count: data.count,
            percentage: pct,
            color,
            iconName: data.iconName || 'Tag',
            isSubcategory: false
          };
        })
        .sort((a, b) => b.amount - a.amount);

      return {
        displayData: entries,
        totalExpenses: Math.round(total * 100) / 100,
        periodLabel,
        availableParentCategories: Array.from(parentCatsSet).sort()
      };
    } else {
      // --- MODALITÀ: SOTTOCATEGORIE ---
      // Raggruppa prima per sottocategoria
      const subGroups: Record<string, {
        subId: string;
        name: string;
        parentCategory: string;
        amount: number;
        count: number;
        iconName: string;
      }> = {};

      expenseMovements.forEach(m => {
        const sub = subcategories.find(s => s.id === m.sottocategoria_id);
        const subId = sub?.id || m.sottocategoria_id || 'sub-unknown';
        const subName = sub?.nome?.trim() || m.descrizione?.trim() || 'Sottocategoria';
        const parentCategory = sub?.categoria_padre?.trim() || 'Altro';
        parentCatsSet.add(parentCategory);

        if (!subGroups[subId]) {
          subGroups[subId] = {
            subId,
            name: subName,
            parentCategory,
            amount: 0,
            count: 0,
            iconName: sub?.icon_name || 'Tag'
          };
        }

        subGroups[subId].amount += m.importo;
        subGroups[subId].count += 1;
      });

      // Raggruppa le sottocategorie per Categoria Padre per calcolarne la gerarchia di colori
      const parentBuckets: Record<string, typeof subGroups[string][]> = {};
      Object.values(subGroups).forEach(item => {
        if (!parentBuckets[item.parentCategory]) {
          parentBuckets[item.parentCategory] = [];
        }
        parentBuckets[item.parentCategory].push(item);
      });

      // Calcola totali per categoria padre per ordinare le categorie nel grafico
      const parentTotals: { categoryName: string; total: number }[] = Object.entries(parentBuckets).map(
        ([catName, items]) => ({
          categoryName: catName,
          total: items.reduce((s, it) => s + it.amount, 0)
        })
      );
      parentTotals.sort((a, b) => b.total - a.total);

      // Costruisci gli item delle sottocategorie con sfumatura di colore
      const finalSubItems: ExpenseDistributionItem[] = [];

      parentTotals.forEach((pGroup, catIdx) => {
        const catName = pGroup.categoryName;
        const itemsInCat = parentBuckets[catName] || [];

        // Trova il colore base della categoria padre
        const sampleSub = subcategories.find(s => s.categoria_padre === catName);
        const baseColor = DEFAULT_CATEGORY_COLORS[catName] || sampleSub?.colore || PALETTE[catIdx % PALETTE.length];

        // Ordina le sottocategorie della stessa categoria padre per importo decrescente
        // (La più grande avrà l'indice 0)
        itemsInCat.sort((a, b) => b.amount - a.amount);
        const totalInCat = pGroup.total;

        itemsInCat.forEach((subItem, rankIndex) => {
          // "Sottocategorie se fanno parte della stessa categoria avra dei colori simili
          // ossia sempre rosso ma piu scuro se piu grande meno scuro se piu piccolo"
          const shadeColor = getSubcategoryShade(baseColor, rankIndex, itemsInCat.length);
          const amt = Math.round(subItem.amount * 100) / 100;
          const pctTotal = total > 0 ? Math.round((amt / total) * 1000) / 10 : 0;
          const pctCat = totalInCat > 0 ? Math.round((amt / totalInCat) * 1000) / 10 : 100;

          finalSubItems.push({
            id: `sub-${subItem.subId}-${rankIndex}`,
            name: subItem.name,
            parentCategory: catName,
            parentBaseColor: baseColor,
            amount: amt,
            count: subItem.count,
            percentage: pctTotal,
            categoryPercentage: pctCat,
            color: shadeColor,
            iconName: subItem.iconName,
            isSubcategory: true,
            subRank: rankIndex,
            subTotalInCat: itemsInCat.length
          });
        });
      });

      // Applica eventuale filtro su categoria padre selezionata
      const filteredSubItems = selectedParentFilter
        ? finalSubItems.filter(item => item.parentCategory === selectedParentFilter)
        : finalSubItems;

      return {
        displayData: filteredSubItems,
        totalExpenses: Math.round(total * 100) / 100,
        periodLabel,
        availableParentCategories: Array.from(parentCatsSet).sort()
      };
    }
  }, [movements, subcategories, period, groupMode, selectedParentFilter]);

  // Gestione settore attivo per effetto hover / focus
  const activeItem = activeIndex !== null && displayData[activeIndex]
    ? displayData[activeIndex]
    : null;

  // Custom Active Shape per Recharts Donut
  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius - 2}
          outerRadius={outerRadius + 5}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          style={{ filter: `drop-shadow(0px 2px 8px ${fill}66)` }}
        />
      </g>
    );
  };

  // Custom Tooltip con informazioni avanzate su Categoria e Sottocategoria
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ExpenseDistributionItem;
      return (
        <div className="bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-md px-3.5 py-3 rounded-2xl shadow-xl border border-slate-200/80 dark:border-white/10 text-xs z-50 animate-in fade-in duration-100 min-w-[210px]">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-[#F5F5F7] mb-1.5 pb-1.5 border-b border-slate-100 dark:border-white/5">
            <span
              className="w-3 h-3 rounded-full shrink-0 shadow-xs"
              style={{ backgroundColor: data.color }}
            />
            <div className="truncate">
              <span className="block truncate text-xs">{data.name}</span>
              {data.isSubcategory && (
                <span className="text-[10px] text-slate-500 dark:text-[#8E8E93] font-normal block truncate">
                  Cat: {data.parentCategory}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1 font-numeric text-[11px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500 dark:text-[#8E8E93]">Spesa Totale:</span>
              <strong className="font-extrabold text-slate-900 dark:text-white text-xs">
                {formatCurrency(data.amount)}
              </strong>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500 dark:text-[#8E8E93]">Quota sul Totale:</span>
              <span className="font-bold text-[#E31B23]">
                {data.percentage}%
              </span>
            </div>

            {data.isSubcategory && data.categoryPercentage !== undefined && (
              <div className="flex items-center justify-between gap-3 pt-0.5 border-t border-slate-100 dark:border-white/5">
                <span className="text-slate-500 dark:text-[#8E8E93] text-[10px]">
                  Di {data.parentCategory}:
                </span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 text-[10px]">
                  {data.categoryPercentage}%
                  {data.subTotalInCat && data.subTotalInCat > 1 && (
                    <span className="text-slate-400 ml-1">
                      (#{((data.subRank || 0) + 1)} per importo)
                    </span>
                  )}
                </span>
              </div>
            )}

            <div className="text-[10px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
              <span>{data.count} {data.count === 1 ? 'movimento' : 'movimenti'}</span>
              {data.isSubcategory && (
                <span
                  className="px-1.5 py-0.2 rounded-full text-[9px] font-medium"
                  style={{
                    backgroundColor: `${data.parentBaseColor}20`,
                    color: data.parentBaseColor
                  }}
                >
                  Tonalità graduata
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
      id="recent-expenses-pie-section"
      className="p-3.5 sm:p-4 rounded-3xl bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3"
    >
      {/* Header compatto con titolo, selettore Categorie/Sottocategorie, periodo e toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-2xl bg-[#E31B23]/10 text-[#E31B23] flex items-center justify-center font-bold shrink-0">
            <PieChartIcon size={16} />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#F5F5F7] leading-tight flex items-center gap-1.5">
              <span>Distribuzione Spese</span>
              <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-[#8E8E93] border border-slate-200/60 dark:border-white/5">
                {groupMode === 'CATEGORY' ? 'per Categoria' : 'per Sottocategoria'}
              </span>
            </h4>
            <span className="text-[11px] text-slate-500 dark:text-[#8E8E93] font-medium">
              {periodLabel} • Totale: <strong className="font-numeric text-slate-900 dark:text-white">{formatCurrency(totalExpenses)}</strong>
            </span>
          </div>
        </div>

        {/* Toolbar Controlli: Switch Categoria/Sottocategoria + Periodo + Collasso */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Selettore Richiesto dall'Utente: Categorie vs Sottocategorie */}
          <div className="flex bg-slate-100 dark:bg-white/5 p-0.5 rounded-2xl border border-slate-200/70 dark:border-white/5 text-xs">
            <button
              onClick={() => {
                setGroupMode('CATEGORY');
                setSelectedParentFilter(null);
                setActiveIndex(null);
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
                groupMode === 'CATEGORY'
                  ? 'bg-white dark:bg-[#2A2A2E] text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 dark:text-[#8E8E93] hover:text-slate-800 dark:hover:text-white'
              }`}
              title="Raggruppa per macro-categorie"
            >
              <Layers size={12} className={groupMode === 'CATEGORY' ? 'text-[#E31B23]' : ''} />
              <span>Categorie</span>
            </button>
            <button
              onClick={() => {
                setGroupMode('SUBCATEGORY');
                setActiveIndex(null);
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
                groupMode === 'SUBCATEGORY'
                  ? 'bg-white dark:bg-[#2A2A2E] text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 dark:text-[#8E8E93] hover:text-slate-800 dark:hover:text-white'
              }`}
              title="Mostra singole sottocategorie con sfumature di colore gerarchiche"
            >
              <Tag size={12} className={groupMode === 'SUBCATEGORY' ? 'text-[#E31B23]' : ''} />
              <span>Sottocategorie</span>
            </button>
          </div>

          {/* Selettore Periodo: 30gg vs Mese Corrente */}
          <div className="flex bg-slate-100 dark:bg-white/5 p-0.5 rounded-2xl border border-slate-200/70 dark:border-white/5 text-xs">
            <button
              onClick={() => setPeriod('CURRENT_MONTH')}
              className={`px-2 py-1 rounded-xl text-xs font-semibold transition-all ${
                period === 'CURRENT_MONTH'
                  ? 'bg-white dark:bg-[#2A2A2E] text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 dark:text-[#8E8E93] hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Mese Corr.
            </button>
            <button
              onClick={() => setPeriod('LAST_30')}
              className={`px-2 py-1 rounded-xl text-xs font-semibold transition-all ${
                period === 'LAST_30'
                  ? 'bg-white dark:bg-[#2A2A2E] text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 dark:text-[#8E8E93] hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              30gg
            </button>
          </div>

          {/* Toggle Collassabile */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            title={isCollapsed ? 'Espandi grafico' : 'Comprimi grafico'}
          >
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {/* Barra Informativa Sottocategorie con spiegazione sfumatura e filtro categoria opzionale */}
      {!isCollapsed && groupMode === 'SUBCATEGORY' && availableParentCategories.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#8E8E93]">
            <span className="flex items-center gap-1">
              <Sparkles size={12} className="text-[#E31B23]" />
              Sottocategorie raggruppate per colore madre: <strong>più scuro = spesa maggiore</strong>
            </span>
            {selectedParentFilter && (
              <button
                onClick={() => setSelectedParentFilter(null)}
                className="text-[10px] text-[#E31B23] hover:underline font-bold"
              >
                Mostra tutte
              </button>
            )}
          </div>

          {/* Chip Filtro per Categoria Padre */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setSelectedParentFilter(null)}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 transition-all border ${
                selectedParentFilter === null
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                  : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-[#8E8E93] border-slate-200/60 dark:border-white/5 hover:bg-slate-100'
              }`}
            >
              Tutte ({availableParentCategories.length})
            </button>
            {availableParentCategories.map(catName => {
              const baseColor = DEFAULT_CATEGORY_COLORS[catName] || '#64748b';
              const isSelected = selectedParentFilter === catName;
              return (
                <button
                  key={catName}
                  onClick={() => setSelectedParentFilter(isSelected ? null : catName)}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 transition-all flex items-center gap-1.5 border ${
                    isSelected
                      ? 'shadow-xs border-current font-bold'
                      : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-[#8E8E93] border-slate-200/60 dark:border-white/5 hover:bg-slate-100'
                  }`}
                  style={isSelected ? {
                    backgroundColor: `${baseColor}18`,
                    color: baseColor,
                    borderColor: baseColor
                  } : undefined}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: baseColor }}
                  />
                  <span>{catName}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Contenuto Grafico Donut + Legenda Interattiva One UI */}
      {!isCollapsed && (
        <>
          {displayData.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1.5">
              <Calendar size={20} className="text-slate-300 dark:text-slate-600" />
              <span>Nessuna spesa registrata per il periodo o filtro selezionato.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pt-1">
              {/* Grafico Donut con Totale / Categoria Evidenziata al Centro */}
              <div className="sm:col-span-5 flex flex-col items-center justify-center relative">
                <div className="w-full h-46 sm:h-50 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={displayData}
                        dataKey="amount"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={displayData.length > 25 ? 1 : 2}
                        cornerRadius={3}
                        activeIndex={activeIndex !== null ? activeIndex : undefined}
                        activeShape={renderActiveShape}
                        onMouseEnter={(_, index) => setActiveIndex(index)}
                        onMouseLeave={() => setActiveIndex(null)}
                        animationDuration={600}
                        animationEasing="ease-out"
                      >
                        {displayData.map((entry, index) => (
                          <Cell
                            key={`cell-${entry.id}-${index}`}
                            fill={entry.color}
                            className="cursor-pointer transition-all duration-200"
                            stroke={activeIndex === index ? (isDark ? '#FFFFFF' : '#000000') : 'transparent'}
                            strokeWidth={activeIndex === index ? 2 : 0}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Centro Dinamico del Donut */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                    {activeItem ? (
                      <>
                        {activeItem.isSubcategory && (
                          <span
                            className="text-[9px] font-bold uppercase tracking-wider truncate max-w-[85px]"
                            style={{ color: activeItem.parentBaseColor }}
                          >
                            {activeItem.parentCategory}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate max-w-[90px] leading-tight">
                          {activeItem.name}
                        </span>
                        <span className="font-numeric text-xs font-extrabold text-slate-900 dark:text-white leading-tight mt-0.5">
                          {formatCurrency(activeItem.amount)}
                        </span>
                        <span className="text-[10px] font-bold text-[#E31B23] font-numeric">
                          {activeItem.percentage}%
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[9px] font-semibold text-slate-400 dark:text-[#8E8E93] uppercase tracking-wider">
                          Spesa Totale
                        </span>
                        <span className="font-numeric text-xs sm:text-sm font-extrabold text-slate-900 dark:text-[#F5F5F7] leading-tight">
                          {formatCurrency(totalExpenses)}
                        </span>
                        <span className="text-[9px] text-slate-400 dark:text-[#8E8E93] font-medium">
                          {displayData.length} {groupMode === 'CATEGORY' ? 'categorie' : 'sottocategorie'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Legenda Interattiva con badge gerarchici e importi */}
              <div className="sm:col-span-7 flex flex-col justify-center space-y-1">
                <div className="text-[10px] font-semibold text-slate-400 dark:text-[#8E8E93] uppercase tracking-wider flex items-center justify-between pb-1 border-b border-slate-100 dark:border-white/5">
                  <span>{groupMode === 'CATEGORY' ? 'Categoria' : 'Sottocategoria (Genitore)'}</span>
                  <span>Importo (% Totale)</span>
                </div>

                <div className="max-h-44 overflow-y-auto pr-1 space-y-1 no-scrollbar">
                  {displayData.map((item, idx) => {
                    const isSelected = activeIndex === idx;
                    return (
                      <div
                        key={item.id}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onMouseLeave={() => setActiveIndex(null)}
                        className={`flex items-center justify-between px-2 py-1.5 rounded-2xl text-xs transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-slate-100 dark:bg-white/10 shadow-xs scale-[1.01] border border-slate-300 dark:border-white/20'
                            : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-[#F5F5F7]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          {/* Dot con tonalità specifica della sottocategoria */}
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform shadow-xs"
                            style={{
                              backgroundColor: item.color,
                              transform: isSelected ? 'scale(1.3)' : 'scale(1)'
                            }}
                          />
                          <div className="w-5 h-5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 flex items-center justify-center shrink-0">
                            <CategoryIcon iconName={item.iconName} size={11} color={item.color} />
                          </div>
                          <div className="truncate">
                            <span className="font-semibold text-slate-900 dark:text-white truncate text-[11px] block">
                              {item.name}
                            </span>
                            {item.isSubcategory && (
                              <span
                                className="text-[9px] font-medium truncate block leading-none"
                                style={{ color: item.parentBaseColor }}
                              >
                                {item.parentCategory}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 font-numeric">
                          <span className="font-bold text-slate-900 dark:text-[#F5F5F7] text-[11px]">
                            {formatCurrency(item.amount)}
                          </span>
                          <span
                            className="px-1.5 py-0.2 rounded-md text-[10px] font-semibold border"
                            style={{
                              backgroundColor: `${item.color}15`,
                              color: item.color,
                              borderColor: `${item.color}35`
                            }}
                          >
                            {item.percentage}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
