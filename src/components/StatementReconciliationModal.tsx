import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Check,
  Calendar,
  Building2,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  Plus,
  Search,
  FileSpreadsheet,
  X,
  ChevronDown,
  Info,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  Zap,
  Loader2,
  ArrowLeftRight,
  CreditCard
} from 'lucide-react';
import { Account, Fund, Subcategory, Movement, MovementType } from '../types';
import {
  parseBankStatement,
  getDemoBankStatement,
  getDemoCreditCardStatement,
  StatementParseResult,
  ParsedStatementRow
} from '../utils/statementParser';
import {
  ReconciliationService,
  ReconciliationItem,
  StatementReconciliationReport
} from '../services/ReconciliationService';
import { CategoryService } from '../services/CategoryService';
import { formatCurrency, formatDateIT } from '../utils/formatters';

const loadPdfJs = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
      resolve(pdfjsLib);
    };
    script.onerror = (err) => {
      reject(new Error('Impossibile caricare il modulo di decodifica PDF. Verifica la tua connessione internet.'));
    };
    document.head.appendChild(script);
  });
};

const extractTextFromPdf = async (file: File): Promise<string> => {
  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];

    // Raggruppa gli elementi per coordinata verticale (transform[5] è la coordinata Y)
    // Usiamo una tolleranza di 4 pixel per compensare lievi fluttuazioni di posizionamento
    const linesMap: { [key: number]: any[] } = {};
    items.forEach(item => {
      if (!item.str || item.str.trim() === '') return;
      const y = Math.round(item.transform[5]);
      let foundY = Object.keys(linesMap).map(Number).find(existingY => Math.abs(existingY - y) < 4);
      if (foundY !== undefined) {
        linesMap[foundY].push(item);
      } else {
        linesMap[y] = [item];
      }
    });

    // Ordina le coordinate Y in ordine decrescente (la parte superiore della pagina ha coordinate Y più elevate)
    const sortedY = Object.keys(linesMap).map(Number).sort((a, b) => b - a);

    const pageLines = sortedY.map(y => {
      // Ordina gli elementi sulla stessa riga per coordinata X (transform[4])
      const lineItems = linesMap[y].sort((a, b) => a.transform[4] - b.transform[4]);
      return lineItems.map(item => item.str).join(' ');
    });

    fullText += pageLines.join('\n') + '\n';
  }
  
  return fullText;
};

interface StatementReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  funds: Fund[];
  subcategories: Subcategory[];
  onSuccess: () => void;
  initialAccountId?: string;
}

