import { Settings } from '../types';
import { DB } from '../services/store';

export interface FinancialPeriodInfo {
  monthKey: string; // 'YYYY-MM'
  monthName: string; // 'Settembre 2026'
  label: string; // 'Settembre 2026' o 'Settembre 2026 (09/09 – 10/10)'
  shortLabel: string; // '09/09 – 10/10' o '01/09 – 30/09'
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
  startObj: Date;
  endObj: Date;
  totalDays: number;
  isCustom: boolean;
}

export interface FinancialSettingsConfig {
  tipo: 'SOLARE' | 'PERSONALIZZATO';
  startDay: number; // 1-31 (es. 9)
  endDay: number; // 1-31 (es. 10)
}

const MONTH_NAMES_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

const MONTH_NAMES_SHORT_IT = [
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'
];

export function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDMY(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return dateStr || '';
  const [y, m, d] = dateStr.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function getDaysInMonth(year: number, month1Indexed: number): number {
  return new Date(year, month1Indexed, 0).getDate();
}

/**
 * Legge la configurazione corrente del mese finanziario da IMPOSTAZIONI
 */
export function getFinancialSettings(settings?: Settings): FinancialSettingsConfig {
  const s = settings || DB.IMPOSTAZIONI;
  const tipo = s?.tipo_mese_finanziario || 'PERSONALIZZATO';
  const startDay = s?.giorno_inizio_mese_finanziario ?? 9;
  const endDay = s?.giorno_fine_mese_finanziario ?? 10;
  return { tipo, startDay, endDay };
}

/**
 * Calcola l'intervallo di date esatto per un dato mese finanziario 'YYYY-MM'.
 * Ad esempio, per '2026-09' con inizio 9 e fine 10:
 * ritorna startDate: '2026-09-09' ed endDate: '2026-10-10'.
 */
export function getFinancialPeriodInfo(monthKey: string, settings?: Settings): FinancialPeriodInfo {
  const config = getFinancialSettings(settings);
  const [yearStr, monthStr] = (monthKey || '').split('-');
  const now = new Date();
  const year = parseInt(yearStr, 10) || now.getFullYear();
  const month = parseInt(monthStr, 10) || (now.getMonth() + 1); // 1-12

  const monthName = `${MONTH_NAMES_IT[month - 1]} ${year}`;

  if (config.tipo === 'SOLARE') {
    const daysInM = getDaysInMonth(year, month);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(daysInM).padStart(2, '0')}`;
    const startObj = new Date(year, month - 1, 1, 0, 0, 0);
    const endObj = new Date(year, month - 1, daysInM, 23, 59, 59);
    return {
      monthKey,
      monthName,
      label: monthName,
      shortLabel: `01/${String(month).padStart(2, '0')} – ${String(daysInM).padStart(2, '0')}/${String(month).padStart(2, '0')}`,
      startDate,
      endDate,
      startObj,
      endObj,
      totalDays: daysInM,
      isCustom: false
    };
  }

  // Mese Finanziario Personalizzato (es. dal 9 di settembre al 10 di ottobre)
  const maxDaysInStartMonth = getDaysInMonth(year, month);
  const clampedStartDay = Math.min(config.startDay, maxDaysInStartMonth);

  const nextMonthYear = month === 12 ? year + 1 : year;
  const nextMonthVal = month === 12 ? 1 : month + 1;
  const maxDaysInEndMonth = getDaysInMonth(nextMonthYear, nextMonthVal);
  const clampedEndDay = Math.min(config.endDay, maxDaysInEndMonth);

  const startDate = `${year}-${String(month).padStart(2, '0')}-${String(clampedStartDay).padStart(2, '0')}`;
  const endDate = `${nextMonthYear}-${String(nextMonthVal).padStart(2, '0')}-${String(clampedEndDay).padStart(2, '0')}`;

  const startObj = new Date(year, month - 1, clampedStartDay, 0, 0, 0);
  const endObj = new Date(nextMonthYear, nextMonthVal - 1, clampedEndDay, 23, 59, 59);

  // Calcolo giorni inclusi
  const diffTime = Math.abs(endObj.getTime() - startObj.getTime());
  const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const startShort = `${String(clampedStartDay).padStart(2, '0')} ${MONTH_NAMES_SHORT_IT[month - 1]}`;
  const endShort = `${String(clampedEndDay).padStart(2, '0')} ${MONTH_NAMES_SHORT_IT[nextMonthVal - 1]}`;
  const label = `${monthName} (${startShort} – ${endShort})`;
  const shortLabel = `${String(clampedStartDay).padStart(2, '0')}/${String(month).padStart(2, '0')} – ${String(clampedEndDay).padStart(2, '0')}/${String(nextMonthVal).padStart(2, '0')}`;

  return {
    monthKey,
    monthName,
    label,
    shortLabel,
    startDate,
    endDate,
    startObj,
    endObj,
    totalDays,
    isCustom: true
  };
}

/**
 * Determina a quale mese finanziario 'YYYY-MM' appartiene una specifica data.
 * Es: Con inizio 9 e fine 10:
 * - '2026-09-09' -> '2026-09'
 * - '2026-10-05' -> '2026-09'
 * - '2026-10-10' -> '2026-09'
 * - '2026-10-11' -> '2026-10'
 */
export function getFinancialMonthForDate(dateInput: string | Date, settings?: Settings): string {
  if (!dateInput) {
    return formatYMD(new Date()).slice(0, 7);
  }

  const dateStr = typeof dateInput === 'string' ? dateInput.slice(0, 10) : formatYMD(dateInput);
  const config = getFinancialSettings(settings);

  if (config.tipo === 'SOLARE') {
    return dateStr.slice(0, 7);
  }

  // Data parsed
  const [yStr, mStr, dStr] = dateStr.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10); // 1-12

  // Test candidati: mese precedente, mese corrente, mese successivo
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  const prevKey = `${prevY}-${String(prevM).padStart(2, '0')}`;

  const currentKey = `${y}-${String(m).padStart(2, '0')}`;

  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const nextKey = `${nextY}-${String(nextM).padStart(2, '0')}`;

  const prevPeriod = getFinancialPeriodInfo(prevKey, settings);
  if (dateStr >= prevPeriod.startDate && dateStr <= prevPeriod.endDate) {
    return prevKey;
  }

  const currentPeriod = getFinancialPeriodInfo(currentKey, settings);
  if (dateStr >= currentPeriod.startDate && dateStr <= currentPeriod.endDate) {
    return currentKey;
  }

  const nextPeriod = getFinancialPeriodInfo(nextKey, settings);
  if (dateStr >= nextPeriod.startDate && dateStr <= nextPeriod.endDate) {
    return nextKey;
  }

  // Fallback: se oltre la fine del periodo corrente ma prima del successivo
  if (dateStr > currentPeriod.endDate) {
    return nextKey;
  }
  return currentKey;
}

/**
 * Restituisce la chiave 'YYYY-MM' del mese finanziario attivo oggi
 */
export function getCurrentFinancialMonth(settings?: Settings): string {
  const todayStr = formatYMD(new Date());
  return getFinancialMonthForDate(todayStr, settings);
}

/**
 * Verifica se una data stringa ricade nel mese finanziario specificato
 */
export function isDateInFinancialMonth(dateStr: string, financialMonthKey: string, settings?: Settings): boolean {
  if (!dateStr || !financialMonthKey) return false;
  const targetDateStr = dateStr.slice(0, 10);
  const period = getFinancialPeriodInfo(financialMonthKey, settings);
  return targetDateStr >= period.startDate && targetDateStr <= period.endDate;
}

/**
 * Calcola l'avanzamento temporale nel mese finanziario selezionato
 */
export function getFinancialTimeProgress(financialMonthKey: string, asOfDate?: Date, settings?: Settings) {
  const period = getFinancialPeriodInfo(financialMonthKey, settings);
  const checkDate = asOfDate || new Date();
  const checkDateStr = formatYMD(checkDate);

  if (checkDateStr < period.startDate) {
    return {
      daysPassed: 0,
      totalDays: period.totalDays,
      percentTime: 0,
      daysRemaining: period.totalDays,
      isCurrentPeriod: false,
      period
    };
  }

  if (checkDateStr > period.endDate) {
    return {
      daysPassed: period.totalDays,
      totalDays: period.totalDays,
      percentTime: 100,
      daysRemaining: 0,
      isCurrentPeriod: false,
      period
    };
  }

  const startMs = period.startObj.getTime();
  const currentMs = checkDate.getTime();
  const daysPassed = Math.max(1, Math.min(period.totalDays, Math.ceil((currentMs - startMs) / (1000 * 60 * 60 * 24))));
  const daysRemaining = Math.max(0, period.totalDays - daysPassed);
  const percentTime = Math.min(100, Math.round((daysPassed / period.totalDays) * 100));

  return {
    daysPassed,
    totalDays: period.totalDays,
    percentTime,
    daysRemaining,
    isCurrentPeriod: true,
    period
  };
}
