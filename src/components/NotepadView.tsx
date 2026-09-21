import React, { useState, useEffect, useMemo } from 'react';
import { NoteItem, Project } from '../types';
import { NoteService } from '../services/NoteService';
import { ProjectService } from '../services/ProjectService';
import { subscribeToDB } from '../services/store';
import { haptics } from '../utils/haptics';
import { TabHeaderInfo } from './TabHeaderInfo';
import { 
  StickyNote, 
  Search, 
  Plus, 
  Pin, 
  PinOff, 
  Trash2, 
  Edit3, 
  Copy, 
  Check, 
  Calendar, 
  FolderKanban, 
  Tag, 
  Layers, 
  CheckCircle2, 
  Circle, 
  X,
  Lightbulb,
  Sparkles,
  Bookmark,
  Share2,
  CalendarDays,
  FileText
} from 'lucide-react';

interface NotepadViewProps {
  onOpenNewTransaction?: () => void;
  onNavigateToProjects?: () => void;
}

type GroupByMode = 'NOTE' | 'DATA' | 'TUTTI';

const NOTE_COLORS = [
  { label: 'Indaco', bg: '#4f46e5', lightBg: 'bg-indigo-50 dark:bg-indigo-950/40', border: 'border-indigo-200 dark:border-indigo-900/60', text: 'text-indigo-600 dark:text-indigo-400' },
  { label: 'Smeraldo', bg: '#059669', lightBg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-900/60', text: 'text-emerald-600 dark:text-emerald-400' },
  { label: 'Ambra', bg: '#d97706', lightBg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-900/60', text: 'text-amber-600 dark:text-amber-400' },
  { label: 'Viola', bg: '#7c3aed', lightBg: 'bg-purple-50 dark:bg-purple-950/40', border: 'border-purple-200 dark:border-purple-900/60', text: 'text-purple-600 dark:text-purple-400' },
  { label: 'Rosa', bg: '#e11d48', lightBg: 'bg-rose-50 dark:bg-rose-950/40', border: 'border-rose-200 dark:border-rose-900/60', text: 'text-rose-600 dark:text-rose-400' },
  { label: 'Ardesia', bg: '#475569', lightBg: 'bg-slate-100 dark:bg-slate-800/60', border: 'border-slate-300 dark:border-slate-700', text: 'text-slate-600 dark:text-slate-300' }
];

const CATEGORY_ICONS: Record<string, string> = {
  'IDEE': '💡',
  'RISPARMIO': '💰',
  'PROGETTI': '🎯',
  'ACQUISTI': '🛍️',
  'FAMIGLIA': '👨‍👩‍👧',
  'INVESTIMENTI': '📈',
  'ALTRO': '📝'
};

export const NotepadView: React.FC<NotepadViewProps> = ({
  onOpenNewTransaction,
  onNavigateToProjects
}) => {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [groupBy, setGroupBy] = useState<GroupByMode>('NOTE');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<NoteItem | null>(null);

  // Form State
  const [formTitolo, setFormTitolo] = useState<string>('');
  const [formContenuto, setFormContenuto] = useState<string>('');
  const [formCategoria, setFormCategoria] = useState<string>('IDEE');
  const [formTagInput, setFormTagInput] = useState<string>('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formColore, setFormColore] = useState<string>('#4f46e5');
  const [formFissata, setFormFissata] = useState<boolean>(false);
  const [formDataCreazione, setFormDataCreazione] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formProgettoId, setFormProgettoId] = useState<string>('');

  const loadData = async () => {
    try {
      const [fetchedNotes, fetchedProjects] = await Promise.all([
        NoteService.getAll(),
        ProjectService.getAll()
      ]);
      setNotes(fetchedNotes);
      setProjects(fetchedProjects);
    } catch (e) {
      console.error("Errore caricamento note:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeToDB(() => {
      loadData();
    });
    return () => unsub();
  }, []);

  const openNewNoteModal = (prefillCategory?: string) => {
    haptics.tap();
    setEditingNote(null);
    setFormTitolo('');
    setFormContenuto('');
    setFormCategoria(prefillCategory || (selectedCategory !== 'ALL' ? selectedCategory : 'IDEE'));
    setFormTagInput('');
    setFormTags([]);
    setFormColore('#4f46e5');
    setFormFissata(false);
    setFormDataCreazione(new Date().toISOString().split('T')[0]);
    setFormProgettoId('');
    setIsModalOpen(true);
  };

  const openEditNoteModal = (note: NoteItem) => {
    haptics.tap();
    setEditingNote(note);
    setFormTitolo(note.titolo);
    setFormContenuto(note.contenuto);
    setFormCategoria(note.categoria || 'IDEE');
    setFormTagInput('');
    setFormTags(note.tag || []);
    setFormColore(note.colore || '#4f46e5');
    setFormFissata(Boolean(note.fissata));
    setFormDataCreazione(note.data_creazione || new Date().toISOString().split('T')[0]);
    setFormProgettoId(note.collegamento_progetto_id || '');
    setIsModalOpen(true);
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitolo.trim() && !formContenuto.trim()) {
      return;
    }

    try {
      if (editingNote) {
        await NoteService.update(editingNote.id, {
          titolo: formTitolo.trim() || 'Nota senza titolo',
          contenuto: formContenuto,
          categoria: formCategoria,
          tag: formTags,
          colore: formColore,
          fissata: formFissata,
          data_creazione: formDataCreazione,
          collegamento_progetto_id: formProgettoId || undefined
        });
      } else {
        await NoteService.create({
          titolo: formTitolo.trim() || 'Nota senza titolo',
          contenuto: formContenuto,
          categoria: formCategoria,
          tag: formTags,
          colore: formColore,
          fissata: formFissata,
          data_creazione: formDataCreazione,
          collegamento_progetto_id: formProgettoId || undefined
        });
      }
      haptics.success();
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error("Errore salvataggio nota:", err);
      haptics.error();
    }
  };

  const handleDeleteNote = (note: NoteItem) => {
    haptics.tap();
    setNoteToDelete(note);
  };

  const confirmDeleteNote = async () => {
    if (!noteToDelete) return;
    try {
      const idToDelete = noteToDelete.id;
      setNoteToDelete(null);
      await NoteService.delete(idToDelete);
      haptics.medium();
      await loadData();
    } catch (err) {
      console.error("Errore eliminazione nota:", err);
      haptics.error();
    }
  };

  const handleTogglePin = async (note: NoteItem, e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.tap();
    await NoteService.togglePin(note.id);
    await loadData();
  };

  const handleToggleComplete = async (note: NoteItem, e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.tap();
    await NoteService.toggleComplete(note.id);
    await loadData();
  };

  const handleCopy = (note: NoteItem, e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.tap();
    const textToCopy = `${note.titolo}\n\n${note.contenuto}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(note.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddTag = () => {
    const trimmed = formTagInput.trim().replace(/^#/, '');
    if (trimmed && !formTags.includes(trimmed)) {
      setFormTags([...formTags, trimmed]);
      setFormTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormTags(formTags.filter(t => t !== tagToRemove));
  };

  // Elenco unico delle categorie presenti
  const availableCategories = useMemo(() => {
    const set = new Set(['IDEE', 'RISPARMIO', 'PROGETTI', 'ACQUISTI', 'FAMIGLIA', 'INVESTIMENTI', 'ALTRO']);
    notes.forEach(n => {
      if (n.categoria) set.add(n.categoria.toUpperCase());
    });
    return Array.from(set);
  }, [notes]);

  // Filtro ricerca e categoria
  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      const matchCat = selectedCategory === 'ALL' || (n.categoria && n.categoria.toUpperCase() === selectedCategory);
      if (!matchCat) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const inTitle = (n.titolo || '').toLowerCase().includes(q);
      const inContent = (n.contenuto || '').toLowerCase().includes(q);
      const inTags = (n.tag || []).some(t => t.toLowerCase().includes(q));
      const inCategory = (n.categoria || '').toLowerCase().includes(q);
      return inTitle || inContent || inTags || inCategory;
    });
  }, [notes, selectedCategory, searchQuery]);

  // Statistiche rapide
  const stats = useMemo(() => {
    const total = notes.length;
    const pinned = notes.filter(n => n.fissata).length;
    const completed = notes.filter(n => n.completata).length;
    return { total, pinned, completed };
  }, [notes]);

  // Raggruppamento per Categoria (Note)
  const groupedByCategory = useMemo(() => {
    const map = new Map<string, NoteItem[]>();
    filteredNotes.forEach(n => {
      const cat = (n.categoria || 'IDEE').toUpperCase();
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(n);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filteredNotes]);

  // Raggruppamento per Data
  const groupedByDate = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);

    const groups: { [key: string]: { label: string; notes: NoteItem[]; order: number } } = {
      TODAY: { label: 'Oggi', notes: [], order: 1 },
      YESTERDAY: { label: 'Ieri', notes: [], order: 2 },
      THIS_WEEK: { label: 'Questa Settimana', notes: [], order: 3 },
      THIS_MONTH: { label: 'Questo Mese', notes: [], order: 4 },
      OLDER: { label: 'Precedenti & Archivio', notes: [], order: 5 }
    };

    filteredNotes.forEach(n => {
      const noteDate = n.data_creazione ? n.data_creazione.split('T')[0] : todayStr;
      if (noteDate === todayStr) {
        groups.TODAY.notes.push(n);
      } else if (noteDate === yesterdayStr) {
        groups.YESTERDAY.notes.push(n);
      } else {
        const d = new Date(noteDate);
        if (d >= weekAgo) {
          groups.THIS_WEEK.notes.push(n);
        } else if (d >= monthAgo) {
          groups.THIS_MONTH.notes.push(n);
        } else {
          groups.OLDER.notes.push(n);
        }
      }
    });

    return Object.values(groups)
      .filter(g => g.notes.length > 0)
      .sort((a, b) => a.order - b.order);
  }, [filteredNotes]);

  return (
    <div id="notepad-view" className="space-y-6 animate-fadeIn pb-16 bg-slate-50 dark:bg-slate-950/40 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
      {/* SEZIONE TITOLO PAGINA & AZIONI CONTESTUALI */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <StickyNote size={22} />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Blocco Note & Idee <span className="hidden md:inline text-base font-mono font-normal text-slate-400 dark:text-slate-500">(I)</span>
            </h1>
            <TabHeaderInfo text="Scrivi e organizza liberamente le tue idee di spesa, risparmio e progetti familiari" />
          </div>
        </div>

        <button
          id="btn-new-note"
          onClick={() => openNewNoteModal()}
          className="bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-medium text-sm px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-xs active:scale-95 self-start sm:self-auto cursor-pointer"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>Nuova Idea</span>
        </button>
      </div>

      {/* METRICHE & KPI CARDS (3 colonne in bg-white con bordi border-slate-200/80 e rounded-2xl) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium block mb-0.5">Idee Totali</span>
            <span className="font-numeric text-xl font-bold text-slate-900 dark:text-white">{stats.total}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
            <StickyNote size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium block mb-0.5">In Evidenza</span>
            <span className="font-numeric text-xl font-bold text-indigo-600 dark:text-indigo-400">{stats.pinned}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Pin size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium block mb-0.5">Realizzate</span>
            <span className="font-numeric text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.completed}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* Controls & Grouping Bar (Card in bg-white con bordi border-slate-200/80 e rounded-2xl) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box with rounded-xl */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="search-notes"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca per titolo, testo dell'idea, categoria o #tag..."
              className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-[#252528] border border-slate-200/80 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-xl cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Group By Segmented Control */}
          <div className="flex items-center gap-1.5 self-start md:self-auto bg-slate-100 dark:bg-[#252528] p-1 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <span className="text-xs text-slate-400 uppercase font-semibold px-2 hidden sm:inline-block">Raggruppa:</span>
            <button
              id="group-by-notes"
              onClick={() => {
                haptics.tap();
                setGroupBy('NOTE');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                groupBy === 'NOTE'
                  ? 'bg-white dark:bg-[#323236] text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers size={13} />
              <span>Per Categorie</span>
            </button>
            <button
              id="group-by-date"
              onClick={() => {
                haptics.tap();
                setGroupBy('DATA');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                groupBy === 'DATA'
                  ? 'bg-white dark:bg-[#323236] text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CalendarDays size={13} />
              <span>Per Data</span>
            </button>
            <button
              id="group-by-all"
              onClick={() => {
                haptics.tap();
                setGroupBy('TUTTI');
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                groupBy === 'TUTTI'
                  ? 'bg-white dark:bg-[#323236] text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Tutte</span>
            </button>
          </div>
        </div>

        {/* Category Pills Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          <button
            onClick={() => {
              haptics.tap();
              setSelectedCategory('ALL');
            }}
            className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === 'ALL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-[#252528] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#2c2c30]'
            }`}
          >
            Tutte ({notes.length})
          </button>
          {availableCategories.map(cat => {
            const count = notes.filter(n => (n.categoria || '').toUpperCase() === cat).length;
            const icon = CATEGORY_ICONS[cat] || '🏷️';
            return (
              <button
                key={cat}
                onClick={() => {
                  haptics.tap();
                  setSelectedCategory(cat);
                }}
                className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-[#252528] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#2c2c30]'
                }`}
              >
                <span>{icon}</span>
                <span>{cat.charAt(0) + cat.slice(1).toLowerCase()}</span>
                <span className="opacity-70 text-xs">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      {filteredNotes.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
            <Lightbulb size={32} />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {searchQuery ? 'Nessuna idea trovata' : 'Nessuna nota presente'}
          </h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm max-w-sm mt-1 mb-4">
            {searchQuery
              ? 'Prova a modificare i filtri di ricerca o la categoria selezionata.'
              : 'Usa questo spazio per annotare spunti di risparmio, acquisti futuri o progetti della famiglia.'}
          </p>
          <button
            onClick={() => openNewNoteModal()}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer"
          >
            + Aggiungi la prima idea
          </button>
        </div>
      ) : groupBy === 'NOTE' ? (
        /* RAGGRUPPAMENTO PER NOTA / CATEGORIA */
        <div className="space-y-6">
          {groupedByCategory.map(([categoryName, groupNotes]) => {
            const icon = CATEGORY_ICONS[categoryName] || '🏷️';
            return (
              <div key={categoryName} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{icon}</span>
                    <h2 className="text-slate-900 dark:text-white font-semibold text-sm tracking-wide">
                      {categoryName}
                    </h2>
                    <span className="text-xs text-slate-400 font-semibold px-2 py-0.5 rounded-xl bg-slate-200/70 dark:bg-slate-800">
                      {groupNotes.length}
                    </span>
                  </div>
                  <button
                    onClick={() => openNewNoteModal(categoryName)}
                    className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Aggiungi a {categoryName.toLowerCase()}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupNotes.map(note => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      projects={projects}
                      copiedId={copiedId}
                      onEdit={() => openEditNoteModal(note)}
                      onDelete={() => handleDeleteNote(note)}
                      onTogglePin={(e) => handleTogglePin(note, e)}
                      onToggleComplete={(e) => handleToggleComplete(note, e)}
                      onCopy={(e) => handleCopy(note, e)}
                      onOpenNewTransaction={onOpenNewTransaction}
                      onNavigateToProjects={onNavigateToProjects}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : groupBy === 'DATA' ? (
        /* RAGGRUPPAMENTO PER DATA */
        <div className="space-y-6">
          {groupedByDate.map(group => (
            <div key={group.label} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Calendar size={15} className="text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-slate-900 dark:text-white font-semibold text-sm tracking-wide">
                    {group.label}
                  </h2>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-900/40">
                    {group.notes.length}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.notes.map(note => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    projects={projects}
                    copiedId={copiedId}
                    onEdit={() => openEditNoteModal(note)}
                    onDelete={() => handleDeleteNote(note)}
                    onTogglePin={(e) => handleTogglePin(note, e)}
                    onToggleComplete={(e) => handleToggleComplete(note, e)}
                    onCopy={(e) => handleCopy(note, e)}
                    onOpenNewTransaction={onOpenNewTransaction}
                    onNavigateToProjects={onNavigateToProjects}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TUTTE IN GRIGLIA UNICA */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              projects={projects}
              copiedId={copiedId}
              onEdit={() => openEditNoteModal(note)}
              onDelete={() => handleDeleteNote(note)}
              onTogglePin={(e) => handleTogglePin(note, e)}
              onToggleComplete={(e) => handleToggleComplete(note, e)}
              onCopy={(e) => handleCopy(note, e)}
              onOpenNewTransaction={onOpenNewTransaction}
              onNavigateToProjects={onNavigateToProjects}
            />
          ))}
        </div>
      )}

      {/* Modal Creazione / Modifica Idea o Nota (Card in bg-white con bordi border-slate-200/80 e rounded-2xl) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <StickyNote size={18} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    {editingNote ? 'Modifica Idea' : 'Nuova Idea o Nota'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingNote ? editingNote.nota_id : 'Annota le tue idee e raggruppale'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1.5 rounded-xl cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveNote} className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Titolo */}
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-300 font-medium block mb-1">
                  Titolo dell'Idea
                </label>
                <input
                  type="text"
                  required
                  value={formTitolo}
                  onChange={(e) => setFormTitolo(e.target.value)}
                  placeholder="Es. Idee per abbattere i costi delle bollette..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-[#252528] text-slate-900 dark:text-white rounded-xl border border-slate-200/80 dark:border-slate-700/80 outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              {/* Contenuto Testo */}
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-300 font-medium block mb-1">
                  Testo / Appunti dell'Idea
                </label>
                <textarea
                  rows={5}
                  value={formContenuto}
                  onChange={(e) => setFormContenuto(e.target.value)}
                  placeholder="Scrivi qui i dettagli, elenchi puntati o passaggi per realizzare questa idea..."
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-[#252528] text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200/80 dark:border-slate-700/80 outline-none focus:border-indigo-500 font-normal leading-relaxed resize-y"
                />
              </div>

              {/* Categoria & Data */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-300 font-medium block mb-1">
                    Categoria Argomento
                  </label>
                  <select
                    value={formCategoria}
                    onChange={(e) => setFormCategoria(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#252528] text-slate-900 dark:text-white rounded-xl border border-slate-200/80 dark:border-slate-700/80 outline-none focus:border-indigo-500 font-semibold"
                  >
                    <option value="IDEE">💡 Idee Generali</option>
                    <option value="RISPARMIO">💰 Risparmio & Spese</option>
                    <option value="PROGETTI">🎯 Progetti & Obiettivi</option>
                    <option value="ACQUISTI">🛍️ Acquisti & Wishlist</option>
                    <option value="FAMIGLIA">👨‍👩‍👧 Famiglia</option>
                    <option value="INVESTIMENTI">📈 Investimenti & PAC</option>
                    <option value="ALTRO">📝 Altro</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-300 font-medium block mb-1">
                    Data
                  </label>
                  <input
                    type="date"
                    value={formDataCreazione}
                    onChange={(e) => setFormDataCreazione(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#252528] text-slate-900 dark:text-white rounded-xl border border-slate-200/80 dark:border-slate-700/80 outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
              </div>

              {/* Colore Tema */}
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-300 font-medium block mb-1.5">
                  Colore Accento
                </label>
                <div className="flex items-center gap-2">
                  {NOTE_COLORS.map(c => (
                    <button
                      key={c.bg}
                      type="button"
                      onClick={() => setFormColore(c.bg)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                        formColore === c.bg ? 'scale-110 border-slate-900 dark:border-white shadow-xs' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c.bg }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              {/* Tag & Etichette */}
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-300 font-medium block mb-1">
                  Tag / Etichette (premi Invio o aggiungi)
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Tag size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={formTagInput}
                      onChange={(e) => setFormTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      placeholder="Aggiungi tag (es. Casa, Vacanze, Auto)..."
                      className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-[#252528] text-slate-900 dark:text-white rounded-xl border border-slate-200/80 dark:border-slate-700/80 outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 cursor-pointer"
                  >
                    Aggiungi
                  </button>
                </div>
                {formTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {formTags.map(t => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-900/40"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(t)}
                          className="hover:text-red-500 rounded-lg p-0.5 cursor-pointer"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Associa a Progetto o Finanziamento */}
              {projects.length > 0 && (
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-300 font-medium block mb-1">
                    Collega a Progetto Esistente (Opzionale)
                  </label>
                  <select
                    value={formProgettoId}
                    onChange={(e) => setFormProgettoId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#252528] text-slate-900 dark:text-white rounded-xl border border-slate-200/80 dark:border-slate-700/80 outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="">Nessun progetto collegato</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.tipo}: {p.nome_progetto}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Fissa in Alto (Pin) */}
              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={formFissata}
                    onChange={(e) => setFormFissata(e.target.checked)}
                    className="w-4 h-4 rounded-md text-indigo-600 focus:ring-indigo-500 dark:bg-[#252528] border-slate-300 dark:border-slate-700"
                  />
                  <span>Fissa questa idea in evidenza in alto</span>
                </label>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div>
                  {editingNote && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = editingNote;
                        setIsModalOpen(false);
                        setNoteToDelete(target);
                      }}
                      className="px-3 py-2 text-xs font-semibold text-[#E31B23] hover:bg-red-500/10 rounded-full flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                      <span>Elimina idea</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-full cursor-pointer"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-xs transition-all cursor-pointer active:scale-95"
                  >
                    {editingNote ? 'Salva Modifiche' : 'Crea Idea'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dialog di Conferma Eliminazione Idea (Samsung One UI Style) */}
      {noteToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#1C1C1E] text-[#F5F5F7] rounded-[24px] border border-white/10 p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[14px] bg-red-500/15 text-[#E31B23] flex items-center justify-center shrink-0">
                <Trash2 size={20} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h4 className="text-base font-medium text-[#F5F5F7]">Elimina Idea</h4>
                <p className="text-xs text-[#8E8E93] truncate">Azione irreversibile</p>
              </div>
            </div>

            <p className="text-sm text-[#8E8E93] leading-relaxed">
              Vuoi davvero eliminare l'idea <span className="font-semibold text-[#F5F5F7]">"{noteToDelete.titolo}"</span>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNoteToDelete(null)}
                className="px-4 py-2 text-xs font-medium text-[#F5F5F7] bg-[#2A2A2E] hover:bg-[#343438] rounded-full transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={confirmDeleteNote}
                className="px-5 py-2 text-xs font-medium text-white bg-[#E31B23] hover:bg-red-700 rounded-full transition-all active:scale-95 cursor-pointer"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface NoteCardProps {
  note: NoteItem;
  projects: Project[];
  copiedId: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: (e: React.MouseEvent) => void;
  onToggleComplete: (e: React.MouseEvent) => void;
  onCopy: (e: React.MouseEvent) => void;
  onOpenNewTransaction?: () => void;
  onNavigateToProjects?: () => void;
}

const NoteCard: React.FC<NoteCardProps> = ({
  note,
  projects,
  copiedId,
  onEdit,
  onDelete,
  onTogglePin,
  onToggleComplete,
  onCopy,
  onOpenNewTransaction,
  onNavigateToProjects
}) => {
  const linkedProject = useMemo(() => {
    if (!note.collegamento_progetto_id) return null;
    return projects.find(p => p.id === note.collegamento_progetto_id || p.progetto_id === note.collegamento_progetto_id);
  }, [note.collegamento_progetto_id, projects]);

  const catIcon = CATEGORY_ICONS[note.categoria?.toUpperCase() || 'IDEE'] || '💡';

  return (
    <div
      onClick={onEdit}
      className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between cursor-pointer group hover:border-indigo-300 dark:hover:border-indigo-700/80 transition-all hover:shadow-md relative ${
        note.fissata ? 'ring-2 ring-indigo-500/30 bg-indigo-50/20 dark:bg-indigo-950/15' : 'shadow-xs'
      }`}
    >
      {/* Top Card Bar */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs">{catIcon}</span>
            <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider px-2 py-0.5 rounded-xl bg-slate-100 dark:bg-slate-800">
              {note.categoria}
            </span>
            {note.fissata && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                <Pin size={10} /> In evidenza
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onTogglePin}
              title={note.fissata ? "Rimuovi da evidenza" : "Fissa in evidenza"}
              className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                note.fissata
                  ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Pin size={14} />
            </button>

            <button
              onClick={onCopy}
              title="Copia testo negli appunti"
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {copiedId === note.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Elimina nota"
              className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Titolo */}
        <h3 className={`text-slate-900 dark:text-white font-semibold text-base leading-snug mb-2 ${
          note.completata ? 'line-through text-slate-400 dark:text-slate-500' : ''
        }`}>
          {note.titolo}
        </h3>

        {/* Contenuto Testo con a capo preservati */}
        <div className="text-slate-600 dark:text-slate-300 text-sm whitespace-pre-wrap leading-relaxed line-clamp-6 mb-3 font-normal">
          {note.contenuto || <span className="italic text-slate-400 text-xs">Nessun dettaglio scritto...</span>}
        </div>

        {/* Tags */}
        {note.tag && note.tag.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {note.tag.map((t, idx) => (
              <span
                key={idx}
                className="text-xs text-slate-400 font-medium px-2 py-0.5 rounded-xl bg-slate-100 dark:bg-slate-800"
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        {/* Progetto Collegato */}
        {linkedProject && (
          <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between text-xs mb-3">
            <div className="flex items-center gap-1.5 truncate">
              <FolderKanban size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="font-semibold text-slate-900 dark:text-slate-200 truncate">
                {linkedProject.nome_progetto}
              </span>
            </div>
            {onNavigateToProjects && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToProjects();
                }}
                className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:underline shrink-0 ml-1 cursor-pointer"
              >
                Vedi Progetto
              </button>
            )}
          </div>
        )}
      </div>

      {/* Card Footer Bar */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <Calendar size={12} />
          <span>{note.data_creazione || 'Recente'}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Pulsante Segna Realizzata / Completata */}
          <button
            onClick={onToggleComplete}
            title={note.completata ? "Segna come da fare" : "Segna come realizzata"}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl font-semibold transition-colors cursor-pointer ${
              note.completata
                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {note.completata ? <CheckCircle2 size={13} /> : <Circle size={13} />}
            <span className="text-xs">{note.completata ? 'Realizzata' : 'Da fare'}</span>
          </button>

          <span className="font-mono text-xs text-slate-400 dark:text-slate-600">
            {note.nota_id}
          </span>
        </div>
      </div>
    </div>
  );
};
