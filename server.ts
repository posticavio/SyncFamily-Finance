import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const PORT = 3000;
const app = express();

app.use(express.json({ limit: '10mb' }));

// Lazy initialization client Gemini
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// Algoritmo di riserva per calcolo consigli deterministici basati sui dati reali (in caso di quota esaurita o assenza temporanea di rete)
function generateDeterministicReport(digest: any) {
  const entrate = Number(digest.totale_entrate) || 0;
  const uscite = Number(digest.totale_uscite) || 0;
  const saldoNetto = Math.round((entrate - uscite) * 100) / 100;
  const budgetTotale = Number(digest.budget_totale_impostato) || 0;
  const budgetSpeso = Number(digest.budget_speso_totale) || 0;
  const fondoEmergenza = Number(digest.fondo_emergenza_attuale) || 0;
  const fondoTarget = Number(digest.fondo_emergenza_target) || 0;

  const budgetPrestazioni = Array.isArray(digest.budget_prestazioni) ? digest.budget_prestazioni : [];
  const categorieSpesa = Array.isArray(digest.categorie_principali_spesa) ? digest.categorie_principali_spesa : [];
  const sforamenti = budgetPrestazioni.filter((b: any) => b.stato === 'IN_ECCESSO' || b.percentuale > 100);

  // Calcolo punteggio di salute finanziaria (0 - 100)
  let punteggio = 75;
  if (saldoNetto > 0) punteggio += 10;
  else if (saldoNetto < -200) punteggio -= 15;

  if (sforamenti.length === 0 && budgetTotale > 0) punteggio += 10;
  else punteggio -= (sforamenti.length * 5);

  if (fondoEmergenza >= fondoTarget && fondoTarget > 0) punteggio += 5;
  punteggio = Math.max(20, Math.min(98, Math.round(punteggio)));

  let statoSalute: 'OTTIMO' | 'BUONO' | 'ATTENZIONE' | 'CRITICO' = 'BUONO';
  if (punteggio >= 85) statoSalute = 'OTTIMO';
  else if (punteggio >= 70) statoSalute = 'BUONO';
  else if (punteggio >= 50) statoSalute = 'ATTENZIONE';
  else statoSalute = 'CRITICO';

  const formatEuro = (val: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);

  const consigli: any[] = [];

  // Consiglio 1: Gestione dei Budget sforati o a rischio
  if (sforamenti.length > 0) {
    const peggiore = sforamenti.reduce((prev: any, curr: any) =>
      (curr.speso - curr.budget) > (prev.speso - prev.budget) ? curr : prev, sforamenti[0]);
    const extra = Math.round((peggiore.speso - peggiore.budget) * 100) / 100;
    consigli.push({
      id: 'tip-budget-1',
      titolo: `Rientro nel budget ${peggiore.sottocategoria || peggiore.categoria}`,
      categoria: 'BUDGET',
      priorita: 'ALTA',
      descrizione: `La voce "${peggiore.sottocategoria || peggiore.categoria}" ha superato il tetto mensile stabilito (${formatEuro(peggiore.budget)}) con una spesa attuale di ${formatEuro(peggiore.speso)} (sforamento di ${formatEuro(extra)}).`,
      azione_pratica: `Limita le spese non essenziali in questa categoria per i restanti giorni del mese o ricolloca ${formatEuro(extra)} da una categoria in avanzo.`,
      impatto_stimato: `Risparmio / recupero: ~${formatEuro(extra)}`,
      sottocategoria_riferimento: peggiore.sottocategoria,
      icona: 'AlertCircle'
    });
  } else {
    // Consiglio di mantenimento budget
    consigli.push({
      id: 'tip-budget-ok',
      titolo: 'Ottima disciplina sui massimali di spesa',
      categoria: 'BUDGET',
      priorita: 'BASSA',
      descrizione: `Tutte le categorie di spesa con budget attivo si trovano sotto la soglia stabilita (${formatEuro(budgetSpeso)} spesi su ${formatEuro(budgetTotale)} totali).`,
      azione_pratica: `Mantieni questo ritmo di monitoraggio settimanale: l'avanzo stimato potrà confluire nel fondo liquidità a fine periodo.`,
      impatto_stimato: `Avanzo previsto: ~${formatEuro(Math.max(0, budgetTotale - budgetSpeso))}`,
      icona: 'ShieldCheck'
    });
  }

  // Consiglio 2: Analisi categoria con maggior esborso o uscite discrezionali
  if (categorieSpesa.length > 0) {
    const topCat = categorieSpesa[0];
    const targetRisparmio = Math.round(topCat.totale * 0.12 * 100) / 100;
    consigli.push({
      id: 'tip-spesa-2',
      titolo: `Ottimizzazione della voce principale (${topCat.nome})`,
      categoria: 'GESTIONE_USCITE',
      priorita: 'MEDIA',
      descrizione: `La categoria "${topCat.nome}" assorbe ${formatEuro(topCat.totale)}, pari al ${topCat.percentuale_su_totale}% delle tue uscite totali analizzate.`,
      azione_pratica: `Esamina i singoli scontrini della settimana per individuare acquisti impulsivi o abbonamenti sovrapposti: un taglio del 10-15% è facilmente realizzabile.`,
      impatto_stimato: `Risparmio potenziale: ~${formatEuro(targetRisparmio)}/mese`,
      sottocategoria_riferimento: topCat.nome,
      icona: 'TrendingDown'
    });
  } else {
    consigli.push({
      id: 'tip-spesa-generic',
      titolo: 'Tracciamento capillare dei micro-esborsi',
      categoria: 'GESTIONE_USCITE',
      priorita: 'MEDIA',
      descrizione: 'I piccoli pagamenti quotidiani sotto i 15 € spesso passano inosservati ma erodono la capacità di risparmio a fine mese.',
      azione_pratica: 'Registra tempestivamente ogni spesa in contanti o digitale per mantenere aggiornato il forecast.',
      impatto_stimato: 'Controllo completo della liquidità',
      icona: 'Zap'
    });
  }

  // Consiglio 3: Fondo Emergenza o Destinazione Saldo Netto
  if (fondoTarget > 0 && fondoEmergenza < fondoTarget) {
    const mancante = Math.round((fondoTarget - fondoEmergenza) * 100) / 100;
    const quotaSettimanale = Math.min(saldoNetto > 0 ? Math.round(saldoNetto * 0.3) : 50, 150);
    consigli.push({
      id: 'tip-fondo-3',
      titolo: 'Rafforzamento del Fondo di Emergenza',
      categoria: 'FONDI',
      priorita: fondoEmergenza < (fondoTarget * 0.5) ? 'ALTA' : 'MEDIA',
      descrizione: `Il tuo Fondo di Emergenza dispone di ${formatEuro(fondoEmergenza)} rispetto all'obiettivo di ${formatEuro(fondoTarget)} (copertura al ${Math.round((fondoEmergenza / fondoTarget) * 100)}%). Mancano ${formatEuro(mancante)}.`,
      azione_pratica: `Imposta un accantonamento automatico di ${formatEuro(quotaSettimanale > 0 ? quotaSettimanale : 50)} questa settimana destinato direttamente al fondo.`,
      impatto_stimato: `Protezione imprevisti: +${formatEuro(quotaSettimanale > 0 ? quotaSettimanale : 50)}/settimana`,
      icona: 'PiggyBank'
    });
  } else {
    const quotaRisparmio = saldoNetto > 0 ? Math.round(saldoNetto * 0.2) : 50;
    consigli.push({
      id: 'tip-risparmio-3',
      titolo: 'Strategia di risparmio e accantonamento attivo',
      categoria: 'RISPARMIO',
      priorita: 'MEDIA',
      descrizione: `Con un flusso netto di ${formatEuro(saldoNetto)}, hai un margine per consolidare la tua riserva finanziaria o finanziare progetti familiari futuri.`,
      azione_pratica: `Alloca il 20% del saldo positivo (${formatEuro(quotaRisparmio)}) verso uno dei fondi salvadanaio o un piano di accumulo.`,
      impatto_stimato: `Capitale accantonato: +${formatEuro(quotaRisparmio)}/mese`,
      icona: 'PiggyBank'
    });
  }

  // Se mancano ancora consigli per arrivare a 3 (garanzia assoluta di almeno 3 consigli):
  if (consigli.length < 3) {
    consigli.push({
      id: 'tip-ottimizzazione-4',
      titolo: 'Verifica delle scadenze e costi fissi',
      categoria: 'OTTIMIZZAZIONE',
      priorita: 'BASSA',
      descrizione: 'Rivedere periodicamente le bollette domestiche e le utenze telefoniche garantisce risparmi stabili nel lungo periodo.',
      azione_pratica: 'Confronta le tariffe delle bollette dell’ultimo trimestre con le offerte attuali di mercato.',
      impatto_stimato: 'Risparmio stimato: 15-25 €/mese',
      icona: 'Lightbulb'
    });
  }

  return {
    valutazione_generale: {
      stato_salute: statoSalute,
      punteggio,
      titolo: statoSalute === 'OTTIMO' ? 'Equilibrio eccellente e controllo solido' :
             statoSalute === 'BUONO' ? 'Gestione positiva con margini di ottimizzazione' :
             statoSalute === 'ATTENZIONE' ? 'Alcune aree di spesa richiedono attenzione' : 'Disavanzo settimanale da correggere',
      sommario: `Settimana con entrate di ${formatEuro(entrate)} e uscite di ${formatEuro(uscite)} (saldo ${saldoNetto >= 0 ? '+' : ''}${formatEuro(saldoNetto)}). ${sforamenti.length > 0 ? `Si registrano ${sforamenti.length} categorie sopra il budget.` : 'Tutti i budget correnti risultano sotto controllo.'}`
    },
    metriche_riassuntive: {
      totale_entrate: entrate,
      totale_uscite: uscite,
      saldo_netto: saldoNetto,
      budget_totale_impostato: budgetTotale,
      budget_speso: budgetSpeso,
      categorie_sopra_budget: sforamenti.length,
      tasso_risparmio_pct: entrate > 0 ? Math.round(((entrate - uscite) / entrate) * 100) : 0
    },
    consigli,
    riepilogo_movimenti_analizzati: Number(digest.movimenti_totali_count) || 0,
    riepilogo_budget_analizzati: budgetPrestazioni.length,
    fonte_generazione: 'SISTEMA_REGOLE'
  };
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/financial-report/status', (req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY;
  res.json({
    ready: true,
    hasGeminiKey: hasKey,
    model: 'gemini-3.8-flash',
    cadence: 'WEEKLY'
  });
});

