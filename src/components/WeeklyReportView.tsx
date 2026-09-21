import React, { useState, useMemo, useEffect } from 'react';
import { WeeklyFinancialReport, FinancialAdvice, AdviceCategory, AdviceFeedbackType } from '../types';
import { WeeklyReportService } from '../services/WeeklyReportService';
import { formatCurrency } from '../utils/formatters';
import { formatDMY } from '../utils/financialDate';
import { TabHeaderInfo } from './TabHeaderInfo';
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
  CheckCircle2,
  Clock,
  ArrowRight,
  Target,
  Calendar,
  Layers,
  ChevronRight,
  History,
  Check,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  SlidersHorizontal,
  BookmarkCheck,
  ListFilter,
  ThumbsUp,
  MessageSquare
} from 'lucide-react';

interface WeeklyReportViewProps {
  reports: WeeklyFinancialReport[];
  isLoading: boolean;
  onRefreshReport: () => Promise<void>;
  onNavigateToMovements?: () => void;
  onNavigateToBudget?: () => void;
}

/**
 * Componente per il Rating e Feedback dei consigli finanziari (Samsung One UI Aesthetic)
 * Permette di indicare "Utile" o "Migliorativo", inserire note/tag e salvarli nel database
 * per guidare l'apprendimento e affinamento delle future generazioni con Gemini.
 */
