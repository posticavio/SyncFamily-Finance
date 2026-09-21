import { DatabaseSchema, getSubcategoryClassification } from '../types';
import { db } from './firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { DEFAULT_TRANSACTION_TEMPLATES } from '../data/defaultTemplates';

const STORAGE_KEY = 'FINANZE_FAMILIARI_ONLINE_DB_V1';
const FIRESTORE_DOC_PATH = ['family_finance', 'master_archive'] as const;

// Helper per generare UUID tecnici
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Helper per generare Human ID stabili e leggibili (Punto 6)
export function generateHumanID(prefix: string, table: keyof DatabaseSchema): string {
  const currentItems = DB[table];
  const count = Array.isArray(currentItems) ? currentItems.length + 1 : 1;
  return `${prefix}${count.toString().padStart(5, '0')}`;
}

// Data corrente di riferimento
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
const currentMonthStr = `${currentYear}-${currentMonth}`;

const getPastDate = (monthsAgo: number, day: number): string => {
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, day);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dStr = String(day).padStart(2, '0');
  return `${y}-${m}-${dStr}`;
};

// Dati iniziali realistici e coerenti per Finanze Familiari
const INITIAL_DATABASE: DatabaseSchema = {
  metadata: {
    app_name: "Finanze Familiari",
    version: "1.0.0",
    last_synced: new Date().toISOString(),
    total_records: 0
  },
  CONTI: [
    {
      id: "acc-main-001",
      conto_id: "CON00001",
      nome_conto: "Conto Principale Intesa",
      tipo_conto: "BANCA",
      conto_principale: true,
      saldo_iniziale: 2450.00,
      saldo_reale: 2450.00,
      attivo: true,
      icon: "Landmark",
      colore: "#4f46e5",
      updated_at: new Date().toISOString()
    },
    {
      id: "acc-card-002",
      conto_id: "CON00002",
      nome_conto: "Carta Spese Famiglia",
      tipo_conto: "CARTA_DEBITO",
      conto_principale: false,
      saldo_iniziale: 420.00,
      saldo_reale: 420.00,
      attivo: true,
      icon: "CreditCard",
      colore: "#0284c7",
      updated_at: new Date().toISOString()
    },
    {
      id: "acc-cash-003",
      conto_id: "CON00003",
      nome_conto: "Contanti & Portafoglio",
      tipo_conto: "CONTANTI",
      conto_principale: false,
      saldo_iniziale: 160.00,
      saldo_reale: 160.00,
      attivo: true,
      icon: "Wallet",
      colore: "#059669",
      updated_at: new Date().toISOString()
    }
  ],
  FONDI: [
    {
      id: "fund-emergenza-001",
      fondo_id: "FON00001",
      nome_fondo: "Fondo Emergenza",
      saldo_iniziale: 4500.00,
      saldo_reale: 4500.00,
      target_importo: 6000.00,
      attivo: true,
      icon: "ShieldAlert",
      colore: "#d97706",
      updated_at: new Date().toISOString()
    },
    {
      id: "fund-tasse-002",
      fondo_id: "FON00002",
      nome_fondo: "Fondo Tasse & Bolli",
      saldo_iniziale: 1200.00,
      saldo_reale: 1200.00,
      target_importo: 2000.00,
      attivo: true,
      icon: "Receipt",
      colore: "#dc2626",
      updated_at: new Date().toISOString()
    },
    {
      id: "fund-vacanze-003",
      fondo_id: "FON00003",
      nome_fondo: "Fondo Vacanze",
      saldo_iniziale: 950.00,
      saldo_reale: 950.00,
      target_importo: 2500.00,
      attivo: true,
      icon: "Palmtree",
      colore: "#0d9488",
      updated_at: new Date().toISOString()
    }
  ],
  SOTTOCATEGORIE: [
    {
      id: "sub-spesa-01",
      sottocategoria_id: "SUB00001",
      nome: "Supermercato & Spesa",
      categoria_padre: "Alimentazione",
      tipo: "USCITA",
      icon_name: "ShoppingCart",
      colore: "#2563eb",
      preferita: true,
      ordine: 1,
      attiva: true
    },
    {
      id: "sub-ristoranti-02",
      sottocategoria_id: "SUB00002",
      nome: "Ristoranti & Pizzerie",
      categoria_padre: "Alimentazione",
      tipo: "USCITA",
      icon_name: "Utensils",
      colore: "#f97316",
      preferita: true,
      ordine: 2,
      attiva: true
    },
    {
      id: "sub-affitto-03",
      sottocategoria_id: "SUB00003",
      nome: "Mutuo / Affitto Casa",
      categoria_padre: "Casa",
      tipo: "USCITA",
      icon_name: "Home",
      colore: "#6366f1",
      preferita: true,
      ordine: 3,
      attiva: true
    },
    {
      id: "sub-luce-04",
      sottocategoria_id: "SUB00004",
      nome: "Bolletta Luce & Gas",
      categoria_padre: "Casa",
      tipo: "USCITA",
      icon_name: "Zap",
      colore: "#eab308",
      preferita: true,
      ordine: 4,
      attiva: true
    },
    {
      id: "sub-internet-05",
      sottocategoria_id: "SUB00005",
      nome: "Internet & Telefonia",
      categoria_padre: "Casa",
      tipo: "USCITA",
      icon_name: "Wifi",
      colore: "#06b6d4",
      preferita: false,
      ordine: 5,
      attiva: true
    },
    {
      id: "sub-benzina-06",
      sottocategoria_id: "SUB00006",
      nome: "Carburante Auto",
      categoria_padre: "Trasporti",
      tipo: "USCITA",
      icon_name: "Fuel",
      colore: "#dc2626",
      preferita: true,
      ordine: 6,
      attiva: true
    },
    {
      id: "sub-trasporti-07",
      sottocategoria_id: "SUB00007",
      nome: "Treno & Mezzi Pubblici",
      categoria_padre: "Trasporti",
      tipo: "USCITA",
      icon_name: "Train",
      colore: "#0284c7",
      preferita: false,
      ordine: 7,
      attiva: true
    },
    {
      id: "sub-farmacia-08",
      sottocategoria_id: "SUB00008",
      nome: "Farmacia & Visite",
      categoria_padre: "Salute",
      tipo: "USCITA",
      icon_name: "HeartPulse",
      colore: "#10b981",
      preferita: true,
      ordine: 8,
      attiva: true
    },
    {
      id: "sub-sport-09",
      sottocategoria_id: "SUB00009",
      nome: "Palestra & Attività",
      categoria_padre: "Tempo Libero",
      tipo: "USCITA",
      icon_name: "Dumbbell",
      colore: "#8b5cf6",
      preferita: true,
      ordine: 9,
      attiva: true
    },
    {
      id: "sub-shopping-10",
      sottocategoria_id: "SUB00010",
      nome: "Abbigliamento & Shopping",
      categoria_padre: "Tempo Libero",
      tipo: "USCITA",
      icon_name: "ShoppingBag",
      colore: "#ec4899",
      preferita: false,
      ordine: 10,
      attiva: true
    },
    {
      id: "sub-stipendio-11",
      sottocategoria_id: "SUB00011",
      nome: "Stipendio Principale",
      categoria_padre: "Lavoro",
      tipo: "ENTRATA",
      icon_name: "Briefcase",
      colore: "#059669",
      preferita: true,
      ordine: 11,
      attiva: true
    },
    {
      id: "sub-stipendio-12",
      sottocategoria_id: "SUB00012",
      nome: "Secondo Reddito",
      categoria_padre: "Lavoro",
      tipo: "ENTRATA",
      icon_name: "Banknote",
      colore: "#10b981",
      preferita: false,
      ordine: 12,
      attiva: true
    },
    {
      id: "sub-extra-13",
      sottocategoria_id: "SUB00013",
      nome: "Rimborsi & Extra",
      categoria_padre: "Entrate Varie",
      tipo: "ENTRATA",
      icon_name: "Coins",
      colore: "#3b82f6",
      preferita: false,
      ordine: 13,
      attiva: true
    },
    {
      id: "sub-giroconto-14",
      sottocategoria_id: "SUB00014",
      nome: "Giroconto / Trasferimento",
      categoria_padre: "Trasferimenti",
      tipo: "GIROCONTO",
      icon_name: "ArrowLeftRight",
      colore: "#64748b",
      preferita: true,
      ordine: 14,
      attiva: true
    },
    {
      id: "sub-finanziamento-15",
      sottocategoria_id: "SUB00015",
      nome: "Finanziamento Auto",
      categoria_padre: "Prestiti & Finanziamenti",
      tipo: "USCITA",
      icon_name: "Car",
      colore: "#ef4444",
      preferita: true,
      ordine: 15,
      attiva: true
    },
    {
      id: "sub-ristrutturazione-16",
      sottocategoria_id: "SUB00016",
      nome: "Ristrutturazione & Lavori Casa",
      categoria_padre: "Casa",
      tipo: "USCITA",
      icon_name: "Hammer",
      colore: "#d97706",
      preferita: true,
      ordine: 16,
      attiva: true
    },
    {
      id: "sub-prestito-17",
      sottocategoria_id: "SUB00017",
      nome: "Prestito Personale",
      categoria_padre: "Prestiti & Finanziamenti",
      tipo: "USCITA",
      icon_name: "Landmark",
      colore: "#8b5cf6",
      preferita: false,
      ordine: 17,
      attiva: true
    }
  ],
  MOVIMENTI: [
    {
      id: "mov-001",
      movimento_id: "MOV00001",
      data: `${currentYear}-${currentMonth}-02`,
      descrizione: "Spesa settimanale Esselunga",
      importo: 84.50,
      tipologia: "USCITA",
      conto_origine: "acc-card-002",
      conto_destinazione: null,
      sottocategoria_id: "sub-spesa-01",
      natura: "VARIABILE",
      necessita: "BISOGNO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "Frutta, verdura e scorte casa",
      created_at: new Date(currentYear, now.getMonth(), 2, 11, 30).toISOString(),
      updated_at: new Date(currentYear, now.getMonth(), 2, 11, 30).toISOString()
    },
    {
      id: "mov-002",
      movimento_id: "MOV00002",
      data: `${currentYear}-${currentMonth}-03`,
      descrizione: "Rifornimento Eni Station",
      importo: 55.00,
      tipologia: "USCITA",
      conto_origine: "acc-card-002",
      conto_destinazione: null,
      sottocategoria_id: "sub-benzina-06",
      natura: "VARIABILE",
      necessita: "BISOGNO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "Pieno per viaggio lavoro",
      created_at: new Date(currentYear, now.getMonth(), 3, 9, 15).toISOString(),
      updated_at: new Date(currentYear, now.getMonth(), 3, 9, 15).toISOString()
    },
    {
      id: "mov-003",
      movimento_id: "MOV00003",
      data: `${currentYear}-${currentMonth}-05`,
      descrizione: "Cena Trattoria da Nennella Spaccanapoli",
      importo: 42.00,
      tipologia: "USCITA",
      conto_origine: "acc-cash-003",
      conto_destinazione: null,
      sottocategoria_id: "sub-ristoranti-02",
      natura: "VARIABILE",
      necessita: "DESIDERIO",
      tag: "Vacanza a Napoli",
      tags: ["Vacanza a Napoli"],
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "Cena tipica napoletana con pizza fritta e pasta patate",
      created_at: new Date(currentYear, now.getMonth(), 5, 21, 0).toISOString(),
      updated_at: new Date(currentYear, now.getMonth(), 5, 21, 0).toISOString()
    },
    {
      id: "mov-napoli-treno",
      movimento_id: "MOV00003B",
      data: `${currentYear}-${currentMonth}-04`,
      descrizione: "Biglietto Treno A/R Napoli Centrale",
      importo: 84.00,
      tipologia: "USCITA",
      conto_origine: "acc-card-002",
      conto_destinazione: null,
      sottocategoria_id: "sub-trasporti-07",
      natura: "VARIABILE",
      necessita: "DESIDERIO",
      tag: "Vacanza a Napoli",
      tags: ["Vacanza a Napoli"],
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "Frecciarossa andata e ritorno",
      created_at: new Date(currentYear, now.getMonth(), 4, 14, 20).toISOString(),
      updated_at: new Date(currentYear, now.getMonth(), 4, 14, 20).toISOString()
    },
    {
      id: "mov-napoli-hotel",
      movimento_id: "MOV00003C",
      data: `${currentYear}-${currentMonth}-05`,
      descrizione: "B&B Vista Golfo Napoli",
      importo: 175.00,
      tipologia: "USCITA",
      conto_origine: "acc-main-001",
      conto_destinazione: null,
      sottocategoria_id: "sub-shopping-10",
      natura: "VARIABILE",
      necessita: "DESIDERIO",
      tag: "Vacanza a Napoli",
      tags: ["Vacanza a Napoli"],
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "Soggiorno weekend lungomare Caracciolo",
      created_at: new Date(currentYear, now.getMonth(), 5, 10, 15).toISOString(),
      updated_at: new Date(currentYear, now.getMonth(), 5, 10, 15).toISOString()
    },
    {
      id: "mov-004",
      movimento_id: "MOV00004",
      data: `${currentYear}-${currentMonth}-06`,
      descrizione: "Ricarica Carta Spese da C/C",
      importo: 300.00,
      tipologia: "GIROCONTO",
      conto_origine: "acc-main-001",
      conto_destinazione: "acc-card-002",
      sottocategoria_id: "sub-giroconto-14",
      natura: "VARIABILE",
      necessita: "BISOGNO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "Ricarica mensile carta prepagata",
      created_at: new Date(currentYear, now.getMonth(), 6, 8, 30).toISOString(),
      updated_at: new Date(currentYear, now.getMonth(), 6, 8, 30).toISOString()
    },
    {
      id: "mov-005",
      movimento_id: "MOV00005",
      data: `${currentYear}-${currentMonth}-08`,
      descrizione: "Farmacia Centrale",
      importo: 28.30,
      tipologia: "USCITA",
      conto_origine: "acc-card-002",
      conto_destinazione: null,
      sottocategoria_id: "sub-farmacia-08",
      natura: "VARIABILE",
      necessita: "BISOGNO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "Medicinali stagionali",
      created_at: new Date(currentYear, now.getMonth(), 8, 17, 45).toISOString(),
      updated_at: new Date(currentYear, now.getMonth(), 8, 17, 45).toISOString()
    },
    // Storico Mese -1
    {
      id: "mov-hist-101",
      movimento_id: "MOV00010",
      data: getPastDate(1, 4),
      descrizione: "Spesa Carrefour Market",
      importo: 114.20,
      tipologia: "USCITA",
      conto_origine: "acc-card-002",
      conto_destinazione: null,
      sottocategoria_id: "sub-spesa-01",
      natura: "VARIABILE",
      necessita: "BISOGNO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "Spesa alimentare mensile",
      created_at: new Date(now.getFullYear(), now.getMonth() - 1, 4).toISOString(),
      updated_at: new Date(now.getFullYear(), now.getMonth() - 1, 4).toISOString()
    },
    {
      id: "mov-hist-102",
      movimento_id: "MOV00011",
      data: getPastDate(1, 10),
      descrizione: "Rifornimento Q8",
      importo: 65.00,
      tipologia: "USCITA",
      conto_origine: "acc-card-002",
      conto_destinazione: null,
      sottocategoria_id: "sub-benzina-06",
      natura: "VARIABILE",
      necessita: "BISOGNO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "",
      created_at: new Date(now.getFullYear(), now.getMonth() - 1, 10).toISOString(),
      updated_at: new Date(now.getFullYear(), now.getMonth() - 1, 10).toISOString()
    },
    {
      id: "mov-hist-103",
      movimento_id: "MOV00012",
      data: getPastDate(1, 18),
      descrizione: "Bolletta Luce Servizio Elettrico",
      importo: 92.50,
      tipologia: "USCITA",
      conto_origine: "acc-main-001",
      conto_destinazione: null,
      sottocategoria_id: "sub-luce-04",
      natura: "FISSA",
      necessita: "BISOGNO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "",
      created_at: new Date(now.getFullYear(), now.getMonth() - 1, 18).toISOString(),
      updated_at: new Date(now.getFullYear(), now.getMonth() - 1, 18).toISOString()
    },
    {
      id: "mov-hist-104",
      movimento_id: "MOV00013",
      data: getPastDate(1, 24),
      descrizione: "Cena Ristorante Trattoria",
      importo: 68.00,
      tipologia: "USCITA",
      conto_origine: "acc-card-002",
      conto_destinazione: null,
      sottocategoria_id: "sub-ristoranti-02",
      natura: "VARIABILE",
      necessita: "DESIDERIO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "Cena di famiglia",
      created_at: new Date(now.getFullYear(), now.getMonth() - 1, 24).toISOString(),
      updated_at: new Date(now.getFullYear(), now.getMonth() - 1, 24).toISOString()
    },
    {
      id: "mov-hist-105",
      movimento_id: "MOV00014",
      data: getPastDate(1, 27),
      descrizione: "Stipendio Mensile",
      importo: 2150.00,
      tipologia: "ENTRATA",
      conto_origine: null,
      conto_destinazione: "acc-main-001",
      sottocategoria_id: "sub-stipendio-11",
      natura: "FISSA",
      necessita: "BISOGNO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "",
      created_at: new Date(now.getFullYear(), now.getMonth() - 1, 27).toISOString(),
      updated_at: new Date(now.getFullYear(), now.getMonth() - 1, 27).toISOString()
    },
    // Storico Mese -2
    {
      id: "mov-hist-201",
      movimento_id: "MOV00020",
      data: getPastDate(2, 5),
      descrizione: "Spesa Conad Superstore",
      importo: 135.00,
      tipologia: "USCITA",
      conto_origine: "acc-card-002",
      conto_destinazione: null,
      sottocategoria_id: "sub-spesa-01",
      natura: "VARIABILE",
      necessita: "BISOGNO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "",
      created_at: new Date(now.getFullYear(), now.getMonth() - 2, 5).toISOString(),
      updated_at: new Date(now.getFullYear(), now.getMonth() - 2, 5).toISOString()
    },
    {
      id: "mov-hist-202",
      movimento_id: "MOV00021",
      data: getPastDate(2, 12),
      descrizione: "Rinnovo Abbonamento Palestra",
      importo: 75.00,
      tipologia: "USCITA",
      conto_origine: "acc-card-002",
      conto_destinazione: null,
      sottocategoria_id: "sub-sport-09",
      natura: "FISSA",
      necessita: "DESIDERIO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "",
      created_at: new Date(now.getFullYear(), now.getMonth() - 2, 12).toISOString(),
      updated_at: new Date(now.getFullYear(), now.getMonth() - 2, 12).toISOString()
    },
    {
      id: "mov-hist-203",
      movimento_id: "MOV00022",
      data: getPastDate(2, 15),
      descrizione: "Bolletta Gas & Riscaldamento",
      importo: 128.40,
      tipologia: "USCITA",
      conto_origine: "acc-main-001",
      conto_destinazione: null,
      sottocategoria_id: "sub-gas-05",
      natura: "FISSA",
      necessita: "BISOGNO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "",
      created_at: new Date(now.getFullYear(), now.getMonth() - 2, 15).toISOString(),
      updated_at: new Date(now.getFullYear(), now.getMonth() - 2, 15).toISOString()
    },
    {
      id: "mov-hist-204",
      movimento_id: "MOV00023",
      data: getPastDate(2, 22),
      descrizione: "Benzina Eni Station",
      importo: 60.00,
      tipologia: "USCITA",
      conto_origine: "acc-card-002",
      conto_destinazione: null,
      sottocategoria_id: "sub-benzina-06",
      natura: "VARIABILE",
      necessita: "BISOGNO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "",
      created_at: new Date(now.getFullYear(), now.getMonth() - 2, 22).toISOString(),
      updated_at: new Date(now.getFullYear(), now.getMonth() - 2, 22).toISOString()
    },
    {
      id: "mov-hist-205",
      movimento_id: "MOV00024",
      data: getPastDate(2, 27),
      descrizione: "Stipendio Mensile",
      importo: 2150.00,
      tipologia: "ENTRATA",
      conto_origine: null,
      conto_destinazione: "acc-main-001",
      sottocategoria_id: "sub-stipendio-11",
      natura: "FISSA",
      necessita: "BISOGNO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "",
      created_at: new Date(now.getFullYear(), now.getMonth() - 2, 27).toISOString(),
      updated_at: new Date(now.getFullYear(), now.getMonth() - 2, 27).toISOString()
    },
    // Storico Mese -3
    {
      id: "mov-hist-301",
      movimento_id: "MOV00030",
      data: getPastDate(3, 3),
      descrizione: "Spesa Ipercoop",
      importo: 122.00,
      tipologia: "USCITA",
      conto_origine: "acc-card-002",
      conto_destinazione: null,
      sottocategoria_id: "sub-spesa-01",
      natura: "VARIABILE",
      necessita: "BISOGNO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "",
      created_at: new Date(now.getFullYear(), now.getMonth() - 3, 3).toISOString(),
      updated_at: new Date(now.getFullYear(), now.getMonth() - 3, 3).toISOString()
    },
    {
      id: "mov-hist-302",
      movimento_id: "MOV00031",
      data: getPastDate(3, 14),
      descrizione: "Tagliando e Controllo Auto Officina",
      importo: 195.00,
      tipologia: "USCITA",
      conto_origine: "acc-main-001",
      conto_destinazione: null,
      sottocategoria_id: "sub-manutenzione-07",
      natura: "VARIABILE",
      necessita: "BISOGNO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "Tagliando annuale auto",
      created_at: new Date(now.getFullYear(), now.getMonth() - 3, 14).toISOString(),
      updated_at: new Date(now.getFullYear(), now.getMonth() - 3, 14).toISOString()
    },
    {
      id: "mov-hist-303",
      movimento_id: "MOV00032",
      data: getPastDate(3, 20),
      descrizione: "Rifornimento Benzina",
      importo: 55.00,
      tipologia: "USCITA",
      conto_origine: "acc-card-002",
      conto_destinazione: null,
      sottocategoria_id: "sub-benzina-06",
      natura: "VARIABILE",
      necessita: "BISOGNO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "",
      created_at: new Date(now.getFullYear(), now.getMonth() - 3, 20).toISOString(),
      updated_at: new Date(now.getFullYear(), now.getMonth() - 3, 20).toISOString()
    },
    {
      id: "mov-hist-304",
      movimento_id: "MOV00033",
      data: getPastDate(3, 27),
      descrizione: "Stipendio Mensile",
      importo: 2150.00,
      tipologia: "ENTRATA",
      conto_origine: null,
      conto_destinazione: "acc-main-001",
      sottocategoria_id: "sub-stipendio-11",
      natura: "FISSA",
      necessita: "BISOGNO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "",
      created_at: new Date(now.getFullYear(), now.getMonth() - 3, 27).toISOString(),
      updated_at: new Date(now.getFullYear(), now.getMonth() - 3, 27).toISOString()
    },
    // Storico Mese -4
    {
      id: "mov-hist-401",
      movimento_id: "MOV00040",
      data: getPastDate(4, 6),
      descrizione: "Spesa Esselunga",
      importo: 108.50,
      tipologia: "USCITA",
      conto_origine: "acc-card-002",
      conto_destinazione: null,
      sottocategoria_id: "sub-spesa-01",
      natura: "VARIABILE",
      necessita: "BISOGNO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "",
      created_at: new Date(now.getFullYear(), now.getMonth() - 4, 6).toISOString(),
      updated_at: new Date(now.getFullYear(), now.getMonth() - 4, 6).toISOString()
    },
    {
      id: "mov-hist-402",
      movimento_id: "MOV00041",
      data: getPastDate(4, 15),
      descrizione: "Pizzeria con Amici",
      importo: 54.00,
      tipologia: "USCITA",
      conto_origine: "acc-cash-003",
      conto_destinazione: null,
      sottocategoria_id: "sub-ristoranti-02",
      natura: "VARIABILE",
      necessita: "DESIDERIO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "",
      created_at: new Date(now.getFullYear(), now.getMonth() - 4, 15).toISOString(),
      updated_at: new Date(now.getFullYear(), now.getMonth() - 4, 15).toISOString()
    },
    {
      id: "mov-hist-403",
      movimento_id: "MOV00042",
      data: getPastDate(4, 21),
      descrizione: "Farmacia Parafarmaci",
      importo: 36.40,
      tipologia: "USCITA",
      conto_origine: "acc-card-002",
      conto_destinazione: null,
      sottocategoria_id: "sub-farmacia-08",
      natura: "VARIABILE",
      necessita: "BISOGNO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "",
      created_at: new Date(now.getFullYear(), now.getMonth() - 4, 21).toISOString(),
      updated_at: new Date(now.getFullYear(), now.getMonth() - 4, 21).toISOString()
    },
    {
      id: "mov-hist-404",
      movimento_id: "MOV00043",
      data: getPastDate(4, 27),
      descrizione: "Stipendio Mensile",
      importo: 2150.00,
      tipologia: "ENTRATA",
      conto_origine: null,
      conto_destinazione: "acc-main-001",
      sottocategoria_id: "sub-stipendio-11",
      natura: "FISSA",
      necessita: "BISOGNO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "",
      created_at: new Date(now.getFullYear(), now.getMonth() - 4, 27).toISOString(),
      updated_at: new Date(now.getFullYear(), now.getMonth() - 4, 27).toISOString()
    },
    // Storico Mese -5
    {
      id: "mov-hist-501",
      movimento_id: "MOV00050",
      data: getPastDate(5, 7),
      descrizione: "Spesa Supermercato Bio",
      importo: 96.00,
      tipologia: "USCITA",
      conto_origine: "acc-card-002",
      conto_destinazione: null,
      sottocategoria_id: "sub-spesa-01",
      natura: "VARIABILE",
      necessita: "BISOGNO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "",
      created_at: new Date(now.getFullYear(), now.getMonth() - 5, 7).toISOString(),
      updated_at: new Date(now.getFullYear(), now.getMonth() - 5, 7).toISOString()
    },
    {
      id: "mov-hist-502",
      movimento_id: "MOV00051",
      data: getPastDate(5, 16),
      descrizione: "Bolletta Luce",
      importo: 88.00,
      tipologia: "USCITA",
      conto_origine: "acc-main-001",
      conto_destinazione: null,
      sottocategoria_id: "sub-luce-04",
      natura: "FISSA",
      necessita: "BISOGNO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "",
      created_at: new Date(now.getFullYear(), now.getMonth() - 5, 16).toISOString(),
      updated_at: new Date(now.getFullYear(), now.getMonth() - 5, 16).toISOString()
    },
    {
      id: "mov-hist-503",
      movimento_id: "MOV00052",
      data: getPastDate(5, 23),
      descrizione: "Benzina Q8",
      importo: 60.00,
      tipologia: "USCITA",
      conto_origine: "acc-card-002",
      conto_destinazione: null,
      sottocategoria_id: "sub-benzina-06",
      natura: "VARIABILE",
      necessita: "BISOGNO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "",
      created_at: new Date(now.getFullYear(), now.getMonth() - 5, 23).toISOString(),
      updated_at: new Date(now.getFullYear(), now.getMonth() - 5, 23).toISOString()
    },
    {
      id: "mov-hist-504",
      movimento_id: "MOV00053",
      data: getPastDate(5, 27),
      descrizione: "Stipendio Mensile",
      importo: 2150.00,
      tipologia: "ENTRATA",
      conto_origine: null,
      conto_destinazione: "acc-main-001",
      sottocategoria_id: "sub-stipendio-11",
      natura: "FISSA",
      necessita: "BISOGNO",
      stato: "CONFERMATO",
      origine_dati: "MANUALE",
      note: "",
      created_at: new Date(now.getFullYear(), now.getMonth() - 5, 27).toISOString(),
      updated_at: new Date(now.getFullYear(), now.getMonth() - 5, 27).toISOString()
    }
  ],
  PIANIFICATI: [
    {
      id: "pia-001",
      pianificato_id: "PIA00001",
      data_prevista: `${currentYear}-${currentMonth}-15`,
      descrizione: "Rata Mutuo Casa",
      importo: 680.00,
      tipologia: "USCITA",
      conto_id: "acc-main-001",
      sottocategoria_id: "sub-affitto-03",
      stato: "PENDENTE",
      note: "Addebito RID automatico"
    },
    {
      id: "pia-002",
      pianificato_id: "PIA00002",
      data_prevista: `${currentYear}-${currentMonth}-20`,
      descrizione: "Bolletta Luce Servizio Elettrico",
      importo: 115.00,
      tipologia: "USCITA",
      conto_id: "acc-main-001",
      sottocategoria_id: "sub-luce-04",
      stato: "PENDENTE",
      note: "Bimestre Ottobre-Novembre"
    },
    {
      id: "pia-003",
      pianificato_id: "PIA00003",
      data_prevista: `${currentYear}-${currentMonth}-27`,
      descrizione: "Accredito Stipendio Principale",
      importo: 2150.00,
      tipologia: "ENTRATA",
      conto_id: "acc-main-001",
      sottocategoria_id: "sub-stipendio-11",
      stato: "PENDENTE",
      note: "Stipendio mensile"
    },
    {
      id: "pia-004",
      pianificato_id: "PIA00004",
      data_prevista: (() => {
        const nextM = now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2;
        const nextY = now.getMonth() + 2 > 12 ? currentYear + 1 : currentYear;
        return `${nextY}-${nextM.toString().padStart(2, '0')}-05`;
      })(),
      descrizione: "Abbonamento Palestra Famiglia",
      importo: 75.00,
      tipologia: "USCITA",
      conto_id: "acc-card-002",
      sottocategoria_id: "sub-sport-09",
      stato: "PENDENTE",
      note: "Rinnovo mensile inizio mese"
    }
  ],
  RICORRENZE: [],
  BUDGET: [
    {
      id: "bud-001",
      budget_id: "BUD00001",
      mese: currentMonthStr,
      sottocategoria_id: "sub-spesa-01",
      importo_budget: 450.00,
      note: "Budget spesa alimentare mensile"
    },
    {
      id: "bud-002",
      budget_id: "BUD00002",
      mese: currentMonthStr,
      sottocategoria_id: "sub-ristoranti-02",
      importo_budget: 150.00,
      note: "Uscite e svago gastronomico"
    },
    {
      id: "bud-003",
      budget_id: "BUD00003",
      mese: currentMonthStr,
      sottocategoria_id: "sub-benzina-06",
      importo_budget: 180.00,
      note: "Trasporti e viaggi casa-lavoro"
    },
    {
      id: "bud-004",
      budget_id: "BUD00004",
      mese: currentMonthStr,
      sottocategoria_id: "sub-luce-04",
      importo_budget: 130.00,
      note: "Utenze energetiche"
    },
    {
      id: "bud-005",
      budget_id: "BUD00005",
      mese: currentMonthStr,
      sottocategoria_id: "sub-farmacia-08",
      importo_budget: 80.00,
      note: "Spese sanitarie e prevenzione"
    }
  ],
  PROGETTI: [],
  PROGETTI_MOVIMENTI: [],
  SCADENZE: [],
  MODELLI: DEFAULT_TRANSACTION_TEMPLATES,
  NOTE: [
    {
      id: "not-001",
      nota_id: "NOT00001",
      titolo: "Idee per abbattere i costi fissi delle utenze",
      contenuto: "1. Verificare tariffe luce e gas sul portale ARERA prima dell'inverno.\n2. Disattivare abbonamento streaming non utilizzato negli ultimi 2 mesi.\n3. Rinegoziare offerta fibra casa con operatore.",
      categoria: "RISPARMIO",
      tag: ["Utenze", "Bollette", "Risparmio"],
      data_creazione: getPastDate(0, 5),
      data_modifica: new Date().toISOString(),
      fissata: true,
      colore: "#4f46e5"
    },
    {
      id: "not-002",
      nota_id: "NOT00002",
      titolo: "Regole e preventivo vacanze estive",
      contenuto: "Target budget per la famiglia: 1.800€.\n- Prenotare traghetto/voli con 4 mesi di anticipo.\n- Usare il Fondo Vacanze alimentato mensilmente con 150€.",
      categoria: "PROGETTI",
      tag: ["Vacanze", "Fondo", "Estate"],
      data_creazione: getPastDate(0, 10),
      data_modifica: new Date().toISOString(),
      fissata: true,
      colore: "#059669"
    },
    {
      id: "not-003",
      nota_id: "NOT00003",
      titolo: "Lista desideri e acquisti intelligenti",
      contenuto: "- Nuovo monitor ergonomico per home office (attendere sconti o promo).\n- Macchina del caffè a chicchi per ridurre rifiuti e costi sul lungo periodo.",
      categoria: "ACQUISTI",
      tag: ["Wishlist", "Casa", "Lavoro"],
      data_creazione: getPastDate(1, 15),
      data_modifica: new Date().toISOString(),
      fissata: false,
      colore: "#d97706"
    },
    {
      id: "not-004",
      nota_id: "NOT00004",
      titolo: "Strategia Fondo Emergenza & PAC",
      contenuto: "Obiettivo: 6 mesi di spese vive (circa 9.000€ sul Conto Deposito o Fondo Emergenza).\nUna volta raggiunto l'obiettivo, destinare l'eccedenza al Piano di Accumulo (PAC ETF diversificato).",
      categoria: "INVESTIMENTI",
      tag: ["FondoEmergenza", "PAC", "Futuro"],
      data_creazione: getPastDate(1, 28),
      data_modifica: new Date().toISOString(),
      fissata: false,
      colore: "#7c3aed"
    }
  ],
  TAGS: [
    { id: "tag-napoli-01", nome: "Vacanza a Napoli 2026", colore: "#f59e0b", icona: "Palmtree", is_favorite: true },
    { id: "tag-napoli-02", nome: "Napoli", colore: "#f97316", icona: "MapPin", is_favorite: true },
    { id: "tag-viaggi-03", nome: "Viaggi", colore: "#3b82f6", icona: "Plane", is_favorite: true },
    { id: "tag-auto-04", nome: "Auto", colore: "#6366f1", icona: "Car", is_favorite: true },
    { id: "tag-bollette-05", nome: "Bollette", colore: "#ef4444", icona: "Zap", is_favorite: true },
    { id: "tag-finanz-06", nome: "Finanziamento", colore: "#8b5cf6", icona: "CreditCard", is_favorite: true },
    { id: "tag-figli-07", nome: "Figli", colore: "#ec4899", icona: "Heart", is_favorite: true },
    { id: "tag-salute-08", nome: "Salute", colore: "#10b981", icona: "Activity", is_favorite: true },
    { id: "tag-spesa-09", nome: "Spesa", colore: "#14b8a6", icona: "ShoppingCart", is_favorite: true },
    { id: "tag-lavoro-10", nome: "Lavoro", colore: "#0ea5e9", icona: "Briefcase", is_favorite: false },
    { id: "tag-casa-11", nome: "Casa", colore: "#84cc16", icona: "Home", is_favorite: false }
  ],
  IMPORTAZIONE: [],
  IMPOSTAZIONI: {
    valuta: "EUR",
    lingua: "IT",
    formato_data: "DD/MM/YYYY",
    tema: "light",
    conto_principale_id: "acc-main-001",
    ultimo_backup: new Date().toISOString(),
    tipo_mese_finanziario: "PERSONALIZZATO",
    giorno_inizio_mese_finanziario: 9,
    giorno_fine_mese_finanziario: 10
  },
  REPORT_SETTIMANALI: []
};

