import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { AccountForecast, Movement, Planned, Subcategory, Account, Fund, MovementType } from '../types';
import { formatCurrency, formatItalianNumber } from '../utils/formatters';
import { haptics } from '../utils/haptics';
import {
  X,
  Landmark,
  CreditCard,
  Banknote,
  Wallet,
  Shield,
  Clock,
  Search,
  Plus,
  FileSpreadsheet,
  Pencil,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Sparkles
} from 'lucide-react';

interface AccountDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: AccountForecast | null;
  allAccounts: (Account | Fund | AccountForecast)[];
  movements: Movement[];
  planned?: Planned[];
  subcategories: Subcategory[];
  onSelectMovement?: (movement: Movement) => void;
  onOpenNewTransactionForAccount?: (accountId: string) => void;
  onOpenReconciliation?: (accountId: string) => void;
  onOpenBalanceCorrection?: (accountId: string) => void;
  onEditAccount?: (accountId: string) => void;
}

interface UnifiedMovementRow {
  id: string;
  data: string; // YYYY-MM-DD
  descrizione: string;
  importo: number; // Valore assoluto
  segno: '+' | '-';
  direzione: 'ENTRATA' | 'USCITA';
  tipologia: MovementType;
  sottocategoriaNome: string;
  categoriaPadre: string;
  colore: string;
  tag?: string;
  isProgrammato: boolean;
  isGiroconto: boolean;
  controparteNome?: string;
  note?: string;
  rawMovement?: Movement;
  rawPlanned?: Planned;
}

interface MonthGroup {
  key: string; // "YYYY-MM"
  year: number;
  month: number;
  monthName: string; // "Settembre 2026"
  rows: UnifiedMovementRow[];
  totaleEntrate: number;
  totaleUscite: number;
  saldoNetto: number;
  conteggio: number;
}