export const StatementReconciliationModal: React.FC<StatementReconciliationModalProps> = ({
  isOpen,
  onClose,
  accounts,
  funds,
  subcategories,
  onSuccess,
  initialAccountId
}) => {
  // Seleziona il conto attivo di default (o conto principale o primo disponibile)
  const defaultAccId = initialAccountId || accounts.find(a => a.conto_principale)?.id || accounts[0]?.id || funds[0]?.id || '';
  const [selectedAccountId, setSelectedAccountId] = useState<string>(defaultAccId);

  // Modalità inserimento: File upload vs Testo incollato
  const [inputMode, setInputMode] = useState<'FILE' | 'TEXT'>('FILE');
  const [rawText, setRawText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tolleranza data configurabile (es. la data potrebbe variare)
  const [dateToleranceDays, setDateToleranceDays] = useState<number>(30);

  // Risultato del parsing e report di analisi
  const [parseResult, setParseResult] = useState<StatementParseResult | null>(null);
  const [reconciliationReport, setReconciliationReport] = useState<StatementReconciliationReport | null>(null);

  // Stato elementi modificabili durante la revisione (sottocategorie scelte, selezione per registrazione)
  const [itemsState, setItemsState] = useState<Record<string, {
    selectedSubcategoryId: string;
    selectedForImport: boolean;
    selectedOriginAccountId?: string;
    selectedDestinationAccountId?: string;
  }>>({});

  const [activeDestPickerItemId, setActiveDestPickerItemId] = useState<string | null>(null);
  const [activeTransferConfigItemId, setActiveTransferConfigItemId] = useState<string | null>(null);

  // Gestione sottocategorie con aggiornamento locale dinamico
  const [localSubcategories, setLocalSubcategories] = useState<Subcategory[]>(subcategories);

  useEffect(() => {
    setLocalSubcategories(subcategories);
  }, [subcategories]);

  // Raggruppamento ed ordinamento alfabetico per Categoria Padre
  const groupedSubcategories = useMemo(() => {
    const groups: Record<string, Subcategory[]> = {};
    for (const sub of localSubcategories) {
      if (sub.attiva === false) continue;
      const parent = sub.categoria_padre?.trim() || 'Altro';
      if (!groups[parent]) groups[parent] = [];
      groups[parent].push(sub);
    }

    const sortedParents = Object.keys(groups).sort((a, b) => a.localeCompare(b));
    return sortedParents.map(parent => ({
      parent,
      items: groups[parent].sort((a, b) => a.nome.localeCompare(b.nome))
    }));
  }, [localSubcategories]);

  // Stato popover ricerca sottocategoria
  const [activeSubPickerItemId, setActiveSubPickerItemId] = useState<string | null>(null);
  const [subPickerSearchQuery, setSubPickerSearchQuery] = useState<string>('');

  // Modale per creazione rapida di una nuova sottocategoria direttamente dalla riconciliazione
  const [isQuickSubModalOpen, setIsQuickSubModalOpen] = useState<boolean>(false);
  const [quickSubTargetItemId, setQuickSubTargetItemId] = useState<string | null>(null);
  const [quickSubName, setQuickSubName] = useState<string>('');
  const [quickSubParent, setQuickSubParent] = useState<string>('Altro');
  const [quickSubTipo, setQuickSubTipo] = useState<MovementType>('USCITA');
  const [isCreatingSub, setIsCreatingSub] = useState<boolean>(false);

  const handleOpenQuickCreateSub = (itemId: string, defaultName?: string, defaultTipo?: MovementType) => {
    setQuickSubTargetItemId(itemId);
    setQuickSubName(defaultName || '');
    setQuickSubParent('Altro');
    setQuickSubTipo(defaultTipo || 'USCITA');
    setIsQuickSubModalOpen(true);
  };

  const handleSaveQuickSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSubName.trim() || isCreatingSub) return;

    try {
      setIsCreatingSub(true);
      const created = await CategoryService.createSubcategory({
        nome: quickSubName.trim(),
        categoria_padre: quickSubParent.trim() || (quickSubTipo === 'ENTRATA' ? 'Entrate Varie' : 'Spese Varie'),
        tipo: quickSubTipo
      });

      // Aggiungi alla lista locale
      setLocalSubcategories(prev => [...prev, created]);

      // Se c'è un item target, assegna subito la nuova sottocategoria
      if (quickSubTargetItemId) {
        setItemsState(prev => ({
          ...prev,
          [quickSubTargetItemId]: {
            ...prev[quickSubTargetItemId],
            selectedSubcategoryId: created.id
          }
        }));
      }

      setIsQuickSubModalOpen(false);
      setQuickSubName('');
      setQuickSubParent('');
      setActiveSubPickerItemId(null);

      // Notifica l'app globale per ricaricare le sottocategorie
      onSuccess();
    } catch (err: any) {
      console.error('Errore creazione sottocategoria rapida:', err);
      alert(err?.message || 'Impossibile creare la sottocategoria.');
    } finally {
      setIsCreatingSub(false);
    }
  };

  const isTransferSub = (subId: string) => {
    const sub = localSubcategories.find(s => s.id === subId);
    if (!sub) return false;
    return sub.tipo === 'GIROCONTO' || 
           sub.categoria_padre?.toLowerCase().includes('trasferiment') || 
           sub.nome?.toLowerCase().includes('giroconto') ||
           sub.nome?.toLowerCase().includes('trasferimento');
  };

  const handleConvertToTransfer = (itemId: string) => {
    const transferSub = subcategories.find(s => 
      s.tipo === 'GIROCONTO' || 
      s.categoria_padre?.toLowerCase().includes('trasferiment') || 
      s.nome?.toLowerCase().includes('giroconto') ||
      s.nome?.toLowerCase().includes('trasferimento')
    ) || subcategories[0];

    setItemsState(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        selectedSubcategoryId: transferSub?.id || prev[itemId].selectedSubcategoryId,
        selectedOriginAccountId: prev[itemId].selectedOriginAccountId || selectedAccountId
      }
    }));
    setActiveTransferConfigItemId(itemId);
  };

  // Filtro schede report: 'MANCANTI' (default!), 'TUTTE', 'RICONCILIATE', 'SOLO_APP'
  const [activeTab, setActiveTab] = useState<'MANCANTI' | 'TUTTE' | 'RICONCILIATE' | 'SOLO_APP'>('MANCANTI');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Stato operazione di salvataggio
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Stato caricamento ed elaborazione file (per file grandi o Excel)
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [parsingStatus, setParsingStatus] = useState<string>('');

  // Barra di avanzamento per trasferimento automatico movimenti
  const [transferProgress, setTransferProgress] = useState<{
    isOpen: boolean;
    current: number;
    total: number;
    percentage: number;
    createdCount: number;
    confirmedPlannedCount: number;
    isFinished?: boolean;
  } | null>(null);

  // Lista unificata di conti e fondi attivi
  const allAccountsAndFunds = useMemo(() => {
    return [
      ...accounts.filter(a => a.attivo).map(a => ({ id: a.id, nome: a.nome_conto, tipo: 'CONTO' as const, saldo: a.saldo_reale })),
      ...funds.filter(f => f.attivo).map(f => ({ id: f.id, nome: f.nome_fondo, tipo: 'FONDO' as const, saldo: f.saldo_reale }))
    ];
  }, [accounts, funds]);

  // Esegue l'analisi di riconciliazione quando cambiano i dati o la tolleranza
  const runAnalysis = (rows: ParsedStatementRow[], accId: string, tolDays: number) => {
    if (rows.length === 0 || !accId) {
      setReconciliationReport(null);
      return;
    }

    const report = ReconciliationService.analyzeStatement({
      accountId: accId,
      statementRows: rows,
      dateToleranceDays: tolDays,
      subcategories
    });

    // Inizializza lo stato degli elementi (sottocategoria e checkbox)
    const initialMap: Record<string, { selectedSubcategoryId: string; selectedForImport: boolean; selectedDestinationAccountId?: string }> = {};
    for (const it of report.items) {
      const defaultDest = allAccountsAndFunds.find(a => a.id !== accId)?.id || allAccountsAndFunds[0]?.id || '';
      initialMap[it.id] = {
        selectedSubcategoryId: it.suggestedSubcategoryId,
        selectedForImport: it.matchStatus === 'MISSING_IN_APP' || it.matchStatus === 'MATCHED_PLANNED',
        selectedDestinationAccountId: defaultDest
      };
    }
    setItemsState(initialMap);
    setReconciliationReport(report);
    setFeedbackMessage(null);
  };

  // Elaborazione unificata file (CSV, TXT, Excel .xlsx / .xls) con feedback
  const processFile = async (file: File) => {
    setFileName(file.name);
    setIsParsingFile(true);
    setParsingStatus(`Lettura del file "${file.name}" in corso...`);
    setFeedbackMessage(null);

    // Diamo respiro al thread per aggiornare l'UI prima del parsing
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const lowerName = file.name.toLowerCase();
      const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls');
      const isPdf = lowerName.endsWith('.pdf');

      if (isPdf) {
        setParsingStatus('Caricamento decodificatore PDF e analisi testi...');
        const extractedText = await extractTextFromPdf(file);
        setRawText(extractedText);

        setParsingStatus('Analisi e riconciliazione automatica con il conto...');
        await new Promise(resolve => setTimeout(resolve, 50));
        const parsed = parseBankStatement(extractedText);
        setParseResult(parsed);
        runAnalysis(parsed.rows, selectedAccountId, dateToleranceDays);
      } else if (isExcel) {
        setParsingStatus('Decodifica del foglio di calcolo Excel...');
        const buffer = await file.arrayBuffer();
        let workbook;
        try {
          workbook = XLSX.read(buffer, { type: 'array', cellDates: false, raw: true });
        } catch (readErr: any) {
          throw new Error(`Errore lettura file Excel (${readErr?.message || 'formato non supportato'}). Suggerimento: salva il file in formato CSV (.csv) ed effettua l'upload.`);
        }
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error('Il file Excel non contiene fogli di lavoro validi.');
        }
        const worksheet = workbook.Sheets[firstSheetName];
        setParsingStatus('Conversione dati movimenti da Excel...');
        let csv = '';
        try {
          csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });
        } catch (csvErr: any) {
          throw new Error(`Impossibile convertire il foglio Excel in CSV: ${csvErr?.message || 'dati non validi'}. Prova a salvare il file come CSV.`);
        }
        setRawText(csv);

        setParsingStatus('Analisi e riconciliazione automatica con il conto...');
        await new Promise(resolve => setTimeout(resolve, 50));
        const parsed = parseBankStatement(csv);
        setParseResult(parsed);
        runAnalysis(parsed.rows, selectedAccountId, dateToleranceDays);
      } else {
        setParsingStatus('Analisi e riconciliazione righe estratto conto...');
        const content = await file.text();
        setRawText(content);
        await new Promise(resolve => setTimeout(resolve, 50));
        const parsed = parseBankStatement(content);
        setParseResult(parsed);
        runAnalysis(parsed.rows, selectedAccountId, dateToleranceDays);
      }
    } catch (err: any) {
      console.error('Errore durante elaborazione file estratto conto:', err);
      const errMessage = err?.message?.includes('Invalid time value') 
        ? 'Il file Excel contiene formati di data o celle non validi. Ti consigliamo di salvarlo come file CSV (.csv) e riprovare.' 
        : (err?.message || 'Formato file o contenuto non valido.');
      setFeedbackMessage({
        type: 'error',
        text: `Impossibile analizzare il file: ${errMessage}`
      });
    } finally {
      setIsParsingFile(false);
      setParsingStatus('');
    }
  };

  // Gestione caricamento file da input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  // Gestione caricamento drag-and-drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processFile(file);
  };

  // Parsing da testo incollato
  const handleParseText = () => {
    if (!rawText.trim()) return;
    setIsParsingFile(true);
    setParsingStatus('Analisi del testo incollato...');
    setTimeout(() => {
      try {
        const parsed = parseBankStatement(rawText);
        setParseResult(parsed);
        runAnalysis(parsed.rows, selectedAccountId, dateToleranceDays);
      } finally {
        setIsParsingFile(false);
        setParsingStatus('');
      }
    }, 50);
  };

  // Carica estratto conto dimostrativo bancario
  const handleLoadDemo = () => {
    const demo = getDemoBankStatement();
    setRawText(demo);
    setFileName('estratto_conto_bancario_demo.csv');
    const parsed = parseBankStatement(demo);
    setParseResult(parsed);
    runAnalysis(parsed.rows, selectedAccountId, dateToleranceDays);
  };

  // Carica estratto conto dimostrativo di Carta di Credito
  const handleLoadCreditCardDemo = () => {
    const demo = getDemoCreditCardStatement();
    setRawText(demo);
    setFileName('estratto_conto_carta_credito_demo.csv');
    const parsed = parseBankStatement(demo);
    setParseResult(parsed);
    runAnalysis(parsed.rows, selectedAccountId, dateToleranceDays);
  };

  // Cambio del conto di riferimento
  const handleAccountChange = (newAccId: string) => {
    setSelectedAccountId(newAccId);
    if (parseResult && parseResult.rows.length > 0) {
      runAnalysis(parseResult.rows, newAccId, dateToleranceDays);
    }
  };

  // Cambio della tolleranza data
  const handleToleranceChange = (newTol: number) => {
    setDateToleranceDays(newTol);
    if (parseResult && parseResult.rows.length > 0) {
      runAnalysis(parseResult.rows, selectedAccountId, newTol);
    }
  };

  // Seleziona / Deseleziona tutti i mancanti
  const handleToggleSelectAllMissing = (select: boolean) => {
    if (!reconciliationReport) return;
    setItemsState(prev => {
      const next = { ...prev };
      for (const item of reconciliationReport.missingItems) {
        if (next[item.id]) {
          next[item.id].selectedForImport = select;
        }
      }
      return next;
    });
  };

  // Registrazione cumulativa o singola delle transazioni mancanti
  const handleRegisterMissing = async (specificItemId?: string) => {
    if (!reconciliationReport || !selectedAccountId) return;

    const itemsToProcess = specificItemId
      ? reconciliationReport.items.filter(i => i.id === specificItemId)
      : reconciliationReport.items.filter(i => {
          const state = itemsState[i.id];
          return (i.matchStatus === 'MISSING_IN_APP' || i.matchStatus === 'MATCHED_PLANNED') && state?.selectedForImport;
        });

    if (itemsToProcess.length === 0) {
      setFeedbackMessage({ type: 'error', text: 'Nessuna transazione mancante selezionata per la registrazione.' });
      return;
    }

    setIsSaving(true);
    const totalItems = itemsToProcess.length;

    // Avvia la barra di avanzamento a schermo intero
    setTransferProgress({
      isOpen: true,
      current: 0,
      total: totalItems,
      percentage: 0,
      createdCount: 0,
      confirmedPlannedCount: 0,
      isFinished: false
    });

    try {
      const payload = itemsToProcess.map(it => {
        const state = itemsState[it.id];
        return {
          date: it.statementRow.date,
          description: it.statementRow.description,
          amount: it.statementRow.amount,
          type: it.statementRow.type,
          subcategoryId: state?.selectedSubcategoryId || it.suggestedSubcategoryId,
          originAccountId: state?.selectedOriginAccountId,
          destinationAccountId: state?.selectedDestinationAccountId,
          matchedPlannedId: it.matchedPlanned?.id,
          isNonContabilizzato: it.statementRow.isNonContabilizzato,
          note: it.statementRow.isNonContabilizzato
            ? `Considerato già contabilizzato da estratto (${it.statementRow.rawDate || it.statementRow.date} - addebito certo)`
            : `Importato da estratto conto (${it.statementRow.rawDate || it.statementRow.date})`
        };
      });

      const res = await ReconciliationService.registerMissingTransactions({
        accountId: selectedAccountId,
        itemsToRegister: payload,
        onProgress: (info) => {
          setTransferProgress({
            isOpen: true,
            current: info.current,
            total: info.total,
            percentage: info.percentage,
            createdCount: info.createdCount,
            confirmedPlannedCount: info.confirmedPlannedCount,
            isFinished: info.current === info.total
          });
        }
      });

      // Breve pausa per mostrare il 100% completato con successo
      await new Promise(resolve => setTimeout(resolve, 600));

      setFeedbackMessage({
        type: 'success',
        text: `Registrate con successo ${res.createdCount} transazioni mancanti nel conto!${res.confirmedPlannedCount > 0 ? ` (${res.confirmedPlannedCount} pianificate confermate)` : ''}`
      });

      // Ricarica i dati generali dell'app
      onSuccess();

      // Ricalcola subito l'analisi con le nuove transazioni registrate
      if (parseResult) {
        setTimeout(() => {
          runAnalysis(parseResult.rows, selectedAccountId, dateToleranceDays);
        }, 200);
      }
    } catch (err: any) {
      console.error("Errore durante la registrazione dei movimenti mancanti:", err);
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Si è verificato un errore durante la registrazione delle transazioni.'
      });
    } finally {
      setIsSaving(false);
      setTransferProgress(null);
    }
  };

  // Conteggi selezionati
  const selectedMissingCount = useMemo(() => {
    if (!reconciliationReport) return 0;
    return reconciliationReport.missingItems.filter(i => itemsState[i.id]?.selectedForImport).length;
  }, [reconciliationReport, itemsState]);

  // Lista filtrata in base alla tab attiva e alla ricerca
  const filteredItems = useMemo(() => {
    if (!reconciliationReport) return [];
    let list: ReconciliationItem[] = [];

    if (activeTab === 'MANCANTI') {
      list = [...reconciliationReport.missingItems, ...reconciliationReport.matchedPlannedItems];
    } else if (activeTab === 'RICONCILIATE') {
      list = reconciliationReport.matchedItems;
    } else {
      list = reconciliationReport.items;
    }

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      list = list.filter(i =>
        i.statementRow.description.toLowerCase().includes(q) ||
        i.statementRow.amount.toString().includes(q) ||
        i.statementRow.date.includes(q)
      );
    }

    return list;
  }, [reconciliationReport, activeTab, searchFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Intestazione Modale */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 flex items-start justify-between gap-4 bg-slate-50/50 dark:bg-slate-850/40">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50 shadow-xs">
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <span>Riconciliazione Estratto Conto</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                    Analisi Transazioni Mancanti
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Carica l'estratto conto della tua banca: il programma verifica gli importi, tollera le discrepanze di data e isola le transazioni mancanti da registrare.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-2xl hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            title="Chiudi"
          >
            <X size={20} />
          </button>
        </div>

        {/* Barra di Controllo Principale: Selezione Conto e Tolleranza Data */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Selettore Conto da riconciliare */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <Building2 size={13} className="text-indigo-600" />
              <span>Conto o Fondo da Riconciliare</span>
            </label>
            <select
              value={selectedAccountId}
              onChange={e => handleAccountChange(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <optgroup label="Conti Bancari & Carte">
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.nome_conto} {acc.conto_principale ? '★' : ''} ({formatCurrency(acc.saldo_reale)})
                  </option>
                ))}
              </optgroup>
              {funds.length > 0 && (
                <optgroup label="Fondi Risparmio">
                  {funds.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.nome_fondo} ({formatCurrency(f.saldo_reale)})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Tolleranza Data (Scostamento consentito) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock size={13} className="text-amber-500" />
                <span>Tolleranza Scostamento Data</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">La data potrebbe variare</span>
            </label>
            <select
              value={dateToleranceDays}
              onChange={e => handleToleranceChange(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value={0}>Esatta (0 giorni - stessa identica data)</option>
              <option value={3}>± 3 giorni (Tipico POS / Spese fine settimana)</option>
              <option value={7}>± 7 giorni (Consigliato - 1 settimana di tolleranza)</option>
              <option value={15}>± 15 giorni (Bonifici anticipati / Valuta)</option>
              <option value={30}>± 30 giorni (Intero mese contabile)</option>
              <option value={90}>± 90 giorni (Tutto il periodo)</option>
            </select>
          </div>

          {/* Azione rapida Demo */}
          <div className="flex flex-col gap-1.5 justify-end">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Esempi Dimostrativi:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLoadDemo}
                className="flex-1 px-2.5 py-1.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                title="Carica un estratto conto bancario di esempio"
              >
                <Sparkles size={13} className="text-indigo-600 dark:text-indigo-400" />
                <span>Demo Banca</span>
              </button>

              <button
                type="button"
                onClick={handleLoadCreditCardDemo}
                className="flex-1 px-2.5 py-1.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800/80 text-purple-700 dark:text-purple-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                title="Carica un estratto conto di carta di credito con esercenti e preautorizzazioni"
              >
                <CreditCard size={13} className="text-purple-600 dark:text-purple-400" />
                <span>Demo Carta Credito</span>
              </button>
            </div>
          </div>
        </div>

        {/* Feedback Notifica Operazione */}
        {feedbackMessage && (
          <div className={`mx-4 sm:mx-6 mt-3 p-3 rounded-2xl text-xs font-medium flex items-center justify-between gap-2 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}>
            <div className="flex items-center gap-2">
              {feedbackMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{feedbackMessage.text}</span>
            </div>
            <button onClick={() => setFeedbackMessage(null)} className="text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Corpo Principale con Scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Sezione di Caricamento (Visibile sempre o ridotta se già analizzato) */}
          {!reconciliationReport ? (
            <div className="space-y-4">
              {/* Schede Modalità Input */}
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => setInputMode('FILE')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    inputMode === 'FILE'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Upload size={14} />
                  <span>Carica File Estratto Conto (PDF, CSV, TXT, Excel, OFX)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('TEXT')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    inputMode === 'TEXT'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <FileText size={14} />
                  <span>Incolla Testo o Tabella da Home Banking</span>
                </button>
              </div>

              {inputMode === 'FILE' ? (
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all bg-slate-50/50 dark:bg-slate-850/30 hover:bg-indigo-50/30 group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt,.tsv,.xlsx,.xls,.ofx,.qif,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-14 h-14 mx-auto rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-xs">
                    <Upload size={28} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
                     Trascina qui l'estratto conto oppure clicca per selezionare il file
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                    Supporta file PDF (Monte dei Paschi di Siena MPS, ecc.), fogli Excel e file di testo esportati da qualsiasi banca italiana.
                  </p>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <span className="px-2 py-1 rounded-lg bg-red-100/70 dark:bg-red-950/60 text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 border border-rose-300/60 dark:border-rose-800">
                      .PDF (MPS, ecc.)
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-emerald-100/70 dark:bg-emerald-950/60 text-[10px] font-mono font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800">
                      .XLSX / .XLS
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-[10px] font-mono font-medium text-slate-600 dark:text-slate-300">
                      .CSV
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-[10px] font-mono font-medium text-slate-600 dark:text-slate-300">
                      .TXT
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-[10px] font-mono font-medium text-slate-600 dark:text-slate-300">
                      .TSV
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-[10px] font-mono font-medium text-slate-600 dark:text-slate-300">
                      .OFX / .QIF
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    rows={8}
                    value={rawText}
                    onChange={e => setRawText(e.target.value)}
                    placeholder={`Incolla qui le righe del tuo estratto conto copiate dal portale bancario o da Excel.\nEsempio:\n14/09/2026;PAGAMENTO POS CONAD SUPERSTORE;-84,50\n10/09/2026;STIPENDIO AZIENDA SPA;+2150,00`}
                    className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-y"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleParseText}
                      disabled={!rawText.trim()}
                      className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all"
                    >
                      <Sparkles size={14} />
                      <span>Analizza Transazioni Estratto Conto</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* RISULTATI DELL'ANALISI DELL'ESTRATTO CONTO */
            <div className="space-y-5">
              {/* Banner Superiore di Sintesi e Alert per le MANCANTI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Scheda MANCANTI (Priorità Assoluta richiesta dall'utente) */}
                <div
                  onClick={() => setActiveTab('MANCANTI')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    activeTab === 'MANCANTI'
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 ring-2 ring-rose-400/40'
                      : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                      <AlertTriangle size={14} />
                      <span>Mancanti nell'App</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                      {reconciliationReport.missingCount + reconciliationReport.matchedPlannedItems.length}
                    </span>
                  </div>
                  <div className="text-xl font-bold font-numeric text-rose-600 dark:text-rose-400">
                    {formatCurrency(reconciliationReport.missingTotalAmount)}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    Presenti in estratto conto ma non registrate nel programma
                  </p>
                </div>

                {/* Scheda RICONCILIATE / CORRISPONDENTI */}
                <div
                  onClick={() => setActiveTab('RICONCILIATE')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    activeTab === 'RICONCILIATE'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 ring-2 ring-emerald-400/40'
                      : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-emerald-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 size={14} />
                      <span>Già Riconciliate</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                      {reconciliationReport.matchedCount}
                    </span>
                  </div>
                  <div className="text-xl font-bold font-numeric text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(reconciliationReport.matchedTotalAmount)}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    Stesso importo trovato (tolleranza data ±{dateToleranceDays} gg)
                  </p>
                </div>

                {/* Scheda TOTALE ESTRATTO CONTO */}
                <div
                  onClick={() => setActiveTab('TUTTE')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    activeTab === 'TUTTE'
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 ring-2 ring-indigo-400/40'
                      : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-indigo-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                      <FileSpreadsheet size={14} />
                      <span>Totale Estratto</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                      {reconciliationReport.totalStatementCount} mov.
                    </span>
                  </div>
                  <div className="text-xl font-bold font-numeric text-slate-900 dark:text-white">
                    {formatCurrency(reconciliationReport.netStatementAmount, { showSign: true })}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    Entrate: +{formatCurrency(reconciliationReport.totalStatementInflow, { hideSymbol: true })} | Uscite: -{formatCurrency(reconciliationReport.totalStatementOutflow, { hideSymbol: true })}
                  </p>
                </div>

                {/* Scheda SOLO NEL PROGRAMMA */}
                <div
                  onClick={() => setActiveTab('SOLO_APP')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    activeTab === 'SOLO_APP'
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 ring-2 ring-amber-400/40'
                      : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <Clock size={14} />
                      <span>Solo nell'App</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                      {reconciliationReport.onlyInAppMovements.length}
                    </span>
                  </div>
                  <div className="text-xl font-bold font-numeric text-amber-600 dark:text-amber-400">
                    {reconciliationReport.onlyInAppMovements.length} mov.
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    Registrati nel periodo ma non presenti in questo estratto
                  </p>
                </div>
              </div>

              {/* Banner per movimenti in contabilizzazione bancaria considerati già contabilizzati */}
              {reconciliationReport.unbookedCount > 0 && (
                <div className="p-3.5 bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                      <Zap size={15} />
                    </div>
                    <div>
                      <span className="font-bold">
                        {reconciliationReport.unbookedCount} {reconciliationReport.unbookedCount === 1 ? 'voce in contabilizzazione bancaria' : 'voci in contabilizzazione bancaria'} ({formatCurrency(reconciliationReport.unbookedTotalAmount)})
                      </span>
                      <span className="text-amber-700 dark:text-amber-300 ml-1">
                        — Considerate regolarmente come <strong>già contabilizzate</strong>: l'addebito sul conto è certo (la data contabile definitiva potrebbe variare di qualche giorno).
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Informazioni File e Pulsante Reset */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-850 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    File: {fileName || 'Estratto Conto Elaborato'}
                  </span>
                  <span>•</span>
                  <span>
                    Periodo: {formatDateIT(reconciliationReport.statementStartDate)} - {formatDateIT(reconciliationReport.statementEndDate)}
                  </span>
                  <span>•</span>
                  <span>Tolleranza data: ±{dateToleranceDays} giorni</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setParseResult(null);
                    setReconciliationReport(null);
                    setFileName('');
                    setRawText('');
                  }}
                  className="text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 text-[11px]"
                >
                  <RefreshCw size={12} />
                  <span>Carica un altro file</span>
                </button>
              </div>

              {/* Barra delle Schede e Azioni Cumulative */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setActiveTab('MANCANTI')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      activeTab === 'MANCANTI'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    <span>Mancanti nell'App ({reconciliationReport.missingCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('RICONCILIATE')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      activeTab === 'RICONCILIATE'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    <span>Già Riconciliate ({reconciliationReport.matchedCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('TUTTE')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      activeTab === 'TUTTE'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    <span>Tutte ({reconciliationReport.totalStatementCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('SOLO_APP')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      activeTab === 'SOLO_APP'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    <span>Solo nell'App ({reconciliationReport.onlyInAppMovements.length})</span>
                  </button>
                </div>

                {/* Pulsante di Inserimento Cumulativo Rapido */}
                {activeTab === 'MANCANTI' && reconciliationReport.missingCount > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleToggleSelectAllMissing(selectedMissingCount < reconciliationReport.missingCount)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      {selectedMissingCount === reconciliationReport.missingCount ? 'Deseleziona tutti' : 'Seleziona tutti'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRegisterMissing()}
                      disabled={isSaving || selectedMissingCount === 0}
                      className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all active:scale-95"
                    >
                      {isSaving ? (
                        <RefreshCw size={13} className="animate-spin" />
                      ) : (
                        <Plus size={14} strokeWidth={2.5} />
                      )}
                      <span>Registra {selectedMissingCount} mancanti selezionate</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Barra di Ricerca Locale */}
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cerca per causale, importo o data..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Elenco Principale Delle Transazioni */}
              {activeTab === 'SOLO_APP' ? (
                /* Tab Solo nell'App */
                <div className="space-y-2">
                  <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <Info size={16} />
                    <span>
                      Questi movimenti sono stati registrati nell'app per questo conto nel periodo dell'estratto ({formatDateIT(reconciliationReport.statementStartDate)} - {formatDateIT(reconciliationReport.statementEndDate)}), ma non sono comparsi nel file caricato. Potrebbero essere stati addebitati su un altro conto o contabilizzati in un altro mese.
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                    {reconciliationReport.onlyInAppMovements.map(mov => (
                      <div key={mov.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-slate-400">{formatDateIT(mov.data)}</span>
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-slate-100 block">{mov.descrizione}</span>
                            <span className="text-[10px] text-slate-400">{mov.tipologia}</span>
                          </div>
                        </div>
                        <span className={`font-numeric font-bold text-sm ${mov.tipologia === 'ENTRATA' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {mov.tipologia === 'ENTRATA' ? '+' : '-'} {formatCurrency(mov.importo)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Tab Mancanti, Riconciliate o Tutte */
                <div className="space-y-2.5">
                  {filteredItems.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                      Nessuna transazione corrispondente al filtro selezionato.
                    </div>
                  ) : (
                    filteredItems.map(item => {
                      const state = itemsState[item.id] || {
                        selectedSubcategoryId: item.suggestedSubcategoryId,
                        selectedForImport: item.matchStatus === 'MISSING_IN_APP'
                      };
                      const isMissing = item.matchStatus === 'MISSING_IN_APP';
                      const isPlanned = item.matchStatus === 'MATCHED_PLANNED';
                      const isMatched = item.matchStatus === 'MATCHED_EXACT' || item.matchStatus === 'MATCHED_DATE_DIFF';

                      return (
                        <div
                          key={item.id}
                          className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                            isMissing
                              ? 'bg-rose-50/30 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                              : isPlanned
                              ? 'bg-indigo-50/30 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/60'
                              : 'bg-white dark:bg-slate-850 border-slate-200/70 dark:border-slate-800'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            {/* Dati Transazione Estratto Conto */}
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              {(isMissing || isPlanned) && (
                                <input
                                  type="checkbox"
                                  checked={state.selectedForImport}
                                  onChange={e => {
                                    setItemsState(prev => ({
                                      ...prev,
                                      [item.id]: {
                                        ...prev[item.id],
                                        selectedForImport: e.target.checked
                                      }
                                    }));
                                  }}
                                  className="mt-1 rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                                />
                              )}

                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Badge Stato Match */}
                                  {isMissing && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-900/70 text-rose-700 dark:text-rose-300 flex items-center gap-1">
                                      <AlertTriangle size={11} />
                                      <span>MANCANTE NELL'APP</span>
                                    </span>
                                  )}

                                  {isPlanned && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                                      <Clock size={11} />
                                      <span>CORRISPONDE A PIANIFICATO</span>
                                    </span>
                                  )}

                                  {item.matchStatus === 'MATCHED_EXACT' && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/70 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                                      <Check size={11} />
                                      <span>RICONCILIATO (DATA ESATTA)</span>
                                    </span>
                                  )}

                                  {item.matchStatus === 'MATCHED_DATE_DIFF' && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/70 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                                      <Check size={11} />
                                      <span>
                                        RICONCILIATO (SCOSTAMENTO: {item.dateDiffDays !== undefined ? (item.dateDiffDays > 0 ? `+${item.dateDiffDays}` : `${item.dateDiffDays}`) : '0'} GG)
                                      </span>
                                    </span>
                                  )}

                                  {/* Badge Movimento in Contabilizzazione Bancaria */}
                                  {item.statementRow.isNonContabilizzato && (
                                    <span 
                                      className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/60 flex items-center gap-1"
                                      title="La banca segnala questo movimento come non ancora contabilizzato. In conformità alle tue preferenze, viene considerato già contabilizzato (addebito certo, cambierà solo la data contabile definitiva)."
                                    >
                                      <Zap size={10} className="text-amber-600 dark:text-amber-400" />
                                      <span>CONSIDERATO GIÀ CONTABILIZZATO</span>
                                    </span>
                                  )}

                                  {/* Data Estratto */}
                                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-400">
                                    Estratto: {formatDateIT(item.statementRow.date)}
                                  </span>
                                </div>

                                {/* Descrizione causale estratto conto */}
                                <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 break-words">
                                  {item.statementRow.description}
                                </h4>

                                {/* Nota addebito certo per non contabilizzato */}
                                {item.statementRow.isNonContabilizzato && (
                                  <div className="text-[11px] text-amber-800 dark:text-amber-200 bg-amber-500/10 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-500/20 dark:border-amber-800/40 mt-1 flex items-center gap-2">
                                    <Clock size={13} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
                                    <span>
                                      <strong>In attesa di data contabile definitiva:</strong> addebito certo, considerato già contabilizzato.
                                    </span>
                                  </div>
                                )}

                                {/* Dettagli di Corrispondenza se presente */}
                                {item.matchedMovement && (
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100/70 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200/50 dark:border-slate-700/50 mt-1.5 flex items-center gap-2">
                                    <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                                    <span>
                                      Registrato nell'app come: <b>"{item.matchedMovement.descrizione}"</b> in data {formatDateIT(item.matchedMovement.data)}
                                    </span>
                                  </div>
                                )}

                                {item.matchedPlanned && (
                                  <div className="text-[11px] text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/50 p-2 rounded-xl border border-indigo-200/50 dark:border-indigo-800/50 mt-1.5 flex items-center gap-2">
                                    <Clock size={13} className="text-indigo-500 flex-shrink-0" />
                                    <span>
                                      Corrisponde alla voce pianificata: <b>"{item.matchedPlanned.descrizione}"</b> (prevista il {formatDateIT(item.matchedPlanned.data_prevista)})
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Importo e Azione */}
                            <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 flex-shrink-0">
                              <div className="text-right">
                                <span className={`text-sm sm:text-base font-bold font-numeric block ${
                                  item.statementRow.type === 'ENTRATA'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}>
                                  {item.statementRow.type === 'ENTRATA' ? '+' : '-'} {formatCurrency(item.statementRow.amount)}
                                </span>
                                <span className="text-[10px] text-slate-400 uppercase font-mono">
                                  {item.statementRow.type}
                                </span>
                              </div>

                              {/* Per i mancanti: selettore rapido categoria con raggruppamento, ricerca e pulsante nuova */}
                              {(isMissing || isPlanned) && (
                                <div className="flex flex-wrap items-center gap-1.5 justify-end relative">
                                  {/* Select Raggruppata per Categoria Padre e Ordinata Alfabeticamente */}
                                  <select
                                    value={state.selectedSubcategoryId}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setItemsState(prev => ({
                                        ...prev,
                                        [item.id]: {
                                          ...prev[item.id],
                                          selectedSubcategoryId: val
                                        }
                                      }));
                                    }}
                                    className="text-[11px] font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[155px] truncate"
                                    title="Scegli sottocategoria raggruppata per categoria padre"
                                  >
                                    {groupedSubcategories.map(group => {
                                      const filteredSubs = group.items.filter(
                                        sub => sub.tipo === item.statementRow.type || isTransferSub(sub.id)
                                      );
                                      if (filteredSubs.length === 0) return null;
                                      return (
                                        <optgroup key={group.parent} label={`📁 ${group.parent}`}>
                                          {filteredSubs.map(sub => (
                                            <option key={sub.id} value={sub.id}>
                                              {sub.nome}
                                            </option>
                                          ))}
                                        </optgroup>
                                      );
                                    })}
                                  </select>

                                  {/* Bottone Tasto Cerca Popover */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (activeSubPickerItemId === item.id) {
                                        setActiveSubPickerItemId(null);
                                      } else {
                                        setActiveSubPickerItemId(item.id);
                                        setSubPickerSearchQuery('');
                                      }
                                    }}
                                    className={`p-1.5 rounded-xl text-xs font-semibold flex items-center justify-center transition-all border ${
                                      activeSubPickerItemId === item.id
                                        ? 'bg-indigo-600 text-white border-indigo-700'
                                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                    }`}
                                    title="Cerca tra tutte le sottocategorie"
                                  >
                                    <Search size={13} />
                                  </button>

                                  {/* Bottone Crea Nuova Sottocategoria On The Fly */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenQuickCreateSub(item.id, '', item.statementRow.type)}
                                    className="px-2 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                                    title="Crea una nuova sottocategoria direttamente da qui"
                                  >
                                    <Plus size={12} strokeWidth={2.5} />
                                    <span>Nuova</span>
                                  </button>

                                  {/* Popover Ricerca Sottocategoria */}
                                  {activeSubPickerItemId === item.id && (
                                    <div className="absolute right-0 top-full mt-1.5 w-72 bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-3 z-50 space-y-2.5 animate-in fade-in zoom-in-95 duration-150 text-left">
                                      <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                                        <span className="text-[11px] font-bold text-slate-800 dark:text-white flex items-center gap-1">
                                          <Search size={12} className="text-indigo-500" />
                                          <span>Cerca Sottocategoria</span>
                                        </span>
                                        <button
                                          onClick={() => setActiveSubPickerItemId(null)}
                                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                        >
                                          <X size={13} />
                                        </button>
                                      </div>

                                      <div className="relative">
                                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                          type="text"
                                          value={subPickerSearchQuery}
                                          onChange={e => setSubPickerSearchQuery(e.target.value)}
                                          placeholder="Scrivi per filtrare o creare..."
                                          autoFocus
                                          className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 font-medium"
                                        />
                                      </div>

                                      <div className="max-h-52 overflow-y-auto space-y-2 pr-1 no-scrollbar text-xs">
                                        {groupedSubcategories.map(group => {
                                          const matches = group.items.filter(sub => {
                                            if (sub.tipo !== item.statementRow.type && !isTransferSub(sub.id)) return false;
                                            if (!subPickerSearchQuery.trim()) return true;
                                            const q = subPickerSearchQuery.toLowerCase().trim();
                                            return sub.nome.toLowerCase().includes(q) || group.parent.toLowerCase().includes(q);
                                          });

                                          if (matches.length === 0) return null;

                                          return (
                                            <div key={group.parent} className="space-y-1">
                                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                                                📁 {group.parent}
                                              </span>
                                              <div className="space-y-0.5">
                                                {matches.map(sub => (
                                                  <button
                                                    key={sub.id}
                                                    type="button"
                                                    onClick={() => {
                                                      setItemsState(prev => ({
                                                        ...prev,
                                                        [item.id]: {
                                                          ...prev[item.id],
                                                          selectedSubcategoryId: sub.id
                                                        }
                                                      }));
                                                      setActiveSubPickerItemId(null);
                                                    }}
                                                    className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                                                      state.selectedSubcategoryId === sub.id
                                                        ? 'bg-indigo-600 text-white font-bold'
                                                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                                                    }`}
                                                  >
                                                    <span>{sub.nome}</span>
                                                    {state.selectedSubcategoryId === sub.id && <Check size={12} />}
                                                  </button>
                                                ))}
                                              </div>
                                            </div>
                                          );
                                        })}

                                        {subPickerSearchQuery.trim() && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              handleOpenQuickCreateSub(item.id, subPickerSearchQuery.trim(), item.statementRow.type);
                                              setActiveSubPickerItemId(null);
                                            }}
                                            className="w-full mt-1.5 p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-indigo-200 dark:border-indigo-800 transition-colors"
                                          >
                                            <Plus size={13} />
                                            <span>Crea "{subPickerSearchQuery.trim()}"</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Bottone Trasferisci Da/A sempre visibile accanto alla sottocategoria */}
                                  <button
                                    type="button"
                                    onClick={() => handleConvertToTransfer(item.id)}
                                    className={`text-[11px] px-2.5 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all border shadow-xs ${
                                      isTransferSub(state.selectedSubcategoryId)
                                        ? 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700'
                                        : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900'
                                    }`}
                                    title="Imposta come trasferimento e decidi da dove a dove"
                                  >
                                    <ArrowLeftRight size={13} className="flex-shrink-0" />
                                    <span className="truncate max-w-[160px]">
                                      {isTransferSub(state.selectedSubcategoryId) 
                                        ? `Da: ${allAccountsAndFunds.find(a => a.id === (state.selectedOriginAccountId || selectedAccountId))?.nome || 'Conto'} → A: ${allAccountsAndFunds.find(a => a.id === state.selectedDestinationAccountId)?.nome || 'Destinazione'}` 
                                        : 'Trasferisci (Da/A)'}
                                    </span>
                                  </button>
                                  {false && (
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() => setActiveDestPickerItemId(activeDestPickerItemId === item.id ? null : item.id)}
                                        className="text-[11px] bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 rounded-xl px-2.5 py-1 text-indigo-700 dark:text-indigo-300 font-semibold flex items-center gap-1 transition-all"
                                        title="Premi per scegliere il conto di destinazione del trasferimento"
                                      >
                                        <Building2 size={12} className="text-indigo-500" />
                                        <span className="truncate max-w-[100px]">
                                          {state.selectedDestinationAccountId
                                            ? allAccountsAndFunds.find(a => a.id === state.selectedDestinationAccountId)?.nome || 'Scegli conto'
                                            : 'Destinazione'}
                                        </span>
                                        <ChevronDown size={10} />
                                      </button>

                                      {activeDestPickerItemId === item.id && (
                                        <div className="absolute right-0 mt-1 w-52 bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50">
                                          <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            Conto di Arrivo
                                          </div>
                                          {allAccountsAndFunds
                                            .filter(acc => acc.id !== selectedAccountId)
                                            .map(acc => (
                                              <button
                                                key={acc.id}
                                                type="button"
                                                onClick={() => {
                                                  setItemsState(prev => ({
                                                    ...prev,
                                                    [item.id]: {
                                                      ...prev[item.id],
                                                      selectedDestinationAccountId: acc.id
                                                    }
                                                  }));
                                                  setActiveDestPickerItemId(null);
                                                }}
                                                className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 ${
                                                  state.selectedDestinationAccountId === acc.id ? 'text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/50 dark:bg-indigo-950/30' : 'text-slate-700 dark:text-slate-200'
                                                }`}
                                              >
                                                <span className="truncate">{acc.nome}</span>
                                                {state.selectedDestinationAccountId === acc.id && <Check size={12} />}
                                              </button>
                                            ))}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleRegisterMissing(item.id)}
                                    disabled={isSaving}
                                    className="px-2.5 py-1 rounded-xl bg-slate-900 dark:bg-indigo-600 hover:bg-black dark:hover:bg-indigo-500 text-white text-[11px] font-semibold flex items-center gap-1 shadow-xs transition-all active:scale-95"
                                    title="Registra subito questa transazione mancante nel conto"
                                  >
                                    <Plus size={12} strokeWidth={2.5} />
                                    <span>Registra</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Creazione Rapida Nuova Sottocategoria "On The Fly" */}
        {isQuickSubModalOpen && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div
              className="bg-white dark:bg-[#1C1C1E] w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-5 sm:p-6 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Plus size={18} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Crea Nuova Sottocategoria
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Disponibile subito per la riconciliazione e per tutta l'app
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsQuickSubModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveQuickSubcategory} className="space-y-4">
                {/* Nome Sottocategoria */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nome Sottocategoria *
                  </label>
                  <input
                    type="text"
                    value={quickSubName}
                    onChange={e => setQuickSubName(e.target.value)}
                    placeholder="Es. Spese Mediche Veterinarie"
                    autoFocus
                    required
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Categoria Padre */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Categoria Padre (Macro-Gruppo) *
                  </label>
                  <input
                    type="text"
                    value={quickSubParent}
                    onChange={e => setQuickSubParent(e.target.value)}
                    placeholder="Es. Salute & Medico, Casa, Auto..."
                    required
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-indigo-500 mb-2"
                  />

                  {/* Suggerimenti Categoria Padre */}
                  <div className="flex flex-wrap gap-1">
                    {['Alimentari', 'Casa & Utenze', 'Salute & Medico', 'Trasporti & Auto', 'Svago & Tempo Libero', 'Lavoro', 'Ristorazione', 'Shopping & Vestiario', 'Informatica & Tech'].map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setQuickSubParent(cat)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors ${
                          quickSubParent === cat
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tipologia */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tipologia Movimento
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setQuickSubTipo('USCITA')}
                      className={`py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        quickSubTipo === 'USCITA'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      USCITA (-)
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickSubTipo('ENTRATA')}
                      className={`py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        quickSubTipo === 'ENTRATA'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      ENTRATA (+)
                    </button>
                  </div>
                </div>

                {/* Footer Modale */}
                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsQuickSubModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={!quickSubName.trim() || isCreatingSub}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isCreatingSub ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Check size={14} strokeWidth={2.5} />
                    )}
                    <span>Crea e Seleziona Subito</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Footer Modale */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-850/40 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {reconciliationReport ? (
              <span>
                {reconciliationReport.missingCount > 0
                  ? `🚨 ${reconciliationReport.missingCount} transazioni mancanti da registrare nel programma`
                  : ' Tutte le transazioni dell\'estratto conto sono state riconciliate con successo!'}
              </span>
            ) : (
              <span>Nessun file elaborato</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
            >
              Chiudi
            </button>

            {reconciliationReport && reconciliationReport.missingCount > 0 && (
              <button
                type="button"
                onClick={() => handleRegisterMissing()}
                disabled={isSaving || selectedMissingCount === 0}
                className="px-5 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all active:scale-95"
              >
                {isSaving ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <Check size={14} strokeWidth={2.5} />
                )}
                <span>Registra {selectedMissingCount} Mancanti</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Overlay di Caricamento & Analisi File */}
      {isParsingFile && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-[#1C1C1E] rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-white/10 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
              <Loader2 size={28} className="animate-spin" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Elaborazione File
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {parsingStatus || 'Lettura e analisi movimenti in corso...'}
              </p>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div className="bg-indigo-600 h-2 rounded-full animate-pulse w-3/4 mx-auto" />
            </div>
          </div>
        </div>
      )}

      {/* Modal Configurazione Giroconto Da/A */}
      {activeTransferConfigItemId && (() => {
        const item = reconciliationReport?.items.find(i => i.id === activeTransferConfigItemId);
        if (!item) return null;
        const state = itemsState[item.id] || { selectedSubcategoryId: item.suggestedSubcategoryId };
        return (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-white dark:bg-[#1C1C1E] rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-white/10 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <ArrowLeftRight size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Configura Trasferimento (Da / A)</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Decidi il conto di partenza e il conto di arrivo</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTransferConfigItemId(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Conto Origine (Da) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    Conto di Partenza (Da)
                  </label>
                  <select
                    value={state.selectedOriginAccountId || selectedAccountId}
                    onChange={e => {
                      const val = e.target.value;
                      setItemsState(prev => ({
                        ...prev,
                        [item.id]: {
                          ...prev[item.id],
                          selectedOriginAccountId: val
                        }
                      }));
                    }}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {allAccountsAndFunds.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.nome} ({acc.tipo === 'CONTO' ? 'Conto' : 'Fondo'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Conto Destinazione (A) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    Conto di Arrivo (A)
                  </label>
                  <select
                    value={state.selectedDestinationAccountId || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setItemsState(prev => ({
                        ...prev,
                        [item.id]: {
                          ...prev[item.id],
                          selectedDestinationAccountId: val
                        }
                      }));
                    }}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Seleziona conto di arrivo...</option>
                    {allAccountsAndFunds
                      .filter(acc => acc.id !== (state.selectedOriginAccountId || selectedAccountId))
                      .map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.nome} ({acc.tipo === 'CONTO' ? 'Conto' : 'Fondo'})
                        </option>
                      ))}
                  </select>
                </div>

                {/* Sottocategoria */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    Sottocategoria Trasferimento
                  </label>
                  <select
                    value={state.selectedSubcategoryId}
                    onChange={e => {
                      const val = e.target.value;
                      setItemsState(prev => ({
                        ...prev,
                        [item.id]: {
                          ...prev[item.id],
                          selectedSubcategoryId: val
                        }
                      }));
                    }}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {subcategories
                      .filter(sub => sub.attiva !== false && (sub.tipo === item.statementRow.type || isTransferSub(sub.id)))
                      .map(sub => (
                        <option key={sub.id} value={sub.id}>
                          {sub.nome} ({sub.categoria_padre})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTransferConfigItemId(null)}
                  className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md w-full"
                >
                  Salva Configurazione Trasferimento
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Overlay Modale Barra di Avanzamento Trasferimento Movimenti */}
      {transferProgress && transferProgress.isOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-[#1C1C1E] rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-white/15 text-center space-y-5">
            {/* Icona di stato animata */}
            <div className="relative w-16 h-16 mx-auto">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors shadow-md ${
                transferProgress.isFinished
                  ? 'bg-emerald-500 text-white'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
              }`}>
                {transferProgress.isFinished ? (
                  <Check size={32} strokeWidth={3} className="animate-in zoom-in-75 duration-200" />
                ) : (
                  <RefreshCw size={28} className="animate-spin text-[#E31B23]" />
                )}
              </div>
            </div>

            {/* Titoli e descrizione */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {transferProgress.isFinished ? 'Trasferimento Completato!' : 'Trasferimento Movimenti nel Conto'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {transferProgress.isFinished
                  ? 'Tutte le transazioni sono state sincronizzate e salvate nel conto.'
                  : 'Registrazione in corso... Non chiudere la finestra durante il processo.'}
              </p>
            </div>

            {/* Barra di avanzamento con percentuale */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 font-numeric px-1">
                <span>
                  {transferProgress.current} di {transferProgress.total} movimenti
                </span>
                <span className="text-[#E31B23] dark:text-rose-400">
                  {transferProgress.percentage}%
                </span>
              </div>

              {/* Barra vera e propria */}
              <div className="w-full h-3.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200/80 dark:border-white/10 shadow-inner">
                <div
                  className="h-full rounded-full transition-all duration-150 ease-out bg-gradient-to-r from-rose-500 via-[#E31B23] to-amber-500 shadow-sm"
                  style={{ width: `${Math.min(100, Math.max(0, transferProgress.percentage))}%` }}
                />
              </div>
            </div>

            {/* Dettagli in tempo reale */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-white/5 text-left">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Nuove create</span>
                <span className="text-sm font-bold text-slate-800 dark:text-white font-numeric">
                  {transferProgress.createdCount}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-white/5 text-left">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Pianificate confermate</span>
                <span className="text-sm font-bold text-slate-800 dark:text-white font-numeric">
                  {transferProgress.confirmedPlannedCount}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
