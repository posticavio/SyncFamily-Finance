import React, { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface TabHeaderInfoProps {
  text: string;
  className?: string;
}

export const TabHeaderInfo: React.FC<TabHeaderInfoProps> = ({ text, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Chiudi cliccando all'esterno o premendo Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        aria-label="Mostra informazioni sulla sezione"
        aria-expanded={isOpen}
        title={text}
        className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 bg-slate-100/90 hover:bg-indigo-50 dark:bg-[#242426] dark:hover:bg-indigo-950/40 border border-slate-200/70 dark:border-white/5 transition-all active:scale-95 cursor-pointer shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <Info size={13} strokeWidth={2.2} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            role="tooltip"
            className="absolute left-0 sm:left-1/2 sm:-translate-x-1/2 top-full mt-2 z-50 w-64 sm:w-72 p-3 bg-white dark:bg-[#1C1C1E] border border-slate-200/90 dark:border-white/10 rounded-2xl shadow-xl text-xs text-slate-600 dark:text-slate-300 font-normal normal-case leading-relaxed select-none pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Freccia superiore */}
            <div className="absolute -top-1.5 left-3 sm:left-1/2 sm:-translate-x-1/2 w-3 h-3 bg-white dark:bg-[#1C1C1E] border-t border-l border-slate-200/90 dark:border-white/10 rotate-45" />

            <div className="relative z-10 flex items-start gap-2">
              <div className="w-5 h-5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Info size={11} strokeWidth={2.5} />
              </div>
              <p className="flex-1 text-[12px] leading-relaxed text-slate-600 dark:text-slate-300">
                {text}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
