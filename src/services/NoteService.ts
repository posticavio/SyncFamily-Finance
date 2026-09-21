import { DB, persistDB, generateHumanID, generateUUID } from './store';
import { NoteItem, NoteCategory } from '../types';

export const NoteService = {
  async getAll(): Promise<NoteItem[]> {
    const list = [...(DB.NOTE || [])];
    // Ordina: prima le fissate (pinned), poi per data creazione più recente
    return list.sort((a, b) => {
      if (a.fissata && !b.fissata) return -1;
      if (!a.fissata && b.fissata) return 1;
      return (b.data_modifica || b.data_creazione).localeCompare(a.data_modifica || a.data_creazione);
    });
  },

  async getById(id: string): Promise<NoteItem | null> {
    const note = (DB.NOTE || []).find(n => n.id === id || n.nota_id === id);
    return note ? { ...note } : null;
  },

  async getByProjectId(projectId: string): Promise<NoteItem[]> {
    return (DB.NOTE || []).filter(n => n.collegamento_progetto_id === projectId);
  },

  async create(data: {
    titolo: string;
    contenuto: string;
    categoria?: string;
    tag?: string[];
    colore?: string;
    fissata?: boolean;
    data_creazione?: string;
    collegamento_progetto_id?: string;
  }): Promise<NoteItem> {
    if (!data.titolo || !data.titolo.trim()) {
      throw new Error("Il titolo della nota è obbligatorio.");
    }
    if (!DB.NOTE) DB.NOTE = [];

    const nowIso = new Date().toISOString();
    const todayStr = data.data_creazione || nowIso.split('T')[0];

    const newNote: NoteItem = {
      id: generateUUID(),
      nota_id: generateHumanID('NOT', 'NOTE' as any),
      titolo: data.titolo.trim(),
      contenuto: data.contenuto ? data.contenuto.trim() : '',
      categoria: data.categoria || 'IDEE',
      tag: data.tag || [],
      data_creazione: todayStr,
      data_modifica: nowIso,
      fissata: Boolean(data.fissata),
      colore: data.colore || '#4f46e5',
      collegamento_progetto_id: data.collegamento_progetto_id || undefined,
      completata: false
    };

    DB.NOTE.unshift(newNote);
    await persistDB();
    return newNote;
  },

  async update(id: string, updates: Partial<NoteItem>): Promise<NoteItem> {
    if (!DB.NOTE) DB.NOTE = [];
    const index = DB.NOTE.findIndex(n => n.id === id || n.nota_id === id);
    if (index === -1) {
      throw new Error(`Nota con id ${id} non trovata.`);
    }

    const current = DB.NOTE[index];
    const updated: NoteItem = {
      ...current,
      ...updates,
      data_modifica: new Date().toISOString()
    };

    DB.NOTE[index] = updated;
    await persistDB();
    return updated;
  },

  async togglePin(id: string): Promise<boolean> {
    if (!DB.NOTE) DB.NOTE = [];
    const index = DB.NOTE.findIndex(n => n.id === id || n.nota_id === id);
    if (index === -1) return false;

    DB.NOTE[index].fissata = !DB.NOTE[index].fissata;
    DB.NOTE[index].data_modifica = new Date().toISOString();
    await persistDB();
    return DB.NOTE[index].fissata ?? false;
  },

  async toggleComplete(id: string): Promise<boolean> {
    if (!DB.NOTE) DB.NOTE = [];
    const index = DB.NOTE.findIndex(n => n.id === id || n.nota_id === id);
    if (index === -1) return false;

    DB.NOTE[index].completata = !DB.NOTE[index].completata;
    DB.NOTE[index].data_modifica = new Date().toISOString();
    await persistDB();
    return DB.NOTE[index].completata ?? false;
  },

  async delete(id: string): Promise<void> {
    if (!DB.NOTE) return;
    const targetId = String(id).trim();
    DB.NOTE = DB.NOTE.filter(n => String(n.id).trim() !== targetId && String(n.nota_id).trim() !== targetId);
    await persistDB();
  },

  async getCategories(): Promise<string[]> {
    const defaults = ['IDEE', 'RISPARMIO', 'PROGETTI', 'ACQUISTI', 'FAMIGLIA', 'INVESTIMENTI', 'ALTRO'];
    const used = (DB.NOTE || []).map(n => n.categoria).filter(Boolean);
    return Array.from(new Set([...defaults, ...used]));
  },

  async getAllTags(): Promise<string[]> {
    const set = new Set<string>();
    (DB.NOTE || []).forEach(n => {
      if (Array.isArray(n.tag)) {
        n.tag.forEach(t => t && set.add(t.trim()));
      }
    });
    return Array.from(set);
  }
};
