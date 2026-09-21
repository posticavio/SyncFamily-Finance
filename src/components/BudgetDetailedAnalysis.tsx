import React, { useState, useMemo } from 'react';
import { BudgetPerformanceItem, MovementType, Subcategory } from '../types';
import { formatCurrency, formatItalianNumber, getMonthName } from '../utils/formatters';
import { CategoryIcon } from './CategoryIcon';
import { 
  getCurrentFinancialMonth, 
  getFinancialPeriodInfo, 
  formatDMY 
} from '../utils/financialDate';
import { 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  Percent, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Zap, 
  Target,
  HelpCircle,
  Flame,
  Lightbulb,
  ListFilter
} from 'lucide-react';

export type DeviationFilter = 'ALL' | 'CRITICAL' | 'WARNING' | 'ON_TRACK' | 'NO_BUDGET';

export interface CategoryAnalysisData {
  categoryName: string;
  tipo: MovementType;
  iconName: string;
  color: string;
  // Dati Base
  budget: number;
  reale: number;
  pianificato: number;
  // Proiezioni
  proiezioneFineMese: number;
  proiezioneRunRate: number;
  // Deviazioni
  deviazioneRealeAssoluta: number; // Reale - Budget
  deviazioneRealePercentuale: number; // % speso vs budget
  deviazioneProiettataAssoluta: number; // Proiezione - Budget
  deviazioneProiettataPercentuale: number;
  // Ritmo e giorni
  ritmoGiornalieroAttuale: number;
  budgetGiornalieroConsentito: number;
  // Valutazione di stato
  status: 'OVER_BUDGET' | 'HIGH_RISK' | 'PACE_ALERT' | 'ON_TRACK' | 'EXCELLENT' | 'NO_BUDGET';
  statusLabel: string;
  statusBadgeBg: string;
  statusBadgeText: string;
  statusBorder: string;
  // Suggerimento pratico
  suggerimento: string;
  items: BudgetPerformanceItem[];
}

interface BudgetDetailedAnalysisProps {
  selectedMonth: string;
  activeTab: MovementType;
  items: BudgetPerformanceItem[];
  allSubcategories: Subcategory[];
  onOpenNewBudget?: () => void;
  onNavigateToTransactions?: (filter: { subcategoryId?: string; month?: string }) => void;
}

