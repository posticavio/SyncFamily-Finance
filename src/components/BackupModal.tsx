import React, { useState } from 'react';
import { X, Download, Upload, RefreshCw, Check, AlertCircle, Cloud, Smartphone, Monitor } from 'lucide-react';
import { exportDatabaseJSON, importDatabaseJSON, resetToInitialDatabase } from '../services/store';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [importText, setImportText] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleDownloadBackup = () => {
    const jsonStr = exportDatabaseJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `backup-finanze-familiari-${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStatusMessage({ type: 'success', text: 'Backup scaricato con successo sul tuo dispositivo!' });
  };

  const handleImport = async () => {
    if (!importText.trim()) {
      setStatusMessage({ type: 'error', text: 'Incolla il contenuto del file JSON di backup prima di procedere.' });
      return;
    }

    const result = await importDatabaseJSON(importText);
    if (result.success) {
      setStatusMessage({ type: 'success', text: `${result.message} Record importati con successo.` });
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } else {
      setStatusMessage({ type: 'error', text: result.message });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportText(content);
    };
    reader.readAsText(file);
  };

  const handleResetData = async () => {
    if (confirm("Attenzione: ripristinerai i dati demo iniziali. Vuoi procedere?")) {
      await resetToInitialDatabase();
      setStatusMessage({ type: 'success', text: 'Database ripristinato allo stato iniziale con dati di esempio.' });
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        id="backup-sync-dialog"
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-100"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Cloud size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Sincronizzazione & Backup</h3>
              <p className="text-xs text-slate-400">Archivio unico online multi-dispositivo</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 no-scrollbar">
          {/* Multi-device architecture info */}
          <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700 flex-shrink-0">
              <Smartphone size={18} />
            </div>
            <div className="text-xs text-slate-600 leading-relaxed">
              <span className="font-semibold text-slate-900 block mb-0.5">
                Architettura Multi-Dispositivo Attiva
              </span>
              L'applicazione è progettata con schema dati unico conforme alle specifiche per smartphone (Android, iOS), tablet e PC. Tutte le transazioni e i calcoli risiedono nel modello relazionale persistente.
            </div>
          </div>

          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {statusMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Export section */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
              1. Esporta Backup JSON
            </h4>
            <p className="text-xs text-slate-500">
              Scarica una copia istantanea e completa di tutti i conti, fondi, movimenti, budget e scadenze.
            </p>
            <button
              id="btn-download-backup"
              onClick={handleDownloadBackup}
              className="w-full py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              <Download size={15} />
              <span>Scarica Backup Completo (.json)</span>
            </button>
          </div>

          {/* Import section */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
              2. Ripristina da File di Backup
            </h4>
            <p className="text-xs text-slate-500">
              Carica un file JSON precedentemente esportato da un altro dispositivo.
            </p>
            
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />

            <textarea
              rows={3}
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder="Oppure incolla qui il codice JSON del backup..."
              className="w-full p-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white resize-none"
            />

            <button
              id="btn-restore-backup"
              onClick={handleImport}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              <Upload size={15} />
              <span>Ripristina Archivio</span>
            </button>
          </div>

          {/* Reset button */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">Dati di test o reset:</span>
            <button
              onClick={handleResetData}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw size={13} />
              <span>Ripristina Demo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
