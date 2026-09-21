import { DB, persistDB, generateHumanID, generateUUID } from './store';
import { Deadline } from '../types';
import { MovementService } from './MovementService';

export const DeadlineService = {
  async getAll(): Promise<Deadline[]> {
    return [...(DB.SCADENZE || [])].sort((a, b) => a.data_scadenza.localeCompare(b.data_scadenza));
  },

  async create(data: {
    data_scadenza: string;
    descrizione: string;
    importo_previsto: number;
    sottocategoria_id: string;
    conto_id?: string;
    priorita?: 'ALTA' | 'MEDIA' | 'BASSA';
    note?: string;
  }): Promise<Deadline> {
    if (typeof data.importo_previsto !== 'number' || isNaN(data.importo_previsto) || data.importo_previsto <= 0) {
      throw new Error("L'importo della scadenza deve essere un numero maggiore di zero.");
    }
    if (!data.descrizione || !data.descrizione.trim()) {
      throw new Error("La descrizione della scadenza è obbligatoria.");
    }
    if (!data.data_scadenza) {
      throw new Error("La data della scadenza è obbligatoria.");
    }
    if (!data.sottocategoria_id) {
      throw new Error("Specificare la sottocategoria per la scadenza.");
    }

    const newDeadline: Deadline = {
      id: generateUUID(),
      scadenza_id: generateHumanID('SCA', 'SCADENZE'),
      data_scadenza: data.data_scadenza,
      descrizione: data.descrizione.trim(),
      importo_previsto: Math.round(data.importo_previsto * 100) / 100,
      sottocategoria_id: data.sottocategoria_id,
      conto_id: data.conto_id || DB.CONTI?.[0]?.id || '',
      stato: 'DA_PAGARE',
      priorita: data.priorita || 'MEDIA',
      note: data.note ? data.note.trim() : ''
    };

    if (!DB.SCADENZE) DB.SCADENZE = [];
    DB.SCADENZE.push(newDeadline);
    persistDB();
    return newDeadline;
  },

  // Segna come pagata e registra opzionalmente la transazione reale
  async markAsPaid(scadenzaId: string, contoId?: string, paymentDate?: string): Promise<void> {
    const deadline = (DB.SCADENZE || []).find(s => s.id === scadenzaId);
    if (!deadline) throw new Error("Scadenza non trovata.");

    const usedConto = contoId || deadline.conto_id || DB.CONTI?.[0]?.id || '';
    const usedDate = paymentDate || new Date().toISOString().split('T')[0];

    // Registra movimento reale
    const mov = await MovementService.create({
      data: usedDate,
      descrizione: `Pagamento scadenza: ${deadline.descrizione}`,
      importo: deadline.importo_previsto,
      tipologia: 'USCITA',
      conto_origine: usedConto,
      sottocategoria_id: deadline.sottocategoria_id,
      note: `Scadenza ${deadline.scadenza_id}`,
      origine_dati: 'MANUALE'
    });

    deadline.stato = 'PAGATA';
    deadline.movimento_id = mov.id;
    persistDB();
  },

  async delete(id: string): Promise<boolean> {
    if (!DB.SCADENZE) return false;
    const initialLen = DB.SCADENZE.length;
    DB.SCADENZE = DB.SCADENZE.filter(s => s.id !== id);
    if (DB.SCADENZE.length !== initialLen) {
      persistDB();
      return true;
    }
    return false;
  }
};
