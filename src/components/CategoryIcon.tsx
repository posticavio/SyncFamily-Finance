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
  CarFront,
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
  Smartphone,
  Monitor,
  Shield,
  ShieldCheck,
  Heart,
  Camera,
  Music,
  Film,
  Book,
  Award,
  Compass,
  Sun,
  Moon,
  Star,
  Cloud,
  Key,
  KeyRound,
  Lock,
  Package,
  Clock,
  Bus,
  Bike,
  Wrench,
  Hammer,
  Paintbrush,
  Pill,
  BadgePercent,
  TrendingUp,
  TrendingDown,
  Calculator,
  Scale,
  Building,
  PawPrint,
  Dog,
  Cat,
  Pizza,
  Wine,
  Beer,
  Cake,
  IceCream2,
  Soup,
  Cookie,
  Fish,
  Apple,
  Salad,
  Flame,
  Droplet,
  Trash2,
  Plug,
  Lightbulb,
  ShowerHead,
  Bed,
  Sofa,
  Shirt,
  Watch,
  Glasses,
  Footprints,
  Store,
  Scissors,
  Stethoscope,
  Syringe,
  Activity,
  Gamepad2,
  Headphones,
  Radio,
  Palette,
  Ticket,
  Tent,
  Luggage,
  Hotel,
  Trees,
  Flower2,
  Sprout,
  Users,
  UserCheck,
  PartyPopper,
  HeartHandshake,
  School,
  Library,
  Truck,
  Ship,
  Sailboat,
  ParkingSquare,
  FileSpreadsheet,
  Send,
  LucideIcon
} from 'lucide-react';
import { MovementType } from '../types';

export const iconMap: Record<string, LucideIcon> = {
  // Spesa & Alimentari
  ShoppingCart,
  ShoppingBag,
  Utensils,
  Coffee,
  Pizza,
  Apple,
  Salad,
  Soup,
  Fish,
  Cookie,
  Cake,
  IceCream2,
  Wine,
  Beer,
  Store,

  // Casa, Utenze & Arredamento
  Home,
  Zap,
  Flame,
  Droplet,
  Wifi,
  Trash2,
  Plug,
  Lightbulb,
  ShowerHead,
  Bed,
  Sofa,
  Hammer,
  Paintbrush,
  Wrench,
  Key,
  KeyRound,
  Lock,

  // Trasporti & Veicoli
  Car,
  CarFront,
  Fuel,
  ParkingSquare,
  Bus,
  Train,
  Plane,
  Bike,
  Truck,
  Ship,
  Sailboat,

  // Salute, Benessere & Cura Personale
  HeartPulse,
  Stethoscope,
  Pill,
  Syringe,
  Activity,
  Dumbbell,
  Scissors,
  Shirt,
  Watch,
  Glasses,
  Footprints,

  // Animali & Natura
  PawPrint,
  Dog,
  Cat,
  Trees,
  Flower2,
  Sprout,

  // Famiglia, Istruzione & Relazioni
  Baby,
  Smile,
  Heart,
  Users,
  UserCheck,
  School,
  GraduationCap,
  Book,
  Library,

  // Svago, Viaggi & Intrattenimento
  Palmtree,
  Hotel,
  Luggage,
  Tent,
  Ticket,
  PartyPopper,
  Gift,
  Film,
  Tv,
  Music,
  Camera,
  Gamepad2,
  Headphones,
  Radio,
  Palette,
  Compass,

  // Tecnologia & Dispositivi
  Laptop,
  Smartphone,
  Phone,
  Monitor,
  Cloud,
  Package,

  // Finanza, Lavoro & Amministrazione
  Briefcase,
  Landmark,
  Banknote,
  Coins,
  CreditCard,
  Wallet,
  PiggyBank,
  BadgePercent,
  TrendingUp,
  TrendingDown,
  Calculator,
  Receipt,
  FileText,
  FileSpreadsheet,
  Scale,
  Building,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Send,
  ArrowLeftRight,

  // Generali & Simboli
  Tag,
  PlusCircle,
  Bookmark,
  Sparkles,
  Repeat,
  Award,
  Sun,
  Moon,
  Star,
  Clock,
  CircleHelp
};

export const AVAILABLE_ICONS = Object.keys(iconMap);

export const AVAILABLE_EMOJIS = [
  // Spesa & Cibo
  '🛒', '🍎', '🥦', '🥩', '🍕', '🍔', '🍣', '🍝', '☕', '🥐', '🍦', '🍰', '🍺', '🍷', '🥂',
  // Casa & Utenze
  '🏠', '🛋️', '⚡', '💧', '🔥', '📶', '🧹', '🪴', '🔨', '🪛', '💡', '📦',
  // Trasporti
  '🚗', '⛽', '🛵', '🚲', '🚆', '✈️', '🚌', '🚢', '🅿️', '🧰',
  // Salute & Fitness
  '💊', '🩺', '🏥', '🏋️', '🧘', '🦷', '👓', '💈', '🧴',
  // Famiglia & Animali
  '👶', '🎓', '📚', '🎒', '🐾', '🐶', '🐱', '🍼', '🧸',
  // Svago & Regali
  '🎁', '🎉', '🏖️', '✈️', '🏨', '🎬', '🎮', '🎧', '🎟️', '⛺', '📸', '🎨',
  // Lavoro, Tecnologia & Finanza
  '💼', '💻', '📱', '💰', '🏦', '💳', '🪙', '📊', '📈', '📉', '🧾', '🛡️', '⚖️'
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
  background = false,
  tipo,
  isGiroconto = false
}) => {
  // Determinazione del colore
  let resolvedColor = color;
  if (!resolvedColor && tipo) {
    resolvedColor = isGiroconto ? TYPE_ICON_COLORS.GIROCONTO : TYPE_ICON_COLORS[tipo];
  }
  if (!resolvedColor) {
    resolvedColor = '#E31B23';
  }

  // 1. Caso Emoji
  if (isEmoji(name)) {
    if (background) {
      return (
        <div
          className={`flex items-center justify-center rounded-[12px] shrink-0 ${className}`}
          style={{
            width: size + 16,
            height: size + 16,
            backgroundColor: `${resolvedColor}18`,
            border: `1px solid ${resolvedColor}30`
          }}
        >
          <span style={{ fontSize: size }}>{name}</span>
        </div>
      );
    }
    return (
      <span
        className={`inline-flex items-center justify-center leading-none select-none shrink-0 ${className}`}
        style={{ fontSize: size }}
      >
        {name}
      </span>
    );
  }

  // 2. Caso Icona Lucide
  const IconComponent = iconMap[name] || Tag;

  if (background) {
    return (
      <div
        className={`flex items-center justify-center rounded-[12px] shrink-0 ${className}`}
        style={{
          width: size + 16,
          height: size + 16,
          backgroundColor: `${resolvedColor}18`,
          border: `1px solid ${resolvedColor}30`
        }}
      >
        <IconComponent
          size={size}
          style={{ color: resolvedColor }}
          strokeWidth={2}
        />
      </div>
    );
  }

  return (
    <IconComponent
      size={size}
      className={`shrink-0 ${className}`}
      style={{ color: resolvedColor }}
      strokeWidth={2}
    />
  );
};
