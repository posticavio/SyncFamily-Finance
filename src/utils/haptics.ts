/**
 * Utility per gestire il feedback aptico (haptic feedback) su dispositivi mobili
 * sfruttando l'API nativa `navigator.vibrate`.
 */

export const isVibrationSupported = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    'navigator' in window &&
    typeof navigator.vibrate === 'function'
  );
};

/**
 * Esegue una vibrazione con il pattern specificato in millisecondi.
 * Gestisce in modo sicuro le eccezioni e i blocchi del browser.
 */
export const triggerHaptic = (pattern: number | number[] = 15): boolean => {
  if (!isVibrationSupported()) return false;
  try {
    return navigator.vibrate(pattern);
  } catch (e) {
    // I browser possono ignorare le chiamate se non originate da una user gesture
    return false;
  }
};

/**
 * Preset tattili calibrati per un'esperienza utente piacevole ed ergonomica.
 */
export const haptics = {
  /**
   * Feedback leggero e immediato (15ms).
   * Ideale per tap su FAB, pulsanti di navigazione, micro-interazioni rapide.
   */
  tap: () => triggerHaptic(15),

  /**
   * Feedback medio (25ms).
   * Ideale per cambio di tab, selezione conti/categorie o toggle.
   */
  medium: () => triggerHaptic(25),

  /**
   * Feedback più marcato per azioni primarie come apertura modal o creazione.
   */
  impact: () => triggerHaptic([15, 25, 20]),

  /**
   * Feedback di successo a doppio impulso (25ms vibrazione, 40ms pausa, 35ms vibrazione).
   * Ideale al salvataggio completato di una transazione o saldo scadenza.
   */
  success: () => triggerHaptic([25, 40, 35]),

  /**
   * Feedback di allerta/errore (3 impulsi ritmati).
   */
  error: () => triggerHaptic([40, 50, 40]),
};
