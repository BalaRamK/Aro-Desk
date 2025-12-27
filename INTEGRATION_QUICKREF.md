# Quick Reference: External Data Integration

## Access Points

| Component | URL | Purpose |
|-----------|-----|---------|
| Integrations Page | http://localhost:3000/dashboard/integrations | Manage external data sources |
| n8n Workflows | http://localhost:5678 | Create/edit sync workflows |
| External Contacts | Database: external_contacts | Synced CRM contacts |
| External Tickets | Database: external_tickets | Synced support tickets |
| External Deals | Database: external_deals | Synced opportunities |

## Quick Setup Commands

### Install n8n
```bash
# Option 1: Docker (Fastest)
docker run -d --restart unless-stopped --name n8n \
  -p 5678:5678 \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=changeme \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n

# Option 2: Docker Compose (Production)
docker-compose up -d n8n

# Option 3: npm (Local Development)
npm install -g n8n
n8n start
```

### Check Database Tables
```sql
-- List all integration tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'integration_%' OR table_name LIKE 'external_%';

-- Count synced records by type
SELECT source_type, COUNT(*) as count 
FROM integration_synced_records 
GROUP BY source_type;

-- View recent syncs
SELECT id, source_type, status, sync_started_at, records_processed 
FROM integration_sync_logs 
ORDER BY sync_started_at DESC 
LIMIT 10;
```

### Test Webhook
```bash
curl -X POST http://localhost:3000/api/webhooks/n8n \
  -H "Content-Type: application/json" \
  -d '{
    "integration_id": "test-id",
    "data_type": "contacts",
    "records": [{
      "external_id": "test_123",
      "email": "test@example.com",
      "first_name": "Test",
      "last_name": "User",
      "title": "Manager"
    }],
    "source_type": "zoho_crm",
    "api_key": "your-api-key"
  }'
```

## Common Integrations Setup

### Zoho CRM
**Webhook URL**: `http://localhost:5678/webhook/zoho-crm-sync`

**Environment Variables**:
```bash
ZOHO_CRM_CLIENT_ID=your_client_id
ZOHO_CRM_CLIENT_SECRET=your_secret  
ZOHO_CRM_REFRESH_TOKEN=your_refresh_token
```

**Data Synced**: Contacts, Deals, Custom Fields

### Zoho Desk
**Webhook URL**: `http://localhost:5678/webhook/zoho-desk-sync`

**Environment Variables**:
```bash
ZOHO_DESK_ORG_ID=your_org_id
ZOHO_DESK_API_KEY=your_api_key
```

**Data Synced**: Support Tickets, Contacts

### Jira
**Webhook URL**: `http://localhost:5678/webhook/jira-sync`

**Environment Variables**:
```bash
JIRA_EMAIL=admin@company.com
JIRA_API_TOKEN=your_token
JIRA_DOMAIN=company.atlassian.net
```

**Data Synced**: Issues, Bugs, Feature Requests

### Salesforce
**Webhook URL**: `http://localhost:5678/webhook/salesforce-sync`

**Environment Variables**:
```bash
SALESFORCE_CLIENT_ID=your_client_id
SALESFORCE_CLIENT_SECRET=your_secret
SALESFORCE_USERNAME=your_user
SALESFORCE_PASSWORD=your_password
SALESFORCE_SECURITY_TOKEN=your_token
```

**Data Synced**: Opportunities, Accounts, Contacts

### HubSpot
**Webhook URL**: `http://localhost:5678/webhook/hubspot-sync`

**Environment Variables**:
```bash
HUBSPOT_API_KEY=your_api_key
```

**Data Synced**: Deals, Contacts, Companies

## n8n Workflow Template Structure

All workflows follow this pattern:

```
1. Webhook Trigger
   ├─ Receives: integration_id, sync_log_id
   └─ Returns: webhook_body

2. Query External API
   ├─ Uses: API credentials from env
   └─ Returns: raw data array

3. Transform Data
   ├─ Maps external fields → internal format
   ├─ Handles: date formatting, enums, custom fields
   └─ Returns: standardized records

4. Post to Platform Webhook
   ├─ URL: http://localhost:3000/api/webhooks/n8n
   ├─ Includes: integration_id, sync_log_id, api_key
   └─ Returns: success/failed stats

5. (Optional) Error Notification
   ├─ Slack message on failure
   └─ Email alert to admin
```

## Field Mapping Examples

### Status Enum Mapping
```javascript
{
  type: 'enum_map',
  map: {
    'Open': 'active',
    'In Progress': 'active',
    'Closed': 'resolved',
    'Cancelled': 'lost'
  }
}
```

### Date Format Conversion
```javascript
{
  type: 'date_format',
  from: 'YYYY-MM-DD',
  to: 'ISO8601'
}
```

### Email Domain Extraction
```javascript
{
  type: 'domain_extract',
  from: 'email_field',
  match: 'accounts.domain'
}
```

## Scheduled Sync Cron Expressions

| Schedule | Cron | Use Case |
|----------|------|----------|
| Every hour | `0 * * * *` | High-volume updates |
| Every 6 hours | `0 0-23/6 * * *` | Daily snapshot |
| Every 12 hours | `0 0,12 * * *` | Twice daily sync |
| Daily at 2 AM | `0 2 * * *` | Nightly batch |
| Every Monday 8 AM | `0 8 * * 1` | Weekly deep sync |
| Every 15 minutes | `*/15 * * * *` | Real-time (heavy) |

## Monitoring Queries

