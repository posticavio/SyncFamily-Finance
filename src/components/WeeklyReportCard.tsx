import React, { useState } from 'react';
import { WeeklyFinancialReport, FinancialAdvice } from '../types';
import { formatCurrency } from '../utils/formatters';
import { formatDMY } from '../utils/financialDate';
import { 
  Sparkles, 
  RefreshCw, 
  TrendingDown, 
  TrendingUp, 
  PiggyBank, 
  ShieldCheck, 
  AlertCircle, 
  Lightbulb, 
  Zap, 
  Calendar, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  History, 
  X,
  Target,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface WeeklyReportCardProps {
  report: WeeklyFinancialReport | null;
  isLoading: boolean;
  onRefreshReport: () => Promise<void>;
  allReports?: WeeklyFinancialReport[];
  onOpenFullReportsView?: () => void;
}

export const WeeklyReportCard: React.FC<WeeklyReportCardProps> = ({
  report,
  isLoading,
  onRefreshReport,
  allReports = [],
  onOpenFullReportsView
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedHistoryReport, setSelectedHistoryReport] = useState<WeeklyFinancialReport | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleManualRefresh = async () => {
    if (isRefreshing || isLoading) return;
    setIsRefreshing(true);
    try {
      await onRefreshReport();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Helper per selezionare l'icona del consiglio
  const renderAdviceIcon = (iconName?: string, category?: string) => {
    const props = { size: 20, strokeWidth: 1.8 };
    switch (iconName) {
      case 'AlertCircle':
        return <AlertCircle {...props} className="text-[#E31B23]" />;
      case 'TrendingDown':
        return <TrendingDown {...props} className="text-amber-500" />;
      case 'PiggyBank':
        return <PiggyBank {...props} className="text-emerald-500" />;
      case 'ShieldCheck':
        return <ShieldCheck {...props} className="text-indigo-500" />;
      case 'Lightbulb':
        return <Lightbulb {...props} className="text-amber-400" />;
      case 'Zap':
        return <Zap {...props} className="text-sky-500" />;
      default:
        if (category === 'BUDGET') return <AlertCircle {...props} className="text-[#E31B23]" />;
        if (category === 'RISPARMIO' || category === 'FONDI') return <PiggyBank {...props} className="text-emerald-500" />;
        return <Lightbulb {...props} className="text-amber-400" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'ALTA':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide bg-rose-500/15 text-rose-600 dark:text-[#E31B23] border border-rose-500/20">
            Priorità Alta
          </span>
        );
      case 'MEDIA':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            Priorità Media
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            Consiglio Proattivo
          </span>
        );
    }
  };

  const getHealthBadge = (status?: string) => {
    switch (status) {
      case 'OTTIMO':
        return { label: 'Eccellente', bg: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' };
      case 'BUONO':
        return { label: 'Buono & Sostenibile', bg: 'bg-indigo-500/15 text-indigo-500 dark:text-indigo-400 border-indigo-500/30' };
      case 'ATTENZIONE':
        return { label: 'Attenzione ai Budget', bg: 'bg-amber-500/15 text-amber-500 border-amber-500/30' };
      case 'CRITICO':
        return { label: 'Disavanzo Critico', bg: 'bg-rose-500/15 text-[#E31B23] border-rose-500/30' };
      default:
        return { label: 'In Monitoraggio', bg: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };
    }
  };

  // Stato di caricamento
  if (isLoading && !report) {
    return (
      <div className="bento-card p-5 sm:p-6 bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-[#2C2C2E] rounded-[24px] animate-pulse space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-[#2A2A2E]" />
            <div className="space-y-2">
              <div className="h-4 w-40 bg-slate-200 dark:bg-[#2A2A2E] rounded-md" />
              <div className="h-3 w-28 bg-slate-100 dark:bg-[#242426] rounded-md" />
            </div>
          </div>
          <div className="h-8 w-24 bg-slate-200 dark:bg-[#2A2A2E] rounded-full" />
        </div>
        <div className="h-20 bg-slate-100 dark:bg-[#242426] rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="h-28 bg-slate-100 dark:bg-[#242426] rounded-2xl" />
          <div className="h-28 bg-slate-100 dark:bg-[#242426] rounded-2xl" />
          <div className="h-28 bg-slate-100 dark:bg-[#242426] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!report) return null;

  const activeReport = selectedHistoryReport || report;
  const healthBadge = getHealthBadge(activeReport.valutazione_generale?.stato_salute);
  const displayDate = activeReport.created_at ? formatDMY(activeReport.created_at.slice(0, 10)) : '';

  return (
    <div 
      id="weekly-report-card" 
      className="bento-card p-4 sm:p-6 bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-[#2C2C2E] rounded-[24px] shadow-xs relative overflow-hidden transition-all duration-300"
    >
      {/* Glow d'accento One UI in alto a destra */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-[#E31B23]/10 to-transparent rounded-bl-full pointer-events-none -z-0 opacity-60 dark:opacity-40" />

      {/* Header Sezione: One UI Viewing Area */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-[#28282B]">
        <div className="flex items-center gap-3 min-w-0">
          {/* Micro-Squircle Icona One UI */}
          <div className="w-10 h-10 rounded-[14px] bg-[#E31B23]/10 dark:bg-[#2A2A2E] text-[#E31B23] flex items-center justify-center flex-shrink-0 shadow-2xs">
            <Sparkles size={20} strokeWidth={2} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[17px] sm:text-[19px] font-medium text-slate-900 dark:text-[#F5F5F7] tracking-tight">
                Report Settimanale AI Gemini
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#E31B23]/10 text-[#E31B23] border border-[#E31B23]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E31B23] animate-pulse" />
                Cadenza 7gg
              </span>
            </div>

            <p className="text-[13px] text-slate-500 dark:text-[#8E8E93] truncate">
              {activeReport.settimana_label} • Elaborato il {displayDate}
            </p>
          </div>
        </div>

        {/* Action Buttons: Rigenera e Storico */}
        <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto flex-wrap">
          {onOpenFullReportsView && (
            <button
              type="button"
              onClick={onOpenFullReportsView}
              className="px-3 py-1.5 rounded-full text-xs font-semibold text-[#E31B23] bg-[#E31B23]/10 hover:bg-[#E31B23]/20 border border-[#E31B23]/30 transition-colors flex items-center gap-1.5 active:scale-95 cursor-pointer"
              title="Apri pagina completa Report AI con storico e trend consigli"
            >
              <Sparkles size={13} />
              <span>Pagina Report AI</span>
              <ArrowRight size={12} />
            </button>
          )}

          {allReports.length > 1 && (
            <button
              type="button"
              onClick={() => setIsHistoryModalOpen(true)}
              className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7] bg-slate-100 dark:bg-[#242426] hover:bg-slate-200 dark:hover:bg-[#2E2E32] transition-colors flex items-center gap-1.5 active:scale-95"
              title="Visualizza storico delle analisi settimanali"
            >
              <History size={14} strokeWidth={1.8} />
              <span>Storico ({allReports.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing || isLoading}
            className="px-3.5 py-1.5 rounded-full text-xs font-medium text-white bg-[#E31B23] hover:bg-[#c9171e] transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 disabled:opacity-60 cursor-pointer"
            title="Aggiorna l'analisi settimanale con l'API Gemini"
          >
            <RefreshCw size={13} strokeWidth={2} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Elaborazione...' : 'Aggiorna Report'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-[#F5F5F7] bg-slate-100 dark:bg-[#242426] hover:bg-slate-200 dark:hover:bg-[#2E2E32] transition-colors flex items-center gap-1 active:scale-95 cursor-pointer"
            title={isExpanded ? 'Comprimi dettagli e consigli' : 'Espandi dettagli e consigli'}
          >
            <span>{isExpanded ? 'Riduci' : 'Dettagli'}</span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Viewing Area: Punteggio di Salute Finanziaria & Valutazione Generale */}
      <div className="relative z-10 my-4 p-4 rounded-[20px] bg-slate-50 dark:bg-[#242426] border border-slate-100 dark:border-[#2C2C2E] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-400 dark:text-[#8E8E93] uppercase tracking-wider">
              Diagnosi Finanziaria
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${healthBadge.bg}`}>
              {healthBadge.label}
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-medium text-slate-900 dark:text-[#F5F5F7] tracking-tight">
            {activeReport.valutazione_generale?.titolo || 'Valutazione della settimana'}
          </h3>

          <p className="text-[14px] leading-relaxed text-slate-600 dark:text-[#8E8E93]">
            {activeReport.valutazione_generale?.sommario}
          </p>
        </div>

        {/* Score Pill Circolare / Numerico */}
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-[#2E2E32]">
          <div className="text-right">
            <span className="block text-[11px] font-medium text-slate-400 dark:text-[#8E8E93]">Indice Salute</span>
            <span className="font-numeric text-2xl sm:text-3xl font-bold text-slate-900 dark:text-[#F5F5F7] leading-none">
              {activeReport.valutazione_generale?.punteggio ?? 80}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-[#8E8E93]">/100</span>
          </div>
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#E31B23]/10 text-[#E31B23]">
            <Target size={22} strokeWidth={2} />
          </div>
        </div>
      </div>

      {/* KPI Riassuntivi della Settimana (Entrate, Uscite, Budget, Risparmio) */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 my-4">
        {/* KPI 1: Entrate */}
        <div className="p-3 rounded-[16px] bg-slate-50/70 dark:bg-[#242426]/60 border border-slate-100 dark:border-[#2C2C2E]/50">
          <span className="text-[11px] font-medium text-slate-400 dark:text-[#8E8E93] block mb-0.5">
            Entrate Analizzate
          </span>
          <span className="font-numeric text-[15px] sm:text-[17px] font-bold text-emerald-600 dark:text-emerald-400 block truncate">
            {formatCurrency(activeReport.metriche_riassuntive?.totale_entrate ?? 0, { showSign: true })}
          </span>
        </div>

        {/* KPI 2: Uscite */}
        <div className="p-3 rounded-[16px] bg-slate-50/70 dark:bg-[#242426]/60 border border-slate-100 dark:border-[#2C2C2E]/50">
          <span className="text-[11px] font-medium text-slate-400 dark:text-[#8E8E93] block mb-0.5">
            Uscite Analizzate
          </span>
          <span className="font-numeric text-[15px] sm:text-[17px] font-bold text-slate-900 dark:text-[#F5F5F7] block truncate">
            {formatCurrency(activeReport.metriche_riassuntive?.totale_uscite ?? 0)}
          </span>
        </div>

        {/* KPI 3: Saldo Netto */}
        <div className="p-3 rounded-[16px] bg-slate-50/70 dark:bg-[#242426]/60 border border-slate-100 dark:border-[#2C2C2E]/50">
          <span className="text-[11px] font-medium text-slate-400 dark:text-[#8E8E93] block mb-0.5">
            Saldo Settimanale
          </span>
          <span className={`font-numeric text-[15px] sm:text-[17px] font-bold block truncate ${(activeReport.metriche_riassuntive?.saldo_netto ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#E31B23]'}`}>
            {formatCurrency(activeReport.metriche_riassuntive?.saldo_netto ?? 0, { showSign: true })}
          </span>
        </div>

        {/* KPI 4: Sforamenti Budget */}
        <div className="p-3 rounded-[16px] bg-slate-50/70 dark:bg-[#242426]/60 border border-slate-100 dark:border-[#2C2C2E]/50">
          <span className="text-[11px] font-medium text-slate-400 dark:text-[#8E8E93] block mb-0.5">
            Stato Budget Mese
          </span>
          <span className={`font-numeric text-[15px] sm:text-[17px] font-bold block truncate ${(activeReport.metriche_riassuntive?.categorie_sopra_budget ?? 0) > 0 ? 'text-[#E31B23]' : 'text-emerald-500'}`}>
            {(activeReport.metriche_riassuntive?.categorie_sopra_budget ?? 0) > 0 
              ? `${activeReport.metriche_riassuntive.categorie_sopra_budget} in eccesso` 
              : '100% Rispettati'}
          </span>
        </div>
      </div>

      {/* SEZIONE CORE: I 3+ CONSIGLI FINANZIARI PERSONALIZZATI (Visibile all'espansione o accessibile da Report AI) */}
      {isExpanded ? (
        <div className="relative z-10 mt-5 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-[15px] sm:text-[16px] font-medium text-slate-900 dark:text-[#F5F5F7]">
                Consigli Personalizzati della Settimana
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#E31B23]/10 text-[#E31B23]">
                {activeReport.consigli?.length || 3} raccomandazioni
              </span>
            </div>
            <span className="text-[12px] text-slate-400 dark:text-[#8E8E93] hidden sm:inline">
              Aggiornati ogni 7 giorni in base a movimenti e budget
            </span>
          </div>

          {/* Griglia delle Card di Consiglio */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {activeReport.consigli?.map((advice, idx) => (
              <div
                key={advice.id || idx}
                className="p-4 rounded-[20px] bg-white dark:bg-[#242426] border border-slate-200 dark:border-[#2E2E32] hover:border-[#E31B23]/40 dark:hover:border-[#E31B23]/40 transition-all flex flex-col justify-between space-y-3 group shadow-2xs"
              >
                <div className="space-y-2.5">
                  {/* Header Consiglio: Micro-Squircle + Badge Priorità */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-10 h-10 rounded-[12px] bg-slate-100 dark:bg-[#2A2A2E] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      {renderAdviceIcon(advice.icona, advice.categoria)}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getPriorityBadge(advice.priorita)}
                      <span className="text-[10px] font-medium text-slate-400 dark:text-[#8E8E93] uppercase tracking-wider">
                        {advice.categoria}
                      </span>
                    </div>
                  </div>

                  {/* Titolo */}
                  <h5 className="text-[15px] font-medium text-slate-900 dark:text-[#F5F5F7] leading-snug group-hover:text-[#E31B23] transition-colors">
                    {advice.titolo}
                  </h5>

                  {/* Descrizione con cifre reali */}
                  <p className="text-[13px] leading-relaxed text-slate-600 dark:text-[#8E8E93]">
                    {advice.descrizione}
                  </p>
                </div>

                {/* Azione Pratica One UI Box & Impatto Economico */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-[#2E2E32]">
                  <div className="p-2.5 rounded-[14px] bg-slate-50 dark:bg-[#1C1C1E] border border-slate-100 dark:border-[#2A2A2E]">
                    <div className="flex items-start gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                      <p className="text-[12px] font-medium text-slate-700 dark:text-slate-300 leading-tight">
                        {advice.azione_pratica}
                      </p>
                    </div>
                  </div>

                  {advice.impatto_stimato && (
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-slate-400 dark:text-[#8E8E93]">Impatto Stimato:</span>
                      <span className="font-numeric font-bold text-slate-800 dark:text-slate-200">
                        {advice.impatto_stimato}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="relative z-10 mt-3 pt-3 border-t border-slate-100 dark:border-[#28282B] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#8E8E93]">
            <Sparkles size={14} className="text-[#E31B23]" />
            <span>{activeReport.consigli?.length || 3} consigli personalizzati disponibili per questa settimana</span>
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="text-xs font-semibold text-[#E31B23] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Vedi consigli</span>
            <ChevronDown size={14} />
          </button>
        </div>
      )}

      {/* Footer Tecnico con Metadati sulla Generazione e Trasparenza */}
      {isExpanded && (
        <div className="relative z-10 mt-4 pt-3 border-t border-slate-100 dark:border-[#28282B] flex flex-col sm:flex-row items-center justify-between text-[12px] text-slate-400 dark:text-[#8E8E93] gap-2">
          <div className="flex items-center gap-2">
            <Clock size={13} />
            <span>
              {activeReport.fonte_generazione === 'GEMINI_AI' 
                ? 'Consulenza generata con intelligenza artificiale Gemini 2.5 Flash' 
                : 'Consulenza generata con motore di regole finanziarie analitiche'}
            </span>
          </div>
          <div>
            <span>{activeReport.riepilogo_movimenti_analizzati || 0} movimenti e {activeReport.riepilogo_budget_analizzati || 0} budget esaminati</span>
          </div>
        </div>
      )}

      {/* Modal Storico dei Report Settimanali */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-[#2C2C2E] rounded-[24px] max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#28282B] pb-3">
              <div className="flex items-center gap-2">
                <History size={18} className="text-[#E31B23]" />
                <h3 className="text-base font-medium text-slate-900 dark:text-[#F5F5F7]">
                  Storico Report Settimanali
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-[#2A2A2E] text-slate-400 hover:text-slate-600 dark:hover:text-[#F5F5F7]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
              {allReports.map((item) => {
                const isCurrent = (item.id === activeReport.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedHistoryReport(item);
                      setIsHistoryModalOpen(false);
                    }}
                    className={`p-3.5 rounded-[18px] border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isCurrent
                        ? 'bg-[#E31B23]/10 border-[#E31B23]/40'
                        : 'bg-slate-50 dark:bg-[#242426] border-slate-100 dark:border-[#2C2C2E] hover:border-slate-300 dark:hover:border-[#3A3A3E]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-[#F5F5F7] truncate">
                          {item.settimana_label}
                        </span>
                        {item.id === report.id && (
                          <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-[#E31B23] text-white">
                            Attuale
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-[#8E8E93] truncate mt-0.5">
                        {item.valutazione_generale?.titolo} • Indice: {item.valutazione_generale?.punteggio}/100
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`font-numeric text-xs font-bold ${item.metriche_riassuntive?.saldo_netto >= 0 ? 'text-emerald-500' : 'text-[#E31B23]'}`}>
                        {formatCurrency(item.metriche_riassuntive?.saldo_netto || 0, { showSign: true })}
                      </span>
                      <ArrowRight size={14} className="text-slate-400" />
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedHistoryReport && selectedHistoryReport.id !== report.id && (
              <div className="pt-2 flex justify-between items-center border-t border-slate-100 dark:border-[#28282B]">
                <button
                  type="button"
                  onClick={() => setSelectedHistoryReport(null)}
                  className="text-xs font-medium text-[#E31B23] hover:underline"
                >
                  Torna al report corrente della settimana
                </button>
                <button
                  type="button"
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="px-4 py-1.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-[#242426] text-slate-700 dark:text-slate-300"
                >
                  Chiudi
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
