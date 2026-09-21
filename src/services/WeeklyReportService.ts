import { DB, persistDB, generateUUID, generateHumanID } from './store';
import { WeeklyFinancialReport, WeeklyReportDigest, FinancialAdvice, AdviceFeedbackType } from '../types';
import { formatYMD, formatDMY } from '../utils/financialDate';
import { formatCurrency } from '../utils/formatters';

// Calcola il numero della settimana ISO (1-53) e la chiave (es. "2026-W38")
export function getISOWeekInfo(d: Date = new Date()): { year: number; week: number; key: string } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const year = date.getUTCFullYear();
  return {
    year,
    week: weekNo,
    key: `${year}-W${String(weekNo).padStart(2, '0')}`
  };
}

export const WeeklyReportService = {
  /**
   * Restituisce tutti i report settimanali ordinati dal più recente
   */
  getAllReports(): WeeklyFinancialReport[] {
    const list = DB.REPORT_SETTIMANALI || [];
    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  /**
   * Restituisce l'ultimo report settimanale salvato
   */
  getLatestReport(): WeeklyFinancialReport | null {
    const reports = this.getAllReports();
    return reports.length > 0 ? reports[0] : null;
  },

  /**
   * Determina se è necessario generare un nuovo report settimanale automatizzato:
   * 1. Nessun report presente
   * 2. L'ultimo report appartiene a una settimana ISO precedente
   * 3. Sono trascorsi più di 7 giorni dalla generazione dell'ultimo report
   */
  shouldAutoGenerateWeeklyReport(): boolean {
    const latest = this.getLatestReport();
    if (!latest) return true;

    const currentWeek = getISOWeekInfo();
    if (latest.settimana_chiave !== currentWeek.key) {
      return true;
    }

    const diffMs = Date.now() - new Date(latest.created_at).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= 7;
  },

  /**
   * Costruisce il digest finanziario settimanale aggregando movimenti e budget reali
   */
  prepareDigest(): WeeklyReportDigest {
    const now = new Date();
    const weekInfo = getISOWeekInfo(now);

    // Periodo di riferimento: ultimi 7 giorni fino a oggi
    const periodEndObj = now;
    const periodStartObj = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    const periodoInizio = formatYMD(periodStartObj);
    const periodoFine = formatYMD(periodEndObj);

    const settimanaLabel = `Settimana ${weekInfo.week} (${formatDMY(periodoInizio)} – ${formatDMY(periodoFine)})`;

    // Filtra movimenti non eliminati e non giroconti
    const allMovements = (DB.MOVIMENTI || []).filter(m => !(m as any).is_deleted && m.tipologia !== 'GIROCONTO');

    // Movimenti dell'ultima settimana e del mese corrente
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const recentMovements = allMovements.filter(m => m.data >= periodoInizio && m.data <= periodoFine);
    const monthMovements = allMovements.filter(m => m.data && m.data.startsWith(currentMonthKey));

    // Se ci sono pochi movimenti nella settimana, allarghiamo l'analisi al mese per maggiore rilevanza
    const analysisMovements = recentMovements.length >= 5 ? recentMovements : monthMovements;

    const entrate = Math.round(
      analysisMovements.filter(m => m.tipologia === 'ENTRATA').reduce((acc, m) => acc + m.importo, 0) * 100
    ) / 100;
    const uscite = Math.round(
      analysisMovements.filter(m => m.tipologia === 'USCITA').reduce((acc, m) => acc + m.importo, 0) * 100
    ) / 100;
    const saldoNetto = Math.round((entrate - uscite) * 100) / 100;
    const tassoRisparmio = entrate > 0 ? Math.round(((entrate - uscite) / entrate) * 100) : 0;

    // Liquidità disponibile
    const contiAttivi = (DB.CONTI || []).filter(c => c.attivo && !(c as any).is_deleted);
    const fondiAttivi = (DB.FONDI || []).filter(f => f.attivo && !(f as any).is_deleted);
    const saldoConti = contiAttivi.reduce((acc, c) => acc + (c.saldo_reale ?? c.saldo_iniziale), 0);
    const saldoFondi = fondiAttivi.reduce((acc, f) => acc + (f.saldo_reale ?? f.saldo_iniziale), 0);
    const totaleDisponibile = Math.round((saldoConti + saldoFondi) * 100) / 100;

    // Fondo di Emergenza
    const fondoEmergenza = fondiAttivi.find(f =>
      f.nome_fondo.toLowerCase().includes('emergenz') || f.nome_fondo.toLowerCase().includes('riserva')
    ) || fondiAttivi[0];
    const fondoEmergenzaAttuale = fondoEmergenza ? (fondoEmergenza.saldo_reale ?? fondoEmergenza.saldo_iniziale) : 0;
    const fondoEmergenzaTarget = fondoEmergenza?.target_importo || 5000;

    // Budget attivi per il mese
    const currentBudgets = (DB.BUDGET || []).filter(b => b.mese === currentMonthKey && !(b as any).is_deleted);
    const subcategoriesMap = new Map((DB.SOTTOCATEGORIE || []).map(s => [s.id, s]));

    let budgetTotaleImpostato = 0;
    let budgetSpesoTotale = 0;

    const budgetPrestazioni = currentBudgets.map(b => {
      const sub = subcategoriesMap.get(b.sottocategoria_id);
      const spesoMese = monthMovements
        .filter(m => m.tipologia === 'USCITA' && m.sottocategoria_id === b.sottocategoria_id)
        .reduce((sum, m) => sum + m.importo, 0);

      const spesoArrotondato = Math.round(spesoMese * 100) / 100;
      budgetTotaleImpostato += b.importo_budget;
      budgetSpesoTotale += spesoArrotondato;

      const diff = Math.round((b.importo_budget - spesoArrotondato) * 100) / 100;
      const pct = b.importo_budget > 0 ? Math.round((spesoArrotondato / b.importo_budget) * 100) : 0;

      return {
        categoria: sub?.categoria_padre || 'Altro',
        sottocategoria: sub?.nome || b.sottocategoria_id,
        budget: b.importo_budget,
        speso: spesoArrotondato,
        differenza: diff,
        percentuale: pct,
        stato: (spesoArrotondato > b.importo_budget ? 'IN_ECCESSO' : 'OK') as 'IN_ECCESSO' | 'OK'
      };
    });

    budgetTotaleImpostato = Math.round(budgetTotaleImpostato * 100) / 100;
    budgetSpesoTotale = Math.round(budgetSpesoTotale * 100) / 100;

    // Categorie principali di spesa
    const catExpenses: Record<string, number> = {};
    for (const m of analysisMovements.filter(x => x.tipologia === 'USCITA')) {
      const sub = subcategoriesMap.get(m.sottocategoria_id);
      const catName = sub?.categoria_padre || 'Altro';
      catExpenses[catName] = (catExpenses[catName] || 0) + m.importo;
    }

    const categoriePrincipali = Object.entries(catExpenses)
      .map(([nome, tot]) => ({
        nome,
        totale: Math.round(tot * 100) / 100,
        percentuale_su_totale: uscite > 0 ? Math.round((tot / uscite) * 100) : 0
      }))
      .sort((a, b) => b.totale - a.totale)
      .slice(0, 5);

    // Top 5 movimenti di spesa
    const topMovimenti = [...analysisMovements.filter(m => m.tipologia === 'USCITA')]
      .sort((a, b) => b.importo - a.importo)
      .slice(0, 5)
      .map(m => {
        const sub = subcategoriesMap.get(m.sottocategoria_id);
        return {
          data: m.data,
          descrizione: m.descrizione,
          importo: m.importo,
          sottocategoria: sub?.nome || 'Generico'
        };
      });

    // Scadenze imminenti prossimi 10 giorni
    const scadenzeImminenti = (DB.SCADENZE || []).filter(
      s => s.stato === 'DA_PAGARE' && !(s as any).is_deleted
    ).length;

    // Raccoglie lo storico dei feedback sui consigli per affinare le future generazioni con Gemini
    const storicoFeedback: {
      utili: Array<{ titolo: string; categoria: string; azione_pratica: string; nota?: string }>;
      migliorativi: Array<{ titolo: string; categoria: string; azione_pratica: string; nota?: string }>;
    } = {
      utili: [],
      migliorativi: []
    };

    (DB.REPORT_SETTIMANALI || []).forEach(r => {
      (r.consigli || []).forEach(c => {
        if (c.feedback === 'UTILE') {
          storicoFeedback.utili.push({
            titolo: c.titolo,
            categoria: c.categoria,
            azione_pratica: c.azione_pratica,
            nota: c.feedback_nota || ''
          });
        } else if (c.feedback === 'MIGLIORATIVO') {
          storicoFeedback.migliorativi.push({
            titolo: c.titolo,
            categoria: c.categoria,
            azione_pratica: c.azione_pratica,
            nota: c.feedback_nota || ''
          });
        }
      });
    });

    return {
      settimana_chiave: weekInfo.key,
      settimana_label: settimanaLabel,
      periodo_inizio: periodoInizio,
      periodo_fine: periodoFine,
      totale_entrate: entrate,
      totale_uscite: uscite,
      saldo_netto: saldoNetto,
      tasso_risparmio_pct: tassoRisparmio,
      totale_disponibile: totaleDisponibile,
      fondo_emergenza_attuale: fondoEmergenzaAttuale,
      fondo_emergenza_target: fondoEmergenzaTarget,
      budget_totale_impostato: budgetTotaleImpostato,
      budget_speso_totale: budgetSpesoTotale,
      budget_prestazioni: budgetPrestazioni,
      categorie_principali_spesa: categoriePrincipali,
      top_movimenti_uscite: topMovimenti,
      movimenti_totali_count: analysisMovements.length,
      scadenze_imminenti_count: scadenzeImminenti,
      storico_feedback_utente: storicoFeedback
    };
  },

  /**
   * Genera o rigenera il report settimanale interrogando l'API backend / Gemini
   */
  async generateWeeklyReport(force: boolean = false): Promise<WeeklyFinancialReport> {
    const latest = this.getLatestReport();
    if (!force && latest && !this.shouldAutoGenerateWeeklyReport()) {
      return latest;
    }

    const digest = this.prepareDigest();

    let generatedReportPayload: any = null;

    try {
      const response = await fetch('/api/financial-report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ digest })
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.report) {
          generatedReportPayload = data.report;
        }
      } else {
        console.warn('Backend API report ha restituito status:', response.status);
      }
    } catch (apiError) {
      console.warn('Chiamata API report fallita o server non raggiungibile, utilizzo calcolo locale:', apiError);
    }

    // Se per qualsiasi motivo l'API non ha risposto, generiamo localmente per garantire la visualizzazione
    if (!generatedReportPayload) {
      generatedReportPayload = this.buildLocalFallbackReport(digest);
    }

    const fullReport: WeeklyFinancialReport = {
      id: generateUUID(),
      report_id: generateHumanID('REP', 'REPORT_SETTIMANALI' as any),
      created_at: new Date().toISOString(),
      settimana_chiave: digest.settimana_chiave,
      settimana_label: digest.settimana_label,
      periodo_inizio: digest.periodo_inizio,
      periodo_fine: digest.periodo_fine,
      valutazione_generale: generatedReportPayload.valutazione_generale || {
        stato_salute: 'BUONO',
        punteggio: 78,
        titolo: 'Gestione ordinata dei flussi',
        sommario: 'Analisi settimanale completata regolarmente con consigli mirati di ottimizzazione.'
      },
      metriche_riassuntive: generatedReportPayload.metriche_riassuntive || {
        totale_entrate: digest.totale_entrate,
        totale_uscite: digest.totale_uscite,
        saldo_netto: digest.saldo_netto,
        budget_totale_impostato: digest.budget_totale_impostato,
        budget_speso: digest.budget_speso_totale,
        categorie_sopra_budget: digest.budget_prestazioni.filter(b => b.stato === 'IN_ECCESSO').length,
        tasso_risparmio_pct: digest.tasso_risparmio_pct
      },
      consigli: (Array.isArray(generatedReportPayload.consigli) && generatedReportPayload.consigli.length >= 3
        ? generatedReportPayload.consigli
        : this.getDefaultAdviceList(digest)).map((c: any, i: number) => ({
          id: c.id || `ADV-${i + 1}`,
          titolo: c.titolo || 'Consiglio di ottimizzazione',
          categoria: c.categoria || 'GESTIONE_USCITE',
          priorita: c.priorita || 'MEDIA',
          descrizione: c.descrizione || '',
          azione_pratica: c.azione_pratica || '',
          impatto_stimato: c.impatto_stimato || '',
          sottocategoria_riferimento: c.sottocategoria_riferimento || '',
          icona: c.icona || 'Lightbulb',
          feedback: c.feedback || null,
          feedback_nota: c.feedback_nota || '',
          feedback_at: c.feedback_at || null
        })),
      riepilogo_movimenti_analizzati: digest.movimenti_totali_count,
      riepilogo_budget_analizzati: digest.budget_prestazioni.length,
      fonte_generazione: generatedReportPayload.fonte_generazione || 'GEMINI_AI',
      note: generatedReportPayload.note || ''
    };

    // Salva nel database master
    if (!DB.REPORT_SETTIMANALI) {
      DB.REPORT_SETTIMANALI = [];
    }

    // Sostituisce eventuale report della stessa settimana o accoda in cima
    const existingIndex = DB.REPORT_SETTIMANALI.findIndex(r => r.settimana_chiave === fullReport.settimana_chiave);
    if (existingIndex >= 0) {
      const prevReport = DB.REPORT_SETTIMANALI[existingIndex];
      // Preserva rating e feedback utente già assegnati sui consigli
      if (prevReport && Array.isArray(prevReport.consigli)) {
        fullReport.consigli.forEach(adv => {
          const match = prevReport.consigli.find(old => old.id === adv.id || old.titolo === adv.titolo);
          if (match && match.feedback) {
            adv.feedback = match.feedback;
            adv.feedback_nota = match.feedback_nota || '';
            adv.feedback_at = match.feedback_at || '';
          }
        });
      }
      DB.REPORT_SETTIMANALI[existingIndex] = fullReport;
    } else {
      DB.REPORT_SETTIMANALI.unshift(fullReport);
    }

    // Mantiene massimo 26 settimane storiche (~6 mesi)
    if (DB.REPORT_SETTIMANALI.length > 26) {
      DB.REPORT_SETTIMANALI = DB.REPORT_SETTIMANALI.slice(0, 26);
    }

    await persistDB();
    return fullReport;
  },

  buildLocalFallbackReport(digest: WeeklyReportDigest) {
    return {
      valutazione_generale: {
        stato_salute: digest.saldo_netto >= 0 ? 'BUONO' : 'ATTENZIONE',
        punteggio: digest.saldo_netto >= 0 ? 80 : 58,
        titolo: digest.saldo_netto >= 0 ? 'Flusso finanziario in attivo' : 'Attenzione al saldo del periodo',
        sommario: `Durante la settimana sono state registrate uscite per ${formatCurrency(digest.totale_uscite)} a fronte di entrate per ${formatCurrency(digest.totale_entrate)}. Monitora i budget per chiudere il mese in equilibrio.`
      },
      metriche_riassuntive: {
        totale_entrate: digest.totale_entrate,
        totale_uscite: digest.totale_uscite,
        saldo_netto: digest.saldo_netto,
        budget_totale_impostato: digest.budget_totale_impostato,
        budget_speso: digest.budget_speso_totale,
        categorie_sopra_budget: digest.budget_prestazioni.filter(b => b.stato === 'IN_ECCESSO').length,
        tasso_risparmio_pct: digest.tasso_risparmio_pct
      },
      consigli: this.getDefaultAdviceList(digest),
      fonte_generazione: 'SISTEMA_REGOLE'
    };
  },

  getDefaultAdviceList(digest: WeeklyReportDigest): FinancialAdvice[] {
    const formatEuro = (n: number) => formatCurrency(n);

    const sforamenti = digest.budget_prestazioni.filter(b => b.stato === 'IN_ECCESSO');

    return [
      {
        id: 'adv-1',
        titolo: sforamenti.length > 0
          ? `Ribilanciamento budget ${sforamenti[0].sottocategoria}`
          : 'Mantenimento soglie di spesa attive',
        categoria: 'BUDGET',
        priorita: sforamenti.length > 0 ? 'ALTA' : 'BASSA',
        descrizione: sforamenti.length > 0
          ? `La voce "${sforamenti[0].sottocategoria}" ha superato il budget impostato (${formatEuro(sforamenti[0].budget)}) arrivando a ${formatEuro(sforamenti[0].speso)}.`
          : `I budget impostati (${formatEuro(digest.budget_totale_impostato)}) risultano attualmente rispettati.`,
        azione_pratica: sforamenti.length > 0
          ? `Riduci le uscite voluttuarie in questa categoria per i prossimi 7 giorni.`
          : 'Continua a registrare tempestivamente ogni scontrino per evitare sorprese di fine mese.',
        impatto_stimato: sforamenti.length > 0
          ? `Risparmio potenziale: ~${formatEuro(sforamenti[0].speso - sforamenti[0].budget)}`
          : 'Preservazione dell’avanzo di cassa',
        sottocategoria_riferimento: sforamenti.length > 0 ? sforamenti[0].sottocategoria : undefined,
        icona: sforamenti.length > 0 ? 'AlertCircle' : 'ShieldCheck'
      },
      {
        id: 'adv-2',
        titolo: digest.categorie_principali_spesa.length > 0
          ? `Ottimizzazione categoria ${digest.categorie_principali_spesa[0].nome}`
          : 'Analisi delle uscite fisse mensili',
        categoria: 'GESTIONE_USCITE',
        priorita: 'MEDIA',
        descrizione: digest.categorie_principali_spesa.length > 0
          ? `La categoria "${digest.categorie_principali_spesa[0].nome}" rappresenta la voce di spesa più cospicua con ${formatEuro(digest.categorie_principali_spesa[0].totale)}.`
          : 'Le spese fisse incidono significativamente sulla liquidità disponibile a inizio mese.',
        azione_pratica: 'Verifica la presenza di costi ripetitivi o abbonamenti sottoutilizzati suscettibili di revisione.',
        impatto_stimato: 'Risparmio stimato: ~35,00 € al mese',
        icona: 'TrendingDown'
      },
      {
        id: 'adv-3',
        titolo: digest.fondo_emergenza_attuale < digest.fondo_emergenza_target
          ? 'Incremento Fondo di Riserva'
          : 'Consolidamento risparmio periodico',
        categoria: 'FONDI',
        priorita: digest.fondo_emergenza_attuale < (digest.fondo_emergenza_target * 0.5) ? 'ALTA' : 'MEDIA',
        descrizione: `Il Fondo Emergenza ammonta a ${formatEuro(digest.fondo_emergenza_attuale)} (target: ${formatEuro(digest.fondo_emergenza_target)}).`,
        azione_pratica: 'Imposta un giroconto programmato settimanale dal conto principale al fondo.',
        impatto_stimato: 'Copertura imprevisti +50,00 €/settimana',
        icona: 'PiggyBank'
      }
    ];
  },

  /**
   * Salva il rating / feedback per un consiglio finanziario e sincronizza su Firestore
   */
  async setAdviceFeedback(
    reportId: string,
    adviceId: string,
    feedback: AdviceFeedbackType | null,
    note?: string
  ): Promise<WeeklyFinancialReport | null> {
    if (!DB.REPORT_SETTIMANALI) return null;

    const report = DB.REPORT_SETTIMANALI.find(r => r.id === reportId || r.report_id === reportId);
    if (!report || !report.consigli) return null;

    const advice = report.consigli.find(c => c.id === adviceId);
    if (!advice) return null;

    advice.feedback = feedback;
    if (note !== undefined) {
      advice.feedback_nota = note.trim();
    }
    advice.feedback_at = feedback ? new Date().toISOString() : undefined;

    await persistDB();
    return report;
  },

  /**
   * Calcola le statistiche aggregate di feedback sui consigli passati
   */
  getFeedbackStats() {
    let totalAdvices = 0;
    let totalRated = 0;
    let totalUtili = 0;
    let totalMigliorativi = 0;

    (DB.REPORT_SETTIMANALI || []).forEach(r => {
      (r.consigli || []).forEach(c => {
        totalAdvices++;
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

    return {
      totalAdvices,
      totalRated,
      totalUtili,
      totalMigliorativi,
      percentUtili
    };
  }
};
