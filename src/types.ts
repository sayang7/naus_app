export type ClaimStatus =
  | 'grounded'
  | 'ambiguous'
  | 'assumption'
  | 'unverifiable'
  | 'contradiction';

export interface Claim {
  id: string;
  text: string;
  status: ClaimStatus;
  note: string;
  needsSource: boolean;
  startIndex?: number;
  endIndex?: number;
  conflictsWithId?: string;
  turnNumber: number;
}

export interface Commitment {
  id: string;
  text: string;
  turnNumber: number;
  status: ClaimStatus;
  note?: string;
}

export interface Turn {
  id: string;
  question: string;
  answer: string;
  claims: Claim[];
  turnNumber: number;
}

export interface SavedSession {
  id: string;
  serverSessionId: string;
  title: string;
  preview: string;
  timestamp: number;
  turns: Turn[];
  ledger: Commitment[];
}
