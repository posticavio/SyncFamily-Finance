import { MovementType } from '../types';

/**
 * Formatta un numero secondo lo standard italiano con separatore delle migliaia (punto '.')
 * e separatore dei decimali (virgola ',').
 * Es. 1000 -> "1.000,00"
 * Es. 1450.5 -> "1.450,50"
 * Es. 12500 -> "12.500,00"
 */
export function formatItalianNumber(
  amount: number, 
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string {
  if (isNaN(amount) || !isFinite(amount)) return '0,00';
  
  const minDec = options?.minimumFractionDigits !== undefined ? options.minimumFractionDigits : 2;
  const maxDec = options?.maximumFractionDigits !== undefined ? options.maximumFractionDigits : 2;
  
  const abs = Math.abs(amount);
  
  // Arrotonda e fissa i decimali
  const fixedStr = abs.toFixed(maxDec);
  const parts = fixedStr.split('.');
  
  // Separatore punto '.' per le migliaia
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  if (maxDec === 0) {
    return integerPart;
  }
  
  let decimalPart = parts[1] || '';
  while (decimalPart.length < minDec) {
    decimalPart += '0';
  }
  
  return `${integerPart},${decimalPart}`;
}

export function formatCurrency(
  amount: number, 
  options?: { showSign?: boolean; hideSymbol?: boolean; noDecimals?: boolean }
): string {
  const isNegative = amount < 0;
  const decimals = options?.noDecimals ? 0 : 2;
  const formatted = formatItalianNumber(amount, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

  const sign = options?.showSign 
    ? (amount > 0 ? '+ ' : (amount < 0 ? '- ' : '')) 
    : (isNegative ? '- ' : '');

  // Spazio unificatore prima di €
  const symbol = options?.hideSymbol ? '' : '\u00A0€';
  return `${sign}${formatted}${symbol}`;
}

/**
 * Formatta percentuali secondo lo standard italiano con virgola decimale e segno opzionale.
 * Es. 32.7 -> "32,7%"
 * Es. 12.4 con showSign -> "+12,4%"
 * Es. 50 con decimals=0 -> "50%"
 */
export function formatItalianPercent(
  val: number,
  options?: { showSign?: boolean; decimals?: number }
): string {
  if (isNaN(val) || !isFinite(val)) return '0%';
  const decimals = options?.decimals !== undefined ? options.decimals : 1;
  const absVal = Math.abs(val);
  const fixed = absVal.toFixed(decimals);
  const parts = fixed.split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decPart = parts[1] || '';
  
  let formatted = intPart;
  if (decimals > 0 && decPart) {
    formatted = `${intPart},${decPart}`;
  }
  
  const sign = options?.showSign
    ? (val > 0 ? '+' : (val < 0 ? '-' : ''))
    : (val < 0 ? '-' : '');
    
  return `${sign}${formatted}%`;
}

/**
 * Formato data unificato rigoroso GG/MM/AA (es. 27/09/26) come da istruzioni di sistema
 */
export function formatDateIT(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '';
  if (dateStr instanceof Date) {
    const d = String(dateStr.getDate()).padStart(2, '0');
    const m = String(dateStr.getMonth() + 1).padStart(2, '0');
    const y = String(dateStr.getFullYear()).slice(-2);
    return `${d}/${m}/${y}`;
  }

  // Se è una stringa YYYY-MM-DD
  const cleanStr = dateStr.split('T')[0];
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    const day = parts[2].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const yearShort = parts[0].length === 4 ? parts[0].slice(-2) : parts[0];
    return `${day}/${month}/${yearShort}`;
  }

  return dateStr;
}

/**
 * Formattazione con data estesa o relativa per intestazioni, con fallback sempre su GG/MM/AA
 */
export function formatRelativeDateIT(dateStr: string): string {
  if (!dateStr) return '';
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const yestStr = yest.toISOString().split('T')[0];

  const tom = new Date();
  tom.setDate(today.getDate() + 1);
  const tomStr = tom.toISOString().split('T')[0];

  if (dateStr === todayStr) return 'Oggi';
  if (dateStr === yestStr) return 'Ieri';
  if (dateStr === tomStr) return 'Domani';

  return formatDateIT(dateStr);
}

export function getMonthName(yearMonth: string): string {
  const [y, m] = yearMonth.split('-');
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  const name = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(d);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Visualizzazione Importi Differenziata (Requisito 3):
 * - Spese: Colore rosso con segno meno ("-")
 * - Entrate: Colore verde con segno più ("+")
 * - Giroconti: Colore neutro grigio scuro
 */
export function getAmountDisplay(amount: number, tipo: MovementType): {
  text: string;
  colorClass: string;
} {
  const absAmount = Math.abs(amount);
  const formatted = formatItalianNumber(absAmount, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  if (tipo === 'ENTRATA') {
    return {
      text: `+ ${formatted} €`,
      colorClass: 'text-emerald-600 dark:text-emerald-400 font-numeric tabular-nums'
    };
  } else if (tipo === 'USCITA') {
    return {
      text: `- ${formatted} €`,
      colorClass: 'text-rose-600 dark:text-rose-400 font-numeric tabular-nums'
    };
  } else {
    // Giroconto
    return {
      text: `${formatted} €`,
      colorClass: 'text-slate-600 dark:text-slate-400 font-numeric tabular-nums'
    };
  }
}
