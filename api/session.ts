export const runtime = 'edge';

export default function handler() {
  return Response.json({ sessionId: crypto.randomUUID() });
}
