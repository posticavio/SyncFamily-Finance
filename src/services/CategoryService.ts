import { DB, persistDB, generateHumanID, generateUUID } from './store';
import { Subcategory, MovementType, MovementNecessity, SubcategoryClassification, getSubcategoryClassification, getSubcategoryNecessity } from '../types';

export const CategoryService = {
  async getAllSubcategories(): Promise<Subcategory[]> {
    return [...DB.SOTTOCATEGORIE].sort((a, b) => (a.ordine || 0) - (b.ordine || 0));
  },

  async getSubcategoryById(id: string): Promise<Subcategory | undefined> {
    return DB.SOTTOCATEGORIE.find(s => s.id === id);
  },

  async getParentCategories(): Promise<string[]> {
    const set = new Set<string>();
    DB.SOTTOCATEGORIE.forEach(s => {
      if (s.categoria_padre) set.add(s.categoria_padre);
    });
    return Array.from(set).sort();
  },

  async getFavorites(): Promise<Subcategory[]> {
    return DB.SOTTOCATEGORIE.filter(s => s.preferita && s.attiva).sort((a, b) => a.ordine - b.ordine);
  },

  async toggleFavorite(id: string): Promise<boolean> {
    const sub = DB.SOTTOCATEGORIE.find(s => s.id === id);
    if (sub) {
      sub.preferita = !sub.preferita;
      persistDB();
      return sub.preferita;
    }
    return false;
  },

  // Aggiornamento di una sottocategoria (personalizzazione icona/emoji, colore, nome, regola 50/30/20)
  async updateSubcategory(id: string, updates: Partial<Subcategory>): Promise<Subcategory> {
    const sub = DB.SOTTOCATEGORIE.find(s => s.id === id);
    if (!sub) {
      throw new Error("Sottocategoria non trovata.");
    }
    Object.assign(sub, updates);
    persistDB();
    return sub;
  },

  // Creazione "in place" diretta dal modale di transazione
  async createSubcategory(data: {
    nome: string;
    categoria_padre: string;
    tipo: MovementType;
    classificazione?: SubcategoryClassification;
    necessita?: MovementNecessity;
    icon_name?: string;
    colore?: string;
    preferita?: boolean;
  }): Promise<Subcategory> {
    const tempSub = {
      tipo: data.tipo,
      nome: data.nome.trim(),
      categoria_padre: data.categoria_padre.trim() || (data.tipo === 'ENTRATA' ? 'Entrate Varie' : 'Spese Varie'),
      classificazione: data.classificazione,
      necessita: data.necessita
    } as Subcategory;

    const resolvedClassification = data.classificazione || getSubcategoryClassification(tempSub);
    const resolvedNecessita = data.necessita || getSubcategoryNecessity(tempSub);

    const newSub: Subcategory = {
      id: generateUUID(),
      sottocategoria_id: generateHumanID('SUB', 'SOTTOCATEGORIE'),
      nome: data.nome.trim(),
      categoria_padre: data.categoria_padre.trim() || (data.tipo === 'ENTRATA' ? 'Entrate Varie' : 'Spese Varie'),
      tipo: data.tipo,
      classificazione: resolvedClassification,
      necessita: resolvedNecessita,
      icon_name: data.icon_name || (data.tipo === 'ENTRATA' ? 'PlusCircle' : 'Tag'),
      colore: data.colore || (data.tipo === 'ENTRATA' ? '#10B981' : '#E31B23'),
      preferita: data.preferita ?? true,
      ordine: DB.SOTTOCATEGORIE.length + 1,
      attiva: true
    };

    DB.SOTTOCATEGORIE.push(newSub);
    persistDB();
    return newSub;
  },

  async deleteSubcategory(id: string): Promise<boolean> {
    const idx = DB.SOTTOCATEGORIE.findIndex(s => s.id === id);
    if (idx !== -1) {
      DB.SOTTOCATEGORIE.splice(idx, 1);
      persistDB();
      return true;
    }
    return false;
  }
};
