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

// Endpoint OCR Scontrini & Ricevute con Gemini Vision (gemini-3.8-flash)
app.post('/api/scan-receipt', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', subcategories = [] } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Immagine scontrino mancante (imageBase64)' });
    }

    const ai = getAI();
    if (!ai) {
      return res.status(503).json({
        error: 'Servizio Gemini non configurato (GEMINI_API_KEY assente)'
      });
    }

    // Costruzione elenco categorie note per agevolare il matching contestuale
    const subcatList = Array.isArray(subcategories) && subcategories.length > 0
      ? `Ecco l'elenco delle sottocategorie disponibili nell'app: ${subcategories.map((s: any) => `"${s.nome}" (${s.tipo || 'USCITA'})`).join(', ')}.`
      : '';

    const prompt = `
Sei un assistente esperto nell'analisi e digitalizzazione di scontrini fiscali, fatture e ricevute di pagamento.
Analizza con estrema precisione l'immagine dello scontrino fornita.

${subcatList}

Estrai e restituisci ESCLUSIVAMENTE un oggetto JSON valido con questi campi:
{
  "importo": 12.50, // Importo TOTALE FINALE pagato come numero decimale
  "descrizione": "Nome Commerciante / Negozio o sintesi spesa", // Es: "Esselunga", "Farmacia San Carlo", "Ristorante Il Moro", "Eni Station"
  "data": "YYYY-MM-DD", // Data dello scontrino se leggibile (altrimenti null o data odierna)
  "sottocategoria_suggerita": "Nome della sottocategoria più affine", // Scegli tra quelle dell'elenco fornito se presente, es: "Spesa Supermercato", "Farmaci", "Carburante", "Ristoranti"
  "necessita_suggerita": "DEVO" | "HO_BISOGNO" | "VOGLIO", // 50/30/20: DEVO (spese fisse, utenze), HO_BISOGNO (cibo, farmaci, benzina), VOGLIO (ristorante, shopping, svago)
  "dettaglio_articoli": ["Articolo 1 - 3,50 €", "Articolo 2 - 9,00 €"], // Elenco stringhe dei prodotti rilevati (opzionale se visibili)
  "confidenza": "ALTA" | "MEDIA" | "BASSA"
}

Restituisci ESCLUSIVAMENTE il JSON puro, senza blocchi markdown né testo introduttivo.
`;

    // Pulizia base64 se include data:image/xxx;base64,
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: mimeType
              }
            },
            {
              text: prompt
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    });

    const text = response.text || '';
    const cleanJson = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const result = JSON.parse(cleanJson);

    return res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    console.error('Errore analisi scontrino con Gemini Vision:', err);
    return res.status(500).json({
      error: err?.message || 'Errore durante la scansione dello scontrino con Gemini Vision'
    });
  }
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

