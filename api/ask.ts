import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;
export const runtime = 'edge';
export const config = { runtime: 'edge' };

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

interface ImageInput {
  mediaType: ImageMediaType;
  data: string; // base64
}

const encoder = new TextEncoder();

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1');
}

const MODEL = 'claude-sonnet-4-5';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { question?: string; predefinedAnswer?: string; image?: ImageInput };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { question, predefinedAnswer, image } = body;

  if (!question?.trim()) {
    return new Response(JSON.stringify({ error: 'question is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // TransformStream pattern: return Response immediately, write async in background.
  // This is the canonical Edge Runtime streaming pattern — more reliable than
  // ReadableStream.start() across Vercel's infrastructure.
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const write = (event: string, data: unknown): Promise<void> =>
    writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

  // Fire-and-forget: stream runs while client reads the readable side
  (async () => {
    try {
      let answer = '';

      if (predefinedAnswer?.trim()) {
        // Demo mode: no API key needed, stream word-by-word
        answer = stripMarkdown(predefinedAnswer.trim());
        const words = answer.split(/(\s+)/);
        for (const chunk of words) {
          if (chunk) {
            await write('token', chunk);
            await new Promise<void>((r) => setTimeout(r, 25));
          }
        }
      } else {
        // Live mode: stream from Anthropic
        const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
        if (!apiKey) {
          await write('error', { error: 'ANTHROPIC_API_KEY not configured' });
          return;
        }

        type ContentBlock =
          | { type: 'image'; source: { type: 'base64'; media_type: ImageMediaType; data: string } }
          | { type: 'text'; text: string };
        const userContent: ContentBlock[] = [];
        if (image?.data && image?.mediaType) {
          userContent.push({ type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } });
        }
        userContent.push({ type: 'text', text: question.trim() });

        const client = new Anthropic({ apiKey });
        const anthropicStream = await client.messages.create({
          model: MODEL,
          max_tokens: 1024,
          stream: true,
          system: 'Answer directly in plain prose only — no markdown, no asterisks, no bullet points, no numbered lists, no headers, no backticks. Write in paragraphs. Be accurate and specific.',
          messages: [{ role: 'user', content: userContent }],
        });

        for await (const event of anthropicStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const token = event.delta.text;
            answer += token;
            await write('token', token);
          }
        }
        answer = stripMarkdown(answer);
      }

      await write('answer', { answer });
      await write('done', {});
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[naus/ask]', message);
      try { await write('error', { error: message }); } catch { /* stream may be closed */ }
    } finally {
      try { await writer.close(); } catch { /* already closed */ }
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
