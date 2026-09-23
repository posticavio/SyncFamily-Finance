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
 * Parser Universale per Estratto Conto Bancario
 * Supporta:
 * - Testo incollato da tabella bancaria (copia/incolla da Intesa, UniCredit, Poste, BBVA, Revolut, ecc.)
 * - File CSV / TSV / TXT
 * - Riconoscimento colonne Intelligente:
 *   - Data (Data Contabile, Data Valuta, Data Operazione)
 *   - Descrizione / Causale / Dettaglio
 *   - Importo Singolo (con segno o Dare/Avere separati)
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

  // Parole chiave comuni negli estratti conto italiani ed europei
  const dateKeywords = ['data contabile', 'data valuta', 'data operazione', 'data', 'date', 'giorno'];
  const descKeywords = ['descrizione operazione', 'descrizione', 'dettaglio', 'operazione', 'beneficiario', 'disposizione', 'memo', 'description'];
  const causaleKeywords = ['causale', 'cautela'];
  const amountKeywords = ['importo', 'amount', 'valore', 'totale'];
  const debitKeywords = ['dare', 'uscite', 'addebiti', 'spese', 'debit', 'outflow'];
  const creditKeywords = ['avere', 'entrate', 'accrediti', 'incassi', 'credit', 'inflow'];

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
