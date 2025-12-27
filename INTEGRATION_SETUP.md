# Integration Architecture & Setup Guide

## Overview

The platform integrates external data sources (Jira, Zoho CRM, Zoho Desk, Salesforce, HubSpot, Zendesk, Intercom, Slack, etc.) using n8n as the data orchestration layer.

## Architecture Diagram

```
External Systems          n8n                    Platform
└─ Jira                   ├─ Webhooks       →    ├─ Integration Sources
└─ Zoho CRM               ├─ API Calls       →    ├─ External Data Tables
└─ Zoho Desk              ├─ Data Transform  →    ├─ Field Mappings
└─ Salesforce             └─ Scheduling      →    └─ Sync History
└─ HubSpot
```

## Database Schema

### Core Integration Tables

**integration_sources**
```sql
-- Stores connection configurations and webhook URLs
- id (UUID, PK)
- tenant_id (UUID, FK)
- source_type (ENUM: jira, zoho_crm, zoho_desk, salesforce, hubspot, zendesk, intercom, slack, custom)
- name (TEXT)
- description (TEXT)
- config (JSONB) -- API credentials, URLs, settings
- n8n_workflow_id (TEXT)
- n8n_webhook_url (TEXT) -- The webhook n8n calls back with data
- is_active (BOOLEAN)
- last_sync_at (TIMESTAMPTZ)
- last_sync_status (sync | failed | partial | pending)
- last_sync_error (TEXT)
- sync_count (INTEGER)
- created_at, updated_at, created_by
```

**integration_field_mappings**
```sql
-- Defines how external fields map to platform tables
- id (UUID, PK)
- integration_source_id (UUID, FK)
- source_field (TEXT) -- "email", "status", "owner_name"
- target_table (TEXT) -- "external_contacts", "external_tickets", "external_deals"
- target_field (TEXT) -- "email", "status", "owner_email"
- transformation_rule (JSONB) -- date format, enum mapping, etc
- is_required (BOOLEAN)
- default_value (TEXT)
```

### External Data Tables

**external_contacts**
```sql
- id, tenant_id, account_id
- external_id, source_type (e.g., "zoho_crm_12345")
- first_name, last_name, email, phone, title
- properties (JSONB) -- additional fields
- created_at, updated_at, last_synced_at
```

**external_tickets**
```sql
- id, tenant_id, account_id
- external_id, source_type (e.g., "zoho_desk_ticket_99")
- title, description, status, priority, ticket_type
- reporter_email, assignee_email
- created_date, updated_date, resolved_date
- properties (JSONB)
```

**external_deals**
```sql
- id, tenant_id, account_id
- external_id, source_type (e.g., "zoho_crm_deal_555")
- name, amount, stage, probability
- close_date, created_date, owner_email
- properties (JSONB)
```

**integration_sync_logs & integration_synced_records**
```sql
-- Tracks all sync operations and individual record sync status
- sync_id, started_at, completed_at, status
- records_processed, created, updated, failed
- error_message, error_details
- triggered_by (manual | scheduled | webhook | n8n)
```

## Setup Instructions

### Phase 1: Install n8n

#### Local Development (Docker)

```bash
# Start n8n locally
docker run -d --restart unless-stopped --name n8n \
  -p 5678:5678 \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=changeme \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n

# Access at http://localhost:5678
```

#### Docker Compose (Recommended for Production)

```yaml
# docker-compose.yml
version: '3.8'
services:
  n8n:
    image: n8nio/n8n:latest
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
      - N8N_HOST=n8n.yourdomain.com
      - N8N_PROTOCOL=https
      - NODE_ENV=production
      - WEBHOOK_TUNNEL_URL=https://n8n.yourdomain.com/
    volumes:
      - n8n_data:/home/node/.n8n
    networks:
      - platform

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: n8n
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - platform

volumes:
  n8n_data:
  postgres_data:

networks:
  platform:
```

### Phase 2: Configure Environment Variables

Add to your `.env.local`:

```bash
# Webhook Security
N8N_WEBHOOK_API_KEY=your-super-secret-key-here

# External API Credentials
ZOHO_CRM_CLIENT_ID=your.zoho.client.id
ZOHO_CRM_CLIENT_SECRET=your.zoho.secret
ZOHO_CRM_REFRESH_TOKEN=refresh_token_here

ZOHO_DESK_ORG_ID=123456789
ZOHO_DESK_API_KEY=your_api_key

JIRA_EMAIL=admin@company.com
JIRA_API_TOKEN=your_api_token
JIRA_DOMAIN=company.atlassian.net

SALESFORCE_CLIENT_ID=sf_client_id
SALESFORCE_CLIENT_SECRET=sf_secret
SALESFORCE_USERNAME=sf_user
SALESFORCE_PASSWORD=sf_pass
SALESFORCE_SECURITY_TOKEN=sf_token

HUBSPOT_API_KEY=hubspot_api_key

N8N_PASSWORD=strong_password_here
```

### Phase 3: Create Integration Sources in Platform

