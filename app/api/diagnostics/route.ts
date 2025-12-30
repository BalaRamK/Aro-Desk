import { NextResponse } from 'next/server'
import { diagnoseDatabaseState } from '@/app/actions/diagnostics'

export async function GET() {
  try {
    const data = await diagnoseDatabaseState()
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