// Funzione di formattazione del testo per una lettura naturale senza asterischi o sigle tecniche
function formatNaturalResponse(text: string): string {
  if (!text) return '';
  return text
    // Rimuove intestazioni markdown pesanti
    .replace(/^#{1,6}\s+/gm, '')
    // Rimuove tutti gli asterischi (grassetto e corsivo)
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    // Sostituisce eventuali punti elenco ad asterisco con trattini lineari puliti
    .replace(/^\s*\*\s+/gm, '- ')
    // Traduzione in italiano naturale di eventuali sigle o tag tecnici sfuggiti
    .replace(/\bHO_BISOGNO\b/gi, 'necessità quotidiana')
    .replace(/\bBISOGNO\b/gi, 'necessità')
    .replace(/\bDEVO\b/gi, 'spesa fissa inderogabile')
    .replace(/\bVOGLIO\b/gi, 'spesa discrezionale')
    .replace(/\bDESIDERIO\b/gi, 'svago o piacere')
    .replace(/\bRISPARMIO\b/gi, 'risparmio')
    .replace(/\bUSCITA\b/gi, 'spesa')
    .replace(/\bENTRATA\b/gi, 'entrata')
    .trim();
}

// Funzione di risposta locale intelligente per Chatbot basata sui dati dell'applicazione
function generateLocalChatResponse(userQuery: string, data: any): string {
  const query = (userQuery || '').toLowerCase();
  const formatEuro = (v: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(v) || 0);

  const entrate = Number(data?.entrate) || 0;
  const uscite = Number(data?.uscite) || 0;
  const saldo = entrate - uscite;
  const conti = Array.isArray(data?.conti) ? data.conti : [];
  const topSpese = Array.isArray(data?.topSpese) ? data.topSpese : [];
  const ripartizione = data?.ripartizione503020 || {};
  const budgetList = Array.isArray(data?.budget) ? data.budget : [];
  const sforamenti = budgetList.filter((b: any) => Number(b.speso) > Number(b.importo));

  if (query.includes('50/30/20') || query.includes('devo') || query.includes('bisogno') || query.includes('voglio') || query.includes('modello')) {
    const devo = Number(ripartizione.devo) || 0;
    const bisogno = Number(ripartizione.ho_bisogno) || 0;
    const voglio = Number(ripartizione.voglio) || 0;
    const devoPct = entrate > 0 ? Math.round((devo / entrate) * 100) : 0;
    const bisognoPct = entrate > 0 ? Math.round((bisogno / entrate) * 100) : 0;
    const voglioPct = entrate > 0 ? Math.round((voglio / entrate) * 100) : 0;

    return `Ecco l'analisi della tua ripartizione ideale 50/30/20 calcolata su entrate totali di ${formatEuro(entrate)}:

- Spese fisse e impegni inderogabili (quota ideale 50%): Hai speso ${formatEuro(devo)}, pari al ${devoPct}% delle tue entrate. ${devoPct > 50 ? 'Questo valore supera la soglia raccomandata del 50%.' : 'La quota è in perfetto equilibrio.'}
- Necessità quotidiane e consumi primari (quota ideale 30%): Hai speso ${formatEuro(bisogno)}, pari al ${bisognoPct}% delle entrate. ${bisognoPct > 30 ? 'Leggermente oltre il 30%.' : 'Ottima gestione.'}
- Spese discrezionali, svago e desideri (quota ideale 20%): Hai speso ${formatEuro(voglio)}, pari al ${voglioPct}% delle entrate.

Un consiglio pratico: ${devoPct > 50 ? 'Le spese fisse vincolano oltre la metà delle entrate. Valuta una revisione dei contratti utenze o delle condizioni dei finanziamenti per recuperare margine.' : 'Mantieni questo equilibrio per destinare una parte costante al tuo fondo di risparmio.'}`;
  }

  if (query.includes('budget') || query.includes('sforat') || query.includes('rischio')) {
    if (sforamenti.length === 0) {
      return `Ottime notizie sui tuoi budget: nessuna sottocategoria ha superato il tetto mensile stabilito. Tutti i budget monitorati sono in sicurezza. Continua con questo ritmo di spesa!`;
    }
    const dettagli = sforamenti.map((s: any) => {
      const diff = Number(s.speso) - Number(s.importo);
      return `- ${s.nome || s.sottocategoria}: spesi ${formatEuro(s.speso)} rispetto al tetto di ${formatEuro(s.importo)} (superamento di ${formatEuro(diff)})`;
    }).join('\n');

    return `Attenzione, ci sono ${sforamenti.length} categorie che hanno superato il budget previsto:\n\n${dettagli}\n\nUn consiglio utile: nei giorni restanti del mese cerca di limitare le spese non urgenti in queste voci o attingi da categorie in cui hai ancora margine disponibile.`;
  }

  if (query.includes('consigli') || query.includes('risparm') || query.includes('ottimizz')) {
    const topNome = topSpese[0]?.nome || 'Spese Extra';
    const topImporto = topSpese[0]?.importo || 0;
    return `Ecco tre consigli concreti formulati analizzando i tuoi movimenti di questo mese:

1. Ottimizzazione della voce principale (${topNome}, per cui hai speso ${formatEuro(topImporto)}):
Trattandosi della spesa più consistente, una piccola riduzione del 10% sugli acquisti discrezionali ti permetterebbe di liberare subito circa ${formatEuro(topImporto * 0.1)}.

2. Monitoraggio del saldo netto (${saldo >= 0 ? '+' : ''}${formatEuro(saldo)}):
${saldo > 0 ? `Hai un avanzo favorevole di ${formatEuro(saldo)}. Il momento ideale per spostare una parte di questa liquidità verso il tuo fondo emergenza.` : `Al momento registri un disavanzo di ${formatEuro(Math.abs(saldo))}. Ti conviene rallentare le spese per il tempo libero fino a fine mese.`}

3. Allineamento delle rate e ricorrenze:
Verifica che le scadenze delle rate cadano nei giorni immediatamente successivi all'accredito dello stipendio, così da preservare la disponibilità sul conto principale ed evitare scoperti.`;
  }

  if (query.includes('posso spendere') || query.includes('spendere ancora') || query.includes('margine')) {
    const margineDisponibile = Math.max(0, saldo);
    const budgetTotale = budgetList.reduce((acc: number, b: any) => acc + (Number(b.importo) || 0), 0);
    const spesoBudget = budgetList.reduce((acc: number, b: any) => acc + (Number(b.speso) || 0), 0);
    const budgetRimanente = Math.max(0, budgetTotale - spesoBudget);

    return `In base ai tuoi dati finanziari attuali:
- Saldo netto del mese: ${saldo >= 0 ? '+' : ''}${formatEuro(saldo)} (entrate ${formatEuro(entrate)} - uscite ${formatEuro(uscite)})
- Margine residuo sui budget impostati: ${formatEuro(budgetRimanente)}

Consiglio operativo:
Per arrivare a fine mese senza intaccare il tuo risparmio, ti suggerisco di contenere le uscite discrezionali entro ${formatEuro(margineDisponibile > 0 ? margineDisponibile * 0.7 : 0)}. Questo ti lascerà un margine di sicurezza per eventuali imprevisti.`;
  }

  if (query.includes('previsione') || query.includes('fine mese') || query.includes('proiezione')) {
    const oggi = new Date();
    const giornoAttuale = Math.max(1, oggi.getDate());
    const giorniTotaliMese = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0).getDate();
    const giorniRimanenti = Math.max(0, giorniTotaliMese - giornoAttuale);
    const spesaMediaGiornaliera = uscite / giornoAttuale;
    const spesaPrevistaMese = uscite + (spesaMediaGiornaliera * giorniRimanenti);
    const saldoStimatoFineMese = entrate - spesaPrevistaMese;

    return `Ecco la proiezione stimata per la fine del mese in corso:
- Spesa media giornaliera attuale: ${formatEuro(spesaMediaGiornaliera)} al giorno (calcolata su ${giornoAttuale} giorni)
- Spesa totale stimata a fine mese: ${formatEuro(spesaPrevistaMese)}
- Saldo netto stimato a fine mese: ${saldoStimatoFineMese >= 0 ? '+' : ''}${formatEuro(saldoStimatoFineMese)}

${saldoStimatoFineMese >= 0 
  ? `Se mantieni l'attuale ritmo di spesa, chiuderai il mese in positivo con un ottimo avanzo di ${formatEuro(saldoStimatoFineMese)}.` 
  : `Attenzione: continuando con questa media giornaliera rischi di chiudere con un disavanzo di ${formatEuro(Math.abs(saldoStimatoFineMese))}. Ti conviene rallentare le uscite discrezionali nei prossimi ${giorniRimanenti} giorni.`}`;
  }

  if (query.includes('analizza spese') || query.includes('analisi spese')) {
    const prima = topSpese[0];
    const altre = topSpese.slice(1, 5);
    let testo = `Analisi dettagliata delle tue spese per questo mese:\n- Uscite totali registrate: ${formatEuro(uscite)}\n`;
    if (prima) {
      const incidenza = uscite > 0 ? Math.round((prima.importo / uscite) * 100) : 0;
      testo += `- Spesa principale: ${prima.nome} (${formatEuro(prima.importo)}, che assorbe il ${incidenza}% delle tue uscite totali)\n`;
    }
    if (altre.length > 0) {
      testo += `\nAltre categorie di spesa significative:\n`;
      altre.forEach((item: any) => {
        const pct = uscite > 0 ? Math.round((item.importo / uscite) * 100) : 0;
        testo += `- ${item.nome}: ${formatEuro(item.importo)} (${pct}%)\n`;
      });
    }
    testo += `\nRapporto con le entrate: Hai speso il ${entrate > 0 ? Math.round((uscite / entrate) * 100) : 0}% di quanto incassato, lasciando un saldo netto di ${saldo >= 0 ? '+' : ''}${formatEuro(saldo)}.`;
    return testo;
  }

  if (query.includes('maggior') || query.includes('più alta') || query.includes('spes') || query.includes('top') || query.includes('uscit')) {
    if (topSpese.length === 0) {
      return `Al momento le tue uscite complessive registrate per questo mese ammontano a ${formatEuro(uscite)}.`;
    }
    const prima = topSpese[0];
    const altre = topSpese.slice(1, 4);

    let testo = `Nel mese in corso la spesa maggiore in assoluto che hai sostenuto riguarda la voce ${prima.nome}, con un importo complessivo di ${formatEuro(prima.importo)}.\n\n`;
    if (altre.length > 0) {
      testo += `Subito dopo, le uscite più rilevanti sono:\n`;
      altre.forEach((item: any, i: number) => {
        testo += `- ${item.nome}: ${formatEuro(item.importo)}\n`;
      });
    }
    testo += `\nIn totale le uscite registrate per il periodo ammontano a ${formatEuro(uscite)}.`;
    return testo;
  }

  if (query.includes('conto') || query.includes('conti') || query.includes('saldo') || query.includes('liquidit')) {
    const elencoConti = conti.map((c: any) =>
      `- ${c.nome_conto || c.nome}: ${formatEuro(c.saldo_reale ?? c.saldo ?? 0)}`
    ).join('\n');
    return `Panoramica dei tuoi conti disponibili:\n\n${elencoConti || 'Nessun conto configurato'}\n\nIl saldo netto del periodo è pari a ${formatEuro(saldo)}.`;
  }

  // Risposta generica basata sullo stato finanziario
  return `Ecco il riepilogo finanziario attuale:\n- Entrate totali: ${formatEuro(entrate)}\n- Uscite totali: ${formatEuro(uscite)}\n- Saldo netto: ${saldo >= 0 ? '+' : ''}${formatEuro(saldo)}\n- Conti attivi: ${conti.length}\n\nPuoi chiedermi ad esempio:\n- Qual è stata la mia spesa maggiore questo mese?\n- Come sta andando la regola 50/30/20?\n- Ho dei budget a rischio sforamento?\n- Dammi consigli pratici per risparmiare.`;
}

// Endpoint Chatbot Finanziario Multi-turn Gemini AI
app.post('/api/gemini-chat', async (req, res) => {
  try {
    const { messages, contextData } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messaggi mancanti o non validi' });
    }

    const ai = getAI();
    const lastUserMessage = messages[messages.length - 1]?.content || '';

    // Se l'API key non è configurata, usiamo il motore finanziario locale
    if (!ai) {
      const rawReply = generateLocalChatResponse(lastUserMessage, contextData);
      return res.json({ reply: formatNaturalResponse(rawReply), source: 'LOCAL_ENGINE' });
    }

    const systemInstruction = `
Sei il consulente e assistente finanziario personale per l'applicazione "Finanze Familiari".
Rispondi all'utente in lingua italiana con un linguaggio del tutto naturale, scorrevole, cordiale, empatico e professionale, esattamente come parlerebbe un vero consulente umano.

REGOLE TASSATIVE DI STILE E FORMATTAZIONE:
1. DIVIETO ASSOLUTO DI ASTERISCHI: Non usare MAI asterischi nel testo (nessun doppio asterisco e nessun singolo asterisco). Non usare il grassetto markdown. La risposta deve essere pulita e priva di caratteri di formattazione artificiali.
2. DIVIETO DI SIGLE E CODICI TECNICI: Non usare mai tag informatici o etichette grezze come "BISOGNO", "HO_BISOGNO", "DEVO", "VOGLIO", "USCITA", "ENTRATA". Traducile sempre in espressioni naturali della lingua italiana (ad esempio: "spese fisse inderogabili per la casa", "necessità quotidiane e consumi primari", "spese discrezionali per il tempo libero e lo svago").
3. TONO FLUIDO E CONVERSAZIONALE: Formula frasi ben articolate, piacevoli e facili da leggere, senza rigidità da computer.
4. Per elencare delle voci quando necessario, usa normali trattini lineari (-) oppure una semplice numerazione (1., 2., 3.).
5. Cita con precisione e naturalezza gli importi in euro dai dati forniti (es. 798,86 €).
6. Basa la tua risposta ESCLUSIVAMENTE sui dati reali dell'applicazione forniti nel contesto sottostante.

DATI FINANZIARI REALI DELL'APPLICAZIONE:
${JSON.stringify(contextData || {}, null, 2)}
`;

    // Mappatura cronologia compatibile con @google/genai
    const contents = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }]
    }));

    let reply = '';
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents,
        config: {
          systemInstruction,
          temperature: 0.7
        }
      });
      reply = response.text || '';
    } catch (modelErr: any) {
      console.warn('Fallback a gemini-3.1-flash-lite:', modelErr?.message || modelErr);
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents,
        config: {
          systemInstruction,
          temperature: 0.7
        }
      });
      reply = response.text || '';
    }

    if (!reply) {
      reply = generateLocalChatResponse(lastUserMessage, contextData);
    }

    // Sanificazione garantita: rimuove qualsiasi asterisco o residuo di tag tecnico
    const cleanReply = formatNaturalResponse(reply);

    return res.json({ reply: cleanReply, source: 'GEMINI_AI' });
  } catch (err: any) {
    console.error('Errore API Gemini Chat:', err?.message || err);
    const lastUserMessage = req.body?.messages?.[req.body.messages.length - 1]?.content || '';
    const fallbackReply = generateLocalChatResponse(lastUserMessage, req.body?.contextData);
    return res.json({ reply: formatNaturalResponse(fallbackReply), source: 'LOCAL_FALLBACK' });
  }
});

// ----------------------------------------------------
// VITE MIDDLEWARE SETUP (DEV & PROD)
// ----------------------------------------------------

async function startServer() {
  // Endpoint Webhook / REST per inserimento rapido da widget Android esterni (HTTP Shortcuts / Tasker)
  app.post('/api/quick-transaction', (req, res) => {
    try {
      const { 
        importo, 
        descrizione, 
        tipologia = 'USCITA', 
        conto_origine, 
        sottocategoria_id, 
        necessita = 'DEVO',
        data = new Date().toISOString().split('T')[0],
        note = ''
      } = req.body;

      const parsedAmount = Math.abs(parseFloat(importo) || 0);
      if (parsedAmount <= 0) {
        return res.status(400).json({ 
          error: 'Importo non valido o mancante. Deve essere un numero positivo.' 
        });
      }

      const newMovement = {
        id: `quick-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        movimento_id: `quick-${Date.now()}`,
        data: String(data).trim(),
        descrizione: String(descrizione || 'Spesa rapida').trim(),
        importo: parsedAmount,
        tipologia: ['ENTRATA', 'USCITA', 'GIROCONTO'].includes(tipologia) ? tipologia : 'USCITA',
        conto_origine: conto_origine || null,
        sottocategoria_id: sottocategoria_id || null,
        necessita: ['DEVO', 'HO_BISOGNO', 'VOGLIO'].includes(necessita) ? necessita : 'DEVO',
        stato: 'CONFERMATO',
        origine_dati: 'WIDGET_ESTERNO',
        note: String(note || ''),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false
      };

      return res.status(201).json({
        success: true,
        message: 'Movimento rapido registrato con successo',
        data: newMovement
      });
    } catch (err: any) {
      console.error('Errore registrazione transazione rapida API:', err);
      return res.status(500).json({ error: 'Errore interno elaborazione transazione' });
    }
  });

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
