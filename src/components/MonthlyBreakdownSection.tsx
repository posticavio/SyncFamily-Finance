import React from 'react';
import { MonthlyMacroBreakdownChart } from './MonthlyMacroBreakdownChart';

export interface MonthlyBreakdownSectionProps {
  [key: string]: any;
}

/**
 * MonthlyBreakdownSection
 * Visualizza l'analisi mensile con le prime 10 sottocategorie top per tipologia.
 */
export const MonthlyBreakdownSection: React.FC<any> = (props) => {
  return <MonthlyMacroBreakdownChart {...props} />;
};

export default MonthlyBreakdownSection;