const AdviceFeedbackBar: React.FC<{
  reportId: string;
  advice: FinancialAdvice;
  onFeedbackChange: (reportId: string, adviceId: string, feedback: AdviceFeedbackType | null, note?: string) => Promise<void>;
}> = ({ reportId, advice, onFeedbackChange }) => {
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(advice.feedback_nota || '');
  const [isSaving, setIsSaving] = useState(false);
  const [savedBadge, setSavedBadge] = useState(false);

  useEffect(() => {
    setNoteDraft(advice.feedback_nota || '');
  }, [advice.feedback_nota]);

  const handleSelectFeedback = async (type: AdviceFeedbackType) => {
    const next = advice.feedback === type ? null : type;
    setIsSaving(true);
    await onFeedbackChange(reportId, advice.id, next, noteDraft);
    setIsSaving(false);
    setSavedBadge(true);
    setTimeout(() => setSavedBadge(false), 2500);
    if (next && !isNoteOpen) {
      setIsNoteOpen(true);
    }
  };

  const handleQuickTag = async (tag: string) => {
    setNoteDraft(tag);
    setIsSaving(true);
    await onFeedbackChange(reportId, advice.id, advice.feedback || 'UTILE', tag);
    setIsSaving(false);
    setSavedBadge(true);
    setTimeout(() => setSavedBadge(false), 2500);
  };

  const handleSaveNote = async () => {
    setIsSaving(true);
    await onFeedbackChange(reportId, advice.id, advice.feedback || 'UTILE', noteDraft);
    setIsSaving(false);
    setSavedBadge(true);
    setTimeout(() => setSavedBadge(false), 2500);
  };

  const usefulChips = ['Molto concreto', 'Già applicato', 'Ottima idea', 'Risparmio reale'];
  const improveChips = ['Troppo generico', 'Poco realistico', 'Spesa non tagliabile', 'Azione poco chiara'];

  return (
    <div className="pt-2.5 border-t border-slate-200/50 dark:border-[#2E2E32] space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold text-slate-400 dark:text-[#8E8E93] uppercase tracking-wider">
            Valuta:
          </span>

          {/* Pillola UTILE */}
          <button
            type="button"
            id={`btn-utile-${advice.id}`}
            onClick={() => handleSelectFeedback('UTILE')}
            disabled={isSaving}
            className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              advice.feedback === 'UTILE'
                ? 'bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 border border-emerald-500/40 shadow-xs'
                : 'bg-slate-100 dark:bg-[#2A2A2E] text-slate-600 dark:text-[#8E8E93] hover:text-emerald-500 hover:bg-emerald-500/10 border border-transparent'
            }`}
            title="Consiglio utile: favorisci suggerimenti simili nei futuri report Gemini"
          >
            <ThumbsUp size={12} className={advice.feedback === 'UTILE' ? 'fill-current' : ''} />
            <span>Utile</span>
          </button>

          {/* Pillola MIGLIORATIVO */}
          <button
            type="button"
            id={`btn-migliorativo-${advice.id}`}
            onClick={() => handleSelectFeedback('MIGLIORATIVO')}
            disabled={isSaving}
            className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              advice.feedback === 'MIGLIORATIVO'
                ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/40 shadow-xs'
                : 'bg-slate-100 dark:bg-[#2A2A2E] text-slate-600 dark:text-[#8E8E93] hover:text-amber-500 hover:bg-amber-500/10 border border-transparent'
            }`}
            title="Consiglio migliorativo: orienta Gemini a proporre strategie alternative"
          >
            <Sparkles size={12} className={advice.feedback === 'MIGLIORATIVO' ? 'fill-current' : ''} />
            <span>Migliorativo</span>
          </button>
        </div>

        {/* Toggle / Stato nota */}
        <div className="flex items-center gap-2">
          {savedBadge && (
            <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1 animate-in fade-in">
              <Check size={11} strokeWidth={2.5} />
              <span>Salvato per Gemini</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => setIsNoteOpen(prev => !prev)}
            className="text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-[#F5F5F7] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <MessageSquare size={12} className={advice.feedback_nota ? 'text-amber-500 fill-amber-500/20' : ''} />
            <span>{advice.feedback_nota ? 'Nota inserita' : 'Aggiungi nota'}</span>
          </button>
        </div>
      </div>

      {/* Pannello Micro-Squircle per Note e Tag di orientamento AI */}
      {isNoteOpen && (
        <div className="p-3 rounded-[16px] bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-[#2E2E32] space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-slate-700 dark:text-[#F5F5F7] flex items-center gap-1">
              <Sparkles size={12} className="text-[#E31B23]" />
              Feedback per Gemini AI
            </span>
            <button
              type="button"
              onClick={() => setIsNoteOpen(false)}
              className="text-[10px] text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Nascondi
            </button>
          </div>

          {/* Chip Suggeriti in Pillole One UI */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-400 dark:text-[#8E8E93]">Tag rapidi:</span>
            {(advice.feedback === 'MIGLIORATIVO' ? improveChips : usefulChips).map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => handleQuickTag(tag)}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all cursor-pointer ${
                  noteDraft === tag
                    ? 'bg-[#E31B23] text-white'
                    : 'bg-slate-100 dark:bg-[#28282C] text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Input testo libero */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveNote();
                }
              }}
              placeholder="Spiega a Gemini cosa preferire o evitare (es. 'spesa non riducibile', 'ottima stima')..."
              className="flex-1 px-3 py-1.5 text-xs rounded-full bg-slate-50 dark:bg-[#242426] border border-slate-200 dark:border-[#38383C] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-[#E31B23]"
            />
            <button
              type="button"
              onClick={handleSaveNote}
              disabled={isSaving}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#E31B23] text-white hover:bg-[#c9171e] transition-colors cursor-pointer flex-shrink-0"
            >
              Salva
            </button>
          </div>

          <p className="text-[10px] text-slate-400 dark:text-[#8E8E93]">
            💡 Questo feedback viene memorizzato nel database e istruirà le future generazioni del report settimanale.
          </p>
        </div>
      )}
    </div>
  );
};

