import type { Claim, Commitment } from './types';

export async function createSession(): Promise<string> {
  return crypto.randomUUID();
}

export interface ImageAttachment {
  mediaType: string;
  data: string;    // base64 without data: prefix
  dataUrl: string; // full data: URL for display
}

export async function askQuestionStreaming(
  _sessionId: string,
  question: string,
  priorCommitments: Commitment[],
  predefinedAnswer: string | undefined,
  image: ImageAttachment | null,
  onToken: (token: string) => void,
  onAnalyzing: () => void,
  onComplete: (answer: string, claims: Claim[], ledger: Commitment[]) => void,
  signal?: AbortSignal,
): Promise<void> {
  // ── Step 1: Fetch full answer as JSON from /api/ask ──────────────────────────
  // Vercel Node.js serverless buffers res.write() until res.end(), so SSE
  // streaming is unreliable. We get the full answer as JSON, then animate
  // the typewriter effect on the client side.
  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      predefinedAnswer,
      image: image ? { mediaType: image.mediaType, data: image.data } : undefined,
    }),
    signal,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  }

  const { answer } = await res.json() as { answer: string };
  if (!answer) throw new Error('No answer received from server');

  // ── Step 2: Animate tokens client-side ───────────────────────────────────────
  const words = answer.split(/(\s+)/);
  for (const chunk of words) {
    if (signal?.aborted) break;
    if (chunk) {
      onToken(chunk);
      await new Promise<void>((r) => setTimeout(r, 18));
    }
  }

  if (signal?.aborted) return;

  // ── Step 3: Fetch claim breakdown from /api/breakdown ────────────────────────
  onAnalyzing();

  const bdRes = await fetch('/api/breakdown', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, answer, priorCommitments }),
    signal,
  });

  if (!bdRes.ok) {
    const data = await bdRes.json().catch(() => ({ error: `HTTP ${bdRes.status}` }));
    throw new Error((data as { error?: string }).error ?? `HTTP ${bdRes.status}`);
  }

  const { claims, ledger } = await bdRes.json() as { claims: Claim[]; ledger: Commitment[] };
  onComplete(answer, claims, ledger);
}
