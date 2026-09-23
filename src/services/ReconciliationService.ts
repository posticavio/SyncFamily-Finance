import { DB, persistDB, generateHumanID, generateUUID } from './store';
import { Movement, Planned, Subcategory, MovementType } from '../types';
import { ParsedStatementRow } from '../utils/statementParser';
import { MovementService } from './MovementService';
import { PlannedService } from './PlannedService';

export type ReconciliationMatchStatus =
  | 'MATCHED_EXACT' // Stesso importo, stessa data esatta
  | 'MATCHED_DATE_DIFF' // Stesso importo, data differisce entro la tolleranza (es. ±2 giorni)
  | 'MATCHED_PLANNED' // Manca tra i movimenti, ma corrisponde a un pianificato pendente
  | 'MISSING_IN_APP'; // Presente nell'estratto conto ma NON registrata nell'app (MANCANTE)

export interface ReconciliationItem {
  id: string; // ID riga estratto
  statementRow: ParsedStatementRow;
  matchStatus: ReconciliationMatchStatus;
  matchedMovement?: Movement;
  matchedPlanned?: Planned;
  dateDiffDays?: number; // Giorni di scostamento (data estratto - data registrata)
  suggestedSubcategoryId: string;
  selectedSubcategoryId: string;
  selectedForImport: boolean;
  isRegistered?: boolean;
}

export interface StatementReconciliationReport {
  accountId: string;
  accountName: string;
  dateToleranceDays: number;
  statementStartDate: string;
  statementEndDate: string;
  totalStatementCount: number;
  totalStatementInflow: number;
  totalStatementOutflow: number;
  netStatementAmount: number;

  // Categorie analizzate
  items: ReconciliationItem[];
  missingItems: ReconciliationItem[]; // QUELLE CHE MANCANO NEL PROGRAMMA
  matchedItems: ReconciliationItem[]; // Già riconciliate
  matchedPlannedItems: ReconciliationItem[]; // Corrispondenti a pianificati da confermare
  onlyInAppMovements: Movement[]; // Solo nel programma nel periodo considerato

  // Statistiche conteggi
  missingCount: number;
  missingTotalAmount: number;
  matchedCount: number;
  matchedTotalAmount: number;

  // Movimenti in attesa di contabilizzazione bancaria (considerati comunque già contabilizzati con addebito certo)
  unbookedCount: number;
  unbookedTotalAmount: number;
}

/**
 * Calcola i giorni di differenza tra due date ISO (date1 - date2)
 */
function getDaysDifference(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffTime = d1.getTime() - d2.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calcola una somiglianza testuale basica tra due descrizioni
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  const words1 = text1.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  const words2 = text2.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  if (words1.length === 0 || words2.length === 0) return 0;

  let common = 0;
  for (const w of words1) {
    if (words2.includes(w)) common++;
  }
  return common;
}