export const WeeklyReportView: React.FC<WeeklyReportViewProps> = ({
  reports,
  isLoading,
  onRefreshReport,
  onNavigateToMovements,
  onNavigateToBudget
}) => {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [activeTabSub, setActiveTabSub] = useState<'DETTAGLIO' | 'TREND_CONSIGLI'>('DETTAGLIO');
  const [filterCategory, setFilterCategory] = useState<string>('TUTTE');
  const [filterFeedback, setFilterFeedback] = useState<'TUTTI' | 'UTILI' | 'MIGLIORATIVI' | 'NON_VALUTATI'>('TUTTI');
  const [localReports, setLocalReports] = useState<WeeklyFinancialReport[]>(reports);

  useEffect(() => {
    setLocalReports(reports);
  }, [reports]);

  // Gestione del rating e feedback con persistenza asincrona su Firestore
  const handleFeedbackChange = async (
    reportId: string,
    adviceId: string,
    feedback: AdviceFeedbackType | null,
    note?: string
  ) => {
    // Aggiornamento ottimistico locale per risposta UI istantanea
    setLocalReports(prev =>
      prev.map(r => {
        if (r.id !== reportId && r.report_id !== reportId) return r;
        return {
          ...r,
          consigli: (r.consigli || []).map(c => {
            if (c.id !== adviceId) return c;
            return {
              ...c,
              feedback,
              feedback_nota: note !== undefined ? note : (c.feedback_nota || ''),
              feedback_at: feedback ? new Date().toISOString() : undefined
            };
          })
        };
      })
    );

    try {
      await WeeklyReportService.setAdviceFeedback(reportId, adviceId, feedback, note);
    } catch (e) {
      console.error('Errore durante il salvataggio del rating per Gemini:', e);
    }
  };

  // Report attivo selezionato (o il più recente come predefinito)
  const activeReport = useMemo(() => {
    if (!localReports || localReports.length === 0) return null;
    if (selectedReportId) {
      const found = localReports.find(r => r.id === selectedReportId || r.report_id === selectedReportId);
      if (found) return found;
    }
    return localReports[0];
  }, [localReports, selectedReportId]);

  // Aggregazione del TREND storico di tutti i consigli emessi nel tempo
  const adviceTrendList = useMemo(() => {
    const list: Array<{
      advice: FinancialAdvice;
      reportId: string;
      reportLabel: string;
      settimanaChiave: string;
      reportDate: string;
      punteggioReport: number;
    }> = [];

    localReports.forEach(r => {
      (r.consigli || []).forEach(adv => {
        list.push({
          advice: adv,
          reportId: r.id,
          reportLabel: r.settimana_label,
          settimanaChiave: r.settimana_chiave,
          reportDate: r.created_at,
          punteggioReport: r.valutazione_generale?.punteggio || 80
        });
      });
    });

    let filtered = list;
    if (filterCategory !== 'TUTTE') {
      filtered = filtered.filter(item => item.advice.categoria === filterCategory);
    }
    if (filterFeedback === 'UTILI') {
      filtered = filtered.filter(item => item.advice.feedback === 'UTILE');
    } else if (filterFeedback === 'MIGLIORATIVI') {
      filtered = filtered.filter(item => item.advice.feedback === 'MIGLIORATIVO');
    } else if (filterFeedback === 'NON_VALUTATI') {
      filtered = filtered.filter(item => !item.advice.feedback);
    }

    return filtered;
  }, [localReports, filterCategory, filterFeedback]);

  // Statistiche del trend storico dei consigli con indicatori di feedback
  const trendStats = useMemo(() => {
    const totalAdvices = localReports.reduce((acc, r) => acc + (r.consigli?.length || 0), 0);
    const totalReports = localReports.length;
    
    let totalRated = 0;
    let totalUtili = 0;
    let totalMigliorativi = 0;

    // Conteggio per categoria
    const categoryCounts: Record<string, number> = {
      BUDGET: 0,
      GESTIONE_USCITE: 0,
      FONDI: 0,
      RISPARMIO: 0,
      OTTIMIZZAZIONE: 0
    };

    localReports.forEach(r => {
      (r.consigli || []).forEach(c => {
        if (categoryCounts[c.categoria] !== undefined) {
          categoryCounts[c.categoria]++;
        } else {
          categoryCounts[c.categoria] = 1;
        }

        if (c.feedback === 'UTILE') {
          totalRated++;
          totalUtili++;
        } else if (c.feedback === 'MIGLIORATIVO') {
          totalRated++;
          totalMigliorativi++;
        }
      });
    });

    const percentUtili = totalRated > 0 ? Math.round((totalUtili / totalRated) * 100) : 0;

    // Punteggi medi e progressione
    const scores = localReports.map(r => r.valutazione_generale?.punteggio ?? 75);
    const latestScore = scores[0] ?? 0;
    const oldestScore = scores[scores.length - 1] ?? 0;
    const scoreDiff = latestScore - oldestScore;

    return {
      totalReports,
      totalAdvices,
      totalRated,
      totalUtili,
      totalMigliorativi,
      percentUtili,
      categoryCounts,
      latestScore,
      scoreDiff
    };
  }, [localReports]);

  const renderAdviceIcon = (iconName?: string, category?: string) => {
    const props = { size: 18, strokeWidth: 2 };
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
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-rose-500/15 text-[#E31B23] border border-rose-500/20">
            Priorità Alta
          </span>
        );
      case 'MEDIA':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-amber-500/15 text-amber-500 border border-amber-500/20">
            Priorità Media
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
            Proattivo
          </span>
        );
    }
  };

  const getHealthBadge = (status?: string) => {
    switch (status) {
      case 'OTTIMO':
        return { label: 'Eccellente', bg: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' };
      case 'BUONO':
        return { label: 'Buono & Equilibrato', bg: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' };
      case 'ATTENZIONE':
        return { label: 'Attenzione ai Budget', bg: 'bg-amber-500/15 text-amber-500 border-amber-500/30' };
      case 'CRITICO':
        return { label: 'Disavanzo Critico', bg: 'bg-rose-500/15 text-[#E31B23] border-rose-500/30' };
      default:
        return { label: 'In Monitoraggio', bg: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };
    }
  };

  // Se nessun report è ancora stato generato
  if (!activeReport && !isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-24 md:pb-12 pt-2">
        <div className="text-center py-16 px-4 bg-white dark:bg-[#1C1C1E] rounded-[24px] border border-slate-200 dark:border-[#2C2C2E] shadow-xs">
          <div className="w-16 h-16 rounded-[22px] bg-[#E31B23]/10 text-[#E31B23] flex items-center justify-center mx-auto mb-4">
            <Sparkles size={32} strokeWidth={2} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-[#F5F5F7] mb-2">
            Nessun Report Settimanale Generato
          </h2>
          <p className="text-sm text-slate-500 dark:text-[#8E8E93] max-w-md mx-auto mb-6">
            Genera ora il tuo primo report finanziario settimanale con Gemini AI. L'analisi esaminerà entrate, uscite, scostamenti dai budget mensili e formulerà almeno 3 raccomandazioni personalizzate.
          </p>
          <button
            type="button"
            id="generate-first-weekly-report-btn"
            onClick={onRefreshReport}
            className="px-6 py-3 rounded-full text-sm font-semibold text-white bg-[#E31B23] hover:bg-[#c9171e] transition-all inline-flex items-center gap-2 shadow-md active:scale-95 cursor-pointer"
          >
            <Sparkles size={16} />
            <span>Genera Primo Report Settimanale</span>
          </button>
        </div>
      </div>
    );
  }

  const healthBadge = getHealthBadge(activeReport?.valutazione_generale?.stato_salute);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24 md:pb-12 pt-2">
      {/* 1. VIEWING AREA SAMSUNG ONE UI: Header di Sezione con Titolo e Azioni */}
      <div className="bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-[#2C2C2E] rounded-[24px] p-5 sm:p-7 shadow-xs relative overflow-hidden">
        {/* Glow decorativo delicato d'accento One UI */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-[#E31B23]/10 to-transparent rounded-bl-full pointer-events-none -z-0 opacity-60" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-10 h-10 rounded-[14px] bg-[#E31B23]/10 text-[#E31B23] flex items-center justify-center flex-shrink-0">
                <Sparkles size={20} strokeWidth={2} />
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F5F5F7] tracking-tight">
                  Report Finanziari AI <span className="hidden md:inline text-base font-mono font-normal text-slate-400 dark:text-slate-500">(A)</span>
                </h1>
                <TabHeaderInfo text="Archivio continuo delle analisi finanziarie settimanali: consulta i singoli report storici generati e analizza il trend nel tempo dei consigli formulati per ottimizzare spese e budget familiari." />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#E31B23]/10 text-[#E31B23] border border-[#E31B23]/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E31B23] animate-pulse" />
                <span>Google Gemini AI</span>
              </span>
            </div>

            {/* Sotto-selettore di vista: Dettaglio Report vs Trend Storico Consigli */}
            <div className="flex items-center gap-1.5 pt-2">
              <button
                type="button"
                onClick={() => setActiveTabSub('DETTAGLIO')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  activeTabSub === 'DETTAGLIO'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 dark:bg-[#2A2A2E] text-slate-600 dark:text-[#8E8E93] hover:bg-slate-200 dark:hover:bg-[#343438]'
                }`}
              >
                Dettaglio Report Settimanali ({reports.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTabSub('TREND_CONSIGLI')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTabSub === 'TREND_CONSIGLI'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 dark:bg-[#2A2A2E] text-slate-600 dark:text-[#8E8E93] hover:bg-slate-200 dark:hover:bg-[#343438]'
                }`}
              >
                <TrendingUp size={13} />
                <span>Trend Consigli Finanziari ({trendStats.totalAdvices})</span>
              </button>
            </div>
          </div>

          {/* Azione Rapida: Generazione e Aggiornamento */}
          <div className="flex items-center gap-2.5 flex-shrink-0 self-start md:self-center">
            <button
              type="button"
              id="refresh-weekly-report-tab-btn"
              onClick={onRefreshReport}
              disabled={isLoading}
              className="px-5 py-2.5 rounded-full text-xs font-semibold text-white bg-[#E31B23] hover:bg-[#c9171e] transition-all flex items-center gap-2 shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span>{isLoading ? 'Analisi in corso...' : 'Aggiorna Analisi Settimanale'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* VISTA 1: DETTAGLIO REPORT SETTIMANALE + STORICO MASTER-DETAIL */}
      {activeTabSub === 'DETTAGLIO' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Colonna Sinistra (lg:col-span-4): Elenco Storico dei Report Salvati */}
          <div className="lg:col-span-4 bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-[#2C2C2E] rounded-[24px] p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#28282B]">
              <div className="flex items-center gap-2">
                <History size={16} className="text-[#E31B23]" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F7]">
                  Archivio Settimane ({reports.length})
                </h2>
              </div>
              <span className="text-[11px] font-medium text-slate-400 dark:text-[#8E8E93]">
                Cronologia Salvata
              </span>
            </div>

            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1 no-scrollbar">
              {reports.map((rep, index) => {
                const isSelected = activeReport?.id === rep.id;
                const dateLabel = rep.created_at ? formatDMY(rep.created_at.slice(0, 10)) : '';
                const saldo = rep.metriche_riassuntive?.saldo_netto || 0;
                const score = rep.valutazione_generale?.punteggio ?? 80;

                return (
                  <div
                    key={rep.id}
                    id={`report-item-${rep.id}`}
                    onClick={() => setSelectedReportId(rep.id)}
                    className={`p-3.5 rounded-[18px] border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                      isSelected
                        ? 'bg-[#E31B23]/10 border-[#E31B23]/40 shadow-xs'
                        : 'bg-slate-50 dark:bg-[#242426] border-slate-100 dark:border-[#2C2C2E] hover:border-slate-300 dark:hover:border-[#38383C]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-bold truncate ${isSelected ? 'text-[#E31B23]' : 'text-slate-900 dark:text-[#F5F5F7]'}`}>
                          {rep.settimana_label}
                        </span>
                        {index === 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#E31B23] text-white flex-shrink-0">
                            Più Recente
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 dark:text-[#8E8E93] truncate mt-0.5">
                        {dateLabel} • Score: <strong className="text-slate-700 dark:text-slate-300 font-numeric">{score}</strong>/100
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className={`font-numeric text-xs font-bold block ${saldo >= 0 ? 'text-emerald-500' : 'text-[#E31B23]'}`}>
                        {formatCurrency(saldo, { showSign: true })}
                      </span>
                      <ChevronRight size={13} className="text-slate-400 group-hover:translate-x-0.5 transition-transform ml-auto mt-0.5" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Colonna Destra (lg:col-span-8): Dettaglio Esteso del Report Attivo */}
          {activeReport && (
            <div className="lg:col-span-8 space-y-5">
              
              {/* Diagnosi di Salute e Punteggio */}
              <div className="bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-[#2C2C2E] rounded-[24px] p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#28282B]">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-400 dark:text-[#8E8E93] uppercase tracking-wider">
                        {activeReport.settimana_label}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${healthBadge.bg}`}>
                        {healthBadge.label}
                      </span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-[#F5F5F7] tracking-tight mt-1">
                      {activeReport.valutazione_generale?.titolo}
                    </h2>
                  </div>

                  {/* Punteggio Salute Finanziaria */}
                  <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-[#242426] border border-slate-100 dark:border-[#2C2C2E] flex-shrink-0 self-start sm:self-auto">
                    <div className="text-right">
                      <span className="block text-[9px] font-bold text-slate-400 dark:text-[#8E8E93] uppercase">Punteggio</span>
                      <span className="font-numeric text-2xl font-extrabold text-slate-900 dark:text-[#F5F5F7] leading-none">
                        {activeReport.valutazione_generale?.punteggio ?? 80}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-[#8E8E93]">/100</span>
                    </div>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center bg-[#E31B23]/10 text-[#E31B23]">
                      <Target size={20} strokeWidth={2} />
                    </div>
                  </div>
                </div>

                {/* Sommario narrativo */}
                <p className="text-sm leading-relaxed text-slate-600 dark:text-[#8E8E93]">
                  {activeReport.valutazione_generale?.sommario}
                </p>

                {/* KPI a 4 metriche */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <div className="p-3 rounded-[16px] bg-slate-50 dark:bg-[#242426] border border-slate-100 dark:border-[#2C2C2E]">
                    <span className="text-[11px] text-slate-400 dark:text-[#8E8E93] block mb-0.5">Entrate Registrate</span>
                    <span className="font-numeric text-sm sm:text-base font-bold text-emerald-500 block truncate">
                      {formatCurrency(activeReport.metriche_riassuntive?.totale_entrate ?? 0, { showSign: true })}
                    </span>
                  </div>
                  <div className="p-3 rounded-[16px] bg-slate-50 dark:bg-[#242426] border border-slate-100 dark:border-[#2C2C2E]">
                    <span className="text-[11px] text-slate-400 dark:text-[#8E8E93] block mb-0.5">Uscite Registrate</span>
                    <span className="font-numeric text-sm sm:text-base font-bold text-slate-900 dark:text-[#F5F5F7] block truncate">
                      {formatCurrency(activeReport.metriche_riassuntive?.totale_uscite ?? 0)}
                    </span>
                  </div>
                  <div className="p-3 rounded-[16px] bg-slate-50 dark:bg-[#242426] border border-slate-100 dark:border-[#2C2C2E]">
                    <span className="text-[11px] text-slate-400 dark:text-[#8E8E93] block mb-0.5">Saldo Periodo</span>
                    <span className={`font-numeric text-sm sm:text-base font-bold block truncate ${(activeReport.metriche_riassuntive?.saldo_netto ?? 0) >= 0 ? 'text-emerald-500' : 'text-[#E31B23]'}`}>
                      {formatCurrency(activeReport.metriche_riassuntive?.saldo_netto ?? 0, { showSign: true })}
                    </span>
                  </div>
                  <div className="p-3 rounded-[16px] bg-slate-50 dark:bg-[#242426] border border-slate-100 dark:border-[#2C2C2E]">
                    <span className="text-[11px] text-slate-400 dark:text-[#8E8E93] block mb-0.5">Stato Budget</span>
                    <span className={`font-numeric text-sm sm:text-base font-bold block truncate ${(activeReport.metriche_riassuntive?.categorie_sopra_budget ?? 0) > 0 ? 'text-[#E31B23]' : 'text-emerald-500'}`}>
                      {(activeReport.metriche_riassuntive?.categorie_sopra_budget ?? 0) > 0 
                        ? `${activeReport.metriche_riassuntive.categorie_sopra_budget} in eccesso`
                        : 'Tutti nei limiti'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Schede Consigli Personalizzati della Settimana Selezionata */}
              <div className="bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-[#2C2C2E] rounded-[24px] p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100 dark:border-[#28282B]">
                  <div className="flex items-center gap-2">
                    <Lightbulb size={17} className="text-[#E31B23]" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F7]">
                      Consigli Finanziari Assegnati ({activeReport.consigli?.length || 3})
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400 dark:text-[#8E8E93]">
                    Analisi personalizzata su misura
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {activeReport.consigli?.map((adv, idx) => (
                    <div
                      key={adv.id || idx}
                      className="p-4 rounded-[20px] bg-slate-50/70 dark:bg-[#242426] border border-slate-100 dark:border-[#2E2E32] flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="w-9 h-9 rounded-[12px] bg-white dark:bg-[#2A2A2E] border border-slate-200/60 dark:border-white/5 flex items-center justify-center flex-shrink-0">
                            {renderAdviceIcon(adv.icona, adv.categoria)}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {getPriorityBadge(adv.priorita)}
                            <span className="text-[9px] font-bold text-slate-400 uppercase">
                              {adv.categoria}
                            </span>
                          </div>
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F7] leading-snug">
                          {adv.titolo}
                        </h4>

                        <p className="text-xs leading-relaxed text-slate-600 dark:text-[#8E8E93]">
                          {adv.descrizione}
                        </p>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-200/50 dark:border-[#2E2E32]">
                        <div className="p-2 rounded-[12px] bg-white dark:bg-[#1C1C1E] border border-slate-100 dark:border-[#2A2A2E]">
                          <div className="flex items-start gap-1.5">
                            <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                            <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 leading-tight">
                              {adv.azione_pratica}
                            </p>
                          </div>
                        </div>

                        {adv.impatto_stimato && (
                          <div className="flex items-center justify-between text-[11px] px-1">
                            <span className="text-slate-400 dark:text-[#8E8E93]">Impatto:</span>
                            <span className="font-numeric font-bold text-slate-800 dark:text-slate-200">
                              {adv.impatto_stimato}
                            </span>
                          </div>
                        )}

                        {/* Sistema di Rating e Feedback per Gemini */}
                        <AdviceFeedbackBar
                          reportId={activeReport.id || activeReport.report_id}
                          advice={adv}
                          onFeedbackChange={handleFeedbackChange}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Informazioni di Sistema e Timestamp */}
              <div className="p-3.5 rounded-[18px] bg-slate-50 dark:bg-[#1C1C1E] border border-slate-100 dark:border-[#28282B] flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 dark:text-[#8E8E93] gap-2">
                <div className="flex items-center gap-2">
                  <Clock size={13} />
                  <span>
                    Elaborato il {activeReport.created_at ? formatDMY(activeReport.created_at.slice(0, 10)) : ''} • Fonte: {activeReport.fonte_generazione === 'GEMINI_AI' ? 'Google Gemini 3.6 Flash' : 'Motore Finanziario Locale'}
                  </span>
                </div>
                <span>ID: {activeReport.report_id}</span>
              </div>

            </div>
          )}
        </div>
      )}

      {/* VISTA 2: TREND DEI CONSIGLI FINANZIARI PASSATI (RICHIESTA ESPLICITA UTENTE) */}
      {activeTabSub === 'TREND_CONSIGLI' && (
        <div className="space-y-5">
          
          {/* Dashboard di Sintesi del Trend Storico */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-[20px] bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-[#2C2C2E] shadow-xs">
              <span className="text-xs text-slate-400 dark:text-[#8E8E93] block mb-1">Report Generati</span>
              <span className="font-numeric text-2xl font-extrabold text-slate-900 dark:text-[#F5F5F7]">
                {trendStats.totalReports}
              </span>
            </div>

            <div className="p-4 rounded-[20px] bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-[#2C2C2E] shadow-xs">
              <span className="text-xs text-slate-400 dark:text-[#8E8E93] block mb-1">Consigli Erogati</span>
              <span className="font-numeric text-2xl font-extrabold text-[#E31B23]">
                {trendStats.totalAdvices}
              </span>
            </div>

            <div className="p-4 rounded-[20px] bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-[#2C2C2E] shadow-xs">
              <span className="text-xs text-slate-400 dark:text-[#8E8E93] block mb-1">Indice Salute Attuale</span>
              <span className="font-numeric text-2xl font-extrabold text-emerald-500">
                {trendStats.latestScore}/100
              </span>
            </div>

            <div className="p-4 rounded-[20px] bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-[#2C2C2E] shadow-xs">
              <span className="text-xs text-slate-400 dark:text-[#8E8E93] block mb-1">Feedback & Approvazione AI</span>
              <span className="font-numeric text-2xl font-extrabold text-[#E31B23]">
                {trendStats.percentUtili}%
              </span>
              <span className="text-[10px] text-slate-400 dark:text-[#8E8E93] block mt-0.5">
                {trendStats.totalRated} valutati ({trendStats.totalUtili} 👍 / {trendStats.totalMigliorativi} 💡)
              </span>
            </div>
          </div>

          {/* Ripartizione Categorie Consigli e Filtro Feedback (Pillole One UI) */}
          <div className="bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-[#2C2C2E] rounded-[24px] p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100 dark:border-[#28282B]">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-[#E31B23]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F7]">
                  Filtri Trend e Valutazioni Utente
                </h3>
              </div>
              <span className="text-xs text-slate-400 dark:text-[#8E8E93]">
                Mostrati {adviceTrendList.length} di {trendStats.totalAdvices} consigli
              </span>
            </div>

            {/* Filtro per Area/Categoria */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-[#8E8E93] uppercase tracking-wider block">
                Area tematica:
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { id: 'TUTTE', label: 'Tutte le Aree' },
                  { id: 'BUDGET', label: `Budget (${trendStats.categoryCounts.BUDGET || 0})` },
                  { id: 'GESTIONE_USCITE', label: `Gestione Uscite (${trendStats.categoryCounts.GESTIONE_USCITE || 0})` },
                  { id: 'FONDI', label: `Fondi Riserva (${trendStats.categoryCounts.FONDI || 0})` },
                  { id: 'RISPARMIO', label: `Risparmio (${trendStats.categoryCounts.RISPARMIO || 0})` }
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilterCategory(f.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      filterCategory === f.id
                        ? 'bg-[#E31B23] text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-[#242426] text-slate-600 dark:text-[#8E8E93] hover:bg-slate-200 dark:hover:bg-[#2E2E32]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtro per Valutazione / Rating utente */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-[#28282B]">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-[#8E8E93] uppercase tracking-wider block">
                Stato Feedback Utente:
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { id: 'TUTTI', label: `Tutti i Consigli (${trendStats.totalAdvices})` },
                  { id: 'UTILI', label: `Valutati Utili 👍 (${trendStats.totalUtili})` },
                  { id: 'MIGLIORATIVI', label: `Da Migliorare 💡 (${trendStats.totalMigliorativi})` },
                  { id: 'NON_VALUTATI', label: `In attesa di rating (${trendStats.totalAdvices - trendStats.totalRated})` }
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilterFeedback(f.id as any)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      filterFeedback === f.id
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                        : 'bg-slate-100 dark:bg-[#242426] text-slate-600 dark:text-[#8E8E93] hover:bg-slate-200 dark:hover:bg-[#2E2E32]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Timeline / Elenco Storico dei Consigli Passati */}
          <div className="bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-[#2C2C2E] rounded-[24px] p-5 sm:p-6 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F7] mb-2">
              Cronologia Dettagliata dei Consigli Finanziari Ricevuti
            </h3>

            <div className="space-y-3">
              {adviceTrendList.map((item, idx) => (
                <div
                  key={`${item.reportId}-${item.advice.id}-${idx}`}
                  className="p-4 rounded-[18px] bg-slate-50 dark:bg-[#242426] border border-slate-100 dark:border-[#2C2C2E] flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-colors hover:border-[#E31B23]/30"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/80 dark:bg-[#2A2A2E] text-slate-700 dark:text-slate-300">
                        {item.reportLabel}
                      </span>
                      {getPriorityBadge(item.advice.priorita)}
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {item.advice.categoria}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F7]">
                      {item.advice.titolo}
                    </h4>

                    <p className="text-xs text-slate-600 dark:text-[#8E8E93] leading-relaxed">
                      {item.advice.descrizione}
                    </p>

                    <div className="p-2.5 rounded-[12px] bg-white dark:bg-[#1C1C1E] border border-slate-100 dark:border-[#2E2E32] inline-block w-full">
                      <div className="flex items-start gap-1.5">
                        <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                          {item.advice.azione_pratica}
                        </span>
                      </div>
                    </div>

                    {/* Barra di feedback anche nella timeline storica */}
                    <AdviceFeedbackBar
                      reportId={item.reportId}
                      advice={item.advice}
                      onFeedbackChange={handleFeedbackChange}
                    />
                  </div>

                  <div className="sm:text-right flex-shrink-0 space-y-1">
                    {item.advice.impatto_stimato && (
                      <div className="text-xs font-numeric font-bold text-[#E31B23]">
                        {item.advice.impatto_stimato}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReportId(item.reportId);
                        setActiveTabSub('DETTAGLIO');
                      }}
                      className="text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-semibold flex items-center gap-1 sm:justify-end cursor-pointer"
                    >
                      <span>Vedi Report</span>
                      <ArrowRight size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