// Istanza in memoria (inizialmente idratata da local cache o da initial)
export let DB: DatabaseSchema = loadLocalCache();

export type CloudSyncStatus = 'INITIALIZING' | 'CONNECTED' | 'SYNCING' | 'OFFLINE' | 'ERROR';
let currentSyncStatus: CloudSyncStatus = 'INITIALIZING';
let lastSyncTimestamp: string = new Date().toISOString();

// Lista di ascoltatori
type Listener = () => void;
const listeners: Set<Listener> = new Set();
type StatusListener = (status: CloudSyncStatus, lastSync: string) => void;
const statusListeners: Set<StatusListener> = new Set();

export function subscribeToDB(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function subscribeToSyncStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(currentSyncStatus, lastSyncTimestamp);
  return () => statusListeners.delete(listener);
}

function updateSyncStatus(status: CloudSyncStatus) {
  currentSyncStatus = status;
  lastSyncTimestamp = new Date().toISOString();
  statusListeners.forEach(cb => {
    try {
      cb(currentSyncStatus, lastSyncTimestamp);
    } catch (e) {
      console.error("Error in status listener:", e);
    }
  });
}

export function notifyListeners(): void {
  listeners.forEach(cb => {
    try {
      cb();
    } catch (e) {
      console.error("Error in DB listener:", e);
    }
  });
}

