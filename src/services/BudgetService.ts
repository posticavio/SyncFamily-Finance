import { DB, persistDB, generateHumanID, generateUUID } from './store';
import { Budget, BudgetPerformanceItem } from '../types';
import { isDateInFinancialMonth, formatYMD } from '../utils/financialDate';

export const BudgetService = {
  async getBudgetsForMonth(mese: string): Promise<Budget[]> {
    return (DB.BUDGET || []).filter(b => b.mese === mese && !(b as any).is_deleted);
  },

  async setBudget(mese: string, sottocategoria_id: string, importo: number, note?: string): Promise<Budget> {
    if (!DB.BUDGET) DB.BUDGET = [];
    const roundedImporto = Math.round(importo * 100) / 100;
    const existingIndex = DB.BUDGET.findIndex(b => b.mese === mese && b.sottocategoria_id === sottocategoria_id);

    if (existingIndex >= 0) {
      DB.BUDGET[existingIndex].importo_budget = roundedImporto;
      if (note !== undefined) DB.BUDGET[existingIndex].note = note;
      persistDB();
      return DB.BUDGET[existingIndex];
    } else {
      const newBudget: Budget = {
        id: generateUUID(),
        budget_id: generateHumanID('BUD', 'BUDGET'),
        mese,
        sottocategoria_id,
        importo_budget: roundedImporto,
        note: note || ''
      };
      DB.BUDGET.push(newBudget);
      persistDB();
      return newBudget;
    }
  },

  async deleteBudget(id: string): Promise<boolean> {
    if (!DB.BUDGET) return false;
    const idx = DB.BUDGET.findIndex(b => b.id === id || b.budget_id === id);
    if (idx >= 0) {
      DB.BUDGET.splice(idx, 1);
      persistDB();
      return true;
    }
    return false;
  },

  // Clona i budget del mese precedente nel nuovo mese
  async cloneMonth(fromMonth: string, toMonth: string): Promise<{ clonedCount: number }> {
    if (!DB.BUDGET) DB.BUDGET = [];
    const sourceBudgets = DB.BUDGET.filter(b => b.mese === fromMonth && !(b as any).is_deleted && b.importo_budget > 0);
    let clonedCount = 0;

    for (const sb of sourceBudgets) {
      const alreadyExists = DB.BUDGET.some(b => b.mese === toMonth && b.sottocategoria_id === sb.sottocategoria_id);
      if (!alreadyExists) {
        DB.BUDGET.push({
          id: generateUUID(),
          budget_id: generateHumanID('BUD', 'BUDGET'),
          mese: toMonth,
          sottocategoria_id: sb.sottocategoria_id,
          importo_budget: sb.importo_budget,
          note: `Clonato da ${fromMonth}`
        });
        clonedCount++;
      }
    }

    if (clonedCount > 0) {
      persistDB();
    }
    return { clonedCount };
  },

  // Analisi completa performance del Budget
  async getDetailedPerformance(mese: string): Promise<{
    items: BudgetPerformanceItem[];
    totaleBudget: number;
    totaleReale: number;
    totalePianificato: number;
    totalePrevisione: number;
    totaleDifferenza: number;
    totaleBudgetEntrate: number;
    totaleRealeEntrate: number;
    totalePianificatoEntrate: number;
    totalePrevisioneEntrate: number;
    totaleDifferenzaEntrate: number;
  }> {
    const budgets = await this.getBudgetsForMonth(mese);
    const subcategories = (DB.SOTTOCATEGORIE || []).filter(s => s.tipo !== 'GIROCONTO');

    const today = new Date();
    const todayStr = formatYMD(today);

    // Filtra movimenti reali del mese finanziario (solo non cancellati e NO GIROCONTI)
    const movimentiMese = (DB.MOVIMENTI || []).filter(m => {
      if ((m as any).is_deleted) return false;
      if (m.tipologia === 'GIROCONTO') return false;
      return m.data && isDateInFinancialMonth(m.data, mese);
    });

    // Separazione rigorosa tra transazioni già eseguite (data <= oggi) e movimenti con data futura nel mese (ancora da fare/addebitare)
    const movimentiEffettivi = movimentiMese.filter(m => m.data <= todayStr);
    const movimentiFuturi = movimentiMese.filter(m => m.data > todayStr);

    // Filtra pianificati del mese finanziario (solo PENDENTI, non cancellati e NO GIROCONTI)
    const pianificatiMese = (DB.PIANIFICATI || []).filter(p => {
      if (p.stato !== 'PENDENTE') return false;
      if ((p as any).is_deleted) return false;
      if (p.tipologia === 'GIROCONTO') return false;
      return p.data_prevista && isDateInFinancialMonth(p.data_prevista, mese);
    });

    // Filtra scadenze attive (DA_PAGARE) che cadono nel mese finanziario e non sono già collegate a movimenti/pianificati
    const scadenzeMese = (DB.SCADENZE || []).filter(s => {
      if (s.stato !== 'DA_PAGARE') return false;
      if ((s as any).is_deleted) return false;
      if (s.movimento_id) return false;
      if (pianificatiMese.some(p => p.id === s.movimento_id)) return false;
      return s.data_scadenza && isDateInFinancialMonth(s.data_scadenza, mese);
    });

    // Mappa tutte le sottocategorie rilevanti: con budget O con movimenti reali O con pianificati O con scadenze
    const relevantSubIds = new Set<string>();
    budgets.forEach(b => relevantSubIds.add(b.sottocategoria_id));
    movimentiMese.forEach(m => relevantSubIds.add(m.sottocategoria_id));
    pianificatiMese.forEach(p => relevantSubIds.add(p.sottocategoria_id));
    scadenzeMese.forEach(s => relevantSubIds.add(s.sottocategoria_id));

    const items: BudgetPerformanceItem[] = [];

    for (const subId of relevantSubIds) {
      const sub = subcategories.find(s => s.id === subId);
      if (!sub) continue; // Esclude categorie non trovate o di tipo GIROCONTO

      const budgetEntry = budgets.find(b => b.sottocategoria_id === subId);
      const budgetAmount = budgetEntry ? budgetEntry.importo_budget : 0;

      let realeAmount = 0;
      let movimentiFuturiAmount = 0;
      let pianificatiPendentiAmount = 0;
      let pianificatoAmount = 0;

      if (sub.tipo === 'USCITA') {
        // Per le uscite: solo transazioni con data <= oggi costituiscono lo Speso Reale Finora
        const rawReale = movimentiEffettivi
          .filter(m => m.sottocategoria_id === subId)
          .reduce((sum, m) => sum + (m.tipologia === 'USCITA' ? m.importo : -m.importo), 0);
        realeAmount = Math.max(0, Math.round(rawReale * 100) / 100);

        // Movimenti registrati con data futura nel mese (es. rata mutuo al 30 del mese): in programma da spendere
        const rawFuturi = movimentiFuturi
          .filter(m => m.sottocategoria_id === subId)
          .reduce((sum, m) => sum + (m.tipologia === 'USCITA' ? m.importo : -m.importo), 0);
        movimentiFuturiAmount = Math.max(0, Math.round(rawFuturi * 100) / 100);

        // Voci pianificate pendenti + scadenze da pagare
        const rawPianificati = pianificatiMese
          .filter(p => p.sottocategoria_id === subId && p.tipologia === 'USCITA')
          .reduce((sum, p) => sum + p.importo, 0);
        const rawScadenze = scadenzeMese
          .filter(s => s.sottocategoria_id === subId)
          .reduce((sum, s) => sum + s.importo_previsto, 0);
        pianificatiPendentiAmount = Math.max(0, Math.round((rawPianificati + rawScadenze) * 100) / 100);

        // Totale in programma da spendere entro fine mese
        pianificatoAmount = Math.round((movimentiFuturiAmount + pianificatiPendentiAmount) * 100) / 100;
      } else if (sub.tipo === 'ENTRATA') {
        // Per le entrate: solo transazioni con data <= oggi costituiscono l'Incassato Reale Finora
        const rawReale = movimentiEffettivi
          .filter(m => m.sottocategoria_id === subId)
          .reduce((sum, m) => sum + (m.tipologia === 'ENTRATA' ? m.importo : -m.importo), 0);
        realeAmount = Math.max(0, Math.round(rawReale * 100) / 100);

        const rawFuturi = movimentiFuturi
          .filter(m => m.sottocategoria_id === subId)
          .reduce((sum, m) => sum + (m.tipologia === 'ENTRATA' ? m.importo : -m.importo), 0);
        movimentiFuturiAmount = Math.max(0, Math.round(rawFuturi * 100) / 100);

        const rawPianificati = pianificatiMese
          .filter(p => p.sottocategoria_id === subId && p.tipologia === 'ENTRATA')
          .reduce((sum, p) => sum + p.importo, 0);
        pianificatiPendentiAmount = Math.max(0, Math.round(rawPianificati * 100) / 100);

        pianificatoAmount = Math.round((movimentiFuturiAmount + pianificatiPendentiAmount) * 100) / 100;
      }

      const previsione = Math.round((realeAmount + pianificatoAmount) * 100) / 100;
      
      // Calcolo scostamento e percentuali coerenti
      let diff = 0;
      let isOver = false;
      let percentage = 0;

      if (sub.tipo === 'USCITA') {
        // Per le spese: Differenza = Budget - Previsione (positivo = sotto budget / risparmio, negativo = sforato)
        diff = Math.round((budgetAmount - previsione) * 100) / 100;
        // Sforato SOLO se la previsione eccede strettamente il budget (es. 814,15 € <= 815,00 € NON è sforato)
        isOver = budgetAmount > 0 && previsione > budgetAmount;
        percentage = budgetAmount > 0 ? Math.round((previsione / budgetAmount) * 100) : (previsione > 0 ? 100 : 0);
      } else {
        // Per le entrate: Differenza = Previsione - Budget (positivo = obiettivo raggiunto/superato, negativo = ancora da incassare)
        diff = Math.round((previsione - budgetAmount) * 100) / 100;
        isOver = false; // Nelle entrate superare l'obiettivo è un successo, mai un errore
        percentage = budgetAmount > 0 ? Math.round((previsione / budgetAmount) * 100) : (previsione > 0 ? 100 : 0);
      }

      items.push({
        budget_id: budgetEntry?.id,
        sottocategoria_id: sub.id,
        sottocategoria_nome: sub.nome,
        categoria_padre: sub.categoria_padre,
        icon_name: sub.icon_name,
        colore: sub.colore,
        tipo: sub.tipo,
        budget: budgetAmount,
        reale: realeAmount,
        pianificato: pianificatoAmount,
        movimenti_futuri: movimentiFuturiAmount,
        pianificati_pendenti: pianificatiPendentiAmount,
        previsione,
        differenza: diff,
        stato: isOver ? 'IN_ECCESSO' : 'OK',
        percentuale: percentage
      });
    }

    // Ordina prima per categoria padre e poi per nome sottocategoria
    items.sort((a, b) => a.categoria_padre.localeCompare(b.categoria_padre) || a.sottocategoria_nome.localeCompare(b.sottocategoria_nome));

    // Totali USCITE (Spese)
    const usciteItems = items.filter(i => i.tipo === 'USCITA');
    const totaleBudget = Math.round(usciteItems.reduce((acc, i) => acc + i.budget, 0) * 100) / 100;
    const totaleReale = Math.round(usciteItems.reduce((acc, i) => acc + i.reale, 0) * 100) / 100;
    const totalePianificato = Math.round(usciteItems.reduce((acc, i) => acc + i.pianificato, 0) * 100) / 100;
    const totalePrevisione = Math.round(usciteItems.reduce((acc, i) => acc + i.previsione, 0) * 100) / 100;
    const totaleDifferenza = Math.round((totaleBudget - totalePrevisione) * 100) / 100;

    // Totali ENTRATE (Obiettivi di incasso)
    const entrateItems = items.filter(i => i.tipo === 'ENTRATA');
    const totaleBudgetEntrate = Math.round(entrateItems.reduce((acc, i) => acc + i.budget, 0) * 100) / 100;
    const totaleRealeEntrate = Math.round(entrateItems.reduce((acc, i) => acc + i.reale, 0) * 100) / 100;
    const totalePianificatoEntrate = Math.round(entrateItems.reduce((acc, i) => acc + i.pianificato, 0) * 100) / 100;
    const totalePrevisioneEntrate = Math.round(entrateItems.reduce((acc, i) => acc + i.previsione, 0) * 100) / 100;
    const totaleDifferenzaEntrate = Math.round((totalePrevisioneEntrate - totaleBudgetEntrate) * 100) / 100;

    return {
      items,
      totaleBudget,
      totaleReale,
      totalePianificato,
      totalePrevisione,
      totaleDifferenza,
      totaleBudgetEntrate,
      totaleRealeEntrate,
      totalePianificatoEntrate,
      totalePrevisioneEntrate,
      totaleDifferenzaEntrate
    };
  }
};