export const AccountDetailModal: React.FC<AccountDetailModalProps> = ({
  isOpen,
  onClose,
  account,
  allAccounts,
  movements,
  planned = [],
  subcategories,
  onSelectMovement,
  onOpenNewTransactionForAccount,
  onOpenReconciliation,
  onOpenBalanceCorrection,
  onEditAccount
}) => {
  // Toggle con un solo click se includere quelle programmate o meno
  const [includePlanned, setIncludePlanned] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'ENTRATA' | 'USCITA' | 'GIROCONTO'>('ALL');
  const [copiedIban, setCopiedIban] = useState<boolean>(false);
  // Supporto Fullscreen su Desktop
  const [isFullscreen, setIsFullscreen] = useState<boolean>(true);

  // Carousel mini tab KPI (2 alla volta su mobile)
  const kpiCarouselRef = useRef<HTMLDivElement>(null);
  const [kpiActiveSlide, setKpiActiveSlide] = useState<number>(0);

  const handleKpiScroll = useCallback(() => {
    const container = kpiCarouselRef.current;
    if (!container) return;
    const slideWidth = container.clientWidth || 1;
    const slideIndex = Math.round(container.scrollLeft / slideWidth);
    if (slideIndex !== kpiActiveSlide && (slideIndex === 0 || slideIndex === 1)) {
      setKpiActiveSlide(slideIndex);
    }
  }, [kpiActiveSlide]);

  const scrollKpiToSlide = (index: number) => {
    const container = kpiCarouselRef.current;
    if (!container) return;
    container.scrollTo({
      left: index * container.clientWidth,
      behavior: 'smooth'
    });
    haptics.tap();
    setKpiActiveSlide(index);
  };

  // Ascolta il tasto Esc per chiudere
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Set di identificatori associati a questo conto/fondo
  const targetIds = useMemo(() => {
    const set = new Set<string>();
    if (!account) return set;
    if (account.conto_id) set.add(account.conto_id);
    if (account.id) set.add(account.id);
    if ((account as any).human_id) set.add((account as any).human_id);
    if ((account as any).fondo_id) set.add((account as any).fondo_id);
    return set;
  }, [account]);

  // Mappa sottocategorie
  const subcategoryMap = useMemo(() => {
    const map = new Map<string, Subcategory>();
    subcategories.forEach(s => {
      map.set(s.id, s);
      map.set(s.sottocategoria_id, s);
    });
    return map;
  }, [subcategories]);

  // Helper per nome conto controparte
  const getAccountName = (id?: string | null): string => {
    if (!id) return '';
    const found = allAccounts.find((a: any) => 
      a.id === id || a.conto_id === id || a.fondo_id === id || a.human_id === id
    );
    if (found) {
      return (found as any).nome_conto || (found as any).nome_fondo || '';
    }
    return id;
  };

  // Normalizza tutti i movimenti reali di questo conto
  const realRows: UnifiedMovementRow[] = useMemo(() => {
    const result: UnifiedMovementRow[] = [];
    for (const m of movements) {
      if ((m as any).is_deleted) continue;

      const isOrigine = targetIds.has(m.conto_origine);
      const isDest = m.conto_destinazione ? targetIds.has(m.conto_destinazione) : false;

      if (!isOrigine && !isDest) continue;

      const sub = subcategoryMap.get(m.sottocategoria_id);
      const sottocategoriaNome = sub?.nome || 'Generale';
      const categoriaPadre = sub?.categoria_padre || (m.tipologia === 'ENTRATA' ? 'Entrate' : 'Uscite');
      const colore = sub?.colore || '#8E8E93';

      let direzione: 'ENTRATA' | 'USCITA' = 'USCITA';
      let segno: '+' | '-' = '-';
      let controparteNome: string | undefined;

      if (m.tipologia === 'GIROCONTO') {
        if (isOrigine && !isDest) {
          direzione = 'USCITA';
          segno = '-';
          controparteNome = getAccountName(m.conto_destinazione);
        } else if (isDest && !isOrigine) {
          direzione = 'ENTRATA';
          segno = '+';
          controparteNome = getAccountName(m.conto_origine);
        } else {
          direzione = 'USCITA';
          segno = '-';
        }
      } else if (m.tipologia === 'ENTRATA') {
        direzione = 'ENTRATA';
        segno = '+';
      } else {
        direzione = 'USCITA';
        segno = '-';
      }

      result.push({
        id: m.id || m.movimento_id,
        data: m.data,
        descrizione: m.descrizione || 'Senza descrizione',
        importo: Math.abs(m.importo),
        segno,
        direzione,
        tipologia: m.tipologia,
        sottocategoriaNome,
        categoriaPadre,
        colore,
        tag: m.tag || (m.tags && m.tags[0]) || undefined,
        isProgrammato: false,
        isGiroconto: m.tipologia === 'GIROCONTO',
        controparteNome,
        note: m.note,
        rawMovement: m
      });
    }
    return result;
  }, [movements, targetIds, subcategoryMap, allAccounts]);

  // Normalizza i movimenti programmati di questo conto
  const plannedRows: UnifiedMovementRow[] = useMemo(() => {
    const result: UnifiedMovementRow[] = [];
    for (const p of planned) {
      if ((p as any).is_deleted) continue;
      if (p.stato === 'ANNULLATO') continue;
      if (!p.conto_id || !targetIds.has(p.conto_id)) continue;

      const sub = subcategoryMap.get(p.sottocategoria_id);
      const sottocategoriaNome = sub?.nome || 'Programmato';
      const categoriaPadre = sub?.categoria_padre || (p.tipologia === 'ENTRATA' ? 'Entrate Programmate' : 'Uscite Programmate');
      const colore = sub?.colore || '#f59e0b';

      const direzione: 'ENTRATA' | 'USCITA' = p.tipologia === 'ENTRATA' ? 'ENTRATA' : 'USCITA';
      const segno: '+' | '-' = p.tipologia === 'ENTRATA' ? '+' : '-';

      result.push({
        id: `prog-${p.id || p.pianificato_id}`,
        data: p.data_prevista,
        descrizione: p.descrizione || 'Movimento Programmato',
        importo: Math.abs(p.importo),
        segno,
        direzione,
        tipologia: p.tipologia,
        sottocategoriaNome,
        categoriaPadre,
        colore,
        isProgrammato: true,
        isGiroconto: p.tipologia === 'GIROCONTO',
        note: p.note,
        rawPlanned: p
      });
    }
    return result;
  }, [planned, targetIds, subcategoryMap]);

  // Conteggio dei programmati pendenti
  const totalPlannedCount = plannedRows.length;

  // Unione in base al toggle "Includi programmate"
  const allRows = useMemo(() => {
    if (includePlanned) {
      return [...realRows, ...plannedRows];
    }
    return realRows;
  }, [includePlanned, realRows, plannedRows]);

  // Filtraggio per ricerca e tipologia
  const filteredRows = useMemo(() => {
    return allRows.filter(row => {
      // Filtro tipologia
      if (typeFilter === 'ENTRATA' && row.direzione !== 'ENTRATA') return false;
      if (typeFilter === 'USCITA' && row.direzione !== 'USCITA') return false;
      if (typeFilter === 'GIROCONTO' && !row.isGiroconto) return false;

      // Filtro ricerca testuale
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchDesc = row.descrizione.toLowerCase().includes(q);
        const matchSub = row.sottocategoriaNome.toLowerCase().includes(q);
        const matchCat = row.categoriaPadre.toLowerCase().includes(q);
        const matchTag = row.tag ? row.tag.toLowerCase().includes(q) : false;
        const matchNotes = row.note ? row.note.toLowerCase().includes(q) : false;
        const matchContro = row.controparteNome ? row.controparteNome.toLowerCase().includes(q) : false;
        const matchImporto = row.importo.toString().includes(q) || formatItalianNumber(row.importo).includes(q);
        if (!matchDesc && !matchSub && !matchCat && !matchTag && !matchNotes && !matchContro && !matchImporto) {
          return false;
        }
      }

      return true;
    });
  }, [allRows, typeFilter, searchQuery]);

  // RAGGRUPPAMENTO PER MESE (dal più recente al meno recente)
  // e all'interno del mese i movimenti dal più recente al meno recente
  const monthGroups: MonthGroup[] = useMemo(() => {
    const groupsMap = new Map<string, UnifiedMovementRow[]>();

    for (const row of filteredRows) {
      const parts = row.data.split('-');
      const y = parts[0] || '2026';
      const m = parts[1] || '01';
      const key = `${y}-${m}`;

      if (!groupsMap.has(key)) {
        groupsMap.set(key, []);
      }
      groupsMap.get(key)!.push(row);
    }

    // Ordina i gruppi mese in ordine strettamente decrescente (da più recente a meno recente)
    const sortedKeys = Array.from(groupsMap.keys()).sort((a, b) => b.localeCompare(a));

    return sortedKeys.map(key => {
      const [yearStr, monthStr] = key.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      // Data fittizia per formattare il nome esteso del mese in italiano (es. "Settembre 2026")
      const dateObj = new Date(year, month - 1, 1);
      const rawMonthName = dateObj.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
      const monthName = rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);

      // Ordina i movimenti all'interno del mese in modo decrescente (dal giorno più recente al meno recente)
      const rows = groupsMap.get(key) || [];
      rows.sort((a, b) => {
        const dateDiff = b.data.localeCompare(a.data);
        if (dateDiff !== 0) return dateDiff;
        return b.id.localeCompare(a.id);
      });

      // Calcolo totali del mese
      let totaleEntrate = 0;
      let totaleUscite = 0;
      for (const r of rows) {
        if (r.direzione === 'ENTRATA') {
          totaleEntrate += r.importo;
        } else {
          totaleUscite += r.importo;
        }
      }
      totaleEntrate = Math.round(totaleEntrate * 100) / 100;
      totaleUscite = Math.round(totaleUscite * 100) / 100;
      const saldoNetto = Math.round((totaleEntrate - totaleUscite) * 100) / 100;

      return {
        key,
        year,
        month,
        monthName,
        rows,
        totaleEntrate,
        totaleUscite,
        saldoNetto,
        conteggio: rows.length
      };
    });
  }, [filteredRows]);

  // Statistiche totali del conto
  const summaryStats = useMemo(() => {
    let entrate = 0;
    let uscite = 0;
    for (const r of allRows) {
      if (r.direzione === 'ENTRATA') entrate += r.importo;
      else uscite += r.importo;
    }
    entrate = Math.round(entrate * 100) / 100;
    uscite = Math.round(uscite * 100) / 100;
    const netto = Math.round((entrate - uscite) * 100) / 100;

    return {
      totaleEntrate: entrate,
      totaleUscite: uscite,
      saldoNetto: netto,
      conteggioTotale: allRows.length,
      conteggioReali: realRows.length,
      conteggioProgrammati: plannedRows.length
    };
  }, [allRows, realRows, plannedRows]);

  // Se la finestra non è aperta o manca il conto, non renderizzare la UI
  if (!isOpen || !account) return null;

  // Icona conto
  const getAccountIcon = () => {
    if (account.is_fund) {
      return <Shield size={22} className="text-amber-500" strokeWidth={2} />;
    }
    if (account.tipo_conto === 'CONTANTI') {
      return <Banknote size={22} className="text-emerald-500" strokeWidth={2} />;
    }
    if (account.tipo_conto === 'CARTA_DEBITO' || account.tipo_conto === 'CARTA_CREDITO') {
      return <CreditCard size={22} className="text-sky-500" strokeWidth={2} />;
    }
    return <Landmark size={22} className="text-indigo-400" strokeWidth={2} />;
  };

  // Etichetta tipologia conto
  const getAccountTypeLabel = () => {
    if (account.is_fund) return 'Fondo di Riserva';
    switch (account.tipo_conto) {
      case 'BANCA': return 'Conto Corrente Bancario';
      case 'CARTA_DEBITO': return 'Carta di Debito';
      case 'CARTA_CREDITO': return 'Carta di Credito';
      case 'CONTANTI': return 'Contanti / Portafoglio';
      case 'CONTO_DEPOSITO': return 'Conto Deposito';
      default: return 'Conto Finanziario';
    }
  };

  // Copia IBAN / Note se presente
  const handleCopyIban = () => {
    if (account.note) {
      navigator.clipboard.writeText(account.note);
      setCopiedIban(true);
      haptics.success();
      setTimeout(() => setCopiedIban(false), 2000);
    }
  };

  // Formatta data standard italiano DD/MM/YYYY
  const formatDateDDMMYYYY = (dStr: string) => {
    const parts = dStr.split('-');
    if (parts.length === 3) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
    return dStr;
  };

  const hasDiff = account.differenza !== 0;
  const saldoVisualizzato = includePlanned && account.saldo_con_programmati !== undefined
    ? account.saldo_con_programmati
    : account.saldo_oggi;

  // Render per i 4 blocchi KPI / mini Tab del conto (riutilizzabili tra desktop e mobile carousel)
  const renderSaldoCard = () => (
    <div className="bg-white dark:bg-[#1C1C1E] p-2.5 sm:p-3.5 rounded-[14px] sm:rounded-[18px] border border-slate-200/80 dark:border-white/5 flex flex-col justify-between shadow-xs min-w-0 h-full">
      <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-[#8E8E93] truncate">
        {includePlanned ? 'Saldo c/ Prog.' : 'Saldo Odierno'}
      </span>
      <div className="font-numeric text-base sm:text-2xl font-bold text-slate-900 dark:text-[#F5F5F7] tracking-tight my-0.5 sm:my-1 truncate" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatCurrency(saldoVisualizzato)}
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        {hasDiff ? (
          <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-0.5 truncate">
            <AlertTriangle size={9} className="shrink-0" />
            <span className="truncate">Diff: {formatCurrency(account.differenza, { showSign: true })}</span>
          </span>
        ) : (
          <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-0.5 truncate">
            <CheckCircle2 size={9} className="shrink-0" />
            <span className="truncate">Allineato</span>
          </span>
        )}
        <span className="hidden lg:inline text-[10px] text-slate-500 dark:text-[#8E8E93]">
          Reale: {formatCurrency(account.saldo_reale)}
        </span>
      </div>
    </div>
  );

  const renderEntrateCard = () => (
    <div className="bg-white dark:bg-[#1C1C1E] p-2.5 sm:p-3.5 rounded-[14px] sm:rounded-[18px] border border-slate-200/80 dark:border-white/5 flex flex-col justify-between shadow-xs min-w-0 h-full">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-[#8E8E93] truncate">Totale Entrate</span>
        <ArrowDownRight size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
      </div>
      <div className="font-numeric text-base sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight my-0.5 sm:my-1 truncate" style={{ fontVariantNumeric: 'tabular-nums' }}>
        +{formatCurrency(summaryStats.totaleEntrate, { hideSymbol: false })}
      </div>
      <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-[#8E8E93] truncate">
        {summaryStats.conteggioTotale} transazioni
      </span>
    </div>
  );

  const renderUsciteCard = () => (
    <div className="bg-white dark:bg-[#1C1C1E] p-2.5 sm:p-3.5 rounded-[14px] sm:rounded-[18px] border border-slate-200/80 dark:border-white/5 flex flex-col justify-between shadow-xs min-w-0 h-full">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-[#8E8E93] truncate">Totale Uscite</span>
        <ArrowUpRight size={13} className="text-rose-600 dark:text-rose-400 shrink-0" />
      </div>
      <div className="font-numeric text-base sm:text-xl font-bold text-rose-600 dark:text-rose-400 tracking-tight my-0.5 sm:my-1 truncate" style={{ fontVariantNumeric: 'tabular-nums' }}>
        -{formatCurrency(summaryStats.totaleUscite, { hideSymbol: false })}
      </div>
      <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-[#8E8E93] truncate">
        Netto: <strong className="font-numeric text-slate-900 dark:text-[#F5F5F7]">{formatCurrency(summaryStats.saldoNetto, { showSign: true })}</strong>
      </span>
    </div>
  );

  const renderProgrammatiCard = () => (
    <div className="bg-white dark:bg-[#1C1C1E] p-2.5 sm:p-3.5 rounded-[14px] sm:rounded-[18px] border border-slate-200/80 dark:border-white/5 flex flex-col justify-between shadow-xs min-w-0 h-full">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-[#8E8E93] truncate">Programmati</span>
        <Clock size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
      </div>
      <div className="font-numeric text-base sm:text-xl font-bold text-amber-600 dark:text-amber-400 tracking-tight my-0.5 sm:my-1 truncate" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {totalPlannedCount} {totalPlannedCount === 1 ? 'operaz.' : 'operaz.'}
      </div>
      <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-[#8E8E93] truncate">
        Impatto: {formatCurrency(account.totale_programmati || 0, { showSign: true })}
      </span>
    </div>
  );

  return (
    <div 
      id="account-detail-modal-backdrop"
      className={`fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center ${
        isFullscreen ? 'p-0' : 'p-2 sm:p-4 md:p-6'
      } overflow-y-auto animate-in fade-in duration-200`}
      onClick={onClose}
    >
      <div
        id="account-detail-modal-container"
        className={`bg-white dark:bg-[#1C1C1E] text-slate-900 dark:text-[#F5F5F7] border border-slate-200/90 dark:border-white/10 flex flex-col overflow-hidden transition-all duration-200 ${
          isFullscreen 
            ? 'w-full h-full max-w-none max-h-none rounded-none border-0' 
            : 'w-full max-w-5xl max-h-[92vh] rounded-[26px] shadow-2xl my-auto active:scale-[0.999]'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* VIEWING AREA (Testata One UI compatta su smartphone) */}
        <div className="p-3.5 sm:p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/90 dark:bg-[#242426]/60 relative flex-shrink-0">
          <div className="flex items-start justify-between gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
              {/* Micro-squircle Icona Conto */}
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-[12px] sm:rounded-[14px] bg-slate-100 dark:bg-[#2A2A2E] flex items-center justify-center flex-shrink-0 shadow-xs dark:shadow-inner border border-slate-200/80 dark:border-white/5">
                {getAccountIcon()}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <h2 className="text-base sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-[#F5F5F7] truncate">
                    {account.nome_conto}
                  </h2>
                  {account.conto_principale && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <Star size={9} className="fill-amber-500 dark:fill-amber-400 text-amber-500 dark:text-amber-400" />
                      <span>Principale</span>
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium bg-slate-200/60 dark:bg-white/5 text-slate-600 dark:text-[#8E8E93] border border-slate-200/80 dark:border-white/10">
                    {getAccountTypeLabel()}
                  </span>
                </div>
                <p className="hidden sm:block text-xs sm:text-sm text-slate-500 dark:text-[#8E8E93] mt-0.5">
                  Scheda informativa e registro dettagliato delle transazioni
                </p>
              </div>
            </div>

            {/* Pulsanti Rapidi & Chiusura */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {onOpenNewTransactionForAccount && (
                <button
                  type="button"
                  id="btn-account-new-transaction"
                  onClick={() => {
                    haptics.tap();
                    onOpenNewTransactionForAccount(account.id || account.conto_id);
                  }}
                  className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-[#E31B23] hover:bg-[#c9151c] text-white transition-all active:scale-95 shadow-md shadow-red-950/20 dark:shadow-red-950/40 cursor-pointer"
                  title="Aggiungi movimento per questo conto"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  <span>Nuovo Movimento</span>
                </button>
              )}

              {onOpenBalanceCorrection && (
                <button
                  type="button"
                  id="btn-account-balance-correct"
                  onClick={() => {
                    haptics.tap();
                    onOpenBalanceCorrection(account.id || account.conto_id);
                  }}
                  className="p-1.5 sm:px-3 sm:py-2 rounded-full text-xs font-semibold bg-[#E31B23]/10 hover:bg-[#E31B23]/20 text-[#E31B23] border border-[#E31B23]/30 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  title="Correggi e allinea saldo con estratto conto banca (genera rettifica)"
                >
                  <Sparkles size={14} />
                  <span className="hidden md:inline">Correggi Saldo</span>
                </button>
              )}

              {onOpenReconciliation && (
                <button
                  type="button"
                  id="btn-account-reconcile"
                  onClick={() => {
                    haptics.tap();
                    onOpenReconciliation(account.id || account.conto_id);
                  }}
                  className="p-1.5 sm:px-3 sm:py-2 rounded-full text-xs font-medium bg-slate-100 hover:bg-slate-200/80 dark:bg-[#2A2A2E] dark:hover:bg-[#343438] text-slate-700 dark:text-[#F5F5F7] border border-slate-200/80 dark:border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  title="Riconcilia estratto conto bancario"
                >
                  <FileSpreadsheet size={15} className="text-indigo-600 dark:text-indigo-400" />
                  <span className="hidden md:inline">Riconcilia</span>
                </button>
              )}

              {onEditAccount && (
                <button
                  type="button"
                  id="btn-account-edit"
                  onClick={() => {
                    haptics.tap();
                    onEditAccount(account.id || account.conto_id);
                  }}
                  className="p-1.5 sm:px-3 sm:py-2 rounded-full text-xs font-medium bg-slate-100 hover:bg-slate-200/80 dark:bg-[#2A2A2E] dark:hover:bg-[#343438] text-slate-700 dark:text-[#F5F5F7] border border-slate-200/80 dark:border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  title="Modifica impostazioni conto"
                >
                  <Pencil size={14} className="text-amber-600 dark:text-amber-400" />
                  <span className="hidden md:inline">Modifica</span>
                </button>
              )}

              {/* Pulsante Fullscreen / Riduci su Desktop */}
              <button
                type="button"
                id="btn-account-modal-fullscreen"
                onClick={() => {
                  haptics.tap();
                  setIsFullscreen(prev => !prev);
                }}
                className="hidden sm:flex w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-[#2A2A2E] dark:hover:bg-[#343438] text-slate-500 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7] items-center justify-center transition-colors border border-slate-200/80 dark:border-white/10 cursor-pointer shadow-xs"
                title={isFullscreen ? 'Riduci a finestra' : 'Schermo intero su desktop (Fullscreen)'}
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>

              <button
                type="button"
                id="btn-account-modal-close"
                onClick={() => {
                  haptics.tap();
                  onClose();
                }}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-[#2A2A2E] dark:hover:bg-[#343438] text-slate-500 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7] flex items-center justify-center transition-colors border border-slate-200/80 dark:border-white/10 cursor-pointer shadow-xs"
                title="Chiudi finestra (Esc)"
              >
                <X size={16} className="sm:w-[18px] sm:h-[18px]" />
              </button>
            </div>
          </div>

          {/* CAROUSEL MINI TAB SMARTPHONE: Due alla volta */}
          <div className="block sm:hidden mt-2.5 relative">
            <div
              ref={kpiCarouselRef}
              onScroll={handleKpiScroll}
              className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth gap-2 pb-0.5"
              style={{
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              {/* Slide 1 (Due mini-tab: Saldo & Entrate) */}
              <div className="w-full shrink-0 snap-center grid grid-cols-2 gap-2">
                {renderSaldoCard()}
                {renderEntrateCard()}
              </div>

              {/* Slide 2 (Due mini-tab: Uscite & Programmati) */}
              <div className="w-full shrink-0 snap-center grid grid-cols-2 gap-2">
                {renderUsciteCard()}
                {renderProgrammatiCard()}
              </div>
            </div>

            {/* Indicatori Dots & Frecce del Carousel (Due alla volta) */}
            <div className="flex items-center justify-between mt-1 px-0.5">
              <button
                type="button"
                onClick={() => scrollKpiToSlide(0)}
                disabled={kpiActiveSlide === 0}
                aria-label="Scheda precedente"
                className={`p-1 rounded-full transition-all cursor-pointer ${
                  kpiActiveSlide === 0
                    ? 'text-slate-300 dark:text-slate-700 opacity-40 cursor-not-allowed'
                    : 'text-slate-600 dark:text-[#8E8E93] hover:text-[#E31B23]'
                }`}
              >
                <ChevronLeft size={14} />
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => scrollKpiToSlide(0)}
                  aria-label="Slide 1: Saldo ed Entrate"
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    kpiActiveSlide === 0
                      ? 'w-5 bg-[#E31B23] shadow-xs'
                      : 'w-1.5 bg-slate-300 dark:bg-slate-700'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => scrollKpiToSlide(1)}
                  aria-label="Slide 2: Uscite e Programmati"
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    kpiActiveSlide === 1
                      ? 'w-5 bg-[#E31B23] shadow-xs'
                      : 'w-1.5 bg-slate-300 dark:bg-slate-700'
                  }`}
                />
                <span className="text-[10px] font-medium text-slate-400 dark:text-[#8E8E93] ml-1">
                  {kpiActiveSlide === 0 ? '1/2 Saldi' : '2/2 Flussi'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => scrollKpiToSlide(1)}
                disabled={kpiActiveSlide === 1}
                aria-label="Scheda successiva"
                className={`p-1 rounded-full transition-all cursor-pointer ${
                  kpiActiveSlide === 1
                    ? 'text-slate-300 dark:text-slate-700 opacity-40 cursor-not-allowed'
                    : 'text-slate-600 dark:text-[#8E8E93] hover:text-[#E31B23]'
                }`}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* VISTA DESKTOP / TABLET: Griglia standard a 4 colonne */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-5">
            {renderSaldoCard()}
            {renderEntrateCard()}
            {renderUsciteCard()}
            {renderProgrammatiCard()}
          </div>

          {/* Dettaglio IBAN o Note aggiuntive (se compilati) */}
          {account.note && account.note.trim() !== '' && (
            <div className="mt-2 sm:mt-3 p-2 sm:p-2.5 rounded-xl sm:rounded-[14px] bg-slate-100/90 dark:bg-[#1C1C1E]/80 border border-slate-200/80 dark:border-white/5 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Landmark size={13} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                <span className="text-slate-500 dark:text-[#8E8E93] flex-shrink-0 font-medium text-[11px] sm:text-xs">Coordinate / Note:</span>
                <span className="text-slate-900 dark:text-[#F5F5F7] font-mono truncate text-[11px] sm:text-xs">{account.note}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyIban}
                className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] font-medium bg-white dark:bg-[#2A2A2E] hover:bg-slate-50 dark:hover:bg-[#343438] text-slate-700 dark:text-[#F5F5F7] border border-slate-200 dark:border-white/10 flex items-center gap-1 transition-colors flex-shrink-0 cursor-pointer shadow-xs"
                title="Copia negli appunti"
              >
                {copiedIban ? (
                  <>
                    <Check size={11} className="text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copiato</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} />
                    <span>Copia</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* INTERACTION AREA: Barra Filtri, Ricerca e Toggle con 1 Click per le Programmate */}
        <div className="p-2.5 sm:p-5 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-[#1C1C1E] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 sm:gap-3 flex-shrink-0">
          {/* Selettore filtri tipologia a pillola */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto pb-0.5 md:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                setTypeFilter('ALL');
              }}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                typeFilter === 'ALL'
                  ? 'bg-slate-900 text-white dark:bg-white/15 dark:text-[#F5F5F7] border border-transparent dark:border-white/20 shadow-xs'
                  : 'bg-transparent text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7] hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              Tutti ({allRows.length})
            </button>
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                setTypeFilter('ENTRATA');
              }}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                typeFilter === 'ENTRATA'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                  : 'bg-transparent text-slate-600 dark:text-[#8E8E93] hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-white/5'
              }`}
            >
              <ArrowDownRight size={12} />
              <span>Entrate</span>
            </button>
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                setTypeFilter('USCITA');
              }}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                typeFilter === 'USCITA'
                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                  : 'bg-transparent text-slate-600 dark:text-[#8E8E93] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-white/5'
              }`}
            >
              <ArrowUpRight size={12} />
              <span>Uscite</span>
            </button>
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                setTypeFilter('GIROCONTO');
              }}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                typeFilter === 'GIROCONTO'
                  ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                  : 'bg-transparent text-slate-600 dark:text-[#8E8E93] hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-white/5'
              }`}
            >
              <ArrowLeftRight size={12} />
              <span>Giroconti</span>
            </button>
          </div>

          {/* Ricerca e TOGGLE CON UN CLICK PER LE PROGRAMMATE */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Input Ricerca */}
            <div className="relative flex-1 sm:w-60 min-w-[140px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#8E8E93]" />
              <input
                type="text"
                placeholder="Cerca nei movimenti..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1 sm:py-1.5 bg-white dark:bg-[#242426] border border-slate-200 dark:border-white/5 rounded-full text-xs text-slate-900 dark:text-[#F5F5F7] placeholder:text-slate-400 dark:placeholder:text-[#8E8E93] outline-none focus:border-[#E31B23] focus:ring-1 focus:ring-[#E31B23] transition-all shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7]"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* TOGGLE CON UN SOLO CLICK PER INCLUDERE LE PROGRAMMATE (Stile Samsung One UI) */}
            <button
              type="button"
              id="btn-toggle-include-planned"
              onClick={() => {
                haptics.tap();
                setIncludePlanned(!includePlanned);
              }}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all flex items-center gap-1.5 sm:gap-2 flex-shrink-0 cursor-pointer border ${
                includePlanned
                  ? 'bg-[#E31B23]/10 dark:bg-[#E31B23]/15 text-slate-900 dark:text-[#F5F5F7] border-[#E31B23]/40 dark:border-[#E31B23]/50 shadow-xs'
                  : 'bg-white dark:bg-[#242426] text-slate-600 dark:text-[#8E8E93] border-slate-200 dark:border-white/5 hover:text-slate-900 dark:hover:text-[#F5F5F7] hover:bg-slate-50 dark:hover:bg-[#2A2A2E] shadow-xs'
              }`}
              title={includePlanned ? 'Clicca per escludere i movimenti programmati' : 'Clicca con 1 click per includere i movimenti programmati'}
            >
              <Clock size={12} className={includePlanned ? 'text-[#E31B23]' : 'text-slate-400 dark:text-[#8E8E93]'} />
              <span>Programmate</span>
              {totalPlannedCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  includePlanned ? 'bg-[#E31B23] text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-[#8E8E93]'
                }`}>
                  {totalPlannedCount}
                </span>
              )}
              {/* Switch pillola visivo */}
              <div className={`w-7 sm:w-8 h-3.5 sm:h-4 rounded-full p-0.5 transition-colors relative flex items-center ${
                includePlanned ? 'bg-[#E31B23]' : 'bg-slate-200 dark:bg-white/20'
              }`}>
                <div className={`w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-white shadow-xs transition-transform ${
                  includePlanned ? 'translate-x-3.5 sm:translate-x-4' : 'translate-x-0'
                }`} />
              </div>
            </button>
          </div>
        </div>

        {/* CORPO MODALE: Elenco Movimenti Raggruppati per Mese (da più recente a meno recente) */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-6 space-y-3 sm:space-y-6">
          {monthGroups.length === 0 ? (
            <div className="py-16 text-center bg-slate-50/60 dark:bg-[#242426]/40 rounded-[22px] border border-dashed border-slate-200 dark:border-white/10">
              <Layers size={36} className="mx-auto text-slate-400 dark:text-[#8E8E93] opacity-40 mb-3" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F7]">Nessun movimento trovato per questo conto</h3>
              <p className="text-xs text-slate-500 dark:text-[#8E8E93] mt-1 max-w-sm mx-auto">
                {searchQuery || typeFilter !== 'ALL'
                  ? 'Nessuna transazione corrisponde ai filtri impostati.'
                  : 'Non ci sono movimenti registrati o programmati collegati a questo conto.'}
              </p>
              {onOpenNewTransactionForAccount && (
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    onOpenNewTransactionForAccount(account.id || account.conto_id);
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[#E31B23] text-white hover:bg-[#c9151c] transition-all cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Aggiungi Prima Transazione</span>
                </button>
              )}
            </div>
          ) : (
            monthGroups.map(group => (
              <div 
                key={group.key} 
                className="bg-white dark:bg-[#242426]/50 rounded-[22px] border border-slate-200/80 dark:border-white/5 overflow-hidden shadow-xs"
              >
                {/* Intestazione Gruppo Mese One UI */}
                <div className="px-4 py-3 bg-slate-50 dark:bg-[#242426] border-b border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar size={15} className="text-slate-500 dark:text-[#8E8E93]" />
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#F5F5F7]">
                      {group.monthName}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200/60 dark:bg-white/5 text-slate-600 dark:text-[#8E8E93] border border-slate-200/70 dark:border-white/5">
                      {group.conteggio} {group.conteggio === 1 ? 'movimento' : 'movimenti'}
                    </span>
                  </div>

                  {/* Badge Riassuntivi Mese */}
                  <div className="flex items-center gap-2 text-xs flex-wrap font-numeric" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      +{formatCurrency(group.totaleEntrate, { hideSymbol: false })}
                    </span>
                    <span className="text-slate-400 dark:text-[#8E8E93] text-[10px]">•</span>
                    <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                      -{formatCurrency(group.totaleUscite, { hideSymbol: false })}
                    </span>
                    <span className="text-slate-400 dark:text-[#8E8E93] text-[10px]">•</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      group.saldoNetto >= 0
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                        : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                    }`}>
                      Netto: {formatCurrency(group.saldoNetto, { showSign: true })}
                    </span>
                  </div>
                </div>

                {/* TABELLA DESKTOP DEI MOVIMENTI */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-white/5 text-[11px] font-semibold text-slate-500 dark:text-[#8E8E93] bg-slate-50/60 dark:bg-[#1C1C1E]/40">
                        <th className="py-2.5 px-4 w-28">Data</th>
                        <th className="py-2.5 px-3 w-48">Categoria</th>
                        <th className="py-2.5 px-3">Descrizione</th>
                        <th className="py-2.5 px-3 w-36">Tipo</th>
                        <th className="py-2.5 px-3 w-28 text-center">Stato</th>
                        <th className="py-2.5 px-4 text-right w-36">Importo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                      {group.rows.map(row => {
                        const isIncome = row.direzione === 'ENTRATA';
                        const isClickable = !!row.rawMovement && !!onSelectMovement;

                        return (
                          <tr
                            key={row.id}
                            onClick={() => {
                              if (isClickable && row.rawMovement) {
                                haptics.tap();
                                onSelectMovement(row.rawMovement);
                              }
                            }}
                            className={`group transition-colors ${
                              isClickable ? 'cursor-pointer hover:bg-slate-50/80 dark:hover:bg-white/[0.04]' : ''
                            } ${row.isProgrammato ? 'bg-amber-500/[0.04] dark:bg-amber-500/[0.02]' : ''}`}
                          >
                            {/* Data */}
                            <td className="py-3 px-4 text-slate-500 dark:text-[#8E8E93] font-numeric whitespace-nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatDateDDMMYYYY(row.data)}
                            </td>

                            {/* Categoria con micro-pillola colorata */}
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span 
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-xs"
                                  style={{ backgroundColor: row.colore }}
                                />
                                <div className="min-w-0">
                                  <div className="font-medium text-slate-900 dark:text-[#F5F5F7] truncate">
                                    {row.sottocategoriaNome}
                                  </div>
                                  <div className="text-[10px] text-slate-400 dark:text-[#8E8E93] truncate">
                                    {row.categoriaPadre}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Descrizione & Tag */}
                            <td className="py-3 px-3">
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-900 dark:text-[#F5F5F7] truncate group-hover:text-slate-950 dark:group-hover:text-white transition-colors">
                                  {row.descrizione}
                                </div>
                                {(row.tag || row.controparteNome) && (
                                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px] flex-wrap">
                                    {row.controparteNome && (
                                      <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                                        {isIncome ? `← Da: ${row.controparteNome}` : `→ A: ${row.controparteNome}`}
                                      </span>
                                    )}
                                    {row.tag && (
                                      <span className="px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-[#8E8E93] border border-slate-200/80 dark:border-white/5">
                                        #{row.tag}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Tipologia */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              {row.isGiroconto ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                                  <ArrowLeftRight size={11} />
                                  <span>Giroconto</span>
                                </span>
                              ) : isIncome ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                  <ArrowDownRight size={11} />
                                  <span>Entrata</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                                  <ArrowUpRight size={11} />
                                  <span>Uscita</span>
                                </span>
                              )}
                            </td>

                            {/* Stato */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              {row.isProgrammato ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                  <Clock size={10} />
                                  <span>Programmata</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                  <Check size={10} />
                                  <span>Eseguita</span>
                                </span>
                              )}
                            </td>

                            {/* Importo */}
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <span 
                                className={`font-numeric text-sm font-bold tracking-tight ${
                                  isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-[#F5F5F7]'
                                }`}
                                style={{ fontVariantNumeric: 'tabular-nums' }}
                              >
                                {row.segno} {formatCurrency(row.importo, { hideSymbol: false })}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* LISTA CARD MOBILE (Zero Scroll Orizzontale, Layout a due righe) */}
                <div className="block md:hidden divide-y divide-slate-100 dark:divide-white/5">
                  {group.rows.map(row => {
                    const isIncome = row.direzione === 'ENTRATA';
                    const isClickable = !!row.rawMovement && !!onSelectMovement;

                    return (
                      <div
                        key={row.id}
                        onClick={() => {
                          if (isClickable && row.rawMovement) {
                            haptics.tap();
                            onSelectMovement(row.rawMovement);
                          }
                        }}
                        className={`p-3.5 flex flex-col gap-1.5 transition-colors ${
                          isClickable ? 'active:bg-slate-100/80 dark:active:bg-white/5 cursor-pointer' : ''
                        } ${row.isProgrammato ? 'bg-amber-500/[0.04] dark:bg-amber-500/[0.03]' : ''}`}
                      >
                        {/* Riga 1: Sottocategoria & Data a sinistra, Importo a destra */}
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span 
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-xs"
                              style={{ backgroundColor: row.colore }}
                            />
                            <span className="text-xs font-bold text-slate-900 dark:text-[#F5F5F7] truncate">
                              {row.sottocategoriaNome}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-[#8E8E93] flex-shrink-0 font-numeric" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatDateDDMMYYYY(row.data)}
                            </span>
                            {row.isProgrammato && (
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex-shrink-0">
                                Prog.
                              </span>
                            )}
                          </div>

                          <div 
                            className={`font-numeric text-sm font-bold flex-shrink-0 ${
                              isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-[#F5F5F7]'
                            }`}
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            {row.segno} {formatCurrency(row.importo, { hideSymbol: false })}
                          </div>
                        </div>

                        {/* Riga 2: Descrizione a sinistra, Controparte/Dettaglio a destra */}
                        <div className="flex items-center justify-between gap-2 text-xs min-w-0">
                          <div className="text-slate-500 dark:text-[#8E8E93] text-[11px] truncate min-w-0">
                            {row.descrizione}
                            {row.tag && <span className="ml-1 text-slate-400 dark:text-[#8E8E93]/70 font-normal">#{row.tag}</span>}
                          </div>

                          {row.controparteNome && (
                            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 flex-shrink-0 font-medium truncate max-w-[130px]">
                              {isIncome ? `← ${row.controparteNome}` : `→ ${row.controparteNome}`}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* FOOTER MODALE: Azioni rapide e chiusura */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-white/5 bg-slate-50/90 dark:bg-[#242426]/60 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="text-xs text-slate-500 dark:text-[#8E8E93]">
            Totale: <strong className="text-slate-900 dark:text-[#F5F5F7] font-numeric">{filteredRows.length}</strong> movimenti visualizzati
          </div>

          <div className="flex items-center gap-2">
            {onOpenNewTransactionForAccount && (
              <button
                type="button"
                onClick={() => {
                  haptics.tap();
                  onOpenNewTransactionForAccount(account.id || account.conto_id);
                }}
                className="sm:hidden px-3.5 py-2 rounded-full text-xs font-semibold bg-[#E31B23] hover:bg-[#c9151c] text-white transition-all cursor-pointer flex items-center gap-1 shadow-sm"
              >
                <Plus size={14} />
                <span>Nuovo</span>
              </button>
            )}

            <button
              type="button"
              id="btn-account-detail-modal-done"
              onClick={() => {
                haptics.tap();
                onClose();
              }}
              className="px-5 py-2 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-[#2A2A2E] dark:hover:bg-[#343438] text-slate-700 dark:text-[#F5F5F7] border border-slate-200/80 dark:border-white/10 transition-colors cursor-pointer shadow-xs"
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