function loadLocalCache(): DatabaseSchema {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.CONTI && parsed.MOVIMENTI && parsed.SOTTOCATEGORIE) {
          // Se la cache locale ha pochi movimenti (< 10), integra i movimenti storici di esempio
          if (parsed.MOVIMENTI.length < 10) {
            const existingIds = new Set(parsed.MOVIMENTI.map((m: any) => m.id));
            INITIAL_DATABASE.MOVIMENTI.forEach(m => {
              if (!existingIds.has(m.id)) {
                parsed.MOVIMENTI.push(m);
              }
            });
          }
          if (!parsed.SCADENZE || parsed.SCADENZE.length === 0) {
            parsed.SCADENZE = INITIAL_DATABASE.SCADENZE;
          }
          // Idrata sottocategorie mancanti (es. finanziamenti, prestiti e ristrutturazione)
          INITIAL_DATABASE.SOTTOCATEGORIE.forEach((sub: any) => {
            if (!parsed.SOTTOCATEGORIE.some((s: any) => s.id === sub.id)) {
              parsed.SOTTOCATEGORIE.push(sub);
            }
          });
          // Assicura classificazione per tutte le sottocategorie (GUADAGNI, SPESE_ESSENZIALI, SPESE_EXTRA)
          parsed.SOTTOCATEGORIE.forEach((sub: any) => {
            if (!sub.classificazione) {
              sub.classificazione = getSubcategoryClassification(sub);
            }
          });
          // Assicura array progetti e rimuove eventuali residui fittizi
          if (!parsed.PROGETTI) {
            parsed.PROGETTI = [];
          } else {
            // Rimuove vecchi mock di test se ancora presenti
            const mockProjectIds = new Set(['pro-mutuo-001', 'pro-auto-002', 'pro-ristruttura-003']);
            parsed.PROGETTI = parsed.PROGETTI.filter((p: any) => !mockProjectIds.has(p.id));
          }
          if (!parsed.PROGETTI_MOVIMENTI) {
            parsed.PROGETTI_MOVIMENTI = [];
          }
          // Rimuove eventuali movimenti mock legati ai vecchi progetti di test
          const mockMovIds = new Set(['mov-mutuo-curr', 'mov-auto-curr', 'mov-ristruttura-curr']);
          parsed.MOVIMENTI = (parsed.MOVIMENTI || []).filter((m: any) => !mockMovIds.has(m.id));
          // Se nessun movimento ha tag, semina i movimenti con tag "Vacanza a Napoli"
          const hasAnyTags = parsed.MOVIMENTI.some((m: any) => m.tag || (m.tags && m.tags.length > 0));
          if (!hasAnyTags) {
            const existingIds = new Set(parsed.MOVIMENTI.map((m: any) => m.id));
            INITIAL_DATABASE.MOVIMENTI.filter(m => m.tag).forEach(m => {
              if (!existingIds.has(m.id)) {
                parsed.MOVIMENTI.unshift(m);
              } else {
                const target = parsed.MOVIMENTI.find((x: any) => x.id === m.id);
                if (target) {
                  target.tag = m.tag;
                  target.tags = m.tags;
                }
              }
            });
          }
          if (!parsed.MODELLI || parsed.MODELLI.length === 0) {
            parsed.MODELLI = INITIAL_DATABASE.MODELLI;
          }
          if (parsed.NOTE === undefined || parsed.NOTE === null) {
            parsed.NOTE = INITIAL_DATABASE.NOTE || [];
          }
          if (parsed.TAGS === undefined || parsed.TAGS === null) {
            parsed.TAGS = INITIAL_DATABASE.TAGS;
          }
          if (!parsed.REPORT_SETTIMANALI) {
            parsed.REPORT_SETTIMANALI = [];
          }
          if (!parsed.IMPOSTAZIONI) {
            parsed.IMPOSTAZIONI = INITIAL_DATABASE.IMPOSTAZIONI;
          } else {
            parsed.IMPOSTAZIONI = {
              ...INITIAL_DATABASE.IMPOSTAZIONI,
              ...parsed.IMPOSTAZIONI
            };
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Impossibile leggere la cache locale:", e);
    }
  }
  return JSON.parse(JSON.stringify(INITIAL_DATABASE));
}

