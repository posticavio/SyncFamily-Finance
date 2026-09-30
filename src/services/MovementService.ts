import { DB, persistDB, generateHumanID, generateUUID } from './store';
import { Movement, MovementType, MovementNecessity, MovementAttachment, getSubcategoryNecessity } from '../types';

export const MovementService = {
  async getAll(filters?: {
    startDate?: string;
    endDate?: string;
    contoId?: string;
    sottocategoriaId?: string;
    tipo?: MovementType;
    searchQuery?: string;
    tag?: string;
  }): Promise<Movement[]> {
    let list = [...DB.MOVIMENTI];

    if (filters) {
      if (filters.startDate) {
        list = list.filter(m => m.data >= filters.startDate!);
      }
      if (filters.endDate) {
        list = list.filter(m => m.data <= filters.endDate!);
      }
      if (filters.contoId) {
        list = list.filter(m => m.conto_origine === filters.contoId || m.conto_destinazione === filters.contoId);
      }
      if (filters.sottocategoriaId) {
        list = list.filter(m => m.sottocategoria_id === filters.sottocategoriaId);
      }
      if (filters.tipo) {
        list = list.filter(m => m.tipologia === filters.tipo);
      }
      if (filters.tag && filters.tag !== 'ALL') {
        const targetTag = filters.tag.toLowerCase().trim();
        list = list.filter(m => 
          (m.tag && m.tag.toLowerCase().trim() === targetTag) ||
          (m.tags && m.tags.some(t => t.toLowerCase().trim() === targetTag))
        );
      }
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase().trim();
        list = list.filter(m => 
          m.descrizione.toLowerCase().includes(q) || 
          (m.note && m.note.toLowerCase().includes(q)) ||
          (m.tag && m.tag.toLowerCase().includes(q)) ||
          (m.tags && m.tags.some(t => t.toLowerCase().includes(q))) ||
          m.movimento_id.toLowerCase().includes(q)
        );
      }
    }

    // Ordina primariamente per data operazione decrescente (la transazione con data più recente in cima),
    // e a parità di data per timestamp di creazione decrescente
    return list.sort((a, b) => {
      if (b.data !== a.data) return b.data.localeCompare(a.data);
      const timeB = b.created_at || '';
      const timeA = a.created_at || '';
      return timeB.localeCompare(timeA);
    });
  },

  async getById(id: string): Promise<Movement | undefined> {
    return DB.MOVIMENTI.find(m => m.id === id || m.movimento_id === id);
  },

  async create(data: {
    data: string;
    descrizione: string;
    importo: number;
    tipologia: MovementType;
    conto_origine: string;
    conto_destinazione?: string | null;
    sottocategoria_id: string;
    natura?: 'FISSA' | 'VARIABILE';
    necessita?: MovementNecessity;
    progetto_id?: string | null;
    tag?: string | null;
    tags?: string[];
    fondo_id?: string | null;
    non_contabilizzato?: boolean;
    id_ricorrenza?: string | null;
    numero_rata?: number | null;
    note?: string;
    allegati?: MovementAttachment[];
    origine_dati?: 'MANUALE' | 'PIANIFICATO' | 'IMPORTAZIONE' | 'RICORRENZA';
  }): Promise<Movement> {
    if (data.importo <= 0) {
      throw new Error("L'importo del movimento deve essere maggiore di zero.");
    }
    if (!data.conto_origine) {
      throw new Error("Specificare il conto o fondo di origine.");
    }
    if (data.tipologia === 'GIROCONTO' && (!data.conto_destinazione || data.conto_origine === data.conto_destinazione)) {
      throw new Error("Per un giroconto è necessario selezionare un conto di destinazione diverso dall'origine.");
    }

    const nowIso = new Date().toISOString();
    const cleanTag = data.tag && data.tag.trim() ? data.tag.trim() : (data.tags && data.tags.length > 0 ? data.tags[0].trim() : null);
    const cleanTags = data.tags && data.tags.length > 0 
      ? Array.from(new Set(data.tags.map(t => t.trim()).filter(Boolean)))
      : (cleanTag ? [cleanTag] : []);

    const targetSub = DB.SOTTOCATEGORIE.find(s => s.id === data.sottocategoria_id);
    const resolvedNecessita = data.necessita || (targetSub ? getSubcategoryNecessity(targetSub) : 'DEVO');

    const newMovement: Movement = {
      id: generateUUID(),
      movimento_id: generateHumanID('MOV', 'MOVIMENTI'),
      data: data.data || nowIso.split('T')[0],
      descrizione: data.descrizione.trim() || 'Movimento',
      importo: Math.round(data.importo * 100) / 100,
      tipologia: data.tipologia,
      conto_origine: data.conto_origine,
      conto_destinazione: data.tipologia === 'GIROCONTO' ? (data.conto_destinazione || null) : null,
      sottocategoria_id: data.sottocategoria_id,
      natura: data.natura || 'VARIABILE',
      necessita: resolvedNecessita,
      progetto_id: data.progetto_id || null,
      tag: cleanTag,
      tags: cleanTags,
      fondo_id: data.fondo_id || null,
      stato: 'CONFERMATO',
      non_contabilizzato: !!data.non_contabilizzato,
      origine_dati: data.origine_dati || (data.id_ricorrenza ? 'RICORRENZA' : 'MANUALE'),
      id_ricorrenza: data.id_ricorrenza || null,
      numero_rata: data.numero_rata || null,
      note: data.note ? data.note.trim() : '',
      allegati: data.allegati || [],
      created_at: nowIso,
      updated_at: nowIso
    };

    DB.MOVIMENTI.unshift(newMovement);
    persistDB();
    return newMovement;
  },

  async update(id: string, updates: Partial<Movement>): Promise<Movement> {
    const index = DB.MOVIMENTI.findIndex(m => m.id === id);
    if (index === -1) {
      throw new Error("Movimento non trovato.");
    }

    const current = DB.MOVIMENTI[index];
    const newTipologia = updates.tipologia || current.tipologia;
    const newContoOrigine = updates.conto_origine || current.conto_origine;
    const newContoDest = updates.conto_destinazione !== undefined ? updates.conto_destinazione : current.conto_destinazione;

    if (updates.importo !== undefined && (typeof updates.importo !== 'number' || isNaN(updates.importo) || updates.importo <= 0)) {
      throw new Error("L'importo del movimento deve essere maggiore di zero.");
    }

    if (newTipologia === 'GIROCONTO' && (!newContoDest || newContoOrigine === newContoDest)) {
      throw new Error("Per un giroconto è necessario selezionare un conto di destinazione diverso dall'origine.");
    }

    const cleanTag = updates.tag !== undefined 
      ? (updates.tag && updates.tag.trim() ? updates.tag.trim() : null)
      : current.tag;
    const cleanTags = updates.tags !== undefined
      ? Array.from(new Set(updates.tags.map(t => t.trim()).filter(Boolean)))
      : (cleanTag ? [cleanTag] : current.tags || []);

    const updated: Movement = {
      ...current,
      ...updates,
      importo: updates.importo !== undefined ? Math.round(updates.importo * 100) / 100 : current.importo,
      conto_destinazione: newTipologia === 'GIROCONTO' ? (newContoDest || null) : null,
      tag: cleanTag,
      tags: cleanTags,
      updated_at: new Date().toISOString()
    };

    DB.MOVIMENTI[index] = updated;
    persistDB();
    return updated;
  },

  async delete(id: string): Promise<boolean> {
    const initialLen = DB.MOVIMENTI.length;
    DB.MOVIMENTI = DB.MOVIMENTI.filter(m => m.id !== id);
    if (DB.MOVIMENTI.length !== initialLen) {
      persistDB();
      return true;
    }
    return false;
  },

  async duplicate(id: string): Promise<Movement> {
    const original = await this.getById(id);
    if (!original) throw new Error("Movimento da duplicare non trovato.");

    const todayStr = new Date().toISOString().split('T')[0];
    return this.create({
      data: todayStr,
      descrizione: `${original.descrizione} (copia)`,
      importo: original.importo,
      tipologia: original.tipologia,
      conto_origine: original.conto_origine,
      conto_destinazione: original.conto_destinazione,
      sottocategoria_id: original.sottocategoria_id,
      natura: original.natura,
      necessita: original.necessita,
      progetto_id: original.progetto_id,
      tag: original.tag,
      tags: original.tags,
      fondo_id: original.fondo_id,
      note: original.note,
      origine_dati: 'MANUALE'
    });
  },

  async quickChangeAccount(id: string, newAccountId: string): Promise<Movement> {
    return this.update(id, { conto_origine: newAccountId });
  },

  async getAllTags(): Promise<string[]> {
    const tagSet = new Set<string>();
    if (Array.isArray(DB.TAGS)) {
      for (const t of DB.TAGS) {
        if (t.nome && t.nome.trim()) tagSet.add(t.nome.trim());
      }
    }
    for (const m of DB.MOVIMENTI) {
      if (m.tag && m.tag.trim()) {
        tagSet.add(m.tag.trim());
      }
      if (Array.isArray(m.tags)) {
        for (const t of m.tags) {
          if (t && t.trim()) tagSet.add(t.trim());
        }
      }
    }
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
  },

  async getTagStats(tag: string): Promise<{
    tag: string;
    totalExpenses: number;
    totalIncome: number;
    movementsCount: number;
    subcategories: { id: string; name: string; icon?: string; color?: string; total: number; count: number }[];
  }> {
    const normalizedTag = tag.toLowerCase().trim();
    const movements = DB.MOVIMENTI.filter(m => 
      (m.tag && m.tag.toLowerCase().trim() === normalizedTag) ||
      (m.tags && m.tags.some(t => t.toLowerCase().trim() === normalizedTag))
    );

    let totalExpenses = 0;
    let totalIncome = 0;
    const subMap = new Map<string, { total: number; count: number }>();

    for (const m of movements) {
      if (m.tipologia === 'USCITA') {
        totalExpenses += m.importo;
      } else if (m.tipologia === 'ENTRATA') {
        totalIncome += m.importo;
      }
      const existing = subMap.get(m.sottocategoria_id) || { total: 0, count: 0 };
      existing.total += m.importo;
      existing.count += 1;
      subMap.set(m.sottocategoria_id, existing);
    }

    const subcategoriesList: { id: string; name: string; icon?: string; color?: string; total: number; count: number }[] = [];
    for (const [subId, stat] of subMap.entries()) {
      const sub = (DB.SOTTOCATEGORIE || []).find(s => s.id === subId);
      subcategoriesList.push({
        id: subId,
        name: sub ? `${sub.categoria_padre} › ${sub.nome}` : 'Altra categoria',
        icon: sub?.icon_name,
        color: sub?.colore,
        total: Math.round(stat.total * 100) / 100,
        count: stat.count
      });
    }

    subcategoriesList.sort((a, b) => b.total - a.total);

    return {
      tag,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      totalIncome: Math.round(totalIncome * 100) / 100,
      movementsCount: movements.length,
      subcategories: subcategoriesList
    };
  }
};