### Sync Success Rate (Last 7 Days)
```sql
SELECT 
  source_type,
  COUNT(*) as total_syncs,
  COUNT(*) FILTER (WHERE status = 'success') as successful,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'success') / COUNT(*), 2) as success_rate_percent
FROM integration_sync_logs
WHERE sync_started_at > NOW() - INTERVAL '7 days'
GROUP BY source_type
ORDER BY success_rate_percent DESC;
```

### Average Sync Duration by Source
```sql
SELECT 
  source_type,
  AVG(duration_ms) as avg_ms,
  MAX(duration_ms) as max_ms,
  MIN(duration_ms) as min_ms
FROM integration_sync_logs
WHERE status = 'success'
  AND sync_started_at > NOW() - INTERVAL '30 days'
GROUP BY source_type;
```

### Recent Failures
```sql
SELECT 
  id, source_type, error_message, sync_started_at, duration_ms
FROM integration_sync_logs
WHERE status = 'failed'
  AND sync_started_at > NOW() - INTERVAL '24 hours'
ORDER BY sync_started_at DESC;
```

### Data Volume by Integration
```sql
SELECT 
  source_type,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE sync_status = 'synced') as active,
  MAX(last_synced_at) as last_sync
FROM integration_synced_records
GROUP BY source_type
ORDER BY total_records DESC;
```

## Useful Docker Commands

```bash
# View n8n logs
docker logs n8n -f

# Stop n8n
docker stop n8n

# Start n8n
docker start n8n

# Remove n8n
docker rm -f n8n

# Access n8n shell
docker exec -it n8n /bin/sh

# Clear n8n data
docker volume prune
```

## TypeScript Type Reference

```typescript
// Integration Source Type
interface IntegrationSource {
  id: string;
  tenant_id: string;
  source_type: 'jira' | 'zoho_crm' | 'zoho_desk' | 'salesforce' | 'hubspot' | 'zendesk' | 'intercom' | 'slack' | 'custom';
  name: string;
  description?: string;
  config: {
    api_url?: string;
    api_key?: string;
    [key: string]: any;
  };
  n8n_webhook_url?: string;
  is_active: boolean;
  last_sync_status?: 'success' | 'failed' | 'partial' | 'pending';
  sync_count: number;
  created_at: Date;
  updated_at: Date;
}

// External Contact Type
interface ExternalContact {
  id: string;
  external_id: string;
  source_type: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  title?: string;
  properties: Record<string, any>;
  last_synced_at: Date;
}

// Sync Log Type
interface SyncLog {
  id: string;
  integration_source_id: string;
  sync_started_at: Date;
  sync_completed_at?: Date;
  status: 'running' | 'success' | 'failed' | 'partial';
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  error_message?: string;
}
```

## Environment Variables Checklist

```bash
# Required for webhook security
N8N_WEBHOOK_API_KEY=your-secure-key-here

# Zoho CRM (if using)
ZOHO_CRM_CLIENT_ID=
ZOHO_CRM_CLIENT_SECRET=
ZOHO_CRM_REFRESH_TOKEN=

# Zoho Desk (if using)
ZOHO_DESK_ORG_ID=
ZOHO_DESK_API_KEY=

# Jira (if using)
JIRA_EMAIL=
JIRA_API_TOKEN=
JIRA_DOMAIN=

# Salesforce (if using)
SALESFORCE_CLIENT_ID=
SALESFORCE_CLIENT_SECRET=
SALESFORCE_USERNAME=
SALESFORCE_PASSWORD=
SALESFORCE_SECURITY_TOKEN=

# HubSpot (if using)
HUBSPOT_API_KEY=

# n8n (if using Docker Compose)
N8N_PASSWORD=strong_password_here
```

## File Structure

```
/Volumes/Extreme SSD/Aro Desk/
├── database/
│   ├── migrations/
│   │   └── 04_integrations.sql          # Schema definition
│   └── run-migration.sh                 # Migration runner
├── app/
│   ├── actions/
│   │   └── integrations.ts              # Server actions
│   ├── api/
│   │   └── webhooks/
│   │       └── n8n/
│   │           └── route.ts             # Webhook endpoint
│   └── dashboard/
│       ├── integrations/
│       │   ├── page.tsx                 # Page wrapper
│       │   └── integrations-content.tsx # UI component
│       └── layout.tsx                   # Navigation update
├── INTEGRATION_SETUP.md                 # Architecture guide
├── N8N_WORKFLOWS.md                     # Workflow examples
└── INTEGRATION_COMPLETE.md              # This summary
```

## Support Resources

- **[INTEGRATION_SETUP.md](./INTEGRATION_SETUP.md)** - Full architecture & setup guide
- **[N8N_WORKFLOWS.md](./N8N_WORKFLOWS.md)** - Workflow templates & examples  
- **[INTEGRATION_COMPLETE.md](./INTEGRATION_COMPLETE.md)** - Feature summary

## Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| **Webhook 401** | Check `N8N_WEBHOOK_API_KEY` in env & request |
| **n8n unreachable** | Use public domain, not localhost |
| **No sync logs** | Check n8n execution logs & workflow errors |
| **Data not syncing** | Verify field mappings & account matching |
| **Rate limit errors** | Add delays in n8n workflow or reduce frequency |
| **Memory issues** | Reduce batch size in n8n, run smaller syncs |
| **RLS blocking** | Ensure current_tenant_id() is set in context |

## Getting Help

1. Check **Sync Logs** tab on Integrations page
2. Review **n8n execution logs**: `docker logs n8n`
3. Query **integration_sync_logs** table for error details
4. Check **INTEGRATION_SETUP.md** troubleshooting section
5. Review workflow in **N8N_WORKFLOWS.md** for patterns
