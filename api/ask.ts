import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;
export const runtime = 'edge';

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

interface ImageInput {
  mediaType: ImageMediaType;
  data: string; // base64
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

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

const MODEL = 'claude-sonnet-4-5';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
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

  // Use TransformStream for reliable SSE on Vercel Edge
  const { readable, writable } = new TransformStream<string, string>();
  const writer = writable.getWriter();
  const enc = new TextEncoder();

  const write = (s: string) => writer.write(enc.encode(s) as unknown as string);

  // Run the streaming logic in the background
  (async () => {
    try {
      let answer = '';

      if (predefinedAnswer?.trim()) {
        // Demo mode: stream predefined answer word-by-word
        answer = stripMarkdown(predefinedAnswer.trim());
        const words = answer.split(/(\s+)/);
        for (const chunk of words) {
          if (chunk) {
            await write(sse('token', chunk));
            await new Promise((r) => setTimeout(r, 25));
          }
        }
      } else {
        // Build message content (with optional image)
        type ContentBlock =
          | { type: 'image'; source: { type: 'base64'; media_type: ImageMediaType; data: string } }
          | { type: 'text'; text: string };
        const userContent: ContentBlock[] = [];
        if (image?.data && image?.mediaType) {
          userContent.push({
            type: 'image',
            source: { type: 'base64', media_type: image.mediaType, data: image.data },
          });
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
            await write(sse('token', token));
          }
        }
        answer = stripMarkdown(answer);
      }

      await write(sse('answer', { answer }));
      await write(sse('done', {}));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[naus/ask]', message);
      try { await write(sse('error', { error: message })); } catch { /* ignore */ }
    } finally {
      try { await writer.close(); } catch { /* ignore */ }
    }
  })();

  return new Response(readable as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    },
  });
}
