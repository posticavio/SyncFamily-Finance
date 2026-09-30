import { MovementType } from '../types';

export interface ParsedStatementRow {
  id: string;
  rawDate: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // positive number
  type: MovementType;
  rawAmount: string;
  originalValues: Record<string, string>;
  isNonContabilizzato?: boolean;
  statusDescription?: string;
  accountingNote?: string;
}

export interface StatementParseResult {
  rows: ParsedStatementRow[];
  detectedDelimiter: string;
  detectedHeaders: string[];
  totalInflow: number;
  totalOutflow: number;
  startDate?: string;
  endDate?: string;
  rawRowCount: number;
  errors: string[];
}

/**
 * Normalizza una data in formato YYYY-MM-DD
 * Supporta formati italiani ed europei:
 * - DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
 * - DD/MM/YY (es. 14/09/26 -> 2026-09-14)
 * - YYYY-MM-DD, YYYY/MM/DD
 */
export function normalizeDateToISO(dateStr: string | number | null | undefined): string | null {
  if (dateStr === null || dateStr === undefined) return null;
  const clean = String(dateStr).trim();
  if (!clean || clean === '-' || clean === '0' || clean.toLowerCase() === 'nan') return null;

  // Gestione numeri seriali Excel (es. 45000)
  const numVal = Number(clean);
  if (!isNaN(numVal) && numVal > 10000 && numVal < 60000) {
    try {
      const utcDays = Math.floor(numVal - 25569);
      const utcValue = utcDays * 86400 * 1000;
      const dateInfo = new Date(utcValue);
      if (!isNaN(dateInfo.getTime())) {
        const y = dateInfo.getUTCFullYear();
        const m = String(dateInfo.getUTCMonth() + 1).padStart(2, '0');
        const d = String(dateInfo.getUTCDate()).padStart(2, '0');
        if (y >= 2000 && y <= 2100) {
          return `${y}-${m}-${d}`;
        }
      }
    } catch (e) {
      // Ignora errori seriale excel
    }
  }

  // Pattern YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Pattern DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const itFullMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (itFullMatch) {
    const d = itFullMatch[1].padStart(2, '0');
    const m = itFullMatch[2].padStart(2, '0');
    const y = itFullMatch[3];
    return `${y}-${m}-${d}`;
  }

  // Pattern DD/MM/YY
  const itShortMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (itShortMatch) {
    const d = itShortMatch[1].padStart(2, '0');
    const m = itShortMatch[2].padStart(2, '0');
    const rawY = parseInt(itShortMatch[3], 10);
    const y = rawY >= 70 ? `19${rawY}` : `20${String(rawY).padStart(2, '0')}`;
    return `${y}-${m}-${d}`;
  }

  // Fallback sicuro con Date.parse protetto
  try {
    if (clean.length >= 8 && clean.length <= 30 && !/^[a-zA-Z\s]+$/.test(clean)) {
      const parsed = new Date(clean);
      if (parsed && !isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        if (y >= 1970 && y <= 2100) {
          return `${y}-${m}-${d}`;
        }
      }
    }
  } catch (e) {
    // Ignore invalid date errors
  }

  return null;
}

/**
 * Converte una stringa di importo (italiana o internazionale) in un numero positivo e rileva il tipo (USCITA / ENTRATA)
 * Gestisce:
 * - "-1.250,50" -> 1250.50, USCITA
 * - "+500,00" -> 500.00, ENTRATA
 * - "(45,00)" -> 45.00, USCITA
 * - "1250,50-" -> 1250.50, USCITA
 * - "1,250.50" -> 1250.50
 * - "50,00 EUR" -> 50.00
 */
export function parseAmountAndType(rawAmountStr: string, explicitTypeHint?: MovementType): {
  amount: number;
  type: MovementType;
  isValid: boolean;
} {
  if (!rawAmountStr) {
    return { amount: 0, type: 'USCITA', isValid: false };
  }

  let s = rawAmountStr.trim().replace(/€|EUR|eur|\s/g, '');

  let isNegative = false;
  if (s.startsWith('-') || s.endsWith('-')) {
    isNegative = true;
    s = s.replace(/-/g, '');
  } else if (s.startsWith('(') && s.endsWith(')')) {
    isNegative = true;
    s = s.slice(1, -1);
  } else if (s.startsWith('+')) {
    isNegative = false;
    s = s.replace(/\+/g, '');
  }

  // Rileva separatori: se c'è virgola e punto:
  // Es. 1.250,50 -> punto migliaia, virgola decimale
  // Es. 1,250.50 -> virgola migliaia, punto decimale
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // Italiano: 1.250,50
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Inglese: 1,250.50
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    // Solo virgola -> decimale italiano es. 125,50
    s = s.replace(',', '.');
  }

  const num = parseFloat(s);
  if (isNaN(num)) {
    return { amount: 0, type: 'USCITA', isValid: false };
  }

  const absAmount = Math.round(Math.abs(num) * 100) / 100;
  let type: MovementType = isNegative ? 'USCITA' : 'ENTRATA';

  if (explicitTypeHint) {
    type = explicitTypeHint;
  }

  return {
    amount: absAmount,
    type,
    isValid: absAmount > 0
  };
}

