import React, { useState, useMemo } from 'react';
import { AccountForecast } from '../types';
import { AccountService } from '../services/AccountService';
import { formatCurrency } from '../utils/formatters';
import { haptics } from '../utils/haptics';
import { AccountEditorModal } from './AccountEditorModal';
import { AccountDeleteDialog } from './AccountDeleteDialog';
import {
  X,
  Landmark,
  ShieldAlert,
  Check,
  Edit2,
  Plus,
  Search,
  Pencil,
  Trash2,
  Archive,
  RotateCcw,
  Star,
  CreditCard,
  Banknote,
  PiggyBank,
  Building2,
  Wallet,
  Shield,
  Clock,
  FileSpreadsheet,
  Sparkles
} from 'lucide-react';

interface AccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: AccountForecast[];
  funds: AccountForecast[];
  onRefresh: () => void;
  onOpenCreateAccount?: () => void;
  onOpenReconciliation?: (accountId?: string) => void;
  onOpenBalanceCorrection?: (accountId?: string) => void;
  onSelectAccount?: (account: AccountForecast) => void;
}

export const AccountsModal: React.FC<AccountsModalProps> = ({
  isOpen,
  onClose,
  accounts,
  funds,
  onRefresh,
  onOpenCreateAccount,
  onOpenReconciliation,
  onOpenBalanceCorrection,
  onSelectAccount
}) => {
  const [editingRealId, setEditingRealId] = useState<string | null>(null);
  const [newRealVal, setNewRealVal] = useState<string>('');
  const [modalTab, setModalTab] = useState<'ALL' | 'ACCOUNTS' | 'FUNDS'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showArchived, setShowArchived] = useState(false);
  const [includePlanned, setIncludePlanned] = useState(false);
  const [expandedPlannedId, setExpandedPlannedId] = useState<string | null>(null);

  // Editor Modal State
  const [editorState, setEditorState] = useState<{
    isOpen: boolean;
    mode: 'CREATE_ACCOUNT' | 'EDIT_ACCOUNT' | 'CREATE_FUND' | 'EDIT_FUND';
    entity?: AccountForecast | null;
  }>({
    isOpen: false,
    mode: 'CREATE_ACCOUNT',
    entity: null
  });

  // Delete Dialog State
  const [deleteState, setDeleteState] = useState<{
    isOpen: boolean;
    entity: AccountForecast | null;
    isFund: boolean;
  }>({
    isOpen: false,
    entity: null,
    isFund: false
  });

  const handleSaveReal = async (entityId: string) => {
    const parsed = parseFloat(newRealVal.replace(',', '.'));
    if (!isNaN(parsed)) {
      await AccountService.updateRealBalance(entityId, parsed);
      setEditingRealId(null);
      haptics.success();
      onRefresh();
    }
  };

  const handleToggleActive = async (item: AccountForecast, isFund: boolean) => {
    haptics.tap();
    try {
      const entityId = item.id || item.conto_id;
      if (isFund) {
        await AccountService.toggleFundActive(entityId);
      } else {
        await AccountService.toggleAccountActive(entityId);
      }
      onRefresh();
    } catch (err) {
      console.error("Errore toggle attivo:", err);
    }
  };

  // Filtraggio conti
  const filteredAccounts = useMemo(() => {
    if (modalTab === 'FUNDS') return [];
    let list = accounts;
    if (!showArchived) {
      list = list.filter(a => a.attivo !== false);
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(a =>
      a.nome_conto.toLowerCase().includes(q) ||
      (a.conto_id && a.conto_id.toLowerCase().includes(q)) ||
      (a.human_id && a.human_id.toLowerCase().includes(q))
    );
  }, [accounts, modalTab, searchQuery, showArchived]);

  // Filtraggio fondi
  const filteredFunds = useMemo(() => {
    if (modalTab === 'ACCOUNTS') return [];
    let list = funds;
    if (!showArchived) {
      list = list.filter(f => f.attivo !== false);
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(f =>
      f.nome_conto.toLowerCase().includes(q) ||
      (f.conto_id && f.conto_id.toLowerCase().includes(q)) ||
      (f.human_id && f.human_id.toLowerCase().includes(q))
    );
  }, [funds, modalTab, searchQuery, showArchived]);

  // Lista di conti disponibili per eventuale riassegnazione
  const availableAccountOptions = useMemo(() => {
    return accounts.map(a => ({
      id: a.id || a.conto_id,
      nome: a.nome_conto
    }));
  }, [accounts]);

  // Icona conto
  const getAccountIcon = (item: AccountForecast) => {
    if (item.is_fund) return <ShieldAlert size={16} />;
    switch (item.tipo_conto) {
      case 'CARTA_DEBITO':
      case 'CARTA_CREDITO':
        return <CreditCard size={16} />;
      case 'CONTANTI':
        return <Banknote size={16} />;
      case 'CONTO_DEPOSITO':
        return <PiggyBank size={16} />;
      case 'BANCA':
      default:
        return <Landmark size={16} />;
    }
  };

  // Etichetta tipo conto
  const getAccountTypeLabel = (item: AccountForecast) => {
    if (item.is_fund) return 'Fondo Risparmio';
    switch (item.tipo_conto) {
      case 'CARTA_DEBITO':
        return 'Carta Debito';
      case 'CARTA_CREDITO':
        return 'Carta Credito';
      case 'CONTANTI':
        return 'Contanti';
      case 'CONTO_DEPOSITO':
        return 'Conto Deposito';
      case 'BANCA':
      default:
        return 'Conto Corrente';
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
        <div 
          id="accounts-management-dialog"
          className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-100"
        >
          {/* Header Principale */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
                <Landmark size={18} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Gestione Conti & Fondi</h3>
                <p className="text-xs text-slate-400">Modifica, elimina, archivia e riconcilia saldi</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Barra di Ricerca, Filtri e Azioni di Aggiunta */}
          <div className="px-5 sm:px-6 py-3 bg-slate-50/80 border-b border-slate-100 space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
              {/* Filtri a pillola */}
              <div className="flex bg-slate-200/70 p-0.5 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setModalTab('ALL')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    modalTab === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Tutti ({accounts.length + funds.length})
                </button>
                <button
                  onClick={() => setModalTab('ACCOUNTS')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    modalTab === 'ACCOUNTS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Conti ({accounts.length})
                </button>
                <button
                  onClick={() => setModalTab('FUNDS')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    modalTab === 'FUNDS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Fondi ({funds.length})
                </button>
              </div>

              {/* Bottoni Aggiungi Conto & Fondo & Riconciliazione */}
              <div className="flex items-center gap-2 flex-wrap">
                {onOpenBalanceCorrection && (
                  <button
                    onClick={() => {
                      haptics.tap();
                      onClose();
                      onOpenBalanceCorrection();
                    }}
                    className="px-3 py-1.5 bg-[#E31B23]/10 hover:bg-[#E31B23]/20 text-[#E31B23] border border-[#E31B23]/30 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Allinea il saldo all'estratto conto reale bancario e genera movimento contabile"
                  >
                    <Sparkles size={14} />
                    <span>Correggi Saldo</span>
                  </button>
                )}
                {onOpenReconciliation && (
                  <button
                    onClick={() => {
                      haptics.tap();
                      onClose();
                      onOpenReconciliation();
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all border border-slate-200"
                    title="Carica estratto conto bancario e riconcilia le transazioni mancanti"
                  >
                    <FileSpreadsheet size={14} className="text-indigo-600" />
                    <span>Riconcilia Estratto</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    haptics.tap();
                    setEditorState({ isOpen: true, mode: 'CREATE_ACCOUNT', entity: null });
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
                >
                  <Plus size={14} />
                  <span>Nuovo Conto</span>
                </button>
                <button
                  onClick={() => {
                    haptics.tap();
                    setEditorState({ isOpen: true, mode: 'CREATE_FUND', entity: null });
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
                >
                  <Plus size={14} />
                  <span>Nuovo Fondo</span>
                </button>
              </div>
            </div>

            {/* Ricerca e Toggle Archiviati */}
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cerca per nome o ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400"
                />
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 font-medium select-none px-1">
                  <input
                    type="checkbox"
                    checked={includePlanned}
                    onChange={e => setIncludePlanned(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                  />
                  <span className="flex items-center gap-1">
                    <Clock size={12} className="text-indigo-600" />
                    <span>Includi programmati nel saldo</span>
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 font-medium select-none px-1">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={e => setShowArchived(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                  />
                  <span>Mostra archiviati</span>
                </label>
              </div>
            </div>
          </div>

          {/* Elenco Conti e Fondi */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-6 no-scrollbar">
            {filteredAccounts.length === 0 && filteredFunds.length === 0 && (
              <div className="py-10 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                Nessun conto o fondo trovato per i filtri selezionati.
              </div>
            )}

            {/* Sezione Conti Bancari e Carte */}
            {filteredAccounts.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Landmark size={13} />
                    <span>Conti & Carte Correnti ({filteredAccounts.length})</span>
                  </h4>
                </div>

                <div className="space-y-3">
                  {filteredAccounts.map(acc => {
                    const hasDiff = acc.differenza !== 0;
                    const isEditingReal = editingRealId === acc.conto_id;
                    const isArchived = acc.attivo === false;

                    return (
                      <div
                        key={acc.conto_id}
                        className={`p-4 rounded-2xl border transition-all space-y-3 ${
                          isArchived
                            ? 'bg-slate-100/60 border-slate-300/80 opacity-75'
                            : 'bg-white border-slate-200/80 shadow-xs hover:border-indigo-200'
                        }`}
                      >
                        {/* Intestazione Card con Badge e Azioni CRUD */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                              style={{ backgroundColor: acc.colore || '#4f46e5' }}
                            >
                              {getAccountIcon(acc)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h5 className="text-sm font-bold text-slate-800 truncate">{acc.nome_conto}</h5>
                                {acc.conto_principale && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-700 flex items-center gap-0.5">
                                    <Star size={10} className="fill-amber-500 text-amber-500" />
                                    <span>Principale</span>
                                  </span>
                                )}
                                {isArchived && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-slate-200 text-[10px] font-bold text-slate-600 flex items-center gap-0.5">
                                    <Archive size={10} />
                                    <span>Archiviato</span>
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                <span>{getAccountTypeLabel(acc)}</span>
                                <span>•</span>
                                <span className="font-mono text-[10px]">ID: {acc.human_id || acc.conto_id}</span>
                              </div>
                            </div>
                          </div>

                          {/* Gruppo Azioni: Modifica, Elimina, Archivia, Aggiorna Saldo Reale */}
                          <div className="flex items-center gap-1.5 self-end sm:self-center flex-wrap">
                            {/* Bottone Modifica Completa */}
                            <button
                              type="button"
                              onClick={() => {
                                haptics.tap();
                                setEditorState({
                                  isOpen: true,
                                  mode: 'EDIT_ACCOUNT',
                                  entity: acc
                                });
                              }}
                              title="Modifica conto (nome, tipo, colore, opzioni)"
                              className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 text-slate-600 transition-all text-xs font-semibold flex items-center gap-1 active:scale-95"
                            >
                              <Pencil size={13} />
                              <span className="hidden sm:inline">Modifica</span>
                            </button>

                            {/* Bottone Archivia / Riattiva rapido */}
                            <button
                              type="button"
                              onClick={() => handleToggleActive(acc, false)}
                              title={isArchived ? 'Riattiva conto' : 'Archivia conto (nascondi dalle nuove spese)'}
                              className={`p-1.5 rounded-xl border transition-all text-xs font-semibold flex items-center gap-1 active:scale-95 ${
                                isArchived
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {isArchived ? <RotateCcw size={13} /> : <Archive size={13} />}
                              <span className="hidden sm:inline">{isArchived ? 'Riattiva' : 'Archivia'}</span>
                            </button>

                            {/* Bottone Elimina */}
                            <button
                              type="button"
                              onClick={() => {
                                haptics.tap();
                                setDeleteState({
                                  isOpen: true,
                                  entity: acc,
                                  isFund: false
                                });
                              }}
                              title="Elimina o cancella conto"
                              className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-300 text-rose-600 transition-all active:scale-95"
                            >
                              <Trash2 size={13} />
                            </button>

                            {/* Bottone Correzione Rapida Saldo */}
                            {onOpenBalanceCorrection && (
                              <button
                                type="button"
                                onClick={() => {
                                  haptics.tap();
                                  onClose();
                                  onOpenBalanceCorrection(acc.conto_id);
                                }}
                                title="Rettifica e allinea saldo conto bancario"
                                className="px-2 py-1 rounded-xl bg-[#E31B23]/10 border border-[#E31B23]/30 text-[#E31B23] hover:bg-[#E31B23]/20 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                              >
                                <Sparkles size={11} />
                                <span>Correggi Saldo</span>
                              </button>
                            )}

                            {/* Editing Saldo Reale Inline */}
                            {isEditingReal ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={newRealVal}
                                  onChange={e => setNewRealVal(e.target.value)}
                                  placeholder="0,00"
                                  autoFocus
                                  className="w-20 px-2 py-1 text-xs font-numeric font-semibold bg-white border border-indigo-500 rounded-lg outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveReal(acc.conto_id)}
                                  className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                >
                                  <Check size={13} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRealId(acc.conto_id);
                                  setNewRealVal(acc.saldo_reale.toString().replace('.', ','));
                                }}
                                title="Aggiorna saldo estratto conto"
                                className="px-2 py-1 rounded-xl bg-slate-50 border border-slate-200/90 text-slate-700 hover:border-indigo-300 text-[11px] font-semibold flex items-center gap-1 transition-all"
                              >
                                <Edit2 size={11} className="text-slate-400" />
                                <span>Saldo Reale</span>
                              </button>
                            )}

                            {onOpenReconciliation && (
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onOpenReconciliation(acc.conto_id);
                                }}
                                title="Carica estratto conto bancario e riconcilia le transazioni mancanti"
                                className="px-2 py-1 rounded-xl bg-indigo-50 border border-indigo-200/90 text-indigo-700 hover:bg-indigo-100 text-[11px] font-semibold flex items-center gap-1 transition-all"
                              >
                                <FileSpreadsheet size={11} className="text-indigo-600" />
                                <span>Riconcilia Estratto</span>
                              </button>
                            )}

                            {onSelectAccount && (
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onSelectAccount(acc);
                                }}
                                title="Visualizza scheda info e storico movimenti per mese"
                                className="px-2 py-1 rounded-xl bg-slate-50 border border-slate-200/90 text-slate-700 hover:bg-slate-100 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                              >
                                <span>Movimenti</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Griglia dei Saldi */}
                        <div className={`grid ${acc.conteggio_programmati && acc.conteggio_programmati > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} gap-2 pt-2 border-t border-slate-100 text-center`}>
                          <div className="p-2 rounded-xl bg-slate-50/70 border border-slate-100">
                            <span className="text-[10px] text-slate-400 block font-medium">
                              {includePlanned ? 'Saldo c/ Prog.' : 'Saldo Oggi'}
                            </span>
                            <span className="font-numeric font-bold text-slate-900 text-xs">
                              {formatCurrency(includePlanned ? (acc.saldo_con_programmati ?? acc.saldo_oggi) : acc.saldo_oggi)}
                            </span>
                            {hasDiff && (
                              <span className={`text-[9px] block font-mono font-semibold ${acc.differenza > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                Diff: {formatCurrency(acc.differenza, { showSign: true })}
                              </span>
                            )}
                          </div>

                          {acc.conteggio_programmati !== undefined && acc.conteggio_programmati > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpandedPlannedId(expandedPlannedId === acc.conto_id ? null : acc.conto_id)}
                              className={`p-2 rounded-xl border text-center transition-all ${
                                expandedPlannedId === acc.conto_id
                                  ? 'bg-indigo-100/70 border-indigo-300'
                                  : 'bg-indigo-50/50 border-indigo-100 hover:bg-indigo-100/50'
                              }`}
                              title="Clicca per vedere i movimenti programmati di questo conto"
                            >
                              <span className="text-[10px] text-indigo-700 block font-medium flex items-center justify-center gap-1">
                                <Clock size={10} />
                                <span>{acc.conteggio_programmati} Prog.</span>
                              </span>
                              <span className={`font-numeric font-bold text-xs ${(acc.totale_programmati || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {formatCurrency(acc.totale_programmati || 0, { showSign: true })}
                              </span>
                            </button>
                          )}

                          <div className="p-2 rounded-xl bg-slate-50/70 border border-slate-100">
                            <span className="text-[10px] text-slate-400 block font-medium">Fine Mese</span>
                            <span className="font-numeric font-bold text-indigo-600 text-xs">
                              {formatCurrency(acc.saldo_fine_mese)}
                            </span>
                          </div>

                          <div className="p-2 rounded-xl bg-slate-50/70 border border-slate-100">
                            <span className="text-[10px] text-slate-400 block font-medium">Al 9 Succ.</span>
                            <span className="font-numeric font-bold text-slate-700 text-xs">
                              {formatCurrency(acc.saldo_al_nove)}
                            </span>
                          </div>
                        </div>

                        {/* Dettaglio a comparsa movimenti programmati per questo conto */}
                        {expandedPlannedId === acc.conto_id && acc.movimenti_programmati && acc.movimenti_programmati.length > 0 && (
                          <div className="mt-2 p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-1.5 text-left">
                            <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-900 border-b border-indigo-100/80 pb-1">
                              <span>Movimenti programmati pendenti ({acc.movimenti_programmati.length})</span>
                              <span className="font-mono">
                                Totale: {formatCurrency(acc.totale_programmati || 0, { showSign: true })}
                              </span>
                            </div>
                            <div className="space-y-1 max-h-32 overflow-y-auto no-scrollbar">
                              {acc.movimenti_programmati.map(p => (
                                <div key={p.id} className="flex items-center justify-between text-[10px] text-slate-600 py-0.5">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="font-mono text-slate-400">{p.data_prevista}</span>
                                    <span className="truncate">{p.descrizione}</span>
                                  </div>
                                  <span className={`font-numeric font-bold flex-shrink-0 ml-2 ${p.tipologia === 'ENTRATA' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {p.tipologia === 'ENTRATA' ? '+' : '-'} {formatCurrency(p.importo)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sezione Fondi Accantonamento e Risparmio */}
            {filteredFunds.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert size={13} />
                    <span>Fondi Accantonamento & Risparmio ({filteredFunds.length})</span>
                  </h4>
                </div>

                <div className="space-y-3">
                  {filteredFunds.map(fund => {
                    const hasDiff = fund.differenza !== 0;
                    const isEditingReal = editingRealId === fund.conto_id;
                    const isArchived = fund.attivo === false;

                    return (
                      <div
                        key={fund.conto_id}
                        className={`p-4 rounded-2xl border transition-all space-y-3 ${
                          isArchived
                            ? 'bg-slate-100/60 border-slate-300/80 opacity-75'
                            : 'bg-white border-amber-200/80 shadow-xs hover:border-amber-300'
                        }`}
                      >
                        {/* Intestazione Card con Badge e Azioni CRUD */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                              style={{ backgroundColor: fund.colore || '#d97706' }}
                            >
                              <ShieldAlert size={16} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h5 className="text-sm font-bold text-slate-800 truncate">{fund.nome_conto}</h5>
                                {isArchived && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-slate-200 text-[10px] font-bold text-slate-600 flex items-center gap-0.5">
                                    <Archive size={10} />
                                    <span>Archiviato</span>
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                <span>Fondo Accantonamento</span>
                                <span>•</span>
                                <span className="font-mono text-[10px]">ID: {fund.human_id || fund.conto_id}</span>
                              </div>
                            </div>
                          </div>

                          {/* Gruppo Azioni: Modifica, Elimina, Archivia, Aggiorna Saldo Reale */}
                          <div className="flex items-center gap-1.5 self-end sm:self-center flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                haptics.tap();
                                setEditorState({
                                  isOpen: true,
                                  mode: 'EDIT_FUND',
                                  entity: fund
                                });
                              }}
                              title="Modifica fondo (nome, target, colore, note)"
                              className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 text-slate-600 transition-all text-xs font-semibold flex items-center gap-1 active:scale-95"
                            >
                              <Pencil size={13} />
                              <span className="hidden sm:inline">Modifica</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleActive(fund, true)}
                              title={isArchived ? 'Riattiva fondo' : 'Archivia fondo'}
                              className={`p-1.5 rounded-xl border transition-all text-xs font-semibold flex items-center gap-1 active:scale-95 ${
                                isArchived
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {isArchived ? <RotateCcw size={13} /> : <Archive size={13} />}
                              <span className="hidden sm:inline">{isArchived ? 'Riattiva' : 'Archivia'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                haptics.tap();
                                setDeleteState({
                                  isOpen: true,
                                  entity: fund,
                                  isFund: true
                                });
                              }}
                              title="Elimina fondo"
                              className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-300 text-rose-600 transition-all active:scale-95"
                            >
                              <Trash2 size={13} />
                            </button>

                            {/* Bottone Correzione Rapida Saldo */}
                            {onOpenBalanceCorrection && (
                              <button
                                type="button"
                                onClick={() => {
                                  haptics.tap();
                                  onClose();
                                  onOpenBalanceCorrection(fund.conto_id);
                                }}
                                title="Rettifica e allinea saldo fondo"
                                className="px-2 py-1 rounded-xl bg-[#E31B23]/10 border border-[#E31B23]/30 text-[#E31B23] hover:bg-[#E31B23]/20 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                              >
                                <Sparkles size={11} />
                                <span>Correggi Saldo</span>
                              </button>
                            )}

                            {isEditingReal ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={newRealVal}
                                  onChange={e => setNewRealVal(e.target.value)}
                                  placeholder="0,00"
                                  autoFocus
                                  className="w-20 px-2 py-1 text-xs font-numeric font-semibold bg-white border border-amber-500 rounded-lg outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveReal(fund.conto_id)}
                                  className="p-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                                >
                                  <Check size={13} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRealId(fund.conto_id);
                                  setNewRealVal(fund.saldo_reale.toString().replace('.', ','));
                                }}
                                title="Aggiorna saldo reale"
                                className="px-2 py-1 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:border-amber-300 text-[11px] font-semibold flex items-center gap-1 transition-all"
                              >
                                <Edit2 size={11} className="text-slate-400" />
                                <span>Saldo Reale</span>
                              </button>
                            )}

                            {onSelectAccount && (
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onSelectAccount(fund);
                                }}
                                title="Visualizza scheda info e storico movimenti per mese"
                                className="px-2 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                              >
                                <span>Movimenti</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Griglia dei Saldi */}
                        <div className={`grid ${fund.conteggio_programmati && fund.conteggio_programmati > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} gap-2 pt-2 border-t border-amber-100/70 text-center`}>
                          <div className="p-2 rounded-xl bg-amber-50/40 border border-amber-100/60">
                            <span className="text-[10px] text-slate-400 block font-medium">
                              {includePlanned ? 'Saldo c/ Prog.' : 'Saldo Oggi'}
                            </span>
                            <span className="font-numeric font-bold text-slate-900 text-xs">
                              {formatCurrency(includePlanned ? (fund.saldo_con_programmati ?? fund.saldo_oggi) : fund.saldo_oggi)}
                            </span>
                            {hasDiff && (
                              <span className={`text-[9px] block font-mono font-semibold ${fund.differenza > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                Diff: {formatCurrency(fund.differenza, { showSign: true })}
                              </span>
                            )}
                          </div>

                          {fund.conteggio_programmati !== undefined && fund.conteggio_programmati > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpandedPlannedId(expandedPlannedId === fund.conto_id ? null : fund.conto_id)}
                              className={`p-2 rounded-xl border text-center transition-all ${
                                expandedPlannedId === fund.conto_id
                                  ? 'bg-amber-100/80 border-amber-300'
                                  : 'bg-amber-50/60 border-amber-100 hover:bg-amber-100/50'
                              }`}
                              title="Clicca per vedere i movimenti programmati di questo fondo"
                            >
                              <span className="text-[10px] text-amber-800 block font-medium flex items-center justify-center gap-1">
                                <Clock size={10} />
                                <span>{fund.conteggio_programmati} Prog.</span>
                              </span>
                              <span className={`font-numeric font-bold text-xs ${(fund.totale_programmati || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {formatCurrency(fund.totale_programmati || 0, { showSign: true })}
                              </span>
                            </button>
                          )}

                          <div className="p-2 rounded-xl bg-amber-50/40 border border-amber-100/60">
                            <span className="text-[10px] text-slate-400 block font-medium">Fine Mese</span>
                            <span className="font-numeric font-bold text-amber-700 text-xs">
                              {formatCurrency(fund.saldo_fine_mese)}
                            </span>
                          </div>

                          <div className="p-2 rounded-xl bg-amber-50/40 border border-amber-100/60">
                            <span className="text-[10px] text-slate-400 block font-medium">Al 9 Succ.</span>
                            <span className="font-numeric font-bold text-slate-700 text-xs">
                              {formatCurrency(fund.saldo_al_nove)}
                            </span>
                          </div>
                        </div>

                        {/* Dettaglio a comparsa movimenti programmati per questo fondo */}
                        {expandedPlannedId === fund.conto_id && fund.movimenti_programmati && fund.movimenti_programmati.length > 0 && (
                          <div className="mt-2 p-3 bg-amber-50/60 rounded-xl border border-amber-200/70 space-y-1.5 text-left">
                            <div className="flex items-center justify-between text-[11px] font-semibold text-amber-900 border-b border-amber-200/60 pb-1">
                              <span>Movimenti programmati pendenti ({fund.movimenti_programmati.length})</span>
                              <span className="font-mono">
                                Totale: {formatCurrency(fund.totale_programmati || 0, { showSign: true })}
                              </span>
                            </div>
                            <div className="space-y-1 max-h-32 overflow-y-auto no-scrollbar">
                              {fund.movimenti_programmati.map(p => (
                                <div key={p.id} className="flex items-center justify-between text-[10px] text-slate-600 py-0.5">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="font-mono text-slate-400">{p.data_prevista}</span>
                                    <span className="truncate">{p.descrizione}</span>
                                  </div>
                                  <span className={`font-numeric font-bold flex-shrink-0 ml-2 ${p.tipologia === 'ENTRATA' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {p.tipologia === 'ENTRATA' ? '+' : '-'} {formatCurrency(p.importo)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer del Dialog */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
            <div className="text-xs text-slate-400 font-medium">
              Totale enti censiti: <span className="font-bold text-slate-700">{accounts.length + funds.length}</span>
            </div>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-black active:scale-95 text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
            >
              Fatto
            </button>
          </div>
        </div>
      </div>

      {/* Editor Modal (Crea o Modifica) */}
      {editorState.isOpen && (
        <AccountEditorModal
          isOpen={editorState.isOpen}
          onClose={() => setEditorState({ isOpen: false, mode: 'CREATE_ACCOUNT', entity: null })}
          mode={editorState.mode}
          initialEntity={editorState.entity}
          onSuccess={onRefresh}
        />
      )}

      {/* Delete / Archive Confirmation Dialog */}
      {deleteState.isOpen && deleteState.entity && (
        <AccountDeleteDialog
          isOpen={deleteState.isOpen}
          onClose={() => setDeleteState({ isOpen: false, entity: null, isFund: false })}
          entity={deleteState.entity}
          isFund={deleteState.isFund}
          availableAccounts={availableAccountOptions}
          onSuccess={onRefresh}
        />
      )}
    </>
  );
};
