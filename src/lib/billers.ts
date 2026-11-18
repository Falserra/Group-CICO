import type { Biller } from './types';

// Mirrors the `billers` table (the server validates the id when a bill is paid).
export const billers: Biller[] = [
  { id: 'b1', name: 'Meralco', category: 'Electricity', verified: true },
  { id: 'b2', name: 'Maynilad', category: 'Water', verified: true },
  { id: 'b3', name: 'PLDT Home', category: 'Internet', verified: true },
  { id: 'b4', name: 'Globe At Home', category: 'Internet', verified: true },
  { id: 'b5', name: 'USTP Tuition', category: 'School', verified: true },
];
