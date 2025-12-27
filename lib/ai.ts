import { NextResponse } from 'next/server';

export type SentimentResult = {
  score: number;
  magnitude?: number;
  label?: 'negative' | 'neutral' | 'positive';
  summary?: string;
  language?: string;
};

async function callOpenAI(prompt: string, system?: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  const body = {
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    messages: [
      system ? { role: 'system', content: system } : undefined,
      { role: 'user', content: prompt },
    ].filter(Boolean),
    temperature: 0.2,
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${err}`);
  }

  const json = await res.json();
  return json;
}

export async function analyzeSentiment(text: string): Promise<SentimentResult> {
  const system = 'You analyze customer success text for sentiment. Return JSON with keys: score (-1..1), magnitude (0..inf), label (negative|neutral|positive), summary, language.';
  const prompt = `Text:\n${text}\n\nReturn strict JSON.`;
  const data = await callOpenAI(prompt, system);
  const content = data.choices?.[0]?.message?.content || '{}';
  try {
    const parsed = JSON.parse(content);
    return parsed as SentimentResult;
  } catch {
    return { score: 0, label: 'neutral', summary: 'Unable to parse', language: 'en' };
  }
}

export async function generateFollowUpEmail(context: Record<string, any>): Promise<string> {
  const system = 'You are a Customer Success assistant. Write concise, friendly follow-up emails that are actionable.';
  const prompt = `Context: ${JSON.stringify(context)}\n\nWrite the email body only.`;
  const data = await callOpenAI(prompt, system);
  return data.choices?.[0]?.message?.content || '';
}
