import React, { useState, useMemo, useEffect } from 'react';
import { BudgetPerformanceItem, Subcategory, getSubcategoryClassification, getSubcategoryNecessity } from '../types';
import { formatCurrency, formatItalianNumber } from '../utils/formatters';
import { haptics } from '../utils/haptics';
import {
  X,
  PiggyBank,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  Calendar,
  Percent,
  Sliders,
  ChevronRight,
  CheckCircle2,
  Info,
  ArrowUpRight,
  Zap,
  Target,
  Clock,
  RotateCcw
} from 'lucide-react';

interface SavingsSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMonthName: string;
  items: BudgetPerformanceItem[];
  allSubcategories: Subcategory[];
  defaultTotalIncome?: number;
  defaultTotalExpenses?: number;
}

export const SavingsSimulatorModal: React.FC<SavingsSimulatorModalProps> = ({
  isOpen,
  onClose,
  selectedMonthName,
  items,
  allSubcategories,
  defaultTotalIncome = 0,
  defaultTotalExpenses = 0
}) => {
  // Calcolo iniziale automatico basato sulle sottocategorie del mese
  const calculatedBaseline = useMemo(() => {
    let income = 0;
    let essentialExpenses = 0;
    let extraExpenses = 0;

    const subMap = new Map<string, Subcategory>();
    allSubcategories.forEach(s => subMap.set(s.id, s));

    items.forEach(item => {
      const sub = subMap.get(item.sottocategoria_id);
      const val = item.previsione > 0 ? item.previsione : (item.budget > 0 ? item.budget : item.reale);

      if (item.tipo === 'ENTRATA') {
        income += val;
      } else if (item.tipo === 'USCITA') {
        const classification = sub?.classificazione || (sub ? getSubcategoryClassification(sub) : 'SPESE_ESSENZIALI');
        const necessity = sub?.necessita || (sub ? getSubcategoryNecessity(sub) : 'DEVO');

        if (classification === 'SPESE_ESSENZIALI' || necessity === 'DEVO' || necessity === 'HO_BISOGNO') {
          essentialExpenses += val;
        } else {
          extraExpenses += val;
        }
      }
    });

    // Se i totali calcolati sono 0 ma ci sono defaultTotalIncome / defaultTotalExpenses passati
    if (income === 0 && defaultTotalIncome > 0) income = defaultTotalIncome;
    if (essentialExpenses === 0 && extraExpenses === 0 && defaultTotalExpenses > 0) {
      essentialExpenses = defaultTotalExpenses * 0.7; // stima 70% essenziali
      extraExpenses = defaultTotalExpenses * 0.3; // stima 30% extra
    }

    return {
      income: Math.round(income * 100) / 100,
      essentialExpenses: Math.round(essentialExpenses * 100) / 100,
      extraExpenses: Math.round(extraExpenses * 100) / 100
    };
  }, [items, allSubcategories, defaultTotalIncome, defaultTotalExpenses]);

  // Stati controllati dall'utente
  const [incomeInput, setIncomeInput] = useState<number>(calculatedBaseline.income);
  const [essentialInput, setEssentialInput] = useState<number>(calculatedBaseline.essentialExpenses);
  const [extraInput, setExtraInput] = useState<number>(calculatedBaseline.extraExpenses);
  
  // Modalità di risparmio per le spese extra:
  // 'ESSENTIAL_ONLY' (100% taglio extra: risparmio massimo)
  // 'CUSTOM_EXTRA' (% di taglio personalizzata)
  // 'CURRENT_FULL' (spese extra al 100% come sono oggi)
  const [scenarioMode, setScenarioMode] = useState<'ESSENTIAL_ONLY' | 'CUSTOM_EXTRA' | 'CURRENT_FULL'>('ESSENTIAL_ONLY');
  const [extraReductionPercent, setExtraReductionPercent] = useState<number>(50); // Taglio del 50% di default su custom
  
  // Orizzonte principale attivo per il dettaglio
  const [activeHorizonMonths, setActiveHorizonMonths] = useState<number>(12); // 6 o 12 mesi o custom
  
  // Tasso di rendimento annuo opzionale (es. 0%, 2.5%, 3.5%, 4.0% per conto deposito o BTP)
  const [annualInterestRate, setAnnualInterestRate] = useState<number>(0);
  const [startingCapital, setStartingCapital] = useState<number>(0);

  // Aggiorna quando cambiano i calcoli baseline all'apertura
  useEffect(() => {
    if (isOpen) {
      setIncomeInput(calculatedBaseline.income > 0 ? calculatedBaseline.income : 2500);
      setEssentialInput(calculatedBaseline.essentialExpenses > 0 ? calculatedBaseline.essentialExpenses : 1200);
      setExtraInput(calculatedBaseline.extraExpenses > 0 ? calculatedBaseline.extraExpenses : 450);
    }
  }, [isOpen, calculatedBaseline]);

  // Calcolo spesa extra effettiva applicata in base allo scenario
  const effectiveExtraExpenses = useMemo(() => {
    if (scenarioMode === 'ESSENTIAL_ONLY') return 0;
    if (scenarioMode === 'CURRENT_FULL') return extraInput;
    // CUSTOM_EXTRA: sottrae la percentuale di taglio
    const factor = Math.max(0, 1 - (extraReductionPercent / 100));
    return Math.round(extraInput * factor * 100) / 100;
  }, [scenarioMode, extraInput, extraReductionPercent]);

  // Totale spese mensili simulate
  const totalSimulatedMonthlyExpenses = useMemo(() => {
    return Math.round((essentialInput + effectiveExtraExpenses) * 100) / 100;
  }, [essentialInput, effectiveExtraExpenses]);

  // Risparmio mensile netto
  const monthlyNetSavings = useMemo(() => {
    return Math.round((incomeInput - totalSimulatedMonthlyExpenses) * 100) / 100;
  }, [incomeInput, totalSimulatedMonthlyExpenses]);

  // Tasso di risparmio (% sulle entrate)
  const savingsRate = useMemo(() => {
    if (incomeInput <= 0) return 0;
    return Math.round((monthlyNetSavings / incomeInput) * 1000) / 10;
  }, [monthlyNetSavings, incomeInput]);

  // Calcolo accumulo a 6 e 12 mesi (con eventuale interesse composto mensile)
  const calculateAccumulation = (months: number) => {
    if (months <= 0) return { total: startingCapital, netSaved: 0, interestEarned: 0 };
    
    const monthlyRate = (annualInterestRate / 100) / 12;
    let balance = startingCapital;
    let totalDeposited = 0;

    for (let m = 1; m <= months; m++) {
      balance = (balance + monthlyNetSavings) * (1 + monthlyRate);
      totalDeposited += monthlyNetSavings;
    }

    const totalRounded = Math.round(balance * 100) / 100;
    const netSaved = Math.round(totalDeposited * 100) / 100;
    const interestEarned = Math.max(0, Math.round((totalRounded - (startingCapital + netSaved)) * 100) / 100);

    return {
      total: totalRounded,
      netSaved,
      interestEarned
    };
  };

  const sim6Months = useMemo(() => calculateAccumulation(6), [monthlyNetSavings, annualInterestRate, startingCapital]);
  const sim12Months = useMemo(() => calculateAccumulation(12), [monthlyNetSavings, annualInterestRate, startingCapital]);
  const simActiveHorizon = useMemo(() => calculateAccumulation(activeHorizonMonths), [monthlyNetSavings, annualInterestRate, startingCapital, activeHorizonMonths]);

  // Calcolo mese per mese fino a 12 mesi per il grafico a barre
  const monthlyTimeline = useMemo(() => {
    const months = [];
    const monthlyRate = (annualInterestRate / 100) / 12;
    let balance = startingCapital;

    for (let m = 1; m <= 12; m++) {
      balance = (balance + monthlyNetSavings) * (1 + monthlyRate);
      months.push({
        month: m,
        label: `Mese ${m}`,
        shortLabel: `M${m}`,
        cumulativeTotal: Math.round(balance * 100) / 100,
        monthlyDeposit: monthlyNetSavings,
        isMilestone6: m === 6,
        isMilestone12: m === 12
      });
    }
    return months;
  }, [monthlyNetSavings, annualInterestRate, startingCapital]);

  // Massimo valore per scalare il grafico a barre
  const maxCumulative = useMemo(() => {
    return Math.max(1, ...monthlyTimeline.map(m => m.cumulativeTotal));
  }, [monthlyTimeline]);

  // Metriche di Copertura Fondo di Emergenza (Financial Runway)
  const emergencyFundCoverage = useMemo(() => {
    if (essentialInput <= 0) return { months6Coverage: 0, months12Coverage: 0 };
    const months6Coverage = Math.round((sim6Months.total / essentialInput) * 10) / 10;
    const months12Coverage = Math.round((sim12Months.total / essentialInput) * 10) / 10;
    return { months6Coverage, months12Coverage };
  }, [sim6Months.total, sim12Months.total, essentialInput]);

  // Reset ai dati reali di baseline
  const handleReset = () => {
    haptics.impact();
    setIncomeInput(calculatedBaseline.income > 0 ? calculatedBaseline.income : 2500);
    setEssentialInput(calculatedBaseline.essentialExpenses > 0 ? calculatedBaseline.essentialExpenses : 1200);
    setExtraInput(calculatedBaseline.extraExpenses > 0 ? calculatedBaseline.extraExpenses : 450);
    setScenarioMode('ESSENTIAL_ONLY');
    setExtraReductionPercent(50);
    setAnnualInterestRate(0);
    setStartingCapital(0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto no-scrollbar animate-in fade-in duration-200">
      <div 
        id="savings-simulator-modal"
        className="bg-[#121212] border border-white/10 rounded-[26px] w-full max-w-4xl shadow-2xl text-[#F5F5F7] overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header One UI (Viewing Area) */}
        <div className="p-4 sm:p-6 bg-[#1C1C1E] border-b border-white/5 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-[14px] bg-[#E31B23]/15 text-[#E31B23] border border-[#E31B23]/25 flex items-center justify-center shrink-0">
              <PiggyBank size={24} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#F5F5F7] truncate">
                  Simulatore di Risparmio & Accumulo
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shrink-0">
                  6 & 12 Mesi
                </span>
              </div>
              <p className="text-xs text-[#8E8E93] truncate mt-0.5">
                Proiezione del capitale accumulabile basata su entrate e spese essenziali ({selectedMonthName})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleReset}
              className="p-2 rounded-xl text-[#8E8E93] hover:text-[#F5F5F7] hover:bg-white/5 transition-colors cursor-pointer"
              title="Reimposta valori calcolati dal budget"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#8E8E93] hover:text-[#F5F5F7] hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body (Interaction Area Scrollable) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 no-scrollbar">
          {/* SEZIONE 1: SCENARI RAPIDI & STRATEGIA DI RISPARMIO */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
                1. Strategia di Risparmio sulle Spese
              </span>
              <span className="text-[11px] text-[#8E8E93]">
                {scenarioMode === 'ESSENTIAL_ONLY' && 'Copertura solo spese essenziali (Massimo potenziale)'}
                {scenarioMode === 'CUSTOM_EXTRA' && `Taglio del ${extraReductionPercent}% sulle spese extra`}
                {scenarioMode === 'CURRENT_FULL' && 'Spese extra mantenute al 100% (Andamento reale)'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setScenarioMode('ESSENTIAL_ONLY');
                  haptics.tap();
                }}
                className={`p-3.5 rounded-[20px] border text-left flex flex-col justify-between gap-2 transition-all cursor-pointer ${
                  scenarioMode === 'ESSENTIAL_ONLY'
                    ? 'bg-[#1C1C1E] border-[#E31B23] shadow-md ring-1 ring-[#E31B23]/40'
                    : 'bg-[#1C1C1E]/60 border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-[10px] bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                    <Zap size={16} />
                  </div>
                  {scenarioMode === 'ESSENTIAL_ONLY' && (
                    <span className="w-2 h-2 rounded-full bg-[#E31B23]"></span>
                  )}
                </div>
                <div>
                  <span className="text-xs font-bold text-[#F5F5F7] block">
                    Solo Spese Essenziali
                  </span>
                  <span className="text-[11px] text-[#8E8E93] block mt-0.5">
                    Azzeramento spese extra per massimizzare il fondo
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setScenarioMode('CUSTOM_EXTRA');
                  haptics.tap();
                }}
                className={`p-3.5 rounded-[20px] border text-left flex flex-col justify-between gap-2 transition-all cursor-pointer ${
                  scenarioMode === 'CUSTOM_EXTRA'
                    ? 'bg-[#1C1C1E] border-[#E31B23] shadow-md ring-1 ring-[#E31B23]/40'
                    : 'bg-[#1C1C1E]/60 border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-[10px] bg-amber-500/15 text-amber-400 flex items-center justify-center">
                    <Sliders size={16} />
                  </div>
                  {scenarioMode === 'CUSTOM_EXTRA' && (
                    <span className="w-2 h-2 rounded-full bg-[#E31B23]"></span>
                  )}
                </div>
                <div>
                  <span className="text-xs font-bold text-[#F5F5F7] block">
                    Taglio Extra Bilanciato
                  </span>
                  <span className="text-[11px] text-[#8E8E93] block mt-0.5">
                    Riduci le spese extra del {extraReductionPercent}%
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setScenarioMode('CURRENT_FULL');
                  haptics.tap();
                }}
                className={`p-3.5 rounded-[20px] border text-left flex flex-col justify-between gap-2 transition-all cursor-pointer ${
                  scenarioMode === 'CURRENT_FULL'
                    ? 'bg-[#1C1C1E] border-[#E31B23] shadow-md ring-1 ring-[#E31B23]/40'
                    : 'bg-[#1C1C1E]/60 border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-[10px] bg-blue-500/15 text-blue-400 flex items-center justify-center">
                    <ShieldCheck size={16} />
                  </div>
                  {scenarioMode === 'CURRENT_FULL' && (
                    <span className="w-2 h-2 rounded-full bg-[#E31B23]"></span>
                  )}
                </div>
                <div>
                  <span className="text-xs font-bold text-[#F5F5F7] block">
                    Andamento Corrente
                  </span>
                  <span className="text-[11px] text-[#8E8E93] block mt-0.5">
                    Essenziali + Extra integrali del mese
                  </span>
                </div>
              </button>
            </div>

            {/* Slider selettivo se in modalità CUSTOM_EXTRA */}
            {scenarioMode === 'CUSTOM_EXTRA' && (
              <div className="p-3.5 rounded-[20px] bg-[#1C1C1E] border border-white/10 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8E8E93]">Percentuale di taglio sulle Spese Extra:</span>
                  <span className="font-bold text-[#F5F5F7] font-numeric">{extraReductionPercent}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  step="5"
                  value={extraReductionPercent}
                  onChange={e => setExtraReductionPercent(Number(e.target.value))}
                  className="w-full accent-[#E31B23] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#8E8E93]">
                  <span>10% (Minimo sacrificio)</span>
                  <span>50% (Equilibrato)</span>
                  <span>90% (Quasi essenziale)</span>
                </div>
              </div>
            )}
          </div>

          {/* SEZIONE 2: INPUT PARAMETRI MENSILI INTERATTIVI */}
          <div className="bg-[#1C1C1E] border border-white/5 rounded-[24px] p-4 sm:p-5 space-y-4">
            <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider block">
              2. Parametri Mensili del Budget
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Entrate Mensili */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#8E8E93] flex items-center justify-between">
                  <span>Entrate Mensili</span>
                  <span className="text-[10px] text-emerald-400 font-semibold">Incassi / Stipendi</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#8E8E93]">€</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={incomeInput || ''}
                    onChange={e => setIncomeInput(Math.max(0, Number(e.target.value)))}
                    className="w-full pl-7 pr-3 py-2 text-sm font-bold font-numeric tabular-nums bg-[#242426] text-[#F5F5F7] border border-white/5 rounded-xl outline-none focus:border-[#E31B23]"
                  />
                </div>
              </div>

              {/* Spese Essenziali */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#8E8E93] flex items-center justify-between">
                  <span>Spese Essenziali</span>
                  <span className="text-[10px] text-[#E31B23] font-semibold">Devo (50%) + Bisogni</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#8E8E93]">€</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={essentialInput || ''}
                    onChange={e => setEssentialInput(Math.max(0, Number(e.target.value)))}
                    className="w-full pl-7 pr-3 py-2 text-sm font-bold font-numeric tabular-nums bg-[#242426] text-[#F5F5F7] border border-white/5 rounded-xl outline-none focus:border-[#E31B23]"
                  />
                </div>
              </div>

              {/* Spese Extra */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#8E8E93] flex items-center justify-between">
                  <span>Spese Extra (Base)</span>
                  <span className="text-[10px] text-amber-400 font-semibold">Voglio (20%) & Svago</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#8E8E93]">€</span>
                  <input
                    type="number"
                    min="0"
                    step="20"
                    value={extraInput || ''}
                    onChange={e => setExtraInput(Math.max(0, Number(e.target.value)))}
                    className="w-full pl-7 pr-3 py-2 text-sm font-bold font-numeric tabular-nums bg-[#242426] text-[#F5F5F7] border border-white/5 rounded-xl outline-none focus:border-[#E31B23]"
                  />
                </div>
              </div>
            </div>

            {/* Riepilogo flusso mensile istantaneo */}
            <div className="p-3 rounded-xl bg-[#242426] border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[#8E8E93]">Risparmio Netto Mensile Calcolato:</span>
                <span className={`font-bold font-numeric tabular-nums text-sm ${monthlyNetSavings >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatCurrency(monthlyNetSavings, { showSign: true })} / mese
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#8E8E93]">Tasso di Risparmio:</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold font-numeric ${
                  savingsRate >= 30 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                  savingsRate >= 15 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                  savingsRate > 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                  'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}>
                  {savingsRate}% delle entrate
                </span>
              </div>
            </div>
          </div>

          {/* SEZIONE 3: I DUE GRANDI TRAGUARDI - 6 MESI E 12 MESI (CARD HERO) */}
          <div className="space-y-2.5">
            <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider block">
              3. Risparmio Accumulato: Confronto 6 vs 12 Mesi
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Orizzonte 6 Mesi */}
              <div className="bg-[#1C1C1E] border border-white/5 hover:border-emerald-500/30 rounded-[24px] p-5 flex flex-col justify-between gap-4 transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-[12px] bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#8E8E93] uppercase">Orizzonte</span>
                      <h3 className="text-base font-bold text-[#F5F5F7]">6 Mesi (Semestre)</h3>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-numeric">
                    6 × {formatCurrency(monthlyNetSavings)}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-[#8E8E93] block mb-1">Capitale Totale Accumulato</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-bold font-numeric tabular-nums text-emerald-400 tracking-tight">
                      {formatCurrency(sim6Months.total, { showSign: true })}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-[#8E8E93]">
                  <span>Copertura Fondo Emergenza:</span>
                  <span className="font-bold text-[#F5F5F7] font-numeric">
                    {emergencyFundCoverage.months6Coverage} mesi di spese
                  </span>
                </div>
              </div>

              {/* Orizzonte 12 Mesi */}
              <div className="bg-[#1C1C1E] border border-emerald-500/40 rounded-[24px] p-5 flex flex-col justify-between gap-4 transition-all relative overflow-hidden ring-1 ring-emerald-500/20 shadow-lg">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-[12px] bg-[#E31B23]/15 text-[#E31B23] flex items-center justify-center">
                      <Target size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#8E8E93] uppercase">Orizzonte</span>
                      <h3 className="text-base font-bold text-[#F5F5F7]">12 Mesi (1 Anno)</h3>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#E31B23]/15 text-[#E31B23] border border-[#E31B23]/25 font-numeric">
                    12 × {formatCurrency(monthlyNetSavings)}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-[#8E8E93] block mb-1">Capitale Totale Accumulato</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-bold font-numeric tabular-nums text-emerald-400 tracking-tight">
                      {formatCurrency(sim12Months.total, { showSign: true })}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-[#8E8E93]">
                  <span>Copertura Fondo Emergenza:</span>
                  <span className="font-bold text-emerald-400 font-numeric">
                    {emergencyFundCoverage.months12Coverage} mesi di spese
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SEZIONE 4: GRAFICO EVOLUZIONE MESE PER MESE (TIMELINE ACCUMULO 1..12) */}
          <div className="bg-[#1C1C1E] border border-white/5 rounded-[24px] p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
                4. Crescita Progressiva del Capitale (Mese per Mese)
              </span>
              <span className="text-[11px] text-[#8E8E93]">
                Progressione cumulativa del saldo
              </span>
            </div>

            <div className="space-y-2 pt-2">
              <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 sm:gap-2 items-end h-40 pt-6 pb-2">
                {monthlyTimeline.map(m => {
                  const heightPercent = maxCumulative > 0 
                    ? Math.max(8, Math.round((m.cumulativeTotal / maxCumulative) * 100))
                    : 10;
                  
                  return (
                    <div key={m.month} className="flex flex-col items-center h-full justify-end group relative">
                      {/* Tooltip on hover */}
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center bg-[#242426] border border-white/10 px-2 py-1 rounded-lg text-[10px] whitespace-nowrap z-20 shadow-lg pointer-events-none">
                        <span className="font-bold text-[#F5F5F7] font-numeric">{formatCurrency(m.cumulativeTotal)}</span>
                        <span className="text-[#8E8E93]">Mese {m.month}</span>
                      </div>

                      {/* Bar */}
                      <div 
                        className={`w-full rounded-t-lg transition-all duration-300 relative ${
                          m.isMilestone12
                            ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-md shadow-emerald-500/20'
                            : m.isMilestone6
                            ? 'bg-gradient-to-t from-emerald-700 to-emerald-500'
                            : 'bg-emerald-500/30 hover:bg-emerald-500/50'
                        }`}
                        style={{ height: `${heightPercent}%` }}
                      >
                        {(m.isMilestone6 || m.isMilestone12) && (
                          <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-emerald-400">
                            {m.month === 6 ? '6M' : '12M'}
                          </div>
                        )}
                      </div>

                      <span className="text-[10px] text-[#8E8E93] mt-1 font-numeric">
                        M{m.month}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SEZIONE 5: TRAGUARDI DI SICUREZZA FINANZIARIA (PILLOLE ONE UI) */}
          <div className="bg-[#1C1C1E] border border-white/5 rounded-[24px] p-4 sm:p-5 space-y-3.5">
            <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider block">
              5. Traguardi di Sicurezza Raggiungibili
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Traguardo 1: 3 Mesi di Spese */}
              <div className="p-3.5 rounded-[18px] bg-[#242426] border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#F5F5F7]">Fondo Base (3 Mesi)</span>
                  <ShieldCheck size={16} className="text-blue-400" />
                </div>
                <div className="text-sm font-bold font-numeric text-blue-400">
                  {formatCurrency(essentialInput * 3)}
                </div>
                <p className="text-[11px] text-[#8E8E93]">
                  {monthlyNetSavings > 0
                    ? `Raggiungibile in circa ${Math.ceil((essentialInput * 3) / monthlyNetSavings)} mesi`
                    : 'Aumenta il risparmio mensile per raggiungere questo traguardo'}
                </p>
              </div>

              {/* Traguardo 2: 6 Mesi di Spese */}
              <div className="p-3.5 rounded-[18px] bg-[#242426] border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#F5F5F7]">Fondo Sicurezza (6 Mesi)</span>
                  <CheckCircle2 size={16} className="text-emerald-400" />
                </div>
                <div className="text-sm font-bold font-numeric text-emerald-400">
                  {formatCurrency(essentialInput * 6)}
                </div>
                <p className="text-[11px] text-[#8E8E93]">
                  {monthlyNetSavings > 0
                    ? `Raggiungibile in circa ${Math.ceil((essentialInput * 6) / monthlyNetSavings)} mesi`
                    : 'Aumenta il risparmio mensile per raggiungere questo traguardo'}
                </p>
              </div>

              {/* Traguardo 3: 1 Anno di Serenità */}
              <div className="p-3.5 rounded-[18px] bg-[#242426] border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#F5F5F7]">Serenità Totale (12 Mesi)</span>
                  <Sparkles size={16} className="text-amber-400" />
                </div>
                <div className="text-sm font-bold font-numeric text-amber-400">
                  {formatCurrency(essentialInput * 12)}
                </div>
                <p className="text-[11px] text-[#8E8E93]">
                  {monthlyNetSavings > 0
                    ? `Raggiungibile in circa ${Math.ceil((essentialInput * 12) / monthlyNetSavings)} mesi`
                    : 'Aumenta il risparmio mensile per raggiungere questo traguardo'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer One UI */}
        <div className="p-4 sm:p-5 bg-[#1C1C1E] border-t border-white/5 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-[#8E8E93] hidden sm:block">
            I calcoli si aggiornano in tempo reale in base ai parametri impostati.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#E31B23] hover:bg-[#c9171e] text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer ml-auto"
          >
            Chiudi Simulatore
          </button>
        </div>
      </div>
    </div>
  );
};
