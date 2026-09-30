import { Movement, Account, Subcategory, Budget } from '../types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  source?: 'GEMINI_AI' | 'LOCAL_ENGINE' | 'LOCAL_FALLBACK';
}

export class GeminiChatService {
  /**
   * Prepara il digest contestuale per il chatbot basato sui dati reali dell'applicazione
   */
  public static buildContextData(
    movements: Movement[],
    accounts: Account[],
    subcategories: Subcategory[],
    budgets: Budget[] = []
  ) {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const currentMonthMovements = movements.filter(m => m.data.startsWith(currentMonth));

    let entrate = 0;
    let uscite = 0;
    let devo = 0;
    let ho_bisogno = 0;
    let voglio = 0;

    const subMap: Record<string, { nome: string; importo: number; necessita: string }> = {};

    currentMonthMovements.forEach(m => {
      if (m.tipologia === 'ENTRATA') {
        entrate += m.importo;
      } else if (m.tipologia === 'USCITA') {
        uscite += m.importo;
        const sub = subcategories.find(s => s.id === m.sottocategoria_id);
        const subNome = sub?.nome || 'Altro';
        const nec = m.necessita || sub?.necessita || 'DEVO';
        const tipoSpesaDesc = (nec === 'DEVO' || nec === 'BISOGNO') 
          ? 'spesa fissa e inderogabile' 
          : (nec === 'HO_BISOGNO' ? 'necessità quotidiana primaria' : 'spesa discrezionale o svago');

        if (nec === 'DEVO' || nec === 'BISOGNO') devo += m.importo;
        else if (nec === 'HO_BISOGNO') ho_bisogno += m.importo;
        else voglio += m.importo;

        if (!subMap[m.sottocategoria_id]) {
          subMap[m.sottocategoria_id] = { nome: subNome, importo: 0, necessita: tipoSpesaDesc };
        }
        subMap[m.sottocategoria_id].importo += m.importo;
      }
    });

    const topSpese = Object.values(subMap)
      .sort((a, b) => b.importo - a.importo)
      .slice(0, 10);

    const budgetStatus = budgets.map(b => {
      const sub = subcategories.find(s => s.id === b.sottocategoria_id);
      const speso = subMap[b.sottocategoria_id]?.importo || 0;
      return {
        sottocategoria: sub?.nome || 'Generale',
        importo: b.importo_budget,
        speso,
        sforato: speso > b.importo_budget
      };
    });

    const conti = accounts.map(a => ({
      nome: a.nome_conto,
      tipo: a.tipo_conto,
      saldo: a.saldo_reale
    }));

    const movimentiRecenti = movements.slice(0, 10).map(m => ({
      data: m.data,
      descrizione: m.descrizione,
      importo: m.importo,
      tipo: m.tipologia
    }));

    return {
      meseRiferimento: currentMonth,
      entrate: Math.round(entrate * 100) / 100,
      uscite: Math.round(uscite * 100) / 100,
      saldoNetto: Math.round((entrate - uscite) * 100) / 100,
      ripartizione503020: {
        devo: Math.round(devo * 100) / 100,
        ho_bisogno: Math.round(ho_bisogno * 100) / 100,
        voglio: Math.round(voglio * 100) / 100
      },
      topSpese,
      budget: budgetStatus,
      conti,
      movimentiRecenti
    };
  }

  /**
   * Invia la cronologia della conversazione all'assistente AI
   */
  public static async sendMessage(
    messages: { role: 'user' | 'assistant'; content: string }[],
    contextData: any
  ): Promise<{ reply: string; source: 'GEMINI_AI' | 'LOCAL_ENGINE' | 'LOCAL_FALLBACK' }> {
    try {
      const response = await fetch('/api/gemini-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, contextData })
      });

      if (!response.ok) {
        throw new Error(`Errore server: ${response.status}`);
      }

      const data = await response.json();
      return {
        reply: data.reply || 'Nessuna risposta disponibile al momento.',
        source: data.source || 'LOCAL_ENGINE'
      };
    } catch (err: any) {
      console.warn("Fallback client-side per Gemini Chat:", err);
      // Fallback rapido locale
      return {
        reply: `📊 **Riepilogo rapido Finanze Familiari**:
- **Entrate del mese**: ${contextData.entrate || 0} €
- **Uscite del mese**: ${contextData.uscite || 0} €
- **Saldo netto**: ${contextData.saldoNetto || 0} €

I tuoi dati sono protetti e sincronizzati su Firestore.`,
        source: 'LOCAL_FALLBACK'
      };
    }
  }
}
