import { DB, persistDB, generateHumanID, generateUUID, cleanDataForFirestore } from './store';
import { db } from './firebase';
import { doc, setDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';
import { Project, ProjectStats, ProjectType, ProjectStatus, Movement, Deadline, Planned, NoteItem } from '../types';

export const ProjectService = {
  async getAll(): Promise<Project[]> {
    // Se la memoria locale è vuota ma ci sono progetti nella collezione dedicata Firestore, recuperali
    if ((!DB.PROGETTI || DB.PROGETTI.length === 0) && typeof window !== 'undefined') {
      try {
        const colSnap = await getDocs(collection(db, 'PROGETTI'));
        if (!colSnap.empty) {
          const fetched: Project[] = [];
          colSnap.forEach(d => {
            fetched.push(d.data() as Project);
          });
          if (fetched.length > 0) {
            DB.PROGETTI = fetched;
            await persistDB();
          }
        }
      } catch (err) {
        console.warn("Recupero progetti da collezione PROGETTI:", err);
      }
    }
    return [...(DB.PROGETTI || [])];
  },

  async getById(id: string): Promise<Project | null> {
    const project = (DB.PROGETTI || []).find(p => p.id === id || p.progetto_id === id);
    return project ? { ...project } : null;
  },

  async getProjectStats(projectId: string): Promise<ProjectStats> {
    const project = (DB.PROGETTI || []).find(p => p.id === projectId || p.progetto_id === projectId);
    if (!project) throw new Error("Progetto non trovato.");

    const subcategory = (DB.SOTTOCATEGORIE || []).find(s => s.id === project.sottocategoria_id);
    const subcategoryName = subcategory?.nome || 'Generale';
    const categoriaPadre = subcategory?.categoria_padre || 'Non assegnata';

    // Movimenti legati prettamente alla sottocategoria determinata OPPURE con esplicito riferimento progetto_id
    const movimenti = (DB.MOVIMENTI || []).filter(m => 
      (project.sottocategoria_id && m.sottocategoria_id === project.sottocategoria_id) || 
      m.progetto_id === project.id || 
      m.progetto_id === project.progetto_id
    );

    // Ordina movimenti dal più recente al più vecchio
    movimenti.sort((a, b) => b.data.localeCompare(a.data));

    let totaleSpesoMovimenti = 0;
    let movimentiSpesaCount = 0;

    movimenti.forEach(m => {
      if (m.tipologia === 'USCITA') {
        totaleSpesoMovimenti += m.importo;
        movimentiSpesaCount += 1;
      } else if (m.tipologia === 'ENTRATA') {
        totaleSpesoMovimenti -= m.importo;
      }
    });

    // Supporto per finanziamenti già iniziati (quota o rate pregresse già pagate prima dell'inizio del tracciamento nell'app)
    const importoGiaPagato = Number(project.importo_gia_pagato || 0);
    const rateGiaPagate = Number(project.rate_gia_pagate || 0);

    const roundedSpeso = Math.max(0, Math.round((importoGiaPagato + totaleSpesoMovimenti) * 100) / 100);
    const budgetTotale = project.budget_previsto || 0;
    const residuo = Math.max(0, Math.round((budgetTotale - roundedSpeso) * 100) / 100);
    const percentuale = budgetTotale > 0 ? Math.min(100, Math.round((roundedSpeso / budgetTotale) * 100)) : 0;

    // Scadenze collegate alla sottocategoria del progetto
    const scadenzeCollegate = (DB.SCADENZE || []).filter(s => 
      !(s as any).is_deleted &&
      Boolean(project.sottocategoria_id && s.sottocategoria_id === project.sottocategoria_id)
    );

    // Movimenti pianificati collegati alla sottocategoria del progetto
    const pianificatiCollegati = (DB.PIANIFICATI || []).filter(p => 
      !(p as any).is_deleted &&
      Boolean(project.sottocategoria_id && p.sottocategoria_id === project.sottocategoria_id)
    );

    // Note collegate specificamente a questo progetto
    const noteCollegate = (DB.NOTE || []).filter(n =>
      Boolean(n.collegamento_progetto_id && (n.collegamento_progetto_id === project.id || n.collegamento_progetto_id === project.progetto_id))
    );

    // Calcolo rate pagate e rate rimanenti (includendo le rate già saldate prima dell'app)
    let ratePagateStimate = rateGiaPagate + movimentiSpesaCount;
    if (project.rata_mensile && project.rata_mensile > 0 && roundedSpeso > 0) {
      ratePagateStimate = Math.round(roundedSpeso / project.rata_mensile);
    }

    let rateRimanentiStimate = 0;
    if (project.rata_mensile && project.rata_mensile > 0 && residuo > 0) {
      rateRimanentiStimate = Math.ceil(residuo / project.rata_mensile);
    } else if (project.numero_rate_totali && project.numero_rate_totali > 0) {
      rateRimanentiStimate = Math.max(0, project.numero_rate_totali - ratePagateStimate);
    }

    // Calcolo data estinzione stimata
    let dataFineStimata = project.data_fine;
    if (!dataFineStimata && rateRimanentiStimate > 0) {
      const estimatedDate = new Date();
      estimatedDate.setMonth(estimatedDate.getMonth() + rateRimanentiStimate);
      dataFineStimata = estimatedDate.toISOString().split('T')[0];
    }

    return {
      project,
      sottocategoriaNome: subcategoryName,
      categoriaPadre,
      totaleSpeso: roundedSpeso,
      importoGiaPagato,
      residuo,
      percentuale,
      movimentiCount: movimenti.length,
      ratePagateStimate,
      rateRimanentiStimate,
      dataFineStimata,
      movimenti,
      scadenzeCollegate,
      pianificatiCollegati,
      noteCollegate
    };
  },

  async getAllProjectStats(): Promise<ProjectStats[]> {
    const projects = await this.getAll();
    const statsPromises = projects.map(p => this.getProjectStats(p.id));
    const allStats = await Promise.all(statsPromises);

    // Ordina: prima ATTIVI (con residuo decrescente), poi COMPLETATI / ALTRI
    return allStats.sort((a, b) => {
      if (a.project.stato === 'ATTIVO' && b.project.stato !== 'ATTIVO') return -1;
      if (a.project.stato !== 'ATTIVO' && b.project.stato === 'ATTIVO') return 1;
      return b.residuo - a.residuo;
    });
  },

  async getOverallSummary(): Promise<{
    totaleDebitoResiduo: number;
    totaleFinanziato: number;
    totaleRimborsato: number;
    rataMensileComplessiva: number;
    progettiAttiviCount: number;
    finanziamentiCount: number;
  }> {
    const allStats = await this.getAllProjectStats();
    let totaleDebitoResiduo = 0;
    let totaleFinanziato = 0;
    let totaleRimborsato = 0;
    let rataMensileComplessiva = 0;
    let progettiAttiviCount = 0;
    let finanziamentiCount = 0;

    allStats.forEach(stat => {
      if (stat.project.stato === 'ATTIVO') {
        totaleDebitoResiduo += stat.residuo;
        totaleFinanziato += stat.project.budget_previsto;
        totaleRimborsato += stat.totaleSpeso;
        if (stat.project.rata_mensile) {
          rataMensileComplessiva += stat.project.rata_mensile;
        }
        if (stat.project.tipo === 'MUTUO' || stat.project.tipo === 'FINANZIAMENTO' || stat.project.tipo === 'PRESTITO' || stat.project.tipo === 'DEBITO') {
          finanziamentiCount += 1;
        } else {
          progettiAttiviCount += 1;
        }
      }
    });

    return {
      totaleDebitoResiduo: Math.round(totaleDebitoResiduo * 100) / 100,
      totaleFinanziato: Math.round(totaleFinanziato * 100) / 100,
      totaleRimborsato: Math.round(totaleRimborsato * 100) / 100,
      rataMensileComplessiva: Math.round(rataMensileComplessiva * 100) / 100,
      progettiAttiviCount,
      finanziamentiCount
    };
  },

  async create(data: {
    nome_progetto: string;
    tipo: ProjectType;
    sottocategoria_id: string;
    budget_previsto: number;
    importo_iniziale?: number;
    importo_gia_pagato?: number;
    rate_gia_pagate?: number;
    rata_mensile?: number;
    numero_rate_totali?: number;
    tasso_interesse?: number;
    conto_addebito_id?: string;
    giorno_addebito_rata?: number;
    stato?: ProjectStatus;
    data_inizio?: string;
    data_fine?: string;
    colore?: string;
    icona?: string;
    note?: string;
  }): Promise<Project> {
    if (!data.nome_progetto || !data.nome_progetto.trim()) {
      throw new Error("Il nome del progetto o finanziamento è obbligatorio.");
    }
    const budget = Number(data.budget_previsto);
    if (isNaN(budget) || budget <= 0) {
      throw new Error("Il budget o importo finanziato deve essere un numero positivo.");
    }
    if (!data.sottocategoria_id) {
      throw new Error("Specificare la sottocategoria associata al progetto.");
    }

    const newProject: Project = {
      id: generateUUID(),
      progetto_id: generateHumanID('PRO', 'PROGETTI'),
      nome_progetto: data.nome_progetto.trim(),
      tipo: data.tipo || 'FINANZIAMENTO',
      sottocategoria_id: data.sottocategoria_id,
      budget_previsto: Math.round(budget * 100) / 100,
      importo_iniziale: data.importo_iniziale ? Math.round(Number(data.importo_iniziale) * 100) / 100 : undefined,
      importo_gia_pagato: data.importo_gia_pagato ? Math.round(Number(data.importo_gia_pagato) * 100) / 100 : undefined,
      rate_gia_pagate: data.rate_gia_pagate ? Number(data.rate_gia_pagate) : undefined,
      rata_mensile: data.rata_mensile ? Math.round(Number(data.rata_mensile) * 100) / 100 : undefined,
      numero_rate_totali: data.numero_rate_totali ? Number(data.numero_rate_totali) : undefined,
      tasso_interesse: data.tasso_interesse ? Number(data.tasso_interesse) : undefined,
      conto_addebito_id: data.conto_addebito_id,
      giorno_addebito_rata: data.giorno_addebito_rata ? Number(data.giorno_addebito_rata) : undefined,
      stato: data.stato || 'ATTIVO',
      data_inizio: data.data_inizio || new Date().toISOString().split('T')[0],
      data_fine: data.data_fine,
      colore: data.colore,
      icona: data.icona,
      note: data.note ? data.note.trim() : '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (!DB.PROGETTI) DB.PROGETTI = [];
    DB.PROGETTI.push(newProject);
    await persistDB();

    // Dual-write su collezione dedicata Firestore per ridondanza e protezione totale
    try {
      if (typeof window !== 'undefined') {
        const cleanProject = cleanDataForFirestore(newProject);
        await setDoc(doc(db, 'PROGETTI', newProject.id), cleanProject);
      }
    } catch (colErr) {
      console.warn("Dual-write su collezione PROGETTI:", colErr);
    }

    return newProject;
  },

  async update(id: string, updates: Partial<Project>): Promise<Project> {
    const index = (DB.PROGETTI || []).findIndex(p => p.id === id || p.progetto_id === id);
    if (index === -1) throw new Error("Progetto non trovato.");

    if (updates.budget_previsto !== undefined) {
      const budget = Number(updates.budget_previsto);
      if (isNaN(budget) || budget <= 0) {
        throw new Error("Il budget del progetto deve essere un valore numerico positivo.");
      }
    }

    const existing = DB.PROGETTI[index];
    const updated: Project = {
      ...existing,
      ...updates,
      nome_progetto: updates.nome_progetto ? updates.nome_progetto.trim() : existing.nome_progetto,
      budget_previsto: updates.budget_previsto !== undefined ? Math.round(Number(updates.budget_previsto) * 100) / 100 : existing.budget_previsto,
      importo_gia_pagato: updates.importo_gia_pagato !== undefined ? (updates.importo_gia_pagato ? Math.round(Number(updates.importo_gia_pagato) * 100) / 100 : undefined) : existing.importo_gia_pagato,
      rate_gia_pagate: updates.rate_gia_pagate !== undefined ? (updates.rate_gia_pagate ? Number(updates.rate_gia_pagate) : undefined) : existing.rate_gia_pagate,
      rata_mensile: updates.rata_mensile !== undefined ? (updates.rata_mensile ? Math.round(Number(updates.rata_mensile) * 100) / 100 : undefined) : existing.rata_mensile,
      updated_at: new Date().toISOString()
    };

    DB.PROGETTI[index] = updated;
    await persistDB();

    // Dual-write update su collezione dedicata Firestore
    try {
      if (typeof window !== 'undefined') {
        const cleanProject = cleanDataForFirestore(updated);
        await setDoc(doc(db, 'PROGETTI', updated.id), cleanProject);
      }
    } catch (colErr) {
      console.warn("Dual-write update su collezione PROGETTI:", colErr);
    }

    return updated;
  },

  async delete(id: string): Promise<void> {
    const index = (DB.PROGETTI || []).findIndex(p => p.id === id || p.progetto_id === id);
    if (index === -1) throw new Error("Progetto non trovato.");

    const removed = DB.PROGETTI.splice(index, 1)[0];
    await persistDB();

    // Dual-write delete su collezione dedicata Firestore
    try {
      if (typeof window !== 'undefined' && removed?.id) {
        await deleteDoc(doc(db, 'PROGETTI', removed.id));
      }
    } catch (colErr) {
      console.warn("Dual-write delete su collezione PROGETTI:", colErr);
    }
  }
};

