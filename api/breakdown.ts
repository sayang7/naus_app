import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const maxDuration = 60;

type ClaimStatus = 'grounded' | 'ambiguous' | 'assumption' | 'unverifiable' | 'contradiction';

interface StoredCommitment {
  id: string;
  text: string;
  turnNumber: number;
  status: ClaimStatus;
  note: string;
}

interface RawClaim {
  text: string;
  status: ClaimStatus;
  note: string;
  needsSource: boolean;
  startIndex?: number;
  endIndex?: number;
  conflictsWithId?: string;
  reasoningRole?: 'premise' | 'inference' | 'conclusion';
  dependsOnIds?: string[];
  citationTarget?: string;
}

const BREAKDOWN_MODEL = 'claude-haiku-4-5-20251001';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    return;
  }

  const { question, answer, priorCommitments } = (req.body ?? {}) as {
    question?: string;
    answer?: string;
    priorCommitments?: StoredCommitment[];
  };

  if (!question?.trim() || !answer?.trim()) {
    res.status(400).json({ error: 'question and answer are required' });
    return;
  }

  const prior: StoredCommitment[] = Array.isArray(priorCommitments) ? priorCommitments : [];

  const priorSection =
    prior.length > 0
      ? `\n\nPrior session commitments (use IDs for dependsOnIds and conflictsWithId):\n${prior
          .map((c) => `[${c.id}] turn ${c.turnNumber} (${c.status}): ${c.text}`)
          .join('\n')}`
      : '\n\nNo prior commitments yet.';

  const system = `You are decomposing an answer into discrete epistemic claims to audit AI reasoning.

STATUS — assign exactly one:
- grounded: well-established fact, not context-dependent
- ambiguous: true/false depending on unstated context or definitions
- assumption: the model's inference presented as fact, not externally verified
- unverifiable: requires a live source, study, or data that was not actually checked
- contradiction: directly conflicts with a prior commitment in this session

REASONING ROLE — assign exactly one:
- premise: a starting condition, stated rule, or foundational fact the rest of the reasoning builds on
- inference: an intermediate logical step derived from premises
- conclusion: a final judgment, recommendation, or claim derived from the reasoning chain

For each claim return:
- text: the exact claim
- status, note (one precise sentence explaining why), needsSource
- startIndex/endIndex: character positions (0-indexed, endIndex exclusive) in the answer text
- reasoningRole: "premise" | "inference" | "conclusion"
- dependsOnIds: array of prior commitment IDs (e.g. ["#001","#003"]) that this claim logically requires to be true — only prior IDs, not claims within the same answer. Omit if none.
- conflictsWithId: prior commitment ID if status is "contradiction"
- citationTarget: for unverifiable/assumption claims with needsSource=true, write ONE precise phrase describing exactly what type of source or study would verify this (e.g. "RCT comparing isocaloric IF vs continuous restriction for insulin sensitivity in T2DM"). Omit for grounded/contradiction/ambiguous.${priorSection}`;

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: BREAKDOWN_MODEL,
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: `Question: ${question.trim()}\n\nAnswer:\n${answer.trim()}` }],
      tools: [
        {
          name: 'record_claim_breakdown',
          description: 'Record epistemic breakdown of an answer into discrete claims.',
          input_schema: {
            type: 'object' as const,
            properties: {
              claims: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    text: { type: 'string' },
                    status: {
                      type: 'string',
                      enum: ['grounded', 'ambiguous', 'assumption', 'unverifiable', 'contradiction'],
                    },
                    note: { type: 'string' },
                    needsSource: { type: 'boolean' },
                    startIndex: { type: 'number' },
                    endIndex: { type: 'number' },
                    conflictsWithId: { type: 'string' },
                    reasoningRole: { type: 'string', enum: ['premise', 'inference', 'conclusion'] },
                    dependsOnIds: { type: 'array', items: { type: 'string' } },
                    citationTarget: { type: 'string' },
                  },
                  required: ['text', 'status', 'note', 'needsSource', 'reasoningRole'],
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
      throw new Error('Model did not call breakdown tool');
    }

    const { claims: rawClaims = [] } = toolUse.input as { claims: RawClaim[] };

    const processedClaims = rawClaims.map((claim, i) => {
      const id = `#${String(prior.length + i + 1).padStart(3, '0')}`;
      const turnNumber = prior.length > 0 ? prior[prior.length - 1].turnNumber + 1 : 1;

      let startIndex = claim.startIndex;
      let endIndex = claim.endIndex;
      if (startIndex !== undefined && endIndex !== undefined) {
        startIndex = Math.max(0, Math.min(startIndex, answer.length));
        endIndex = Math.max(startIndex, Math.min(endIndex, answer.length));
        if (endIndex <= startIndex) {
          startIndex = undefined;
          endIndex = undefined;
        }
      }

      return { ...claim, id, turnNumber, startIndex, endIndex };
    });

    const newCommitments: StoredCommitment[] = processedClaims
      .filter((c) => c.status !== 'contradiction')
      .map((c) => ({
        id: c.id,
        text: c.text,
        turnNumber: c.turnNumber,
        status: c.status as ClaimStatus,
        note: c.note,
        reasoningRole: c.reasoningRole,
        citationTarget: c.citationTarget,
      }));

    res.json({ claims: processedClaims, ledger: [...prior, ...newCommitments] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[naus/breakdown]', message);
    res.status(500).json({ error: message });
  }
}
