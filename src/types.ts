export type AccountType = 'BANCA' | 'CARTA_DEBITO' | 'CARTA_CREDITO' | 'CONTANTI' | 'CONTO_DEPOSITO';
export type MovementType = 'USCITA' | 'ENTRATA' | 'GIROCONTO';
export type MovementNature = 'FISSA' | 'VARIABILE';
export type MovementNecessity = 'BISOGNO' | 'DESIDERIO' | 'RISPARMIO';
export type SubcategoryClassification = 'GUADAGNI' | 'SPESE_ESSENZIALI' | 'SPESE_EXTRA';
export type PlannedStatus = 'PENDENTE' | 'ESEGUITO' | 'ANNULLATO';
export type DeadlineStatus = 'DA_PAGARE' | 'PAGATA' | 'ANNULLATA';
export type ProjectType = 'PROGETTO' | 'FINANZIAMENTO' | 'PRESTITO' | 'MUTUO' | 'DEBITO';
export type ProjectStatus = 'ATTIVO' | 'COMPLETATO' | 'IN_PAUSA' | 'ANNULLATO';
export type ImportReviewStatus = 'DA_REVISIONARE' | 'CONFERMATO' | 'IGNORATO';
export type NoteCategory = 'IDEE' | 'RISPARMIO' | 'PROGETTI' | 'ACQUISTI' | 'FAMIGLIA' | 'INVESTIMENTI' | 'ALTRO';

export interface TagItem {
  id: string;
  nome: string;
  colore?: string;
  icona?: string;
  descrizione?: string;
  is_favorite?: boolean;
  created_at?: string;
}

export interface NoteItem {
  id: string; // UUID
  nota_id: string; // E.g. NOT00001
  titolo: string;
  contenuto: string;
  categoria: NoteCategory | string;
  tag?: string[];
  data_creazione: string; // YYYY-MM-DD
  data_modifica: string; // ISO
  fissata?: boolean; // Pinned
  colore?: string;
  collegamento_progetto_id?: string;
  completata?: boolean;
}

export interface Account {
  id: string; // UUID tecnico
  conto_id: string; // E.g. CON00001
  nome_conto: string;
  tipo_conto: AccountType;
  conto_principale: boolean;
  saldo_iniziale: number;
  saldo_reale: number; // Inserito manualmente dall'utente
  attivo: boolean;
  note?: string;
  icon?: string; // Nome icona Lucide
  colore?: string;
  updated_at: string;
}

export interface Fund {
  id: string; // UUID tecnico
  fondo_id: string; // E.g. FON00001
  nome_fondo: string;
  saldo_iniziale: number;
  saldo_reale: number; // Inserito manualmente dall'utente
  target_importo?: number;
  attivo: boolean;
  note?: string;
  icon?: string; // Nome icona Lucide
  colore?: string;
  updated_at: string;
}

export interface CategoryGroup {
  id: string; // E.g. cat-alimentari
  nome: string;
  tipo: MovementType;
}

export interface Subcategory {
  id: string; // UUID
  sottocategoria_id: string; // E.g. SUB00001
  nome: string;
  categoria_padre: string; // E.g. "Alimentazione", "Casa", "Lavoro"
  tipo: MovementType; // ENTRATA o USCITA (derivato per la sottocategoria)
  classificazione?: SubcategoryClassification; // GUADAGNI | SPESE_ESSENZIALI | SPESE_EXTRA
  icon_name: string; // Nome icona Lucide monocolore
  colore: string; // Colore hex coerente
  preferita: boolean; // Flag per griglia rapida mobile
  ordine: number;
  attiva: boolean;
}

/**
 * Risolve la classificazione macro di una sottocategoria:
 * - GUADAGNI (Entrate, stipendi, vendite, rimborsi)
 * - SPESE_ESSENZIALI (Casa, utenze, alimentari, salute, trasporti necessari)
 * - SPESE_EXTRA (Svago, ristoranti, shopping, viaggi, tempo libero)
 */