/**
 * Parser per righe CSV con supporto per valori quotati ("...")
 */
export function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // salta escape
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Rileva il delimitatore più probabile (, o ; o \t o |)
 */
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0).slice(0, 5);
  if (lines.length === 0) return ';';

  const delimiters = [';', '\t', ',', '|'];
  let bestDelim = ';';
  let maxCount = -1;

  for (const delim of delimiters) {
    let count = 0;
    for (const line of lines) {
      count += line.split(delim).length - 1;
    }
    if (count > maxCount) {
      maxCount = count;
      bestDelim = delim;
    }
  }

  return bestDelim;
}

/**
 * Parser QIF (Quicken Interchange Format) semplice
 */
function parseQIF(text: string): StatementParseResult {
  const rows: ParsedStatementRow[] = [];
  const entries = text.split('^');
  let totalInflow = 0;
  let totalOutflow = 0;

  for (let idx = 0; idx < entries.length; idx++) {
    const entry = entries[idx].trim();
    if (!entry) continue;

    const lines = entry.split(/\r?\n/);
    let dateStr = '';
    let amountStr = '';
    let payee = '';
    let memo = '';

    for (const line of lines) {
      const tag = line.charAt(0);
      const val = line.substring(1).trim();
      if (tag === 'D') dateStr = val;
      if (tag === 'T') amountStr = val;
      if (tag === 'P') payee = val;
      if (tag === 'M') memo = val;
    }

    if (!amountStr || !dateStr) continue;

    const isoDate = normalizeDateToISO(dateStr) || new Date().toISOString().split('T')[0];
    const { amount, type } = parseAmountAndType(amountStr);
    const desc = [payee, memo].filter(Boolean).join(' - ') || 'Movimento bancario';

    if (amount > 0) {
      if (type === 'ENTRATA') totalInflow += amount;
      else totalOutflow += amount;

      rows.push({
        id: `stmt-${idx + 1}-${Date.now()}`,
        rawDate: dateStr,
        date: isoDate,
        description: desc,
        amount,
        type,
        rawAmount: amountStr,
        originalValues: { date: dateStr, amount: amountStr, description: desc }
      });
    }
  }

  return {
    rows,
    detectedDelimiter: 'QIF',
    detectedHeaders: ['Date', 'Payee/Memo', 'Amount'],
    totalInflow: Math.round(totalInflow * 100) / 100,
    totalOutflow: Math.round(totalOutflow * 100) / 100,
    startDate: rows[0]?.date,
    endDate: rows[rows.length - 1]?.date,
    rawRowCount: rows.length,
    errors: []
  };
}

/**
 * Parser OFX / XML semplice tramite espressioni regolari per le transazioni <STMTTRN>
 */
function parseOFX(text: string): StatementParseResult {
  const rows: ParsedStatementRow[] = [];
  let totalInflow = 0;
  let totalOutflow = 0;

  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = trnRegex.exec(text)) !== null) {
    idx++;
    const block = match[1];

    const trntypeMatch = /<TRNTYPE>([^<\r\n]+)/i.exec(block);
    const dtpostedMatch = /<DTPOSTED>([^<\r\n]+)/i.exec(block);
    const trnamtMatch = /<TRNAMT>([^<\r\n]+)/i.exec(block);
    const nameMatch = /<NAME>([^<\r\n]+)/i.exec(block);
    const memoMatch = /<MEMO>([^<\r\n]+)/i.exec(block);

    const rawDate = dtpostedMatch ? dtpostedMatch[1].trim() : '';
    const rawAmt = trnamtMatch ? trnamtMatch[1].trim() : '0';
    const name = nameMatch ? nameMatch[1].trim() : '';
    const memo = memoMatch ? memoMatch[1].trim() : '';
    const desc = [name, memo].filter(Boolean).join(' - ') || 'Movimento bancario';

    // OFX Date format: YYYYMMDD...
    let isoDate = '';
    if (rawDate.length >= 8) {
      isoDate = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;
    } else {
      isoDate = normalizeDateToISO(rawDate) || new Date().toISOString().split('T')[0];
    }

    const { amount, type } = parseAmountAndType(rawAmt);
    if (amount > 0) {
      if (type === 'ENTRATA') totalInflow += amount;
      else totalOutflow += amount;

      rows.push({
        id: `ofx-${idx}-${Date.now()}`,
        rawDate,
        date: isoDate,
        description: desc,
        amount,
        type,
        rawAmount: rawAmt,
        originalValues: { date: rawDate, amount: rawAmt, description: desc }
      });
    }
  }

  return {
    rows,
    detectedDelimiter: 'OFX',
    detectedHeaders: ['DTPOSTED', 'NAME/MEMO', 'TRNAMT'],
    totalInflow: Math.round(totalInflow * 100) / 100,
    totalOutflow: Math.round(totalOutflow * 100) / 100,
    startDate: rows[0]?.date,
    endDate: rows[rows.length - 1]?.date,
    rawRowCount: rows.length,
    errors: []
  };
}

