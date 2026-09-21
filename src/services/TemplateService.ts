import { DB, persistDB } from './store';
import { TransactionTemplate } from '../types';
import { DEFAULT_TRANSACTION_TEMPLATES } from '../data/defaultTemplates';

export { DEFAULT_TRANSACTION_TEMPLATES };

export const TemplateService = {
  /**
   * Restituisce tutti i modelli registrati nel database, garantendo
   * l'idratazione dei modelli predefiniti se non ancora presenti.
   */
  async getAll(): Promise<TransactionTemplate[]> {
    if (!DB.MODELLI || DB.MODELLI.length === 0) {
      DB.MODELLI = [...DEFAULT_TRANSACTION_TEMPLATES];
      await persistDB();
    }
    return [...DB.MODELLI];
  },

  async getById(id: string): Promise<TransactionTemplate | undefined> {
    const list = await this.getAll();
    return list.find(t => t.id === id);
  },

  async create(data: Omit<TransactionTemplate, 'id'>): Promise<TransactionTemplate> {
    const list = await this.getAll();
    const newTemplate: TransactionTemplate = {
      ...data,
      id: `tpl-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      created_at: new Date().toISOString()
    };
    DB.MODELLI = [newTemplate, ...list];
    await persistDB();
    return newTemplate;
  },

  async update(id: string, updates: Partial<TransactionTemplate>): Promise<TransactionTemplate> {
    const list = await this.getAll();
    const index = list.findIndex(t => t.id === id);
    if (index === -1) {
      throw new Error("Modello transazione non trovato");
    }
    const updated = {
      ...list[index],
      ...updates
    };
    list[index] = updated;
    DB.MODELLI = list;
    await persistDB();
    return updated;
  },

  async delete(id: string): Promise<void> {
    const list = await this.getAll();
    DB.MODELLI = list.filter(t => t.id !== id);
    await persistDB();
  }
};
