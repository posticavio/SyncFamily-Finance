import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { DailyForecastPoint } from '../types';
import { formatCurrency, formatItalianNumber } from '../utils/formatters';
import { TrendingUp, TrendingDown, Calendar, Sparkles } from 'lucide-react';

interface AccountForecastChartProps {
  data: DailyForecastPoint[];
  totaleOggiCalcolato: number;
  totaleFineMese: number;
  totaleAlNove: number;
}

export const AccountForecastChart: React.FC<AccountForecastChartProps> = ({
  data,
  totaleOggiCalcolato,
  totaleFineMese,
  totaleAlNove
}) => {
  const [rangeDays, setRangeDays] = useState<15 | 30>(30);

  const displayData = rangeDays === 15 ? data.slice(0, 16) : data;

  const startBalance = data[0]?.balance ?? totaleOggiCalcolato;
  const currentEndBalance = displayData[displayData.length - 1]?.balance ?? startBalance;
  const netChange = Math.round((currentEndBalance - startBalance) * 100) / 100;
  const isPositiveTrend = netChange >= 0;

  // Calcolo estremi nel periodo
  const balances = displayData.map(d => d.balance);
  const minBalance = balances.length > 0 ? Math.min(...balances) : startBalance;
  const maxBalance = balances.length > 0 ? Math.max(...balances) : startBalance;

  // Calcolo dominio Y minimalista e proporzionato
  const paddingY = Math.max(Math.round((maxBalance - minBalance) * 0.15), 100);
  const yDomainMin = Math.floor((minBalance - paddingY) / 100) * 100;
  const yDomainMax = Math.ceil((maxBalance + paddingY) / 100) * 100;

  // Tooltip minimale con effetto vetro e tipografia ad alta leggibilità
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload as DailyForecastPoint;
      const dayDiff = point.netChange;

      return (
        <div className="bg-white/95 backdrop-blur-md px-3.5 py-3 rounded-2xl shadow-xl border border-slate-200/80 text-xs min-w-[210px] z-50">
          <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-slate-100">
            <span className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Calendar size={13} className="text-indigo-600" />
              {point.displayDate}
              {point.isToday && (
                <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                  Oggi
                </span>
              )}
              {point.isMonthEnd && (
                <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                  Fine Mese
                </span>
              )}
              {point.isNinthNextMonth && (
                <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                  9° Mese Succ.
                </span>
              )}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              +{point.dayNumber} gg
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Saldo Previsto:</span>
              <span className="font-numeric font-extrabold text-sm text-slate-900">
                {formatCurrency(point.balance)}
              </span>
            </div>

            {dayDiff !== 0 && (
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100/60">
                <span className="text-slate-400">Variazione del giorno:</span>
                <span className={`font-numeric font-bold ${dayDiff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(dayDiff, { showSign: true })}
                </span>
              </div>
            )}

            {point.events && point.events.length > 0 && (
              <div className="pt-2 mt-1 border-t border-slate-100">
                <span className="text-[10px] font-semibold text-slate-400 block mb-1">
                  Movimenti previsti:
                </span>
                <ul className="space-y-0.5 max-h-24 overflow-y-auto no-scrollbar">
                  {point.events.map((ev, idx) => (
                    <li key={idx} className="text-[11px] text-slate-700 leading-tight">
                      • {ev}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bento-card p-5 sm:p-6 space-y-4">
      {/* Intestazione del Grafico con Trend e Toggle a 15/30 giorni */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Account Forecast
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100/80">
              <Sparkles size={10} />
              Prossimi {rangeDays} Giorni
            </span>
          </div>

          <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Andamento Saldo Calcolato</span>
            <span className={`text-xs font-numeric font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
              isPositiveTrend ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              {isPositiveTrend ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {formatCurrency(netChange, { showSign: true })}
            </span>
          </h3>
        </div>

        {/* Range Selector minimale stile pillola */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex bg-slate-100/80 p-1 rounded-2xl text-xs font-semibold">
            <button
              onClick={() => setRangeDays(15)}
              className={`px-3 py-1 rounded-xl transition-all ${
                rangeDays === 15 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              15 Giorni
            </button>
            <button
              onClick={() => setRangeDays(30)}
              className={`px-3 py-1 rounded-xl transition-all ${
                rangeDays === 30 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              30 Giorni
            </button>
          </div>
        </div>
      </div>

      {/* Indicatori minimi sintetici */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-slate-50/70 border border-slate-100 text-xs">
        <div>
          <span className="text-[10px] text-slate-400 block">Saldo Attuale (Oggi)</span>
          <span className="font-numeric font-bold text-slate-800">
            {formatCurrency(startBalance)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 block">Saldo Fine Mese</span>
          <span className="font-numeric font-bold text-indigo-600">
            {formatCurrency(totaleFineMese)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 block">Saldo al 9 Mese Succ.</span>
          <span className="font-numeric font-bold text-slate-700">
            {formatCurrency(totaleAlNove)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 block">Range Min / Max</span>
          <span className="font-numeric font-bold text-slate-800">
            {formatCurrency(minBalance)} — {formatCurrency(maxBalance)}
          </span>
        </div>
      </div>

      {/* Grafico Lineare Recharts con Gradiente Sottile e Assi Minimalisti */}
      <div className="w-full h-64 sm:h-72 pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={displayData} margin={{ top: 12, right: 10, left: -14, bottom: 0 }}>
            <defs>
              {/* Gradiente cromatico orizzontale sottile per la linea (Indigo -> Viola -> Sky) */}
              <linearGradient id="subtleLineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#4f46e5" />
                <stop offset="50%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>

              {/* Sfumatura di riempimento ultra-delicata (8% -> 0%) per mantenere il tocco premium */}
              <linearGradient id="subtleAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.09} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            {/* Griglia minimalista solo orizzontale */}
            <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#f1f5f9" />

            {/* Asse X Minimalista: senza linea d'asse e senza tick marks */}
            <XAxis
              dataKey="displayDate"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }}
              dy={6}
              interval={rangeDays === 15 ? 2 : 4}
            />

            {/* Asse Y Minimalista: senza linea d'asse e senza tick marks, formattazione sintetica */}
            <YAxis
              domain={[yDomainMin, yDomainMax]}
              axisLine={false}
              tickLine={false}
              tickCount={4}
              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }}
              tickFormatter={(v: number) => `${formatItalianNumber(Math.round(v), { maximumFractionDigits: 0 })} €`}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Linea di soglia se il saldo scende verso zero */}
            {minBalance < 300 && (
              <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="3 3" strokeOpacity={0.6} />
            )}

            {/* Riempimento trasparente delicato */}
            <Area
              type="monotone"
              dataKey="balance"
              stroke="none"
              fillOpacity={1}
              fill="url(#subtleAreaFill)"
            />

            {/* Linea principale con gradiente cromatico sottile e dot minimale attivo */}
            <Line
              type="monotone"
              dataKey="balance"
              stroke="url(#subtleLineGradient)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{
                r: 5,
                fill: '#4f46e5',
                stroke: '#ffffff',
                strokeWidth: 2
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Didascalia e legenda minimalista */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-1 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-sky-600" />
          <span>Curva proiettata con saldo reale, movimenti pianificati e scadenze</span>
        </div>
        <span className="font-numeric text-slate-400 text-[10px]">
          {displayData.reduce((acc, p) => acc + (p.events?.length || 0), 0)} flussi futuri computati nei prossimi {rangeDays} giorni
        </span>
      </div>
    </div>
  );
};
