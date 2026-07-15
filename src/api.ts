import type { Claim, Commitment } from './types';

export async function createSession(): Promise<string> {
  // Stateless — just generate a local UUID; server no longer stores sessions
  return crypto.randomUUID();
}

export async function askQuestion(
  _sessionId: string,
  question: string,
  priorCommitments: Commitment[],
  predefinedAnswer?: string,
): Promise<{ answer: string; claims: Claim[]; ledger: Commitment[] }> {
  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, predefinedAnswer, priorCommitments }),
  });
  const data: { answer?: string; claims?: Claim[]; ledger?: Commitment[]; error?: string } =
    await res.json();
  if (data.error) throw new Error(data.error);
  return { answer: data.answer!, claims: data.claims!, ledger: data.ledger! };
}
