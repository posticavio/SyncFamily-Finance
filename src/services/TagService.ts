import { DB, persistDB } from './store';
import { TagItem, Movement } from '../types';

export const DEFAULT_TAG_PALETTE = [
  '#E31B23', // One UI Red Accent
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#84CC16', // Lime
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#64748B', // Slate
];

export const TagService = {
  /**
   * Restituisce tutti i tag salvati con metadati (colore, icona, statistiche).
   */
  async getSavedTags(): Promise<TagItem[]> {
    if (!DB.TAGS) {
      DB.TAGS = [];
    }

    return [...DB.TAGS].sort((a, b) => {
      if (a.is_favorite && !b.is_favorite) return -1;
      if (!a.is_favorite && b.is_favorite) return 1;
      return a.nome.localeCompare(b.nome, 'it', { sensitivity: 'base' });
    });
  },

  /**
   * Restituisce tutti i nomi dei tag univoci (per filtri e autocomplete rapidi).
   */
  async getUniqueTagNames(): Promise<string[]> {
    const saved = await this.getSavedTags();
    const names = new Set<string>(saved.map(t => t.nome.trim()));
    for (const m of DB.MOVIMENTI || []) {
      if (m.tag && m.tag.trim()) names.add(m.tag.trim());
      if (Array.isArray(m.tags)) {
        for (const t of m.tags) {
          if (t && t.trim()) names.add(t.trim());
        }
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
  },

  /**
   * Salva un nuovo tag nel dizionario per il riutilizzo.
   */
  async createTag(data: {
    nome: string;
    colore?: string;
    icona?: string;
    descrizione?: string;
    is_favorite?: boolean;
  }): Promise<TagItem> {
    if (!DB.TAGS) DB.TAGS = [];

    const cleanName = data.nome.trim().replace(/^#+/, '');
    if (!cleanName) {
      throw new Error("Il nome del tag non può essere vuoto.");
    }

    // Se esiste già un tag con lo stesso nome, restituisce quello esistente (o aggiorna)
    const existing = DB.TAGS.find(
      t => t.nome.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) {
      if (data.colore) existing.colore = data.colore;
      if (data.icona) existing.icona = data.icona;
      if (data.descrizione !== undefined) existing.descrizione = data.descrizione;
      if (data.is_favorite !== undefined) existing.is_favorite = data.is_favorite;
      await persistDB();
      return existing;
    }

    const randomColor = DEFAULT_TAG_PALETTE[DB.TAGS.length % DEFAULT_TAG_PALETTE.length];
    const newTag: TagItem = {
      id: `tag-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      nome: cleanName,
      colore: data.colore || randomColor,
      icona: data.icona,
      descrizione: data.descrizione?.trim(),
      is_favorite: data.is_favorite || false,
      created_at: new Date().toISOString()
    };

    DB.TAGS.push(newTag);
    await persistDB();
    return newTag;
  },

  /**
   * Aggiorna un tag salvato.
   */
  async updateTag(id: string, updates: Partial<TagItem>): Promise<TagItem> {
    if (!DB.TAGS) DB.TAGS = [];
    const index = DB.TAGS.findIndex(t => t.id === id);
    if (index === -1) throw new Error("Tag non trovato.");

    const oldName = DB.TAGS[index].nome;
    const newName = updates.nome ? updates.nome.trim().replace(/^#+/, '') : oldName;

    DB.TAGS[index] = {
      ...DB.TAGS[index],
      ...updates,
      nome: newName
    };

    // Se il nome è cambiato, rinomina il tag in tutti i movimenti esistenti
    if (oldName.toLowerCase() !== newName.toLowerCase()) {
      for (const m of DB.MOVIMENTI || []) {
        if (m.tag && m.tag.toLowerCase() === oldName.toLowerCase()) {
          m.tag = newName;
        }
        if (Array.isArray(m.tags)) {
          m.tags = m.tags.map(t => t.toLowerCase() === oldName.toLowerCase() ? newName : t);
        }
      }
    }

    await persistDB();
    return DB.TAGS[index];
  },

  /**
   * Elimina un tag salvato e lo rimuove dai movimenti.
   */
  async deleteTag(id: string, removeFromMovements: boolean = true): Promise<void> {
    if (!DB.TAGS) DB.TAGS = [];
    const tag = DB.TAGS.find(t => t.id === id);
    if (!tag) return;

    const targetName = tag.nome.toLowerCase().trim();
    DB.TAGS = DB.TAGS.filter(t => t.id !== id);

    if (removeFromMovements && targetName) {
      for (const m of DB.MOVIMENTI || []) {
        if (m.tag && m.tag.toLowerCase().trim() === targetName) {
          m.tag = null;
        }
        if (Array.isArray(m.tags)) {
          m.tags = m.tags.filter(t => t && t.toLowerCase().trim() !== targetName);
        }
        if (!m.tag && Array.isArray(m.tags) && m.tags.length > 0) {
          m.tag = m.tags[0];
        }
      }
    }

    await persistDB();
  },

  /**
   * ASSEGNAZIONE IN BLOCCO (BULK TAG ASSIGNMENT):
   * Assegna, sostituisce o rimuove un tag a un insieme di movimenti selezionati.
   */
  async bulkAssignTag(params: {
    movementIds: string[];
    tag: string;
    mode: 'ADD' | 'REPLACE' | 'REMOVE';
    saveForReuse?: boolean;
    color?: string;
  }): Promise<{ affectedCount: number; tag: string }> {
    const { movementIds, mode, saveForReuse = true, color } = params;
    const cleanTag = params.tag.trim().replace(/^#+/, '');

    if (!cleanTag) {
      throw new Error("Specificare un tag valido.");
    }
    if (!movementIds || movementIds.length === 0) {
      return { affectedCount: 0, tag: cleanTag };
    }

    const idSet = new Set(movementIds);
    let affectedCount = 0;

    for (const m of DB.MOVIMENTI || []) {
      if (!idSet.has(m.id)) continue;

      let currentTags: string[] = Array.isArray(m.tags) ? [...m.tags] : [];
      if (m.tag && !currentTags.includes(m.tag)) {
        currentTags.push(m.tag);
      }

      if (mode === 'ADD') {
        const alreadyHas = currentTags.some(t => t.toLowerCase() === cleanTag.toLowerCase());
        if (!alreadyHas) {
          currentTags.push(cleanTag);
        }
        m.tags = currentTags;
        if (!m.tag) m.tag = cleanTag;
        affectedCount++;
      } else if (mode === 'REPLACE') {
        m.tags = [cleanTag];
        m.tag = cleanTag;
        affectedCount++;
      } else if (mode === 'REMOVE') {
        const initialLen = currentTags.length;
        currentTags = currentTags.filter(t => t.toLowerCase() !== cleanTag.toLowerCase());
        m.tags = currentTags;
        if (m.tag && m.tag.toLowerCase() === cleanTag.toLowerCase()) {
          m.tag = currentTags.length > 0 ? currentTags[0] : null;
        }
        if (currentTags.length !== initialLen || !m.tag) {
          affectedCount++;
        }
      }
    }

    // Se richiesto e se non stiamo rimuovendo, salva automaticamente il tag per futuri riutilizzi
    if (saveForReuse && mode !== 'REMOVE') {
      try {
        await this.createTag({ nome: cleanTag, colore: color });
      } catch (e) {
        console.warn("Tag salvataggio automatico:", e);
      }
    }

    await persistDB();
    return { affectedCount, tag: cleanTag };
  },

  /**
   * Statistiche relative a un tag per analisi rapida.
   */
  async getTagUsageCount(tagName: string): Promise<number> {
    const norm = tagName.toLowerCase().trim();
    let count = 0;
    for (const m of DB.MOVIMENTI || []) {
      if ((m.tag && m.tag.toLowerCase().trim() === norm) ||
          (Array.isArray(m.tags) && m.tags.some(t => t.toLowerCase().trim() === norm))) {
        count++;
      }
    }
    return count;
  }
};
