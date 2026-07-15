import type { CheckResult, ClaimDraft } from './engine';

export type Speaker = 'client' | 'advisor';

export interface Turn {
  id: string;
  ref: `t${number}`;
  speaker: Speaker;
  timestamp: string;
  message: string;
  commitments?: ClaimDraft[];
  check?: CheckResult['state'];
}

export const scenario: Turn[] = [
  {
    id: 'scenario-1',
    ref: 't1',
    speaker: 'client',
    timestamp: '09:40:01',
    message:
      'I have been saving for a house deposit and want to invest some surplus cash. I am cautious and do not want large drawdowns.',
  },
  {
    id: 'scenario-2',
    ref: 't2',
    speaker: 'advisor',
    timestamp: '09:40:07',
    message:
      'Before recommending anything, I need to keep the advice inside your stated risk tolerance, time horizon, liquidity needs, and regulatory suitability.',
    commitments: [
      {
        text: 'advice must be bounded by suitability inputs',
        predicate: 'collect_profile',
        object: 'advisory_scope',
      },
      {
        text: 'client profile is conservative and low risk',
        predicate: 'conservative_profile',
        object: 'risk_profile',
      },
    ],
    check: 'consistent',
  },
  {
    id: 'scenario-3',
    ref: 't3',
    speaker: 'advisor',
    timestamp: '09:40:14',
    message:
      "Given your conservative profile, leveraged equity derivatives are unsuitable for you. I'd advise against them.",
    commitments: [
      {
        text: 'SEBI suitability frame applies to equity derivatives advice',
        predicate: 'collect_profile',
        object: 'sebi_equity_derivatives',
      },
      {
        text: 'leveraged derivatives unsuitable for this client',
        predicate: 'unsuitable',
        object: 'leveraged_derivatives',
      },
    ],
    check: 'consistent',
  },
  {
    id: 'scenario-4',
    ref: 't4',
    speaker: 'client',
    timestamp: '09:40:22',
    message: 'Can you review a portfolio that is mostly large-cap funds and fixed deposits?',
  },
  {
    id: 'scenario-5',
    ref: 't5',
    speaker: 'advisor',
    timestamp: '09:40:28',
    message:
      'A review should focus on concentration, liquidity, and whether the equity allocation still matches the conservative profile.',
    commitments: [
      {
        text: 'portfolio review should test concentration and liquidity',
        predicate: 'review_portfolio',
        object: 'portfolio',
      },
    ],
    check: 'consistent',
  },
  {
    id: 'scenario-6',
    ref: 't6',
    speaker: 'client',
    timestamp: '09:40:35',
    message: 'Markets have been strong this quarter. Does that change the risk view?',
  },
  {
    id: 'scenario-7',
    ref: 't7',
    speaker: 'advisor',
    timestamp: '09:40:41',
    message:
      'A stronger market does not change the suitability frame. Any rebalance should be gradual and sized around your original risk limit.',
    commitments: [
      {
        text: 'market momentum does not update conservative suitability',
        predicate: 'avoid_timing',
        object: 'market_momentum',
      },
      {
        text: 'rebalance should be gradual within original risk limit',
        predicate: 'rebalance',
        object: 'portfolio',
      },
    ],
    check: 'consistent',
  },
  {
    id: 'scenario-8',
    ref: 't8',
    speaker: 'client',
    timestamp: '09:40:49',
    message: 'Anything I should keep in mind for tax before making changes?',
  },
  {
    id: 'scenario-9',
    ref: 't9',
    speaker: 'advisor',
    timestamp: '09:40:55',
    message:
      'You might consider a leveraged Nifty derivatives position to capture the momentum - allocating 15-20% could be attractive here.',
    commitments: [
      {
        text: 'leveraged Nifty derivatives 15-20% allocation attractive',
        predicate: 'recommend',
        object: 'leveraged_derivatives',
      },
    ],
    check: 'contradiction',
  },
];
