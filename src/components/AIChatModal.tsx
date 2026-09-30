import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  X, 
  Send, 
  Bot, 
  User, 
  RefreshCw, 
  PieChart, 
  TrendingDown, 
  AlertTriangle, 
  Lightbulb, 
  Copy, 
  Check, 
  Trash2,
  ChevronUp,
  Wand2,
  BarChart3,
  Wallet,
  CalendarClock,
  ArrowRight
} from 'lucide-react';
import { Movement, Account, Subcategory, Budget } from '../types';
import { GeminiChatService, ChatMessage } from '../services/geminiChatService';
import { haptics } from '../utils/haptics';

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  movements: Movement[];
  accounts: Account[];
  subcategories: Subcategory[];
  budgets?: Budget[];
}

export const AIChatModal: React.FC<AIChatModalProps> = ({
  isOpen,
  onClose,
  movements,
  accounts,
  subcategories,
  budgets = []
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: `Ciao! Sono il tuo assistente finanziario Gemini.
Posso rispondere a qualsiasi domanda su entrate, spese, saldi dei conti, grafici e darti consigli mirati per ottimizzare il tuo bilancio familiare basandomi esclusivamente sui dati reali della tua applicazione.

Cosa desideri analizzare oggi?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: 'GEMINI_AI'
      }
    ];
  });

  const cleanContent = (text: string) => {
    return text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/\bHO_BISOGNO\b/gi, 'necessità quotidiana')
      .replace(/\bBISOGNO\b/gi, 'necessità')
      .replace(/\bDEVO\b/gi, 'spesa fissa')
      .replace(/\bVOGLIO\b/gi, 'spesa discrezionale')
      .trim();
  };

  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSuggestionsMenu, setShowSuggestionsMenu] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestedQuestions = [
    "Qual è stata la mia spesa maggiore questo mese?",
    "Come sta andando la mia ripartizione 50/30/20?",
    "Quali sono le mie 5 uscite più consistenti?",
    "Ho delle categorie sopra budget o a rischio sforamento?",
    "Dammi 3 consigli pratici per risparmiare basati sui miei dati",
    "Qual è il saldo complessivo e la liquidità dei miei conti?",
    "Come si confrontano le mie entrate rispetto alle uscite questo mese?",
    "Quanto ho speso questo mese per il supermercato?",
    "Quali sono le rate o spese periodiche fisse più alte?",
    "Come posso risparmiare 50 euro tagliando le spese discrezionali?"
  ];

  const handleSuggestRandom = () => {
    haptics.tap();
    const nextQ = suggestedQuestions[suggestionIndex % suggestedQuestions.length];
    setSuggestionIndex(prev => prev + 1);
    setInputQuery(nextQ);
    inputRef.current?.focus();
  };

  // Auto-scroll
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, messages]);

  // Gestione tasto Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const presetSuggestions = [
    {
      id: 'analizza-spese',
      label: 'Analizza spese mese',
      desc: 'Panoramica uscite e categorie principali',
      icon: BarChart3,
      badge: 'Priorità',
      text: 'Analizza spese mese: forniscimi un resoconto chiaro e dettagliato di come ho speso i soldi questo mese e quali categorie pesano di più.'
    },
    {
      id: 'quanto-posso-spendere',
      label: 'Quanto posso spendere ancora?',
      desc: 'Margine spendibile e budget residuo',
      icon: Wallet,
      badge: 'Controllo',
      text: 'Quanto posso spendere ancora questo mese in base al mio saldo attuale e ai budget stabiliti?'
    },
    {
      id: 'previsione-fine-mese',
      label: 'Previsione fine mese',
      desc: 'Stima del saldo e ritmo di spesa',
      icon: CalendarClock,
      badge: 'Proiezione',
      text: 'Fammi una previsione realistica di fine mese su entrate, uscite e saldo finale basata sul ritmo di spesa attuale.'
    },
    {
      id: 'top-spese',
      label: 'Top spese del mese',
      desc: 'Spesa maggiore e uscite principali',
      icon: TrendingDown,
      badge: 'Classifica',
      text: 'Qual è stata la mia spesa maggiore di questo mese e quali sono le 5 uscite più consistenti?'
    },
    {
      id: 'controllo-budget',
      label: 'Controllo budget',
      desc: 'Categorie a rischio o sopra tetto',
      icon: AlertTriangle,
      badge: 'Budget',
      text: 'Ho delle categorie sopra budget o a rischio sforamento questo mese?'
    },
    {
      id: 'regola-503020',
      label: 'Regola 50/30/20',
      desc: 'Spese fisse, bisogni e svago',
      icon: PieChart,
      badge: 'Equilibrio',
      text: 'Come sta andando la mia ripartizione ideale 50/30/20 questo mese?'
    },
    {
      id: 'consigli-risparmio',
      label: 'Consigli per risparmiare',
      desc: '3 suggerimenti pratici su misura',
      icon: Lightbulb,
      badge: 'Risparmio',
      text: 'Dammi 3 consigli pratici per risparmiare basati sulle mie spese reali di questo mese.'
    }
  ];

  const handleSend = async (customText?: string) => {
    const textToSend = (customText || inputQuery).trim();
    if (!textToSend || loading) return;

    haptics.tap();
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const contextData = GeminiChatService.buildContextData(
        movements,
        accounts,
        subcategories,
        budgets
      );

      // Prepara storico senza ID locali
      const historyPayload = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await GeminiChatService.sendMessage(historyPayload, contextData);

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: res.source
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (e: any) {
      console.error("Errore chat:", e);
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Si è verificato un errore temporaneo nel contattare Gemini. Riprova tra pochi istanti.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          source: 'LOCAL_FALLBACK'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    haptics.tap();
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    haptics.impact();
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content: 'Conversazione azzerata. Chiedimi qualsiasi cosa sui tuoi dati finanziari.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: 'GEMINI_AI'
      }
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl h-[90vh] max-h-[720px] rounded-3xl bg-[#18191B] border border-[#2F3136] shadow-2xl flex flex-col overflow-hidden text-[#EAEBED]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modale One UI */}
        <div className="h-16 px-5 border-b border-[#2F3136] flex items-center justify-between bg-[#222428]/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#E31B23] to-rose-700 flex items-center justify-center text-white shadow-md shadow-red-950/40">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#EAEBED]">Assistente Finanziario</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E31B23]/20 text-[#E31B23] border border-[#E31B23]/30">
                  Gemini AI
                </span>
              </div>
              <p className="text-xs text-[#9A9DA5]">Risposte esclusive basate sui dati reali della tua app</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleClearHistory}
              className="p-2 rounded-xl text-[#9A9DA5] hover:text-[#EAEBED] hover:bg-[#2A2C31] transition-colors"
              title="Azzera cronologia"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#9A9DA5] hover:text-[#EAEBED] hover:bg-[#2A2C31] transition-colors"
              title="Chiudi (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sezione Pulsanti Suggerimento Preimpostati (Invio Automatico) */}
        <div className="px-3 sm:px-4 py-2 bg-[#1C1E22] border-b border-[#2F3136]/70 shrink-0">
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9A9DA5] flex items-center gap-1.5">
              <Sparkles size={11} className="text-[#E31B23]" />
              Suggerimenti preimpostati (invio automatico)
            </span>
            <span className="text-[10px] text-[#9A9DA5]/70 hidden sm:inline">Un tocco per inviare all'assistente</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {presetSuggestions.map((ps, idx) => {
              const Icon = ps.icon;
              return (
                <motion.div
                  key={ps.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: 0.08 + idx * 0.04, ease: [0.25, 1, 0.5, 1] }}
                  className="shrink-0"
                >
                  <button
                    onClick={() => handleSend(ps.text)}
                    disabled={loading}
                    className="group flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#222428] hover:bg-[#2A2C31] active:bg-[#32363D] border border-[#2F3136] hover:border-[#E31B23]/60 text-[#EAEBED] transition-all whitespace-nowrap active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
                    title={`${ps.label}: ${ps.desc}`}
                  >
                    <div className="w-5 h-5 rounded-lg bg-[#2A2C31] group-hover:bg-[#E31B23]/15 text-[#E31B23] flex items-center justify-center transition-colors shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span>{ps.label}</span>
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div 
                key={msg.id} 
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#E31B23] to-rose-700 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[85%] sm:max-w-[78%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div 
                    className={`rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'bg-[#E31B23] text-white rounded-br-xs shadow-md'
                        : 'bg-[#222428] border border-[#2F3136] text-[#EAEBED] rounded-bl-xs shadow-sm'
                    }`}
                  >
                    {cleanContent(msg.content)}
                  </div>

                  <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-[#9A9DA5]">
                    <span>{msg.timestamp}</span>
                    {!isUser && (
                      <button
                        onClick={() => handleCopy(msg.content, msg.id)}
                        className="hover:text-[#EAEBED] flex items-center gap-1 cursor-pointer"
                        title="Copia risposta"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copiato</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copia</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-[#2A2C31] border border-[#3A3D45] text-[#EAEBED] flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Griglia di Suggerimenti Rapidi al benvenuto con Invio Istantaneo */}
          {messages.length <= 1 && (
            <div className="mt-3 p-3.5 sm:p-4 rounded-2xl bg-[#1E2024] border border-[#2F3136] shadow-sm animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-3 px-0.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-[#E31B23]/15 text-[#E31B23] flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#EAEBED]">Pulsanti di Suggerimento Rapido</h4>
                    <p className="text-[11px] text-[#9A9DA5]">Tocca una card per inviare subito la domanda all'assistente</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {presetSuggestions.map((ps, idx) => {
                  const Icon = ps.icon;
                  return (
                    <motion.div
                      key={ps.id}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.32, delay: 0.12 + idx * 0.04, ease: [0.25, 1, 0.5, 1] }}
                      className="h-full flex"
                    >
                      <button
                        onClick={() => handleSend(ps.text)}
                        disabled={loading}
                        className="w-full text-left p-3 rounded-xl bg-[#24262B] hover:bg-[#2A2C33] active:bg-[#30333B] border border-[#2F3136] hover:border-[#E31B23]/50 transition-all flex flex-col justify-between group active:scale-[0.98] cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg bg-[#2C2F36] group-hover:bg-[#E31B23]/20 text-[#E31B23] flex items-center justify-center transition-colors shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#9A9DA5] bg-[#1A1C1F] px-1.5 py-0.5 rounded-md border border-[#2F3136]">
                            {ps.badge}
                          </span>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#EAEBED] group-hover:text-white transition-colors flex items-center justify-between gap-1">
                            <span className="truncate">{ps.label}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-[#E31B23] opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all shrink-0" />
                          </div>
                          <div className="text-[11px] text-[#9A9DA5] mt-1 line-clamp-1">{ps.desc}</div>
                        </div>
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex gap-3 items-center text-xs text-[#9A9DA5]">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#E31B23] to-rose-700 text-white flex items-center justify-center shrink-0">
                <RefreshCw className="w-4 h-4 animate-spin" />
              </div>
              <span className="animate-pulse">Gemini sta analizzando i dati finanziari...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Footer Input Bar */}
        <div className="p-3 sm:p-4 border-t border-[#2F3136] bg-[#222428]/95 backdrop-blur-md shrink-0 relative">
          {/* Menu a comparsa con le domande suggerite */}
          {showSuggestionsMenu && (
            <div className="mb-2.5 p-3 rounded-2xl bg-[#1C1E22] border border-[#2F3136] shadow-2xl animate-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#2F3136]/60 px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#9A9DA5] flex items-center gap-1.5">
                  <Sparkles size={13} className="text-[#E31B23]" />
                  Domande suggerite per la tua situazione
                </span>
                <button
                  type="button"
                  onClick={() => setShowSuggestionsMenu(false)}
                  className="text-[#9A9DA5] hover:text-[#EAEBED] p-1 rounded-lg text-xs cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {suggestedQuestions.map((q, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: idx * 0.025, ease: "easeOut" }}
                    className="flex items-center gap-1 p-1 rounded-xl bg-[#222428] hover:bg-[#2A2C31] border border-[#2F3136]/50 hover:border-[#E31B23]/40 transition-colors group"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        haptics.tap();
                        setInputQuery(q);
                        setShowSuggestionsMenu(false);
                        inputRef.current?.focus();
                      }}
                      className="flex-1 text-left px-2 py-1 text-[#EAEBED] text-xs transition-colors truncate cursor-pointer flex items-center gap-2"
                      title="Inserisci nel campo di testo"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E31B23] shrink-0 group-hover:scale-125 transition-transform" />
                      <span className="truncate">{q}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSuggestionsMenu(false);
                        handleSend(q);
                      }}
                      disabled={loading}
                      className="px-2 py-1 rounded-lg bg-[#E31B23]/15 hover:bg-[#E31B23] text-[#E31B23] hover:text-white text-[10px] font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1"
                      title="Invia subito all'assistente"
                    >
                      <span>Invia</span>
                      <Send size={10} />
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Barra rapida con tasto "Suggerisci una domanda" */}
          <div className="flex items-center justify-between mb-2 px-1">
            <motion.button
              type="button"
              id="btn-suggest-question"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.1 }}
              onClick={() => {
                haptics.tap();
                setShowSuggestionsMenu(!showSuggestionsMenu);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#2A2C31] hover:bg-[#34373E] text-[#EAEBED] border border-[#3A3D45] hover:border-[#E31B23]/60 transition-all cursor-pointer shadow-xs active:scale-95"
              title="Apri elenco domande consigliate"
            >
              <Sparkles size={13} className="text-[#E31B23] animate-pulse" />
              <span>Suggerisci una domanda</span>
              <ChevronUp size={12} className={`text-[#9A9DA5] transition-transform ${showSuggestionsMenu ? 'rotate-180' : ''}`} />
            </motion.button>

            <button
              type="button"
              onClick={handleSuggestRandom}
              className="text-[11px] text-[#9A9DA5] hover:text-[#EAEBED] flex items-center gap-1 transition-colors cursor-pointer"
              title="Inserisci subito una domanda casuale"
            >
              <Wand2 size={12} className="text-[#E31B23]" />
              <span>Inserisci casuale</span>
            </button>
          </div>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Fai una domanda o clicca 'Suggerisci una domanda'..."
              className="flex-1 h-11 bg-[#18191B] border border-[#2F3136] rounded-2xl px-4 text-xs sm:text-sm text-[#EAEBED] placeholder:text-[#9A9DA5] focus:outline-none focus:border-[#E31B23] transition-colors"
              disabled={loading}
            />

            <button
              type="submit"
              disabled={!inputQuery.trim() || loading}
              className="h-11 px-4 rounded-2xl bg-[#E31B23] hover:bg-[#c9171e] disabled:opacity-40 disabled:hover:bg-[#E31B23] text-white flex items-center justify-center font-bold text-xs sm:text-sm transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
              title="Invia messaggio"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
export default AIChatModal;
