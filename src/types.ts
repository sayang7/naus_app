export type ClaimStatus =
  | 'grounded'
  | 'ambiguous'
  | 'assumption'
  | 'unverifiable'
  | 'contradiction';

export type ReasoningRole = 'premise' | 'inference' | 'conclusion';

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
  // Reasoning structure
  reasoningRole?: ReasoningRole;
  dependsOnIds?: string[];   // prior commitment IDs this logically requires
  citationTarget?: string;   // what specific source/study would verify this
}

export interface Commitment {
  id: string;
  text: string;
  turnNumber: number;
  status: ClaimStatus;
  note?: string;
  reasoningRole?: ReasoningRole;
  citationTarget?: string;
}

export interface Turn {
  id: string;
  question: string;
  answer: string;
  claims: Claim[];
  turnNumber: number;
  image?: string; // data URL for display
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
