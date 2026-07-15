import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getAnswer, getClaimBreakdown } from './anthropic';
import type { RawClaim, ClaimStatus, StoredCommitment } from './anthropic';

dotenv.config();

const app = express();

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5174',
      'http://localhost:4173',
      'http://127.0.0.1:4173',
    ],
  }),
);
app.use(express.json({ limit: '8mb' }));

// ── /api/session ──────────────────────────────────────────────────────────────
// Stateless — client generates session IDs; this just confirms the API is live.

app.post('/api/session', (_req, res) => {
  res.json({ sessionId: crypto.randomUUID() });
});

// ── /api/ask ──────────────────────────────────────────────────────────────────
// Stateless: client sends prior commitments with every request.
// Body: { question, predefinedAnswer?, priorCommitments? }

app.post('/api/ask', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { question, predefinedAnswer, priorCommitments } = req.body as {
    question?: string;
    predefinedAnswer?: string;
    priorCommitments?: StoredCommitment[];
  };

  if (!question?.trim()) {
    return res.status(400).json({ error: 'question is required' });
  }

  const prior: StoredCommitment[] = Array.isArray(priorCommitments) ? priorCommitments : [];

  try {
    const answer = predefinedAnswer?.trim()
      ? predefinedAnswer.trim()
      : await getAnswer(question.trim());

    const rawClaims = await getClaimBreakdown(question.trim(), answer, prior);

    let claimCount = prior.length;
    const processedClaims = rawClaims.map((claim: RawClaim) => {
      claimCount++;
      const id = `#${String(claimCount).padStart(3, '0')}`;
      const turnNumber = prior.length > 0
        ? (prior[prior.length - 1].turnNumber + 1)
        : 1;
      return { ...claim, id, turnNumber };
    });

    const newCommitments: StoredCommitment[] = processedClaims
      .filter((c) => c.status !== 'contradiction')
      .map((c) => ({
        id: c.id,
        text: c.text,
        turnNumber: c.turnNumber,
        status: c.status as ClaimStatus,
        note: c.note,
      }));

    const ledger = [...prior, ...newCommitments];

    res.json({ answer, claims: processedClaims, ledger });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[naus] error:', message);
    res.status(500).json({ error: message });
  }
});

const PORT = parseInt(process.env.PORT ?? '3001', 10);
app.listen(PORT, () => {
  console.log(`[naus] server on port ${PORT}`);
});
