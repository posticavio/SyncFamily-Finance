import React, { useId, useState } from 'react';
import { formatCurrency } from '../utils/formatters';
import { SparklinePoint } from '../types';

interface InlineSparklineProps {
  points?: SparklinePoint[];
  data?: number[];
  width?: number;
  height?: number;
  isFund?: boolean;
  customColor?: string;
}

export const InlineSparkline: React.FC<InlineSparklineProps> = ({
  points,
  data = [],
  width = 72,
  height = 24,
  isFund = false,
  customColor
}) => {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Normalizzazione lista punti
  const normalizedPoints: SparklinePoint[] = React.useMemo(() => {
    if (points && points.length >= 2) {
      return points;
    }
    if (data && data.length >= 2) {
      const half = Math.floor(data.length / 2);
      return data.map((val, idx) => ({
        date: '',
        displayDate: idx === half ? 'Oggi' : `Giorno ${idx + 1}`,
        value: val,
        isFuture: idx > half,
        isToday: idx === half
      }));
    }
    return [];
  }, [points, data]);

  if (normalizedPoints.length < 2) {
    return (
      <div 
        style={{ width, height }} 
        className="flex items-center justify-center opacity-30"
        title="Dati insufficienti"
      >
        <div className="w-full h-[1.5px] bg-slate-400" />
      </div>
    );
  }

  const values = normalizedPoints.map(p => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal;

  const padX = 4;
  const padY = 4;
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;

  // Coordinate SVG
  const svgPoints = normalizedPoints.map((pt, idx) => {
    const x = padX + (idx / (normalizedPoints.length - 1)) * usableW;
    const y = range === 0 
      ? height / 2 
      : padY + usableH - ((pt.value - minVal) / range) * usableH;
    return {
      ...pt,
      x,
      y,
      index: idx
    };
  });

  // Identifica punto centrale "Oggi"
  const todayIdx = svgPoints.findIndex(p => p.isToday);
  const todayPoint = todayIdx >= 0 ? svgPoints[todayIdx] : svgPoints[Math.floor(svgPoints.length / 2)];
  const firstPoint = svgPoints[0];
  const lastPoint = svgPoints[svgPoints.length - 1];

  // Costruzione segmenti con colorazione per variazione:
  // - Positivo (salita): verde #10b981
  // - Negativo (discesa): rosso #ef4444
  // - Zero (piatto): arancione #f59e0b
  // E stile tratto:
  // - Effettivo (fino ad Oggi): continuo
  // - Pianificato (dopo Oggi): tratteggiato
  const segments: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color: string;
    isDashed: boolean;
    diff: number;
  }> = [];

  for (let i = 1; i < svgPoints.length; i++) {
    const p1 = svgPoints[i - 1];
    const p2 = svgPoints[i];
    const diff = Math.round((p2.value - p1.value) * 100) / 100;

    let color = '#f59e0b'; // Arancione default per tratto invariato / zero
    if (diff > 0.005) {
      color = '#10b981'; // Verde per tratto positivo
    } else if (diff < -0.005) {
      color = '#ef4444'; // Rosso per tratto negativo
    }

    if (customColor) {
      color = customColor;
    }

    const isDashed = p2.isFuture;

    segments.push({
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
      color,
      isDashed,
      diff
    });
  }

  const activePoint = hoverIndex !== null ? svgPoints[hoverIndex] : todayPoint;
  const overallDiff = Math.round((lastPoint.value - todayPoint.value) * 100) / 100;

  const tooltipText = `Finestra 1 Mese: Passato effettivo continuo | Futuro pianificato tratteggiato\n` +
    `• Oggi: ${formatCurrency(todayPoint.value)}\n` +
    `• Fine Periodo (Pianificato): ${formatCurrency(lastPoint.value)} (${overallDiff >= 0 ? '+' : ''}${formatCurrency(overallDiff)})\n` +
    `Verde = positivo, Rosso = negativo, Arancione = invariato`;

  return (
    <div 
      className="inline-flex items-center flex-shrink-0 cursor-pointer group/sparkline relative"
      title={tooltipText}
      onMouseLeave={() => setHoverIndex(null)}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible select-none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={todayPoint.value >= 0 ? '#10b981' : '#ef4444'} stopOpacity="0.2" />
            <stop offset="100%" stopColor={todayPoint.value >= 0 ? '#10b981' : '#ef4444'} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Linea sottile centrale su OGGI */}
        <line
          x1={todayPoint.x}
          y1={1}
          x2={todayPoint.x}
          y2={height - 1}
          stroke="#94a3b8"
          strokeWidth="0.8"
          strokeDasharray="2 2"
          opacity="0.35"
        />

        {/* Traccia di tutti i segmenti: colorati per pendenza e tratteggiati per il futuro */}
        {segments.map((seg, sIdx) => (
          <line
            key={sIdx}
            x1={seg.x1.toFixed(1)}
            y1={seg.y1.toFixed(1)}
            x2={seg.x2.toFixed(1)}
            y2={seg.y2.toFixed(1)}
            stroke={seg.color}
            strokeWidth={seg.isDashed ? 1.6 : 2.0}
            strokeDasharray={seg.isDashed ? '2.5 2' : undefined}
            strokeLinecap="round"
          />
        ))}

        {/* Punto inizio storico */}
        <circle
          cx={firstPoint.x}
          cy={firstPoint.y}
          r="1.5"
          fill="#94a3b8"
          opacity="0.5"
        />

        {/* Marker centrale su SALDO OGGI (Centrato sulla finestra di 1 mese) */}
        <circle
          cx={todayPoint.x}
          cy={todayPoint.y}
          r="4.2"
          fill={todayPoint.value >= 0 ? '#10b981' : '#ef4444'}
          opacity="0.2"
        />
        <circle
          cx={todayPoint.x}
          cy={todayPoint.y}
          r="2.4"
          fill="#ffffff"
          stroke={todayPoint.value >= 0 ? '#10b981' : '#ef4444'}
          strokeWidth="1.6"
          className="transition-transform group-hover/sparkline:scale-125"
        />

        {/* Punto finale futuro proiettato */}
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r="2.0"
          fill={lastPoint.value >= 0 ? '#10b981' : '#ef4444'}
          stroke="#ffffff"
          strokeWidth="0.8"
          opacity="0.85"
        />

        {/* Hover overlay per interazione */}
        {svgPoints.map((pt, idx) => (
          <rect
            key={idx}
            x={pt.x - usableW / (svgPoints.length * 2)}
            y={0}
            width={usableW / svgPoints.length}
            height={height}
            fill="transparent"
            className="cursor-crosshair"
            onMouseEnter={() => setHoverIndex(idx)}
          />
        ))}

        {/* Marker punto attivo su hover */}
        {hoverIndex !== null && activePoint && (
          <g>
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r="3.2"
              fill="#ffffff"
              stroke={activePoint.isFuture ? '#f59e0b' : '#3b82f6'}
              strokeWidth="2"
            />
          </g>
        )}
      </svg>
    </div>
  );
};
