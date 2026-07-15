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

const MODEL = 'claude-sonnet-4-5';

// Returns the full answer as JSON — no SSE streaming.
// Vercel Node.js serverless buffers res.write() until res.end(), making SSE
// unreliable. Client-side animation in src/api.ts handles the typewriter effect.
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

  try {
    if (predefinedAnswer?.trim()) {
      // Demo mode: return pre-scripted answer immediately (no API call needed)
      res.json({ answer: stripMarkdown(predefinedAnswer.trim()) });
      return;
    }

    // Live mode
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
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
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: 'Answer directly in plain prose only — no markdown, no asterisks, no bullet points, no numbered lists, no headers, no backticks. Write in paragraphs. Be accurate and specific.',
      messages: [{ role: 'user', content: userContent }],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    const answer = stripMarkdown(textBlock?.type === 'text' ? textBlock.text : '');
    res.json({ answer });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[naus/ask]', message);
    res.status(500).json({ error: message });
  }
}
