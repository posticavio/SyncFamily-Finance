import React, { useState, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import { Movement, Subcategory, Account, Fund } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { formatDateIT, getAmountDisplay } from '../utils/formatters';
import { Copy, Trash2, ArrowRight, Landmark, Shield, Hash, Check, Filter, Clock, CalendarClock, Paperclip } from 'lucide-react';

interface TransactionItemProps {
  movement: Movement;
  subcategories: Subcategory[];
  accounts: Account[];
  funds: Fund[];
  onContextMenu: (e: React.MouseEvent, mov: Movement) => void;
  onClick: (mov: Movement) => void;
  onDuplicate: (mov: Movement) => void;
  onDelete: (mov: Movement) => void;
  onTagClick?: (tag: string) => void;
  onRemoveTag?: (mov: Movement, tag: string) => void;
  index?: number;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (mov: Movement) => void;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({
  movement,
  subcategories,
  accounts,
  funds,
  onContextMenu,
  onClick,
  onDuplicate,
  onDelete,
  onTagClick,
  onRemoveTag,
  index,
  isSelectMode = false,
  isSelected = false,
  onToggleSelect
}) => {
  const [tagMenuAnchor, setTagMenuAnchor] = useState<{
    tagName: string;
    top: number;
    left: number;
    placement: 'below' | 'above';
  } | null>(null);
  const sub = subcategories.find(s => s.id === movement.sottocategoria_id);
  const originAccount = accounts.find(a => a.id === movement.conto_origine) || funds.find(f => f.id === movement.conto_origine);
  const destAccount = movement.conto_destinazione 
    ? (accounts.find(a => a.id === movement.conto_destinazione) || funds.find(f => f.id === movement.conto_destinazione))
    : null;

  // Tags normalizzati
  const tagsList = useMemo(() => {
    const set = new Set<string>();
    if (movement.tag && movement.tag.trim()) set.add(movement.tag.trim());
    if (Array.isArray(movement.tags)) {
      movement.tags.forEach(t => t && t.trim() && set.add(t.trim()));
    }
    return Array.from(set);
  }, [movement.tag, movement.tags]);

  // Swipe gesture handling for mobile
  const [dragOffset, setDragOffset] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isSelectMode) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isSelectMode) return;
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = e.touches[0].clientX - touchStartX.current;
    const diffY = e.touches[0].clientY - touchStartY.current;

    // Detect if horizontal or vertical scroll
    if (isHorizontalSwipe.current === null) {
      if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
        isHorizontalSwipe.current = Math.abs(diffX) > Math.abs(diffY);
      }
    }

    if (isHorizontalSwipe.current) {
      // Clamped resistance
      const clamped = Math.max(-120, Math.min(120, diffX));
      setDragOffset(clamped);
    }
  };

  const handleTouchEnd = () => {
    if (dragOffset > 75) {
      // Trigger swipe right action: Duplica
      onDuplicate(movement);
    } else if (dragOffset < -75) {
      // Trigger swipe left action: Elimina
      onDelete(movement);
    }
    setDragOffset(0);
    touchStartX.current = null;
    touchStartY.current = null;
    isHorizontalSwipe.current = null;
  };

  const isTransfer = movement.tipologia === 'GIROCONTO';
  const amountInfo = getAmountDisplay(movement.importo, movement.tipologia);

  // Rilevamento se la transazione ha data futura rispetto a oggi
  const { isFuture, futureDaysDiff, isTomorrow } = useMemo(() => {
    if (!movement.data) return { isFuture: false, futureDaysDiff: 0, isTomorrow: false };
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const clean = String(movement.data).trim();
    let targetTime = 0;

    const isoMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (isoMatch) {
      targetTime = new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10)).getTime();
    } else {
      const itMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
      if (itMatch) {
        targetTime = new Date(parseInt(itMatch[3], 10), parseInt(itMatch[2], 10) - 1, parseInt(itMatch[1], 10)).getTime();
      } else {
        const parsed = new Date(clean).getTime();
        if (!isNaN(parsed)) {
          const d = new Date(clean);
          targetTime = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        }
      }
    }

    if (!targetTime || targetTime <= todayMidnight) {
      return { isFuture: false, futureDaysDiff: 0, isTomorrow: false };
    }

    const diffDays = Math.max(1, Math.round((targetTime - todayMidnight) / (1000 * 60 * 60 * 24)));
    return {
      isFuture: true,
      futureDaysDiff: diffDays,
      isTomorrow: diffDays === 1
    };
  }, [movement.data]);

  const isFutureExpense = isFuture && movement.tipologia === 'USCITA';

  const isOriginFund = funds.some(f => f.id === movement.conto_origine || f.fondo_id === movement.conto_origine);
  const isDestFund = destAccount ? funds.some(f => f.id === movement.conto_destinazione || f.fondo_id === movement.conto_destinazione) : false;

  const originName = originAccount 
    ? ('nome_conto' in originAccount ? originAccount.nome_conto : originAccount.nome_fondo)
    : 'Conto';

  const destName = destAccount 
    ? ('nome_conto' in destAccount ? destAccount.nome_conto : destAccount.nome_fondo)
    : null;

  return (
    <motion.div
      id={`transaction-item-${movement.id}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.26,
        ease: [0.22, 1, 0.36, 1],
        delay: index !== undefined ? Math.min(index * 0.03, 0.3) : 0
      }}
      className="relative overflow-hidden select-none group w-full max-w-full no-scrollbar"
      onContextMenu={(e) => onContextMenu(e, movement)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background action reveal indicators on swipe */}
      <div 
        className={`absolute inset-0 flex items-center justify-between px-6 transition-colors duration-200 ${
          dragOffset > 30 ? 'bg-indigo-500 text-white' : (dragOffset < -30 ? 'bg-rose-500 text-white' : 'bg-transparent')
        }`}
      >
        <div className={`flex items-center gap-2 font-medium text-sm transition-opacity ${dragOffset > 30 ? 'opacity-100' : 'opacity-0'}`}>
          <Copy size={18} />
          <span>Duplica</span>
        </div>
        <div className={`flex items-center gap-2 font-medium text-sm transition-opacity ${dragOffset < -30 ? 'opacity-100' : 'opacity-0'}`}>
          <span>Elimina</span>
          <Trash2 size={18} />
        </div>
      </div>

      {/* Main card body with transform during swipe */}
      <div
        onClick={() => {
          if (isSelectMode) {
            onToggleSelect?.(movement);
          } else {
            onClick(movement);
          }
        }}
        style={{ transform: `translateX(${dragOffset}px)` }}
        className={`relative px-2.5 py-2 sm:px-4 sm:py-3 flex items-center justify-between gap-2 sm:gap-3 transition-all duration-75 cursor-pointer no-scrollbar w-full max-w-full ${
          isSelected
            ? 'bg-amber-50/60 dark:bg-amber-950/40 border-b border-slate-100 dark:border-white/5'
            : isFuture
              ? isFutureExpense
                ? 'bg-amber-50/75 dark:bg-amber-950/35 hover:bg-amber-100/80 dark:hover:bg-amber-900/45 border-l-4 border-dashed border-l-amber-500 dark:border-l-amber-400 border-b border-dashed border-amber-300/80 dark:border-amber-700/60'
                : movement.tipologia === 'ENTRATA'
                  ? 'bg-emerald-50/75 dark:bg-emerald-950/35 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/45 border-l-4 border-dashed border-l-emerald-500 dark:border-l-emerald-400 border-b border-dashed border-emerald-300/80 dark:border-emerald-700/60'
                  : 'bg-indigo-50/75 dark:bg-indigo-950/35 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/45 border-l-4 border-dashed border-l-indigo-500 dark:border-l-indigo-400 border-b border-dashed border-indigo-300/80 dark:border-indigo-700/60'
              : 'bg-white dark:bg-[#1C1C1E] hover:bg-slate-50/80 dark:hover:bg-[#242426] border-b border-slate-100 dark:border-white/5'
        } last:border-b-0 active:bg-slate-100/80 dark:active:bg-[#2A2A2E]`}
      >
        {/* Left: Checkbox (if select mode) + Icon and Details */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-hidden no-scrollbar">
          {isSelectMode && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect?.(movement);
              }}
              className="flex-shrink-0 cursor-pointer p-0.5"
            >
              <div
                className={`w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-md sm:rounded-lg flex items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-[#E31B23] border border-[#E31B23] text-white shadow-xs'
                    : 'bg-white dark:bg-[#242426] border border-slate-300 dark:border-slate-600 hover:border-slate-400'
                }`}
              >
                {isSelected && <Check size={12} strokeWidth={3} />}
              </div>
            </div>
          )}

          <div className="shrink-0 relative">
            <CategoryIcon
              name={sub?.icon_name || (isTransfer ? 'ArrowLeftRight' : 'Tag')}
              color={sub?.colore}
              tipo={movement.tipologia}
              isGiroconto={isTransfer}
              size={17}
            />
            {isFuture && (
              <span 
                className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs ring-1 ring-white dark:ring-slate-900"
                title="Movimento programmato con data futura"
              >
                <Clock size={8} strokeWidth={2.5} />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1 overflow-hidden">
            {/* Top row: Description + Nature badge + Future badge */}
            <div className="flex items-center gap-1.5 min-w-0">
              <h4 className="font-medium text-slate-900 dark:text-[#F5F5F7] text-[13px] sm:text-[14.5px] truncate leading-tight">
                {movement.descrizione}
              </h4>
              {movement.natura === 'FISSA' && (
                <span className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[9px] font-medium bg-slate-100 dark:bg-[#2A2A2E] text-slate-500 dark:text-[#8E8E93] shrink-0">
                  Fissa
                </span>
              )}
              {movement.allegati && movement.allegati.length > 0 && (
                <div className="flex items-center gap-1 shrink-0 ml-1">
                  {movement.allegati.map((att, idx) => (
                    <a
                      key={att.id || idx}
                      href={att.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 text-[9.5px] font-bold hover:underline"
                      title={att.name}
                    >
                      <Paperclip size={10} />
                      <span className="max-w-[70px] truncate">{att.name}</span>
                    </a>
                  ))}
                </div>
              )}
              {isFutureExpense && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-dashed border-amber-400/90 dark:border-amber-600 shrink-0 shadow-2xs">
                  <CalendarClock size={10} className="text-amber-700 dark:text-amber-400 shrink-0" />
                  <span>{isTomorrow ? 'Spesa di domani' : `Data futura (${futureDaysDiff} gg)`}</span>
                </span>
              )}
              {isFuture && movement.tipologia === 'ENTRATA' && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 border border-dashed border-emerald-400/90 dark:border-emerald-600 shrink-0 shadow-2xs">
                  <CalendarClock size={10} className="text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <span>{isTomorrow ? 'Entrata di domani' : `Data futura (${futureDaysDiff} gg)`}</span>
                </span>
              )}
              {isFuture && movement.tipologia === 'GIROCONTO' && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-900 dark:text-indigo-200 border border-dashed border-indigo-400/90 dark:border-indigo-600 shrink-0 shadow-2xs">
                  <CalendarClock size={10} className="text-indigo-700 dark:text-indigo-400 shrink-0" />
                  <span>{isTomorrow ? 'Giroconto di domani' : `Data futura (${futureDaysDiff} gg)`}</span>
                </span>
              )}
            </div>

            {/* Bottom row: Date • Category • Account • Tag */}
            <div className="flex items-center gap-1 sm:gap-1.5 text-[10.5px] sm:text-xs text-slate-400 dark:text-[#8E8E93] mt-0.5 overflow-hidden no-scrollbar">
              {/* Data in formato breve italiano DD/MM/YYYY con evidenziazione se futura */}
              {isFuture ? (
                <span className={`inline-flex items-center gap-1 whitespace-nowrap font-bold font-numeric text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded border border-dashed shrink-0 ${
                  isFutureExpense
                    ? 'text-amber-950 dark:text-amber-200 bg-amber-100/90 dark:bg-amber-950/80 border-amber-400 dark:border-amber-600'
                    : movement.tipologia === 'ENTRATA'
                      ? 'text-emerald-950 dark:text-emerald-200 bg-emerald-100/90 dark:bg-emerald-950/80 border-emerald-400 dark:border-emerald-600'
                      : 'text-indigo-950 dark:text-indigo-200 bg-indigo-100/90 dark:bg-indigo-950/80 border-indigo-400 dark:border-indigo-600'
                }`}>
                  <Clock size={9} className="shrink-0" />
                  <span>{formatDateIT(movement.data)}</span>
                </span>
              ) : (
                <span className="whitespace-nowrap font-medium font-numeric text-slate-500 dark:text-[#8E8E93] shrink-0">
                  {formatDateIT(movement.data)}
                </span>
              )}
              <span className="shrink-0">•</span>
              <span className="truncate max-w-[85px] xs:max-w-[120px] sm:max-w-[180px]">
                {sub ? sub.nome : (isTransfer ? 'Giroconto' : 'Generale')}
              </span>
              <span className="shrink-0">•</span>
              <span className={`inline-flex items-center gap-1 text-[9.5px] sm:text-[11px] font-medium px-1.5 py-0.2 rounded-full whitespace-nowrap border shrink-0 transition-colors ${
                isOriginFund 
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-800' 
                  : 'bg-slate-100 dark:bg-[#2A2A2E] text-slate-600 dark:text-[#8E8E93] border-slate-200/60 dark:border-white/5'
              }`}>
                {isOriginFund ? <Shield size={8} className="text-amber-600 flex-shrink-0" /> : <Landmark size={8} className="text-slate-500 dark:text-slate-400 flex-shrink-0" />}
                <span className="truncate max-w-[60px] xs:max-w-[85px] sm:max-w-none">{originName}</span>
                {destName && (
                  <>
                    <ArrowRight size={7} className="text-slate-400 flex-shrink-0" />
                    <span className="truncate max-w-[60px] xs:max-w-[85px] sm:max-w-none">{destName}</span>
                  </>
                )}
              </span>
              {tagsList.length > 0 && tagsList.map((tName) => (
                <React.Fragment key={tName}>
                  <span className="shrink-0 hidden xs:inline">•</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      const popupWidth = 230;
                      const popupHeight = 110;

                      let left = rect.left;
                      if (left + popupWidth > window.innerWidth - 16) {
                        left = window.innerWidth - popupWidth - 16;
                      }
                      if (left < 16) left = 16;

                      let top = rect.bottom + 6;
                      let placement: 'below' | 'above' = 'below';
                      if (top + popupHeight > window.innerHeight - 16) {
                        top = Math.max(16, rect.top - popupHeight - 6);
                        placement = 'above';
                      }

                      setTagMenuAnchor({
                        tagName: tName,
                        top,
                        left,
                        placement
                      });
                    }}
                    title={`Opzioni tag: #${tName}`}
                    className="hidden xs:inline-flex items-center gap-0.5 text-[9.5px] sm:text-[10px] font-semibold px-1.5 py-0.2 rounded-full whitespace-nowrap bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80 shrink-0 shadow-2xs cursor-pointer"
                  >
                    <Hash size={8} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <span>{tName}</span>
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Currency amount with tabular-nums and strict alignment */}
        <div className="flex flex-col items-end flex-shrink-0 pl-1">
          <span className={`font-numeric text-[13px] sm:text-[15px] font-bold whitespace-nowrap text-right tabular-nums ${amountInfo.colorClass}`}>
            {amountInfo.text}
          </span>
          {isFuture && (
            <span className={`text-[9px] font-bold uppercase tracking-wider flex items-center gap-0.5 mt-0.5 px-1.5 py-0.2 rounded border border-dashed ${
              isFutureExpense 
                ? 'text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700' 
                : movement.tipologia === 'ENTRATA'
                  ? 'text-emerald-800 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700'
                  : 'text-indigo-800 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700'
            }`}>
              <Clock size={8} />
              <span>Programmata</span>
            </span>
          )}
        </div>
      </div>

      {/* Pop up opzioni tag ancorato vicino al tag cliccato */}
      {tagMenuAnchor && (
        <>
          <div
            className="fixed inset-0 z-[60]"
            onClick={(e) => {
              e.stopPropagation();
              setTagMenuAnchor(null);
            }}
          />
          <div
            style={{ top: `${tagMenuAnchor.top}px`, left: `${tagMenuAnchor.left}px` }}
            className="fixed z-[65] w-56 p-1.5 bg-white dark:bg-[#1E1E20] border border-slate-200/90 dark:border-white/10 rounded-2xl shadow-2xl space-y-1 text-left select-none text-xs animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span className="truncate">Tag #{tagMenuAnchor.tagName}</span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const t = tagMenuAnchor.tagName;
                setTagMenuAnchor(null);
                if (onTagClick) onTagClick(t);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 transition-colors text-left cursor-pointer"
            >
              <Filter size={13} className="text-amber-500 flex-shrink-0" />
              <span className="truncate">Filtra per #{tagMenuAnchor.tagName}</span>
            </button>

            {onRemoveTag && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const t = tagMenuAnchor.tagName;
                  setTagMenuAnchor(null);
                  onRemoveTag(movement, t);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition-colors text-left cursor-pointer"
              >
                <Trash2 size={13} className="flex-shrink-0" />
                <span>Rimuovi da questo movimento</span>
              </button>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
};