/**
 * Parser speciale per estratti conto PDF incollati o esportazioni con righe multiline (es. Monte dei Paschi di Siena MPS).
 * Ricostruisce le transazioni in cui la descrizione è distribuita su più righe e l'importo è posizionato alla fine.
 */
export function parseMultilineTextStatement(text: string): StatementParseResult | null {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 3) return null;

  // Riconoscimento basato su parole chiave specifiche di MPS o formato di testo copia/incolla da PDF
  const isMPS = text.toLowerCase().includes('monte dei paschi') || 
                text.toLowerCase().includes('mps') || 
                text.toLowerCase().includes('filiale disponente') ||
                text.toLowerCase().includes('prelievo self service') ||
                text.toLowerCase().includes('scritture passate sul suo conto');

  if (!isMPS) {
    const dateLineCount = lines.filter(l => /^\d{2}[-/.]\d{2}[-/.]\d{4}/.test(l)).length;
    if (dateLineCount < 2 || text.includes(';') || text.includes('\t')) {
      return null; // Fallback al parser CSV/tabellare standard
    }
  }

  interface TempTx {
    date: string;
    rawDate: string;
    descriptionLines: string[];
    valutaDate?: string;
    amount?: number;
    type?: MovementType;
  }

  const transactions: TempTx[] = [];
  let currentTx: TempTx | null = null;

  const isNumericAmount = (str: string) => {
    const clean = str.trim().replace(/\s/g, '').replace(/€/g, '');
    if (!clean) return false;
    return /^[-+]?[\d.]+(?:,\d{1,2})?$/.test(clean) || /^[-+]?\d+(?:\.\d{1,2})?$/.test(clean);
  };

  const dateRegex = /^(\d{2})[-/.](\d{2})[-/.](\d{4})/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();

    // Salta righe di intestazione/pié di pagina generiche del PDF
    if (lowerLine.startsWith('contabile al') || 
        lowerLine.startsWith('filiale di') || 
        lowerLine.startsWith('conto in euro') ||
        lowerLine.startsWith('pag. ') ||
        lowerLine.startsWith('banca monte') ||
        lowerLine.startsWith('gentile cliente') ||
        lowerLine.startsWith('la preghiamo di') ||
        lowerLine.startsWith('distinti saluti') ||
        lowerLine.includes('data descrizione operazioni') ||
        lowerLine.includes('codice fiscale') ||
        lowerLine.includes('partita iva') ||
        lowerLine.includes('gruppo bancario')) {
      continue;
    }

    const dateMatch = line.match(dateRegex);

    if (dateMatch) {
      const dateStr = line.substring(0, 10);
      const rest = line.substring(10).trim();
      const isoDate = normalizeDateToISO(dateStr) || '';

      const restParts = rest.split(/\s+/).filter(Boolean);
      const isAmountLine = restParts.length > 0 && restParts.every(p => isNumericAmount(p));

      if (isAmountLine && currentTx) {
        // Trovata riga finale con la data valuta e l'importo/i
        currentTx.valutaDate = isoDate;
        
        const parsedAmounts = restParts.map(p => parseAmountAndType(p));
        const validAmount = parsedAmounts.find(a => a.isValid);
        
        if (validAmount) {
          currentTx.amount = validAmount.amount;
          currentTx.type = validAmount.type;

          const rawLine = line;
          const spacesBeforeAmount = rawLine.indexOf(restParts[0]) - 10;
          
          // Se c'è uno spazio ampio prima dell'importo (colonna Avere), è un'entrata
          if (spacesBeforeAmount > 15) {
            currentTx.type = 'ENTRATA';
          }
        }

        // Regole semantiche per determinare la tipologia dai testi delle causali MPS
        const fullDesc = currentTx.descriptionLines.join(' ').toLowerCase();
        
        if (fullDesc.includes('prelievo') || 
            fullDesc.includes('addebito') || 
            fullDesc.includes('mutuo') || 
            fullDesc.includes('spesa') || 
            fullDesc.includes('commissione') || 
            fullDesc.includes('imposta di bollo') || 
            fullDesc.includes('sdd') || 
            fullDesc.includes('pagamento pos')) {
          currentTx.type = 'USCITA';
        }
        
        if (fullDesc.includes('accredito') || 
            fullDesc.includes('stipendio') || 
            fullDesc.includes('stornato') || 
            fullDesc.includes('rimborso') || 
            fullDesc.includes('versamento')) {
          currentTx.type = 'ENTRATA';
        }

        // MPS: "BON. IST. ... ORD: <Persona>" -> se contiene ORD, di solito è un bonifico ricevuto (ENTRATA)
        // se contiene "DISPOSTO" o non ha "ORD:" è un bonifico inviato (USCITA)
        if (fullDesc.includes('bon. ist.') || fullDesc.includes('bonifico')) {
          if (fullDesc.includes('ord:')) {
            currentTx.type = 'ENTRATA';
          } else {
            currentTx.type = 'USCITA';
          }
        }

        transactions.push(currentTx);
        currentTx = null;
      } else {
        // Inizio di una nuova transazione
        if (currentTx && currentTx.amount && currentTx.amount > 0) {
          transactions.push(currentTx);
        }

        currentTx = {
          date: isoDate,
          rawDate: dateStr,
          descriptionLines: [rest]
        };
      }
    } else {
      // Riga di continuazione della descrizione causale
      if (currentTx) {
        currentTx.descriptionLines.push(line);
      }
    }
  }

  // Aggiungi l'ultimo movimento se completo
  if (currentTx && currentTx.amount && currentTx.amount > 0) {
    transactions.push(currentTx);
  }

  if (transactions.length === 0) {
    return null;
  }

  const rows: ParsedStatementRow[] = transactions.map((t, index) => {
    const description = t.descriptionLines.join(' ').replace(/\s+/g, ' ').trim();
    const type = t.type || 'USCITA';
    
    return {
      id: `mps-pdf-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      rawDate: t.rawDate,
      date: t.date,
      description,
      amount: t.amount || 0,
      type,
      rawAmount: t.amount?.toString() || '0',
      originalValues: {
        date: t.rawDate,
        description,
        amount: t.amount?.toString() || '0'
      }
    };
  });

  let totalInflow = 0;
  let totalOutflow = 0;
  for (const r of rows) {
    if (r.type === 'ENTRATA') totalInflow += r.amount;
    else totalOutflow += r.amount;
  }

  return {
    rows,
    detectedDelimiter: 'PDF_TEXT_RECONSTRUCTION',
    detectedHeaders: ['Data Movimento', 'Descrizione Completa', 'Valuta', 'Importo'],
    totalInflow: Math.round(totalInflow * 100) / 100,
    totalOutflow: Math.round(totalOutflow * 100) / 100,
    startDate: rows[0]?.date,
    endDate: rows[rows.length - 1]?.date,
    rawRowCount: rows.length,
    errors: []
  };
}

/**
 * Parser specializzato per estratti conto di Carte di Credito e Linee di Credito da PDF
 * (Findomestic, Nexi, CartaBCC, Amex, Compass, Agos, Deutsche Bank, Intesa Carta, UniCredit Flexia, ecc.)
 */
export function parseCreditCardPdfStatement(text: string): StatementParseResult | null {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return null;

  const rows: ParsedStatementRow[] = [];
  let totalInflow = 0;
  let totalOutflow = 0;

  // Pattern per catturare righe con 1 o 2 date all'inizio
  const doubleDateRegex = /^(\d{2}[./-]\d{2}[./-]\d{4})\s+(\d{2}[./-]\d{2}[./-]\d{4})?\s+(.*)$/;
  const singleDateRegex = /^(\d{2}[./-]\d{2}[./-]\d{4})\s+(.*)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();

    // Salta righe di intestazione/riepilogo o note legali del PDF
    if (lowerLine.includes('estratto conto della linea') ||
        lowerLine.includes('periodo di riferimento') ||
        lowerLine.includes('la tua linea di credito') ||
        lowerLine.includes('saldo complessivo') ||
        lowerLine.includes('disponibilità residua') ||
        lowerLine.includes('totale rimborso del mese') ||
        lowerLine.includes('riepilogo utilizzi') ||
        lowerLine.includes('riepilogo rimborsi') ||
        lowerLine.includes('riepilogo saldi') ||
        lowerLine.includes('dettagli dei saldi') ||
        lowerLine.includes('guida all\'estratto conto') ||
        lowerLine.includes('blocco degli strumenti') ||
        lowerLine.includes('codice cliente') ||
        lowerLine.includes('numero conto') ||
        lowerLine.includes('data utilizzo data contabile') ||
        lowerLine.includes('data operazione importo') ||
        lowerLine.includes('modalità rimborso') ||
        lowerLine.includes('il tuo centro clienti') ||
        lowerLine.includes('per richieste ed informazioni') ||
        lowerLine.includes('tan taeg') ||
        lowerLine.startsWith('pag.') ||
        lowerLine.startsWith('pagina ')) {
      continue;
    }

    let rawDate = '';
    let isoDate = '';
    let restOfLine = '';

    const doubleMatch = line.match(doubleDateRegex);
    if (doubleMatch) {
      rawDate = doubleMatch[1];
      isoDate = normalizeDateToISO(rawDate) || '';
      restOfLine = doubleMatch[3] || '';
    } else {
      const singleMatch = line.match(singleDateRegex);
      if (singleMatch) {
        rawDate = singleMatch[1];
        isoDate = normalizeDateToISO(rawDate) || '';
        restOfLine = singleMatch[2] || '';
      }
    }

    if (!isoDate || !restOfLine) continue;

    // Tokenizza restOfLine per estrarre l'importo e la descrizione
    const tokens = restOfLine.split(/\s+/);
    let amountIdx = -1;
    let foundAmountStr = '';

    // Cerca dal fondo della riga l'ultimo token che rappresenta un importo numerico valido
    for (let t = tokens.length - 1; t >= 0; t--) {
      const tok = tokens[t];
      if (/^[-+]?\d{1,3}(?:\.\d{3})*(?:,\d{2})$/.test(tok) || /^[-+]?\d+(?:[.,]\d{2})$/.test(tok)) {
        amountIdx = t;
        foundAmountStr = tok;
        break;
      }
    }

    if (amountIdx !== -1) {
      let descTokens = tokens.slice(0, amountIdx);
      let desc = descTokens.join(' ').trim();

      // Se la descrizione è vuota (es. riga senza testo del merchant)
      if (!desc || /^\d+$/.test(desc)) {
        desc = 'Operazione Carta di Credito';
      }

      const lowerDesc = desc.toLowerCase();
      const isCancellation = lowerDesc.includes('annullamento') || 
                             lowerDesc.includes('storno') || 
                             lowerDesc.includes('rimborso') || 
                             lowerDesc.includes('reso') ||
                             lowerDesc.includes('accredito');

      const parsedAmt = parseAmountAndType(foundAmountStr);
      let amount = parsedAmt.amount;
      let type: MovementType = 'USCITA';

      // Nel caso delle carte di credito, l'annullamento o importo negativo rappresenta un accredito/rimborso
      if (foundAmountStr.includes('-') || isCancellation) {
        type = 'ENTRATA';
      } else {
        type = 'USCITA';
      }

      if (amount > 0) {
        if (type === 'ENTRATA') totalInflow += amount;
        else totalOutflow += amount;

        rows.push({
          id: `cc-pdf-${rows.length}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          rawDate,
          date: isoDate,
          description: desc,
          amount,
          type,
          rawAmount: foundAmountStr,
          originalValues: {
            date: rawDate,
            description: desc,
            amount: foundAmountStr,
            fullLine: line
          }
        });
      }
    }
  }

  if (rows.length === 0) return null;

  rows.sort((a, b) => a.date.localeCompare(b.date));

  return {
    rows,
    detectedDelimiter: 'CREDIT_CARD_PDF_PARSER',
    detectedHeaders: ['Data Utilizzo', 'Descrizione Operazione', 'Importo (€)'],
    totalInflow: Math.round(totalInflow * 100) / 100,
    totalOutflow: Math.round(totalOutflow * 100) / 100,
    startDate: rows[0]?.date,
    endDate: rows[rows.length - 1]?.date,
    rawRowCount: rows.length,
    errors: []
  };
}