#### Via UI (New Integrations Page)

1. Navigate to `http://localhost:3000/dashboard/integrations`
2. Click "Add Integration"
3. Configure:
   - **Integration Type**: Select from dropdown (Zoho CRM, Jira, etc.)
   - **Name**: "Zoho CRM Production"
   - **Description**: "Syncs contacts and deals from Zoho"
   - **n8n Webhook URL**: `http://localhost:5678/webhook/your-workflow-id`
   - **API URL**: (optional) "https://api.zoho.com/crm/v2"
   - **API Key**: (optional) Encrypted in config

#### Via API

```bash
curl -X POST http://localhost:3000/api/integrations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "source_type": "zoho_crm",
    "name": "Zoho CRM Production",
    "description": "Sync contacts and deals",
    "n8n_webhook_url": "http://localhost:5678/webhook/zoho-sync",
    "config": {
      "api_url": "https://api.zoho.com/crm/v2",
      "api_key": "encrypted_key"
    }
  }'
```

### Phase 4: Create n8n Workflows

#### Workflow Structure (All Integrations Follow This Pattern)

```
[Webhook Trigger] 
    ↓
[Query External API]
    ↓
[Transform Data]
    ↓
[Send to Platform Webhook]
    ↓
[Log Sync Result]
```

#### Example: Zoho CRM to Platform

**n8n Webhook Configuration**
- Path: `zoho-crm-sync`
- Full URL: `http://localhost:5678/webhook/zoho-crm-sync`

**Nodes:**

1. **Webhook** (Trigger)
   - Method: POST
   - Path: zoho-crm-sync
   - Returns: webhook_body

2. **Zoho CRM** (Query)
   - Operation: Get All Contacts
   - Return All: true
   - Credentials: OAuth2

3. **Code** (Transform)
   ```javascript
   // Transform Zoho contacts to platform format
   const contacts = [];
   
   for (const item of items) {
     const contact = {
       external_id: item.json.id,
       account_id: item.json.Account_Name?.id || null,
       first_name: item.json.First_Name,
       last_name: item.json.Last_Name,
       email: item.json.Email,
       phone: item.json.Phone,
       title: item.json.Title,
       created_at: item.json.Created_Time,
       modified_at: item.json.Modified_Time
     };
     
     contacts.push({ json: contact });
   }
   
   return contacts;
   ```

4. **HTTP Request** (POST to Platform)
   ```
   URL: http://localhost:3000/api/webhooks/n8n
   Method: POST
   Headers: Content-Type: application/json
   Body: {
     "integration_id": "{{ $node.Webhook.json.body.integration_id }}",
     "sync_log_id": "{{ $node.Webhook.json.body.sync_log_id }}",
     "data_type": "contacts",
     "source_type": "zoho_crm",
     "api_key": "{{ $env.N8N_WEBHOOK_API_KEY }}",
     "records": {{ $json }}
   }
   ```

### Phase 5: Testing & Validation

#### 1. Test Webhook Endpoint

```bash
curl -X POST http://localhost:3000/api/webhooks/n8n \
  -H "Content-Type: application/json" \
  -d '{
    "integration_id": "test-id",
    "data_type": "contacts",
    "records": [
      {
        "external_id": "zcrm_123",
        "email": "john@company.com",
        "first_name": "John",
        "last_name": "Doe",
        "title": "Manager"
      }
    ],
    "source_type": "zoho_crm",
    "api_key": "your-api-key"
  }'
```

#### 2. Verify in Platform

1. Go to Integrations page
2. View "Synced Records" count
3. Check Sync Logs for details
4. Click "View External Data" to see synced records

#### 3. Monitor Performance

```sql
-- Check recent syncs
SELECT 
  id, source_type, sync_started_at, status,
  records_processed, records_created, duration_ms
FROM integration_sync_logs
ORDER BY sync_started_at DESC
LIMIT 10;

-- View synced contacts
SELECT 
  id, external_id, source_type, email, phone,
  last_synced_at
FROM external_contacts
WHERE source_type = 'zoho_crm'
ORDER BY last_synced_at DESC;
```

## Field Mapping Examples

### Zoho CRM → Platform

```javascript
// Status mapping
{
  type: 'enum_map',
  map: {
    'Open': 'active',
    'In Progress': 'active',
    'Closed': 'resolved',
    'Lost': 'churned'
  }
}

// Date format conversion
{
  type: 'date_format',
  from: 'YYYY-MM-DD',
  to: 'ISO8601'
}

// Email domain to account matching
{
  type: 'domain_extract',
  from: 'email_field',
  match: 'account.domain'
}
```

### Jira → Platform

```javascript
// Severity to priority mapping
{
  type: 'enum_map',
  map: {
    'Blocker': 'critical',
    'High': 'high',
    'Medium': 'medium',
    'Low': 'low',
    'Trivial': 'low'
  }
}
```

## Scheduling Syncs

### Option 1: n8n Cron Node (Recommended)