export function getSubcategoryClassification(sub?: Subcategory | null): SubcategoryClassification {
  if (sub?.classificazione) return sub.classificazione;
  if (!sub) return 'SPESE_ESSENZIALI';
  if (sub.tipo === 'ENTRATA') return 'GUADAGNI';

  const name = (sub.nome || '').toLowerCase();
  const parent = (sub.categoria_padre || '').toLowerCase();

  const isEssential =
    parent.includes('casa') ||
    parent.includes('aliment') ||
    parent.includes('spesa') ||
    parent.includes('salute') ||
    parent.includes('farmacia') ||
    parent.includes('trasport') ||
    parent.includes('bollett') ||
    parent.includes('utenze') ||
    parent.includes('lavoro') ||
    name.includes('mutuo') ||
    name.includes('affitto') ||
    name.includes('luce') ||
    name.includes('gas') ||
    name.includes('acqua') ||
    name.includes('supermercato') ||
    name.includes('farmacia') ||
    name.includes('visite') ||
    name.includes('medic') ||
    name.includes('assicurazion') ||
    name.includes('bollo') ||
    name.includes('carburante') ||
    name.includes('benzina') ||
    name.includes('treno') ||
    name.includes('internet') ||
    name.includes('tasse') ||
    name.includes('scuola') ||
    name.includes('condominio');

  return isEssential ? 'SPESE_ESSENZIALI' : 'SPESE_EXTRA';
}