app.post('/api/financial-report/generate', async (req, res) => {
  try {
    const { digest } = req.body;
    if (!digest) {
      return res.status(400).json({ error: 'Digest finanziario mancante nel body della richiesta' });
    }

    const ai = getAI();

    // Se l'API key non è configurata, usiamo il motore intelligente deterministico
    if (!ai) {
      console.log('GEMINI_API_KEY non configurata: generazione report tramite motore finanziario deterministico.');
      const fallbackReport = generateDeterministicReport(digest);
      return res.json({
        report: fallbackReport,
        notice: 'Report generato tramite motore di analisi integrato (chiave Gemini non configurata nel server).'
      });
    }

    // Costruzione della sezione feedback storico per affinare l'output con Gemini
    let feedbackPromptSection = '';
    const feedbackData = digest.storico_feedback_utente;
    if (feedbackData) {
      const utili = Array.isArray(feedbackData.utili) ? feedbackData.utili.slice(0, 6) : [];
      const migliorativi = Array.isArray(feedbackData.migliorativi) ? feedbackData.migliorativi.slice(0, 6) : [];

      if (utili.length > 0 || migliorativi.length > 0) {
        feedbackPromptSection = `
FEEDBACK PREGRESSI DELL'UTENTE SUI CONSIGLI (APPRENDIMENTO CONTINUO):
L'utente ha valutato i consigli finanziari delle settimane precedenti:
${utili.length > 0 ? `\n[CONSIGLI VALUTATI COME 'UTILI' DALL'UTENTE]:\n${utili.map((u: any, idx: number) => `  ${idx + 1}. "${u.titolo}" [${u.categoria}]: Azione: "${u.azione_pratica}"${u.nota ? ` (Nota utente: "${u.nota}")` : ''}`).join('\n')}\n  -> DIRETTIVA: Mantieni questo tono pragmatico, diretto e quantitativo che l'utente ha trovato utile.` : ''}
${migliorativi.length > 0 ? `\n[CONSIGLI CONTRASSEGNATI COME 'MIGLIORATIVI' DALL'UTENTE]:\n${migliorativi.map((m: any, idx: number) => `  ${idx + 1}. "${m.titolo}" [${m.categoria}]: Azione: "${m.azione_pratica}"${m.nota ? ` (Motivo/Critica utente: "${m.nota}")` : ''}`).join('\n')}\n  -> DIRETTIVA: NON proporre consigli generici o astratti simili a questi. Proponi soluzioni più fattibili, incisive e modellate sui dati effettivi della famiglia.` : ''}
`;
      }
    }

    // Costruzione del prompt approfondito per Gemini
    const prompt = `
Sei un Senior Financial Advisor esperto nella gestione delle finanze familiari e budgeting personale.
Il tuo compito è analizzare con assoluta precisione il riepilogo settimanale dei movimenti e dei budget forniti di seguito, e generare un report automatizzato ad alto valore pratico.

DATI FINANZIARI SETTIMANALI:
- Periodo di riferimento: ${digest.settimana_label || digest.settimana_chiave} (${digest.periodo_inizio} - ${digest.periodo_fine})
- Totale Entrate: ${digest.totale_entrate} €
- Totale Uscite: ${digest.totale_uscite} €
- Saldo Netto del Periodo: ${digest.saldo_netto} €
- Tasso di Risparmio: ${digest.tasso_risparmio_pct}%
- Liquidità Totale Disponibile (Conti + Fondi): ${digest.totale_disponibile} €
- Fondo Emergenza Attuale: ${digest.fondo_emergenza_attuale} € (Obiettivo target: ${digest.fondo_emergenza_target} €)
- Budget Totale Impostato per il mese: ${digest.budget_totale_impostato} €
- Totale Speso sui Budget: ${digest.budget_speso_totale} €
- Categorie e Sottocategorie analizzate con Budget:
${JSON.stringify(digest.budget_prestazioni || [], null, 2)}
- Categorie Principali di Spesa (Top Spese):
${JSON.stringify(digest.categorie_principali_spesa || [], null, 2)}
- Principali Movimenti di Uscita recenti:
${JSON.stringify(digest.top_movimenti_uscite || [], null, 2)}
- Numero movimenti analizzati: ${digest.movimenti_totali_count || 0}
- Scadenze imminenti in arrivo: ${digest.scadenze_imminenti_count || 0}
${feedbackPromptSection}
REQUISITI TASSATIVI:
1. Genera ESATTAMENTE una struttura JSON valida che rispecchi lo schema specificato sotto.
2. Fornisci ALMENO TRE (3) consigli finanziari personalizzati (puoi fornirne 3 o 4), ciascuno con:
   - "id": stringa univoca
   - "titolo": frase sintetica e accattivante (max 8 parole)
   - "categoria": uno tra "BUDGET" | "RISPARMIO" | "GESTIONE_USCITE" | "FONDI" | "OTTIMIZZAZIONE"
   - "priorita": uno tra "ALTA" | "MEDIA" | "BASSA"
   - "descrizione": analisi dettagliata che cita ESPLICITAMENTE i numeri reali (es. importi in €, percentuali e categorie del digest fornito)
   - "azione_pratica": passo concreto e fattibile che l'utente o la famiglia può compiere questa settimana
   - "impatto_stimato": quantificazione economica in euro stimata (es. "Risparmio di circa 40,00 €" o "+60,00 € al mese")
   - "sottocategoria_riferimento": nome della sottocategoria specifica se pertinente
   - "icona": nome icona Lucide (tra: "AlertCircle", "TrendingDown", "PiggyBank", "ShieldCheck", "Lightbulb", "Zap", "ShoppingBag", "Wallet")
3. Valutazione Generale:
   - "stato_salute": "OTTIMO" (se punteggio >= 85), "BUONO" (70-84), "ATTENZIONE" (50-69), "CRITICO" (<50)
   - "punteggio": intero tra 1 e 100
   - "titolo": breve giudizio d'insieme
   - "sommario": sintesi chiara di 2-3 frasi sull'andamento della settimana e punti di attenzione
4. OTTIMIZZAZIONE APPRENDIMENTO SUI FEEDBACK:
   - Se sono presenti feedback storici, adatta attivamente lo stile: privilegia gli spunti affini a quelli valutati 'UTILI' e modifica radicalmente l'impostazione di quelli contrassegnati come 'MIGLIORATIVI'.

SCHEMA JSON RICHIESTO:
{
  "valutazione_generale": {
    "stato_salute": "OTTIMO" | "BUONO" | "ATTENZIONE" | "CRITICO",
    "punteggio": 82,
    "titolo": "...",
    "sommario": "..."
  },
  "metriche_riassuntive": {
    "totale_entrate": ${digest.totale_entrate},
    "totale_uscite": ${digest.totale_uscite},
    "saldo_netto": ${digest.saldo_netto},
    "budget_totale_impostato": ${digest.budget_totale_impostato},
    "budget_speso": ${digest.budget_speso_totale},
    "categorie_sopra_budget": 0,
    "tasso_risparmio_pct": ${digest.tasso_risparmio_pct}
  },
  "consigli": [
    {
      "id": "tip-1",
      "titolo": "...",
      "categoria": "BUDGET",
      "priorita": "ALTA",
      "descrizione": "...",
      "azione_pratica": "...",
      "impatto_stimato": "...",
      "sottocategoria_riferimento": "...",
      "icona": "AlertCircle"
    }
  ]
}

Restituisci ESCLUSIVAMENTE l'oggetto JSON puro, senza blocchi di codice markdown né testo prima o dopo.
`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2
        }
      });

      const responseText = response.text || '';
      let parsedData: any = null;

      try {
        // Pulizia eventuale markdown wrapper se presente
        const cleanJson = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        parsedData = JSON.parse(cleanJson);
      } catch (parseErr) {
        console.warn('Errore parsing JSON da risposta Gemini:', parseErr, 'Testo:', responseText);
      }

      if (parsedData && Array.isArray(parsedData.consigli) && parsedData.consigli.length >= 3) {
        return res.json({
          report: {
            ...parsedData,
            riepilogo_movimenti_analizzati: Number(digest.movimenti_totali_count) || 0,
            riepilogo_budget_analizzati: Array.isArray(digest.budget_prestazioni) ? digest.budget_prestazioni.length : 0,
            fonte_generazione: 'GEMINI_AI'
          }
        });
      } else {
        console.warn('Gemini ha risposto ma la struttura non ha soddisfatto i requisiti. Utilizzo fallback deterministico.');
        const fallback = generateDeterministicReport(digest);
        return res.json({
          report: fallback,
          notice: 'Applicate regole di validazione finanziaria integrata.'
        });
      }
    } catch (geminiError: any) {
      console.error('Errore chiamata Gemini API:', geminiError?.message || geminiError);
      // Fallback trasparente per garantire che l'utente riceva sempre il report
      const fallback = generateDeterministicReport(digest);
      return res.json({
        report: fallback,
        notice: 'Report settimanale generato con algoritmo locale a causa del superamento temporaneo di quota API.'
      });
    }
  } catch (error: any) {
    console.error('Errore generale nella generazione report:', error);
    res.status(500).json({ error: error.message || 'Errore interno durante la generazione del report' });
  }
});

// ----------------------------------------------------
// VITE MIDDLEWARE SETUP (DEV & PROD)
// ----------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Finanze Familiari Server in esecuzione su http://0.0.0.0:${PORT}`);
  });
}

startServer();