Add a Cron trigger to your workflow:
- Every hour: `0 * * * *`
- Every 6 hours: `0 0-23/6 * * *`
- Daily at 2 AM: `0 2 * * *`

### Option 2: Platform Scheduled Jobs (Future)

```typescript
// Schedule daily sync at 3 AM
await scheduleSync({
  integrationId: 'zoho-crm-prod',
  schedule: '0 3 * * *',
  dataTypes: ['contacts', 'deals']
});
```

### Option 3: Manual Sync via UI

1. Go to Integrations page
2. Click "Sync Now" on any integration
3. Monitor in Sync Logs

## Error Handling & Monitoring

### Sync Failure Recovery

```sql
-- Find failed syncs
SELECT 
  id, source_type, error_message, sync_started_at
FROM integration_sync_logs
WHERE status = 'failed'
  AND sync_started_at > NOW() - INTERVAL '24 hours'
ORDER BY sync_started_at DESC;

-- Retry a failed sync
SELECT trigger_sync('integration-id');
```

### Set Up n8n Error Notifications

Add to your workflow after HTTP Request:
1. **Error Trigger** node
2. **Slack/Email** notification
3. Include: integration_id, error_message, sync_log_id

## Security Best Practices

### 1. API Key Management

- Store all API keys in environment variables
- Encrypt keys in database config column
- Rotate keys regularly
- Never commit credentials to Git

### 2. Webhook Security

```typescript
// Verify webhook signature (recommended)
import crypto from 'crypto';

function verifyWebhookSignature(payload: string, signature: string, secret: string) {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(hash, signature);
}
```

### 3. Database Access Control

- Enable RLS (Row Level Security) - Already implemented
- Audit all integration operations
- Limit sync frequency to prevent rate limit abuse
- Monitor large data transfers

### 4. Data Privacy

- Only sync necessary fields
- Mask PII in logs
- Implement data retention policies
- Comply with GDPR/CCPA

## Monitoring & Observability

### Key Metrics to Track

```sql
-- Sync success rate (last 7 days)
SELECT 
  source_type,
  COUNT(*) as total_syncs,
  COUNT(*) FILTER (WHERE status = 'success') as successful,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'success') / COUNT(*), 2) as success_rate
FROM integration_sync_logs
WHERE sync_started_at > NOW() - INTERVAL '7 days'
GROUP BY source_type;

-- Average sync duration
SELECT 
  source_type,
  AVG(duration_ms) as avg_duration_ms,
  MAX(duration_ms) as max_duration_ms,
  MIN(duration_ms) as min_duration_ms
FROM integration_sync_logs
WHERE status = 'success'
  AND sync_started_at > NOW() - INTERVAL '30 days'
GROUP BY source_type;

-- Data volume by source
SELECT 
  source_type,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE sync_status = 'synced') as active_records,
  MAX(last_synced_at) as last_sync
FROM integration_synced_records
GROUP BY source_type;
```

### Dashboards

Create n8n monitoring dashboard showing:
- Total syncs per hour
- Failed syncs alerts
- Average sync duration
- Records processed per integration

## Common Integration Patterns

### Contact Sync Pattern
```
Jira Reporter → external_contacts → Link to accounts by email domain
Zoho Contact → external_contacts → Link to accounts by account_id
Salesforce Lead → external_contacts → Link to accounts by company_id
```

### Ticket Sync Pattern
```
Jira Issue → external_tickets → auto-link to account
Zoho Ticket → external_tickets → auto-link by reporter email
Zendesk Ticket → external_tickets → auto-link by organization
```

### Deal Sync Pattern
```
Zoho Deal → external_deals → Link to account by account_id
Salesforce Opportunity → external_deals → Link to account
HubSpot Deal → external_deals → Link to account
```

## Troubleshooting

### Common Issues

**Problem**: "Webhook URL not reachable"
- Solution: Ensure n8n can reach platform via internet (not localhost)
- Use public n8n domain: `https://n8n.yourdomain.com`

**Problem**: "Integration keeps failing"
- Check n8n logs: `docker logs n8n`
- Verify API credentials are correct
- Check rate limits on external API
- Review Sync Logs for error details

**Problem**: "Data not syncing to accounts"
- Verify email domains match in external_contacts
- Check field_mappings configuration
- Ensure account records exist
- Review sync logs for mapping errors

**Problem**: "Memory/Performance issues"
- Reduce batch size in n8n
- Schedule syncs during off-hours
- Add rate limiting to workflow
- Consider incremental syncs (delta)

## Next Steps

1. ✅ Create n8n instance
2. ✅ Set up first integration (Zoho CRM)
3. ✅ Configure field mappings
4. ✅ Schedule automated syncs
5. ✅ Set up monitoring & alerts
6. ⏳ Add more integrations as needed
7. ⏳ Implement custom data transformations
8. ⏳ Create automated actions based on synced data

## API Reference

See [N8N_WORKFLOWS.md](./N8N_WORKFLOWS.md) for detailed workflow examples and API documentation.
