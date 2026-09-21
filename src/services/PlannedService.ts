import { DB, persistDB, generateHumanID, generateUUID } from './store';
import { Planned, MovementType } from '../types';
import { MovementService } from './MovementService';

export const PlannedService = {
  async getAll(): Promise<Planned[]> {
    return [...(DB.PIANIFICATI || [])].sort((a, b) => a.data_prevista.localeCompare(b.data_prevista));
  },

  async getPending(): Promise<Planned[]> {
    return (DB.PIANIFICATI || []).filter(p => p.stato === 'PENDENTE').sort((a, b) => a.data_prevista.localeCompare(b.data_prevista));
  },

  async create(data: {
    data_prevista: string;
    descrizione: string;
    importo: number;
    tipologia: MovementType;
    conto_id: string;
    sottocategoria_id: string;
    note?: string;
  }): Promise<Planned> {
    if (typeof data.importo !== 'number' || isNaN(data.importo) || data.importo <= 0) {
      throw new Error("L'importo del movimento pianificato deve essere maggiore di zero.");
    }
    if (!data.descrizione || !data.descrizione.trim()) {
      throw new Error("La descrizione del movimento pianificato è obbligatoria.");
    }
    if (!data.data_prevista) {
      throw new Error("La data prevista è obbligatoria.");
    }
    if (!data.conto_id) {
      throw new Error("Specificare il conto per il movimento pianificato.");
    }
    if (!data.sottocategoria_id) {
      throw new Error("Specificare la sottocategoria per il movimento pianificato.");
    }

    const newPlanned: Planned = {
      id: generateUUID(),
      pianificato_id: generateHumanID('PIA', 'PIANIFICATI'),
      data_prevista: data.data_prevista,
      descrizione: data.descrizione.trim(),
      importo: Math.round(data.importo * 100) / 100,
      tipologia: data.tipologia,
      conto_id: data.conto_id,
      sottocategoria_id: data.sottocategoria_id,
      stato: 'PENDENTE',
      note: data.note ? data.note.trim() : ''
    };

    if (!DB.PIANIFICATI) DB.PIANIFICATI = [];
    DB.PIANIFICATI.push(newPlanned);
    persistDB();
    return newPlanned;
  },

  // Esecuzione atomica del movimento pianificato: genera il movimento reale e aggiorna lo stato
  async execute(plannedId: string, actualDate?: string, actualAmount?: number): Promise<void> {
    const planned = (DB.PIANIFICATI || []).find(p => p.id === plannedId);
    if (!planned) throw new Error("Movimento pianificato non trovato.");
    if (planned.stato === 'ESEGUITO') throw new Error("Movimento già eseguito.");

    const finalDate = actualDate || planned.data_prevista;
    const finalAmount = actualAmount !== undefined ? actualAmount : planned.importo;

    // Crea movimento reale
    const realMov = await MovementService.create({
      data: finalDate,
      descrizione: planned.descrizione,
      importo: finalAmount,
      tipologia: planned.tipologia,
      conto_origine: planned.conto_id,
      sottocategoria_id: planned.sottocategoria_id,
      note: `Eseguito da pianificato ${planned.pianificato_id}`,
      origine_dati: 'PIANIFICATO'
    });

    // Aggiorna stato pianificato
    planned.stato = 'ESEGUITO';
    planned.movimento_reale_id = realMov.id;
    persistDB();
  },

  async delete(id: string): Promise<boolean> {
    if (!DB.PIANIFICATI) return false;
    const initialLen = DB.PIANIFICATI.length;
    DB.PIANIFICATI = DB.PIANIFICATI.filter(p => p.id !== id);
    if (DB.PIANIFICATI.length !== initialLen) {
      persistDB();
      return true;
    }
    return false;
  }
};
