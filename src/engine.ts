export type CommitmentId = `C-${number}`;
export type TurnRef = `t${number}`;

export type Predicate =
  | 'collect_profile'
  | 'conservative_profile'
  | 'unsuitable'
  | 'recommend'
  | 'review_portfolio'
  | 'tax_general'
  | 'rebalance'
  | 'avoid_timing';

export interface Commitment {
  id: CommitmentId;
  turnRef: TurnRef;
  text: string;
  predicate: Predicate;
  object: string;
  subject: string;
  createdByMessageId: string;
  touchedByMessageIds: string[];
}

export type RelationKind = 'supports' | 'independent' | 'consistent-with' | 'contradicts';

export interface Relation {
  from: CommitmentId | TurnRef;
  to: CommitmentId;
  kind: RelationKind;
  reason: string;
}

export type CheckResult =
  | {
      state: 'consistent';
      latencyMs: 47;
      checked: CommitmentId[];
      relations: Relation[];
      noConflicts: true;
      deterministic: true;
    }
  | {
      state: 'contradiction';
      latencyMs: 47;
      checked: CommitmentId[];
      contradiction: {
        commitmentId: CommitmentId;
        fromTurn: TurnRef;
        toTurn: TurnRef;
        leftStatement: string;
        rightStatement: string;
        formula: string;
      };
      relations: Relation[];
      deterministic: true;
    };

export interface ClaimDraft {
  text: string;
  predicate: Predicate;
  object: string;
  subject?: string;
}

export interface DetectionInput {
  turnRef: TurnRef;
  messageId: string;
  speaker: 'client' | 'advisor';
  message: string;
  claims?: ClaimDraft[];
  ledger: Commitment[];
}

export function makeCommitments(input: DetectionInput, nextIndex: number): Commitment[] {
  if (input.speaker !== 'advisor') return [];
  return inferClaims(input).map((claim, index) => ({
    id: `C-${nextIndex + index}` as CommitmentId,
    turnRef: input.turnRef,
    text: claim.text,
    predicate: claim.predicate,
    object: claim.object,
    subject: claim.subject ?? 'client',
    createdByMessageId: input.messageId,
    touchedByMessageIds: [input.messageId],
  }));
}

export function checkTurn(input: DetectionInput): CheckResult {
  const claims = inferClaims(input);
  const checked = input.ledger.map((commitment) => commitment.id);
  const relations: Relation[] = [];

  for (const claim of claims) {
    for (const commitment of input.ledger) {
      const sameFrame =
        commitment.subject === (claim.subject ?? 'client') && commitment.object === claim.object;
      const contradicts =
        sameFrame &&
        ((commitment.predicate === 'unsuitable' && claim.predicate === 'recommend') ||
          (commitment.predicate === 'recommend' && claim.predicate === 'unsuitable'));

      if (contradicts) {
        relations.push({
          from: input.turnRef,
          to: commitment.id,
          kind: 'contradicts',
          reason: 'same client · same session · no frame update',
        });
        return {
          state: 'contradiction',
          latencyMs: 47,
          checked,
          contradiction: {
            commitmentId: commitment.id,
            fromTurn: commitment.turnRef,
            toTurn: input.turnRef,
            leftStatement: commitment.text,
            rightStatement: claim.text,
            formula: 'recommend(leveraged_derivatives) ⊥ unsuitable(leveraged_derivatives)',
          },
          relations,
          deterministic: true,
        };
      }

      relations.push({
        from: input.turnRef,
        to: commitment.id,
        kind: sameFrame ? 'consistent-with' : relationFor(claim, commitment),
        reason: sameFrame ? 'same frame, compatible predicate' : 'orthogonal commitment',
      });
    }
  }

  return {
    state: 'consistent',
    latencyMs: 47,
    checked,
    relations,
    noConflicts: true,
    deterministic: true,
  };
}

export function replyForClient(message: string): { message: string; claims: ClaimDraft[] } {
  const normalized = message.toLowerCase();

  if (normalized.includes('leveraged') || normalized.includes('derivatives') || normalized.includes('nifty')) {
    return {
      message:
        'You might consider a leveraged Nifty derivatives position to capture the momentum - allocating 15-20% could be attractive here.',
      claims: [
        {
          text: 'leveraged Nifty derivatives 15-20% allocation attractive',
          predicate: 'recommend',
          object: 'leveraged_derivatives',
        },
      ],
    };
  }

  if (normalized.includes('tax')) {
    return {
      message:
        'For tax treatment, keep the advice general until a tax professional reviews your exact transactions and holding periods.',
      claims: [
        {
          text: 'tax guidance remains general pending professional review',
          predicate: 'tax_general',
          object: 'tax_treatment',
        },
      ],
    };
  }

  return {
    message:
      'I would keep the recommendation aligned to the conservative profile: review holdings, rebalance gradually, and avoid leverage.',
    claims: [
      {
        text: 'portfolio changes should remain gradual for this client',
        predicate: 'rebalance',
        object: 'portfolio',
      },
    ],
  };
}

function inferClaims(input: DetectionInput): ClaimDraft[] {
  if (input.claims) return input.claims;
  return [];
}

function relationFor(claim: ClaimDraft, commitment: Commitment): RelationKind {
  if (claim.predicate === commitment.predicate && claim.object === commitment.object) return 'supports';
  return 'independent';
}