// Helper ricorsivo per sanificare qualsiasi oggetto o array prima del salvataggio su Firestore.
// Rimuove chiavi con valore `undefined` e converte elementi array `undefined` in `null`.
export function cleanDataForFirestore<T>(input: T): T {
  if (input === undefined) {
    return null as any;
  }
  if (input === null || typeof input !== 'object') {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map(item => (item === undefined ? null : cleanDataForFirestore(item))) as any;
  }
  const output: Record<string, any> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      output[key] = cleanDataForFirestore(value);
    }
  }
  return output as T;
}

// Inizializzazione Sincronizzazione Real-Time con Firebase Firestore
let isFirestoreInitialized = false;
let isWritingToFirestore = false;

export function initFirestore(): void {
  if (isFirestoreInitialized || typeof window === 'undefined') return;
  isFirestoreInitialized = true;

  try {
    const docRef = doc(db, FIRESTORE_DOC_PATH[0], FIRESTORE_DOC_PATH[1]);

    // Listener real-time Firestore
    onSnapshot(
      docRef,
      (snapshot) => {
        if (isWritingToFirestore) {
          return;
        }

        if (snapshot.exists()) {
          const cloudData = snapshot.data() as DatabaseSchema;
          if (cloudData && cloudData.CONTI && cloudData.MOVIMENTI) {
            if (!cloudData.TAGS) {
              cloudData.TAGS = INITIAL_DATABASE.TAGS || [];
            }
            if (!cloudData.REPORT_SETTIMANALI) {
              cloudData.REPORT_SETTIMANALI = [];
            }
            if (!cloudData.PROGETTI) {
              cloudData.PROGETTI = [];
            } else {
              const mockProjectIds = new Set(['pro-mutuo-001', 'pro-auto-002', 'pro-ristruttura-003']);
              cloudData.PROGETTI = cloudData.PROGETTI.filter((p: any) => !mockProjectIds.has(p.id));
            }
            if (!cloudData.PROGETTI_MOVIMENTI) {
              cloudData.PROGETTI_MOVIMENTI = [];
            }
            if (!cloudData.NOTE) {
              cloudData.NOTE = [];
            }
            if (cloudData.SOTTOCATEGORIE) {
              cloudData.SOTTOCATEGORIE.forEach((sub: any) => {
                if (!sub.classificazione) {
                  sub.classificazione = getSubcategoryClassification(sub);
                }
              });
            }
            const mockMovIds = new Set(['mov-mutuo-curr', 'mov-auto-curr', 'mov-ristruttura-curr']);
            cloudData.MOVIMENTI = (cloudData.MOVIMENTI || []).filter((m: any) => !mockMovIds.has(m.id));
            DB = cloudData;
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
            } catch (e) {
              console.error(e);
            }
            updateSyncStatus('CONNECTED');
            notifyListeners();
          }
        } else {
          // Documento non ancora esistente nel cloud: carichiamo i dati iniziali su Firestore
          console.log("Inizializzazione archivio principale su Firestore...");
          const sanitizedPayload = cleanDataForFirestore(DB);
          setDoc(docRef, sanitizedPayload)
            .then(() => {
              updateSyncStatus('CONNECTED');
              notifyListeners();
            })
            .catch((err) => {
              console.error("Errore salvataggio iniziale su Firestore:", err);
              updateSyncStatus('ERROR');
            });
        }
      },
      (error) => {
        console.error("Firestore onSnapshot error:", error);
        updateSyncStatus('OFFLINE');
      }
    );
  } catch (err) {
    console.error("Failed to initialize Firestore connection:", err);
    updateSyncStatus('ERROR');
  }
}

