import { DB, persistDB, generateHumanID, generateUUID } from './store';
import { Recurrence, RecurrenceFrequency, RecurrenceLimitType, MovementType, Planned, Movement } from '../types';
import { MovementService } from './MovementService';

// Helper per calcolare la prossima data di esecuzione a partire da oggi o da una data base
export function calculateNextExecutionDate(
  frequenza: RecurrenceFrequency,
  giornoEsecuzione: number,
  fromDateStr?: string
): string {
  const baseDate = fromDateStr ? new Date(fromDateStr) : new Date();
  let targetYear = baseDate.getFullYear();
  let targetMonth = baseDate.getMonth(); // 0-indexed
  const todayDay = baseDate.getDate();

  const clampDay = (year: number, month: number, day: number): number => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Math.min(Math.max(1, day), daysInMonth);
  };

  if (frequenza === 'SETTIMANALE') {
    // giornoEsecuzione 1 (Lun) - 7 (Dom)
    const targetWeekday = giornoEsecuzione % 7; // 0 (Dom) to 6 (Sab)
    const currentWeekday = baseDate.getDay();
    let diff = (targetWeekday - currentWeekday + 7) % 7;
    if (diff === 0) diff = 7; // Prossima settimana
    const nextD = new Date(baseDate);
    nextD.setDate(baseDate.getDate() + diff);
    return nextD.toISOString().split('T')[0];
  }

  if (frequenza === 'QUATTORDICINALE') {
    const nextD = new Date(baseDate);
    nextD.setDate(baseDate.getDate() + 14);
    return nextD.toISOString().split('T')[0];
  }

  // Per frequenze mensili/plurimensili:
  let monthStep = 1;
  if (frequenza === 'BIMESTRALE') monthStep = 2;
  if (frequenza === 'TRIMESTRALE') monthStep = 3;
  if (frequenza === 'SEMESTRALE') monthStep = 6;
  if (frequenza === 'ANNUALE') monthStep = 12;

  // Se il giorno del mese corrente è già passato, salta al prossimo step
  if (todayDay >= giornoEsecuzione) {
    targetMonth += monthStep;
  }

  const validDay = clampDay(targetYear, targetMonth, giornoEsecuzione);
  const resultDate = new Date(targetYear, targetMonth, validDay);
  const y = resultDate.getFullYear();
  const m = String(resultDate.getMonth() + 1).padStart(2, '0');
  const d = String(resultDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Genera date future per pianificati in avanti di N step
export function getUpcomingRecurrenceDates(
  recurrence: Recurrence,
  maxSteps: number = 3
): string[] {
  const dates: string[] = [];
  let currentDate = recurrence.prossima_data || calculateNextExecutionDate(
    recurrence.frequenza,
    recurrence.giorno_esecuzione,
    recurrence.data_inizio || undefined
  );

  const totalMax = recurrence.tipo_limite === 'TOT_VOLTE' && recurrence.ripetizioni_totali
    ? Math.max(0, recurrence.ripetizioni_totali - (recurrence.ripetizioni_eseguite || 0))
    : maxSteps;

  const count = Math.min(maxSteps, totalMax);

  for (let i = 0; i < count; i++) {
    if (recurrence.data_fine && currentDate > recurrence.data_fine) break;
    dates.push(currentDate);

    // Calcola successivo
    currentDate = calculateNextExecutionDate(
      recurrence.frequenza,
      recurrence.giorno_esecuzione,
      currentDate
    );
  }

  return dates;
}

export const RecurrenceService = {
  async getAll(): Promise<Recurrence[]> {
    if (!DB.RICORRENZE) DB.RICORRENZE = [];
    return [...DB.RICORRENZE].sort((a, b) => {
      // Attive prima
      if (a.attiva !== b.attiva) return a.attiva ? -1 : 1;
      return (a.nome || '').localeCompare(b.nome || '');
    });
  },

  async getActive(): Promise<Recurrence[]> {
    if (!DB.RICORRENZE) DB.RICORRENZE = [];
    return DB.RICORRENZE.filter(r => r.attiva);
  },

  async getById(id: string): Promise<Recurrence | undefined> {
    if (!DB.RICORRENZE) DB.RICORRENZE = [];
    return DB.RICORRENZE.find(r => r.id === id);
  },

  async getBySubcategoryId(subcategoryId: string): Promise<Recurrence[]> {
    if (!DB.RICORRENZE) DB.RICORRENZE = [];
    return DB.RICORRENZE.filter(r => r.sottocategoria_id === subcategoryId);
  },

  // Recupera tutti i movimenti reali collegati a questa ricorrenza
  async getLinkedMovements(recurrenceId: string): Promise<Movement[]> {
    if (!DB.MOVIMENTI) DB.MOVIMENTI = [];
    return DB.MOVIMENTI.filter(m => m.id_ricorrenza === recurrenceId).sort((a, b) => {
      if (b.data !== a.data) return b.data.localeCompare(a.data);
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
  },

  // Trova movimenti idonei da collegare (stessa sottocategoria, non ancora associati ad altra ricorrenza)
  async findEligibleMovements(subcategoryId?: string, currentRecurrenceId?: string): Promise<Movement[]> {
    if (!DB.MOVIMENTI) DB.MOVIMENTI = [];
    return DB.MOVIMENTI.filter(m => {
      // Se è già associato a questa ricorrenza, è idoneo
      if (currentRecurrenceId && m.id_ricorrenza === currentRecurrenceId) return true;
      // Se è associato ad un'altra ricorrenza, non è idoneo
      if (m.id_ricorrenza && m.id_ricorrenza !== currentRecurrenceId) return false;
      // Se specificata la sottocategoria, deve corrispondere
      if (subcategoryId && m.sottocategoria_id !== subcategoryId) return false;
      return true;
    }).sort((a, b) => {
      if (b.data !== a.data) return b.data.localeCompare(a.data);
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
  },

  // Collega una lista di movimenti reali a una ricorrenza
  async linkMovements(recurrenceId: string, movementIds: string[], syncRipetizioni: boolean = true): Promise<void> {
    if (!DB.MOVIMENTI) DB.MOVIMENTI = [];
    if (!DB.RICORRENZE) DB.RICORRENZE = [];
    const rec = DB.RICORRENZE.find(r => r.id === recurrenceId);
    if (!rec) throw new Error("Ricorrenza non trovata.");

    const targetSet = new Set(movementIds);

    // 1. Collega o scollega
    DB.MOVIMENTI.forEach(m => {
      if (targetSet.has(m.id)) {
        m.id_ricorrenza = recurrenceId;
        m.origine_dati = 'RICORRENZA';
      } else if (m.id_ricorrenza === recurrenceId) {
        // Se non è più nella lista, scollega
        m.id_ricorrenza = null;
      }
    });

    // 2. Se a tot volte e sync attivo, aggiorna ripetizioni eseguite
    if (syncRipetizioni && rec.tipo_limite === 'TOT_VOLTE') {
      const totalLinked = DB.MOVIMENTI.filter(m => m.id_ricorrenza === recurrenceId).length;
      rec.ripetizioni_eseguite = totalLinked;
      if (rec.ripetizioni_totali && rec.ripetizioni_eseguite >= rec.ripetizioni_totali) {
        rec.attiva = false;
      }
      rec.updated_at = new Date().toISOString();
    }

    persistDB();
  },

  // Scollega un singolo movimento dalla ricorrenza
  async unlinkMovement(movementId: string): Promise<void> {
    if (!DB.MOVIMENTI) return;
    const mov = DB.MOVIMENTI.find(m => m.id === movementId);
    if (!mov || !mov.id_ricorrenza) return;

    const recId = mov.id_ricorrenza;
    mov.id_ricorrenza = null;

    if (DB.RICORRENZE) {
      const rec = DB.RICORRENZE.find(r => r.id === recId);
      if (rec && rec.tipo_limite === 'TOT_VOLTE' && (rec.ripetizioni_eseguite || 0) > 0) {
        const totalLinked = DB.MOVIMENTI.filter(m => m.id_ricorrenza === recId).length;
        rec.ripetizioni_eseguite = totalLinked;
        rec.updated_at = new Date().toISOString();
      }
    }

    persistDB();
  },

  async create(data: {
    nome: string;
    frequenza: RecurrenceFrequency;
    giorno_esecuzione: number;
    importo: number;
    tipologia: MovementType;
    conto_id: string;
    sottocategoria_id: string;
    attiva?: boolean;
    tipo_limite?: RecurrenceLimitType;
    ripetizioni_totali?: number;
    ripetizioni_eseguite?: number;
    data_inizio?: string;
    data_fine?: string;
    genera_pianificato_automatico?: boolean;
    note?: string;
    linked_movement_ids?: string[];
  }): Promise<Recurrence> {
    if (!data.nome || !data.nome.trim()) {
      throw new Error("Il nome o descrizione della ricorrenza è obbligatorio.");
    }
    if (typeof data.importo !== 'number' || isNaN(data.importo) || data.importo <= 0) {
      throw new Error("L'importo della ricorrenza deve essere maggiore di zero.");
    }
    if (!data.sottocategoria_id) {
      throw new Error("Selezionare la sottocategoria di riferimento per la ricorrenza.");
    }
    if (!data.conto_id) {
      throw new Error("Selezionare il conto o fondo di riferimento.");
    }

    if (!DB.RICORRENZE) DB.RICORRENZE = [];

    const giornoValido = Math.min(Math.max(1, data.giorno_esecuzione || 1), 31);
    const dataInizio = data.data_inizio || new Date().toISOString().split('T')[0];
    const prossimaData = calculateNextExecutionDate(data.frequenza, giornoValido, dataInizio);

    const initialLinkedCount = data.linked_movement_ids?.length || 0;
    const eseguiteCount = data.ripetizioni_eseguite !== undefined 
      ? data.ripetizioni_eseguite 
      : initialLinkedCount;

    const newRecurrence: Recurrence = {
      id: generateUUID(),
      ricorrenza_id: generateHumanID('RIC', 'RICORRENZE'),
      nome: data.nome.trim(),
      frequenza: data.frequenza || 'MENSILE',
      giorno_esecuzione: giornoValido,
      importo: Math.round(data.importo * 100) / 100,
      tipologia: data.tipologia,
      conto_id: data.conto_id,
      sottocategoria_id: data.sottocategoria_id,
      attiva: data.attiva !== undefined ? data.attiva : true,
      tipo_limite: data.tipo_limite || 'ILLIMITATA',
      ripetizioni_totali: data.tipo_limite === 'TOT_VOLTE' ? (data.ripetizioni_totali || 1) : undefined,
      ripetizioni_eseguite: eseguiteCount,
      data_inizio: dataInizio,
      data_fine: data.tipo_limite === 'DATA_FINE' ? data.data_fine : undefined,
      prossima_data: prossimaData,
      genera_pianificato_automatico: data.genera_pianificato_automatico !== undefined ? data.genera_pianificato_automatico : true,
      note: data.note ? data.note.trim() : '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    DB.RICORRENZE.push(newRecurrence);

    // Collega i movimenti passati selezionati
    if (data.linked_movement_ids && data.linked_movement_ids.length > 0) {
      const targetSet = new Set(data.linked_movement_ids);
      if (DB.MOVIMENTI) {
        DB.MOVIMENTI.forEach(m => {
          if (targetSet.has(m.id)) {
            m.id_ricorrenza = newRecurrence.id;
            m.origine_dati = 'RICORRENZA';
          }
        });
      }
    }

    // Se richiesto, genera i movimenti pianificati collegati per i prossimi mesi
    if (newRecurrence.attiva && newRecurrence.genera_pianificato_automatico) {
      await this.syncRecurrencePlanned(newRecurrence);
    }

    persistDB();
    return newRecurrence;
  },

  async update(id: string, updates: Partial<Recurrence> & { linked_movement_ids?: string[] }): Promise<Recurrence> {
    if (!DB.RICORRENZE) DB.RICORRENZE = [];
    const rec = DB.RICORRENZE.find(r => r.id === id);
    if (!rec) throw new Error("Ricorrenza non trovata.");

    if (updates.importo !== undefined && (isNaN(updates.importo) || updates.importo <= 0)) {
      throw new Error("L'importo deve essere maggiore di zero.");
    }

    // Sincronizza i movimenti collegati se specificati
    if (updates.linked_movement_ids !== undefined) {
      const targetSet = new Set(updates.linked_movement_ids);
      if (DB.MOVIMENTI) {
        DB.MOVIMENTI.forEach(m => {
          if (targetSet.has(m.id)) {
            m.id_ricorrenza = rec.id;
            m.origine_dati = 'RICORRENZA';
          } else if (m.id_ricorrenza === rec.id) {
            m.id_ricorrenza = null;
          }
        });
      }
      if (rec.tipo_limite === 'TOT_VOLTE' && updates.ripetizioni_eseguite === undefined) {
        updates.ripetizioni_eseguite = updates.linked_movement_ids.length;
      }
    }

    const { linked_movement_ids, ...directUpdates } = updates;
    Object.assign(rec, directUpdates);
    rec.updated_at = new Date().toISOString();

    // Ricalcola prossima data se sono cambiati frequenza o giorno
    if (updates.frequenza || updates.giorno_esecuzione) {
      rec.prossima_data = calculateNextExecutionDate(rec.frequenza, rec.giorno_esecuzione);
    }

    // Se disattivata o completata, aggiorna stato
    if (rec.tipo_limite === 'TOT_VOLTE' && rec.ripetizioni_totali) {
      if ((rec.ripetizioni_eseguite || 0) >= rec.ripetizioni_totali) {
        rec.attiva = false;
      }
    }

    if (rec.attiva && rec.genera_pianificato_automatico) {
      await this.syncRecurrencePlanned(rec);
    }

    persistDB();
    return rec;
  },

  async toggleActive(id: string): Promise<boolean> {
    if (!DB.RICORRENZE) DB.RICORRENZE = [];
    const rec = DB.RICORRENZE.find(r => r.id === id);
    if (!rec) throw new Error("Ricorrenza non trovata.");

    rec.attiva = !rec.attiva;
    rec.updated_at = new Date().toISOString();

    if (rec.attiva && rec.genera_pianificato_automatico) {
      await this.syncRecurrencePlanned(rec);
    }

    persistDB();
    return rec.attiva;
  },

  async delete(id: string, removeLinkedPlanned: boolean = false): Promise<boolean> {
    if (!DB.RICORRENZE) return false;
    const initialLen = DB.RICORRENZE.length;
    DB.RICORRENZE = DB.RICORRENZE.filter(r => r.id !== id);

    if (removeLinkedPlanned && DB.PIANIFICATI) {
      DB.PIANIFICATI = DB.PIANIFICATI.filter(p => p.id_ricorrenza !== id || p.stato === 'ESEGUITO');
    }

    if (DB.RICORRENZE.length !== initialLen) {
      persistDB();
      return true;
    }
    return false;
  },

  // Esegue istantaneamente un'occorrenza della ricorrenza (genera movimento reale + avanza contatore rate)
  async executeOccurrence(
    id: string,
    actualDate?: string,
    actualAmount?: number
  ): Promise<Movement> {
    if (!DB.RICORRENZE) DB.RICORRENZE = [];
    const rec = DB.RICORRENZE.find(r => r.id === id);
    if (!rec) throw new Error("Ricorrenza non trovata.");

    const finalDate = actualDate || rec.prossima_data || new Date().toISOString().split('T')[0];
    const finalAmount = actualAmount !== undefined ? actualAmount : rec.importo;

    const rateProgressNote = rec.tipo_limite === 'TOT_VOLTE' && rec.ripetizioni_totali
      ? ` (Rata ${(rec.ripetizioni_eseguite || 0) + 1} di ${rec.ripetizioni_totali})`
      : '';

    // 1. Crea il movimento effettivo
    const currentRata = (rec.ripetizioni_eseguite || 0) + 1;
    const realMovement = await MovementService.create({
      data: finalDate,
      descrizione: `${rec.nome}${rateProgressNote}`,
      importo: finalAmount,
      tipologia: rec.tipologia,
      conto_origine: rec.conto_id,
      sottocategoria_id: rec.sottocategoria_id,
      note: `Eseguito da ricorrenza automatica ${rec.ricorrenza_id}${rec.note ? ' - ' + rec.note : ''}`,
      origine_dati: 'RICORRENZA',
      id_ricorrenza: rec.id,
      numero_rata: rec.tipo_limite === 'TOT_VOLTE' ? currentRata : null
    });

    // 2. Avanza contatore ripetizioni eseguite
    rec.ripetizioni_eseguite = (rec.ripetizioni_eseguite || 0) + 1;

    // 3. Controlla se abbiamo raggiunto il limite totale
    if (rec.tipo_limite === 'TOT_VOLTE' && rec.ripetizioni_totali && rec.ripetizioni_eseguite >= rec.ripetizioni_totali) {
      rec.attiva = false;
    }

    // 4. Ricalcola prossima data di esecuzione
    rec.prossima_data = calculateNextExecutionDate(rec.frequenza, rec.giorno_esecuzione, finalDate);
    rec.updated_at = new Date().toISOString();

    // 5. Se c'era un pianificato pendente per questa data e ricorrenza, marcalo come eseguito
    if (DB.PIANIFICATI) {
      const pendingPlanned = DB.PIANIFICATI.find(
        p => p.id_ricorrenza === rec.id && p.stato === 'PENDENTE' && p.data_prevista <= finalDate
      );
      if (pendingPlanned) {
        pendingPlanned.stato = 'ESEGUITO';
        pendingPlanned.movimento_reale_id = realMovement.id;
      }
    }

    // Sincronizza prossimi pianificati
    if (rec.attiva && rec.genera_pianificato_automatico) {
      await this.syncRecurrencePlanned(rec);
    }

    persistDB();
    return realMovement;
  },

  // Sincronizza i movimenti pianificati per una specifica ricorrenza per i prossimi mesi
  async syncRecurrencePlanned(rec: Recurrence): Promise<void> {
    if (!DB.PIANIFICATI) DB.PIANIFICATI = [];
    if (!rec.attiva) return;

    const upcomingDates = getUpcomingRecurrenceDates(rec, 3);

    for (const dateStr of upcomingDates) {
      // Controlla se esiste già un pianificato per questa ricorrenza e data
      const exists = DB.PIANIFICATI.some(
        p => p.id_ricorrenza === rec.id && p.data_prevista === dateStr
      );

      if (!exists) {
        const rateNote = rec.tipo_limite === 'TOT_VOLTE' && rec.ripetizioni_totali
          ? ` (Ripetizione ricorrente con limite ${rec.ripetizioni_totali} volte)`
          : ' (Ricorrenza programmata)';

        const newPlanned: Planned = {
          id: generateUUID(),
          pianificato_id: generateHumanID('PIA', 'PIANIFICATI'),
          data_prevista: dateStr,
          descrizione: `${rec.nome}${rateNote}`,
          importo: rec.importo,
          tipologia: rec.tipologia,
          conto_id: rec.conto_id,
          sottocategoria_id: rec.sottocategoria_id,
          stato: 'PENDENTE',
          id_ricorrenza: rec.id,
          note: rec.note || 'Generato automaticamente da regola di ricorrenza'
        };

        DB.PIANIFICATI.push(newPlanned);
      }
    }
  },

  // Sincronizza tutte le ricorrenze attive
  async syncAllActiveRecurrences(): Promise<void> {
    if (!DB.RICORRENZE) return;
    for (const rec of DB.RICORRENZE) {
      if (rec.attiva && rec.genera_pianificato_automatico) {
        await this.syncRecurrencePlanned(rec);
      }
    }
    persistDB();
  },

  // Calcola statistiche aggregate delle ricorrenze
  async getMetrics(): Promise<{
    totaleRicorrenze: number;
    attiveCount: number;
    usciteMensiliStimate: number;
    entrateMensiliStimate: number;
    aTermineCount: number;
    subcategoriesMap: Record<string, { count: number; totaleImporto: number }>;
  }> {
    const all = await this.getAll();
    const attive = all.filter(r => r.attiva);

    let usciteMensili = 0;
    let entrateMensili = 0;
    let aTermine = 0;
    const subMap: Record<string, { count: number; totaleImporto: number }> = {};

    for (const r of attive) {
      // Normalizzazione mensile per frequenza
      let fattore = 1;
      if (r.frequenza === 'SETTIMANALE') fattore = 4.33;
      if (r.frequenza === 'QUATTORDICINALE') fattore = 2.16;
      if (r.frequenza === 'BIMESTRALE') fattore = 0.5;
      if (r.frequenza === 'TRIMESTRALE') fattore = 0.333;
      if (r.frequenza === 'SEMESTRALE') fattore = 0.166;
      if (r.frequenza === 'ANNUALE') fattore = 0.0833;

      const mensilizzato = r.importo * fattore;

      if (r.tipologia === 'USCITA') {
        usciteMensili += mensilizzato;
      } else if (r.tipologia === 'ENTRATA') {
        entrateMensili += mensilizzato;
      }

      if (r.tipo_limite === 'TOT_VOLTE' || r.tipo_limite === 'DATA_FINE') {
        aTermine++;
      }

      if (!subMap[r.sottocategoria_id]) {
        subMap[r.sottocategoria_id] = { count: 0, totaleImporto: 0 };
      }
      subMap[r.sottocategoria_id].count++;
      subMap[r.sottocategoria_id].totaleImporto += r.importo;
    }

    return {
      totaleRicorrenze: all.length,
      attiveCount: attive.length,
      usciteMensiliStimate: Math.round(usciteMensili * 100) / 100,
      entrateMensiliStimate: Math.round(entrateMensili * 100) / 100,
      aTermineCount: aTermine,
      subcategoriesMap: subMap
    };
  }
};
