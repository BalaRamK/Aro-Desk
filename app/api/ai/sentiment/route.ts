import { NextRequest, NextResponse } from 'next/server'
import { analyzeSentiment } from '@/lib/ai'
import { query } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.N8N_WEBHOOK_API_KEY
    const provided = req.headers.get('x-api-key') || ''
    if (!apiKey || provided !== apiKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { account_id, items } = body as { account_id: string, items: Array<{ source_type: string; source_id: string; text: string; language?: string }> }

    if (!account_id || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const results: any[] = []
    for (const item of items) {
      const s = await analyzeSentiment(item.text)
      const label = s.label || (s.score < -0.2 ? 'negative' : s.score > 0.2 ? 'positive' : 'neutral')
      const sql = `
        INSERT INTO sentiment_analyses (tenant_id, account_id, source_type, source_id, sentiment_score, magnitude, label, summary, language)
        VALUES (current_tenant_id(), $1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (tenant_id, source_type, source_id)
        DO UPDATE SET sentiment_score = EXCLUDED.sentiment_score, magnitude = EXCLUDED.magnitude, label = EXCLUDED.label, summary = EXCLUDED.summary
        RETURNING id
      `
      const res = await query(sql, [account_id, item.source_type, item.source_id, s.score, s.magnitude || null, label, s.summary || null, item.language || s.language || 'en'])
      results.push({ id: res.rows[0].id, label, score: s.score })
    }

    return NextResponse.json({ ok: true, results })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 })
  }
}