// Persistenza atomica: aggiorna memoria, local cache e scrive su Firestore
export async function persistDB(): Promise<void> {
  DB.metadata.last_synced = new Date().toISOString();
  DB.metadata.total_records = 
    DB.CONTI.length + 
    DB.FONDI.length + 
    DB.MOVIMENTI.length + 
    DB.PIANIFICATI.length + 
    DB.BUDGET.length + 
    DB.SCADENZE.length +
    (DB.MODELLI || []).length +
    DB.PROGETTI.length +
    (DB.TAGS || []).length +
    (DB.NOTE || []).length;

  // 1. Aggiorna cache locale immediata
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
    } catch (e) {
      console.error("Errore nel salvataggio cache:", e);
    }
  }

  // Notifica subito i componenti per aggiornamento reattivo istantaneo
  notifyListeners();

  // 2. Scrive asincronamente su Firebase Firestore
  try {
    updateSyncStatus('SYNCING');
    isWritingToFirestore = true;
    const docRef = doc(db, FIRESTORE_DOC_PATH[0], FIRESTORE_DOC_PATH[1]);
    const sanitizedPayload = cleanDataForFirestore(DB);
    await setDoc(docRef, sanitizedPayload);
    updateSyncStatus('CONNECTED');
  } catch (err) {
    console.error("Errore di sincronizzazione con Firestore:", err);
    updateSyncStatus('OFFLINE');
  } finally {
    setTimeout(() => {
      isWritingToFirestore = false;
    }, 400);
  }
}

