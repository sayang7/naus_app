import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-4-5';

// Lazy client — created on first use so dotenv.config() in index.ts runs first
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export type ClaimStatus =
  | 'grounded'
  | 'ambiguous'
  | 'assumption'
  | 'unverifiable'
  | 'contradiction';

export interface RawClaim {
  text: string;
  status: ClaimStatus;
  note: string;
  needsSource: boolean;
  startIndex?: number;
  endIndex?: number;
  conflictsWithId?: string;
}

export interface StoredCommitment {
  id: string;
  text: string;
  turnNumber: number;
  status: ClaimStatus;
  note: string;
}

// Strip any residual markdown the model emits despite the system prompt
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1');
}

export async function getAnswer(question: string): Promise<string> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      'Answer the user\'s question directly and naturally. Use plain prose only — no markdown whatsoever, no asterisks, no bold, no bullet points, no numbered lists, no headers, no backticks. Write in paragraphs. Be accurate and specific.',
    messages: [{ role: 'user', content: question }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text in model response');
  }
  return stripMarkdown(textBlock.text);
}

export async function getClaimBreakdown(
  question: string,
  answer: string,
  priorCommitments: StoredCommitment[],
): Promise<RawClaim[]> {
  const priorSection =
    priorCommitments.length > 0
      ? `\n\nPrior commitments in this session — check each new claim against these for direct contradictions:\n${priorCommitments
          .map((c) => `[${c.id}] (turn ${c.turnNumber}): ${c.text}`)
          .join('\n')}`
      : '\n\nNo prior commitments in this session.';

  const system = `You are decomposing an answer into discrete epistemic claims for accountability analysis.

Status definitions — assign exactly one per claim:
- grounded: a well-established fact, not context-dependent
- ambiguous: true or false depending on unstated context, definitions, or framing
- assumption: presented as fact but is the model's inference or convention, not verified
- unverifiable: requires a live source (current data, specific study, specific person's statement) that was not actually checked
- contradiction: directly conflicts with a prior commitment in this session

For each claim:
1. Identify the exact substring in the answer text that expresses it
2. Return startIndex and endIndex as character positions (0-indexed, endIndex exclusive) in the answer text
3. If a claim is implicit and not tied to a specific substring, omit startIndex and endIndex entirely
4. Write a one-sentence note: plain, specific, active voice — state exactly why this status applies
5. Set needsSource: true if a source would materially change the claim's reliability
6. If status is "contradiction", set conflictsWithId to the bracketed ID of the prior commitment it conflicts with

Do not include transition phrases, restatements of the question, or stylistic filler as claims.
Claims are extracted and checked using structured analysis of the model's own output.${priorSection}`;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system,
    messages: [
      {
        role: 'user',
        content: `Question: ${question}\n\nAnswer text to analyze:\n${answer}`,
      },
    ],
    tools: [
      {
        name: 'record_claim_breakdown',
        description:
          'Record the epistemic breakdown of an answer into discrete claims with exact character positions in the answer text.',
        input_schema: {
          type: 'object' as const,
          properties: {
            claims: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  text: {
                    type: 'string',
                    description: 'The claim, quoted or closely paraphrased from the answer',
                  },
                  status: {
                    type: 'string',
                    enum: [
                      'grounded',
                      'ambiguous',
                      'assumption',
                      'unverifiable',
                      'contradiction',
                    ],
                  },
                  note: {
                    type: 'string',
                    description:
                      'One plain sentence: exactly why this status applies — specific and active',
                  },
                  needsSource: { type: 'boolean' },
                  startIndex: {
                    type: 'number',
                    description:
                      'Start character position (0-indexed) of this claim substring in the answer text',
                  },
                  endIndex: {
                    type: 'number',
                    description:
                      'End character position (exclusive) of this claim substring in the answer text',
                  },
                  conflictsWithId: {
                    type: 'string',
                    description:
                      'ID of the prior commitment this contradicts — only set if status is "contradiction"',
                  },
                },
                required: ['text', 'status', 'note', 'needsSource'],
              },
            },
          },
          required: ['claims'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'record_claim_breakdown' },
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Model did not call the breakdown tool');
  }

  const input = toolUse.input as { claims: RawClaim[] };
  const claims = input.claims ?? [];

  // Validate and clamp indices to answer bounds to prevent slicing errors
  return claims.map((claim) => {
    if (claim.startIndex !== undefined && claim.endIndex !== undefined) {
      const start = Math.max(0, Math.min(claim.startIndex, answer.length));
      const end = Math.max(start, Math.min(claim.endIndex, answer.length));
      // Discard degenerate ranges
      if (end <= start) {
        const { startIndex: _s, endIndex: _e, ...rest } = claim;
        return rest;
      }
      return { ...claim, startIndex: start, endIndex: end };
    }
    return claim;
  });
}