/**
 * Parser Universale per Estratto Conto Bancario e Carte di Credito
 */
export function parseBankStatement(rawText: string, customOptions?: {
  delimiter?: string;
  dateColIndex?: number;
  descColIndex?: number;
  amountColIndex?: number;
  debitColIndex?: number;
  creditColIndex?: number;
}): StatementParseResult {
  const cleanText = rawText.trim().replace(/^\uFEFF/, '');
  if (!cleanText) {
    return {
      rows: [],
      detectedDelimiter: ';',
      detectedHeaders: [],
      totalInflow: 0,
      totalOutflow: 0,
      rawRowCount: 0,
      errors: ['Nessun testo o file fornito.']
    };
  }

  // Controllo speciale per estratti conto Carte di Credito PDF (Findomestic, Nexi, CartaBCC, Amex, Compass, Agos, ecc.)
  const ccPdfResult = parseCreditCardPdfStatement(cleanText);
  if (ccPdfResult && ccPdfResult.rows.length > 0) {
    return ccPdfResult;
  }

  // Controllo speciale per PDF incollato (es. MPS con righe multiline)
  const multilineResult = parseMultilineTextStatement(cleanText);
  if (multilineResult) {
    return multilineResult;
  }

  // Controllo formato OFX / QIF
  if (cleanText.includes('<STMTTRN>') || cleanText.includes('<OFX>')) {
    return parseOFX(cleanText);
  }
  if (cleanText.startsWith('!Type:') || (cleanText.includes('^') && cleanText.includes('!'))) {
    return parseQIF(cleanText);
  }

  const delimiter = customOptions?.delimiter || detectDelimiter(cleanText);
  const rawLines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  if (rawLines.length === 0) {
    return {
      rows: [],
      detectedDelimiter: delimiter,
      detectedHeaders: [],
      totalInflow: 0,
      totalOutflow: 0,
      rawRowCount: 0,
      errors: ['File vuoto.']
    };
  }

  // Tokenizza tutte le righe
  const parsedGrid = rawLines.map(line => parseCSVLine(line, delimiter));

  // Individua la riga di intestazione (header) e gli indici delle colonne
  let headerIndex = -1;
  let dateColIdx = customOptions?.dateColIndex ?? -1;
  let descColIdx = customOptions?.descColIndex ?? -1;
  let causaleColIdx = -1;
  let amountColIdx = customOptions?.amountColIndex ?? -1;
  let debitColIdx = customOptions?.debitColIndex ?? -1; // Uscite / Dare
  let creditColIdx = customOptions?.creditColIndex ?? -1; // Entrate / Avere

  // Parole chiave comuni negli estratti conto italiani ed europei (bancari e carte di credito)
  const dateKeywords = ['data contabile', 'data valuta', 'data operazione', 'data registrazione', 'data addebito', 'data spesa', 'data', 'date', 'giorno'];
  const descKeywords = ['descrizione operazione', 'descrizione', 'esercente', 'merchant', 'dettaglio', 'operazione', 'beneficiario', 'disposizione', 'memo', 'description', 'esercizio', 'causale'];
  const causaleKeywords = ['causale', 'cautela', 'esercente / descrizione', 'esercente', 'merchant'];
  const locationKeywords = ['località', 'localita', 'città', 'citta', 'luogo', 'paese'];
  const amountKeywords = ['importo (€)', 'importo euro', 'importo in euro', 'importo', 'amount', 'valore', 'totale', 'addebito (€)', 'addebito'];
  const debitKeywords = ['dare', 'uscite', 'addebiti', 'spese', 'debit', 'outflow', 'addebito'];
  const creditKeywords = ['avere', 'entrate', 'accrediti', 'incassi', 'credit', 'inflow', 'accredito'];

  // Cerca riga di intestazione nelle prime 10 righe
  for (let r = 0; r < Math.min(parsedGrid.length, 10); r++) {
    const row = parsedGrid[r];
    const rowLower = row.map(c => c.toLowerCase().trim());

    const hasDateKw = rowLower.some(c => dateKeywords.some(kw => c.includes(kw)));
    const hasAmountKw = rowLower.some(c => 
      amountKeywords.some(kw => c.includes(kw)) ||
      debitKeywords.some(kw => c.includes(kw)) ||
      creditKeywords.some(kw => c.includes(kw))
    );

    if (hasDateKw && hasAmountKw) {
      headerIndex = r;
      // Trova indici basati sui nomi colonna
      rowLower.forEach((col, idx) => {
        if (dateColIdx === -1 && dateKeywords.some(kw => col.includes(kw))) {
          dateColIdx = idx;
        }
        if (descColIdx === -1 && descKeywords.some(kw => col.includes(kw))) {
          descColIdx = idx;
        }
        if (causaleColIdx === -1 && causaleKeywords.some(kw => col.includes(kw))) {
          causaleColIdx = idx;
        }
        if (debitColIdx === -1 && debitKeywords.some(kw => col === kw || col.includes(kw))) {
          debitColIdx = idx;
        }
        if (creditColIdx === -1 && creditKeywords.some(kw => col === kw || col.includes(kw))) {
          creditColIdx = idx;
        }
        if (amountColIdx === -1 && amountKeywords.some(kw => col === kw || col.includes(kw)) && !col.includes('saldo')) {
          amountColIdx = idx;
        }
      });
      break;
    }
  }

  // Se non c'è una riga di intestazione chiara o alcune colonne mancano, deduci analizzando i contenuti
  const sampleDataRows = parsedGrid.slice(headerIndex >= 0 ? headerIndex + 1 : 0, 15);

  if (dateColIdx === -1 || descColIdx === -1 || (amountColIdx === -1 && debitColIdx === -1)) {
    const numCols = Math.max(...parsedGrid.map(r => r.length));
    const colStats: { dateCount: number; amountCount: number; maxLen: number }[] = Array.from(
      { length: numCols },
      () => ({ dateCount: 0, amountCount: 0, maxLen: 0 })
    );

    for (const row of sampleDataRows) {
      row.forEach((val, idx) => {
        if (!val) return;
        if (normalizeDateToISO(val)) colStats[idx].dateCount++;
        const parsedAmt = parseAmountAndType(val);
        if (parsedAmt.isValid) colStats[idx].amountCount++;
        if (val.length > colStats[idx].maxLen) colStats[idx].maxLen = val.length;
      });
    }

    if (dateColIdx === -1) {
      // Colonna con più date
      let bestDateIdx = -1;
      let maxDates = 0;
      colStats.forEach((st, idx) => {
        if (st.dateCount > maxDates) {
          maxDates = st.dateCount;
          bestDateIdx = idx;
        }
      });
      dateColIdx = bestDateIdx !== -1 ? bestDateIdx : 0;
    }

    if (amountColIdx === -1 && debitColIdx === -1) {
      // Colonna con più importi numerici diversa dalla data
      let bestAmtIdx = -1;
      let maxAmts = 0;
      colStats.forEach((st, idx) => {
        if (idx !== dateColIdx && st.amountCount > maxAmts) {
          maxAmts = st.amountCount;
          bestAmtIdx = idx;
        }
      });
      amountColIdx = bestAmtIdx !== -1 ? bestAmtIdx : (parsedGrid[0].length >= 3 ? 2 : 1);
    }

    if (descColIdx === -1) {
      // Colonna con il testo più lungo che non sia né data né importo
      let bestDescIdx = -1;
      let maxLen = 0;
      colStats.forEach((st, idx) => {
        if (idx !== dateColIdx && idx !== amountColIdx && idx !== debitColIdx && idx !== creditColIdx) {
          if (st.maxLen > maxLen) {
            maxLen = st.maxLen;
            bestDescIdx = idx;
          }
        }
      });
      descColIdx = bestDescIdx !== -1 ? bestDescIdx : 1;
    }
  }

  const detectedHeaders = headerIndex >= 0 ? parsedGrid[headerIndex] : [
    `Colonna ${dateColIdx + 1} (Data)`,
    `Colonna ${descColIdx + 1} (Descrizione)`,
    `Colonna ${(amountColIdx >= 0 ? amountColIdx : debitColIdx) + 1} (Importo)`
  ];

  const dataRowsStart = headerIndex >= 0 ? headerIndex + 1 : 0;
  const rows: ParsedStatementRow[] = [];
  let totalInflow = 0;
  let totalOutflow = 0;
  const errors: string[] = [];

  const UNBOOKED_KEYWORDS = [
    'non contabilizzat',
    'da contabilizzar',
    'in contabilizzazion',
    'non ancora contabilizzat',
    'non contabil.',
    'in sospeso',
    'in corso',
    'in elaborazione',
    'prenotato',
    'prenotata',
    'prenotazione',
    'preautorizzazione',
    'pre-autorizzazione',
    'autorizzazione',
    'pending',
    'unsettled',
    'unbooked',
    'da confermare'
  ];

  for (let r = dataRowsStart; r < parsedGrid.length; r++) {
    const cols = parsedGrid[r];
    if (cols.length === 0 || cols.every(c => !c.trim())) continue;

    let rawDate = cols[dateColIdx] || '';
    let isoDate = normalizeDateToISO(rawDate);

    // Se la cella della data principale è vuota o non valida (caso frequentissimo per movimenti non contabilizzati dalla banca),
    // cerca tra tutte le altre colonne se esiste una data valida alternativa (es. Data Operazione o Data Valuta)
    let isFallbackDateUsed = false;
    if (!isoDate) {
      for (let ci = 0; ci < cols.length; ci++) {
        if (ci === dateColIdx || ci === descColIdx || ci === amountColIdx || ci === debitColIdx || ci === creditColIdx) continue;
        const candidateDate = normalizeDateToISO(cols[ci]);
        if (candidateDate) {
          isoDate = candidateDate;
          rawDate = cols[ci];
          isFallbackDateUsed = true;
          break;
        }
      }
    }

    // Se non troviamo alcuna data valida in nessuna colonna, è una riga di riepilogo/intestazione o vuota
    if (!isoDate) {
      continue;
    }

    // Riconoscimento movimenti "Non Contabilizzati" / In sospeso / In elaborazione bancaria
    const allTextInRow = cols.join(' ').toLowerCase();
    const isUnbookedKeyword = UNBOOKED_KEYWORDS.some(kw => allTextInRow.includes(kw));
    // È non contabilizzato se contiene parole chiave oppure se la data contabile era originariamente assente
    const isNonContabilizzato = isUnbookedKeyword || (isFallbackDateUsed && (!cols[dateColIdx] || cols[dateColIdx].trim() === '-' || cols[dateColIdx].trim() === ''));

    // Combina Causale e Descrizione Operazione (es. formato ING)
    const causaleVal = causaleColIdx >= 0 ? cols[causaleColIdx]?.trim() || '' : '';
    const descVal = descColIdx >= 0 ? cols[descColIdx]?.trim() || '' : '';
    
    let description = '';
    if (causaleVal && descVal && !descVal.toLowerCase().includes(causaleVal.toLowerCase())) {
      description = `${causaleVal} - ${descVal}`;
    } else {
      description = descVal || causaleVal || cols[descColIdx >= 0 ? descColIdx : 1]?.trim() || 'Movimento da estratto conto';
    }

    // Ignora righe di riepilogo saldo (es. "Saldo iniziale", "Saldo finale")
    const lowerDesc = description.toLowerCase();
    if (lowerDesc.includes('saldo iniziale') || lowerDesc.includes('saldo finale') || lowerDesc.includes('saldo contabile')) {
      continue;
    }

    let amount = 0;
    let type: MovementType = 'USCITA';
    let rawAmount = '';

    // Gestione colonne separate Dare / Avere
    if (debitColIdx >= 0 && creditColIdx >= 0) {
      const debitRaw = cols[debitColIdx] || '';
      const creditRaw = cols[creditColIdx] || '';

      const debitParsed = parseAmountAndType(debitRaw, 'USCITA');
      const creditParsed = parseAmountAndType(creditRaw, 'ENTRATA');

      if (creditParsed.isValid) {
        amount = creditParsed.amount;
        type = 'ENTRATA';
        rawAmount = creditRaw;
      } else if (debitParsed.isValid) {
        amount = debitParsed.amount;
        type = 'USCITA';
        rawAmount = debitRaw;
      }
    } else if (amountColIdx >= 0) {
      const amtCell = cols[amountColIdx] || '';
      const parsed = parseAmountAndType(amtCell);
      amount = parsed.amount;
      type = parsed.type;
      rawAmount = amtCell;
    }

    if (amount <= 0) {
      continue; // Ignora righe senza importo
    }

    // Anche se "non contabilizzato" dalla banca, viene comunque conteggiato a tutti gli effetti come già contabilizzato
    if (type === 'ENTRATA') {
      totalInflow += amount;
    } else {
      totalOutflow += amount;
    }

    const origObj: Record<string, string> = {};
    cols.forEach((val, i) => {
      origObj[`col_${i}`] = val;
    });

    rows.push({
      id: `stmt-row-${r}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      rawDate,
      date: isoDate,
      description,
      amount,
      type,
      rawAmount,
      originalValues: origObj,
      isNonContabilizzato,
      statusDescription: isNonContabilizzato 
        ? 'In contabilizzazione bancaria (considerato già contabilizzato con addebito certo)' 
        : 'Contabilizzato',
      accountingNote: isNonContabilizzato 
        ? 'Addebito confermato (la data contabile finale potrebbe variare di qualche giorno)' 
        : undefined
    });
  }

  // Ordina per data crescente o decrescente
  rows.sort((a, b) => a.date.localeCompare(b.date));

  return {
    rows,
    detectedDelimiter: delimiter,
    detectedHeaders,
    totalInflow: Math.round(totalInflow * 100) / 100,
    totalOutflow: Math.round(totalOutflow * 100) / 100,
    startDate: rows[0]?.date,
    endDate: rows[rows.length - 1]?.date,
    rawRowCount: rows.length,
    errors
  };
}

/**
 * Fornisce un estratto conto demo realistico (formato Intesa Sanpaolo / UniCredit / BPER)
 * per consentire all'utente di provare subito l'analisi delle transazioni mancanti
 */
export function getDemoBankStatement(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');

  return `Data Operazione;Data Contabile;Stato;Descrizione / Causale;Importo
14/${m}/${y};;NON CONTABILIZZATO;PAGAMENTO POS CONAD SUPERSTORE FORLI;-84,50
13/${m}/${y};;IN SOSPESO;PAGAMENTO POS BAR PASTICCERIA CENTRALE;-4,20
12/${m}/${y};13/${m}/${y};CONTABILIZZATO;PAGAMENTO POS FARMACIA CENTRALE;-28,30
10/${m}/${y};10/${m}/${y};CONTABILIZZATO;ACCREDITO STIPENDIO AZIENDA SPA;+2150,00
08/${m}/${y};09/${m}/${y};CONTABILIZZATO;PAGAMENTO POS ENI STATION CARBURANTE;-55,00
06/${m}/${y};06/${m}/${y};CONTABILIZZATO;SDD ENEL ENERGIA BOLLETTA LUCE;-114,20
05/${m}/${y};06/${m}/${y};CONTABILIZZATO;PAGAMENTO POS RISTORANTE IL CASALE;-75,00
04/${m}/${y};05/${m}/${y};CONTABILIZZATO;PAGAMENTO POS AMAZON IT MARKETPLACE;-36,40
02/${m}/${y};03/${m}/${y};CONTABILIZZATO;PAGAMENTO POS LEROY MERLIN BRICOLAGE;-92,50
01/${m}/${y};01/${m}/${y};CONTABILIZZATO;BONIFICO DISPOSTO QUOTA CONDOMINIALE;-120,00`;
}

/**
 * Fornisce un estratto conto demo di Carta di Credito (Nexi / Visa / Mastercard / Amex)
 */
export function getDemoCreditCardStatement(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');

  return `Data Operazione;Data Registrazione;Esercente / Descrizione;Località;N. Carta;Stato;Importo (€)
15/${m}/${y};16/${m}/${y};PAGAMENTO CARTA APPLE.COM/BILL;HOOFDDORP;*4829;CONTABILIZZATO;-12,99
14/${m}/${y};15/${m}/${y};SUPERMERCATO ESSELUNGA;MILANO;*4829;CONTABILIZZATO;-68,40
14/${m}/${y};;ZARA BOUTIQUE ABBIGLIAMENTO;ROMA;*4829;IN AUTORIZZAZIONE (NON CONTABILIZZATO);-49,90
12/${m}/${y};13/${m}/${y};RISTORANTE IL TRITONE;FIRENZE;*4829;CONTABILIZZATO;-85,00
10/${m}/${y};11/${m}/${y};DISTRIBUTORE ENI STATION;BOLOGNA;*4829;CONTABILIZZATO;-50,00
08/${m}/${y};09/${m}/${y};AMAZON.IT MARKETPLACE;LUXEMBOURG;*4829;CONTABILIZZATO;-34,50
05/${m}/${y};06/${m}/${y};HOTEL PARCO DEI PRINCIPI;NAPOLI;*4829;CONTABILIZZATO;-220,00
02/${m}/${y};03/${m}/${y};FARMACIA SANTA LUCIANA;MILANO;*4829;CONTABILIZZATO;-24,80
01/${m}/${y};02/${m}/${y};STORNO RESO ZARA;ROMA;*4829;CONTABILIZZATO;+49,90`;
}
