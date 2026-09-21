import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { haptics } from '../utils/haptics';

export interface CarouselProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
  /**
   * Se true, attiva la visualizzazione Carousel solo su smartphone/mobile,
   * mentre su schermi più grandi renderizza una griglia standard.
   * Default: true.
   */
  mobileOnly?: boolean;
  /**
   * Breakpoint di passaggio da mobile a desktop: 'sm' (640px) o 'md' (768px).
   * Default: 'sm'.
   */
  breakpoint?: 'sm' | 'md';
  /**
   * Classi griglia per la vista desktop quando mobileOnly è attivo.
   * Es: "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
   */
  desktopGridClassName?: string;
  /**
   * Mostra i pallini indicatori (dots) in stile Samsung One UI.
   * Default: true.
   */
  showDots?: boolean;
  /**
   * Mostra le frecce per scorrere avanti/indietro.
   * Default: true su mobile.
   */
  showArrows?: boolean;
  /**
   * Mostra il contatore testuale compatto (es. "1 di 3").
   * Default: false.
   */
  showCounter?: boolean;
  /**
   * Titolo accessibile o label della sezione
   */
  ariaLabel?: string;
}

export const Carousel: React.FC<CarouselProps> = ({
  children,
  id,
  className = '',
  mobileOnly = true,
  breakpoint = 'sm',
  desktopGridClassName = 'sm:grid-cols-3 gap-3',
  showDots = true,
  showArrows = true,
  showCounter = false,
  ariaLabel = 'Galleria schede'
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  // Converti i children in array valido
  const items = React.Children.toArray(children).filter(Boolean);
  const totalItems = items.length;

  // Calcola e aggiorna l'indice attivo durante lo scroll orizzontale
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || totalItems <= 1) return;

    const { scrollLeft, clientWidth, scrollWidth } = container;
    const maxScroll = scrollWidth - clientWidth;

    setCanScrollPrev(scrollLeft > 4);
    setCanScrollNext(scrollLeft < maxScroll - 4);

    // Calcola quale card è più vicina al centro
    const childrenElements = Array.from(container.children) as HTMLElement[];
    if (childrenElements.length === 0) return;

    const containerCenter = scrollLeft + clientWidth / 2;
    let closestIndex = 0;
    let minDistance = Infinity;

    childrenElements.forEach((child, index) => {
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const distance = Math.abs(containerCenter - childCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    if (closestIndex !== activeIndex) {
      setActiveIndex(closestIndex);
    }
  }, [activeIndex, totalItems]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    handleScroll();
    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [handleScroll]);

  // Funzione per scorrere a un indice specifico con animazione morbida
  const scrollToIndex = (index: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const childrenElements = Array.from(container.children) as HTMLElement[];
    const targetElement = childrenElements[index];

    if (targetElement) {
      const offsetLeft = targetElement.offsetLeft;
      const targetScroll = offsetLeft - (container.clientWidth - targetElement.offsetWidth) / 2;

      container.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: 'smooth'
      });

      haptics.tap();
      setActiveIndex(index);
    }
  };

  const scrollPrev = () => {
    if (activeIndex > 0) {
      scrollToIndex(activeIndex - 1);
    }
  };

  const scrollNext = () => {
    if (activeIndex < totalItems - 1) {
      scrollToIndex(activeIndex + 1);
    }
  };

  // Se c'è solo un elemento o nessuno, renderizza normalmente
  if (totalItems <= 1) {
    return (
      <div id={id} className={className}>
        {children}
      </div>
    );
  }

  // Classi responsive in base al breakpoint
  const isMdBreakpoint = breakpoint === 'md';
  const carouselWrapperClasses = mobileOnly
    ? isMdBreakpoint
      ? 'md:hidden'
      : 'sm:hidden'
    : '';

  const desktopGridClasses = mobileOnly
    ? isMdBreakpoint
      ? `hidden md:grid ${desktopGridClassName}`
      : `hidden sm:grid ${desktopGridClassName}`
    : 'hidden';

  return (
    <div id={id} className={`w-full max-w-full overflow-hidden ${className}`}>
      {/* 1. VISTA DESKTOP: Griglia Standard (se mobileOnly = true) */}
      {mobileOnly && (
        <div className={desktopGridClasses}>
          {children}
        </div>
      )}

      {/* 2. VISTA SMARTPHONE: Carousel Slider Nativo One UI */}
      <div className={`${carouselWrapperClasses} relative w-full`}>
        {/* Contenitore orizzontale a scorrimento con Scroll-Snap */}
        <div
          ref={scrollContainerRef}
          role="region"
          aria-label={ariaLabel}
          className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth gap-3 px-1 py-1 -mx-1"
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {items.map((child, index) => (
            <div
              key={index}
              className="snap-center shrink-0 w-[88vw] max-w-[345px] transition-transform duration-200"
              style={{
                // Leggero peaking laterale per far capire che c'è una scheda successiva
                scrollSnapAlign: 'center'
              }}
            >
              {child}
            </div>
          ))}
        </div>

        {/* 3. BARRA DI CONTROLLO CAROUSEL: Dots Indicator & Frecce */}
        {(showDots || showArrows || showCounter) && totalItems > 1 && (
          <div className="flex items-center justify-between mt-2.5 px-2">
            {/* Freccia Indietro (compatta One UI) */}
            {showArrows ? (
              <button
                type="button"
                onClick={scrollPrev}
                disabled={!canScrollPrev}
                aria-label="Scheda precedente"
                className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                  canScrollPrev
                    ? 'border-slate-200 dark:border-white/10 bg-white dark:bg-[#242426] text-slate-700 dark:text-[#F5F5F7] shadow-xs active:scale-95'
                    : 'border-transparent text-slate-300 dark:text-slate-700 opacity-40 cursor-not-allowed'
                }`}
              >
                <ChevronLeft size={15} strokeWidth={2.5} />
              </button>
            ) : <div className="w-7" />}

            {/* Indicatori a Pallino (Squircle Pill per scheda attiva - Samsung One UI) */}
            {showDots && (
              <div className="flex items-center justify-center gap-1.5 py-1">
                {items.map((_, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => scrollToIndex(index)}
                      aria-label={`Vai alla scheda ${index + 1}`}
                      className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                        isActive
                          ? 'w-5.5 bg-[#E31B23] shadow-xs shadow-[#E31B23]/30'
                          : 'w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600'
                      }`}
                    />
                  );
                })}
              </div>
            )}

            {/* Contatore numerico (opzionale) */}
            {showCounter && (
              <span className="font-numeric text-[11px] font-medium text-slate-500 dark:text-[#8E8E93]">
                {activeIndex + 1} / {totalItems}
              </span>
            )}

            {/* Freccia Avanti (compatta One UI) */}
            {showArrows ? (
              <button
                type="button"
                onClick={scrollNext}
                disabled={!canScrollNext}
                aria-label="Scheda successiva"
                className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                  canScrollNext
                    ? 'border-slate-200 dark:border-white/10 bg-white dark:bg-[#242426] text-slate-700 dark:text-[#F5F5F7] shadow-xs active:scale-95'
                    : 'border-transparent text-slate-300 dark:text-slate-700 opacity-40 cursor-not-allowed'
                }`}
              >
                <ChevronRight size={15} strokeWidth={2.5} />
              </button>
            ) : <div className="w-7" />}
          </div>
        )}
      </div>
    </div>
  );
};
