import { DB } from './store';
import { ControlAlert } from '../types';
import { AccountService } from './AccountService';
import { formatCurrency, formatDateIT } from '../utils/formatters';

export const ControlService = {
  async getAlerts(): Promise<ControlAlert[]> {
    const alerts: ControlAlert[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // 1. Controllo Saldi Conti e Fondi (Discrepanze e Negativi)
    for (const c of DB.CONTI.filter(c => c.attivo)) {
      const saldoCalcolato = AccountService.calculateBalanceAtDate(c.id, today);
      const diff = Math.round((c.saldo_reale - saldoCalcolato) * 100) / 100;

      if (diff !== 0) {
        // Controllo se la differenza è dovuta a movimenti pianificati pendenti
        const plannedForC = (DB.PIANIFICATI || []).filter(
          p => p.stato === 'PENDENTE' && (p.conto_id === c.id || p.conto_id === c.conto_id)
        );
        let plannedNet = 0;
        for (const p of plannedForC) {
          if (p.tipologia === 'ENTRATA') plannedNet += p.importo;
          else if (p.tipologia === 'USCITA') plannedNet -= p.importo;
        }
        plannedNet = Math.round(plannedNet * 100) / 100;
        const diffWithPlanned = Math.round((c.saldo_reale - (saldoCalcolato + plannedNet)) * 100) / 100;

        // Controllo se la differenza è spiegata da transazioni bancarie ancora in sospeso (es. pre-autorizzazioni POS)
        const pendingForC = (DB.MOVIMENTI || []).filter(
          m => !(m as any).is_deleted && m.stato === 'DA_VERIFICARE' && 
          ((m.conto_origine && (m.conto_origine === c.id || m.conto_origine === c.conto_id)) ||
           (m.conto_destinazione && (m.conto_destinazione === c.id || m.conto_destinazione === c.conto_id)))
        );
        let pendingNet = 0;
        for (const p of pendingForC) {
          if (p.tipologia === 'ENTRATA') pendingNet += p.importo;
          else if (p.tipologia === 'USCITA') pendingNet -= p.importo;
        }
        pendingNet = Math.round(pendingNet * 100) / 100;
        const diffWithoutPending = Math.round((c.saldo_reale - (saldoCalcolato - pendingNet)) * 100) / 100;

        let extraNote = '';
        let isLowSeverity = false;

        if (diffWithoutPending === 0 && pendingForC.length > 0) {
          extraNote = ` Nota: il saldo reale coincide esattamente escludendo le ${pendingForC.length} transazioni ancora in sospeso (${formatCurrency(Math.abs(pendingNet))}).`;
          isLowSeverity = true;
        } else if (plannedForC.length > 0) {
          if (diffWithPlanned === 0) {
            extraNote = ` Nota: il saldo reale coincide includendo i ${plannedForC.length} movimenti programmati (${formatCurrency(plannedNet, { showSign: true })}).`;
            isLowSeverity = true;
          } else {
            extraNote = ` (${plannedForC.length} programmati: ${formatCurrency(plannedNet, { showSign: true })}, scostamento con programmati: ${formatCurrency(diffWithPlanned)}).`;
          }
        }

        alerts.push({
          id: `diff-${c.id}`,
          tipo: 'DIFFERENZA_SALDO',
          severita: isLowSeverity ? 'LOW' : (Math.abs(diff) > 100 ? 'HIGH' : 'MEDIUM'),
          titolo: `Discrepanza ${c.nome_conto}`,
          messaggio: `Il saldo reale (${formatCurrency(c.saldo_reale)}) differisce dal calcolato (${formatCurrency(saldoCalcolato)}) di ${formatCurrency(diff)}.${extraNote}`,
          id_riferimento: c.id
        });
      }

      if (saldoCalcolato < 0) {
        alerts.push({
          id: `neg-${c.id}`,
          tipo: 'CONTO_NEGATIVO',
          severita: 'HIGH',
          titolo: `Conto in rosso: ${c.nome_conto}`,
          messaggio: `Il saldo calcolato è negativo: ${formatCurrency(saldoCalcolato)}.`,
          id_riferimento: c.id
        });
      }
    }

    // 2. Controllo Fondi
    for (const f of (DB.FONDI || []).filter(f => f.attivo)) {
      const saldoFondo = AccountService.calculateBalanceAtDate(f.id, today);
      if (saldoFondo < 0) {
        alerts.push({
          id: `neg-fund-${f.id}`,
          tipo: 'FONDO_NEGATIVO',
          severita: 'HIGH',
          titolo: `Fondo in negativo: ${f.nome_fondo}`,
          messaggio: `Il saldo del fondo è sotto zero: ${formatCurrency(saldoFondo)}.`,
          id_riferimento: f.id
        });
      }
    }

    // 3. Controllo Pianificati Scaduti (data_prevista < today e PENDENTE)
    const overduePlanned = (DB.PIANIFICATI || []).filter(p => p.stato === 'PENDENTE' && p.data_prevista < todayStr);
    for (const p of overduePlanned) {
      alerts.push({
        id: `plan-overdue-${p.id}`,
        tipo: 'PIANIFICATO_SCADUTO',
        severita: 'MEDIUM',
        titolo: `Pianificato non eseguito: ${p.descrizione}`,
        messaggio: `Previsto per il ${formatDateIT(p.data_prevista)} (${formatCurrency(p.importo)}). Conferma l'esecuzione o aggiorna la data.`,
        id_riferimento: p.id,
        data_riferimento: p.data_prevista
      });
    }

    // 4. Controllo Scadenze (Scadute o imminenti entro 7 giorni)
    const next7Days = new Date();
    next7Days.setDate(today.getDate() + 7);
    const next7DaysStr = next7Days.toISOString().split('T')[0];

    const activeDeadlines = (DB.SCADENZE || []).filter(s => s.stato === 'DA_PAGARE');
    for (const s of activeDeadlines) {
      if (s.data_scadenza < todayStr) {
        alerts.push({
          id: `dead-past-${s.id}`,
          tipo: 'SCADENZA_SCADUTA',
          severita: 'HIGH',
          titolo: `Scadenza oltre il termine: ${s.descrizione}`,
          messaggio: `Scaduta il ${formatDateIT(s.data_scadenza)} (${formatCurrency(s.importo_previsto)}).`,
          id_riferimento: s.id,
          data_riferimento: s.data_scadenza
        });
      } else if (s.data_scadenza <= next7DaysStr) {
        alerts.push({
          id: `dead-near-${s.id}`,
          tipo: 'SCADENZA_IMMINENTE',
          severita: 'MEDIUM',
          titolo: `In scadenza tra poco: ${s.descrizione}`,
          messaggio: `Scade il ${formatDateIT(s.data_scadenza)} (${formatCurrency(s.importo_previsto)}).`,
          id_riferimento: s.id,
          data_riferimento: s.data_scadenza
        });
      }
    }

    // 5. Controllo Possibili Duplicati (stessa data, importo, conto e descrizione simile/identica)
    const movimenti = (DB.MOVIMENTI || []).filter(m => !(m as any).is_deleted);
    const seen = new Map<string, string>();
    for (const m of movimenti) {
      // Considera duplicato solo se anche la descrizione è identica o molto simile
      const cleanDesc = m.descrizione.toLowerCase().trim().replace(/[^a-z0-9]/g, '').slice(0, 16);
      const key = `${m.data}|${m.importo}|${m.conto_origine}|${cleanDesc}`;
      if (seen.has(key)) {
        alerts.push({
          id: `dup-${m.id}`,
          tipo: 'POSSIBILE_DUPLICATO',
          severita: 'LOW',
          titolo: `Possibile duplicato rilevato`,
          messaggio: `Il movimento "${m.descrizione}" (${formatCurrency(m.importo)}) del ${formatDateIT(m.data)} ha caratteristiche identiche a un altro movimento.`,
          id_riferimento: m.id,
          data_riferimento: m.data
        });
      } else {
        seen.set(key, m.id);
      }
    }

    return alerts;
  }
};
