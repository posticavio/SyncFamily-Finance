import React from 'react';
import {
  ShoppingCart,
  Utensils,
  Home,
  Zap,
  Wifi,
  Fuel,
  Train,
  HeartPulse,
  Dumbbell,
  ShoppingBag,
  Briefcase,
  Banknote,
  Coins,
  ArrowLeftRight,
  Tag,
  PlusCircle,
  Landmark,
  CreditCard,
  Wallet,
  ShieldAlert,
  Receipt,
  Palmtree,
  Car,
  Plane,
  Tv,
  Gift,
  Coffee,
  GraduationCap,
  Baby,
  Smile,
  CircleHelp,
  PiggyBank,
  Bookmark,
  Sparkles,
  Repeat,
  FileText,
  Laptop,
  Phone,
  Shield,
  Heart,
  Camera,
  Music,
  Film,
  Book,
  Award,
  Compass,
  Sun,
  Key,
  Lock,
  Package,
  Clock,
  Bus,
  Bike,
  Wrench,
  Pill,
  BadgePercent,
  LucideIcon
} from 'lucide-react';
import { MovementType } from '../types';

export const iconMap: Record<string, LucideIcon> = {
  ShoppingCart,
  Utensils,
  Home,
  Zap,
  Wifi,
  Fuel,
  Train,
  HeartPulse,
  Dumbbell,
  ShoppingBag,
  Briefcase,
  Banknote,
  Coins,
  ArrowLeftRight,
  Tag,
  PlusCircle,
  Landmark,
  CreditCard,
  Wallet,
  ShieldAlert,
  Receipt,
  Palmtree,
  Car,
  Plane,
  Tv,
  Gift,
  Coffee,
  GraduationCap,
  Baby,
  Smile,
  PiggyBank,
  Bookmark,
  Sparkles,
  Repeat,
  FileText,
  Laptop,
  Phone,
  Shield,
  Heart,
  Camera,
  Music,
  Film,
  Book,
  Award,
  Compass,
  Sun,
  Key,
  Lock,
  Package,
  Clock,
  Bus,
  Bike,
  Wrench,
  Pill,
  BadgePercent
};

export const AVAILABLE_ICONS = Object.keys(iconMap);

export const AVAILABLE_EMOJIS = [
  '🛒', '🍕', '☕', '🏠', '⚡', '🚗', '⛽', '✈️', '🚆', '💊',
  '🏋️', '👶', '🎓', '💼', '💻', '📱', '🎁', '🏖️', '🎬', '📚',
  '💰', '🏦', '💳', '🛡️', '🩺', '🔧', '🐾', '💈', '🎉', '🌱'
];

// Funzione per rilevare se una stringa è un emoji
export function isEmoji(str: string): boolean {
  if (!str) return false;
  const emojiRegex = /(\p{Extended_Pictographic}|\p{Emoji_Presentation})/u;
  return emojiRegex.test(str);
}

// Colori obbligatori per tipologia da specifiche:
// – Rosso per le icone delle spese (#E31B23)
// – Verde per le icone delle entrate (#10B981)
// – Grigio scuro per le icone dei giroconti (#475569)
export const TYPE_ICON_COLORS: Record<MovementType, string> = {
  USCITA: '#E31B23',
  ENTRATA: '#10B981',
  GIROCONTO: '#475569'
};

interface CategoryIconProps {
  name?: string;
  color?: string;
  size?: number;
  className?: string;
  background?: boolean;
  tipo?: MovementType;
  isGiroconto?: boolean;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  name = 'Tag',
  color,
  size = 20,
  className = '',
  background = true,
  tipo,
  isGiroconto = false
}) => {
  // Determinazione icona e colore in base alle specifiche
  const isTransfer = isGiroconto || tipo === 'GIROCONTO' || name === 'GIROCONTO';
  
  // Se è specificato il tipo, usiamo la codifica colore obbligatoria
  const resolvedColor = isTransfer 
    ? TYPE_ICON_COLORS.GIROCONTO 
    : (tipo ? TYPE_ICON_COLORS[tipo] : (color || '#4f46e5'));

  // Icona unificata per tutti i giroconti
  const resolvedName = isTransfer ? 'ArrowLeftRight' : name;

  const containerSize = Math.max(size * 1.9, 36);

  // Se è un emoji
  if (isEmoji(resolvedName)) {
    if (!background) {
      return (
        <span 
          className={`inline-flex items-center justify-center select-none ${className}`}
          style={{ fontSize: `${size}px` }}
        >
          {resolvedName}
        </span>
      );
    }
    return (
      <div
        className={`inline-flex items-center justify-center rounded-2xl flex-shrink-0 transition-transform active:scale-95 ${className}`}
        style={{
          backgroundColor: `${resolvedColor}18`,
          width: `${containerSize}px`,
          height: `${containerSize}px`
        }}
      >
        <span style={{ fontSize: `${size * 1.1}px` }} className="leading-none select-none">
          {resolvedName}
        </span>
      </div>
    );
  }

  const IconComponent = iconMap[resolvedName] || Tag;

  if (!background) {
    return <IconComponent size={size} style={{ color: resolvedColor }} className={className} strokeWidth={2.2} />;
  }

  return (
    <div
      className={`inline-flex items-center justify-center rounded-2xl flex-shrink-0 transition-transform active:scale-95 ${className}`}
      style={{
        backgroundColor: `${resolvedColor}18`,
        width: `${containerSize}px`,
        height: `${containerSize}px`
      }}
    >
      <IconComponent size={size} style={{ color: resolvedColor }} strokeWidth={2.2} />
    </div>
  );
};
