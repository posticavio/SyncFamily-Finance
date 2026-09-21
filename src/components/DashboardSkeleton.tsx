import React from 'react';

/**
 * Skeleton Loader per la Dashboard Bento-Grid.
 * Previene il layout shifting (flickering) durante il caricamento iniziale dei dati,
 * replicando fedelmente proporzioni, altezze e card della visualizzazione finale.
 */
export const DashboardSkeleton: React.FC = () => {
  return (
    <div id="dashboard-skeleton-loader" className="space-y-6 animate-pulse">
      {/* 1. Indicatore Notifica / Scadenze Imminenti Skeleton */}
      <div className="bento-card p-4 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-slate-200 dark:bg-slate-800 flex-shrink-0" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-40 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-2.5 w-56 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
          </div>
        </div>
        <div className="h-7 w-24 bg-slate-100 dark:bg-slate-800/70 rounded-xl hidden sm:block" />
      </div>

      {/* 2. Grid Principale Bento: Triple Forecast (Saldo Oggi, Fine Mese, 9 Mese Succ.) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Card 1: Saldo Oggi */}
        <div className="bento-card p-5 h-[170px] flex flex-col justify-between border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="h-3 w-28 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          </div>
          <div className="space-y-2 my-1">
            <div className="h-8 w-44 bg-slate-200 dark:bg-slate-700 rounded-xl" />
            <div className="h-3 w-36 bg-slate-100 dark:bg-slate-800/80 rounded-md" />
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="h-2.5 w-32 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
          </div>
        </div>

        {/* Card 2: Saldo Fine Mese */}
        <div className="bento-card p-5 h-[170px] flex flex-col justify-between border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          </div>
          <div className="space-y-2 my-1">
            <div className="h-8 w-40 bg-slate-200 dark:bg-slate-700 rounded-xl" />
            <div className="h-3 w-48 bg-slate-100 dark:bg-slate-800/80 rounded-md" />
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="h-2.5 w-24 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
            <div className="h-2.5 w-16 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
          </div>
        </div>

        {/* Card 3: Saldo al 9 Mese Succ. */}
        <div className="bento-card p-5 h-[170px] flex flex-col justify-between border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-4 w-20 bg-slate-100 dark:bg-slate-800 rounded-full" />
          </div>
          <div className="space-y-2 my-1">
            <div className="h-8 w-40 bg-slate-200 dark:bg-slate-700 rounded-xl" />
            <div className="h-3 w-52 bg-slate-100 dark:bg-slate-800/80 rounded-md" />
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="h-2.5 w-28 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
            <div className="h-2.5 w-24 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
          </div>
        </div>
      </div>

      {/* 3. Row 2: Entrate, Uscite e Risultato Netto Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bento-card p-4 flex items-center justify-between border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="space-y-2">
              <div className="h-2.5 w-20 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-6 w-28 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            </div>
            <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800" />
          </div>
        ))}
      </div>

      {/* 4. Row 3: Grafico 30 Giorni Spese vs Entrate Skeleton */}
      <div className="bento-card p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1.5">
            <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-3 w-64 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-20 bg-slate-100 dark:bg-slate-800 rounded-lg" />
            <div className="h-6 w-20 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          </div>
        </div>
        {/* Placeholder Grafico ad area/linea */}
        <div className="h-56 sm:h-64 w-full rounded-2xl bg-slate-100/70 dark:bg-slate-800/60 flex items-end justify-between p-4 gap-2">
          {[35, 50, 25, 70, 45, 60, 30, 80, 55, 40, 65, 50].map((h, idx) => (
            <div
              key={idx}
              className="flex-1 bg-slate-200/60 dark:bg-slate-800/80 rounded-t-md"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>

      {/* 5. Row 4: Sezione Conti & Fondi Skeleton */}
      <div className="bento-card p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1.5">
            <div className="h-4 w-44 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-3 w-56 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
          </div>
          <div className="h-8 w-32 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        </div>

        {/* Griglia Card Conti */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {[1, 2, 3].map((cardIdx) => (
            <div key={cardIdx} className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800" />
                  <div className="space-y-1">
                    <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded-md" />
                    <div className="h-2 w-16 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
                  </div>
                </div>
                <div className="w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded-lg" />
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="h-2.5 w-16 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
                <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Row 5: Movimenti Recenti Skeleton */}
      <div className="bento-card p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-3 w-48 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
          </div>
          <div className="h-7 w-28 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          {[1, 2, 3, 4].map((itemIdx) => (
            <div key={itemIdx} className="p-3 flex items-center justify-between gap-3 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-slate-100 dark:bg-slate-800 flex-shrink-0" />
                <div className="space-y-1 min-w-0">
                  <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded-md" />
                  <div className="h-2.5 w-44 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
                </div>
              </div>
              <div className="space-y-1 text-right flex-shrink-0">
                <div className="h-3.5 w-18 bg-slate-200 dark:bg-slate-800 rounded-md ml-auto" />
                <div className="h-2 w-12 bg-slate-100 dark:bg-slate-800/60 rounded-md ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
