# n8n Integration Guide

This guide explains how to integrate n8n with the Customer Success Platform for advanced workflow automation.

## Overview

n8n is a workflow automation tool that can be integrated with the platform to:
- Trigger workflows based on health score changes
- Automate customer outreach and engagement
- Integrate with external systems (email, Slack, CRM, etc.)
- Create complex multi-step automations

## Setup Options

### Option 1: Self-Hosted n8n (Recommended)

1. **Install n8n using Docker:**

```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=your_password \
  -e WEBHOOK_URL=http://localhost:5678/ \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

2. **For production (with persistence):**

```yaml
# docker-compose.yml
version: '3.8'

services:
  n8n:
    image: n8nio/n8n
    container_name: n8n
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
      - WEBHOOK_URL=${N8N_WEBHOOK_URL}
      - GENERIC_TIMEZONE=America/New_York
    volumes:
      - n8n_data:/home/node/.n8n
    networks:
      - app_network

volumes:
  n8n_data:

networks:
  app_network:
```

3. **Start n8n:**

```bash
docker-compose up -d
```

4. **Access n8n:**
   - Navigate to http://localhost:5678
   - Login with your credentials

### Option 2: n8n Cloud

1. Sign up at https://n8n.io/cloud
2. Create a new workspace
3. Get your webhook URLs

## Platform Configuration

### 1. Add n8n Webhook URL to Environment Variables

Add to `.env.local`:

```bash
# n8n Configuration
N8N_WEBHOOK_URL=http://localhost:5678/webhook
N8N_API_KEY=your_n8n_api_key  # Optional, for direct API calls
```

### 2. Update Playbook Execution to Call n8n

The platform already has a webhook queue system. To integrate with n8n:

1. **Create an n8n workflow** with a webhook trigger
2. **Configure the webhook in your playbook** to point to n8n
3. **n8n will receive the webhook and execute your automation**

## Example Workflows

### Workflow 1: Health Score Alert

**Trigger:** Health score drops below 40
**Actions:**
1. Send Slack notification to CSM
2. Create task in Asana
3. Send email to account owner
4. Update CRM opportunity

**n8n Workflow Setup:**

```json
{
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "health-score-alert",
        "responseMode": "onReceived"
      }
    },
    {
      "name": "Extract Data",
      "type": "n8n-nodes-base.set",
      "parameters": {
        "values": {
          "string": [
            {
              "name": "accountName",
              "value": "={{$json.account.name}}"
            },
            {
              "name": "healthScore",
              "value": "={{$json.health_score}}"
            },
            {
              "name": "csmEmail",
              "value": "={{$json.csm.email}}"
            }
          ]
        }
      }
    },
    {
      "name": "Send Slack Alert",
      "type": "n8n-nodes-base.slack",
      "parameters": {
        "channel": "#customer-success",
        "text": "🚨 Health Score Alert: {{$node['Extract Data'].json['accountName']}} dropped to {{$node['Extract Data'].json['healthScore']}}"
      }
    },
    {
      "name": "Send Email",
      "type": "n8n-nodes-base.emailSend",
      "parameters": {
        "fromEmail": "alerts@yourcompany.com",
        "toEmail": "={{$node['Extract Data'].json['csmEmail']}}",
        "subject": "Action Required: Customer Health Alert",
        "text": "Account health score has dropped below threshold."
      }
    }
  ]
}
```

### Workflow 2: Onboarding Automation

**Trigger:** New account enters "Onboarding" stage
**Actions:**
1. Send welcome email
2. Create onboarding checklist
3. Schedule kickoff call
4. Add to onboarding cohort in email tool

### Workflow 3: Renewal Risk Management

**Trigger:** Account enters "At Risk" state with renewal in 60 days
**Actions:**
1. Escalate to VP of CS
2. Schedule executive business review
3. Analyze usage patterns
4. Create intervention plan

## Integration Code

### Create Webhook Endpoint Handler

Add to `app/api/webhooks/n8n/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    
    // Verify webhook signature (if configured)
    const signature = request.headers.get('x-n8n-signature')
    // Add signature verification logic here
    
    // Log the incoming webhook
    await query(
      `INSERT INTO webhook_queue (
        webhook_url, 
        payload, 
        status,
        received_at
      ) VALUES ($1, $2, 'completed', NOW())`,
      ['n8n-webhook', JSON.stringify(payload)]
    )
    
    return NextResponse.json({ 
      success: true,
      message: 'Webhook received'
    })
  } catch (error) {
    console.error('n8n webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
```

### Trigger n8n from Playbook Execution

Update `app/actions/dashboard.ts` to include n8n webhook:

```typescript
export async function executePlaybook(
  playbookId: string,
  accountId: string,
  triggeredBy: string
) {
  // ... existing code ...
  
  // Get playbook details
  const playbook = await query(
    'SELECT * FROM playbooks WHERE id = $1',
    [playbookId]
  )
  
  // Get account details
  const account = await query(
    'SELECT * FROM accounts WHERE id = $1',
    [accountId]
  )
  
  // Trigger n8n webhook if configured
  const n8nWebhookUrl = playbook.rows[0].n8n_webhook_url
  if (n8nWebhookUrl) {
    await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        playbook: playbook.rows[0],
        account: account.rows[0],
        triggeredBy,
        timestamp: new Date().toISOString()
      })
    })
  }
  
  // ... rest of execution logic ...
}
```

## Database Updates

Add n8n webhook URL field to playbooks table:

```sql
-- Add to existing playbooks table
ALTER TABLE playbooks 
ADD COLUMN IF NOT EXISTS n8n_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS n8n_workflow_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_playbooks_n8n 
ON playbooks(n8n_webhook_url) 
WHERE n8n_webhook_url IS NOT NULL;
```

## Security Considerations

1. **Webhook Signatures:**
   - Configure n8n to sign webhooks
   - Verify signatures in your webhook handler

2. **Authentication:**
   - Use API keys for n8n API calls
   - Store keys securely in environment variables

3. **Network Security:**
   - Use HTTPS for all webhook URLs
   - Consider VPN or private network for self-hosted n8n

4. **Rate Limiting:**
   - Implement rate limiting on webhook endpoints
   - Monitor for suspicious activity

## Monitoring and Debugging

1. **n8n Execution Logs:**
   - Access at http://localhost:5678/workflows → Select workflow → Executions

2. **Platform Webhook Queue:**
   - Check `webhook_queue` table for webhook status
   - View logs in Automation Panel → Execution Logs

3. **Enable Debug Mode:**

```bash
# In n8n container
docker exec -it n8n sh
export N8N_LOG_LEVEL=debug
```

## Sample Use Cases

### 1. Automated Health Score Calculations

Trigger daily health score recalculations via n8n cron job:

```javascript
// n8n Cron Node → HTTP Request Node
{
  "method": "POST",
  "url": "https://your-app.com/api/health-scores/calculate",
  "authentication": "headerAuth",
  "headers": {
    "Authorization": "Bearer YOUR_API_KEY"
  }
}
```

### 2. Multi-Channel Customer Outreach

When account becomes at-risk:
1. Send email (SendGrid)
2. Send SMS (Twilio)
3. Create Slack channel
4. Schedule call (Calendly)
5. Update CRM (Salesforce)

### 3. Data Sync

Sync data between platform and external systems:
- Export metrics to data warehouse
- Update CRM with health scores
- Sync account data with billing system

## Testing

1. **Test n8n Webhook:**

```bash
curl -X POST http://localhost:5678/webhook/health-score-alert \
  -H "Content-Type: application/json" \
  -d '{
    "account": {
      "id": "123",
      "name": "Acme Corp",
      "health_score": 35
    },
    "csm": {
      "email": "csm@example.com"
    }
  }'
```

2. **Verify in n8n UI:**
   - Check workflow executions
   - Review node outputs
   - Check error logs if failed

## Resources

- n8n Documentation: https://docs.n8n.io
- n8n Community: https://community.n8n.io
- Workflow Templates: https://n8n.io/workflows
- Platform Webhook Queue: `/dashboard/automation` → Execution Logs

## Next Steps

1. Install and configure n8n
2. Create your first workflow
3. Add n8n webhook URL to a playbook
4. Test the integration
5. Monitor execution logs
6. Expand to more complex workflows