export const ReconciliationService = {
  /**
   * Suggerisce intelligentemente la sottocategoria in base alla descrizione del movimento:
   * 1. Cerca prima nei movimenti storici registrati dall'utente se esiste una descrizione simile
   * 2. Usa un dizionario semantico bancario per le causali più frequenti
   * 3. Fallback sulla prima sottocategoria disponibile del tipo corrispondente
   */
  suggestSubcategory(
    description: string,
    type: MovementType,
    subcategories: Subcategory[]
  ): string {
    const descLower = description.toLowerCase();
    const activeSubcategories = subcategories.filter(s => s.attiva && (s.tipo === type || type === 'GIROCONTO'));

    if (activeSubcategories.length === 0) {
      return subcategories[0]?.id || '';
    }

    // 1. Cerca somiglianze nei movimenti storici dell'utente
    const historicalMovements = DB.MOVIMENTI.filter(m => m.tipologia === type);
    for (const hist of historicalMovements) {
      const histDesc = hist.descrizione.toLowerCase();
      const sim = calculateTextSimilarity(descLower, histDesc);
      if (sim >= 1 && activeSubcategories.some(s => s.id === hist.sottocategoria_id)) {
        return hist.sottocategoria_id;
      }
    }

    // 2. Mappatura semantica parole chiave
    const keywordRules: { keywords: string[]; categoryNames: string[] }[] = [
      // Spesa e alimentari
      {
        keywords: ['conad', 'coop', 'esselunga', 'lidl', 'eurospin', 'carrefour', 'pam', 'aldi', 'supermercato', 'despar', 'alimentare', 'md discount', 'tigros', 'basko', 'crai', 'iper', 'penny market'],
        categoryNames: ['Spesa', 'Supermercato', 'Alimentari', 'Spesa Alimentare', 'Cibo']
      },
      // Utenze e bollette
      {
        keywords: ['enel', 'plenitude', 'eni plenitude', 'a2a', 'hera', 'edison', 'acea', 'iren', 'luce', 'gas', 'servizio elettrico', 'acquedotto', 'bolletta'],
        categoryNames: ['Bollette', 'Utenze', 'Energia', 'Luce & Gas', 'Casa']
      },
      // Telefonia e internet
      {
        keywords: ['telecom', 'tim', 'vodafone', 'wind', 'windtre', 'iliad', 'fastweb', 'ho mobile', 'kena', 'very mobile', 'internet'],
        categoryNames: ['Telefonia', 'Internet', 'Cellulare', 'Utenze']
      },
      // Trasporti, carburante, pedaggi
      {
        keywords: ['benzina', 'carburante', 'diesel', 'q8', 'eni station', 'ip', 'esso', 'tamoil', 'autostrade', 'telepass', 'pedaggio', 'trenitalia', 'italo', 'atm', 'atac', 'gtt', 'parcheggio'],
        categoryNames: ['Carburante', 'Trasporti', 'Auto', 'Benzina', 'Pedaggi']
      },
      // Ristoranti e uscite
      {
        keywords: ['bar', 'cafe', 'caffè', 'ristorante', 'pizzeria', 'trattoria', 'osterie', 'mcdonald', 'burger king', 'deliveroo', 'just eat', 'glovo', 'ubereats', 'pub', 'gelateria'],
        categoryNames: ['Ristoranti', 'Uscite & Ristoranti', 'Bar', 'Cene Fuori', 'Svago']
      },
      // Salute e farmacia
      {
        keywords: ['farmacia', 'parafarmacia', 'medico', 'dentista', 'visita', 'analisi', 'ospedale', 'synlab', 'ticket sanitario'],
        categoryNames: ['Salute', 'Farmacia & Salute', 'Spese Mediche', 'Medicine']
      },
      // Casa e manutenzione
      {
        keywords: ['ikea', 'leroy merlin', 'brico', 'obi', 'affitto', 'condominio', 'locazione', 'tecnocasa', 'ferramenta', 'casa'],
        categoryNames: ['Casa', 'Affitto', 'Condominio', 'Manutenzione Casa', 'Arredamento']
      },
      // Shopping e abbigliamento
      {
        keywords: ['amazon', 'zalando', 'zara', 'h&m', 'decathlon', 'mediaworld', 'unieuro', 'apple', 'aliexpress', 'ebay', 'primark'],
        categoryNames: ['Shopping', 'Acquisti', 'Abbigliamento', 'Elettronica']
      },
      // Assicurazioni e veicoli
      {
        keywords: ['assicurazione', 'unipolsai', 'allianz', 'generali', 'prima assicurazioni', 'linea diretta', 'bollo auto', 'revisione'],
        categoryNames: ['Assicurazione', 'Bollo Auto', 'Auto & Moto', 'Veicoli']
      },
      // Entrate: stipendio, pensione, bonifici
      {
        keywords: ['stipendio', 'emolumenti', 'salario', 'busta paga', 'pensione', 'inps', 'bonifico a vostro favore', 'compenso', 'rimborso'],
        categoryNames: ['Stipendio', 'Lavoro', 'Entrate da Lavoro', 'Pensione', 'Rimborsi']
      },
      // Trasferimenti interni e giroconti tra propri conti
      {
        keywords: ['giroconto', 'trasferimento', 'giroconti', 'bonifico a proprio favore', 'to viorel', 'from viorel', 'postica', 'pocket', 'ricarica carta', 'ricarica conto'],
        categoryNames: ['Giroconto', 'Giroconto / Trasferimento', 'Trasferimenti']
      }
    ];

    for (const rule of keywordRules) {
      if (rule.keywords.some(kw => descLower.includes(kw))) {
        // Cerca una sottocategoria che corrisponda al nome
        const matchedSub = activeSubcategories.find(s => 
          rule.categoryNames.some(cn => s.nome.toLowerCase().includes(cn.toLowerCase()) || s.categoria_padre.toLowerCase().includes(cn.toLowerCase()))
        );
        if (matchedSub) {
          return matchedSub.id;
        }
      }
    }

    // Default: prima sottocategoria attiva per il tipo
    return activeSubcategories[0]?.id || subcategories[0]?.id || '';
  },

  /**
   * Esegue l'analisi completa dell'estratto conto confrontandolo con le transazioni registrate
   * Regole chiave stabilite dall'utente:
   * - Gli importi sono UGUALI tra estratto conto e transazioni registrate (Math.abs(diff) < 0.01)
   * - La data POTREBBE VARIARE (tolleranza regolabile in giorni, es. ±3 gg, ±7 gg, ±15 gg, ecc.)
   * - Evidenzia in modo prioritario QUELLE CHE MANCANO (mancanti nell'app)
   */
  analyzeStatement(params: {
    accountId: string;
    statementRows: ParsedStatementRow[];
    dateToleranceDays?: number;
    subcategories: Subcategory[];
  }): StatementReconciliationReport {
    const { accountId, statementRows, subcategories } = params;
    const dateToleranceDays = params.dateToleranceDays !== undefined ? params.dateToleranceDays : 7;

    // Recupera i dati del conto
    const account = DB.CONTI.find(c => c.id === accountId || c.conto_id === accountId);
    const fund = DB.FONDI.find(f => f.id === accountId || f.fondo_id === accountId);
    const accountName = account?.nome_conto || fund?.nome_fondo || 'Conto selezionato';

    // Recupera tutte le transazioni registrate nell'app per questo conto
    const registeredMovements = DB.MOVIMENTI.filter(m => 
      m.conto_origine === accountId || m.conto_destinazione === accountId
    );

    // Recupera i movimenti pianificati pendenti per questo conto
    const pendingPlanned = DB.PIANIFICATI.filter(p => 
      (p.conto_id === accountId) && p.stato === 'PENDENTE'
    );

    // Ordina righe estratto per data
    const sortedRows = [...statementRows].sort((a, b) => a.date.localeCompare(b.date));
    const statementStartDate = sortedRows[0]?.date || '';
    const statementEndDate = sortedRows[sortedRows.length - 1]?.date || '';

    // Traccia i movimenti già associati per garantire corrispondenza 1-a-1 rigorosa
    // (evita che lo stesso movimento registrato venga abbinato a due righe identiche dell'estratto)
    const matchedMovementIds = new Set<string>();
    const matchedPlannedIds = new Set<string>();

    const items: ReconciliationItem[] = [];

    // FASE 1: Ricerca abbinamenti esatti e con tolleranza data
    for (const row of sortedRows) {
      const suggestedSubId = this.suggestSubcategory(row.description, row.type, subcategories);

      // Cerca tra i movimenti registrati candidati non ancora abbinati:
      // 1. Importo identico
      // 2. Tipologia compatibile con il conto
      // 3. Data entro la tolleranza
      const candidates: {
        movement: Movement;
        dateDiff: number;
        score: number;
      }[] = [];

      for (const mov of registeredMovements) {
        if (matchedMovementIds.has(mov.id)) continue;

        // Verifica importo esatto (uguale al centesimo)
        const isAmountEqual = Math.abs(mov.importo - row.amount) < 0.009;
        if (!isAmountEqual) continue;

        // Verifica congruenza tipo movimento
        let isTypeCompatible = false;
        if (row.type === 'USCITA') {
          if (mov.conto_origine === accountId && (mov.tipologia === 'USCITA' || mov.tipologia === 'GIROCONTO')) {
            isTypeCompatible = true;
          }
        } else if (row.type === 'ENTRATA') {
          if (mov.conto_origine === accountId && mov.tipologia === 'ENTRATA') {
            isTypeCompatible = true;
          } else if (mov.conto_destinazione === accountId && mov.tipologia === 'GIROCONTO') {
            isTypeCompatible = true;
          }
        }

        if (!isTypeCompatible) continue;

        // Calcola scostamento data in giorni (data estratto - data app)
        const diffDays = getDaysDifference(row.date, mov.data);
        const absDiffDays = Math.abs(diffDays);

        // Per movimenti non contabilizzati dalla banca, la data effettiva può differire di qualche giorno ma l'addebito è certo
        const effectiveTolerance = row.isNonContabilizzato ? Math.max(dateToleranceDays, 14) : dateToleranceDays;

        if (absDiffDays <= effectiveTolerance) {
          // Punteggio di qualità del match:
          // Data identica = 100 pt
          // Minore scostamento giorni = punteggio più alto
          // Bonus per parole simili nella descrizione
          const textSim = calculateTextSimilarity(row.description, mov.descrizione);
          const score = 100 - (absDiffDays * 3) + (textSim * 5);

          candidates.push({
            movement: mov,
            dateDiff: diffDays,
            score
          });
        }
      }

      // Seleziona il miglior candidato
      if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[0];

        matchedMovementIds.add(best.movement.id);

        items.push({
          id: row.id,
          statementRow: row,
          matchStatus: best.dateDiff === 0 ? 'MATCHED_EXACT' : 'MATCHED_DATE_DIFF',
          matchedMovement: best.movement,
          dateDiffDays: best.dateDiff,
          suggestedSubcategoryId: best.movement.sottocategoria_id || suggestedSubId,
          selectedSubcategoryId: best.movement.sottocategoria_id || suggestedSubId,
          selectedForImport: false
        });
        continue;
      }

      // FASE 1.5: Fallback match per importo identico e tipo compatibile (finestra estesa a 45 giorni)
      const relaxedCandidates: {
        movement: Movement;
        dateDiff: number;
      }[] = [];

      for (const mov of registeredMovements) {
        if (matchedMovementIds.has(mov.id)) continue;

        const isAmountEqual = Math.abs(mov.importo - row.amount) < 0.009;
        if (!isAmountEqual) continue;

        let isTypeCompatible = false;
        if (row.type === 'USCITA') {
          if (mov.conto_origine === accountId && (mov.tipologia === 'USCITA' || mov.tipologia === 'GIROCONTO')) {
            isTypeCompatible = true;
          }
        } else if (row.type === 'ENTRATA') {
          if (mov.conto_origine === accountId && mov.tipologia === 'ENTRATA') {
            isTypeCompatible = true;
          } else if (mov.conto_destinazione === accountId && mov.tipologia === 'GIROCONTO') {
            isTypeCompatible = true;
          }
        }

        if (!isTypeCompatible) continue;

        const diffDays = getDaysDifference(row.date, mov.data);
        if (Math.abs(diffDays) <= 45) {
          relaxedCandidates.push({ movement: mov, dateDiff: diffDays });
        }
      }

      if (relaxedCandidates.length > 0) {
        relaxedCandidates.sort((a, b) => Math.abs(a.dateDiff) - Math.abs(b.dateDiff));
        const bestRelaxed = relaxedCandidates[0];
        matchedMovementIds.add(bestRelaxed.movement.id);

        items.push({
          id: row.id,
          statementRow: row,
          matchStatus: 'MATCHED_DATE_DIFF',
          matchedMovement: bestRelaxed.movement,
          dateDiffDays: bestRelaxed.dateDiff,
          suggestedSubcategoryId: bestRelaxed.movement.sottocategoria_id || suggestedSubId,
          selectedSubcategoryId: bestRelaxed.movement.sottocategoria_id || suggestedSubId,
          selectedForImport: false
        });
        continue;
      }

      // FASE 2: Se non abbinato a un movimento registrato, verifica se corrisponde a un pianificato pendente
      const plannedCandidates: {
        planned: Planned;
        dateDiff: number;
      }[] = [];

      for (const pl of pendingPlanned) {
        if (matchedPlannedIds.has(pl.id)) continue;

        const isAmountEqual = Math.abs(pl.importo - row.amount) < 0.009;
        const isTypeEqual = pl.tipologia === row.type;

        if (isAmountEqual && isTypeEqual) {
          const diffDays = getDaysDifference(row.date, pl.data_prevista);
          if (Math.abs(diffDays) <= dateToleranceDays + 7) {
            plannedCandidates.push({ planned: pl, dateDiff: diffDays });
          }
        }
      }

      if (plannedCandidates.length > 0) {
        plannedCandidates.sort((a, b) => Math.abs(a.dateDiff) - Math.abs(b.dateDiff));
        const bestPlanned = plannedCandidates[0];
        matchedPlannedIds.add(bestPlanned.planned.id);

        items.push({
          id: row.id,
          statementRow: row,
          matchStatus: 'MATCHED_PLANNED',
          matchedPlanned: bestPlanned.planned,
          dateDiffDays: bestPlanned.dateDiff,
          suggestedSubcategoryId: bestPlanned.planned.sottocategoria_id || suggestedSubId,
          selectedSubcategoryId: bestPlanned.planned.sottocategoria_id || suggestedSubId,
          selectedForImport: true // Pre-selezionato per confermare/registrare
        });
        continue;
      }

      // FASE 3: Transazione MANCANTE NELL'APP (Presente nell'estratto conto ma NON trovata nel programma)
      items.push({
        id: row.id,
        statementRow: row,
        matchStatus: 'MISSING_IN_APP',
        suggestedSubcategoryId: suggestedSubId,
        selectedSubcategoryId: suggestedSubId,
        selectedForImport: true // Pre-selezionato di default per permettere all'utente di registrarla subito!
      });
    }

    // FASE 4: Identifica i movimenti presenti solo nell'app nel periodo dell'estratto conto
    // (con margine di sicurezza esteso alla tolleranza)
    const onlyInAppMovements: Movement[] = [];
    if (statementStartDate && statementEndDate) {
      const minDate = new Date(statementStartDate);
      minDate.setDate(minDate.getDate() - dateToleranceDays);
      const minDateStr = minDate.toISOString().split('T')[0];

      const maxDate = new Date(statementEndDate);
      maxDate.setDate(maxDate.getDate() + dateToleranceDays);
      const maxDateStr = maxDate.toISOString().split('T')[0];

      for (const mov of registeredMovements) {
        if (!matchedMovementIds.has(mov.id)) {
          if (mov.data >= minDateStr && mov.data <= maxDateStr) {
            onlyInAppMovements.push(mov);
          }
        }
      }
    }

    // Suddividi gli item per categoria
    const missingItems = items.filter(i => i.matchStatus === 'MISSING_IN_APP');
    const matchedItems = items.filter(i => i.matchStatus === 'MATCHED_EXACT' || i.matchStatus === 'MATCHED_DATE_DIFF');
    const matchedPlannedItems = items.filter(i => i.matchStatus === 'MATCHED_PLANNED');

    let totalStatementInflow = 0;
    let totalStatementOutflow = 0;
    let missingTotalAmount = 0;
    let matchedTotalAmount = 0;
    let unbookedCount = 0;
    let unbookedTotalAmount = 0;

    for (const item of items) {
      const amt = item.statementRow.amount;
      if (item.statementRow.type === 'ENTRATA') {
        totalStatementInflow += amt;
      } else {
        totalStatementOutflow += amt;
      }

      if (item.statementRow.isNonContabilizzato) {
        unbookedCount++;
        unbookedTotalAmount += amt;
      }

      if (item.matchStatus === 'MISSING_IN_APP') {
        missingTotalAmount += amt;
      } else if (item.matchStatus === 'MATCHED_EXACT' || item.matchStatus === 'MATCHED_DATE_DIFF') {
        matchedTotalAmount += amt;
      }
    }

    const netStatementAmount = Math.round((totalStatementInflow - totalStatementOutflow) * 100) / 100;

    return {
      accountId,
      accountName,
      dateToleranceDays,
      statementStartDate,
      statementEndDate,
      totalStatementCount: items.length,
      totalStatementInflow: Math.round(totalStatementInflow * 100) / 100,
      totalStatementOutflow: Math.round(totalStatementOutflow * 100) / 100,
      netStatementAmount,
      items,
      missingItems,
      matchedItems,
      matchedPlannedItems,
      onlyInAppMovements,
      missingCount: missingItems.length,
      missingTotalAmount: Math.round(missingTotalAmount * 100) / 100,
      matchedCount: matchedItems.length,
      matchedTotalAmount: Math.round(matchedTotalAmount * 100) / 100,
      unbookedCount,
      unbookedTotalAmount: Math.round(unbookedTotalAmount * 100) / 100
    };
  },

  /**
   * Registra le transazioni mancanti selezionate nel database come veri movimenti,
   * collegandoli al conto specificato e aggiornando se necessario i movimenti pianificati.
   */
  async registerMissingTransactions(payload: {
    accountId: string;
    itemsToRegister: {
      date: string;
      description: string;
      amount: number;
      type: MovementType;
      subcategoryId: string;
      originAccountId?: string | null;
      destinationAccountId?: string | null;
      matchedPlannedId?: string;
      isNonContabilizzato?: boolean;
      note?: string;
    }[];
    onProgress?: (info: {
      current: number;
      total: number;
      percentage: number;
      createdCount: number;
      confirmedPlannedCount: number;
    }) => void;
  }): Promise<{ createdCount: number; confirmedPlannedCount: number }> {
    const { accountId, itemsToRegister, onProgress } = payload;
    let createdCount = 0;
    let confirmedPlannedCount = 0;
    const total = itemsToRegister.length;

    for (let i = 0; i < total; i++) {
      const item = itemsToRegister[i];
      const sub = (DB.SOTTOCATEGORIE || []).find(s => s.id === item.subcategoryId);
      const isGiroconto = sub?.tipo === 'GIROCONTO' || sub?.categoria_padre?.toLowerCase().includes('trasferimenti') || item.type === 'GIROCONTO';
      const effectiveType: MovementType = isGiroconto ? 'GIROCONTO' : item.type;
      const itemOriginAcc = item.originAccountId || accountId;
      const contoDest = isGiroconto ? (item.destinationAccountId || null) : null;

      if (item.matchedPlannedId) {
        // Se corrispondeva a un pianificato, esegui il pianificato (che genera il movimento e aggiorna lo stato a ESEGUITO)
        try {
          await PlannedService.execute(item.matchedPlannedId, item.date, item.amount);
          createdCount++;
          confirmedPlannedCount++;
        } catch (e) {
          console.warn(`Impossibile contrassegnare pianificato ${item.matchedPlannedId} come eseguito, creo movimento standard:`, e);
          await MovementService.create({
            data: item.date,
            descrizione: item.description,
            importo: item.amount,
            tipologia: effectiveType,
            conto_origine: itemOriginAcc,
            conto_destinazione: contoDest,
            sottocategoria_id: item.subcategoryId,
            origine_dati: 'IMPORTAZIONE',
            non_contabilizzato: item.isNonContabilizzato,
            note: item.note || (item.isNonContabilizzato 
              ? 'Considerato già contabilizzato da estratto bancario (addebito certo, data provvisoria)' 
              : 'Registrato da Riconciliazione Estratto Conto')
          });
          createdCount++;
        }
      } else {
        // Crea nuovo movimento
        await MovementService.create({
          data: item.date,
          descrizione: item.description,
          importo: item.amount,
          tipologia: effectiveType,
          conto_origine: itemOriginAcc,
          conto_destinazione: contoDest,
          sottocategoria_id: item.subcategoryId,
          origine_dati: 'IMPORTAZIONE',
          non_contabilizzato: item.isNonContabilizzato,
          note: item.note || (item.isNonContabilizzato 
            ? 'Considerato già contabilizzato da estratto bancario (addebito certo, data provvisoria)' 
            : 'Registrato da Riconciliazione Estratto Conto')
        });
        createdCount++;
      }

      // Notifica avanzamento in tempo reale
      if (onProgress) {
        const current = i + 1;
        const percentage = Math.round((current / total) * 100);
        onProgress({
          current,
          total,
          percentage,
          createdCount,
          confirmedPlannedCount
        });
      }

      // Cede il controllo al thread UI ogni 5 operazioni per mantenere l'interfaccia reattiva e animare la barra
      if (i % 5 === 0 || i === total - 1) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return { createdCount, confirmedPlannedCount };
  }
};
