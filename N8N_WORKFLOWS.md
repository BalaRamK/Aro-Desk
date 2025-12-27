# n8n Workflow Examples for Data Integration

This guide provides ready-to-use n8n workflows for syncing data from Jira, Zoho CRM, Zoho Desk, and other platforms.

## Table of Contents
1. [Setup Instructions](#setup-instructions)
2. [Zoho CRM Integration](#zoho-crm-integration)
3. [Zoho Desk Integration](#zoho-desk-integration)
4. [Jira Integration](#jira-integration)
5. [Salesforce Integration](#salesforce-integration)
6. [HubSpot Integration](#hubspot-integration)
7. [Field Mapping Guide](#field-mapping-guide)

---

## Setup Instructions

### 1. Install n8n (if not already installed)

```bash
# Using Docker (recommended)
docker run -d --restart unless-stopped --name n8n \
  -p 5678:5678 \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=changeme \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n

# Access n8n at http://localhost:5678
```

### 2. Configure Environment Variables

Add to your `.env.local`:

```env
# n8n Webhook API Key (for security)
N8N_WEBHOOK_API_KEY=your-secure-random-key-here

# External API credentials
ZOHO_CRM_CLIENT_ID=your_client_id
ZOHO_CRM_CLIENT_SECRET=your_client_secret
ZOHO_CRM_REFRESH_TOKEN=your_refresh_token

ZOHO_DESK_ORG_ID=your_org_id
ZOHO_DESK_API_KEY=your_api_key

JIRA_EMAIL=your@email.com
JIRA_API_TOKEN=your_api_token
JIRA_DOMAIN=yourcompany.atlassian.net
```

### 3. Test Webhook Endpoint

```bash
curl -X POST http://localhost:3000/api/webhooks/n8n \
  -H "Content-Type: application/json" \
  -d '{
    "integration_id": "test",
    "data_type": "contacts",
    "records": [],
    "source_type": "test",
    "api_key": "your-secure-random-key-here"
  }'
```

---

## Zoho CRM Integration

### Workflow: Sync Contacts from Zoho CRM

**Purpose**: Sync all contacts from Zoho CRM and map them to accounts

#### n8n Workflow JSON

```json
{
  "name": "Zoho CRM - Sync Contacts",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "zoho-crm-sync",
        "options": {}
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300],
      "webhookId": "your-unique-webhook-id"
    },
    {
      "parameters": {
        "authentication": "oAuth2",
        "resource": "contact",
        "operation": "getAll",
        "returnAll": true
      },
      "name": "Zoho CRM - Get Contacts",
      "type": "n8n-nodes-base.zohoCrm",
      "typeVersion": 1,
      "position": [450, 300]
    },
    {
      "parameters": {
        "jsCode": "// Transform Zoho contacts to our format\nconst contacts = [];\n\nfor (const item of items) {\n  const contact = {\n    external_id: item.json.id,\n    account_id: item.json.Account_Name?.id || null,\n    first_name: item.json.First_Name,\n    last_name: item.json.Last_Name,\n    email: item.json.Email,\n    phone: item.json.Phone,\n    title: item.json.Title,\n    // Store additional fields in properties\n    department: item.json.Department,\n    lead_source: item.json.Lead_Source,\n    created_time: item.json.Created_Time,\n    modified_time: item.json.Modified_Time\n  };\n  \n  contacts.push({ json: contact });\n}\n\nreturn contacts;"
      },
      "name": "Transform Contacts",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [650, 300]
    },
    {
      "parameters": {
        "url": "http://localhost:3000/api/webhooks/n8n",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"integration_id\": \"{{ $json.webhook_body.integration_id }}\",\n  \"sync_log_id\": \"{{ $json.webhook_body.sync_log_id }}\",\n  \"data_type\": \"contacts\",\n  \"source_type\": \"zoho_crm\",\n  \"api_key\": \"{{ $env.N8N_WEBHOOK_API_KEY }}\",\n  \"records\": {{ $json }}\n}",
        "options": {}
      },
      "name": "Send to Platform",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [850, 300]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [[{ "node": "Zoho CRM - Get Contacts", "type": "main", "index": 0 }]]
    },
    "Zoho CRM - Get Contacts": {
      "main": [[{ "node": "Transform Contacts", "type": "main", "index": 0 }]]
    },
    "Transform Contacts": {
      "main": [[{ "node": "Send to Platform", "type": "main", "index": 0 }]]
    }
  }
}
```

#### How to Use

1. Import the workflow JSON into n8n
2. Configure Zoho CRM OAuth2 credentials
3. Set the webhook URL in your integration: `http://localhost:5678/webhook/zoho-crm-sync`
4. Test by triggering a sync from the Integrations page

---

## Zoho Desk Integration

### Workflow: Sync Support Tickets

**Purpose**: Sync support tickets and link them to accounts based on email domain

#### n8n Workflow JSON

```json
{
  "name": "Zoho Desk - Sync Tickets",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "zoho-desk-sync",
        "options": {}
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "url": "https://desk.zoho.com/api/v1/tickets",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendQuery": true,
        "queryParameters": {
          "parameters": [
            {
              "name": "sortBy",
              "value": "modifiedTime"
            },
            {
              "name": "limit",
              "value": "100"
            }
          ]
        },
        "options": {}
      },
      "name": "Zoho Desk - Get Tickets",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [450, 300]
    },
    {
      "parameters": {
        "jsCode": "// Transform Zoho Desk tickets to our format\nconst tickets = [];\nconst data = items[0].json.data || [];\n\nfor (const ticket of data) {\n  const transformed = {\n    external_id: ticket.id,\n    title: ticket.subject,\n    description: ticket.description,\n    status: ticket.status,\n    priority: ticket.priority,\n    ticket_type: ticket.category,\n    reporter_email: ticket.email,\n    assignee_email: ticket.assignee?.email,\n    created_date: ticket.createdTime,\n    updated_date: ticket.modifiedTime,\n    resolved_date: ticket.closedTime,\n    // Extract account from email domain\n    account_id: null, // Will be matched by email domain in backend\n    channel: ticket.channel,\n    cf: ticket.cf // Custom fields\n  };\n  \n  tickets.push({ json: transformed });\n}\n\nreturn tickets;"
      },
      "name": "Transform Tickets",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [650, 300]
    },
    {
      "parameters": {
        "url": "http://localhost:3000/api/webhooks/n8n",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"integration_id\": \"{{ $node.Webhook.json.body.integration_id }}\",\n  \"sync_log_id\": \"{{ $node.Webhook.json.body.sync_log_id }}\",\n  \"data_type\": \"tickets\",\n  \"source_type\": \"zoho_desk\",\n  \"api_key\": \"{{ $env.N8N_WEBHOOK_API_KEY }}\",\n  \"records\": {{ $json }}\n}",
        "options": {}
      },
      "name": "Send to Platform",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [850, 300]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [[{ "node": "Zoho Desk - Get Tickets", "type": "main", "index": 0 }]]
    },
    "Zoho Desk - Get Tickets": {
      "main": [[{ "node": "Transform Tickets", "type": "main", "index": 0 }]]
    },
    "Transform Tickets": {
      "main": [[{ "node": "Send to Platform", "type": "main", "index": 0 }]]
    }
  }
}
```

---

## Jira Integration

### Workflow: Sync Jira Issues as Tickets

**Purpose**: Import Jira issues to track customer-reported bugs and feature requests

#### n8n Workflow JSON

```json
{
  "name": "Jira - Sync Issues",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "jira-sync",
        "options": {}
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "authentication": "basic",
        "resource": "issue",
        "operation": "getAll",
        "returnAll": true,
        "jql": "project = CS AND created >= -30d",
        "additionalFields": {}
      },
      "name": "Jira - Get Issues",
      "type": "n8n-nodes-base.jira",
      "typeVersion": 1,
      "position": [450, 300]
    },
    {
      "parameters": {
        "jsCode": "// Transform Jira issues to tickets\nconst tickets = [];\n\nfor (const item of items) {\n  const issue = item.json;\n  \n  const ticket = {\n    external_id: issue.key,\n    title: issue.fields.summary,\n    description: issue.fields.description,\n    status: issue.fields.status.name,\n    priority: issue.fields.priority?.name || 'Medium',\n    ticket_type: issue.fields.issuetype.name,\n    reporter_email: issue.fields.reporter?.emailAddress,\n    assignee_email: issue.fields.assignee?.emailAddress,\n    created_date: issue.fields.created,\n    updated_date: issue.fields.updated,\n    resolved_date: issue.fields.resolutiondate,\n    // Custom fields\n    project: issue.fields.project.name,\n    labels: issue.fields.labels,\n    components: issue.fields.components?.map(c => c.name)\n  };\n  \n  tickets.push({ json: ticket });\n}\n\nreturn tickets;"
      },
      "name": "Transform Issues",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [650, 300]
    },
    {
      "parameters": {
        "url": "http://localhost:3000/api/webhooks/n8n",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"integration_id\": \"{{ $node.Webhook.json.body.integration_id }}\",\n  \"sync_log_id\": \"{{ $node.Webhook.json.body.sync_log_id }}\",\n  \"data_type\": \"tickets\",\n  \"source_type\": \"jira\",\n  \"api_key\": \"{{ $env.N8N_WEBHOOK_API_KEY }}\",\n  \"records\": {{ $json }}\n}",
        "options": {}
      },
      "name": "Send to Platform",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [850, 300]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [[{ "node": "Jira - Get Issues", "type": "main", "index": 0 }]]
    },
    "Jira - Get Issues": {
      "main": [[{ "node": "Transform Issues", "type": "main", "index": 0 }]]
    },
    "Transform Issues": {
      "main": [[{ "node": "Send to Platform", "type": "main", "index": 0 }]]
    }
  }
}
```

---

## Salesforce Integration

### Workflow: Sync Opportunities as Deals

**Purpose**: Import Salesforce opportunities to track renewal and expansion deals

#### JavaScript Code Node (Transform)

```javascript
// Transform Salesforce opportunities to deals
const deals = [];

for (const item of items) {
  const opp = item.json;
  
  const deal = {
    external_id: opp.Id,
    account_id: opp.AccountId, // Will need to map to our account ID
    name: opp.Name,
    amount: parseFloat(opp.Amount || 0),
    stage: opp.StageName,
    probability: parseInt(opp.Probability || 0),
    close_date: opp.CloseDate,
    created_date: opp.CreatedDate,
    owner_email: opp.Owner?.Email,
    // Additional properties
    type: opp.Type,
    lead_source: opp.LeadSource,
    next_step: opp.NextStep,
    forecast_category: opp.ForecastCategory
  };
  
  deals.push({ json: deal });
}

return deals;
```

---

## HubSpot Integration

### Workflow: Sync Deals and Contacts

#### JavaScript Code Node (Transform Deals)

```javascript
// Transform HubSpot deals
const deals = [];

for (const item of items) {
  const deal = item.json.properties;
  
  const transformed = {
    external_id: item.json.id,
    name: deal.dealname,
    amount: parseFloat(deal.amount || 0),
    stage: deal.dealstage,
    probability: parseFloat(deal.hs_deal_stage_probability || 0) * 100,
    close_date: deal.closedate,
    created_date: deal.createdate,
    owner_email: null, // Fetch from associations
    // HubSpot specific
    pipeline: deal.pipeline,
    deal_type: deal.dealtype
  };
  
  deals.push({ json: transformed });
}

return deals;
```

---

## Field Mapping Guide

### Automatic Account Matching

The platform automatically matches external records to accounts using:

1. **Email Domain Matching**: For contacts and tickets
   - Extracts domain from email address
   - Matches to account.domain field

2. **External Account ID**: For CRM data
   - Uses account_id if provided in the sync
   - Requires prior account sync with external_id mapping

### Creating Custom Field Mappings

Use the Field Mappings API to define transformations:

```javascript
// Example: Map Zoho CRM status to our journey stages
await createFieldMapping({
  integration_source_id: 'your-integration-id',
  source_field: 'Account_Status',
  target_table: 'accounts',
  target_field: 'stage',
  transformation_rule: {
    type: 'enum_map',
    map: {
      'Active': 'onboarding',
      'Mature': 'active',
      'At Risk': 'at_risk',
      'Churned': 'churned'
    }
  },
  is_required: false
});
```

---

## Scheduled Syncs

### Set up automatic syncs using n8n Cron node

```json
{
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "hours",
          "hoursInterval": 6
        }
      ]
    }
  },
  "name": "Schedule - Every 6 Hours",
  "type": "n8n-nodes-base.cron",
  "typeVersion": 1,
  "position": [250, 300]
}
```

Connect to your webhook trigger node to run syncs automatically.

---

## Error Handling

Add an "Error Trigger" node to handle sync failures:

```json
{
  "parameters": {},
  "name": "Error Trigger",
  "type": "n8n-nodes-base.errorTrigger",
  "typeVersion": 1,
  "position": [250, 500]
}
```

Connect to a notification node (Slack, Email) to alert on failures.

---

## Testing Workflows

### 1. Test Individual Integration

```bash
# Trigger sync manually
curl -X POST http://localhost:5678/webhook/zoho-crm-sync \
  -H "Content-Type: application/json" \
  -d '{
    "integration_id": "your-integration-id",
    "sync_log_id": "optional-log-id"
  }'
```

### 2. Verify Data in Platform

1. Go to Integrations page
2. Click "Logs" on the integration
3. Check sync status and record counts
4. View synced data on Accounts page

---

## Production Checklist

- [ ] Set secure `N8N_WEBHOOK_API_KEY`
- [ ] Configure all external API credentials
- [ ] Test each workflow with sample data
- [ ] Set up scheduled syncs (recommended: every 6 hours)
- [ ] Configure error notifications
- [ ] Set up field mappings for custom fields
- [ ] Monitor sync logs for failures
- [ ] Set up backup/export of n8n workflows

---

## Need Help?

- **n8n Documentation**: https://docs.n8n.io
- **Zoho CRM API**: https://www.zoho.com/crm/developer/docs/api/v2/
- **Zoho Desk API**: https://desk.zoho.com/DeskAPIDocument
- **Jira API**: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
- **Salesforce API**: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/
- **HubSpot API**: https://developers.hubspot.com/docs/api/overview
