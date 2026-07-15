import type { ClaimStatus } from './types';

export const STATUS_COLOR: Record<ClaimStatus, string> = {
  grounded:      '#6B7280',
  ambiguous:     '#C9A961',
  assumption:    '#8A8A85',
  unverifiable:  '#A78BFA',
  contradiction: '#E5484D',
};

export const STATUS_BG: Record<ClaimStatus, string> = {
  grounded:      'rgba(107,114,128,0.10)',
  ambiguous:     'rgba(201,169,97,0.10)',
  assumption:    'rgba(138,138,133,0.10)',
  unverifiable:  'rgba(167,139,250,0.10)',
  contradiction: 'rgba(229,72,77,0.10)',
};

export const EPISTEMIC_WEIGHTS: Record<ClaimStatus, number> = {
  grounded:      1.0,
  ambiguous:     0.6,
  assumption:    0.4,
  unverifiable:  0.2,
  contradiction: 0,
};

export const CLAIM_STATUSES: ClaimStatus[] = [
  'grounded', 'ambiguous', 'assumption', 'unverifiable', 'contradiction',
];
