import React, { useState, useMemo } from 'react';
import { Subcategory, MovementType, SubcategoryClassification, getSubcategoryClassification } from '../types';
import { CategoryService } from '../services/CategoryService';
import { CategoryIcon, AVAILABLE_ICONS, AVAILABLE_EMOJIS, TYPE_ICON_COLORS } from './CategoryIcon';
import { 
  Tag, 
  Plus, 
  Check, 
  Edit2, 
  Trash2, 
  Search, 
  Sparkles, 
  Palette, 
  Smile, 
  Sliders, 
  Landmark, 
  Database, 
  Bell, 
  Star, 
  X, 
  RefreshCw,
  FolderPlus,
  CalendarRange,
  Calendar,
  ArrowRight,
  Info,
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  Banknote,
  Repeat
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { TabHeaderInfo } from './TabHeaderInfo';
import { haptics } from '../utils/haptics';
import { 
  getFinancialSettings, 
  getFinancialPeriodInfo, 
  getCurrentFinancialMonth,
  formatDMY 
} from '../utils/financialDate';
import { SettingsService } from '../services/SettingsService';
import { GoogleDriveService } from '../services/GoogleDriveService';
import { DB } from '../services/store';

interface SettingsViewProps {
  subcategories: Subcategory[];
  onRefresh: () => void;
  onOpenAccounts: () => void;
  onOpenBackup: () => void;
  onOpenControlCenter: () => void;
  onOpenRecurrences?: () => void;
}

const COLOR_PALETTE = [
  '#E31B23', // Samsung / One UI Red
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#10B981', // Emerald / Green
  '#14B8A6', // Teal
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#64748B'  // Slate
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  subcategories,
  onRefresh,
  onOpenAccounts,
  onOpenBackup,
  onOpenControlCenter,
  onOpenRecurrences
}) => {
  const [filterTipo, setFilterTipo] = useState<'ALL' | 'USCITA' | 'ENTRATA' | 'ESSENZIALI' | 'EXTRA' | 'GUADAGNI'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Edit / Create State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Subcategory | null>(null);
  const [nome, setNome] = useState('');
  const [categoriaPadre, setCategoriaPadre] = useState('');
  const [customPadre, setCustomPadre] = useState('');
  const [tipo, setTipo] = useState<MovementType>('USCITA');
  const [classificazione, setClassificazione] = useState<SubcategoryClassification>('SPESE_ESSENZIALI');
  const [iconName, setIconName] = useState('Tag');
  const [colore, setColore] = useState('#E31B23');
  const [isFavorite, setIsFavorite] = useState(true);
  const [iconPickerTab, setIconPickerTab] = useState<'EMOJI' | 'ICONS'>('EMOJI');
  const [iconSearch, setIconSearch] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Financial Month Settings State
  const initialFinConfig = getFinancialSettings();
  const [tipoMese, setTipoMese] = useState<'SOLARE' | 'PERSONALIZZATO'>(initialFinConfig.tipo);
  const [giornoInizio, setGiornoInizio] = useState<number>(initialFinConfig.startDay);
  const [giornoFine, setGiornoFine] = useState<number>(initialFinConfig.endDay);
  const [finSettingsSaved, setFinSettingsSaved] = useState(false);
  const [isSavingFinSettings, setIsSavingFinSettings] = useState(false);

  // Google Drive Settings State
  const [googleClientId, setGoogleClientId] = useState<string>(
    localStorage.getItem('google_client_id') || ''
  );
  const [driveSaved, setDriveSaved] = useState(false);
  const [isRenamingDrive, setIsRenamingDrive] = useState(false);
  const [renameResult, setRenameResult] = useState<string | null>(null);

  const handleSaveGoogleClientId = () => {
    haptics.tap();
    if (googleClientId.trim()) {
      localStorage.setItem('google_client_id', googleClientId.trim());
    } else {
      localStorage.removeItem('google_client_id');
    }
    setDriveSaved(true);
    haptics.success();
    setTimeout(() => setDriveSaved(false), 3000);
  };

  const handleRenameExistingFiles = async () => {
    haptics.tap();
    setIsRenamingDrive(true);
    setRenameResult(null);
    try {
      const res = await GoogleDriveService.renameExistingFiles();
      setRenameResult(res.message);
      haptics.success();
    } catch (e: any) {
      setRenameResult(`Errore: ${e.message || 'Impossibile rinominare i file'}`);
      haptics.error();
    } finally {
      setIsRenamingDrive(false);
    }
  };

  // Live preview for current financial month based on state
  const previewPeriod = useMemo(() => {
    const tempSettings = {
      ...DB.IMPOSTAZIONI,
      tipo_mese_finanziario: tipoMese,
      giorno_inizio_mese_finanziario: giornoInizio,
      giorno_fine_mese_finanziario: giornoFine
    };
    const currentKey = getCurrentFinancialMonth(tempSettings);
    return getFinancialPeriodInfo(currentKey, tempSettings);
  }, [tipoMese, giornoInizio, giornoFine]);

  const handleSaveFinancialConfig = async () => {
    haptics.tap();
    setIsSavingFinSettings(true);
    try {
      await SettingsService.setFinancialMonthConfig(tipoMese, giornoInizio, giornoFine);
      setFinSettingsSaved(true);
      haptics.success();
      onRefresh();
      setTimeout(() => setFinSettingsSaved(false), 3000);
    } catch (err) {
      console.error('Errore nel salvataggio impostazioni mese finanziario:', err);
    } finally {
      setIsSavingFinSettings(false);
    }
  };

  // Existing parent categories
  const parentCategories = Array.from(new Set(subcategories.map(s => s.categoria_padre))).filter(Boolean);

  const startCreate = () => {
    haptics.tap();
    setSelectedSub(null);
    setNome('');
    setCategoriaPadre(parentCategories[0] || 'Spese Varie');
    setCustomPadre('');
    setTipo('USCITA');
    setClassificazione('SPESE_ESSENZIALI');
    setIconName('🛒');
    setColore('#E31B23');
    setIsFavorite(true);
    setIconPickerTab('EMOJI');
    setIconSearch('');
    setStatusMessage(null);
    setIsEditorOpen(true);
  };

  const startEdit = (sub: Subcategory) => {
    haptics.tap();
    setSelectedSub(sub);
    setNome(sub.nome);
    setCategoriaPadre(sub.categoria_padre || 'Spese Varie');
    setCustomPadre('');
    setTipo(sub.tipo);
    setClassificazione(sub.classificazione || getSubcategoryClassification(sub));
    setIconName(sub.icon_name || (sub.tipo === 'ENTRATA' ? '💰' : '🛒'));
    setColore(sub.colore || (sub.tipo === 'ENTRATA' ? '#10B981' : '#E31B23'));
    setIsFavorite(sub.preferita);
    setIconPickerTab(AVAILABLE_EMOJIS.includes(sub.icon_name || '') ? 'EMOJI' : 'ICONS');
    setIconSearch('');
    setStatusMessage(null);
    setIsEditorOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setStatusMessage({ text: 'Inserisci un nome per la categoria.', type: 'error' });
      return;
    }

    const resolvedPadre = categoriaPadre === '__CUSTOM__'
      ? (customPadre.trim() || 'Spese Varie')
      : (categoriaPadre.trim() || 'Spese Varie');

    // Assicura coerenza tra tipo e classificazione
    const resolvedClassificazione: SubcategoryClassification = tipo === 'ENTRATA' 
      ? 'GUADAGNI' 
      : (classificazione === 'GUADAGNI' ? 'SPESE_ESSENZIALI' : classificazione);

    try {
      if (selectedSub) {
        // Modifica esistente
        await CategoryService.updateSubcategory(selectedSub.id, {
          nome: nome.trim(),
          categoria_padre: resolvedPadre,
          tipo,
          classificazione: resolvedClassificazione,
          icon_name: iconName,
          colore,
          preferita: isFavorite
        });
        setStatusMessage({ text: 'Categoria modificata con successo!', type: 'success' });
      } else {
        // Nuova categoria
        await CategoryService.createSubcategory({
          nome: nome.trim(),
          categoria_padre: resolvedPadre,
          tipo,
          classificazione: resolvedClassificazione,
          icon_name: iconName,
          colore,
          preferita: isFavorite
        });
        setStatusMessage({ text: 'Nuova categoria creata con successo!', type: 'success' });
      }

      onRefresh();
      haptics.success();
      setTimeout(() => {
        setIsEditorOpen(false);
        setStatusMessage(null);
      }, 500);
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Errore nel salvataggio.', type: 'error' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Sei sicuro di voler eliminare la categoria "${name}"?`)) {
      return;
    }
    try {
      await CategoryService.deleteSubcategory(id);
      onRefresh();
      haptics.success();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleFavorite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.tap();
    await CategoryService.toggleFavorite(id);
    onRefresh();
  };

  const handleToggleMacro = async (sub: Subcategory, e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.tap();
    if (sub.tipo === 'ENTRATA') return;
    const currentMacro = sub.classificazione || getSubcategoryClassification(sub);
    const nextMacro: SubcategoryClassification = currentMacro === 'SPESE_ESSENZIALI' ? 'SPESE_EXTRA' : 'SPESE_ESSENZIALI';
    await CategoryService.updateSubcategory(sub.id, { classificazione: nextMacro });
    onRefresh();
  };

  // Filtered categories
  const filtered = subcategories.filter(s => {
    const macro = s.classificazione || getSubcategoryClassification(s);
    if (filterTipo === 'USCITA' && s.tipo !== 'USCITA') return false;
    if (filterTipo === 'ENTRATA' && s.tipo !== 'ENTRATA') return false;
    if (filterTipo === 'ESSENZIALI' && (s.tipo !== 'USCITA' || macro !== 'SPESE_ESSENZIALI')) return false;
    if (filterTipo === 'EXTRA' && (s.tipo !== 'USCITA' || macro !== 'SPESE_EXTRA')) return false;
    if (filterTipo === 'GUADAGNI' && macro !== 'GUADAGNI') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.nome.toLowerCase().includes(q) ||
        (s.categoria_padre && s.categoria_padre.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Group by Categoria Padre
  const groupedCategories = filtered.reduce((acc, sub) => {
    const parent = sub.categoria_padre || 'Altro';
    if (!acc[parent]) acc[parent] = [];
    acc[parent].push(sub);
    return acc;
  }, {} as Record<string, Subcategory[]>);

  // Filtered icons in picker
  const filteredLucideIcons = AVAILABLE_ICONS.filter(icon =>
    icon.toLowerCase().includes(iconSearch.toLowerCase())
  );

  return (
    <div id="settings-view" className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* Samsung One UI Viewing Area Header */}
      <div className="pt-2 pb-1 flex items-center gap-2">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Impostazioni
        </h2>
        <TabHeaderInfo text="Personalizza categorie, icone, conti e configurazione dell'app" />
      </div>

      {/* Quick Access System Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {onOpenRecurrences && (
          <button
            onClick={onOpenRecurrences}
            className="p-4 rounded-[22px] bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-slate-800/80 hover:border-[#E31B23]/50 transition-all text-left flex flex-col justify-between shadow-xs active:scale-95 group"
          >
            <div className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-950/60 text-[#E31B23] flex items-center justify-center mb-2">
              <Repeat size={20} />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-[#E31B23] transition-colors">
                Ricorrenze & Rate
              </span>
              <span className="text-[11px] text-slate-400">Spese periodiche</span>
            </div>
          </button>
        )}

        <button
          onClick={onOpenAccounts}
          className="p-4 rounded-[22px] bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-all text-left flex flex-col justify-between shadow-xs active:scale-95 group"
        >
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2">
            <Landmark size={20} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              Conti & Fondi
            </span>
            <span className="text-[11px] text-slate-400">Saldi e Riconciliazione</span>
          </div>
        </button>

        <button
          onClick={onOpenBackup}
          className="p-4 rounded-[22px] bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-all text-left flex flex-col justify-between shadow-xs active:scale-95 group"
        >
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
            <Database size={20} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              Backup & Sync
            </span>
            <span className="text-[11px] text-slate-400">Esporta e Importa JSON</span>
          </div>
        </button>

        <button
          onClick={onOpenControlCenter}
          className="p-4 rounded-[22px] bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-all text-left flex flex-col justify-between shadow-xs active:scale-95 group"
        >
          <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2">
            <Bell size={20} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
              Centro Controllo
            </span>
            <span className="text-[11px] text-slate-400">Avvisi e Integrità</span>
          </div>
        </button>

        <div className="p-4 rounded-[22px] bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
              <Sliders size={20} />
            </div>
            <ThemeToggle />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-white block">
              Tema Grafico
            </span>
            <span className="text-[11px] text-slate-400">Chiaro / Scuro / Sistema</span>
          </div>
        </div>
      </div>

      {/* Sezione Mese Finanziario & Ciclo Spese (One UI Style) */}
      <div id="settings-financial-month-card" className="bg-white dark:bg-[#1C1C1E] rounded-[26px] p-4 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-[#E31B23] flex items-center justify-center flex-shrink-0">
              <CalendarRange size={20} strokeWidth={2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Mese Finanziario & Ciclo di Spesa
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/80 text-[#E31B23] border border-rose-200/60 dark:border-rose-900/40">
                  {tipoMese === 'PERSONALIZZATO' ? 'Ciclo Personalizzato' : 'Mese Solare'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Stabilisci quando inizia e finisce il periodo contabile mensile (es. dal 9 del mese al 10 del mese successivo)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {finSettingsSaved && (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                <CheckCircle2 size={15} />
                <span>Salvato!</span>
              </span>
            )}
            <button
              id="btn-save-financial-month-config"
              onClick={handleSaveFinancialConfig}
              disabled={isSavingFinSettings}
              className="px-4 py-2 bg-[#E31B23] hover:bg-red-700 text-white rounded-full text-xs font-semibold shadow-md active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Check size={14} strokeWidth={2.5} />
              <span>{isSavingFinSettings ? 'Salvataggio...' : 'Salva Periodo'}</span>
            </button>
          </div>
        </div>

        {/* Switch Modalità: Solare vs Personalizzato */}
        <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-full text-xs font-medium max-w-md">
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              setTipoMese('PERSONALIZZATO');
            }}
            className={`flex-1 py-2 px-3 rounded-full text-center transition-all ${
              tipoMese === 'PERSONALIZZATO'
                ? 'bg-white dark:bg-[#1C1C1E] text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Mese Personalizzato (Ciclo Stipendio)
          </button>
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              setTipoMese('SOLARE');
            }}
            className={`flex-1 py-2 px-3 rounded-full text-center transition-all ${
              tipoMese === 'SOLARE'
                ? 'bg-white dark:bg-[#1C1C1E] text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Mese Solare (1° - 30/31)
          </button>
        </div>

        {tipoMese === 'PERSONALIZZATO' && (
          <div className="space-y-4 pt-1">
            {/* Quick Presets (One UI Chips) */}
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">
                Scorciatoie Predefinite:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    setGiornoInizio(9);
                    setGiornoFine(10);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    giornoInizio === 9 && giornoFine === 10
                      ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-[#E31B23] font-bold shadow-xs'
                      : 'bg-slate-50 dark:bg-[#242426] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  ⭐ Dal 9 al 10 del mese succ. (Esempio)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    setGiornoInizio(10);
                    setGiornoFine(9);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    giornoInizio === 10 && giornoFine === 9
                      ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-[#E31B23] font-bold shadow-xs'
                      : 'bg-slate-50 dark:bg-[#242426] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  Dal 10 al 9 del mese succ.
                </button>
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    setGiornoInizio(27);
                    setGiornoFine(26);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    giornoInizio === 27 && giornoFine === 26
                      ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-[#E31B23] font-bold shadow-xs'
                      : 'bg-slate-50 dark:bg-[#242426] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  Dal 27 al 26 del mese succ. (Fine mese)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    setGiornoInizio(15);
                    setGiornoFine(14);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    giornoInizio === 15 && giornoFine === 14
                      ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-[#E31B23] font-bold shadow-xs'
                      : 'bg-slate-50 dark:bg-[#242426] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  Dal 15 al 14 del mese succ. (Metà mese)
                </button>
              </div>
            </div>

            {/* Selectors for Start Day and End Day */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-[20px] bg-slate-50 dark:bg-[#242426] border border-slate-200/80 dark:border-slate-800/80">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Giorno di Inizio Mese Finanziario
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2.5">
                  Il giorno del mese in cui si apre il nuovo periodo di spesa.
                </p>
                <div className="flex items-center gap-3">
                  <select
                    value={giornoInizio}
                    onChange={(e) => {
                      haptics.tap();
                      setGiornoInizio(parseInt(e.target.value, 10));
                    }}
                    className="w-full bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#E31B23]"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>
                        Giorno {day} del mese {day === 9 ? '(consigliato / esempio)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3.5 rounded-[20px] bg-slate-50 dark:bg-[#242426] border border-slate-200/80 dark:border-slate-800/80">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Giorno di Chiusura Mese Finanziario
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2.5">
                  Il giorno del mese successivo in cui termina il conteggio spese.
                </p>
                <div className="flex items-center gap-3">
                  <select
                    value={giornoFine}
                    onChange={(e) => {
                      haptics.tap();
                      setGiornoFine(parseInt(e.target.value, 10));
                    }}
                    className="w-full bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#E31B23]"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>
                        Giorno {day} del mese successivo {day === 10 ? '(esempio utente)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Preview Card (Squircle One UI) */}
        <div className="p-4 rounded-[22px] bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#242426] text-[#E31B23] flex items-center justify-center flex-shrink-0 shadow-2xs mt-0.5">
              <Info size={18} />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Periodo Finanziario di Riferimento: {previewPeriod.monthName}
              </span>
              <span className="text-xs font-semibold text-[#E31B23] block mt-0.5">
                Dal {formatDMY(previewPeriod.startDate)} al {formatDMY(previewPeriod.endDate)} ({previewPeriod.totalDays} giorni totali)
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Tutte le spese, le entrate e i movimenti registrati tra il <strong>{formatDMY(previewPeriod.startDate)}</strong> e il <strong>{formatDMY(previewPeriod.endDate)}</strong> vengono calcolati e attribuiti a <strong>{previewPeriod.monthName}</strong> nei grafici a torta, nei trend mensili, nei budget e nelle statistiche.
              </p>
            </div>
          </div>

          <button
            onClick={handleSaveFinancialConfig}
            disabled={isSavingFinSettings}
            className="px-4 py-2 bg-white dark:bg-[#242426] hover:bg-slate-50 dark:hover:bg-[#2a2a2e] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-full text-xs font-bold shadow-2xs active:scale-95 transition-all flex items-center gap-1.5 flex-shrink-0 self-end sm:self-auto"
          >
            <span>Applica Modifiche</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Google Drive Integration Configuration Card */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-[26px] p-4 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
              <Database size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Integrazione Google Drive (Allegati & Scontrini)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configura il tuo Google OAuth Client ID per caricare scontrini e documenti nella cartella di Google Drive
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {driveSaved && (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                <CheckCircle2 size={15} />
                <span>Salvato!</span>
              </span>
            )}
            <button
              onClick={handleSaveGoogleClientId}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-xs font-semibold shadow-md active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Check size={14} strokeWidth={2.5} />
              <span>Salva Client ID</span>
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Google OAuth Client ID
            </label>
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>Crea su Google Cloud Console</span>
            </a>
          </div>
          <input
            type="text"
            value={googleClientId}
            onChange={(e) => setGoogleClientId(e.target.value)}
            placeholder="es. 501552031023-xxxxxx.apps.googleusercontent.com"
            className="w-full bg-slate-50 dark:bg-[#242426] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            <strong className="text-indigo-600 dark:text-indigo-400">Guida rapida:</strong> Poiché hai autorizzato i permessi OAuth per Google Drive nel progetto, per completare il collegamento cloud ti basta creare un ID client OAuth (tipo <em className="text-slate-700 dark:text-slate-200">Applicazione Web</em>) su Google Cloud Console inserendo come origine JavaScript autorizzata:<br />
            <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[10px] text-indigo-600 dark:text-indigo-300 mt-1 inline-block">https://ais-dev-3hjidab6omtxoqfqh2inim-4058020433.europe-west3.run.app</code><br />
            Incolla qui sopra il Client ID generato e clicca su <strong className="text-slate-700 dark:text-slate-200">Salva Client ID</strong>. Se non inserisci il Client ID, l'app continuerà a salvare i file in modalità locale con la formattazione corretta.
          </p>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Aggiorna nome file esistenti su Google Drive
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Applica la nuova formattazione standardizzata (<code className="text-[10px] font-mono">DD-MM-YYYY - Descrizione - Importo</code>) a tutti i file già presenti nella cartella.
              </p>
            </div>
            <button
              onClick={handleRenameExistingFiles}
              disabled={isRenamingDrive}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-full text-xs font-semibold shadow-sm active:scale-95 transition-all flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isRenamingDrive ? "animate-spin" : ""} />
              <span>{isRenamingDrive ? "Aggiornamento..." : "Applica nuova formattazione"}</span>
            </button>
          </div>

          {renameResult && (
            <div className={`mt-2 p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 ${renameResult.startsWith('Errore') ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>
              <Info size={16} className="flex-shrink-0" />
              <span>{renameResult}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Section: Gestione Categorie & Sottocategorie */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-[26px] p-4 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-5">
        {/* Header & Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Tag size={18} className="text-red-500" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Categorie e Sottocategorie
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Aggiungi, modifica o assegna icone ed emoji personalizzate per ciascuna voce
            </p>
          </div>

          <button
            id="btn-add-category-settings"
            onClick={startCreate}
            className="px-4 py-2.5 bg-slate-900 hover:bg-black dark:bg-[#E31B23] dark:hover:bg-red-700 text-white rounded-full text-xs font-semibold shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 self-start sm:self-auto"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Nuova Sottocategoria</span>
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Type Filter Pills */}
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-full text-xs font-medium overflow-x-auto no-scrollbar max-w-full">
            <button
              onClick={() => setFilterTipo('ALL')}
              className={`px-3 py-1 rounded-full whitespace-nowrap transition-all ${
                filterTipo === 'ALL'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Tutte ({subcategories.length})
            </button>
            <button
              onClick={() => setFilterTipo('USCITA')}
              className={`px-3 py-1 rounded-full whitespace-nowrap transition-all ${
                filterTipo === 'USCITA'
                  ? 'bg-rose-500 text-white shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-rose-600'
              }`}
            >
              Uscite ({subcategories.filter(s => s.tipo === 'USCITA').length})
            </button>
            <button
              onClick={() => setFilterTipo('ENTRATA')}
              className={`px-3 py-1 rounded-full whitespace-nowrap transition-all ${
                filterTipo === 'ENTRATA'
                  ? 'bg-emerald-500 text-white shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-emerald-600'
              }`}
            >
              Entrate ({subcategories.filter(s => s.tipo === 'ENTRATA').length})
            </button>
            <button
              onClick={() => setFilterTipo('ESSENZIALI')}
              className={`px-3 py-1 rounded-full whitespace-nowrap transition-all ${
                filterTipo === 'ESSENZIALI'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-blue-600'
              }`}
            >
              Essenziali ({subcategories.filter(s => (s.classificazione || getSubcategoryClassification(s)) === 'SPESE_ESSENZIALI' && s.tipo === 'USCITA').length})
            </button>
            <button
              onClick={() => setFilterTipo('EXTRA')}
              className={`px-3 py-1 rounded-full whitespace-nowrap transition-all ${
                filterTipo === 'EXTRA'
                  ? 'bg-amber-500 text-white shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-amber-600'
              }`}
            >
              Extra ({subcategories.filter(s => (s.classificazione || getSubcategoryClassification(s)) === 'SPESE_EXTRA' && s.tipo === 'USCITA').length})
            </button>
            <button
              onClick={() => setFilterTipo('GUADAGNI')}
              className={`px-3 py-1 rounded-full whitespace-nowrap transition-all ${
                filterTipo === 'GUADAGNI'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-emerald-600'
              }`}
            >
              Guadagni ({subcategories.filter(s => (s.classificazione || getSubcategoryClassification(s)) === 'GUADAGNI').length})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca categoria o gruppo..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 rounded-full border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:border-red-500 transition-colors"
            />
          </div>
        </div>

        {/* Grouped Category Listing */}
        <div className="space-y-5">
          {Object.keys(groupedCategories).length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              Nessuna sottocategoria trovata con i filtri correnti.
            </div>
          ) : (
            (Object.entries(groupedCategories) as [string, Subcategory[]][]).map(([parent, items]) => (
              <div key={parent} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {parent} ({items.length})
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {items.map(sub => (
                    <div
                      key={sub.id}
                      className="p-3 rounded-2xl bg-slate-50/70 dark:bg-[#242426] border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-3 group hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Squircle Icon 38x38 */}
                        <CategoryIcon
                          name={sub.icon_name}
                          color={sub.colore}
                          size={18}
                          tipo={sub.tipo}
                        />

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {sub.nome}
                            </span>
                            {sub.preferita && (
                              <Star size={11} className="fill-amber-400 text-amber-400 flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-slate-400 truncate">
                              {sub.tipo === 'ENTRATA' ? 'Entrata' : 'Spesa'} • {sub.categoria_padre}
                            </span>

                            {/* Pill Classificazione One UI */}
                            {(() => {
                              const macro = sub.classificazione || getSubcategoryClassification(sub);
                              if (macro === 'GUADAGNI') {
                                return (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded-full font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    <TrendingUp size={9} /> Guadagno
                                  </span>
                                );
                              }
                              if (macro === 'SPESE_ESSENZIALI') {
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => handleToggleMacro(sub, e)}
                                    title="Spesa Essenziale: clicca per trasformarla in Spesa Extra"
                                    className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded-full font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 cursor-pointer transition-colors"
                                  >
                                    <ShieldCheck size={9} /> Essenziale
                                  </button>
                                );
                              }
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => handleToggleMacro(sub, e)}
                                  title="Spesa Extra: clicca per trasformarla in Spesa Essenziale"
                                  className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded-full font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 cursor-pointer transition-colors"
                                >
                                  <Sparkles size={9} /> Extra
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => handleToggleFavorite(sub.id, e)}
                          className={`p-1.5 rounded-xl transition-colors ${
                            sub.preferita
                              ? 'text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                              : 'text-slate-300 dark:text-slate-600 hover:text-amber-400 hover:bg-slate-200/50 dark:hover:bg-slate-700'
                          }`}
                          title={sub.preferita ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                        >
                          <Star size={14} className={sub.preferita ? 'fill-amber-400' : ''} />
                        </button>

                        <button
                          onClick={() => startEdit(sub)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
                          title="Modifica Categoria & Icona"
                        >
                          <Edit2 size={14} />
                        </button>

                        <button
                          onClick={() => handleDelete(sub.id, sub.nome)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                          title="Elimina Categoria"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor Modal / Drawer per Creazione / Modifica Sottocategoria & Icone */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1C1C1E] w-full max-w-lg rounded-[26px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
                  <Tag size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {selectedSub ? 'Modifica Sottocategoria' : 'Nuova Sottocategoria'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Personalizza nome, icone, colori e gruppo</p>
                </div>
              </div>

              <button
                onClick={() => setIsEditorOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Status Message */}
            {statusMessage && (
              <div className={`mx-5 mt-3 px-3 py-2 rounded-xl text-xs font-semibold ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}>
                {statusMessage.text}
              </div>
            )}

            {/* Scrollable Form Body */}
            <form onSubmit={handleSave} className="p-4 sm:p-5 overflow-y-auto space-y-4 no-scrollbar">
              {/* Preview Box */}
              <div className="p-3 bg-slate-50 dark:bg-[#242426] rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-3">
                <CategoryIcon
                  name={iconName}
                  color={colore}
                  size={24}
                  tipo={tipo}
                />
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                    {nome.trim() || 'Nome Categoria'}
                  </span>
                  <span className="text-[11px] text-slate-400 block truncate">
                    {tipo === 'ENTRATA' ? 'Guadagno (Entrata)' : (classificazione === 'SPESE_ESSENZIALI' ? 'Spesa Essenziale' : 'Spesa Extra')} • {categoriaPadre === '__CUSTOM__' ? (customPadre || 'Nuovo Gruppo') : categoriaPadre}
                  </span>
                </div>
              </div>

              {/* Nome */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                  Nome Sottocategoria
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Es. Spesa Conad, Bolletta Luce, Palestra..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:border-red-500"
                  required
                />
              </div>

              {/* Tipologia (Uscita / Entrata) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                    Tipo
                  </label>
                  <select
                    value={tipo}
                    onChange={(e) => {
                      const newTipo = e.target.value as MovementType;
                      setTipo(newTipo);
                      if (newTipo === 'ENTRATA' && colore === '#E31B23') setColore('#10B981');
                      if (newTipo === 'USCITA' && colore === '#10B981') setColore('#E31B23');
                    }}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                  >
                    <option value="USCITA">Uscita (Spesa)</option>
                    <option value="ENTRATA">Entrata (Ricavo)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                    Categoria Padre (Gruppo)
                  </label>
                  <select
                    value={categoriaPadre}
                    onChange={(e) => setCategoriaPadre(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                  >
                    {parentCategories.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                    <option value="__CUSTOM__">+ Crea Nuovo Gruppo...</option>
                  </select>
                </div>
              </div>

              {/* Classificazione Macro: Guadagni, Spese Essenziali, Spese Extra */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                  Classificazione Macro (Budget & Grafici)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      if (tipo !== 'ENTRATA') {
                        setTipo('ENTRATA');
                        setColore('#10B981');
                      }
                      setClassificazione('GUADAGNI');
                    }}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer ${
                      classificazione === 'GUADAGNI' || tipo === 'ENTRATA'
                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                    }`}
                  >
                    <TrendingUp size={15} />
                    <span className="text-[11px] font-bold leading-tight">Guadagni</span>
                    <span className="text-[9px] opacity-80">Entrate</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      if (tipo !== 'USCITA') {
                        setTipo('USCITA');
                        setColore('#E31B23');
                      }
                      setClassificazione('SPESE_ESSENZIALI');
                    }}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer ${
                      tipo === 'USCITA' && classificazione === 'SPESE_ESSENZIALI'
                        ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                    }`}
                  >
                    <ShieldCheck size={15} />
                    <span className="text-[11px] font-bold leading-tight">Spesa Essenziale</span>
                    <span className="text-[9px] opacity-80">Casa, cibo, bollette</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      if (tipo !== 'USCITA') {
                        setTipo('USCITA');
                        setColore('#E31B23');
                      }
                      setClassificazione('SPESE_EXTRA');
                    }}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer ${
                      tipo === 'USCITA' && classificazione === 'SPESE_EXTRA'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                    }`}
                  >
                    <Sparkles size={15} />
                    <span className="text-[11px] font-bold leading-tight">Spesa Extra</span>
                    <span className="text-[9px] opacity-80">Svago, cene, hobby</span>
                  </button>
                </div>
              </div>

              {categoriaPadre === '__CUSTOM__' && (
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                    Nome Nuovo Gruppo
                  </label>
                  <input
                    type="text"
                    value={customPadre}
                    onChange={(e) => setCustomPadre(e.target.value)}
                    placeholder="Es. Casa di Campagna, Hobby, Viaggi..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:border-red-500"
                  />
                </div>
              )}

              {/* Selettore Icona: Emoji vs Lucide Icon */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Scegli Icona o Emoji
                  </label>
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setIconPickerTab('EMOJI')}
                      className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                        iconPickerTab === 'EMOJI'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      <Smile size={12} />
                      <span>Emoji</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIconPickerTab('ICONS')}
                      className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                        iconPickerTab === 'ICONS'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      <Palette size={12} />
                      <span>Icone</span>
                    </button>
                  </div>
                </div>

                {iconPickerTab === 'EMOJI' ? (
                  <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-2xl max-h-36 overflow-y-auto no-scrollbar border border-slate-200/60 dark:border-slate-700/60">
                    {AVAILABLE_EMOJIS.map(emoji => (
                      <button
                        type="button"
                        key={emoji}
                        onClick={() => {
                          setIconName(emoji);
                          haptics.tap();
                        }}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all ${
                          iconName === emoji
                            ? 'bg-red-500/20 ring-2 ring-red-500 scale-105'
                            : 'hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={iconSearch}
                      onChange={(e) => setIconSearch(e.target.value)}
                      placeholder="Cerca nome icona (es. Car, Home, Zap, Heart)..."
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                    />
                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-2xl max-h-36 overflow-y-auto no-scrollbar border border-slate-200/60 dark:border-slate-700/60">
                      {filteredLucideIcons.map(icon => (
                        <button
                          type="button"
                          key={icon}
                          onClick={() => {
                            setIconName(icon);
                            haptics.tap();
                          }}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                            iconName === icon
                              ? 'bg-red-500/20 ring-2 ring-red-500 text-red-500 scale-105'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          <CategoryIcon name={icon} color={colore} size={16} background={false} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Selettore Colore Accent */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                  Colore Accento
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PALETTE.map(c => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setColore(c)}
                      className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center ${
                        colore === c ? 'scale-115 ring-2 ring-offset-2 ring-slate-400' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {colore === c && <Check size={12} className="text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preferita Star */}
              <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={isFavorite}
                  onChange={(e) => setIsFavorite(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                />
                <span className="flex items-center gap-1">
                  <Star size={13} className="text-amber-400 fill-amber-400" />
                  Mostra tra le categorie preferite rapide
                </span>
              </label>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-black dark:bg-[#E31B23] dark:hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-md active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>{selectedSub ? 'Salva Modifiche' : 'Crea Sottocategoria'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
