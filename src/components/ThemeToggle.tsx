import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Laptop, Check } from 'lucide-react';
import { useTheme, ThemeMode } from '../context/ThemeContext';

export const ThemeToggle: React.FC = () => {
  const { theme, isDark, setTheme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Chiudi il menu a tendina se si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const options: { mode: ThemeMode; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      mode: 'light',
      label: 'Chiaro',
      icon: <Sun size={15} className="text-amber-500" />,
      desc: 'Ideale per il giorno'
    },
    {
      mode: 'dark',
      label: 'Scuro',
      icon: <Moon size={15} className="text-indigo-400" />,
      desc: 'Riposante per la notte'
    },
    {
      mode: 'system',
      label: 'Sistema',
      icon: <Laptop size={15} className="text-slate-400" />,
      desc: 'Segue le impostazioni OS'
    }
  ];

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <div className="flex items-center">
        {/* Pulsante Principale Toggle Rapido */}
        <button
          id="theme-toggle-btn"
          onClick={toggleTheme}
          onContextMenu={(e) => {
            e.preventDefault();
            setIsOpen(!isOpen);
          }}
          className="w-7.5 h-7.5 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 shadow-xs transition-all active:scale-95 group cursor-pointer"
          title={isDark ? 'Passa a tema Chiaro (Tasto destro per menu)' : 'Passa a tema Scuro (Tasto destro per menu)'}
          aria-label="Attiva o disattiva tema scuro"
        >
          {isDark ? (
            <Moon size={15} className="text-indigo-400 group-hover:rotate-12 transition-transform" />
          ) : (
            <Sun size={15} className="text-amber-500 group-hover:rotate-45 transition-transform" />
          )}
        </button>
      </div>

      {/* Menu a tendina Opzioni Tema */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-1 border-b border-slate-100 dark:border-slate-800 mb-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Aspetto Tema
            </span>
          </div>

          {options.map((opt) => {
            const isSelected = theme === opt.mode;
            return (
              <button
                key={opt.mode}
                onClick={() => {
                  setTheme(opt.mode);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    {opt.icon}
                  </div>
                  <div>
                    <span className="block">{opt.label}</span>
                    <span className="text-[10px] text-slate-400 block -mt-0.5">
                      {opt.desc}
                    </span>
                  </div>
                </div>

                {isSelected && (
                  <Check size={14} className="text-indigo-600 dark:text-indigo-400" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
