import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AccountForecast, Account, Fund } from '../types';
import { AccountService } from '../services/AccountService';
import { formatCurrency, formatDateIT } from '../utils/formatters';
import { haptics } from '../utils/haptics';
import {
  X,
  Landmark,
  ShieldAlert,
  CreditCard,
  Banknote,
  Wallet,
  Shield,
  Check,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Calendar,
  Layers,
  HelpCircle,
  RotateCcw,
  CheckCircle2,
  FileCheck2
} from 'lucide-react';

interface AccountBalanceCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: (Account | Fund | AccountForecast)[];
  initialAccountId?: string;
  onSuccess: () => void;
}

export const AccountBalanceCorrectionModal: React.FC<AccountBalanceCorrectionModalProps> = ({
  isOpen,
  onClose,
  accounts,
  initialAccountId,
  onSuccess
}) => {
  // Preselezione del conto
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [realBalanceInput, setRealBalanceInput] = useState<string>('');
  const [opDate, setOpDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [customDescription, setCustomDescription] = useState<string>('');
  const [customNote, setCustomNote] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successInfo, setSuccessInfo] = useState<{
    movementId?: string;
    diff: number;
    tipologia?: 'ENTRATA' | 'USCITA';
    newBal: number;
    accountName: string;
  } | null>(null);

  // Lista di tutti i conti e fondi attivi
  const availableEntities = useMemo(() => {
    return accounts.filter(a => a.attivo !== false);
  }, [accounts]);

  const prevIsOpenRef = useRef(false);
  const prevInitialAccIdRef = useRef<string | undefined>(undefined);

  // Inizializzazione al mount o al cambio effettivo di apertura / initialAccountId
  useEffect(() => {
    const isOpening = isOpen && !prevIsOpenRef.current;
    const accChanged = isOpen && initialAccountId !== prevInitialAccIdRef.current;

    if (isOpening || accChanged) {
      setSuccessInfo(null);
      setIsSubmitting(false);
      const target = initialAccountId 
        ? availableEntities.find(a => a.id === initialAccountId || (a as any).conto_id === initialAccountId || (a as any).fondo_id === initialAccountId)
        : availableEntities[0];

      if (target) {
        setSelectedEntityId(target.id);
        const currentReal = (target as any).saldo_reale ?? (target as any).saldo_oggi ?? 0;
        setRealBalanceInput(currentReal.toString().replace('.', ','));
      } else if (availableEntities.length > 0) {
        setSelectedEntityId(availableEntities[0].id);
        const currentReal = (availableEntities[0] as any).saldo_reale ?? 0;
        setRealBalanceInput(currentReal.toString().replace('.', ','));
      }
      setOpDate(new Date().toISOString().split('T')[0]);
      setCustomDescription('');
      setCustomNote('');
    }

    prevIsOpenRef.current = isOpen;
    prevInitialAccIdRef.current = initialAccountId;
  }, [isOpen, initialAccountId]);

  // Entità attualmente selezionata
  const selectedEntity = useMemo(() => {
    return availableEntities.find(a => a.id === selectedEntityId) || null;
  }, [availableEntities, selectedEntityId]);

  // Calcolo del saldo contabile alla data scelta
  const currentCalculatedBalance = useMemo(() => {
    if (!selectedEntityId) return 0;
    const dateObj = opDate ? new Date(opDate) : new Date();
    return AccountService.calculateBalanceAtDate(selectedEntityId, isNaN(dateObj.getTime()) ? new Date() : dateObj);
  }, [selectedEntityId, opDate]);

  // Parsing del saldo reale inserito
  const parsedRealBalance = useMemo(() => {
    if (realBalanceInput.trim() === '') return null;
    const cleaned = realBalanceInput.trim().replace(/\s+/g, '').replace(',', '.');
    const val = parseFloat(cleaned);
    return isNaN(val) ? null : Math.round(val * 100) / 100;
  }, [realBalanceInput]);

  // Differenza calcolata
  const difference = useMemo(() => {
    if (parsedRealBalance === null) return 0;
    return Math.round((parsedRealBalance - currentCalculatedBalance) * 100) / 100;
  }, [parsedRealBalance, currentCalculatedBalance]);

  const isPositiveDiff = difference > 0;
  const isNegativeDiff = difference < 0;
  const isExactMatch = parsedRealBalance !== null && Math.abs(difference) < 0.005;

  const handleEntityChange = (id: string) => {
    haptics.tap();
    setSelectedEntityId(id);
    const entity = availableEntities.find(a => a.id === id);
    if (entity) {
      const currentReal = (entity as any).saldo_reale ?? 0;
      setRealBalanceInput(currentReal.toString().replace('.', ','));
    }
  };

  const handleApplyCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedRealBalance === null || !selectedEntityId || isSubmitting) return;

    try {
      setIsSubmitting(true);
      haptics.impact();

      const result = await AccountService.reconcileAccountWithRealBalance(
        selectedEntityId,
        parsedRealBalance,
        {
          date: opDate,
          description: customDescription.trim() || undefined,
          note: customNote.trim() || undefined
        }
      );

      haptics.success();
      setSuccessInfo({
        movementId: result.movementCreated?.movimento_id,
        diff: result.difference,
        tipologia: result.movementCreated?.tipologia,
        newBal: result.newBalance,
        accountName: result.entityName
      });

      // Notifica l'applicazione globale di aggiornarsi
      onSuccess();
    } catch (err: any) {
      haptics.error();
      console.error('Errore durante la correzione saldo:', err);
      alert(err.message || 'Errore durante la correzione del saldo.');
      setIsSubmitting(false);
    }
  };

  const getEntityIcon = (entity: any) => {
    const isFund = 'fondo_id' in entity || (entity as any).is_fund;
    if (isFund) return <ShieldAlert size={16} />;
    switch (entity.tipo_conto) {
      case 'CARTA_DEBITO':
      case 'CARTA_CREDITO':
        return <CreditCard size={16} />;
      case 'CONTANTI':
        return <Banknote size={16} />;
      case 'CONTO_DEPOSITO':
        return <Wallet size={16} />;
      case 'BANCA':
      default:
        return <Landmark size={16} />;
    }
  };

  const getEntityName = (entity: any) => {
    return entity.nome_conto || entity.nome_fondo || 'Conto';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        id="balance-correction-dialog"
        className="w-full max-w-xl bg-white dark:bg-[#222428] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200/80 dark:border-[#2F3136]"
      >
        {/* Header One UI */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-[#2F3136] flex items-center justify-between bg-slate-50/70 dark:bg-[#18191B]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E31B23]/15 text-[#E31B23] border border-[#E31B23]/25 flex items-center justify-center shadow-xs">
              <Sparkles size={19} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#EAEBED]">
                Correzione Saldo Conti
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#9A9DA5]">
                Allinea il saldo all'estratto conto reale della banca
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              haptics.tap();
              onClose();
            }}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#2A2C31] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 no-scrollbar flex-1">
          {successInfo ? (
            /* Schermata di Successo / Riepilogo operazione */
            <div className="py-6 px-4 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shadow-sm">
                <FileCheck2 size={28} />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-slate-900 dark:text-[#EAEBED]">
                  Saldo Aggiornato con Successo!
                </h4>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-[#9A9DA5]">
                  Il conto <span className="font-semibold text-slate-800 dark:text-white">{successInfo.accountName}</span> è ora allineato esattamente a <span className="font-numeric font-bold text-slate-900 dark:text-[#EAEBED]">{formatCurrency(successInfo.newBal)}</span>.
                </p>
              </div>

              {successInfo.movementId ? (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#18191B] border border-slate-200/80 dark:border-[#2F3136] text-left space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-[#9A9DA5]">Movimento di rettifica generato:</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">ID: {successInfo.movementId}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Tipo: {successInfo.tipologia === 'ENTRATA' ? 'ENTRATA (+)' : 'USCITA (-)'}
                    </span>
                    <span className={`text-sm font-numeric font-bold ${successInfo.diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {formatCurrency(successInfo.diff, { showSign: true })}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5 pt-1 border-t border-slate-200/60 dark:border-[#2F3136]">
                    <span>Sottocategoria:</span>
                    <span className="italic font-medium text-slate-600 dark:text-slate-400">Nessuna (Movimento di Riconciliazione)</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                  I saldi erano già perfettamente allineati. Nessun movimento contabile supplementare è stato creato.
                </div>
              )}

              <div className="pt-2 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    setSuccessInfo(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-[#2A2C31] text-slate-700 dark:text-[#EAEBED] hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Rettifica un altro conto
                </button>
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    onClose();
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#E31B23] hover:bg-[#c9151c] text-white shadow-md transition-all cursor-pointer"
                >
                  Fatto
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleApplyCorrection} className="space-y-5">
              {/* 1. SELETTORE CONTO O FONDO */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-[#9A9DA5] uppercase tracking-wider block">
                  1. Seleziona Conto o Riserva da Allineare
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableEntities.map(entity => {
                    const isSelected = entity.id === selectedEntityId;
                    const entityName = getEntityName(entity);
                    const isFund = 'fondo_id' in entity || (entity as any).is_fund;
                    const bal = (entity as any).saldo_oggi ?? (entity as any).saldo_iniziale ?? 0;

                    return (
                      <button
                        key={entity.id}
                        type="button"
                        onClick={() => handleEntityChange(entity.id)}
                        className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                          isSelected
                            ? 'bg-[#E31B23]/10 dark:bg-[#E31B23]/15 border-[#E31B23] shadow-xs'
                            : 'bg-white dark:bg-[#18191B]/50 border-slate-200 dark:border-[#2F3136] hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs text-xs"
                            style={{ backgroundColor: (entity as any).colore || (isFund ? '#d97706' : '#4f46e5') }}
                          >
                            {getEntityIcon(entity)}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-900 dark:text-[#EAEBED] truncate block">
                              {entityName}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-[#9A9DA5] block">
                              {isFund ? 'Fondo Risparmio' : 'Conto / Carta'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-numeric font-bold text-slate-800 dark:text-slate-200 block">
                            {formatCurrency(bal)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. STATO ATTUALE vs INPUT SALDO REALE */}
              {selectedEntity && (
                <div className="p-4 rounded-3xl bg-slate-50 dark:bg-[#18191B] border border-slate-200/80 dark:border-[#2F3136] space-y-4">
                  {/* Riga Saldo Attuale Calcolato */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200/70 dark:border-[#2F3136]">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-[#9A9DA5] uppercase tracking-wider block">
                        Saldo Contabile Attuale (Calcolato)
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        Somma di tutte le transazioni registrate fino a oggi
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-numeric font-bold text-slate-900 dark:text-[#EAEBED]">
                        {formatCurrency(currentCalculatedBalance)}
                      </span>
                    </div>
                  </div>

                  {/* Input Saldo Reale Banca */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 dark:text-[#EAEBED] flex items-center gap-1.5">
                        <span>Saldo Reale Estratto Conto Banca (€)</span>
                        <span className="text-[#E31B23] font-bold">*</span>
                      </label>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        Cifra esatta visibile nell'home banking
                      </span>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={realBalanceInput}
                        onChange={(e) => setRealBalanceInput(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="0,00"
                        autoFocus
                        className="w-full px-4 py-3 bg-white dark:bg-[#222428] border-2 border-slate-200 dark:border-[#2F3136] focus:border-[#E31B23] dark:focus:border-[#E31B23] rounded-2xl text-xl sm:text-2xl font-numeric font-bold text-slate-900 dark:text-[#EAEBED] outline-none transition-all shadow-inner placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">
                        €
                      </span>
                    </div>

                    {/* Quick helper chips */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[10px] text-slate-400 mr-1">Scorciatoie:</span>
                      <button
                        type="button"
                        onClick={() => {
                          haptics.tap();
                          setRealBalanceInput(currentCalculatedBalance.toString().replace('.', ','));
                        }}
                        className="px-2 py-0.5 rounded-lg bg-slate-200/70 dark:bg-[#2A2C31] hover:bg-slate-300 dark:hover:bg-[#34373d] text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                      >
                        Pari a Calcolato ({formatCurrency(currentCalculatedBalance)})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          haptics.tap();
                          setRealBalanceInput('0,00');
                        }}
                        className="px-2 py-0.5 rounded-lg bg-slate-200/70 dark:bg-[#2A2C31] hover:bg-slate-300 dark:hover:bg-[#34373d] text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                      >
                        Azzera (0 €)
                      </button>
                      {parsedRealBalance !== null && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              haptics.tap();
                              setRealBalanceInput((parsedRealBalance + 100).toFixed(2).replace('.', ','));
                            }}
                            className="px-2 py-0.5 rounded-lg bg-slate-200/70 dark:bg-[#2A2C31] hover:bg-slate-300 dark:hover:bg-[#34373d] text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                          >
                            +100 €
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              haptics.tap();
                              setRealBalanceInput((parsedRealBalance - 100).toFixed(2).replace('.', ','));
                            }}
                            className="px-2 py-0.5 rounded-lg bg-slate-200/70 dark:bg-[#2A2C31] hover:bg-slate-300 dark:hover:bg-[#34373d] text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                          >
                            -100 €
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 3. ANTEPRIMA IN TEMPO REALE DEL MOVIMENTO GENERATO */}
              {parsedRealBalance !== null && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-500 dark:text-[#9A9DA5] uppercase tracking-wider flex items-center gap-1.5">
                      <Layers size={13} />
                      <span>3. Risultato & Movimento Contabile Generato</span>
                    </label>
                  </div>

                  {isExactMatch ? (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                        <Check size={16} strokeWidth={3} />
                      </div>
                      <div className="text-xs text-emerald-900 dark:text-emerald-200">
                        <span className="font-bold block">Saldi Perfettamente Allineati!</span>
                        <span>Il saldo inserito coincide esattamente con il saldo contabile dell'app. Non verrà generato alcun movimento contabile.</span>
                      </div>
                    </div>
                  ) : (
                    <div className={`p-4 rounded-2xl border transition-all space-y-3 ${
                      isPositiveDiff
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white ${isPositiveDiff ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                            {isPositiveDiff ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-[#EAEBED] block">
                              Movimento di {isPositiveDiff ? 'ENTRATA (+)' : 'USCITA (-)'}
                            </span>
                            <span className="text-[10.5px] text-slate-500 dark:text-[#9A9DA5]">
                              {isPositiveDiff ? 'Mancavano fondi nel conteggio' : 'Spesa non registrata / addebito bancario'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={`text-base font-numeric font-bold ${isPositiveDiff ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {formatCurrency(difference, { showSign: true })}
                          </span>
                        </div>
                      </div>

                      {/* Proprietà del movimento */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 dark:border-white/5 text-[11px]">
                        <div className="bg-white/80 dark:bg-[#18191B]/80 p-2 rounded-xl border border-slate-200/60 dark:border-[#2F3136]">
                          <span className="text-slate-400 block text-[10px]">Sottocategoria</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            Nessuna (Rettifica)
                          </span>
                        </div>
                        <div className="bg-white/80 dark:bg-[#18191B]/80 p-2 rounded-xl border border-slate-200/60 dark:border-[#2F3136]">
                          <span className="text-slate-400 block text-[10px]">Data operazione</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300 font-numeric">
                            {formatDateIT(opDate)}
                          </span>
                        </div>
                        <div className="bg-white/80 dark:bg-[#18191B]/80 p-2 rounded-xl border border-slate-200/60 dark:border-[#2F3136] col-span-2 sm:col-span-1">
                          <span className="text-slate-400 block text-[10px]">Nuovo Saldo Risultante</span>
                          <span className="font-bold text-slate-900 dark:text-white font-numeric">
                            {formatCurrency(parsedRealBalance)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* OPZIONI AVANZATE (ACCORDION) */}
              <div className="border border-slate-200/70 dark:border-[#2F3136] rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    setShowAdvanced(!showAdvanced);
                  }}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#18191B] hover:bg-slate-100 dark:hover:bg-[#202226] text-xs font-semibold text-slate-700 dark:text-[#EAEBED] flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} />
                    <span>Personalizza Data & Descrizione (Opzionale)</span>
                  </span>
                  <span className="text-[11px] text-slate-400">{showAdvanced ? '▲ Nascondi' : '▼ Mostra'}</span>
                </button>

                {showAdvanced && (
                  <div className="p-4 bg-white dark:bg-[#222428] space-y-3 border-t border-slate-200/70 dark:border-[#2F3136]">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        Data della rettifica:
                      </label>
                      <input
                        type="date"
                        value={opDate}
                        onChange={(e) => setOpDate(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-[#18191B] border border-slate-200 dark:border-[#2F3136] rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-[#E31B23]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        Descrizione personalizzata del movimento:
                      </label>
                      <input
                        type="text"
                        value={customDescription}
                        onChange={(e) => setCustomDescription(e.target.value)}
                        placeholder="Es. Riconciliazione saldo estratto conto 24 Settembre"
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-[#18191B] border border-slate-200 dark:border-[#2F3136] rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-[#E31B23]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        Note integrative:
                      </label>
                      <textarea
                        rows={2}
                        value={customNote}
                        onChange={(e) => setCustomNote(e.target.value)}
                        placeholder="Note opzionali sul motivo della discrepanza..."
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-[#18191B] border border-slate-200 dark:border-[#2F3136] rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-[#E31B23] resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* FOOTER ACTIONS ONE UI */}
              <div className="sticky bottom-0 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 p-4 sm:p-5 bg-white/95 dark:bg-[#222428]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-[#2F3136] flex items-center justify-end gap-3 z-10">
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    onClose();
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-[#9A9DA5] hover:bg-slate-100 dark:hover:bg-[#2A2C31] transition-all cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={parsedRealBalance === null || isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#E31B23] hover:bg-[#c9151c] active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white shadow-md flex items-center gap-2 transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <span>Applicazione in corso...</span>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>
                        {isExactMatch ? 'Conferma Allineamento Saldo' : 'Genera Movimento di Rettifica'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
