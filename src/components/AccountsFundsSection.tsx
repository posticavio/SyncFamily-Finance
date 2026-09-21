import React, { useState, useMemo } from 'react';
import { AccountForecast } from '../types';
import { formatCurrency } from '../utils/formatters';
import { InlineSparkline } from './InlineSparkline';
import { Carousel } from './Carousel';
import {
  Landmark,
  CreditCard,
  Banknote,
  Shield,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  Sparkles,
  Plus,
  Pencil,
  Clock,
  FileSpreadsheet,
  Wallet
} from 'lucide-react';

interface AccountsFundsSectionProps {
  accounts: AccountForecast[];
  funds: AccountForecast[];
  totaleOggiCalcolato: number;
  onOpenAccountsModal: () => void;
  onOpenNewTransaction: () => void;
  onOpenReconciliation?: (accountId?: string) => void;
  onSelectAccount?: (account: AccountForecast) => void;
}

export const AccountsFundsSection: React.FC<AccountsFundsSectionProps> = ({
  accounts,
  funds,
  totaleOggiCalcolato,
  onOpenAccountsModal,
  onOpenNewTransaction,
  onOpenReconciliation,
  onSelectAccount
}) => {
  const [filterTab, setFilterTab] = useState<'ALL' | 'ACCOUNTS' | 'FUNDS' | 'DIFF'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'BALANCE_DESC' | 'NAME_ASC' | 'DIFF_DESC'>('BALANCE_DESC');
  const [viewMode, setViewMode] = useState<'EXPANDED' | 'COMPACT'>('EXPANDED');
  const [isExpanded, setIsExpanded] = useState(false);
  const [includePlanned, setIncludePlanned] = useState(false);

  // Combina conti e fondi contrassegnandoli
  const allItems: AccountForecast[] = useMemo(() => {
    return [...accounts, ...funds];
  }, [accounts, funds]);

  // Conteggio discrepanze
  const diffCount = useMemo(() => {
    return allItems.filter(i => i.differenza !== 0).length;
  }, [allItems]);

  // Movimenti programmati complessivi
  const totalPlannedCount = useMemo(() => {
    return allItems.reduce((acc, i) => acc + (i.conteggio_programmati || 0), 0);
  }, [allItems]);

  const totalPlannedNet = useMemo(() => {
    return allItems.reduce((acc, i) => acc + (i.totale_programmati || 0), 0);
  }, [allItems]);

  // Helper per il saldo dell'elemento in base al toggle
  const getItemBalance = (item: AccountForecast): number => {
    if (includePlanned && item.saldo_con_programmati !== undefined) {
      return item.saldo_con_programmati;
    }
    return item.saldo_oggi;
  };

  // Metriche di riepilogo per KPI
  const kpiStats = useMemo(() => {
    const totalLiquidity = totaleOggiCalcolato > 0 
      ? totaleOggiCalcolato 
      : allItems.reduce((acc, i) => acc + getItemBalance(i), 0);
    const totalAccounts = accounts.reduce((acc, i) => acc + getItemBalance(i), 0);
    const totalFunds = funds.reduce((acc, i) => acc + getItemBalance(i), 0);
    
    const accountsPct = totalLiquidity > 0 ? Math.round((totalAccounts / totalLiquidity) * 100) : 0;
    const fundsPct = totalLiquidity > 0 ? Math.round((totalFunds / totalLiquidity) * 100) : 0;

    return {
      totalLiquidity,
      totalAccounts,
      totalFunds,
      accountsPct: Math.max(0, Math.min(100, accountsPct)),
      fundsPct: Math.max(0, Math.min(100, fundsPct))
    };
  }, [totaleOggiCalcolato, allItems, accounts, funds, includePlanned]);

  // Filtraggio e Ricerca
  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      // Filtro Tab
      if (filterTab === 'ACCOUNTS' && item.is_fund) return false;
      if (filterTab === 'FUNDS' && !item.is_fund) return false;
      if (filterTab === 'DIFF' && item.differenza === 0) return false;

      // Ricerca testuale
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        const matchName = item.nome_conto.toLowerCase().includes(query);
        const matchId = item.conto_id.toLowerCase().includes(query);
        return matchName || matchId;
      }

      return true;
    }).sort((a, b) => {
      const balA = getItemBalance(a);
      const balB = getItemBalance(b);
      if (sortBy === 'BALANCE_DESC') {
        return balB - balA;
      }
      if (sortBy === 'NAME_ASC') {
        return a.nome_conto.localeCompare(b.nome_conto);
      }
      if (sortBy === 'DIFF_DESC') {
        return Math.abs(b.differenza) - Math.abs(a.differenza);
      }
      return 0;
    });
  }, [allItems, filterTab, searchQuery, sortBy, includePlanned]);

  // Se ci sono molti elementi (es. > 20 fondi), mostriamo inizialmente i primi elementi se non espanso
  const limitThreshold = viewMode === 'COMPACT' ? 12 : 6;
  const shouldLimit = !isExpanded && searchQuery.trim() === '' && filteredItems.length > limitThreshold;
  const displayItems = shouldLimit ? filteredItems.slice(0, limitThreshold) : filteredItems;

  // Icona dinamica con fallback
  const getItemIcon = (item: AccountForecast) => {
    if (item.is_fund) {
      return <Shield size={16} className="text-amber-600" />;
    }
    if (item.tipo_conto === 'CONTANTI') {
      return <Banknote size={16} className="text-emerald-600" />;
    }
    if (item.tipo_conto === 'CARTA_DEBITO' || item.tipo_conto === 'CARTA_CREDITO') {
      return <CreditCard size={16} className="text-sky-600" />;
    }
    return <Landmark size={16} className="text-indigo-600" />;
  };

  return (
    <div className="bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/5 rounded-[22px] shadow-sm p-5 sm:p-6 space-y-4">
      {/* Header Sezione con statistiche e azione */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Liquidità & Ripartizione
            </span>
            <span className="px-2 py-0.5 rounded-xl text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/40">
              {accounts.length} Conti • {funds.length} Fondi
            </span>
            {diffCount > 0 && (
              <span className="px-2 py-0.5 rounded-xl text-[10px] font-bold bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40 animate-pulse">
                {diffCount} da riconciliare
              </span>
            )}
          </div>

          <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-[#F5F5F7] tracking-tight flex items-center gap-2">
            <span>Conti & Fondi di Pagamento</span>
            <span className="text-xs font-normal text-slate-400">
              ({filteredItems.length} visibili)
            </span>
          </h3>
        </div>

        {/* Pulsanti Rapidi / Gestione */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Pulsante Toggle Vista 'Compatta' e 'Espansa' (Compact vs Expanded) */}
          <div className="flex items-center bg-slate-100 dark:bg-[#242426] p-0.5 rounded-xl border border-slate-200/70 dark:border-white/5 text-xs">
            <button
              id="accounts-toggle-expanded-view"
              onClick={() => setViewMode('EXPANDED')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                viewMode === 'EXPANDED'
                  ? 'bg-white dark:bg-[#1C1C1E] text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Vista Espansa (Dettagliata con indicatori completi)"
            >
              <LayoutGrid size={13} />
              <span>Espansa</span>
            </button>
            <button
              id="accounts-toggle-compact-view"
              onClick={() => setViewMode('COMPACT')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                viewMode === 'COMPACT'
                  ? 'bg-white dark:bg-[#1C1C1E] text-indigo-700 dark:text-indigo-400 shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Vista Compatta (Più elementi e fondi su schermo)"
            >
              <List size={13} />
              <span>Compatta</span>
            </button>
          </div>

          {onOpenReconciliation && (
            <button
              onClick={() => onOpenReconciliation()}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-[#242426] dark:hover:bg-[#2A2A2E] text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-white/5"
              title="Carica estratto conto bancario e riconcilia le transazioni mancanti"
            >
              <FileSpreadsheet size={13} className="text-indigo-600 dark:text-indigo-400" />
              <span>Estratto Conto</span>
            </button>
          )}

          <button
            onClick={onOpenAccountsModal}
            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-indigo-200/60 dark:border-indigo-800"
          >
            <span>Gestisci & Riconcilia</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Griglia dei KPI (Uniformata alle regole del Design System) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
        {/* KPI 1: Liquidità Totale */}
        <div className="bg-white dark:bg-[#242426] border border-slate-200/80 dark:border-white/5 shadow-sm rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Liquidità Totale</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
              <Wallet size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-[#F5F5F7] font-numeric tracking-tight">
              {formatCurrency(kpiStats.totalLiquidity)}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 mb-1.5">
              <span>{accounts.length + funds.length} strumenti attivi</span>
              <span className="font-numeric font-medium text-slate-600 dark:text-slate-300">100% patrimonio</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full transition-all duration-500" style={{ width: '100%' }} />
            </div>
          </div>
        </div>

        {/* KPI 2: Saldo Conti Correnti */}
        <div className="bg-white dark:bg-[#242426] border border-slate-200/80 dark:border-white/5 shadow-sm rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Saldo Conti Correnti</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
              <Landmark size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-[#F5F5F7] font-numeric tracking-tight">
              {formatCurrency(kpiStats.totalAccounts)}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 mb-1.5">
              <span>{accounts.length} {accounts.length === 1 ? 'conto registrato' : 'conti registrati'}</span>
              <span className="font-numeric font-medium text-indigo-600 dark:text-indigo-400">{kpiStats.accountsPct}% del totale</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${kpiStats.accountsPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* KPI 3: Saldo Fondi & Riserve */}
        <div className="bg-white dark:bg-[#242426] border border-slate-200/80 dark:border-white/5 shadow-sm rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Fondi & Riserve</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
              <Shield size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-[#F5F5F7] font-numeric tracking-tight">
              {formatCurrency(kpiStats.totalFunds)}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 mb-1.5">
              <span>{funds.length} {funds.length === 1 ? 'fondo destinato' : 'fondi destinati'}</span>
              <span className="font-numeric font-medium text-indigo-600 dark:text-indigo-400">{kpiStats.fundsPct}% del totale</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${kpiStats.fundsPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Barra di Controllo con Filtri Segmentati e Ricerca */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-1">
        {/* Contenitore segmentato inline-flex per Tab Filtri */}
        <div className="inline-flex p-1 bg-slate-100 dark:bg-[#242426] rounded-xl overflow-x-auto no-scrollbar font-medium gap-1">
          <button
            onClick={() => setFilterTab('ALL')}
            className={`px-3 py-1.5 transition-all whitespace-nowrap ${
              filterTab === 'ALL'
                ? 'bg-white dark:bg-[#1C1C1E] shadow-xs text-slate-900 dark:text-[#F5F5F7] text-xs rounded-lg font-semibold'
                : 'text-slate-500 dark:text-slate-400 text-xs rounded-lg hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Tutti ({allItems.length})
          </button>
          <button
            onClick={() => setFilterTab('ACCOUNTS')}
            className={`px-3 py-1.5 transition-all whitespace-nowrap ${
              filterTab === 'ACCOUNTS'
                ? 'bg-white dark:bg-[#1C1C1E] shadow-xs text-slate-900 dark:text-[#F5F5F7] text-xs rounded-lg font-semibold'
                : 'text-slate-500 dark:text-slate-400 text-xs rounded-lg hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Conti ({accounts.length})
          </button>
          <button
            onClick={() => setFilterTab('FUNDS')}
            className={`px-3 py-1.5 transition-all whitespace-nowrap ${
              filterTab === 'FUNDS'
                ? 'bg-white dark:bg-[#1C1C1E] shadow-xs text-slate-900 dark:text-[#F5F5F7] text-xs rounded-lg font-semibold'
                : 'text-slate-500 dark:text-slate-400 text-xs rounded-lg hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Fondi ({funds.length})
          </button>
          {diffCount > 0 && (
            <button
              onClick={() => setFilterTab('DIFF')}
              className={`px-3 py-1.5 transition-all whitespace-nowrap flex items-center gap-1.5 ${
                filterTab === 'DIFF'
                  ? 'bg-white dark:bg-[#1C1C1E] shadow-xs text-amber-700 dark:text-amber-400 text-xs rounded-lg font-semibold'
                  : 'text-amber-600 hover:text-amber-800 dark:text-amber-400 text-xs rounded-lg'
              }`}
            >
              <AlertTriangle size={12} />
              <span>Con Diff ({diffCount})</span>
            </button>
          )}

          {/* Toggle Includi Movimenti Programmati */}
          <button
            type="button"
            onClick={() => setIncludePlanned(!includePlanned)}
            className={`px-3 py-1.5 transition-all whitespace-nowrap flex items-center gap-1.5 text-xs rounded-lg ${
              includePlanned
                ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                : 'text-indigo-600 dark:text-indigo-400 hover:bg-white/80 dark:hover:bg-white/5'
            }`}
            title="Includi movimenti pianificati e programmati nel calcolo del saldo dei conti"
          >
            <Clock size={12} />
            <span>Includi Programmati</span>
            {totalPlannedCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                includePlanned ? 'bg-white text-indigo-700' : 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300'
              }`}>
                {totalPlannedCount} ({formatCurrency(totalPlannedNet, { showSign: true })})
              </span>
            )}
          </button>
        </div>

        {/* Input Ricerca con Icona Lente e Ordinamento */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Cerca tra conti e fondi..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-[#242426] border border-slate-200 dark:border-white/5 rounded-xl text-xs text-slate-900 dark:text-[#F5F5F7] placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 bg-white dark:bg-[#242426] border border-slate-200 dark:border-white/5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 outline-none hover:bg-slate-50 dark:hover:bg-[#2A2A2E] focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all cursor-pointer"
          >
            <option value="BALANCE_DESC">Saldo ↓</option>
            <option value="NAME_ASC">Nome A-Z</option>
            <option value="DIFF_DESC">Discrepanza</option>
          </select>
        </div>
      </div>

      {/* Griglia o Lista Compatta di Conti e Fondi */}
      {displayItems.length === 0 ? (
        <div className="py-8 text-center bg-slate-50/50 dark:bg-[#242426]/50 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 text-xs text-slate-400">
          Nessun conto o fondo trovato per i filtri selezionati.
        </div>
      ) : viewMode === 'EXPANDED' ? (
        /* VISTA ESPANSA CON EFFETTI GRAFICI (Liquidità %, Glow e Proiezioni) - CAROUSEL SU MOBILE E GRIGLIA SU DESKTOP */
        <Carousel
          id="accounts-funds-carousel"
          desktopGridClassName="sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1"
          showDots={displayItems.length <= 10}
          showArrows={true}
          showCounter={displayItems.length > 3}
          ariaLabel="Schede Conti e Fondi di Riserva"
        >
          {displayItems.map(item => {
            const hasDiff = item.differenza !== 0;
            const percentage = totaleOggiCalcolato > 0 
              ? Math.max(0, Math.min(100, Math.round((item.saldo_oggi / totaleOggiCalcolato) * 100))) 
              : 0;

            // Target per i fondi
            const hasTarget = !!item.target_importo && item.target_importo > 0;
            const targetPct = hasTarget 
              ? Math.min(100, Math.round((item.saldo_oggi / item.target_importo!) * 100))
              : null;

            return (
              <div
                key={item.conto_id}
                onClick={() => {
                  if (onSelectAccount) {
                    onSelectAccount(item);
                  } else {
                    onOpenAccountsModal();
                  }
                }}
                className={`group relative p-3 rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between ${
                  hasDiff
                    ? 'border-amber-300/80 bg-gradient-to-br from-white to-amber-50/20 dark:from-[#242426] dark:to-amber-950/20 shadow-xs hover:border-amber-400 hover:shadow-md'
                    : 'border-slate-200/80 dark:border-white/5 bg-white dark:bg-[#242426] hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-md'
                }`}
              >
                {/* Micro barra colorata di accent in testa */}
                <div 
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    item.is_fund ? 'bg-amber-400' : 'bg-indigo-500'
                  }`}
                  style={{ opacity: 0.85 }}
                />

                {/* Testa della card con Icona e Info */}
                <div>
                  <div className="flex items-start justify-between gap-1.5 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105">
                        {getItemIcon(item)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-[#F5F5F7] truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {item.nome_conto}
                        </h4>
                        <span className="text-[10px] text-slate-400 truncate block">
                          {item.is_fund ? 'Fondo Riserva' : (item.tipo_conto || 'Conto')}
                        </span>
                      </div>
                    </div>

                    {/* Badge Stato Riconciliazione & Tasto Modifica Rapida */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {hasDiff ? (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40 whitespace-nowrap">
                          {formatCurrency(item.differenza, { showSign: true })}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 flex items-center gap-0.5 whitespace-nowrap">
                          <CheckCircle2 size={10} />
                          <span className="hidden xl:inline">Allineato</span>
                        </span>
                      )}
                      {onOpenReconciliation && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenReconciliation(item.conto_id);
                          }}
                          title={`Riconcilia estratto conto per ${item.nome_conto}`}
                          className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-white/5 transition-colors"
                        >
                          <FileSpreadsheet size={11} />
                        </button>
                      )}
                      <span 
                        title="Gestisci, modifica o elimina conto"
                        className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-white/5 transition-colors"
                      >
                        <Pencil size={11} />
                      </span>
                    </div>
                  </div>

                  {/* Saldo Principale Oggi con Sparkline Trend e Fine Mese */}
                  <div className="my-1.5">
                    <div className="flex items-baseline justify-between gap-1.5 leading-tight">
                      <span className="text-[10px] text-slate-400 block truncate">
                        {includePlanned ? 'Saldo con Progr.' : 'Saldo Oggi'}
                      </span>
                      <span className="text-[9px] text-slate-400 block leading-tight flex-shrink-0 text-right">
                        Fine Mese
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between gap-1.5 mt-0.5">
                      <div className="flex items-baseline gap-1.5 min-w-0">
                        <span className="font-numeric text-base sm:text-[17px] font-extrabold text-slate-900 dark:text-[#F5F5F7] tracking-tight truncate">
                          {formatCurrency(getItemBalance(item))}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="font-numeric text-xs font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                          {formatCurrency(item.saldo_fine_mese)}
                        </span>
                      </div>
                    </div>

                    {/* Sparkline compatto */}
                    <div className="mt-1 flex items-center justify-between">
                      <InlineSparkline 
                        points={item.sparklinePoints}
                        data={item.trend} 
                        isFund={item.is_fund} 
                        width={60} 
                        height={18} 
                      />
                      {includePlanned && (
                        <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                          PROGR. INCLUSI
                        </span>
                      )}
                    </div>

                    {/* Pillola / Indicatore dei movimenti programmati pendenti */}
                    {item.conteggio_programmati !== undefined && item.conteggio_programmati > 0 && (
                      <div className="flex items-center justify-between gap-1 mt-1.5 pt-1 border-t border-slate-100 dark:border-white/5 text-[10px] font-numeric text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1 truncate">
                          <Clock size={10} className="text-indigo-500 shrink-0" />
                          <span>{item.conteggio_programmati} {item.conteggio_programmati === 1 ? 'progr.' : 'progr.'}:</span>
                        </span>
                        <span className={`font-bold shrink-0 ${(item.totale_programmati || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {formatCurrency(item.totale_programmati || 0, { showSign: true })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Barra Grafica: Quota di liquidità o Obiettivo Fondo */}
                <div className="pt-1.5 mt-1 border-t border-slate-100 dark:border-white/5 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-numeric">
                    {hasTarget ? (
                      <>
                        <span className="truncate">Target: {formatCurrency(item.target_importo!)}</span>
                        <span className="font-semibold text-amber-700 dark:text-amber-400 shrink-0">{targetPct}%</span>
                      </>
                    ) : (
                      <>
                        <span>Quota liquidità</span>
                        <span className="font-semibold text-slate-600 dark:text-slate-300 shrink-0">{percentage}%</span>
                      </>
                    )}
                  </div>

                  {/* Progress bar sottile h-1 bg-slate-100 con riempimento bg-indigo-600 */}
                  <div className="w-full h-1 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${hasTarget ? targetPct : percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </Carousel>
      ) : (
        /* VISTA COMPATTA (Ad alta densità per ospitare più elementi su schermo) - 4 CONTI PER RIGA */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-1">
          {displayItems.map(item => {
            const hasDiff = item.differenza !== 0;

            return (
              <div
                key={item.conto_id}
                onClick={() => {
                  if (onSelectAccount) {
                    onSelectAccount(item);
                  } else {
                    onOpenAccountsModal();
                  }
                }}
                className={`group flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                  hasDiff
                    ? 'border-amber-300 dark:border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/20 hover:bg-amber-50/60 dark:hover:bg-amber-950/30'
                    : 'border-slate-200/80 dark:border-white/5 bg-white dark:bg-[#242426] hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:bg-slate-50/50 dark:hover:bg-[#2A2A2E]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    item.is_fund ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400' : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
                  }`}>
                    {getItemIcon(item)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 dark:text-[#F5F5F7] truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      {item.nome_conto}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      {item.is_fund ? 'Fondo' : (item.tipo_conto || 'Conto')}
                      {hasDiff && (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold ml-1">
                          (Diff: {formatCurrency(item.differenza, { showSign: true })})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 text-right flex-shrink-0">
                  <InlineSparkline 
                    points={item.sparklinePoints}
                    data={item.trend} 
                    isFund={item.is_fund} 
                    width={56} 
                    height={20} 
                  />
                  <div>
                    <span className="font-numeric text-xs font-extrabold text-slate-900 dark:text-[#F5F5F7] block">
                      {formatCurrency(getItemBalance(item))}
                    </span>
                    <span className="text-[10px] font-numeric text-indigo-600 dark:text-indigo-400 block">
                      {formatCurrency(item.saldo_fine_mese)}
                    </span>
                    {item.conteggio_programmati !== undefined && item.conteggio_programmati > 0 && !includePlanned && (
                      <span className="text-[9px] font-numeric text-slate-400 block" title="Totale movimenti programmati pendenti">
                        Prog: {formatCurrency(item.totale_programmati || 0, { showSign: true })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Espandi / Riduci per liste lunghe con più di 20 fondi */}
      {shouldLimit && (
        <div className="pt-2 flex justify-center">
          <button
            onClick={() => setIsExpanded(true)}
            className="px-4 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
          >
            <span>Mostra tutti i {filteredItems.length} conti e fondi</span>
            <ChevronDown size={14} />
          </button>
        </div>
      )}

      {isExpanded && filteredItems.length > 6 && (
        <div className="pt-2 flex justify-center">
          <button
            onClick={() => setIsExpanded(false)}
            className="px-4 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
          >
            <span>Riduci visualizzazione</span>
            <ChevronUp size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