export interface Movement {
  id: string; // UUID tecnico
  movimento_id: string; // E.g. MOV00001
  data: string; // YYYY-MM-DD
  descrizione: string;
  importo: number;
  tipologia: MovementType;
  conto_origine: string; // ID Conto o Fondo da cui escono i fondi
  conto_destinazione?: string | null; // ID Conto o Fondo di destinazione per GIROCONTO
  sottocategoria_id: string; // ID Sottocategoria (il perno logico)
  natura?: MovementNature;
  necessita?: MovementNecessity;
  progetto_id?: string | null;
  tag?: string | null; // E.g. "Vacanza a Napoli"
  tags?: string[]; // E.g. ["Vacanza a Napoli"]
  fondo_id?: string | null;
  stato: 'CONFERMATO' | 'DA_VERIFICARE';
  non_contabilizzato?: boolean; // Se true, movimento originariamente non contabilizzato dalla banca ma considerato già contabilizzato con addebito certo
  origine_dati: 'MANUALE' | 'PIANIFICATO' | 'IMPORTAZIONE' | 'RICORRENZA';
  id_importazione?: string | null;
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface Planned {
  id: string;
  pianificato_id: string; // E.g. PIA00001
  data_prevista: string; // YYYY-MM-DD
  descrizione: string;
  importo: number;
  tipologia: MovementType;
  conto_id: string; // ID Conto o Fondo previsto
  sottocategoria_id: string;
  stato: PlannedStatus;
  id_ricorrenza?: string | null;
  movimento_reale_id?: string | null;
  note?: string;
}

export interface Recurrence {
  id: string;
  ricorrenza_id: string; // E.g. RIC00001
  nome: string;
  frequenza: 'MENSILE' | 'BIMESTRALE' | 'TRIMESTRALE' | 'ANNUALE';
  giorno_esecuzione: number;
  importo: number;
  tipologia: MovementType;
  conto_id: string;
  sottocategoria_id: string;
  attiva: boolean;
}

export interface TransactionTemplate {
  id: string; // E.g. tpl-001
  nome: string; // Nome sintetico (es. "Spesa Supermercato", "Affitto / Mutuo", "Stipendio")
  descrizione: string; // Descrizione predefinita movimento
  importo?: number; // Importo predefinito
  tipologia: MovementType; // USCITA | ENTRATA | GIROCONTO
  sottocategoria_id?: string;
  conto_origine?: string;
  conto_destinazione?: string | null;
  natura?: MovementNature;
  necessita?: MovementNecessity;
  note?: string;
  tag?: string | null;
  tags?: string[];
  icon?: string;
  colore?: string;
  frequenza_suggerita?: 'MENSILE' | 'SETTIMANALE' | 'BIMESTRALE' | 'ANNUALE' | 'RICORRENTE';
  is_predefined?: boolean;
  created_at?: string;
}

export interface Budget {
  id: string;
  budget_id: string; // E.g. BUD00001
  mese: string; // Formato YYYY-MM
  sottocategoria_id: string;
  importo_budget: number;
  note?: string;
}

export interface Project {
  id: string;
  progetto_id: string; // E.g. PRO00001
  nome_progetto: string;
  tipo: ProjectType; // 'PROGETTO' | 'FINANZIAMENTO' | 'PRESTITO' | 'MUTUO' | 'DEBITO'
  sottocategoria_id: string; // FONDAMENTALE: Legato prettamente ad una sottocategoria determinata!
  budget_previsto: number; // Importo totale finanziamento o budget del progetto
  importo_iniziale?: number; // Anticipo o versamento iniziale
  importo_gia_pagato?: number; // Quota già rimborsata/pagata prima dell'inizio del tracciamento nell'app (es. finanziamento già iniziato)
  rate_gia_pagate?: number; // Numero di rate già saldate prima dell'app (es. 12 di 60)
  rata_mensile?: number; // Rata mensile se prestito/finanziamento/mutuo
  numero_rate_totali?: number; // Es. 60 rate
  tasso_interesse?: number; // TAN / TAEG (%)
  conto_addebito_id?: string; // Conto o fondo predefinito di addebito
  giorno_addebito_rata?: number; // Giorno del mese (1-31)
  stato: ProjectStatus; // 'ATTIVO' | 'COMPLETATO' | 'IN_PAUSA' | 'ANNULLATO'
  data_inizio?: string; // YYYY-MM-DD
  data_fine?: string; // YYYY-MM-DD (data estinzione prevista)
  colore?: string;
  icona?: string;
  note?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectStats {
  project: Project;
  sottocategoriaNome: string;
  categoriaPadre: string;
  totaleSpeso: number; // Totale rimborsato o speso finora (quota pregressa + movimenti registrati)
  importoGiaPagato?: number; // Quota già pagata prima dell'inizio del tracciamento nell'app
  residuo: number; // Debito residuo o budget rimanente
  percentuale: number; // Percentuale completamento / estinzione
  movimentiCount: number;
  ratePagateStimate: number;
  rateRimanentiStimate: number;
  dataFineStimata?: string;
  movimenti: Movement[];
  scadenzeCollegate?: Deadline[];
  pianificatiCollegati?: Planned[];
  noteCollegate?: NoteItem[];
}

export interface ProjectMovementLink {
  progetto_id: string;
  movimento_id: string;
}

export interface Deadline {
  id: string;
  scadenza_id: string; // E.g. SCA00001
  data_scadenza: string; // YYYY-MM-DD
  descrizione: string;
  importo_previsto: number;
  sottocategoria_id: string;
  conto_id?: string;
  stato: DeadlineStatus;
  priorita: 'ALTA' | 'MEDIA' | 'BASSA';
  movimento_id?: string | null;
  note?: string;
}

export interface ImportRow {
  id: string;
  data_originale: string;
  descrizione_originale: string;
  importo_originale: number;
  sottocategoria_id_suggerita?: string;
  conto_id: string;
  stato_revisione: ImportReviewStatus;
  tipo_match: 'CORRISPONDENZA' | 'POSSIBILE_DUPLICATO' | 'MANCANTE_NELL_APP';
  movimento_id_match?: string;
}

export interface Settings {
  valuta: string;
  lingua: string;
  formato_data: string;
  tema: 'light' | 'dark' | 'system';
  conto_principale_id: string;
  ultimo_backup?: string;
  tipo_mese_finanziario?: 'SOLARE' | 'PERSONALIZZATO';
  giorno_inizio_mese_finanziario?: number;
  giorno_fine_mese_finanziario?: number;
}

export interface DatabaseSchema {
  metadata: {
    app_name: string;
    version: string;
    last_synced: string;
    total_records: number;
  };
  CONTI: Account[];
  FONDI: Fund[];
  SOTTOCATEGORIE: Subcategory[];
  MOVIMENTI: Movement[];
  PIANIFICATI: Planned[];
  RICORRENZE: Recurrence[];
  BUDGET: Budget[];
  PROGETTI: Project[];
  PROGETTI_MOVIMENTI: ProjectMovementLink[];
  SCADENZE: Deadline[];
  MODELLI?: TransactionTemplate[];
  NOTE?: NoteItem[];
  TAGS?: TagItem[];
  IMPORTAZIONE: ImportRow[];
  IMPOSTAZIONI: Settings;
  REPORT_SETTIMANALI?: WeeklyFinancialReport[];
}

export interface SparklinePoint {
  date: string; // YYYY-MM-DD
  displayDate: string; // "11 Set", "Oggi"
  value: number; // Saldo calcolato o proiettato
  isFuture: boolean; // true = pianificato tratteggiato, false = effettivo continuo
  isToday?: boolean; // true = saldo odierno al centro
}

export interface AccountForecast {
  conto_id: string; // ID tecnico o human
  id?: string; // UUID tecnico
  human_id?: string; // E.g. CON00001
  nome_conto: string;
  saldo_iniziale: number;
  saldo_oggi: number; // Calcolato al giorno corrente (movimenti contabili)
  saldo_reale: number; // Inserito manualmente
  differenza: number; // Saldo Reale - Saldo Oggi
  saldo_fine_mese: number; // Proiezione al 30/31 del mese
  saldo_al_nove: number; // Proiezione al 9 del mese successivo
  // Integrazione movimenti programmati/pianificati:
  totale_programmati?: number; // Somma netta uscite/entrate programmate pendenti
  entrate_programmate?: number; // Totale entrate programmate
  uscite_programmate?: number; // Totale uscite programmate
  conteggio_programmati?: number; // Numero movimenti programmati collegati
  saldo_con_programmati?: number; // Saldo calcolato comprensivo dei movimenti programmati
  movimenti_programmati?: Planned[]; // Lista dei movimenti pianificati collegati a questo conto
  is_fund?: boolean;
  tipo_conto?: AccountType;
  target_importo?: number;
  conto_principale?: boolean;
  attivo?: boolean;
  note?: string;
  colore?: string;
  icon?: string;
  trend?: number[];
  sparklinePoints?: SparklinePoint[];
}

export interface DailyForecastPoint {
  date: string; // YYYY-MM-DD
  displayDate: string; // e.g. "Oggi", "12 Mar"
  dayNumber: number; // 0 to 30
  balance: number; // Saldo totale calcolato proiettato
  entrate: number;
  uscite: number;
  netChange: number;
  events: string[];
  isToday?: boolean;
  isMonthEnd?: boolean;
  isNinthNextMonth?: boolean;
}

export interface DailySpendingIncomePoint {
  date: string;
  displayDate: string;
  entrate: number;
  uscite: number;
  netChange: number;
  cumulativeNet: number;
  events: string[];
  isToday?: boolean;
  isFuture?: boolean;
}

export interface BudgetPerformanceItem {
  budget_id?: string;
  sottocategoria_id: string;
  sottocategoria_nome: string;
  categoria_padre: string;
  icon_name: string;
  colore: string;
  tipo: MovementType;
  budget: number;
  reale: number; // Speso reale effettivo ad oggi
  pianificato: number; // In programma da spendere entro fine mese (movimenti futuri + pianificati pendenti)
  movimenti_futuri?: number; // Quota da movimenti registrati con data futura nel mese
  pianificati_pendenti?: number; // Quota da pianificati/scadenze pendenti
  previsione: number; // Reale + Pianificato
  differenza: number; // Scostamento
  stato: 'OK' | 'IN_ECCESSO';
  percentuale: number;
}

export interface ControlAlert {
  id: string;
  tipo: 'DIFFERENZA_SALDO' | 'CONTO_NEGATIVO' | 'POSSIBILE_DUPLICATO' | 'PIANIFICATO_SCADUTO' | 'SCADENZA_IMMINENTE' | 'SCADENZA_SCADUTA' | 'FONDO_NEGATIVO';
  severita: 'HIGH' | 'MEDIUM' | 'LOW';
  titolo: string;
  messaggio: string;
  id_riferimento?: string;
  data_riferimento?: string;
}

export type AdviceCategory = 'BUDGET' | 'RISPARMIO' | 'GESTIONE_USCITE' | 'FONDI' | 'OTTIMIZZAZIONE';
export type AdvicePriority = 'ALTA' | 'MEDIA' | 'BASSA';
export type AdviceFeedbackType = 'UTILE' | 'MIGLIORATIVO';

export interface FinancialAdvice {
  id: string;
  titolo: string;
  categoria: AdviceCategory;
  priorita: AdvicePriority;
  descrizione: string;
  azione_pratica: string;
  impatto_stimato: string;
  sottocategoria_riferimento?: string;
  icona?: string;
  feedback?: AdviceFeedbackType | null;
  feedback_nota?: string;
  feedback_at?: string;
}

export interface WeeklyFinancialReport {
  id: string; // UUID
  report_id: string; // e.g. REP00001
  created_at: string; // ISO string
  settimana_chiave: string; // e.g. "2026-W38"
  settimana_label: string; // e.g. "Settimana 38 (15/09/2026 - 21/09/2026)"
  periodo_inizio: string; // YYYY-MM-DD
  periodo_fine: string; // YYYY-MM-DD
  valutazione_generale: {
    stato_salute: 'OTTIMO' | 'BUONO' | 'ATTENZIONE' | 'CRITICO';
    punteggio: number; // 0 - 100
    titolo: string;
    sommario: string;
  };
  metriche_riassuntive: {
    totale_entrate: number;
    totale_uscite: number;
    saldo_netto: number;
    budget_totale_impostato: number;
    budget_speso: number;
    categorie_sopra_budget: number;
    tasso_risparmio_pct: number;
  };
  consigli: FinancialAdvice[]; // Almeno 3 consigli personalizzati
  riepilogo_movimenti_analizzati: number;
  riepilogo_budget_analizzati: number;
  fonte_generazione: 'GEMINI_AI' | 'SISTEMA_REGOLE';
  note?: string;
}

export interface WeeklyReportDigest {
  settimana_chiave: string;
  settimana_label: string;
  periodo_inizio: string;
  periodo_fine: string;
  totale_entrate: number;
  totale_uscite: number;
  saldo_netto: number;
  tasso_risparmio_pct: number;
  totale_disponibile: number;
  fondo_emergenza_attuale: number;
  fondo_emergenza_target: number;
  budget_totale_impostato: number;
  budget_speso_totale: number;
  budget_prestazioni: {
    categoria: string;
    sottocategoria: string;
    budget: number;
    speso: number;
    differenza: number;
    percentuale: number;
    stato: 'OK' | 'IN_ECCESSO';
  }[];
  categorie_principali_spesa: {
    nome: string;
    totale: number;
    percentuale_su_totale: number;
  }[];
  top_movimenti_uscite: {
    data: string;
    descrizione: string;
    importo: number;
    sottocategoria: string;
  }[];
  movimenti_totali_count: number;
  scadenze_imminenti_count: number;
  storico_feedback_utente?: {
    utili: Array<{ titolo: string; categoria: string; azione_pratica: string; nota?: string }>;
    migliorativi: Array<{ titolo: string; categoria: string; azione_pratica: string; nota?: string }>;
  };
}

