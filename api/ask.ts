import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const maxDuration = 60;

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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { question, predefinedAnswer, image } = (req.body ?? {}) as {
    question?: string;
    predefinedAnswer?: string;
    image?: ImageInput;
  };

  if (!question?.trim()) {
    res.status(400).json({ error: 'question is required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Connection', 'keep-alive');

  try {
    let answer = '';

    if (predefinedAnswer?.trim()) {
      // Demo mode: no API key needed, stream word-by-word
      answer = stripMarkdown(predefinedAnswer.trim());
      const words = answer.split(/(\s+)/);
      for (const chunk of words) {
        if (chunk) {
          res.write(sse('token', chunk));
          await new Promise<void>((r) => setTimeout(r, 25));
        }
      }
    } else {
      // Live mode: stream from Anthropic
      const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
      if (!apiKey) {
        res.write(sse('error', { error: 'ANTHROPIC_API_KEY not configured' }));
        res.end();
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
      const stream = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        stream: true,
        system: 'Answer directly in plain prose only — no markdown, no asterisks, no bullet points, no numbered lists, no headers, no backticks. Write in paragraphs. Be accurate and specific.',
        messages: [{ role: 'user', content: userContent }],
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const token = event.delta.text;
          answer += token;
          res.write(sse('token', token));
        }
      }
      answer = stripMarkdown(answer);
    }

    res.write(sse('answer', { answer }));
    res.write(sse('done', {}));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[naus/ask]', message);
    try { res.write(sse('error', { error: message })); } catch { /* stream may be closed */ }
  } finally {
    res.end();
  }
}
