import { Settings } from '../types';
import { DB, persistDB } from './store';

export const SettingsService = {
  getSettings(): Settings {
    return DB.IMPOSTAZIONI;
  },

  async updateSettings(updates: Partial<Settings>): Promise<Settings> {
    DB.IMPOSTAZIONI = {
      ...DB.IMPOSTAZIONI,
      ...updates
    };
    await persistDB();
    return DB.IMPOSTAZIONI;
  },

  async setFinancialMonthConfig(
    tipo: 'SOLARE' | 'PERSONALIZZATO',
    startDay: number,
    endDay: number
  ): Promise<Settings> {
    const validStartDay = Math.max(1, Math.min(31, startDay));
    const validEndDay = Math.max(1, Math.min(31, endDay));

    DB.IMPOSTAZIONI = {
      ...DB.IMPOSTAZIONI,
      tipo_mese_finanziario: tipo,
      giorno_inizio_mese_finanziario: validStartDay,
      giorno_fine_mese_finanziario: validEndDay
    };

    await persistDB();
    return DB.IMPOSTAZIONI;
  }
};
