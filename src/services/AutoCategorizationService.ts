import { Subcategory, Account, MovementNecessity } from '../types';

export interface AutoRule {
  id: string;
  pattern: string; // parola chiave es: "esselunga", "telepass", "enel", "netflix", "farmacia"
  sottocategoria_id: string;
  conto_id?: string;
  necessita?: MovementNecessity;
  membro_famiglia?: string;
  created_at: string;
}

const STORAGE_KEY = 'finanze_auto_categorization_rules_v1';

// Regole base predefinite per il mercato e le abitudini italiane
const DEFAULT_PATTERNS: Array<{ pattern: string; keywords: string[]; categoryMatch: string[]; necessita: MovementNecessity }> = [
  {
    pattern: 'Supermercato / Alimentari',
    keywords: ['esselunga', 'coop', 'conad', 'lidl', 'eurospin', 'carrefour', 'pam', 'aldi', 'tigros', 'ipercoop', 'despar', 'md', 'unes', 'craai', 'penny market'],
    categoryMatch: ['alimentar', 'spesa', 'supermercat'],
    necessita: 'HO_BISOGNO'
  },
  {
    pattern: 'Utenze & Bollette',
    keywords: ['enel', 'eni', 'plenitude', 'a2a', 'heracomm', 'iren', 'edison', 'acea', 'servizio elettrico', 'acque', 'acquedotto', 'gas', 'luce'],
    categoryMatch: ['utenze', 'bollett', 'luce', 'gas', 'acqua'],
    necessita: 'DEVO'
  },
  {
    pattern: 'Telefonia & Internet',
    keywords: ['tim', 'vodafone', 'windtre', 'iliad', 'fastweb', 'ho mobile', 'kena', 'very mobile', 'sky wifi', 'eolo'],
    categoryMatch: ['telefonia', 'internet', 'cellulare', 'utenze'],
    necessita: 'DEVO'
  },
  {
    pattern: 'Carburante & Trasporti',
    keywords: ['eni station', 'q8', 'ip ', 'tamoil', 'esso', 'autostrade', 'telepass', 'trenitalia', 'italo', 'atm', 'atac', 'gtt', 'unipolmove'],
    categoryMatch: ['carburant', 'benzina', 'trasport', 'auto', 'pedaggi'],
    necessita: 'HO_BISOGNO'
  },
  {
    pattern: 'Farmacia & Salute',
    keywords: ['farmacia', 'parafarmacia', 'dottore', 'visita medica', 'analisi cliniche', 'synlab', 'dentista', 'odontoiatr', 'ottico'],
    categoryMatch: ['salute', 'farmaci', 'medic'],
    necessita: 'HO_BISOGNO'
  },
  {
    pattern: 'Abbonamenti & Streaming',
    keywords: ['netflix', 'spotify', 'prime video', 'disney+', 'dazn', 'apple.com/bill', 'youtube premium', 'playstation', 'xbox'],
    categoryMatch: ['abbonament', 'streaming', 'svago', 'intrattenimento'],
    necessita: 'VOGLIO'
  },
  {
    pattern: 'Ristoranti & Asporto',
    keywords: ['ristorante', 'pizzeria', 'trattoria', 'osteri', 'just eat', 'deliveroo', 'glovo', 'uber eats', 'mcdonald', 'burger king', 'bar ', 'caffetteria'],
    categoryMatch: ['ristorant', 'svago', 'uscite', 'fuori casa', 'bar'],
    necessita: 'VOGLIO'
  },
  {
    pattern: 'Stipendio / Reddito',
    keywords: ['stipendio', 'emolumenti', 'retribuzione', 'bonifico datore', 'accredito stipendio', 'pensione'],
    categoryMatch: ['stipendio', 'reddito', 'lavoro', 'guadagn'],
    necessita: 'DEVO'
  }
];

export class AutoCategorizationService {
  static getCustomRules(): AutoRule[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Errore lettura regole auto-categorizzazione:', e);
      return [];
    }
  }

  static saveCustomRules(rules: AutoRule[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    } catch (e) {
      console.warn('Errore salvataggio regole auto-categorizzazione:', e);
    }
  }

  static addOrUpdateRule(pattern: string, sottocategoriaId: string, contoId?: string, membroFamiglia?: string, necessita?: MovementNecessity): void {
    if (!pattern || !sottocategoriaId) return;
    const cleanPattern = pattern.trim().toLowerCase();
    if (cleanPattern.length < 3) return;

    const existing = this.getCustomRules();
    const filtered = existing.filter(r => r.pattern.toLowerCase() !== cleanPattern);

    const newRule: AutoRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      pattern: cleanPattern,
      sottocategoria_id: sottocategoriaId,
      conto_id: contoId,
      membro_famiglia: membroFamiglia,
      necessita: necessita,
      created_at: new Date().toISOString()
    };

    this.saveCustomRules([newRule, ...filtered].slice(0, 100));
  }

  /**
   * Cerca la migliore sottocategoria corrispondente alla descrizione del movimento
   */
  static match(
    description: string,
    subcategories: Subcategory[],
    accounts: Account[] = []
  ): {
    subcategoryId?: string;
    accountId?: string;
    necessita?: MovementNecessity;
    membroFamiglia?: string;
    matchedPattern?: string;
    confidence: 'ALTA' | 'MEDIA' | 'NESSUNA';
  } {
    if (!description || description.trim().length === 0) {
      return { confidence: 'NESSUNA' };
    }

    const descLower = description.toLowerCase().trim();

    // 1. Cerca prima tra le regole personalizzate dell'utente (priorità massima)
    const customRules = this.getCustomRules();
    for (const rule of customRules) {
      if (descLower.includes(rule.pattern.toLowerCase())) {
        const targetSub = subcategories.find(s => s.id === rule.sottocategoria_id);
        if (targetSub) {
          return {
            subcategoryId: targetSub.id,
            accountId: rule.conto_id,
            necessita: rule.necessita || targetSub.necessita,
            membroFamiglia: rule.membro_famiglia,
            matchedPattern: rule.pattern,
            confidence: 'ALTA'
          };
        }
      }
    }

    // 2. Cerca tra i pattern predefiniti intelligenti
    for (const def of DEFAULT_PATTERNS) {
      const keywordHit = def.keywords.some(kw => descLower.includes(kw));
      if (keywordHit) {
        // Trova la sottocategoria più vicina tra quelle dell'utente
        const matchedSub = subcategories.find(s => {
          const subName = (s.nome || '').toLowerCase();
          const parentName = (s.categoria_padre || '').toLowerCase();
          return def.categoryMatch.some(m => subName.includes(m) || parentName.includes(m));
        });

        if (matchedSub) {
          return {
            subcategoryId: matchedSub.id,
            necessita: def.necessita,
            matchedPattern: def.pattern,
            confidence: 'ALTA'
          };
        }
      }
    }

    // 3. Fallback: corrispondenza diretta col nome delle sottocategorie esistenti
    for (const sub of subcategories) {
      const subName = (sub.nome || '').toLowerCase();
      if (subName.length >= 4 && descLower.includes(subName)) {
        return {
          subcategoryId: sub.id,
          necessita: sub.necessita,
          matchedPattern: sub.nome,
          confidence: 'MEDIA'
        };
      }
    }

    return { confidence: 'NESSUNA' };
  }
}
