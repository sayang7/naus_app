import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';

// Extend function timeout to 60s (max on Vercel hobby)
export const maxDuration = 60;

// ── Types ─────────────────────────────────────────────────────────────────────

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
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-5';

let _client: Anthropic | null = null;
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim() });
  return _client;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1');
}

async function getAnswer(question: string): Promise<string> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: 'Answer directly in plain prose only — no markdown, no asterisks, no bullet points, no numbered lists, no headers, no backticks. Write in paragraphs. Be accurate and specific.',
    messages: [{ role: 'user', content: question }],
  });
  const block = response.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('No text in response');
  return stripMarkdown(block.text);
}

async function getClaimBreakdown(
  question: string,
  answer: string,
  prior: StoredCommitment[],
): Promise<RawClaim[]> {
  const priorSection = prior.length > 0
    ? `\n\nPrior commitments — check each new claim against these for contradictions:\n${prior.map((c) => `[${c.id}] (turn ${c.turnNumber}): ${c.text}`).join('\n')}`
    : '\n\nNo prior commitments yet.';

  const system = `You are decomposing an answer into discrete epistemic claims for accountability.

Status definitions:
- grounded: well-established fact, not context-dependent
- ambiguous: true/false depending on unstated context or definitions
- assumption: the model's inference presented as fact, not externally verified
- unverifiable: requires a live source that was not actually checked
- contradiction: directly conflicts with a prior commitment in this session

For each claim: identify its exact substring, return startIndex/endIndex (0-indexed, endIndex exclusive), write a one-sentence note explaining the classification, set needsSource:true if a source would change reliability, and set conflictsWithId if contradiction.${priorSection}`;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: `Question: ${question}\n\nAnswer:\n${answer}` }],
    tools: [{
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
                status: { type: 'string', enum: ['grounded', 'ambiguous', 'assumption', 'unverifiable', 'contradiction'] },
                note: { type: 'string' },
                needsSource: { type: 'boolean' },
                startIndex: { type: 'number' },
                endIndex: { type: 'number' },
                conflictsWithId: { type: 'string' },
              },
              required: ['text', 'status', 'note', 'needsSource'],
            },
          },
        },
        required: ['claims'],
      },
    }],
    tool_choice: { type: 'tool', name: 'record_claim_breakdown' },
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') throw new Error('Model did not call breakdown tool');

  const { claims = [] } = toolUse.input as { claims: RawClaim[] };
  return claims.map((claim) => {
    if (claim.startIndex !== undefined && claim.endIndex !== undefined) {
      const s = Math.max(0, Math.min(claim.startIndex, answer.length));
      const e = Math.max(s, Math.min(claim.endIndex, answer.length));
      if (e <= s) { const { startIndex: _s, endIndex: _e, ...rest } = claim; return rest; }
      return { ...claim, startIndex: s, endIndex: e };
    }
    return claim;
  });
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Always return JSON
  res.setHeader('Content-Type', 'application/json');

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    const { question, predefinedAnswer, priorCommitments } = (req.body ?? {}) as {
      question?: string;
      predefinedAnswer?: string;
      priorCommitments?: StoredCommitment[];
    };

    if (!question?.trim()) {
      return res.status(400).json({ error: 'question is required' });
    }

    const prior: StoredCommitment[] = Array.isArray(priorCommitments) ? priorCommitments : [];

    const answer = predefinedAnswer?.trim()
      ? stripMarkdown(predefinedAnswer.trim())
      : await getAnswer(question.trim());

    const rawClaims = await getClaimBreakdown(question.trim(), answer, prior);

    let claimCount = prior.length;
    const turnNumber = prior.length > 0 ? prior[prior.length - 1].turnNumber + 1 : 1;
    const processedClaims = rawClaims.map((claim) => {
      claimCount++;
      return { ...claim, id: `#${String(claimCount).padStart(3, '0')}`, turnNumber };
    });

    const newCommitments: StoredCommitment[] = processedClaims
      .filter((c) => c.status !== 'contradiction')
      .map((c) => ({ id: c.id, text: c.text, turnNumber: c.turnNumber, status: c.status as ClaimStatus, note: c.note }));

    return res.json({ answer, claims: processedClaims, ledger: [...prior, ...newCommitments] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[naus/ask]', message);
    return res.status(500).json({ error: message });
  }
}
