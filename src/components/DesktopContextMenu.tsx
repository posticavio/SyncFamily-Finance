import React, { useEffect, useRef, useState } from 'react';
import { Edit3, Copy, Trash2, ArrowRightLeft, Tag, Check, X, Repeat } from 'lucide-react';
import { Movement, Account, Fund, TagItem, Recurrence } from '../types';
import { formatCurrency } from '../utils/formatters';
import { TagService } from '../services/TagService';
import { RecurrenceService } from '../services/RecurrenceService';

interface ContextMenuProps {
  x: number;
  y: number;
  movement: Movement;
  accounts: Account[];
  funds: Fund[];
  onClose: () => void;
  onEdit: (mov: Movement) => void;
  onDuplicate: (mov: Movement) => void;
  onDelete: (mov: Movement) => void;
  onChangeAccount: (mov: Movement, newAccountId: string) => void;
  onAssignTag?: (mov: Movement, tagName: string, action?: 'ADD' | 'REMOVE' | 'TOGGLE') => void;
  onClearTags?: (mov: Movement) => void;
  onRefresh?: () => void;
}

export const DesktopContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  movement,
  accounts,
  funds,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
  onChangeAccount,
  onAssignTag,
  onClearTags,
  onRefresh
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showAccountSubmenu, setShowAccountSubmenu] = useState(false);
  const [showTagSubmenu, setShowTagSubmenu] = useState(false);
  const [showRecurrenceSubmenu, setShowRecurrenceSubmenu] = useState(false);
  const [savedTags, setSavedTags] = useState<TagItem[]>([]);
  const [recurrences, setRecurrences] = useState<Recurrence[]>([]);

  useEffect(() => {
    TagService.getSavedTags().then(tags => setSavedTags(tags)).catch(console.error);
    RecurrenceService.getAll().then(recs => setRecurrences(recs)).catch(console.error);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust coordinates to prevent overflowing window bounds
  const menuWidth = 230;
  const menuHeight = 260;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 16);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 16);

  // Submenu placement (left if close to right edge)
  const isSubmenuLeft = adjustedX + menuWidth + 210 > window.innerWidth;

  const allDestinations = [
    ...accounts.map(a => ({ id: a.id, name: a.nome_conto, type: 'Conto' })),
    ...funds.map(f => ({ id: f.id, name: f.nome_fondo, type: 'Fondo' }))
  ];

  const hasAnyTag = Boolean(movement.tag || (Array.isArray(movement.tags) && movement.tags.length > 0));

  const isTagAssigned = (tagName: string) => {
    const target = tagName.toLowerCase().trim();
    if (movement.tag && movement.tag.toLowerCase().trim() === target) return true;
    if (Array.isArray(movement.tags) && movement.tags.some(t => t.toLowerCase().trim() === target)) return true;
    return false;
  };

  return (
    <div
      id="desktop-context-menu"
      ref={menuRef}
      className="fixed z-50 glass-dropdown rounded-2xl py-1.5 min-w-[220px] text-sm animate-in fade-in zoom-in-95 duration-100 shadow-2xl"
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
    >
      <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
        <span>{movement.movimento_id}</span>
        <span className="font-numeric font-semibold text-slate-500 dark:text-slate-400 tabular-nums">{formatCurrency(movement.importo)}</span>
      </div>

      <button
        id="ctx-edit-btn"
        onClick={() => { onEdit(movement); onClose(); }}
        className="w-full text-left px-3 py-2 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
      >
        <Edit3 size={15} className="text-slate-400 shrink-0" />
        <span>Modifica movimento</span>
      </button>

      <button
        id="ctx-duplicate-btn"
        onClick={() => { onDuplicate(movement); onClose(); }}
        className="w-full text-left px-3 py-2 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
      >
        <Copy size={15} className="text-slate-400 shrink-0" />
        <span>Duplica transazione</span>
      </button>

      {/* Assegna Tag Salvato */}
      <div className="relative">
        <button
          id="ctx-tag-btn"
          onMouseEnter={() => { setShowTagSubmenu(true); setShowAccountSubmenu(false); }}
          onClick={() => { setShowTagSubmenu(!showTagSubmenu); setShowAccountSubmenu(false); }}
          className="w-full text-left px-3 py-2 flex items-center justify-between text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Tag size={15} className="text-amber-500 shrink-0" />
            <span className="truncate">Assegna tag salvato</span>
          </div>
          <span className="text-xs text-slate-400 shrink-0 ml-2">›</span>
        </button>

        {showTagSubmenu && (
          <div
            id="ctx-tag-submenu"
            className={`absolute top-0 glass-dropdown rounded-2xl py-1 min-w-[210px] max-h-64 overflow-y-auto shadow-2xl z-50 ${
              isSubmenuLeft ? 'right-full mr-1' : 'left-full ml-1'
            }`}
          >
            <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
              <span>Tag salvati</span>
              <span className="text-[10px] text-slate-400">({savedTags.length})</span>
            </div>

            {savedTags.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-400 text-center">
                Nessun tag salvato trovato.
              </div>
            ) : (
              <div className="py-1 space-y-0.5">
                {savedTags.map(tag => {
                  const assigned = isTagAssigned(tag.nome);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => {
                        if (onAssignTag) {
                          onAssignTag(movement, tag.nome, assigned ? 'REMOVE' : 'ADD');
                        }
                        onClose();
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-indigo-50 dark:hover:bg-white/5 transition-colors ${
                        assigned
                          ? 'bg-amber-500/10 font-bold text-amber-600 dark:text-amber-400'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 mr-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                          style={{ backgroundColor: tag.colore || '#f59e0b' }}
                        />
                        <span className="truncate">#{tag.nome}</span>
                      </div>
                      {assigned && (
                        <Check size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={2.5} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {hasAnyTag && (
              <>
                <div className="h-px bg-slate-100 dark:bg-white/5 my-1" />
                <button
                  onClick={() => {
                    if (onClearTags) onClearTags(movement);
                    onClose();
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2 transition-colors"
                >
                  <X size={13} className="shrink-0" />
                  <span>Rimuovi tutti i tag</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Collega a Ricorrenza */}
      <div className="relative">
        <button
          id="ctx-recurrence-btn"
          onMouseEnter={() => { setShowRecurrenceSubmenu(true); setShowTagSubmenu(false); setShowAccountSubmenu(false); }}
          onClick={() => { setShowRecurrenceSubmenu(!showRecurrenceSubmenu); setShowTagSubmenu(false); setShowAccountSubmenu(false); }}
          className="w-full text-left px-3 py-2 flex items-center justify-between text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-[#E31B23] transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Repeat size={15} className="text-[#E31B23] shrink-0" />
            <span className="truncate">
              {movement.id_ricorrenza ? 'Gestisci ricorrenza' : 'Collega a ricorrenza'}
            </span>
          </div>
          <span className="text-xs text-slate-400 shrink-0 ml-2">›</span>
        </button>

        {showRecurrenceSubmenu && (
          <div
            id="ctx-recurrence-submenu"
            className={`absolute top-0 glass-dropdown rounded-2xl py-1 min-w-[220px] max-h-64 overflow-y-auto shadow-2xl z-50 ${
              isSubmenuLeft ? 'right-full mr-1' : 'left-full ml-1'
            }`}
          >
            <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
              <span>Ricorrenze attive</span>
              <span className="text-[10px] text-slate-400">({recurrences.length})</span>
            </div>

            {recurrences.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-400 text-center">
                Nessuna ricorrenza configurata.
              </div>
            ) : (
              <div className="py-1 space-y-0.5">
                {recurrences.map(rec => {
                  const isLinked = movement.id_ricorrenza === rec.id;
                  return (
                    <button
                      key={rec.id}
                      onClick={async () => {
                        try {
                          if (isLinked) {
                            await RecurrenceService.unlinkMovement(movement.id);
                          } else {
                            await RecurrenceService.linkMovements(rec.id, [movement.id]);
                          }
                          if (onRefresh) onRefresh();
                        } catch (err) {
                          console.error(err);
                        }
                        onClose();
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${
                        isLinked
                          ? 'bg-red-500/10 font-bold text-[#E31B23]'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <div className="min-w-0 mr-2">
                        <div className="truncate font-semibold">{rec.nome}</div>
                        <div className="text-[10px] text-slate-400">
                          {formatCurrency(rec.importo)} • {rec.frequenza.toLowerCase()}
                        </div>
                      </div>
                      {isLinked && (
                        <Check size={14} className="text-[#E31B23] shrink-0" strokeWidth={2.5} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {movement.id_ricorrenza && (
              <>
                <div className="h-px bg-slate-100 dark:bg-white/5 my-1" />
                <button
                  onClick={async () => {
                    try {
                      await RecurrenceService.unlinkMovement(movement.id);
                      if (onRefresh) onRefresh();
                    } catch (e) {
                      console.error(e);
                    }
                    onClose();
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2 transition-colors"
                >
                  <X size={13} className="shrink-0" />
                  <span>Scollega da ricorrenza</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          id="ctx-change-account-btn"
          onMouseEnter={() => { setShowAccountSubmenu(true); setShowTagSubmenu(false); }}
          onClick={() => { setShowAccountSubmenu(!showAccountSubmenu); setShowTagSubmenu(false); }}
          className="w-full text-left px-3 py-2 flex items-center justify-between text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <ArrowRightLeft size={15} className="text-slate-400 shrink-0" />
            <span className="truncate">Sposta su altro conto</span>
          </div>
          <span className="text-xs text-slate-400 shrink-0 ml-2">›</span>
        </button>

        {showAccountSubmenu && (
          <div
            id="ctx-account-submenu"
            className={`absolute top-0 glass-dropdown rounded-2xl py-1 min-w-[190px] max-h-56 overflow-y-auto shadow-2xl z-50 ${
              isSubmenuLeft ? 'right-full mr-1' : 'left-full ml-1'
            }`}
          >
            <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-white/5">
              Seleziona destinazione
            </div>
            {allDestinations.map(dest => (
              <button
                key={dest.id}
                onClick={() => {
                  onChangeAccount(movement, dest.id);
                  onClose();
                }}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-indigo-50 dark:hover:bg-white/5 hover:text-indigo-700 dark:hover:text-indigo-400 transition-colors ${
                  movement.conto_origine === dest.id ? 'bg-indigo-50/50 dark:bg-white/10 font-bold text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <span className="truncate mr-2">{dest.name}</span>
                <span className="text-[10px] text-slate-400 uppercase shrink-0">{dest.type}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-px bg-slate-100 dark:bg-white/5 my-1" />

      <button
        id="ctx-delete-btn"
        onClick={() => { onDelete(movement); onClose(); }}
        className="w-full text-left px-3 py-2 flex items-center gap-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
      >
        <Trash2 size={15} className="text-rose-500 shrink-0" />
        <span>Elimina movimento</span>
      </button>
    </div>
  );
};
