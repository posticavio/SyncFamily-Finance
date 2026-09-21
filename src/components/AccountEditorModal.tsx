import React, { useState, useEffect } from 'react';
import { Account, Fund, AccountForecast, AccountType } from '../types';
import { AccountService } from '../services/AccountService';
import { haptics } from '../utils/haptics';
import {
  X,
  Landmark,
  CreditCard,
  Banknote,
  Wallet,
  Coins,
  Building2,
  PiggyBank,
  Shield,
  ShieldAlert,
  Check,
  Star,
  Archive,
  AlertCircle
} from 'lucide-react';

interface AccountEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'CREATE_ACCOUNT' | 'EDIT_ACCOUNT' | 'CREATE_FUND' | 'EDIT_FUND';
  initialEntity?: AccountForecast | Account | Fund | null;
  onSuccess: () => void;
}

const ACCOUNT_ICONS = [
  { id: 'Landmark', label: 'Banca', icon: Landmark },
  { id: 'CreditCard', label: 'Carta', icon: CreditCard },
  { id: 'Banknote', label: 'Contanti', icon: Banknote },
  { id: 'Wallet', label: 'Portafoglio', icon: Wallet },
  { id: 'Coins', label: 'Monete', icon: Coins },
  { id: 'PiggyBank', label: 'Risparmio', icon: PiggyBank },
  { id: 'Building2', label: 'Istituzione', icon: Building2 },
  { id: 'Shield', label: 'Sicurezza', icon: Shield }
];

const COLOR_PALETTE = [
  { hex: '#4f46e5', label: 'Indaco' },
  { hex: '#0284c7', label: 'Azzurro' },
  { hex: '#059669', label: 'Smeraldo' },
  { hex: '#d97706', label: 'Ambra' },
  { hex: '#e11d48', label: 'Rosa' },
  { hex: '#7c3aed', label: 'Viola' },
  { hex: '#0f766e', label: 'Petrolio' },
  { hex: '#475569', label: 'Ardesia' }
];

const ACCOUNT_TYPES: { id: AccountType; label: string; desc: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'BANCA', label: 'Conto Corrente', desc: 'Banca o istituto di credito', icon: Landmark },
  { id: 'CARTA_DEBITO', label: 'Carta Debito', desc: 'Bancomat e carte prepagate', icon: CreditCard },
  { id: 'CARTA_CREDITO', label: 'Carta Credito', desc: 'Spese con addebito posticipato', icon: CreditCard },
  { id: 'CONTANTI', label: 'Contanti', desc: 'Portafoglio fisico', icon: Banknote },
  { id: 'CONTO_DEPOSITO', label: 'Conto Deposito', desc: 'Risparmio ad accumulo o vincolato', icon: PiggyBank }
];

