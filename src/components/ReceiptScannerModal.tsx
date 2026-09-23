import React, { useState, useRef } from 'react';
import { 
  Camera, 
  Upload, 
  X, 
  Sparkles, 
  Loader2, 
  Check, 
  Receipt, 
  AlertCircle,
  Store,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Subcategory, MovementNecessity } from '../types';
import { formatCurrency } from '../utils/formatters';
import { haptics } from '../utils/haptics';

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  subcategories: Subcategory[];
  onReceiptScanned: (data: {
    importo: number;
    descrizione: string;
    data?: string;
    sottocategoria_id?: string;
    necessita?: MovementNecessity;
  }) => void;
}

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({
  isOpen,
  onClose,
  subcategories,
  onReceiptScanned
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<{
    importo: number;
    descrizione: string;
    data?: string;
    sottocategoria_suggerita?: string;
    necessita_suggerita?: MovementNecessity;
    dettaglio_articoli?: string[];
    confidenza?: string;
  } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsScanning(true);
    setScannedResult(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        setPreviewImage(base64);

        try {
          const res = await fetch('/api/scan-receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: base64,
              mimeType: file.type || 'image/jpeg',
              subcategories: subcategories.map(s => ({ id: s.id, nome: s.nome, tipo: s.tipo }))
            })
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Errore durante la scansione dello scontrino');
          }

          const responseData = await res.json();
          if (responseData.success && responseData.data) {
            setScannedResult(responseData.data);
            haptics.success();
          } else {
            throw new Error('Nessun dato valido estratto dallo scontrino.');
          }
        } catch (apiErr: any) {
          console.error(apiErr);
          setError(apiErr.message || 'Errore comunicazione server durante OCR Gemini.');
          haptics.error();
        } finally {
          setIsScanning(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError('Impossibile caricare il file selezionato.');
      setIsScanning(false);
    }
  };

  const handleApply = () => {
    if (!scannedResult) return;

    // Trova la sottocategoria corrispondente se presente
    let matchedSubId = subcategories[0]?.id;
    if (scannedResult.sottocategoria_suggerita) {
      const found = subcategories.find(s => 
        s.nome.toLowerCase().includes(scannedResult.sottocategoria_suggerita!.toLowerCase()) ||
        scannedResult.sottocategoria_suggerita!.toLowerCase().includes(s.nome.toLowerCase())
      );
      if (found) matchedSubId = found.id;
    }

    onReceiptScanned({
      importo: scannedResult.importo || 0,
      descrizione: scannedResult.descrizione || 'Spesa da scontrino',
      data: scannedResult.data || new Date().toISOString().split('T')[0],
      sottocategoria_id: matchedSubId,
      necessita: scannedResult.necessita_suggerita || 'HO_BISOGNO'
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-white dark:bg-[#1C1C1E] rounded-[26px] shadow-2xl border border-slate-200/90 dark:border-white/10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[11px] bg-[#E31B23]/15 text-[#E31B23] flex items-center justify-center">
              <Camera size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#F5F5F7]">Scanner Scontrini AI</h3>
              <p className="text-[11px] text-slate-400 dark:text-[#8E8E93]">Gemini Vision OCR automatico</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-[#F5F5F7] hover:bg-slate-100 dark:hover:bg-[#242426]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 no-scrollbar">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />

          {!previewImage && !isScanning && (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 dark:border-white/10 hover:border-[#E31B23] dark:hover:border-[#E31B23] rounded-[22px] p-8 text-center cursor-pointer transition-all bg-slate-50/50 dark:bg-[#242426]/40 hover:bg-slate-50 dark:hover:bg-[#242426] group space-y-3"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#E31B23]/15 text-[#E31B23] flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                <Camera size={28} strokeWidth={2} />
              </div>
              <div>
                <span className="block text-sm font-bold text-slate-900 dark:text-[#F5F5F7]">
                  Scatta o Carica Foto Scontrino
                </span>
                <span className="block text-xs text-slate-400 dark:text-[#8E8E93] mt-1">
                  Supporta JPG, PNG, ricevute fiscali e fatture
                </span>
              </div>
            </div>
          )}

          {isScanning && (
            <div className="py-12 text-center space-y-3">
              <div className="relative w-16 h-16 mx-auto">
                <Loader2 size={64} className="text-[#E31B23] animate-spin opacity-80" />
                <Sparkles size={22} className="text-[#E31B23] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-[#F5F5F7]">
                Gemini sta analizzando lo scontrino...
              </p>
              <p className="text-xs text-slate-400 dark:text-[#8E8E93]">
                Estrazione importo, data, commerciante e classificazione 50/30/20
              </p>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-[16px] bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Errore scansione</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {scannedResult && !isScanning && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
              <div className="p-4 rounded-[20px] bg-slate-50 dark:bg-[#242426] border border-slate-200/80 dark:border-white/5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/5 pb-2.5">
                  <span className="text-xs font-bold text-slate-400 dark:text-[#8E8E93] uppercase tracking-wider">
                    Dati Rilevati con AI
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-500/15 text-emerald-500 flex items-center gap-1">
                    <Check size={11} strokeWidth={3} /> Alta Precisione
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-slate-400 dark:text-[#8E8E93]">Importo Totale</span>
                    <p className="text-xl font-bold font-numeric tabular-nums text-[#E31B23]">
                      {formatCurrency(scannedResult.importo || 0)}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-slate-400 dark:text-[#8E8E93]">Commerciante</span>
                    <p className="text-sm font-bold text-slate-900 dark:text-[#F5F5F7] truncate">
                      {scannedResult.descrizione || 'Non specificato'}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-slate-400 dark:text-[#8E8E93]">Data</span>
                    <p className="text-xs font-semibold text-slate-700 dark:text-[#8E8E93]">
                      {scannedResult.data || 'Oggi'}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-slate-400 dark:text-[#8E8E93]">Categoria Suggerita</span>
                    <p className="text-xs font-bold text-indigo-500 truncate">
                      {scannedResult.sottocategoria_suggerita || 'Alimentari'}
                    </p>
                  </div>
                </div>

                {scannedResult.dettaglio_articoli && scannedResult.dettaglio_articoli.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 space-y-1">
                    <span className="text-[10.5px] font-semibold text-slate-400 dark:text-[#8E8E93] block">Articoli Rilevati:</span>
                    <div className="max-h-24 overflow-y-auto space-y-0.5 text-[11px] text-slate-600 dark:text-[#8E8E93]">
                      {scannedResult.dettaglio_articoli.map((art, idx) => (
                        <div key={idx} className="truncate">• {art}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-[#242426] text-slate-700 dark:text-[#F5F5F7] hover:bg-slate-200"
                >
                  Riprova
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="flex-2 py-2.5 rounded-full text-xs font-bold bg-[#E31B23] text-white hover:bg-[#c9171e] flex items-center justify-center gap-1.5 shadow-md shadow-red-600/20"
                >
                  <Check size={14} strokeWidth={2.5} />
                  <span>Compila Movimento</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