export const BudgetDetailedAnalysis: React.FC<BudgetDetailedAnalysisProps> = ({
  selectedMonth,
  activeTab,
  items,
  allSubcategories,
  onOpenNewBudget,
  onNavigateToTransactions
}) => {
  const isExpense = activeTab === 'USCITA';
  const [filter, setFilter] = useState<DeviationFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Calcolo avanzamento del calendario temporale per il mese finanziario selezionato
  const timeProgress = useMemo(() => {
    const now = new Date();
    const currentFinMonth = getCurrentFinancialMonth();
    const pInfo = getFinancialPeriodInfo(selectedMonth);

    // Calcolo giorni totali nel periodo finanziario
    const startMs = pInfo.startObj.getTime();
    const endMs = pInfo.endObj.getTime();
    const totalDaysInMonth = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1);

    const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startMid = new Date(pInfo.startObj.getFullYear(), pInfo.startObj.getMonth(), pInfo.startObj.getDate()).getTime();
    const endMid = new Date(pInfo.endObj.getFullYear(), pInfo.endObj.getMonth(), pInfo.endObj.getDate()).getTime();

    let daysElapsed = 0;
    let daysRemaining = 0;
    let isCurrentMonth = false;
    let isPastMonth = false;
    let isFutureMonth = false;

    if (nowMid < startMid) {
      isFutureMonth = true;
      daysElapsed = 0;
      daysRemaining = totalDaysInMonth;
    } else if (nowMid > endMid) {
      isPastMonth = true;
      daysElapsed = totalDaysInMonth;
      daysRemaining = 0;
    } else {
      isCurrentMonth = true;
      daysElapsed = Math.min(totalDaysInMonth, Math.max(1, Math.round((nowMid - startMid) / (1000 * 60 * 60 * 24)) + 1));
      daysRemaining = Math.max(0, totalDaysInMonth - daysElapsed);
    }

    const elapsedPercentage = totalDaysInMonth > 0 
      ? Math.round((daysElapsed / totalDaysInMonth) * 100) 
      : 0;

    return {
      totalDaysInMonth,
      daysElapsed,
      daysRemaining,
      elapsedPercentage,
      isCurrentMonth,
      isPastMonth,
      isFutureMonth,
      periodInfo: pInfo
    };
  }, [selectedMonth]);

  // Elaborazione analitica dettagliata per ogni categoria padre
  const analyzedCategories = useMemo<CategoryAnalysisData[]>(() => {
    const filteredItems = items.filter(item => item.tipo === activeTab);
    const groupsMap = new Map<string, BudgetPerformanceItem[]>();

    filteredItems.forEach(item => {
      const cat = item.categoria_padre || 'Altro';
      if (!groupsMap.has(cat)) {
        groupsMap.set(cat, []);
      }
      groupsMap.get(cat)!.push(item);
    });

    const result: CategoryAnalysisData[] = [];
    const { totalDaysInMonth, daysElapsed, daysRemaining, elapsedPercentage, isCurrentMonth, isPastMonth } = timeProgress;

    groupsMap.forEach((subItems, categoryName) => {
      const budget = Math.round(subItems.reduce((acc, i) => acc + i.budget, 0) * 100) / 100;
      const reale = Math.round(subItems.reduce((acc, i) => acc + i.reale, 0) * 100) / 100;
      const pianificato = Math.round(subItems.reduce((acc, i) => acc + i.pianificato, 0) * 100) / 100;

      const firstItem = subItems[0];
      const iconName = firstItem?.icon_name || 'Tag';
      const color = firstItem?.colore || (isExpense ? '#f43f5e' : '#10b981');

      // Calcolo ritmo giornaliero
      const ritmoGiornalieroAttuale = daysElapsed > 0 
        ? Math.round((reale / daysElapsed) * 100) / 100 
        : 0;

      // Proiezione Run-Rate lineare sul tempo
      const proiezioneRunRate = Math.round((ritmoGiornalieroAttuale * totalDaysInMonth) * 100) / 100;

      // Proiezione composita di fine mese
      let proiezioneFineMese = 0;
      if (isPastMonth) {
        proiezioneFineMese = reale;
      } else if (isCurrentMonth) {
        // Se ci sono uscite pianificate, la proiezione considera la quota spesa + impegni pianificati o run-rate se più alto
        if (pianificato > 0) {
          proiezioneFineMese = Math.round(Math.max(reale + pianificato, reale + (ritmoGiornalieroAttuale * daysRemaining)) * 100) / 100;
        } else {
          proiezioneFineMese = Math.round((ritmoGiornalieroAttuale * totalDaysInMonth) * 100) / 100;
        }
      } else {
        // Mese futuro
        proiezioneFineMese = pianificato;
      }

      // Deviazioni Reali
      const deviazioneRealeAssoluta = Math.round((reale - budget) * 100) / 100;
      const deviazioneRealePercentuale = budget > 0 
        ? Math.round((reale / budget) * 100) 
        : (reale > 0 ? 100 : 0);

      // Deviazioni Proiettate
      const deviazioneProiettataAssoluta = Math.round((proiezioneFineMese - budget) * 100) / 100;
      const deviazioneProiettataPercentuale = budget > 0 
        ? Math.round(((proiezioneFineMese - budget) / budget) * 100) 
        : 0;

      // Budget giornaliero consentito per i giorni rimanenti
      const budgetRimanente = Math.max(0, budget - reale - pianificato);
      const budgetGiornalieroConsentito = daysRemaining > 0 
        ? Math.round((budgetRimanente / daysRemaining) * 100) / 100 
        : 0;

      // Determinazione Status & Suggerimento Pratico
      let status: CategoryAnalysisData['status'] = 'ON_TRACK';
      let statusLabel = 'In Linea';
      let statusBadgeBg = 'bg-emerald-500/15';
      let statusBadgeText = 'text-emerald-500 dark:text-emerald-400';
      let statusBorder = 'border-emerald-500/30';
      let suggerimento = '';

      if (isExpense) {
        if (budget === 0) {
          status = 'NO_BUDGET';
          statusLabel = 'Nessun Budget';
          statusBadgeBg = 'bg-slate-500/15';
          statusBadgeText = 'text-slate-500 dark:text-slate-400';
          statusBorder = 'border-slate-500/30';
          suggerimento = `Hai effettuato spese per ${formatCurrency(reale)} senza aver preventivato un budget. Imposta un tetto mensile consigliato di almeno ${formatCurrency(proiezioneFineMese || reale)} per tenere sotto controllo questa voce.`;
        } else if (reale > budget) {
          status = 'OVER_BUDGET';
          statusLabel = 'Sforato Ora';
          statusBadgeBg = 'bg-[#E31B23]/15';
          statusBadgeText = 'text-[#E31B23]';
          statusBorder = 'border-[#E31B23]/30';
          suggerimento = `Budget preventivato superato di ${formatCurrency(reale - budget)} (${deviazioneRealePercentuale}% del budget consumato). Blocca le ulteriori uscite discrezionali in questa categoria per evitare un disavanzo finale superiore a ${formatCurrency(deviazioneProiettataAssoluta)}.`;
        } else if (proiezioneFineMese > budget) {
          status = 'HIGH_RISK';
          statusLabel = 'Rischio Sforamento';
          statusBadgeBg = 'bg-amber-500/15';
          statusBadgeText = 'text-amber-500 dark:text-amber-400';
          statusBorder = 'border-amber-500/30';
          if (pianificato > 0 && reale === 0) {
            suggerimento = `Ci sono uscite pianificate per ${formatCurrency(pianificato)} che portano la spesa stimata a ${formatCurrency(proiezioneFineMese)}, con uno sforamento previsto di ${formatCurrency(deviazioneProiettataAssoluta)} rispetto al budget fissato (${formatCurrency(budget)}).`;
          } else {
            suggerimento = `Al ritmo attuale di ${formatCurrency(ritmoGiornalieroAttuale)}/gg e considerando gli impegni pianificati, la spesa stimata a fine mese raggiungerà ${formatCurrency(proiezioneFineMese)}, con uno sforamento stimato di ${formatCurrency(deviazioneProiettataAssoluta)} (+${deviazioneProiettataPercentuale}%). Riduci la spesa a massimo ${formatCurrency(budgetGiornalieroConsentito)}/gg per i restanti ${daysRemaining} giorni.`;
          }
        } else if (deviazioneRealePercentuale > elapsedPercentage + 15) {
          status = 'PACE_ALERT';
          statusLabel = 'Ritmo Accelerato';
          statusBadgeBg = 'bg-yellow-500/15';
          statusBadgeText = 'text-yellow-600 dark:text-yellow-400';
          statusBorder = 'border-yellow-500/30';
          suggerimento = `La spesa procede più rapidamente del calendario: hai consumato il ${deviazioneRealePercentuale}% del budget mentre è trascorso il ${elapsedPercentage}% del mese. Mantieni la spesa media sotto ${formatCurrency(budgetGiornalieroConsentito)}/gg per non rischiare sforamenti nelle ultime settimane.`;
        } else if (budget > 0 && deviazioneRealePercentuale < Math.max(0, elapsedPercentage - 20)) {
          status = 'EXCELLENT';
          statusLabel = 'Ottimo Risparmio';
          statusBadgeBg = 'bg-teal-500/15';
          statusBadgeText = 'text-teal-500 dark:text-teal-400';
          statusBorder = 'border-teal-500/30';
          suggerimento = `Spesa molto controllata e virtuosa. Al trend attuale è previsto un risparmio di fine mese pari a ${formatCurrency(budget - proiezioneFineMese)} rispetto al tetto stabilito. Hai ancora un margine sicuro di ${formatCurrency(budgetGiornalieroConsentito)}/gg.`;
        } else {
          status = 'ON_TRACK';
          statusLabel = 'In Linea';
          statusBadgeBg = 'bg-emerald-500/15';
          statusBadgeText = 'text-emerald-500 dark:text-emerald-400';
          statusBorder = 'border-emerald-500/30';
          suggerimento = `Spesa perfettamente bilanciata con il trascorrere dei giorni. Il ritmo di spesa (${formatCurrency(ritmoGiornalieroAttuale)}/gg) è pienamente sostenibile rispetto al limite consentito (${formatCurrency(budgetGiornalieroConsentito)}/gg).`;
        }
      } else {
        // ENTRATE
        if (budget === 0) {
          status = 'NO_BUDGET';
          statusLabel = 'Nessun Target';
          statusBadgeBg = 'bg-slate-500/15';
          statusBadgeText = 'text-slate-500 dark:text-slate-400';
          statusBorder = 'border-slate-500/30';
          suggerimento = `Incassi registrati per ${formatCurrency(reale)} senza un obiettivo preventivato. Fissa un target per monitorare le tue entrate ricorrenti.`;
        } else if (reale >= budget) {
          status = 'EXCELLENT';
          statusLabel = 'Target Raggiunto';
          statusBadgeBg = 'bg-emerald-500/15';
          statusBadgeText = 'text-emerald-500 dark:text-emerald-400';
          statusBorder = 'border-emerald-500/30';
          suggerimento = `Obiettivo di incasso mensile già pienamente raggiunto! Hai incassato ${formatCurrency(reale)} su ${formatCurrency(budget)} (+${formatCurrency(reale - budget)} oltre target).`;
        } else if (proiezioneFineMese >= budget) {
          status = 'ON_TRACK';
          statusLabel = 'In Linea';
          statusBadgeBg = 'bg-emerald-500/15';
          statusBadgeText = 'text-emerald-500 dark:text-emerald-400';
          statusBorder = 'border-emerald-500/30';
          suggerimento = `Con le entrate già incassate (${formatCurrency(reale)}) e i ricavi pianificati (${formatCurrency(pianificato)}), l'obiettivo preventivato di ${formatCurrency(budget)} verrà raggiunto a fine mese.`;
        } else {
          status = 'HIGH_RISK';
          statusLabel = 'Sotto Target';
          statusBadgeBg = 'bg-amber-500/15';
          statusBadgeText = 'text-amber-500 dark:text-amber-400';
          statusBorder = 'border-amber-500/30';
          suggerimento = `Al ritmo attuale l'incasso stimato a fine mese sarà di ${formatCurrency(proiezioneFineMese)} (${Math.round((proiezioneFineMese / budget) * 100)}% del target). Mancano ancora ${formatCurrency(budget - proiezioneFineMese)} per completare l'obiettivo.`;
        }
      }

      result.push({
        categoryName,
        tipo: activeTab,
        iconName,
        color,
        budget,
        reale,
        pianificato,
        proiezioneFineMese,
        proiezioneRunRate,
        deviazioneRealeAssoluta,
        deviazioneRealePercentuale,
        deviazioneProiettataAssoluta,
        deviazioneProiettataPercentuale,
        ritmoGiornalieroAttuale,
        budgetGiornalieroConsentito,
        status,
        statusLabel,
        statusBadgeBg,
        statusBadgeText,
        statusBorder,
        suggerimento,
        items: subItems
      });
    });

    // Ordina prima per priorità di allerta (Sforati -> Rischio -> Ritmo -> In Linea)
    const priorityOrder: Record<CategoryAnalysisData['status'], number> = {
      OVER_BUDGET: 0,
      HIGH_RISK: 1,
      PACE_ALERT: 2,
      NO_BUDGET: 3,
      ON_TRACK: 4,
      EXCELLENT: 5
    };

    return result.sort((a, b) => {
      const pDiff = priorityOrder[a.status] - priorityOrder[b.status];
      if (pDiff !== 0) return pDiff;
      return Math.abs(b.deviazioneProiettataAssoluta) - Math.abs(a.deviazioneProiettataAssoluta);
    });
  }, [items, activeTab, timeProgress, isExpense]);

  // Sintesi esecutiva globale
  const summary = useMemo(() => {
    const totalBudget = Math.round(analyzedCategories.reduce((acc, c) => acc + c.budget, 0) * 100) / 100;
    const totalReale = Math.round(analyzedCategories.reduce((acc, c) => acc + c.reale, 0) * 100) / 100;
    const totalProiezione = Math.round(analyzedCategories.reduce((acc, c) => acc + c.proiezioneFineMese, 0) * 100) / 100;
    const totalDeviazione = Math.round((totalProiezione - totalBudget) * 100) / 100;

    const overBudgetCount = analyzedCategories.filter(c => c.status === 'OVER_BUDGET').length;
    const highRiskCount = analyzedCategories.filter(c => c.status === 'HIGH_RISK' || c.status === 'PACE_ALERT').length;
    const onTrackCount = analyzedCategories.filter(c => c.status === 'ON_TRACK' || c.status === 'EXCELLENT').length;
    const noBudgetCount = analyzedCategories.filter(c => c.status === 'NO_BUDGET').length;

    return {
      totalBudget,
      totalReale,
      totalProiezione,
      totalDeviazione,
      overBudgetCount,
      highRiskCount,
      onTrackCount,
      noBudgetCount
    };
  }, [analyzedCategories]);

  // Filtraggio per vista utente
  const filteredCategories = useMemo(() => {
    return analyzedCategories.filter(cat => {
      // Filtro per stato deviazione
      if (filter === 'CRITICAL' && cat.status !== 'OVER_BUDGET') return false;
      if (filter === 'WARNING' && cat.status !== 'HIGH_RISK' && cat.status !== 'PACE_ALERT') return false;
      if (filter === 'ON_TRACK' && cat.status !== 'ON_TRACK' && cat.status !== 'EXCELLENT') return false;
      if (filter === 'NO_BUDGET' && cat.status !== 'NO_BUDGET') return false;

      // Ricerca testuale
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = cat.categoryName.toLowerCase().includes(q);
        const matchSub = cat.items.some(i => i.sottocategoria_nome.toLowerCase().includes(q));
        if (!matchName && !matchSub) return false;
      }

      return true;
    });
  }, [analyzedCategories, filter, searchQuery]);

  const toggleExpand = (catName: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catName]: !prev[catName]
    }));
  };

  return (
    <div id="budget-detailed-analysis-container" className="space-y-4">
      {/* Banner Avanzamento Temporale & Sintesi Esecutiva */}
      <div className="bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* Intestazione e Barra Temporale */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#F5F5F7]">
                Analisi Scostamenti & Proiezioni Fine Mese
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#8E8E93]">
                {timeProgress.isCurrentMonth && `Giorno ${timeProgress.daysElapsed} di ${timeProgress.totalDaysInMonth} (${timeProgress.elapsedPercentage}% del mese trascorso • ${timeProgress.daysRemaining} giorni restanti)`}
                {timeProgress.isPastMonth && `Mese concluso • Consuntivo finale completo (${timeProgress.totalDaysInMonth} giorni)`}
                {timeProgress.isFutureMonth && `Mese futuro • Analisi basata sulle uscite pianificate e scadenze`}
              </p>
            </div>
          </div>

          {/* Badge Tempo */}
          {timeProgress.isCurrentMonth && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 text-xs font-semibold text-slate-700 dark:text-[#F5F5F7] border border-slate-200/60 dark:border-white/5 shrink-0 self-start sm:self-auto">
              <Calendar size={13} className="text-indigo-500" />
              <span>Oggi: {timeProgress.elapsedPercentage}% Mese</span>
            </div>
          )}
        </div>

        {/* Barra di Avanzamento Temporale Grafica */}
        {timeProgress.isCurrentMonth && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-medium text-slate-500 dark:text-[#8E8E93]">
              <span>Inizio Mese (1 {getMonthName(selectedMonth).slice(0, 3)})</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                Giorno {timeProgress.daysElapsed} (Oggi)
              </span>
              <span>Fine Mese ({timeProgress.totalDaysInMonth} {getMonthName(selectedMonth).slice(0, 3)})</span>
            </div>
            <div className="relative w-full h-2.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${timeProgress.elapsedPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* 4 KPI Sintetici di Deviazione Globale */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#242426] border border-slate-100 dark:border-white/5">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-[#8E8E93] uppercase tracking-wider block">
              Budget Preventivato
            </span>
            <div className="font-numeric tabular-nums text-base sm:text-lg font-bold text-slate-900 dark:text-[#F5F5F7] mt-0.5">
              {formatCurrency(summary.totalBudget)}
            </div>
            <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block mt-0.5">
              Tetto cumulativo categorie
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#242426] border border-slate-100 dark:border-white/5">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-[#8E8E93] uppercase tracking-wider block">
              Speso Reale Finora
            </span>
            <div className="font-numeric tabular-nums text-base sm:text-lg font-bold text-slate-900 dark:text-[#F5F5F7] mt-0.5">
              {formatCurrency(summary.totalReale)}
            </div>
            <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block mt-0.5">
              {summary.totalBudget > 0 ? `${Math.round((summary.totalReale / summary.totalBudget) * 100)}% del budget totale` : 'Transazioni effettive'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/80 dark:border-indigo-900/30">
            <span className="text-[10px] font-semibold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider block">
              Proiezione Fine Mese
            </span>
            <div className="font-numeric tabular-nums text-base sm:text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
              {formatCurrency(summary.totalProiezione)}
            </div>
            <span className="text-[10px] text-indigo-700/80 dark:text-indigo-400/80 block mt-0.5">
              Stima a fine mese
            </span>
          </div>

          <div className={`p-3 rounded-xl border ${
            isExpense 
              ? (summary.totalDeviazione <= 0 ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30' : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/30')
              : (summary.totalDeviazione >= 0 ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30' : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30')
          }`}>
            <span className={`text-[10px] font-semibold uppercase tracking-wider block ${
              isExpense
                ? (summary.totalDeviazione <= 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300')
                : (summary.totalDeviazione >= 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300')
            }`}>
              Scostamento Proiettato
            </span>
            <div className={`font-numeric tabular-nums text-base sm:text-lg font-bold mt-0.5 ${
              isExpense
                ? (summary.totalDeviazione <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')
                : (summary.totalDeviazione >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')
            }`}>
              {formatCurrency(summary.totalDeviazione, { showSign: true })}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-[#8E8E93] block mt-0.5">
              {isExpense 
                ? (summary.totalDeviazione <= 0 ? 'Risparmio netto stimato' : 'Sforamento netto stimato')
                : (summary.totalDeviazione >= 0 ? 'Target stimato raggiunto' : 'Disavanzo stimato sul target')}
            </span>
          </div>
        </div>
      </div>

      {/* Barra di Controllo: Filtri Deviazione e Ricerca Rapida */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Filtri Pillola One UI */}
        <div className="flex bg-slate-100 dark:bg-[#1C1C1E] p-1 rounded-full text-xs font-semibold overflow-x-auto no-scrollbar border border-slate-200/60 dark:border-white/5">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${
              filter === 'ALL'
                ? 'bg-[#E31B23] text-white shadow-xs'
                : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7]'
            }`}
          >
            Tutte ({analyzedCategories.length})
          </button>
          <button
            onClick={() => setFilter('CRITICAL')}
            className={`px-3 py-1.5 rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filter === 'CRITICAL'
                ? 'bg-[#E31B23] text-white shadow-xs'
                : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Sforate ({summary.overBudgetCount})</span>
          </button>
          <button
            onClick={() => setFilter('WARNING')}
            className={`px-3 py-1.5 rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filter === 'WARNING'
                ? 'bg-[#E31B23] text-white shadow-xs'
                : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>A Rischio ({summary.highRiskCount})</span>
          </button>
          <button
            onClick={() => setFilter('ON_TRACK')}
            className={`px-3 py-1.5 rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filter === 'ON_TRACK'
                ? 'bg-[#E31B23] text-white shadow-xs'
                : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>In Linea ({summary.onTrackCount})</span>
          </button>
          {summary.noBudgetCount > 0 && (
            <button
              onClick={() => setFilter('NO_BUDGET')}
              className={`px-3 py-1.5 rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
                filter === 'NO_BUDGET'
                  ? 'bg-[#E31B23] text-white shadow-xs'
                  : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7]'
              }`}
            >
              <span>Senza Budget ({summary.noBudgetCount})</span>
            </button>
          )}
        </div>

        {/* Ricerca Rapida */}
        <div className="relative min-w-[200px] sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cerca categoria..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/10 rounded-full text-slate-900 dark:text-[#F5F5F7] placeholder-slate-400 outline-none focus:border-[#E31B23]"
          />
        </div>
      </div>

      {/* Lista / Griglia Schede Analitiche di Categoria */}
      {filteredCategories.length === 0 ? (
        <div className="bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 rounded-2xl p-8 text-center space-y-3">
          <p className="text-sm text-slate-500 dark:text-[#8E8E93]">
            Nessuna categoria corrispondente ai filtri selezionati.
          </p>
          <button
            onClick={() => { setFilter('ALL'); setSearchQuery(''); }}
            className="px-4 py-2 rounded-full bg-slate-100 dark:bg-white/10 text-xs font-semibold text-slate-700 dark:text-[#F5F5F7] hover:bg-slate-200 transition-colors"
          >
            Mostra tutte le categorie
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredCategories.map(category => {
            const isExpanded = expandedCategories[category.categoryName];
            const hasBudget = category.budget > 0;
            const spendPercentage = hasBudget ? category.deviazioneRealePercentuale : 0;
            const projectedPercentage = hasBudget ? Math.round((category.proiezioneFineMese / category.budget) * 100) : 0;

            return (
              <div
                key={category.categoryName}
                className="bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5 transition-all"
              >
                {/* Header Categoria con Badge di Stato e Scostamento */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Micro-Squircle Icon Container */}
                    <div 
                      className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${category.color}18`, color: category.color }}
                    >
                      <CategoryIcon name={category.iconName} color={category.color} size={18} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#F5F5F7] truncate">
                          {category.categoryName}
                        </h4>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${category.statusBadgeBg} ${category.statusBadgeText} ${category.statusBorder}`}>
                          {category.statusLabel}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 dark:text-[#8E8E93]">
                        {category.items.length} {category.items.length === 1 ? 'sottocategoria' : 'sottocategorie'}
                      </span>
                    </div>
                  </div>

                  {/* Scostamento e Azione Espansione */}
                  <div className="flex items-center justify-between sm:justify-end gap-3.5">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block uppercase tracking-wider">
                        {isExpense ? 'Scostamento Previsto' : 'Differenza Target'}
                      </span>
                      <div className={`font-numeric tabular-nums text-sm sm:text-base font-bold ${
                        isExpense
                          ? (category.deviazioneProiettataAssoluta <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')
                          : (category.deviazioneProiettataAssoluta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')
                      }`}>
                        {formatCurrency(category.deviazioneProiettataAssoluta, { showSign: true })}
                        {hasBudget && (
                          <span className="text-xs font-medium ml-1">
                            ({category.deviazioneProiettataPercentuale > 0 ? `+${category.deviazioneProiettataPercentuale}%` : `${category.deviazioneProiettataPercentuale}%`})
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => toggleExpand(category.categoryName)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors shrink-0"
                      title={isExpanded ? 'Riduci dettaglio' : 'Espandi dettaglio'}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confronto a 3 Colonne: Budget vs Speso Reale vs Proiezione Fine Mese */}
                <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-[#242426] border border-slate-100 dark:border-white/5 text-xs">
                  {/* Colonna 1: Budget Preventivato */}
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-[#8E8E93] uppercase tracking-wider block">
                      Budget Fissato
                    </span>
                    <div className="font-numeric tabular-nums font-bold text-slate-900 dark:text-[#F5F5F7] text-sm mt-0.5">
                      {hasBudget ? formatCurrency(category.budget) : 'Non fissato'}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block">
                      Target mensile
                    </span>
                  </div>

                  {/* Colonna 2: Speso Reale */}
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-[#8E8E93] uppercase tracking-wider block">
                      {isExpense ? 'Speso Reale' : 'Incassato Reale'}
                    </span>
                    <div className="font-numeric tabular-nums font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5">
                      {formatCurrency(category.reale)}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block">
                      {hasBudget ? `${spendPercentage}% speso` : 'Transazioni reali'}
                    </span>
                  </div>

                  {/* Colonna 3: Proiezione Fine Mese */}
                  <div>
                    <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider block">
                      Proiezione Fine Mese
                    </span>
                    <div className="font-numeric tabular-nums font-bold text-indigo-600 dark:text-indigo-400 text-sm mt-0.5">
                      {formatCurrency(category.proiezioneFineMese)}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block">
                      {hasBudget ? `${projectedPercentage}% sul budget` : 'Stima a 30gg'}
                    </span>
                  </div>
                </div>

                {/* Multi-Bar Visiva di Avanzamento con Segnaposto Temporale */}
                {hasBudget && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400 dark:text-[#8E8E93]">
                      <span>0%</span>
                      {timeProgress.isCurrentMonth && (
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                          Tempo trascorso: {timeProgress.elapsedPercentage}%
                        </span>
                      )}
                      <span>100% (Budget: {formatCurrency(category.budget)})</span>
                    </div>

                    <div className="relative w-full h-3 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                      {/* Barra Reale Effettivo */}
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          isExpense
                            ? (category.reale > category.budget ? 'bg-rose-500' : 'bg-emerald-500')
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(spendPercentage, 100)}%` }}
                      />

                      {/* Linea Tacca del Tempo Trascorso (per confrontare la velocità di spesa con i giorni passati) */}
                      {timeProgress.isCurrentMonth && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-indigo-600 dark:bg-indigo-400 z-10 shadow-xs"
                          style={{ left: `${Math.min(timeProgress.elapsedPercentage, 100)}%` }}
                          title={`Oggi: ${timeProgress.elapsedPercentage}% del mese`}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Callout Suggerimento Intelligente & Proiezione */}
                <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-[#242426]/70 border border-slate-200/60 dark:border-white/5 flex items-start gap-2.5">
                  <div className="mt-0.5 text-[#E31B23] shrink-0">
                    <Lightbulb size={16} />
                  </div>
                  <div className="space-y-2 text-xs flex-1">
                    <p className="text-slate-700 dark:text-[#F5F5F7] leading-relaxed">
                      {category.suggerimento}
                    </p>

                    {/* Indicatori Operativi Rapidi */}
                    {timeProgress.isCurrentMonth && hasBudget && (
                      <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-200/60 dark:border-white/5 text-[11px] text-slate-500 dark:text-[#8E8E93]">
                        <div className="flex items-center gap-1 font-numeric tabular-nums">
                          <Flame size={12} className="text-amber-500" />
                          <span>Ritmo attuale:</span>
                          <strong className="text-slate-800 dark:text-slate-200">
                            {formatCurrency(category.ritmoGiornalieroAttuale)}/giorno
                          </strong>
                        </div>

                        <div className="flex items-center gap-1 font-numeric tabular-nums">
                          <Target size={12} className="text-indigo-500" />
                          <span>Limite consigliato:</span>
                          <strong className="text-slate-800 dark:text-slate-200">
                            {formatCurrency(category.budgetGiornalieroConsentito)}/giorno
                          </strong>
                        </div>

                        <div className="flex items-center gap-1 font-numeric tabular-nums">
                          <Clock size={12} className="text-slate-400" />
                          <span>Giorni restanti:</span>
                          <strong className="text-slate-800 dark:text-slate-200">
                            {timeProgress.daysRemaining} gg
                          </strong>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dettaglio Espandibile Sottocategorie */}
                {isExpanded && (
                  <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-[#8E8E93] uppercase tracking-wider block mb-1">
                      Scomposizione Sottocategorie ({category.items.length})
                    </span>

                    <div className="divide-y divide-slate-100 dark:divide-white/5 bg-slate-50/50 dark:bg-black/10 rounded-xl overflow-hidden">
                      {category.items.map(item => {
                        const subBudget = item.budget;
                        const subReale = item.reale;
                        const subHasBudget = subBudget > 0;
                        const subDiff = subHasBudget ? subBudget - subReale : -subReale;
                        const subPerc = subHasBudget ? Math.round((subReale / subBudget) * 100) : 0;

                        return (
                          <div 
                            key={item.sottocategoria_id} 
                            className="p-2.5 sm:px-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <CategoryIcon name={item.icon_name} color={item.colore} size={14} />
                              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {item.sottocategoria_nome}
                              </span>
                              {subHasBudget && subReale > subBudget && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                                  Sforato
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3 text-slate-600 dark:text-[#8E8E93] font-numeric tabular-nums text-[11px]">
                              <div>
                                <span className="text-[10px] text-slate-400 block">Speso</span>
                                <strong className="text-slate-900 dark:text-[#F5F5F7]">{formatCurrency(subReale)}</strong>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block">Budget</span>
                                <span>{subHasBudget ? formatCurrency(subBudget) : 'Non fissato'}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-slate-400 block">Residuo</span>
                                <strong className={subDiff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                  {formatCurrency(subDiff, { showSign: true })}
                                </strong>
                              </div>
                              {onNavigateToTransactions && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigateToTransactions({
                                      subcategoryId: item.sottocategoria_id,
                                      month: selectedMonth
                                    });
                                  }}
                                  className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10.5px] font-semibold flex items-center gap-1 transition-colors ml-1 shadow-2xs"
                                  title="Filtra e controlla i singoli movimenti di questo mese per verificare duplicati"
                                >
                                  <ListFilter size={11} />
                                  <span>Vedi</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