export const AccountEditorModal: React.FC<AccountEditorModalProps> = ({
  isOpen,
  onClose,
  mode,
  initialEntity,
  onSuccess
}) => {
  const isFund = mode === 'CREATE_FUND' || mode === 'EDIT_FUND';
  const isEdit = mode === 'EDIT_ACCOUNT' || mode === 'EDIT_FUND';

  const [nome, setNome] = useState('');
  const [tipoConto, setTipoConto] = useState<AccountType>('BANCA');
  const [saldoIniziale, setSaldoIniziale] = useState('0,00');
  const [saldoReale, setSaldoReale] = useState('0,00');
  const [targetImporto, setTargetImporto] = useState('1000,00');
  const [contoPrincipale, setContoPrincipale] = useState(false);
  const [attivo, setAttivo] = useState(true);
  const [icon, setIcon] = useState('Landmark');
  const [colore, setColore] = useState('#4f46e5');
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inizializzazione dati
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      if (initialEntity && isEdit) {
        const entityNome = (initialEntity as any).nome_conto || (initialEntity as any).nome_fondo || '';
        setNome(entityNome);
        setSaldoIniziale(initialEntity.saldo_iniziale?.toString().replace('.', ',') || '0,00');
        setSaldoReale(initialEntity.saldo_reale?.toString().replace('.', ',') || '0,00');
        setColore(initialEntity.colore || (isFund ? '#d97706' : '#4f46e5'));
        setIcon(initialEntity.icon || (isFund ? 'ShieldAlert' : 'Landmark'));
        setAttivo(initialEntity.attivo !== false);
        setNote(initialEntity.note || '');

        if (!isFund) {
          const acc = initialEntity as any;
          setTipoConto(acc.tipo_conto || 'BANCA');
          setContoPrincipale(!!acc.conto_principale);
        } else {
          const fund = initialEntity as any;
          setTargetImporto(fund.target_importo ? fund.target_importo.toString().replace('.', ',') : '1000,00');
        }
      } else {
        // Default per creazione
        setNome('');
        setSaldoIniziale('0,00');
        setSaldoReale('0,00');
        setTargetImporto('1000,00');
        setContoPrincipale(false);
        setAttivo(true);
        setNote('');
        if (isFund) {
          setIcon('ShieldAlert');
          setColore('#d97706');
        } else {
          setIcon('Landmark');
          setColore('#4f46e5');
          setTipoConto('BANCA');
        }
      }
    }
  }, [isOpen, initialEntity, mode, isFund, isEdit]);

  if (!isOpen) return null;

  const parseNumber = (val: string): number => {
    const cleaned = val.trim().replace(/\s/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.round(num * 100) / 100;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setErrorMsg('Inserisci un nome per il conto o fondo');
      haptics.error();
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const initialBal = parseNumber(saldoIniziale);
      const realBal = parseNumber(saldoReale);

      if (isFund) {
        const targetVal = parseNumber(targetImporto);
        if (isEdit && initialEntity) {
          const fundId = (initialEntity as any).id || (initialEntity as any).conto_id;
          await AccountService.updateFund(fundId, {
            nome_fondo: nome.trim(),
            saldo_iniziale: initialBal,
            saldo_reale: realBal,
            target_importo: targetVal,
            attivo,
            icon,
            colore,
            note: note.trim()
          });
        } else {
          await AccountService.createFund({
            nome_fondo: nome.trim(),
            saldo_iniziale: initialBal,
            saldo_reale: realBal,
            target_importo: targetVal,
            icon,
            colore,
            note: note.trim()
          });
        }
      } else {
        // Account
        if (isEdit && initialEntity) {
          const accId = (initialEntity as any).id || (initialEntity as any).conto_id;
          await AccountService.updateAccount(accId, {
            nome_conto: nome.trim(),
            tipo_conto: tipoConto,
            saldo_iniziale: initialBal,
            saldo_reale: realBal,
            conto_principale: contoPrincipale,
            attivo,
            icon,
            colore,
            note: note.trim()
          });
        } else {
          await AccountService.createAccount({
            nome_conto: nome.trim(),
            tipo_conto: tipoConto,
            saldo_iniziale: initialBal,
            saldo_reale: realBal,
            conto_principale: contoPrincipale,
            icon,
            colore,
            note: note.trim()
          });
        }
      }

      haptics.success();
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Errore salvataggio conto:", err);
      setErrorMsg(err.message || 'Errore durante il salvataggio');
      haptics.error();
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalTitle = isFund
    ? isEdit
      ? 'Modifica Fondo di Risparmio'
      : 'Nuovo Fondo di Risparmio'
    : isEdit
      ? 'Modifica Conto Bancario'
      : 'Nuovo Conto Bancario o Carta';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        id="account-editor-modal"
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-100"
      >
        {/* Header con colore accent */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs"
              style={{ backgroundColor: colore }}
            >
              {isFund ? <ShieldAlert size={18} /> : <Landmark size={18} />}
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">{modalTitle}</h3>
              <p className="text-xs text-slate-400">
                {isEdit ? 'Aggiorna impostazioni, saldi e visibilità' : 'Configura parametri e saldi iniziali'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 no-scrollbar">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Nome Conto / Fondo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              {isFund ? 'Nome Fondo / Salvadanaio' : 'Nome Conto o Carta'} *
            </label>
            <input
              type="text"
              required
              placeholder={isFund ? 'Es. Fondo Emergenze, Tasse F24, Vacanze' : 'Es. Intesa Sanpaolo Principale, Revolut, Contanti'}
              value={nome}
              onChange={e => setNome(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium"
            />
          </div>

          {/* Tipo Conto (Solo per Conti) */}
          {!isFund && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Tipologia Conto
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ACCOUNT_TYPES.map(type => {
                  const IconCmp = type.icon;
                  const isSelected = tipoConto === type.id;
                  return (
                    <button
                      type="button"
                      key={type.id}
                      onClick={() => {
                        haptics.tap();
                        setTipoConto(type.id);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/60 text-indigo-900 shadow-xs'
                          : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <IconCmp size={16} className={isSelected ? 'text-indigo-600' : 'text-slate-500'} />
                        {isSelected && <Check size={13} className="text-indigo-600 font-bold" />}
                      </div>
                      <div>
                        <div className="text-xs font-semibold">{type.label}</div>
                        <div className="text-[10px] text-slate-400 line-clamp-1">{type.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Saldo Iniziale e Saldo Reale (Due colonne fluide) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Saldo Iniziale (€)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={saldoIniziale}
                onChange={e => setSaldoIniziale(e.target.value)}
                placeholder="0,00"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-numeric font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-indigo-500 transition-all"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Punto di partenza per il calcolo matematico
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Saldo Reale Attuale (€)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={saldoReale}
                onChange={e => setSaldoReale(e.target.value)}
                placeholder="0,00"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-numeric font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-indigo-500 transition-all"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Saldo reale riscontrato in banca (per riconciliazione)
              </span>
            </div>
          </div>

          {/* Target Importo (Solo per Fondi) */}
          {isFund && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Obiettivo Target Risparmio (€)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={targetImporto}
                onChange={e => setTargetImporto(e.target.value)}
                placeholder="1000,00"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-numeric font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-amber-500 transition-all"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Mostra la barra percentuale di avanzamento nella dashboard
              </span>
            </div>
          )}

          {/* Palette Colore & Icone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Scelta Colore */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Colore Grafico
              </label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PALETTE.map(c => (
                  <button
                    type="button"
                    key={c.hex}
                    onClick={() => {
                      haptics.tap();
                      setColore(c.hex);
                    }}
                    title={c.label}
                    className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center ${
                      colore === c.hex ? 'scale-110 ring-2 ring-offset-2 ring-indigo-500' : 'hover:scale-105 opacity-85'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  >
                    {colore === c.hex && <Check size={12} className="text-white font-bold" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Scelta Icona */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Icona Simbolo
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ACCOUNT_ICONS.map(ic => {
                  const IconComp = ic.icon;
                  const isSel = icon === ic.id;
                  return (
                    <button
                      type="button"
                      key={ic.id}
                      onClick={() => {
                        haptics.tap();
                        setIcon(ic.id);
                      }}
                      title={ic.label}
                      className={`p-2 rounded-xl border transition-all ${
                        isSel
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <IconComp size={15} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Toggle Conto Principale (Solo Conti) */}
          {!isFund && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${contoPrincipale ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'}`}>
                  <Star size={16} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800">Conto Principale Predefinito</div>
                  <div className="text-[11px] text-slate-400">Selezionato di default nelle nuove registrazioni</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  haptics.tap();
                  setContoPrincipale(!contoPrincipale);
                }}
                className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                  contoPrincipale ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    contoPrincipale ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Toggle Stato Attivo / Archiviato */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${attivo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                <Archive size={16} />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-800">
                  {attivo ? 'Stato: Attivo' : 'Stato: Archiviato'}
                </div>
                <div className="text-[11px] text-slate-400">
                  {attivo ? 'Disponibile per nuove spese e visibile nelle proiezioni' : 'Nascosto dai selettori; mantiene lo storico'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                setAttivo(!attivo);
              }}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                attivo ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  attivo ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Note Opzionali */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Note o IBAN (Opzionale)
            </label>
            <input
              type="text"
              placeholder="Es. IBAN IT00..., carta n. 1234, intestatario..."
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-indigo-400 transition-all"
            />
          </div>

          {/* Pulsanti Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Salvataggio...</span>
              ) : (
                <>
                  <Check size={14} />
                  <span>{isEdit ? 'Salva Modifiche' : 'Crea Adesso'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
