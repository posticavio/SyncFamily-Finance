import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  ListFilter, 
  PieChart, 
  Plus, 
  MoreHorizontal,
  Calendar, 
  Sparkles, 
  FolderKanban, 
  StickyNote, 
  Settings, 
  Landmark,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { haptics } from '../utils/haptics';

export type MainTab = 'DASHBOARD' | 'TRANSAZIONI' | 'REPORT_AI' | 'CALENDARIO' | 'BUDGET' | 'PROGETTI' | 'NOTE' | 'IMPOSTAZIONI' | 'CONTI';

interface MobileBottomNavProps {
  activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;
  onOpenNewTransaction: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenNewTransaction
}) => {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const isMoreTabActive = ['CALENDARIO', 'REPORT_AI', 'PROGETTI', 'NOTE', 'IMPOSTAZIONI', 'CONTI'].includes(activeTab);

  const moreSections = [
    {
      title: 'Pianificazione & AI',
      items: [
        { id: 'REPORT_AI' as MainTab, label: 'Report AI Gemini', desc: 'Analisi settimanale', icon: Sparkles, color: 'text-purple-500 bg-purple-500/15' },
        { id: 'CALENDARIO' as MainTab, label: 'Calendario', desc: 'Scadenze e flussi cassa', icon: Calendar, color: 'text-blue-500 bg-blue-500/15' },
        { id: 'PROGETTI' as MainTab, label: 'Progetti & Prestiti', desc: 'Mutui e finanziamenti', icon: FolderKanban, color: 'text-indigo-500 bg-indigo-500/15' },
      ]
    },
    {
      title: 'Gestione & Sistema',
      items: [
        { id: 'NOTE' as MainTab, label: 'Idee & Note Spesa', desc: 'Appunti e promemoria', icon: StickyNote, color: 'text-amber-500 bg-amber-500/15' },
        { id: 'IMPOSTAZIONI' as MainTab, label: 'Impostazioni', desc: 'Mese, backup e categorie', icon: Settings, color: 'text-slate-500 bg-slate-500/15' },
      ]
    }
  ];

  return (
    <>
      <nav
        id="mobile-bottom-nav"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-white/5 shadow-[0_-4px_24px_rgba(0,0,0,0.2)] md:hidden"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
      >
        <div className="flex items-center justify-around px-2 py-1.5 h-16 w-full max-w-lg mx-auto">
          {/* 1. Home */}
          <button
            type="button"
            id="mobile-tab-dashboard"
            onClick={() => {
              haptics.tap();
              setActiveTab('DASHBOARD');
            }}
            className="flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-95 cursor-pointer"
          >
            <div className={`px-3.5 py-1 rounded-full transition-all flex items-center justify-center ${
              activeTab === 'DASHBOARD'
                ? 'bg-[#E31B23]/15 text-[#E31B23]'
                : 'text-slate-400 dark:text-[#8E8E93]'
            }`}>
              <LayoutDashboard size={20} strokeWidth={activeTab === 'DASHBOARD' ? 2.5 : 2} />
            </div>
            <span className={`text-[10.5px] mt-0.5 tracking-tight ${
              activeTab === 'DASHBOARD'
                ? 'text-[#E31B23] font-bold'
                : 'text-slate-500 dark:text-[#8E8E93] font-medium'
            }`}>
              Home
            </span>
          </button>

          {/* 2. Budget */}
          <button
            type="button"
            id="mobile-tab-budget"
            onClick={() => {
              haptics.tap();
              setActiveTab('BUDGET');
            }}
            className="flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-95 cursor-pointer"
          >
            <div className={`px-3.5 py-1 rounded-full transition-all flex items-center justify-center ${
              activeTab === 'BUDGET'
                ? 'bg-[#E31B23]/15 text-[#E31B23]'
                : 'text-slate-400 dark:text-[#8E8E93]'
            }`}>
              <PieChart size={20} strokeWidth={activeTab === 'BUDGET' ? 2.5 : 2} />
            </div>
            <span className={`text-[10.5px] mt-0.5 tracking-tight ${
              activeTab === 'BUDGET'
                ? 'text-[#E31B23] font-bold'
                : 'text-slate-500 dark:text-[#8E8E93] font-medium'
            }`}>
              Budget
            </span>
          </button>

          {/* 3. Tasto Centrale Rapido "+" per Nuova Operazione */}
          <div className="flex flex-col items-center justify-center flex-1 py-0.5">
            <button
              type="button"
              id="mobile-central-add-btn"
              onClick={() => {
                haptics.impact();
                onOpenNewTransaction();
              }}
              className="w-12 h-12 rounded-[18px] bg-[#E31B23] text-white flex items-center justify-center shadow-lg shadow-[#E31B23]/30 active:scale-90 transition-transform cursor-pointer border border-[#E31B23]"
              title="Nuova Operazione"
            >
              <Plus size={24} strokeWidth={2.5} />
            </button>
          </div>

          {/* 4. Movimenti */}
          <button
            type="button"
            id="mobile-tab-transazioni"
            onClick={() => {
              haptics.tap();
              setActiveTab('TRANSAZIONI');
            }}
            className="flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-95 cursor-pointer"
          >
            <div className={`px-3.5 py-1 rounded-full transition-all flex items-center justify-center ${
              activeTab === 'TRANSAZIONI'
                ? 'bg-[#E31B23]/15 text-[#E31B23]'
                : 'text-slate-400 dark:text-[#8E8E93]'
            }`}>
              <ListFilter size={20} strokeWidth={activeTab === 'TRANSAZIONI' ? 2.5 : 2} />
            </div>
            <span className={`text-[10.5px] mt-0.5 tracking-tight ${
              activeTab === 'TRANSAZIONI'
                ? 'text-[#E31B23] font-bold'
                : 'text-slate-500 dark:text-[#8E8E93] font-medium'
            }`}>
              Movimenti
            </span>
          </button>

          {/* 5. Patrimonio & Conti */}
          <button
            type="button"
            id="mobile-tab-conti"
            onClick={() => {
              haptics.tap();
              setActiveTab('CONTI');
            }}
            className="flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-95 cursor-pointer"
          >
            <div className={`px-3.5 py-1 rounded-full transition-all flex items-center justify-center ${
              activeTab === 'CONTI'
                ? 'bg-[#E31B23]/15 text-[#E31B23]'
                : 'text-slate-400 dark:text-[#8E8E93]'
            }`}>
              <Landmark size={20} strokeWidth={activeTab === 'CONTI' ? 2.5 : 2} />
            </div>
            <span className={`text-[10.5px] mt-0.5 tracking-tight ${
              activeTab === 'CONTI'
                ? 'text-[#E31B23] font-bold'
                : 'text-slate-500 dark:text-[#8E8E93] font-medium'
            }`}>
              Patrimonio
            </span>
          </button>

          {/* 6. Altro (Menu One UI Bottom Sheet) */}
          <button
            type="button"
            id="mobile-tab-more"
            onClick={() => {
              haptics.tap();
              setIsMoreMenuOpen(true);
            }}
            className="flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-95 cursor-pointer"
          >
            <div className={`px-3.5 py-1 rounded-full transition-all flex items-center justify-center relative ${
              isMoreTabActive
                ? 'bg-[#E31B23]/15 text-[#E31B23]'
                : 'text-slate-400 dark:text-[#8E8E93]'
            }`}>
              <MoreHorizontal size={20} strokeWidth={isMoreTabActive ? 2.5 : 2} />
              {isMoreTabActive && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-[#E31B23]" />
              )}
            </div>
            <span className={`text-[10.5px] mt-0.5 tracking-tight ${
              isMoreTabActive
                ? 'text-[#E31B23] font-bold'
                : 'text-slate-500 dark:text-[#8E8E93] font-medium'
            }`}>
              Altro
            </span>
          </button>
        </div>
      </nav>

      {/* One UI Bottom Sheet per "Altro" */}
      <AnimatePresence>
        {isMoreMenuOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMoreMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative w-full max-w-md bg-white dark:bg-[#1C1C1E] border-t border-slate-200 dark:border-white/10 rounded-t-[28px] p-5 pb-8 shadow-2xl z-10 space-y-4"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}
            >
              {/* Maniglia One UI */}
              <div className="w-10 h-1.5 bg-slate-300 dark:bg-white/20 rounded-full mx-auto mb-2" />

              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-[#F5F5F7] tracking-tight">Strumenti & Sezioni</h3>
                  <p className="text-[11px] text-slate-500 dark:text-[#8E8E93]">Pianificazione, AI e configurazioni</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#2A2A2E] text-slate-500 dark:text-[#8E8E93] hover:text-slate-800 dark:hover:text-[#F5F5F7] flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Sezioni raggruppate */}
              <div className="space-y-3.5">
                {moreSections.map((section, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-[#8E8E93] uppercase tracking-wider block px-1">
                      {section.title}
                    </span>
                    <div className="grid grid-cols-1 gap-1.5">
                      {section.items.map(item => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              haptics.tap();
                              setActiveTab(item.id);
                              setIsMoreMenuOpen(false);
                            }}
                            className={`p-2.5 rounded-[18px] text-left flex items-center gap-3 transition-all active:scale-98 cursor-pointer border ${
                              isActive
                                ? 'bg-[#E31B23]/10 dark:bg-[#E31B23]/15 border-[#E31B23]/40'
                                : 'bg-slate-50 dark:bg-[#242426] hover:bg-slate-100 dark:hover:bg-[#2A2A2E] border-slate-200/70 dark:border-white/5'
                            }`}
                          >
                            <div className={`w-9 h-9 rounded-[12px] flex items-center justify-center flex-shrink-0 ${item.color}`}>
                              <Icon size={18} strokeWidth={2} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className={`block text-xs font-bold truncate ${
                                isActive ? 'text-[#E31B23]' : 'text-slate-800 dark:text-[#F5F5F7]'
                              }`}>
                                {item.label}
                              </span>
                              <span className="text-[10.5px] text-slate-500 dark:text-[#8E8E93] block truncate">
                                {item.desc}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

