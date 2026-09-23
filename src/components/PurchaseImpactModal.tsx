import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  PiggyBank, 
  TrendingDown, 
  Calendar,
  Wallet,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Subcategory, AccountForecast, MovementNecessity } from '../types';
import { formatCurrency } from '../utils/formatters';
import { haptics } from '../utils/haptics';

interface PurchaseImpactModalProps {
  isOpen: boolean;
  onClose: () => void;
  subcategories: Subcategory[];
  currentAvailableLiquid: number; // Totale oggi calcolato
  forecastEndMonth: number; // Saldo fine mese previsto
  monthlyIncome: number; // Entrate mensili stimate
  monthlyEssentialExpenses: number; // Spese fisse + essenziali
  onConfirmPurchaseAsTransaction?: (amount: number, description: string, subId: string) => void;
}

export const PurchaseImpactModal: React.FC<PurchaseImpactModalProps> = ({
  isOpen,
  onClose,
  subcategories,
  currentAvailableLiquid,
  forecastEndMonth,
  monthlyIncome,
  monthlyEssentialExpenses,
  onConfirmPurchaseAsTransaction
}) => {
  const [amountStr, setAmountStr] = useState<string>('350');
  const [description, setDescription] = useState<string>('Nuovo Acquisto Straordinario');
  const [selectedSubId, setSelectedSubId] = useState<string>(subcategories[0]?.id || '');
  const [necessity, setNecessity] = useState<MovementNecessity>('VOGLIO');

  const purchaseAmount = parseFloat(amountStr) || 0;

  // Calcoli What-If
  const simulation = useMemo(() => {
    const liquidAfter = currentAvailableLiquid - purchaseAmount;
    const forecastEndMonthAfter = forecastEndMonth - purchaseAmount;
    
    // Giorni di stipendio o ore di lavoro equivalenti (assumendo 22 giorni lavorativi/mese)
    const dailyIncome = monthlyIncome > 0 ? monthlyIncome / 22 : 80;
    const daysOfWork = dailyIncome > 0 ? Math.round((purchaseAmount / dailyIncome) * 10) / 10 : 0;

    // Runway essenziale (mesi coperti dalle riserve rimanenti)
    const monthlyBurn = monthlyEssentialExpenses > 0 ? monthlyEssentialExpenses : 1200;
    const runwayMonthsBefore = Math.max(0, currentAvailableLiquid / monthlyBurn);
    const runwayMonthsAfter = Math.max(0, liquidAfter / monthlyBurn);
    const runwayLostDays = Math.round((runwayMonthsBefore - runwayMonthsAfter) * 30);

    // Verdetto di Sostenibilità
    let verdict: 'ECCELLENTE' | 'SOSTENIBILE' | 'ATTENZIONE' | 'CRITICO' = 'SOSTENIBILE';
    let verdictTitle = 'Acquisto Sostenibile';
    let verdictDesc = 'La spesa non compromette il saldo di fine mese né il fondo di sicurezza.';

    if (liquidAfter < 0 || forecastEndMonthAfter < -200) {
      verdict = 'CRITICO';
      verdictTitle = 'Acquisto ad Alto Rischio di Liquidità';
      verdictDesc = 'Questa spesa porta il saldo proiettato in negativo e richiederebbe indebitamento.';
    } else if (forecastEndMonthAfter < 100 || runwayMonthsAfter < 1.5) {
      verdict = 'ATTENZIONE';
      verdictTitle = 'Margine Ridotto a Fine Mese';
      verdictDesc = 'L\'acquisto riduce notevolmente il cuscinetto per imprevisti nei prossimi giorni.';
    } else if (runwayMonthsAfter >= 4 && forecastEndMonthAfter > 500) {
      verdict = 'ECCELLENTE';
      verdictTitle = 'Piena Copertura Finanziaria';
      verdictDesc = 'Il tuo saldo e i fondi assorbono agevolmente la spesa senza alterare i tuoi piani.';
    }

    return {
      liquidAfter,
      forecastEndMonthAfter,
      daysOfWork,
      runwayMonthsBefore: Math.round(runwayMonthsBefore * 10) / 10,
      runwayMonthsAfter: Math.round(runwayMonthsAfter * 10) / 10,
      runwayLostDays,
      verdict,
      verdictTitle,
      verdictDesc
    };
  }, [purchaseAmount, currentAvailableLiquid, forecastEndMonth, monthlyIncome, monthlyEssentialExpenses]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        className="w-full max-w-xl bg-white dark:bg-[#1C1C1E] rounded-[26px] shadow-2xl border border-slate-200/90 dark:border-white/10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/60 dark:bg-[#242426]/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[11px] bg-indigo-500/15 text-indigo-500 flex items-center justify-center">
              <Calculator size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#F5F5F7]">Simulatore "What-If" Acquisto</h3>
              <p className="text-[11px] text-slate-400 dark:text-[#8E8E93]">Impatto su liquidità, fine mese e fondo sicurezza</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-[#F5F5F7] hover:bg-slate-100 dark:hover:bg-[#242426]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Inputs */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 no-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-[#8E8E93]">Importo Spesa (€)</label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  value={amountStr}
                  onChange={e => setAmountStr(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-3.5 py-2.5 rounded-[16px] bg-slate-100 dark:bg-[#242426] border border-slate-200/80 dark:border-white/5 text-base font-bold font-numeric tabular-nums text-slate-900 dark:text-[#F5F5F7] outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-[#8E8E93]">Cosa Vorresti Acquistare?</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Es. Smart TV, Vacanza, Tagliando..."
                className="w-full px-3.5 py-2.5 rounded-[16px] bg-slate-100 dark:bg-[#242426] border border-slate-200/80 dark:border-white/5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-[#F5F5F7] outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Quick Amount Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {[50, 150, 350, 750, 1200, 2000].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setAmountStr(val.toString())}
                className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-[#242426] text-slate-700 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7] hover:bg-slate-200 border border-slate-200/60 dark:border-white/5"
              >
                {val} €
              </button>
            ))}
          </div>

          {/* Scheda Verdetto One UI */}
          <div className={`p-4 rounded-[22px] border ${
            simulation.verdict === 'ECCELLENTE' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500' :
            simulation.verdict === 'SOSTENIBILE' ? 'bg-blue-500/10 border-blue-500/25 text-blue-500' :
            simulation.verdict === 'ATTENZIONE' ? 'bg-amber-500/10 border-amber-500/25 text-amber-500' :
            'bg-rose-500/10 border-rose-500/25 text-rose-500'
          }`}>
            <div className="flex items-center gap-2.5 mb-1.5">
              {simulation.verdict === 'ECCELLENTE' && <CheckCircle2 size={20} strokeWidth={2.5} />}
              {simulation.verdict === 'SOSTENIBILE' && <CheckCircle2 size={20} strokeWidth={2.5} />}
              {simulation.verdict === 'ATTENZIONE' && <AlertTriangle size={20} strokeWidth={2.5} />}
              {simulation.verdict === 'CRITICO' && <ShieldAlert size={20} strokeWidth={2.5} />}
              <h4 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F7]">{simulation.verdictTitle}</h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-[#8E8E93] leading-relaxed">
              {simulation.verdictDesc}
            </p>
          </div>

          {/* Grid Risultati Dettagliati */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {/* Saldo Fine Mese */}
            <div className="p-3 rounded-[18px] bg-slate-50 dark:bg-[#242426] border border-slate-200/60 dark:border-white/5 space-y-1">
              <span className="text-[10.5px] font-semibold text-slate-400 dark:text-[#8E8E93] block">Fine Mese Previsto</span>
              <p className={`text-base font-bold font-numeric tabular-nums ${simulation.forecastEndMonthAfter >= 0 ? 'text-slate-900 dark:text-[#F5F5F7]' : 'text-rose-500'}`}>
                {formatCurrency(simulation.forecastEndMonthAfter)}
              </p>
              <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block">
                (Prima: {formatCurrency(forecastEndMonth)})
              </span>
            </div>

            {/* Equivalente Lavoro */}
            <div className="p-3 rounded-[18px] bg-slate-50 dark:bg-[#242426] border border-slate-200/60 dark:border-white/5 space-y-1">
              <span className="text-[10.5px] font-semibold text-slate-400 dark:text-[#8E8E93] block">Costo in Lavoro</span>
              <p className="text-base font-bold text-indigo-500 font-numeric tabular-nums">
                ~{simulation.daysOfWork} giorni
              </p>
              <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block">
                di stipendio netto medio
              </span>
            </div>

            {/* Impatto Fondo Emergenza */}
            <div className="p-3 rounded-[18px] bg-slate-50 dark:bg-[#242426] border border-slate-200/60 dark:border-white/5 space-y-1 col-span-2 sm:col-span-1">
              <span className="text-[10.5px] font-semibold text-slate-400 dark:text-[#8E8E93] block">Autonomia Riserve</span>
              <p className="text-base font-bold text-slate-900 dark:text-[#F5F5F7] font-numeric tabular-nums">
                {simulation.runwayMonthsAfter} mesi
              </p>
              <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block">
                (-{simulation.runwayLostDays} giorni di copertura)
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 px-4 bg-slate-50 dark:bg-[#242426]/60 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-full text-xs font-semibold text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7]"
          >
            Chiudi
          </button>

          {onConfirmPurchaseAsTransaction && purchaseAmount > 0 && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onConfirmPurchaseAsTransaction(purchaseAmount, description, selectedSubId);
              }}
              className="px-4 py-2.5 rounded-full text-xs font-bold bg-[#E31B23] text-white hover:bg-[#c9171e] flex items-center gap-1.5 shadow-md shadow-red-600/20"
            >
              <span>Registra Spesa Reale</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