// Reset al database iniziale
export async function resetToInitialDatabase(): Promise<void> {
  DB = JSON.parse(JSON.stringify(INITIAL_DATABASE));
  await persistDB();
}

// Esportazione JSON completa per Backup (Punto 12)
export function exportDatabaseJSON(): string {
  const exportData = {
    metadata: {
      ...DB.metadata,
      export_date: new Date().toISOString(),
      app_name: "Finanze Familiari",
      version: "1.0.0"
    },
    payload: DB
  };
  return JSON.stringify(exportData, null, 2);
}

// Ripristino da file JSON con verifica di coerenza
export async function importDatabaseJSON(jsonString: string): Promise<{ success: boolean; message: string; counts?: Record<string, number> }> {
  try {
    const parsed = JSON.parse(jsonString);
    const dataToImport = parsed.payload || parsed;

    if (!dataToImport.CONTI || !dataToImport.MOVIMENTI || !dataToImport.SOTTOCATEGORIE) {
      return { success: false, message: "Struttura file non valida o tabelle essenziali mancanti." };
    }

    DB = dataToImport;
    await persistDB();

    const counts = {
      Conti: DB.CONTI.length,
      Fondi: (DB.FONDI || []).length,
      Sottocategorie: DB.SOTTOCATEGORIE.length,
      Movimenti: DB.MOVIMENTI.length,
      Pianificati: (DB.PIANIFICATI || []).length,
      Budget: (DB.BUDGET || []).length,
      Scadenze: (DB.SCADENZE || []).length,
      Progetti: (DB.PROGETTI || []).length,
      Note: (DB.NOTE || []).length
    };

    return {
      success: true,
      message: "Database ripristinato e sincronizzato con Firestore con successo.",
      counts
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Errore durante il parsing del JSON."
    };
  }
}
