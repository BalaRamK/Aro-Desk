# Customer Success Extensions

This module adds dynamic lifecycle health scoring, sentiment analysis, success plans, playbooks, unified CDI, and AI-automated workflows.

## Overview
- Dynamic Health Scoring: Stage-weighted metrics (usage frequency, breadth, depth)
- Trend & Sentiment: Detect dips and negative sentiment with alerts
- Success Plans: Goals, steps, attributes per account
- Playbooks: Prescribed actions for scenarios
- CDI: Unified events from support, analytics, CRM
- AI Workflows: Auto emails and alerts

## Database (Migration 05)
Tables:
- lifecycle_stages
- health_scores
- sentiment_analyses
- success_plans
- success_plan_steps
- playbooks
- playbook_runs
- cdi_events
- ai_workflows
- ai_workflow_runs
- alerts

All tables enforce tenant isolation via Row Level Security (RLS).

## Server Actions
File: app/actions/customer_success.ts
- upsertLifecycleStageWeights(stage, weights)
- recordHealthScore(accountId, stage, metrics, windowStart, windowEnd)
- getHealthTrend(accountId, limit?)
- analyzeTextsForSentiment(accountId, items[])
- createSuccessPlan(accountId, name, targetDate?, attributes?)
- addPlanStep(planId, title, dueDate?, assigneeUserId?)
- updatePlanStepStatus(stepId, status)
- createPlaybook(name, scenarioKey, triggers, actions)
- runPlaybook(playbookId, accountId, triggeredBy?)
- ingestCdiEvent(accountId, sourceType, eventType, payload, occurredAt)
- triggerAiFollowUp(workflowId, accountId, context)

## AI Utilities
File: lib/ai.ts
- analyzeSentiment(text): Uses OpenAI Chat Completions to return score/label
- generateFollowUpEmail(context): Produces a customer-friendly follow-up email body

Set environment variables:
- OPENAI_API_KEY=your-key
- OPENAI_MODEL=gpt-4.1-mini (optional override)

## Sentiment API Endpoint
File: app/api/ai/sentiment/route.ts
- POST with header x-api-key: N8N_WEBHOOK_API_KEY
- Payload: { account_id, items: [{ source_type, source_id, text, language? }] }
- Stores sentiment results and returns ids/scores

## Alerts
- Health dip: Inserts alert when trend < -0.1
- Negative sentiment: Inserts alert when score < -0.4

## Usage Examples

### Configure Stage Weights
```ts
await upsertLifecycleStageWeights('adoption', { usage_frequency: 0.5, breadth: 0.25, depth: 0.25 })
```

### Record Health Score
```ts
await recordHealthScore(accountId, 'adoption', { usage_frequency: 0.7, breadth: 0.5, depth: 0.6 }, '2025-12-01', '2025-12-27')
```

### Analyze Sentiment
```ts
await analyzeTextsForSentiment(accountId, [
  { source_type: 'note', source_id: 'note:123', text: 'Customer is frustrated with onboarding delays.' }
])
```

### Success Plans & Steps
```ts
const plan = await createSuccessPlan(accountId, 'Onboarding Plan', '2026-01-31')
await addPlanStep(plan.id, 'Kickoff call', '2026-01-05', ownerUserId)
await updatePlanStepStatus(stepId, 'in_progress')
```

### Playbooks
```ts
const pb = await createPlaybook('Low Engagement', 'low_engagement', { threshold: 0.3 }, [ { type: 'email_template', key: 'reengage' } ])
await runPlaybook(pb.id, accountId)
```

### CDI Events
```ts
await ingestCdiEvent(accountId, 'support', 'ticket_created', { ticket_id: 'Z-123', priority: 'High' }, new Date().toISOString())
```

### AI Follow-up
```ts
await triggerAiFollowUp(workflowId, accountId, { meeting_summary: 'Discussed rollout; blockers: SSO.' })
```

## UI (Next Steps)
- Add dashboard sections for Health, Plans, Playbooks, Alerts
- Visualize trends and sentiment over time
- Trigger playbooks from account pages

## Security
- All tables protected via RLS using current_tenant_id()
- API endpoint guarded by N8N_WEBHOOK_API_KEY
- Do not commit raw API keys; use environment variables

## Migration
Run migration 05 using your existing migration runner.
