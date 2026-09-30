import { DB, persistDB, generateHumanID, generateUUID } from './store';
import { Account, Fund, AccountForecast, DailyForecastPoint, Movement } from '../types';
import { formatCurrency } from '../utils/formatters';
import { getFinancialPeriodInfo, getCurrentFinancialMonth } from '../utils/financialDate';

const formatYMD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const AccountService = {
  async getAllAccounts(): Promise<Account[]> {
    return [...DB.CONTI];
  },

  async getAllFunds(): Promise<Fund[]> {
    return [...(DB.FONDI || [])];
  },

  async getAccountById(id: string): Promise<Account | undefined> {
    return DB.CONTI.find(c => c.id === id);
  },

  async getFundById(id: string): Promise<Fund | undefined> {
    return (DB.FONDI || []).find(f => f.id === id);
  },

  // Calcola il saldo alla data odierna basandosi sulle transazioni effettive (Punto 15)
  // SALDO = INIZIALE + ENTRATE - USCITE + GIROCONTI RICEVUTI - GIROCONTI INVIATI
  // Supporta opzione per includere anche i movimenti programmati/pianificati pendenti
  calculateBalanceAtDate(
    entityId: string, 
    limitDate?: Date, 
    options?: { 
      includePlanned?: boolean; 
      includeFutureMovements?: boolean; 
    }
  ): number {
    const isAccount = DB.CONTI.some(c => c.id === entityId || c.conto_id === entityId);
    const entity = isAccount 
      ? DB.CONTI.find(c => c.id === entityId || c.conto_id === entityId)
      : (DB.FONDI || []).find(f => f.id === entityId || f.fondo_id === entityId);

    if (!entity) return 0;

    const limitDateStr = limitDate ? formatYMD(limitDate) : '9999-12-31';

    // Riconoscimento completo sia dell'ID tecnico (UUID) che dell'ID human (es. CON00001 / FND00001)
    const entityIds = new Set<string>([
      entityId,
      entity.id,
      (entity as any).conto_id,
      (entity as any).fondo_id
    ].filter(Boolean));

    // Movimenti confermati avvenuti fino alla data limite
    const movimenti = DB.MOVIMENTI.filter(m => {
      if ((m as any).is_deleted) return false;
      if (!options?.includeFutureMovements && m.data > limitDateStr) return false;
      return (m.conto_origine && entityIds.has(m.conto_origine)) || 
             (m.conto_destinazione && entityIds.has(m.conto_destinazione));
    });

    let balance = entity.saldo_iniziale;

    for (const m of movimenti) {
      if (m.tipologia === 'ENTRATA') {
        // Se è entrata ed è destinata o registrata su questa entità
        if ((m.conto_destinazione && entityIds.has(m.conto_destinazione)) || 
            (m.conto_origine && entityIds.has(m.conto_origine))) {
          balance += m.importo;
        }
      } else if (m.tipologia === 'USCITA') {
        if (m.conto_origine && entityIds.has(m.conto_origine)) {
          balance -= m.importo;
        }
      } else if (m.tipologia === 'GIROCONTO') {
        // Giroconto da origine a destinazione
        if (m.conto_destinazione && entityIds.has(m.conto_destinazione)) {
          balance += m.importo;
        }
        if (m.conto_origine && entityIds.has(m.conto_origine)) {
          balance -= m.importo;
        }
      }
    }

    // Integrazione movimenti pianificati/programmati se richiesto
    if (options?.includePlanned) {
      const plannedList = (DB.PIANIFICATI || []).filter(p => {
        if (p.stato !== 'PENDENTE') return false;
        if ((p as any).is_deleted) return false;
        if (p.data_prevista > limitDateStr) return false;
        return p.conto_id && entityIds.has(p.conto_id);
      });

      for (const p of plannedList) {
        if (p.tipologia === 'ENTRATA') {
          balance += p.importo;
        } else if (p.tipologia === 'USCITA') {
          balance -= p.importo;
        }
      }
    }

    return Math.round(balance * 100) / 100;
  },

  // Helper esplicito per calcolare il saldo proiettato comprensivo dei movimenti programmati
  calculateProjectedBalanceAtDate(entityId: string, limitDate?: Date): number {
    return this.calculateBalanceAtDate(entityId, limitDate, { includePlanned: true });
  },

  // Triplo calcolo saldo: Oggi, Fine Mese Finanziario, e al termine del Ciclo Successivo
  async getAccountForecast(entityId: string): Promise<AccountForecast> {
    const today = new Date();
    const todayStr = formatYMD(today);

    // Periodo finanziario corrente
    const currentFinKey = getCurrentFinancialMonth();
    const currentPeriod = getFinancialPeriodInfo(currentFinKey);

    // Periodo finanziario successivo
    const [curY, curM] = currentFinKey.split('-').map(Number);
    const nextY = curM === 12 ? curY + 1 : curY;
    const nextM = curM === 12 ? 1 : curM + 1;
    const nextFinKey = `${nextY}-${String(nextM).padStart(2, '0')}`;
    const nextPeriod = getFinancialPeriodInfo(nextFinKey);

    // Data fine mese finanziario corrente (es. 10/10 per Settembre se custom dal 9 al 10, o 30/09 se solare)
    const lastDayOfMonth = currentPeriod.endObj;
    const lastDayStr = currentPeriod.endDate;

    // Data chiusura ciclo successivo (es. 10/11 se custom, o 31/10 se solare)
    const ninthNextMonth = nextPeriod.endObj;
    const ninthNextMonthStr = nextPeriod.endDate;

    const isAccount = DB.CONTI.some(c => c.id === entityId || c.conto_id === entityId);
    const entity = isAccount 
      ? DB.CONTI.find(c => c.id === entityId || c.conto_id === entityId)!
      : (DB.FONDI || []).find(f => f.id === entityId || f.fondo_id === entityId)!;

    const entityIds = new Set<string>([
      entityId,
      entity.id,
      (entity as any).conto_id,
      (entity as any).fondo_id
    ].filter(Boolean));

    // 1. Saldo odierno contabile (tutte le transazioni effettive avvenute fino ad oggi)
    const saldoOggi = this.calculateBalanceAtDate(entityId, today);

    // 1b. Movimenti programmati/pianificati pendenti collegati a questo conto/fondo
    const plannedForAccount = (DB.PIANIFICATI || []).filter(p => {
      if (p.stato !== 'PENDENTE') return false;
      if ((p as any).is_deleted) return false;
      return p.conto_id && entityIds.has(p.conto_id);
    });

    let entrateProgrammate = 0;
    let usciteProgrammate = 0;
    for (const p of plannedForAccount) {
      if (p.tipologia === 'ENTRATA') entrateProgrammate += p.importo;
      else if (p.tipologia === 'USCITA') usciteProgrammate += p.importo;
    }
    entrateProgrammate = Math.round(entrateProgrammate * 100) / 100;
    usciteProgrammate = Math.round(usciteProgrammate * 100) / 100;
    const totaleProgrammati = Math.round((entrateProgrammate - usciteProgrammate) * 100) / 100;

    // Saldo del conto comprensivo dei movimenti programmati pendenti
    const saldoConProgrammati = Math.round((saldoOggi + totaleProgrammati) * 100) / 100;

    // 2. Saldo a Fine Mese:
    // Base saldo con tutti i movimenti registrati fino all'ultimo giorno del mese (inclusi quelli futuri/programmati)
    const baseMovimentiFineMese = this.calculateBalanceAtDate(entityId, lastDayOfMonth);

    // Più movimenti pianificati pendenti (in DB.PIANIFICATI) fino a fine mese
    const plannedUpToMonthEnd = (DB.PIANIFICATI || []).filter(p => {
      if (p.stato !== 'PENDENTE') return false;
      if ((p as any).is_deleted) return false;
      const matchesEntity = p.conto_id && entityIds.has(p.conto_id);
      if (!matchesEntity) return false;
      return p.data_prevista <= lastDayStr;
    });

    let sumPlannedMonthEnd = 0;
    for (const p of plannedUpToMonthEnd) {
      if (p.tipologia === 'ENTRATA') sumPlannedMonthEnd += p.importo;
      else if (p.tipologia === 'USCITA') sumPlannedMonthEnd -= p.importo;
    }

    // Più eventuali scadenze da pagare non ancora registrate
    const deadlinesUpToMonthEnd = (DB.SCADENZE || []).filter(s => {
      if (s.stato !== 'DA_PAGARE') return false;
      if ((s as any).is_deleted) return false;
      const matchesEntity = (s.conto_id && entityIds.has(s.conto_id)) || (!s.conto_id && isAccount && (entity as any).conto_principale);
      if (!matchesEntity) return false;
      const isAlreadyInPlanned = plannedUpToMonthEnd.some(p => p.id === s.movimento_id);
      const isAlreadyInMov = DB.MOVIMENTI.some(m => m.id === s.movimento_id || (m.data === s.data_scadenza && m.descrizione === s.descrizione));
      if (isAlreadyInPlanned || isAlreadyInMov) return false;
      return s.data_scadenza <= lastDayStr;
    });

    let sumDeadlinesMonthEnd = 0;
    for (const s of deadlinesUpToMonthEnd) {
      sumDeadlinesMonthEnd -= s.importo_previsto;
    }

    const saldoFineMese = Math.round((baseMovimentiFineMese + sumPlannedMonthEnd + sumDeadlinesMonthEnd) * 100) / 100;

    // 3. Saldo al 9 del Mese Successivo:
    // Base saldo con tutti i movimenti registrati fino al 9 del mese successivo
    const baseMovimentiAlNove = this.calculateBalanceAtDate(entityId, ninthNextMonth);

    const plannedUpToNinthNext = (DB.PIANIFICATI || []).filter(p => {
      if (p.stato !== 'PENDENTE') return false;
      if ((p as any).is_deleted) return false;
      const matchesEntity = p.conto_id && entityIds.has(p.conto_id);
      if (!matchesEntity) return false;
      return p.data_prevista <= ninthNextMonthStr;
    });

    let sumPlannedNinth = 0;
    for (const p of plannedUpToNinthNext) {
      if (p.tipologia === 'ENTRATA') sumPlannedNinth += p.importo;
      else if (p.tipologia === 'USCITA') sumPlannedNinth -= p.importo;
    }

    const deadlinesUpToNinth = (DB.SCADENZE || []).filter(s => {
      if (s.stato !== 'DA_PAGARE') return false;
      if ((s as any).is_deleted) return false;
      const matchesEntity = (s.conto_id && entityIds.has(s.conto_id)) || (!s.conto_id && isAccount && (entity as any).conto_principale);
      if (!matchesEntity) return false;
      const isAlreadyInPlanned = plannedUpToNinthNext.some(p => p.id === s.movimento_id);
      const isAlreadyInMov = DB.MOVIMENTI.some(m => m.id === s.movimento_id || (m.data === s.data_scadenza && m.descrizione === s.descrizione));
      if (isAlreadyInPlanned || isAlreadyInMov) return false;
      return s.data_scadenza <= ninthNextMonthStr;
    });

    let sumDeadlinesNinth = 0;
    for (const s of deadlinesUpToNinth) {
      sumDeadlinesNinth -= s.importo_previsto;
    }

    const saldoAlNove = Math.round((baseMovimentiAlNove + sumPlannedNinth + sumDeadlinesNinth) * 100) / 100;

    // Calcolo finestra di 1 mese (31 giorni) con il saldo ad Oggi esattamente centrato sul grafico (indice 15)
    // Passato: 15 giorni consuntivi effettivi (linea continua)
    // Centro: Saldo Oggi
    // Futuro: 15 giorni previsionali con movimenti pianificati e scadenze (linea tratteggiata)
    const monthsShort = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const sparklinePoints: import('../types').SparklinePoint[] = [];

    // 1. Passato (15 giorni prima di oggi)
    for (let dayOffset = 15; dayOffset >= 1; dayOffset--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOffset);
      const dStr = formatYMD(d);
      const val = this.calculateBalanceAtDate(entityId, d);
      sparklinePoints.push({
        date: dStr,
        displayDate: `${d.getDate()} ${monthsShort[d.getMonth()]}`,
        value: val,
        isFuture: false,
        isToday: false
      });
    }

    // 2. Oggi (Centro esatto della finestra di 1 mese)
    sparklinePoints.push({
      date: todayStr,
      displayDate: 'Oggi',
      value: saldoOggi,
      isFuture: false,
      isToday: true
    });

    // 3. Futuro (15 giorni dopo oggi con movimenti pianificati e scadenze pendenti)
    let runningBalance = saldoOggi;
    for (let dayOffset = 1; dayOffset <= 15; dayOffset++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset);
      const dStr = formatYMD(d);

      // Movimenti pianificati per questa data e conto/fondo
      const plannedDay = (DB.PIANIFICATI || []).filter(p => {
        if (p.stato !== 'PENDENTE') return false;
        if ((p as any).is_deleted) return false;
        const matchesEntity = p.conto_id === entityId || 
          p.conto_id === (entity as any).conto_id || 
          p.conto_id === (entity as any).fondo_id;
        return matchesEntity && p.data_prevista === dStr;
      });

      for (const p of plannedDay) {
        if (p.tipologia === 'ENTRATA') runningBalance += p.importo;
        else if (p.tipologia === 'USCITA') runningBalance -= p.importo;
      }

      // Scadenze aperte per questa data e conto/fondo
      const deadlinesDay = (DB.SCADENZE || []).filter(s => {
        if (s.stato !== 'DA_PAGARE') return false;
        if ((s as any).is_deleted) return false;
        const matchesEntity = s.conto_id === entityId || 
          s.conto_id === (entity as any).conto_id || 
          (!s.conto_id && isAccount && (entity as any).conto_principale);
        if (!matchesEntity) return false;
        const alreadyInPlanned = plannedDay.some(p => p.id === s.movimento_id);
        if (alreadyInPlanned) return false;
        return s.data_scadenza === dStr;
      });

      for (const s of deadlinesDay) {
        runningBalance -= s.importo_previsto;
      }

      runningBalance = Math.round(runningBalance * 100) / 100;

      sparklinePoints.push({
        date: dStr,
        displayDate: `${d.getDate()} ${monthsShort[d.getMonth()]}`,
        value: runningBalance,
        isFuture: true,
        isToday: false
      });
    }

    const trend = sparklinePoints.map(p => p.value);

    return {
      conto_id: entityId,
      id: entity.id,
      human_id: isAccount ? (entity as Account).conto_id : (entity as Fund).fondo_id,
      nome_conto: isAccount ? (entity as Account).nome_conto : (entity as Fund).nome_fondo,
      saldo_iniziale: entity.saldo_iniziale,
      saldo_oggi: saldoOggi,
      saldo_reale: entity.saldo_reale,
      differenza: Math.round((entity.saldo_reale - saldoOggi) * 100) / 100,
      saldo_fine_mese: saldoFineMese,
      saldo_al_nove: saldoAlNove,
      totale_programmati: totaleProgrammati,
      entrate_programmate: entrateProgrammate,
      uscite_programmate: usciteProgrammate,
      conteggio_programmati: plannedForAccount.length,
      saldo_con_programmati: saldoConProgrammati,
      movimenti_programmati: plannedForAccount,
      is_fund: !isAccount,
      tipo_conto: isAccount ? (entity as Account).tipo_conto : undefined,
      target_importo: !isAccount ? (entity as Fund).target_importo : undefined,
      conto_principale: isAccount ? (entity as Account).conto_principale : false,
      attivo: entity.attivo,
      note: entity.note,
      colore: entity.colore,
      icon: entity.icon,
      trend,
      sparklinePoints
    };
  },

  // Calcola la proiezione giornaliera del saldo totale calcolato per i prossimi 30 giorni
  async get30DaysForecast(): Promise<DailyForecastPoint[]> {
    const today = new Date();
    // Calcola il saldo di partenza di oggi sommando tutti i conti e fondi attivi
    let currentBalance = 0;
    for (const c of DB.CONTI.filter(c => c.attivo)) {
      currentBalance += this.calculateBalanceAtDate(c.id, today);
    }
    for (const f of (DB.FONDI || []).filter(f => f.attivo)) {
      currentBalance += this.calculateBalanceAtDate(f.id, today);
    }
    currentBalance = Math.round(currentBalance * 100) / 100;

    const points: DailyForecastPoint[] = [];

    // Date chiave basate sul mese finanziario attivo
    const currentFinKey = getCurrentFinancialMonth();
    const currentPeriod = getFinancialPeriodInfo(currentFinKey);

    const [curY, curM] = currentFinKey.split('-').map(Number);
    const nextY = curM === 12 ? curY + 1 : curY;
    const nextM = curM === 12 ? 1 : curM + 1;
    const nextFinKey = `${nextY}-${String(nextM).padStart(2, '0')}`;
    const nextPeriod = getFinancialPeriodInfo(nextFinKey);

    const lastDayStr = currentPeriod.endDate;
    const ninthNextMonthStr = nextPeriod.endDate;

    const monthsShort = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

    for (let dayOffset = 0; dayOffset <= 30; dayOffset++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset);
      const yStr = d.getFullYear();
      const mStr = String(d.getMonth() + 1).padStart(2, '0');
      const dStr = String(d.getDate()).padStart(2, '0');
      const dateKey = `${yStr}-${mStr}-${dStr}`;

      const displayDate = dayOffset === 0 
        ? 'Oggi' 
        : `${d.getDate()} ${monthsShort[d.getMonth()]}`;

      // Giorno 0: saldo calcolato odierno
      if (dayOffset === 0) {
        const todayMovs = (DB.MOVIMENTI || []).filter(
          m => !(m as any).is_deleted && m.data === dateKey
        );
        let todayEntrate = 0;
        let todayUscite = 0;
        const todayEvents: string[] = [];
        for (const m of todayMovs) {
          if (m.tipologia === 'ENTRATA') {
            todayEntrate += m.importo;
            todayEvents.push(`+ ${formatCurrency(m.importo)}: ${m.descrizione}`);
          } else if (m.tipologia === 'USCITA') {
            todayUscite += m.importo;
            todayEvents.push(`- ${formatCurrency(m.importo)}: ${m.descrizione}`);
          }
        }

        const todayPlanned = (DB.PIANIFICATI || []).filter(
          p => p.stato === 'PENDENTE' && p.data_prevista === dateKey
        );
        for (const p of todayPlanned) {
          if (p.tipologia === 'ENTRATA') {
            todayEntrate += p.importo;
            todayEvents.push(`+ ${formatCurrency(p.importo)}: [Pianificato] ${p.descrizione}`);
          } else if (p.tipologia === 'USCITA') {
            todayUscite += p.importo;
            todayEvents.push(`- ${formatCurrency(p.importo)}: [Pianificato] ${p.descrizione}`);
          }
        }
        points.push({
          date: dateKey,
          displayDate,
          dayNumber: 0,
          balance: currentBalance,
          entrate: Math.round(todayEntrate * 100) / 100,
          uscite: Math.round(todayUscite * 100) / 100,
          netChange: Math.round((todayEntrate - todayUscite) * 100) / 100,
          events: todayEvents,
          isToday: true
        });
        continue;
      }

      // 1. Movimenti futuri già registrati in MOVIMENTI per questa data
      const dayMovements = (DB.MOVIMENTI || []).filter(
        m => !(m as any).is_deleted && m.data === dateKey
      );

      let dayEntrate = 0;
      let dayUscite = 0;
      const events: string[] = [];

      for (const m of dayMovements) {
        if (m.tipologia === 'ENTRATA') {
          dayEntrate += m.importo;
          events.push(`+ ${formatCurrency(m.importo)}: ${m.descrizione}`);
        } else if (m.tipologia === 'USCITA') {
          dayUscite += m.importo;
          events.push(`- ${formatCurrency(m.importo)}: ${m.descrizione}`);
        }
      }

      // 2. Movimenti pianificati pendenti per questa data
      const dayPlanned = (DB.PIANIFICATI || []).filter(
        p => p.stato === 'PENDENTE' && p.data_prevista === dateKey
      );

      for (const p of dayPlanned) {
        if (p.tipologia === 'ENTRATA') {
          dayEntrate += p.importo;
          events.push(`+ ${formatCurrency(p.importo)}: [Pianificato] ${p.descrizione}`);
        } else if (p.tipologia === 'USCITA') {
          dayUscite += p.importo;
          events.push(`- ${formatCurrency(p.importo)}: [Pianificato] ${p.descrizione}`);
        }
      }

      // 3. Eventuali scadenze che scadono in questa data e non sono ancora pagate o già pianificate/registrate
      const dayDeadlines = (DB.SCADENZE || []).filter(
        s => s.stato === 'DA_PAGARE' && s.data_scadenza === dateKey &&
             !dayPlanned.some(p => p.id === s.movimento_id) &&
             !dayMovements.some(m => m.id === s.movimento_id || m.descrizione === s.descrizione)
      );
      for (const s of dayDeadlines) {
        dayUscite += s.importo_previsto;
        events.push(`- ${formatCurrency(s.importo_previsto)}: [Scadenza] ${s.descrizione}`);
      }

      dayEntrate = Math.round(dayEntrate * 100) / 100;
      dayUscite = Math.round(dayUscite * 100) / 100;
      const netChange = Math.round((dayEntrate - dayUscite) * 100) / 100;

      currentBalance = Math.round((currentBalance + netChange) * 100) / 100;

      points.push({
        date: dateKey,
        displayDate,
        dayNumber: dayOffset,
        balance: currentBalance,
        entrate: dayEntrate,
        uscite: dayUscite,
        netChange,
        events,
        isToday: false,
        isMonthEnd: dateKey === lastDayStr,
        isNinthNextMonth: dateKey === ninthNextMonthStr
      });
    }

    return points;
  },

  // Restituisce tutti i conti e fondi con i rispettivi forecast e totali aggregati
  async getAllForecasts(includeInactive = true): Promise<{
    accounts: AccountForecast[];
    funds: AccountForecast[];
    totale_oggi_calcolato: number;
    totale_oggi_reale: number;
    differenza_totale: number;
    totale_fine_mese: number;
    totale_al_nove: number;
    totale_programmati_netto?: number;
    totale_uscite_programmate?: number;
    totale_entrate_programmate?: number;
    totale_oggi_con_programmati?: number;
    conteggio_totale_programmati?: number;
    daily30Days: DailyForecastPoint[];
  }> {
    const accounts: AccountForecast[] = [];
    const accountsToProcess = includeInactive ? DB.CONTI : DB.CONTI.filter(c => c.attivo);
    for (const c of accountsToProcess) {
      accounts.push(await this.getAccountForecast(c.id));
    }

    const funds: AccountForecast[] = [];
    const fundsToProcess = includeInactive ? (DB.FONDI || []) : (DB.FONDI || []).filter(f => f.attivo);
    for (const f of fundsToProcess) {
      funds.push(await this.getAccountForecast(f.id));
    }

    // I totali si calcolano rigorosamente solo sui conti e fondi attivi
    const allActive = [...accounts, ...funds].filter(i => i.attivo !== false);
    const totale_oggi_calcolato = Math.round(allActive.reduce((acc, i) => acc + i.saldo_oggi, 0) * 100) / 100;
    const totale_oggi_reale = Math.round(allActive.reduce((acc, i) => acc + i.saldo_reale, 0) * 100) / 100;
    const differenza_totale = Math.round((totale_oggi_reale - totale_oggi_calcolato) * 100) / 100;
    const totale_fine_mese = Math.round(allActive.reduce((acc, i) => acc + i.saldo_fine_mese, 0) * 100) / 100;
    const totale_al_nove = Math.round(allActive.reduce((acc, i) => acc + i.saldo_al_nove, 0) * 100) / 100;

    // Totali complessivi movimenti programmati
    const totale_programmati_netto = Math.round(allActive.reduce((acc, i) => acc + (i.totale_programmati || 0), 0) * 100) / 100;
    const totale_uscite_programmate = Math.round(allActive.reduce((acc, i) => acc + (i.uscite_programmate || 0), 0) * 100) / 100;
    const totale_entrate_programmate = Math.round(allActive.reduce((acc, i) => acc + (i.entrate_programmate || 0), 0) * 100) / 100;
    const totale_oggi_con_programmati = Math.round((totale_oggi_calcolato + totale_programmati_netto) * 100) / 100;
    const conteggio_totale_programmati = allActive.reduce((acc, i) => acc + (i.conteggio_programmati || 0), 0);

    const daily30Days = await this.get30DaysForecast();

    return {
      accounts,
      funds,
      totale_oggi_calcolato,
      totale_oggi_reale,
      differenza_totale,
      totale_fine_mese,
      totale_al_nove,
      totale_programmati_netto,
      totale_uscite_programmate,
      totale_entrate_programmate,
      totale_oggi_con_programmati,
      conteggio_totale_programmati,
      daily30Days
    };
  },

  // Statistiche di utilizzo per verificare dipendenze prima della cancellazione
  getAccountUsage(entityId: string): {
    movementsCount: number;
    plannedCount: number;
    deadlinesCount: number;
    templatesCount: number;
    totalLinked: number;
  } {
    const movementsCount = (DB.MOVIMENTI || []).filter(
      m => m.conto_origine === entityId || m.conto_destinazione === entityId
    ).length;
    const plannedCount = (DB.PIANIFICATI || []).filter(
      p => p.conto_id === entityId
    ).length;
    const deadlinesCount = (DB.SCADENZE || []).filter(
      s => s.conto_id === entityId
    ).length;
    const templatesCount = (DB.MODELLI || []).filter(
      t => t.conto_origine === entityId || t.conto_destinazione === entityId
    ).length;

    return {
      movementsCount,
      plannedCount,
      deadlinesCount,
      templatesCount,
      totalLinked: movementsCount + plannedCount + deadlinesCount + templatesCount
    };
  },

  // Creazione conto "on the fly" o da impostazioni
  async createAccount(data: {
    nome_conto: string;
    tipo_conto?: any;
    saldo_iniziale?: number;
    saldo_reale?: number;
    icon?: string;
    colore?: string;
    conto_principale?: boolean;
    note?: string;
  }): Promise<Account> {
    const shouldBePrincipal = data.conto_principale ?? (DB.CONTI.length === 0);

    if (shouldBePrincipal) {
      DB.CONTI.forEach(c => {
        c.conto_principale = false;
      });
    }

    const newAccount: Account = {
      id: generateUUID(),
      conto_id: generateHumanID('CON', 'CONTI'),
      nome_conto: data.nome_conto.trim(),
      tipo_conto: data.tipo_conto || 'BANCA',
      conto_principale: shouldBePrincipal,
      saldo_iniziale: data.saldo_iniziale ?? 0,
      saldo_reale: data.saldo_reale ?? data.saldo_iniziale ?? 0,
      attivo: true,
      note: data.note?.trim(),
      icon: data.icon || 'Landmark',
      colore: data.colore || '#4f46e5',
      updated_at: new Date().toISOString()
    };

    if (shouldBePrincipal && DB.IMPOSTAZIONI) {
      DB.IMPOSTAZIONI.conto_principale_id = newAccount.id;
    }

    DB.CONTI.push(newAccount);
    await persistDB();
    return newAccount;
  },

  // Modifica conto esistente (nome, tipo, saldi, icona, colore, principale, note, attivo)
  async updateAccount(id: string, updates: Partial<Account>): Promise<Account> {
    const index = DB.CONTI.findIndex(c => c.id === id);
    if (index === -1) {
      throw new Error(`Conto con id ${id} non trovato`);
    }

    if (updates.conto_principale) {
      DB.CONTI.forEach(c => {
        c.conto_principale = false;
      });
      if (DB.IMPOSTAZIONI) {
        DB.IMPOSTAZIONI.conto_principale_id = id;
      }
    }

    const updatedAccount: Account = {
      ...DB.CONTI[index],
      ...updates,
      updated_at: new Date().toISOString()
    };

    DB.CONTI[index] = updatedAccount;
    await persistDB();
    return updatedAccount;
  },

  // Eliminazione conto con gestione sicura dei movimenti collegati (riassegnazione o rimozione)
  async deleteAccount(
    id: string,
    options?: { reassignToAccountId?: string; deleteLinkedMovements?: boolean }
  ): Promise<{ success: boolean; affectedMovements: number }> {
    const index = DB.CONTI.findIndex(c => c.id === id);
    if (index === -1) {
      throw new Error(`Conto con id ${id} non trovato`);
    }

    if (DB.CONTI.length <= 1) {
      throw new Error('Impossibile eliminare l\'unico conto esistente. Il sistema richiede almeno un conto attivo.');
    }

    const targetId = options?.reassignToAccountId;
    let affectedMovements = 0;

    if (targetId && targetId !== id) {
      // Riassegna tutti i movimenti
      for (const m of (DB.MOVIMENTI || [])) {
        let changed = false;
        if (m.conto_origine === id) {
          m.conto_origine = targetId;
          changed = true;
        }
        if (m.conto_destinazione === id) {
          m.conto_destinazione = targetId;
          changed = true;
        }
        if (changed) affectedMovements++;
      }

      // Riassegna pianificati
      for (const p of (DB.PIANIFICATI || [])) {
        if (p.conto_id === id) {
          p.conto_id = targetId;
        }
      }

      // Riassegna scadenze
      for (const s of (DB.SCADENZE || [])) {
        if (s.conto_id === id) {
          s.conto_id = targetId;
        }
      }

      // Riassegna modelli
      for (const t of (DB.MODELLI || [])) {
        if (t.conto_origine === id) t.conto_origine = targetId;
        if (t.conto_destinazione === id) t.conto_destinazione = targetId;
      }
    } else if (options?.deleteLinkedMovements) {
      const initialMovLen = DB.MOVIMENTI.length;
      DB.MOVIMENTI = DB.MOVIMENTI.filter(
        m => m.conto_origine !== id && m.conto_destinazione !== id
      );
      affectedMovements = initialMovLen - DB.MOVIMENTI.length;

      DB.PIANIFICATI = (DB.PIANIFICATI || []).filter(p => p.conto_id !== id);
      DB.SCADENZE = (DB.SCADENZE || []).filter(s => s.conto_id !== id);
      if (DB.MODELLI) {
        DB.MODELLI = DB.MODELLI.filter(t => t.conto_origine !== id && t.conto_destinazione !== id);
      }
    }

    const wasPrincipal = DB.CONTI[index].conto_principale;

    // Rimuovi il conto
    DB.CONTI.splice(index, 1);

    // Se era principale, eleggi un nuovo conto principale attivo
    if (wasPrincipal && DB.CONTI.length > 0) {
      const newPrincipal = DB.CONTI.find(c => c.attivo) || DB.CONTI[0];
      newPrincipal.conto_principale = true;
      if (DB.IMPOSTAZIONI) {
        DB.IMPOSTAZIONI.conto_principale_id = newPrincipal.id;
      }
    }

    await persistDB();
    return { success: true, affectedMovements };
  },

  // Toggle stato attivo / archiviato del conto
  async toggleAccountActive(id: string): Promise<Account> {
    const account = DB.CONTI.find(c => c.id === id);
    if (!account) throw new Error(`Conto con id ${id} non trovato`);

    account.attivo = !account.attivo;
    account.updated_at = new Date().toISOString();

    if (!account.attivo && account.conto_principale) {
      account.conto_principale = false;
      const otherActive = DB.CONTI.find(c => c.id !== id && c.attivo);
      if (otherActive) {
        otherActive.conto_principale = true;
        if (DB.IMPOSTAZIONI) {
          DB.IMPOSTAZIONI.conto_principale_id = otherActive.id;
        }
      }
    }

    await persistDB();
    return account;
  },

  // Creazione Fondo di pagamento
  async createFund(data: {
    nome_fondo: string;
    saldo_iniziale?: number;
    saldo_reale?: number;
    target_importo?: number;
    icon?: string;
    colore?: string;
    note?: string;
  }): Promise<Fund> {
    const newFund: Fund = {
      id: generateUUID(),
      fondo_id: generateHumanID('FON', 'FONDI'),
      nome_fondo: data.nome_fondo.trim(),
      saldo_iniziale: data.saldo_iniziale ?? 0,
      saldo_reale: data.saldo_reale ?? data.saldo_iniziale ?? 0,
      target_importo: data.target_importo ?? 1000,
      attivo: true,
      note: data.note?.trim(),
      icon: data.icon || 'ShieldAlert',
      colore: data.colore || '#d97706',
      updated_at: new Date().toISOString()
    };

    if (!DB.FONDI) DB.FONDI = [];
    DB.FONDI.push(newFund);
    await persistDB();
    return newFund;
  },

  // Modifica fondo esistente
  async updateFund(id: string, updates: Partial<Fund>): Promise<Fund> {
    if (!DB.FONDI) DB.FONDI = [];
    const index = DB.FONDI.findIndex(f => f.id === id);
    if (index === -1) {
      throw new Error(`Fondo con id ${id} non trovato`);
    }

    const updatedFund: Fund = {
      ...DB.FONDI[index],
      ...updates,
      updated_at: new Date().toISOString()
    };

    DB.FONDI[index] = updatedFund;
    await persistDB();
    return updatedFund;
  },

  // Eliminazione fondo con opzione di riassegnazione movimenti
  async deleteFund(
    id: string,
    options?: { reassignToAccountId?: string; deleteLinkedMovements?: boolean }
  ): Promise<{ success: boolean; affectedMovements: number }> {
    if (!DB.FONDI) DB.FONDI = [];
    const index = DB.FONDI.findIndex(f => f.id === id);
    if (index === -1) {
      throw new Error(`Fondo con id ${id} non trovato`);
    }

    const targetId = options?.reassignToAccountId;
    let affectedMovements = 0;

    if (targetId && targetId !== id) {
      for (const m of (DB.MOVIMENTI || [])) {
        let changed = false;
        if (m.conto_origine === id) {
          m.conto_origine = targetId;
          changed = true;
        }
        if (m.conto_destinazione === id) {
          m.conto_destinazione = targetId;
          changed = true;
        }
        if (changed) affectedMovements++;
      }

      for (const p of (DB.PIANIFICATI || [])) {
        if (p.conto_id === id) p.conto_id = targetId;
      }
      for (const s of (DB.SCADENZE || [])) {
        if (s.conto_id === id) s.conto_id = targetId;
      }
    } else if (options?.deleteLinkedMovements) {
      const initialMovLen = DB.MOVIMENTI.length;
      DB.MOVIMENTI = DB.MOVIMENTI.filter(
        m => m.conto_origine !== id && m.conto_destinazione !== id
      );
      affectedMovements = initialMovLen - DB.MOVIMENTI.length;
    }

    DB.FONDI.splice(index, 1);
    await persistDB();
    return { success: true, affectedMovements };
  },

  // Toggle stato attivo / archiviato del fondo
  async toggleFundActive(id: string): Promise<Fund> {
    if (!DB.FONDI) DB.FONDI = [];
    const fund = DB.FONDI.find(f => f.id === id);
    if (!fund) throw new Error(`Fondo con id ${id} non trovato`);

    fund.attivo = !fund.attivo;
    fund.updated_at = new Date().toISOString();
    await persistDB();
    return fund;
  },

  // Aggiornamento saldo reale per riconciliazione (Punto 18)
  async updateRealBalance(entityId: string, newRealBalance: number): Promise<void> {
    const account = DB.CONTI.find(c => c.id === entityId);
    if (account) {
      account.saldo_reale = newRealBalance;
      account.updated_at = new Date().toISOString();
      await persistDB();
      return;
    }
    const fund = (DB.FONDI || []).find(f => f.id === entityId);
    if (fund) {
      fund.saldo_reale = newRealBalance;
      fund.updated_at = new Date().toISOString();
      await persistDB();
    }
  },

  // Genera report di riconciliazione tra saldo calcolato e saldo reale
  getReconciliationReport(): {
    accounts: Array<{
      id: string;
      nome: string;
      isFund: boolean;
      calculatedBalance: number;
      realBalance: number;
      difference: number;
      isReconciled: boolean;
    }>;
    totalCalculated: number;
    totalReal: number;
    totalDifference: number;
    allReconciled: boolean;
  } {
    const today = new Date();
    const items = [
      ...DB.CONTI.filter(c => c.attivo).map(c => {
        const calc = this.calculateBalanceAtDate(c.id, today);
        const diff = Math.round((c.saldo_reale - calc) * 100) / 100;
        return {
          id: c.id,
          nome: c.nome_conto,
          isFund: false,
          calculatedBalance: calc,
          realBalance: c.saldo_reale,
          difference: diff,
          isReconciled: Math.abs(diff) < 0.01
        };
      }),
      ...(DB.FONDI || []).filter(f => f.attivo).map(f => {
        const calc = this.calculateBalanceAtDate(f.id, today);
        const diff = Math.round((f.saldo_reale - calc) * 100) / 100;
        return {
          id: f.id,
          nome: f.nome_fondo,
          isFund: true,
          calculatedBalance: calc,
          realBalance: f.saldo_reale,
          difference: diff,
          isReconciled: Math.abs(diff) < 0.01
        };
      })
    ];

    const totalCalculated = Math.round(items.reduce((sum, item) => sum + item.calculatedBalance, 0) * 100) / 100;
    const totalReal = Math.round(items.reduce((sum, item) => sum + item.realBalance, 0) * 100) / 100;
    const totalDifference = Math.round((totalReal - totalCalculated) * 100) / 100;
    const allReconciled = items.every(item => item.isReconciled);

    return {
      accounts: items,
      totalCalculated,
      totalReal,
      totalDifference,
      allReconciled
    };
  },

  // Strumento di correzione e allineamento saldo da banca (genera movimento di rettifica senza sottocategoria)
  async reconcileAccountWithRealBalance(
    entityId: string,
    realBalance: number,
    options?: {
      date?: string;
      description?: string;
      note?: string;
    }
  ): Promise<{
    movementCreated: Movement | null;
    previousCalculatedBalance: number;
    newBalance: number;
    difference: number;
    isExactMatch: boolean;
    entityName: string;
  }> {
    const isAccount = DB.CONTI.some(c => c.id === entityId || c.conto_id === entityId);
    const account = isAccount 
      ? DB.CONTI.find(c => c.id === entityId || c.conto_id === entityId)
      : null;
    const fund = !isAccount
      ? (DB.FONDI || []).find(f => f.id === entityId || f.fondo_id === entityId)
      : null;

    if (!account && !fund) {
      throw new Error(`Conto o fondo con ID "${entityId}" non trovato.`);
    }

    const targetEntity = account || fund!;
    const entityName = account ? account.nome_conto : fund!.nome_fondo;
    const effectiveEntityId = targetEntity.id;

    const opDateStr = options?.date || formatYMD(new Date());
    const opDateObj = new Date(opDateStr);

    // Calcolo del saldo contabile effettivo alla data dell'operazione
    const previousCalculatedBalance = this.calculateBalanceAtDate(effectiveEntityId, isNaN(opDateObj.getTime()) ? new Date() : opDateObj);
    const targetReal = Math.round(realBalance * 100) / 100;
    const difference = Math.round((targetReal - previousCalculatedBalance) * 100) / 100;

    let movementCreated: Movement | null = null;

    // Se c'è una discrepanza, generiamo il movimento contabile di correzione
    if (Math.abs(difference) >= 0.005) {
      const nowIso = new Date().toISOString();
      const isPositiveDiff = difference > 0;
      const tipologia: 'ENTRATA' | 'USCITA' = isPositiveDiff ? 'ENTRATA' : 'USCITA';
      const importo = Math.abs(difference);

      const defaultDesc = options?.description && options.description.trim()
        ? options.description.trim()
        : `Riconciliazione saldo (${isPositiveDiff ? 'Entrata di rettifica' : 'Uscita di rettifica'})`;

      const defaultNote = options?.note && options.note.trim()
        ? options.note.trim()
        : `Correzione automatica del saldo da estratto conto bancario. Saldo precedente: ${formatCurrency(previousCalculatedBalance)}, Saldo reale inserito: ${formatCurrency(targetReal)} (Rettifica: ${formatCurrency(difference, { showSign: true })})`;

      movementCreated = {
        id: generateUUID(),
        movimento_id: generateHumanID('MOV', 'MOVIMENTI'),
        data: opDateStr,
        descrizione: defaultDesc,
        importo: importo,
        tipologia: tipologia,
        conto_origine: effectiveEntityId,
        conto_destinazione: null,
        sottocategoria_id: '', // Rigorosamente senza sottocategoria (Rettifica Saldo)
        natura: 'VARIABILE',
        necessita: 'DEVO',
        progetto_id: null,
        tag: 'Riconciliazione',
        tags: ['Riconciliazione', 'Rettifica Saldo'],
        fondo_id: isAccount ? null : effectiveEntityId,
        stato: 'CONFERMATO',
        non_contabilizzato: false,
        origine_dati: 'MANUALE',
        note: defaultNote,
        allegati: [],
        created_at: nowIso,
        updated_at: nowIso
      };

      DB.MOVIMENTI.unshift(movementCreated);
    }

    // Aggiorniamo sempre anche il saldo_reale memorizzato sull'entità
    targetEntity.saldo_reale = targetReal;
    targetEntity.updated_at = new Date().toISOString();

    await persistDB();

    // Ricalcoliamo il nuovo saldo effettivo
    const newBalance = this.calculateBalanceAtDate(effectiveEntityId, new Date());

    return {
      movementCreated,
      previousCalculatedBalance,
      newBalance,
      difference,
      isExactMatch: Math.abs(difference) < 0.005,
      entityName
    };
  }
};
