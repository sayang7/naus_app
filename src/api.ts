import type { Claim, Commitment } from './types';

export async function createSession(): Promise<string> {
  // Stateless — just generate a local UUID; server no longer stores sessions
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
  // ── Step 1: Stream answer tokens ────────────────────────────────────────────
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

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalAnswer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        if (!part.trim()) continue;
        const lines = part.split('\n');
        const eventLine = lines.find((l) => l.startsWith('event:'));
        const dataLine = lines.find((l) => l.startsWith('data:'));
        if (!eventLine || !dataLine) continue;

        const event = eventLine.slice(6).trim();
        let data: unknown;
        try { data = JSON.parse(dataLine.slice(5).trim()); }
        catch { continue; }

        if (event === 'token') {
          onToken(data as string);
        } else if (event === 'answer') {
          finalAnswer = (data as { answer: string }).answer;
        } else if (event === 'error') {
          throw new Error((data as { error: string }).error);
        }
        // 'done' event just signals stream end — we handle it via reader.done
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Signal that breakdown is starting
  onAnalyzing();

  // ── Step 2: Fetch claim breakdown separately ─────────────────────────────────
  const bdRes = await fetch('/api/breakdown', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      answer: finalAnswer,
      priorCommitments,
    }),
    signal,
  });

  if (!bdRes.ok) {
    const data = await bdRes.json().catch(() => ({ error: `HTTP ${bdRes.status}` }));
    throw new Error((data as { error?: string }).error ?? `HTTP ${bdRes.status}`);
  }

  const { claims, ledger } = await bdRes.json() as { claims: Claim[]; ledger: Commitment[] };
  onComplete(finalAnswer, claims, ledger);
}
