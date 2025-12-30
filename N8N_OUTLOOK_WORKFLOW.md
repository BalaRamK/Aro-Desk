# n8n Outlook Integration Workflow

## Overview

This workflow integrates with Microsoft Outlook to automatically capture meeting data and sync it with your Customer Success Platform. When a meeting with "Sync" or "QBR" keywords is created in Outlook, the workflow:

1. Extracts meeting details from Outlook calendar
2. Maps attendee emails to account records in PostgreSQL
3. Updates account profiles with meeting metadata
4. Sends Slack notifications on success/error

## Prerequisites

- n8n instance running (locally or cloud)
- Microsoft Outlook account with API access
- PostgreSQL database connection configured
- Slack workspace (for notifications)
- Service account with proper API credentials

## Setup Steps

### Step 1: Create Azure AD App Registration (Required First)

Before configuring n8n, you need to create an Azure AD app to get OAuth credentials:

1. **Go to Azure Portal**: https://portal.azure.com
2. **Navigate to**: Azure Active Directory → App registrations
3. **Click**: "New registration"
4. **Fill in registration form**:
   - **Name**: `n8n Outlook Integration` (or any descriptive name)
   - **Supported account types**: "Accounts in any organizational directory and personal Microsoft accounts"
   - **Redirect URI**: 
     - Platform: **Web**
     - URL: `http://localhost:5678/rest/oauth2-credential/callback`
   - Click **Register**

5. **Get Client ID**:
   - After registration, you'll see the **Overview** page
   - Copy the **Application (client) ID** → Save this as your **Client ID**

6. **Create Client Secret**:
   - Go to **Certificates & secrets** (left sidebar)
   - Click **"New client secret"**
   - Description: `n8n integration`
   - Expiration: Choose 24 months (or custom)
   - Click **Add**
   - **IMPORTANT**: Immediately copy the **Value** → This is your **Client Secret** (won't be shown again!)

7. **Set API Permissions**:
   - Go to **API permissions** (left sidebar)
   - Click **"Add a permission"**
   - Select **Microsoft Graph**
   - Choose **Delegated permissions**
   - Add these permissions:
     - `Calendars.Read`
     - `Calendars.ReadWrite`
     - `Mail.Read`
     - `Mail.ReadWrite`
     - `User.Read`
   - Click **Add permissions**
   - Click **"Grant admin consent"** (if you have admin rights)

**Save these for Step 2**:
- ✅ Client ID (Application ID)
- ✅ Client Secret (Secret Value)

---

### Step 2: Configure Outlook OAuth2 in n8n

1. Go to **Settings → Credentials** in n8n
2. Click **"Add credential"**
3. Search and select **"Microsoft Outlook OAuth2 API"**
4. Fill in the credential form:
   - **Access Token URL**: `https://login.microsoftonline.com/common/oauth2/v2.0/token` (pre-filled)
   - **Client ID**: Paste the Application (client) ID from Step 1
   - **Client Secret**: Paste the secret value from Step 1
   - **Allowed HTTP Request Domains**: Leave as "All"
   - **Use Shared Mailbox**: Keep OFF (unless needed)
5. Click **"Save"**
6. Click **"Connect my account"** to authorize
7. Sign in with your Microsoft account
8. Accept permissions
9. Save credentials with name: `Outlook_Production`

### Step 3: Configure PostgreSQL Connection

1. Create new credential: **PostgreSQL**
2. Fill in connection details:
   - **Host**: your_postgres_host
   - **Database**: customer_success
   - **User**: postgres
   - **Password**: (from Step 1 setup)
   - **Port**: 5432
3. Save with name: `PostgreSQL_CS`

### Step 4: Configure Slack Webhook (Optional)

1. Go to Slack workspace settings
2. Create Incoming Webhook for #cs-automation channel
3. Copy webhook URL
4. Will be used in error handling node

### Step 5: Import Workflow JSON

Copy the workflow JSON below and import into n8n:
1. Click **+** → **Import from URL/Clipboard**
2. Paste JSON
3. Configure the three credentials created above
4. Deploy workflow

---

## Running n8n Continuously (Windows)

n8n needs to run continuously to execute scheduled workflows. Here are the recommended methods:

### Option 1: Windows Service (Recommended for Production)

Install NSSM (Non-Sucking Service Manager) to run n8n as a Windows service:

```powershell
# Install NSSM via Chocolatey
choco install nssm

# Create the service
nssm install n8n "C:\Program Files\nodejs\n8n.cmd"

# Set environment variables
nssm set n8n AppEnvironmentExtra N8N_PORT=5678
nssm set n8n AppEnvironmentExtra N8N_BASIC_AUTH_ACTIVE=true
nssm set n8n AppEnvironmentExtra N8N_BASIC_AUTH_USER=admin
nssm set n8n AppEnvironmentExtra N8N_BASIC_AUTH_PASSWORD=changeme

# Start the service
nssm start n8n

# Service will auto-start on Windows boot
```

**Manage the service**:
```powershell
nssm stop n8n       # Stop service
nssm restart n8n    # Restart service
nssm remove n8n     # Remove service
```

### Option 2: Windows Task Scheduler (Alternative)

1. Open **Task Scheduler**
2. Click **"Create Basic Task"**
3. Name: `n8n Automation Server`
4. Trigger: **When the computer starts**
5. Action: **Start a program**
   - Program: `powershell.exe`
   - Arguments: `-Command "cd 'C:\Users\Bala Karumanchi\OneDrive - QuNulabs Private Limited\Desktop\Aro-Desk'; $env:N8N_PORT=5678; n8n"`
6. Check **"Run with highest privileges"**
7. Finish

### Option 3: PowerShell Profile (Development)

Add to PowerShell profile to start automatically:

```powershell
# Edit profile
notepad $PROFILE

# Add this line:
Start-Process powershell -WindowStyle Hidden -ArgumentList "-Command", "cd 'C:\Path\To\Project'; `$env:N8N_PORT=5678; n8n"
```

### Option 4: Docker (Cross-platform)

If you have Docker Desktop installed:

```powershell
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  --restart unless-stopped \
  n8nio/n8n
```

**Check n8n is running**:
```powershell
# Visit in browser
http://localhost:5678

# Or check with curl
curl http://localhost:5678
```

---

## Workflow JSON

```json
{
  "name": "Outlook Meeting Sync to CS Platform",
  "nodes": [
    {
      "parameters": {
        "triggerOn": "start",
        "pollTimes": {
          "item": [
            {
              "mode": "every",
              "value": 15,
              "unit": "minutes"
            }
          ]
        }
      },
      "id": "Schedule_Trigger",
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "credentialsType": "microsoftOutlookOAuth2Api",
        "resource": "calendarEvent",
        "operation": "getAll",
        "returnAll": false,
        "limit": 20,
        "filters": {
          "orderBy": "lastModifiedDateTime",
          "queryFilter": "createdDateTime ge {DATE_MINUS_15_MINUTES}"
        }
      },
      "id": "Get_Recent_Meetings",
      "name": "Get Recent Meetings",
      "type": "n8n-nodes-base.microsoftOutlook",
      "typeVersion": 1,
      "position": [500, 300],
      "credentials": {
        "microsoftOutlookOAuth2Api": "Outlook_Production"
      }
    },
    {
      "parameters": {
        "jsCode": "// Filter meetings with 'Sync' or 'QBR' in subject\nconst filteredMeetings = items.filter(item => {\n  const subject = (item.json.subject || '').toLowerCase();\n  return subject.includes('sync') || subject.includes('qbr');\n});\n\nreturn filteredMeetings.length > 0 ? filteredMeetings : [];"
      },
      "id": "Filter_QBR_Sync_Meetings",
      "name": "Filter QBR/Sync Meetings",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [750, 300]
    },
    {
      "parameters": {
        "mode": "runOnceForAllItems"
      },
      "id": "Loop_Through_Meetings",
      "name": "Loop Through Meetings",
      "type": "n8n-nodes-base.itemLists",
      "typeVersion": 3,
      "position": [1000, 300]
    },
    {
      "parameters": {
        "jsCode": "// Extract and normalize attendee data\nconst meeting = items[0].json;\nconst attendees = (meeting.attendees || [])\n  .filter(a => a.status.response !== 'declined')\n  .map(a => ({\n    email: a.emailAddress.address,\n    name: a.emailAddress.name,\n    status: a.status.response // accepted, tentativelyAccepted, declined, notResponded\n  }));\n\nreturn [\n  {\n    json: {\n      meeting_id: meeting.id,\n      subject: meeting.subject,\n      start_time: meeting.start,\n      end_time: meeting.end,\n      body: meeting.bodyPreview,\n      organizer: meeting.organizer.emailAddress.address,\n      attendees: attendees,\n      attendee_count: attendees.length\n    }\n  }\n];"
      },
      "id": "Extract_Meeting_Data",
      "name": "Extract Meeting Data",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1250, 300]
    },
    {
      "parameters": {
        "mode": "batches",
        "batchSize": 1
      },
      "id": "Batch_Attendees",
      "name": "Batch Attendees",
      "type": "n8n-nodes-base.itemLists",
      "typeVersion": 3,
      "position": [1500, 300]
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "-- Cross-reference attendee emails with accounts\nSELECT \n  c.account_id,\n  c.email,\n  a.name as account_name\nFROM contacts c\nJOIN accounts a ON c.account_id = a.id\nWHERE c.email = $1\nLIMIT 1",
        "queryParams": "={{ $node['Extract_Meeting_Data'].json.attendees }}"
      },
      "id": "Lookup_Account_IDs",
      "name": "Lookup Account IDs",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.4,
      "position": [1750, 300],
      "credentials": {
        "postgres": "PostgreSQL_CS"
      }
    },
    {
      "parameters": {
        "jsCode": "// Build account update payload with meeting details\nconst meeting = $node['Extract_Meeting_Data'].json;\nconst accountLookups = items;\n\nconst updates = accountLookups\n  .filter(item => item.json.account_id) // Only items with matched accounts\n  .map(item => ({\n    account_id: item.json.account_id,\n    account_name: item.json.account_name,\n    email: item.json.email,\n    meeting_metadata: {\n      subject: meeting.subject,\n      meeting_id: meeting.meeting_id,\n      date: meeting.start_time,\n      duration_minutes: Math.round(\n        (new Date(meeting.end_time) - new Date(meeting.start_time)) / (1000 * 60)\n      ),\n      organizer: meeting.organizer,\n      attendee_count: meeting.attendee_count,\n      notes: meeting.body\n    }\n  }));\n\nreturn updates;"
      },
      "id": "Prepare_Account_Updates",
      "name": "Prepare Account Updates",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [2000, 300]
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "-- Update account with meeting metadata\nUPDATE account_profile\nSET \n  last_meeting_date = $2,\n  meeting_notes = $3,\n  updated_at = NOW()\nWHERE account_id = $1\nRETURNING account_id, last_meeting_date;",
        "queryParams": "=[\n  {{ $node['Prepare_Account_Updates'].json[0].account_id }},\n  \"{{ $node['Prepare_Account_Updates'].json[0].meeting_metadata.date }}\",\n  \"{{ JSON.stringify($node['Prepare_Account_Updates'].json[0].meeting_metadata) }}\"\n]"
      },
      "id": "Update_Account_Profile",
      "name": "Update Account Profile",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.4,
      "position": [2250, 300],
      "credentials": {
        "postgres": "PostgreSQL_CS"
      },
      "onError": "continueErrorHandling"
    },
    {
      "parameters": {
        "url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
        "requestMethod": "POST",
        "contentType": "application/json",
        "specifyBody": "json",
        "jsonBody": "={\n  \"text\": \"✅ Meeting Sync Success\",\n  \"blocks\": [\n    {\n      \"type\": \"header\",\n      \"text\": {\n        \"type\": \"plain_text\",\n        \"text\": \"📅 Outlook Meeting Synced\"\n      }\n    },\n    {\n      \"type\": \"section\",\n      \"fields\": [\n        {\n          \"type\": \"mrkdwn\",\n          \"text\": \"*Meeting:*\\n{{ $node['Extract_Meeting_Data'].json.subject }}\"\n        },\n        {\n          \"type\": \"mrkdwn\",\n          \"text\": \"*Account:*\\n{{ $node['Prepare_Account_Updates'].json[0].account_name }}\"\n        },\n        {\n          \"type\": \"mrkdwn\",\n          \"text\": \"*Date:*\\n{{ $node['Prepare_Account_Updates'].json[0].meeting_metadata.date }}\"\n        },\n        {\n          \"type\": \"mrkdwn\",\n          \"text\": \"*Attendees:*\\n{{ $node['Prepare_Account_Updates'].json[0].meeting_metadata.attendee_count }}\"\n        }\n      ]\n    }\n  ]\n}"
      },
      "id": "Slack_Success_Notification",
      "name": "Slack Success Notification",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [2500, 200]
    },
    {
      "parameters": {
        "url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
        "requestMethod": "POST",
        "contentType": "application/json",
        "specifyBody": "json",
        "jsonBody": "={\n  \"text\": \"❌ Meeting Sync Failed\",\n  \"blocks\": [\n    {\n      \"type\": \"header\",\n      \"text\": {\n        \"type\": \"plain_text\",\n        \"text\": \"⚠️ Outlook Sync Error\"\n      }\n    },\n    {\n      \"type\": \"section\",\n      \"text\": {\n        \"type\": \"mrkdwn\",\n        \"text\": \"*Error:* {{ $node['Update_Account_Profile'].error.message }}\\n\\n*Meeting:* {{ $node['Extract_Meeting_Data'].json.subject }}\\n\\n*Attendee:* {{ $node['Prepare_Account_Updates'].json[0].email }}\"\n      }\n    }\n  ]\n}"
      },
      "id": "Slack_Error_Notification",
      "name": "Slack Error Notification",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [2500, 400]
    }
  ],
  "connections": {
    "Schedule_Trigger": {
      "main": [[{ "node": "Get_Recent_Meetings", "type": "main", "index": 0 }]]
    },
    "Get_Recent_Meetings": {
      "main": [[{ "node": "Filter_QBR_Sync_Meetings", "type": "main", "index": 0 }]]
    },
    "Filter_QBR_Sync_Meetings": {
      "main": [[{ "node": "Loop_Through_Meetings", "type": "main", "index": 0 }]]
    },
    "Loop_Through_Meetings": {
      "main": [[{ "node": "Extract_Meeting_Data", "type": "main", "index": 0 }]]
    },
    "Extract_Meeting_Data": {
      "main": [[{ "node": "Batch_Attendees", "type": "main", "index": 0 }]]
    },
    "Batch_Attendees": {
      "main": [[{ "node": "Lookup_Account_IDs", "type": "main", "index": 0 }]]
    },
    "Lookup_Account_IDs": {
      "main": [[{ "node": "Prepare_Account_Updates", "type": "main", "index": 0 }]]
    },
    "Prepare_Account_Updates": {
      "main": [[{ "node": "Update_Account_Profile", "type": "main", "index": 0 }]]
    },
    "Update_Account_Profile": {
      "main": [[{ "node": "Slack_Success_Notification", "type": "main", "index": 0 }]],
      "error": [[{ "node": "Slack_Error_Notification", "type": "main", "index": 0 }]]
    }
  }
}
```

## Configuration Guide

### Customizing the Query Filter

The workflow queries meetings from the last 15 minutes. To adjust:

1. Open **Get Recent Meetings** node
2. Modify `queryFilter` in filters:
   ```
   createdDateTime ge {DATE_MINUS_[HOURS|MINUTES|DAYS]}
   ```
3. Examples:
   - Last hour: `DATE_MINUS_1_HOUR`
   - Last 30 minutes: `DATE_MINUS_30_MINUTES`
   - Last day: `DATE_MINUS_1_DAY`

### Customizing Subject Keywords

To change which meetings are captured:

1. Open **Filter QBR/Sync Meetings** code node
2. Modify the filter condition:
   ```javascript
   return subject.includes('sync') || subject.includes('qbr') || subject.includes('kickoff');
   ```

### Database Schema Requirements

The workflow expects these tables/columns:

```sql
-- contacts table (for attendee lookup)
CREATE TABLE contacts (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id),
    email TEXT NOT NULL UNIQUE,
    -- ... other columns
);

-- account_profile (for storing meeting data)
CREATE TABLE account_profile (
    account_id UUID PRIMARY KEY REFERENCES accounts(id),
    last_meeting_date TIMESTAMPTZ,
    meeting_notes JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

If you don't have these tables, create them first or modify the SQL queries in the workflow to match your schema.

### Error Handling

The workflow includes error handling that:
- Catches database update failures
- Sends Slack notification with error details
- Prevents workflow from stopping on attendee lookup failures

To customize error behavior:
1. Open **Update_Account_Profile** node
2. Change "On Error" dropdown to:
   - `Continue`: Skip failed updates and continue
   - `Stop`: Halt workflow on any error
   - `Error Workflow`: Trigger separate error handling workflow

## Testing

### Manual Test Steps

1. **Create a test meeting in Outlook:**
   - Subject: "Sync Meeting - Test 123"
   - Add attendee whose email exists in your contacts table
   - Save meeting

2. **Run workflow manually:**
   - Click "Execute Workflow" in n8n UI
   - Check execution logs

3. **Verify database update:**
   ```sql
   SELECT account_id, last_meeting_date, meeting_notes 
   FROM account_profile 
   WHERE account_id = 'your-test-account-id' 
   LIMIT 1;
   ```

4. **Check Slack notification:**
   - Should appear in #cs-automation channel within 1 minute

## Scheduling

The workflow runs every 15 minutes by default. To change:

1. Open **Schedule Trigger** node
2. Change `pollTimes`:
   - Every 5 minutes: Fast sync, higher API usage
   - Every 30 minutes: Balanced approach
   - Every hour: Low frequency, delayed sync

## API Limits & Considerations

- **Outlook API**: 25 requests/second limit
- **PostgreSQL**: Connection pool of 20 (default)
- **Slack**: 1 message/second recommended
- **Cost**: Each execution ≈ 2-3 API calls (Outlook + Postgres + Slack)

## Troubleshooting

### "Email not found in contacts table"
- Ensure attendee emails match exactly
- Check for typos in email addresses
- Add missing contacts to `contacts` table first

### "Account profile table doesn't exist"
- Create table per schema requirements above
- Or update SQL query to use existing table

### "Slack notification fails silently"
- Verify webhook URL is correct
- Check Slack workspace permissions
- Test webhook manually: `curl -X POST <webhook_url>`

### "Workflow executes but no data updated"
- Check database credentials in PostgreSQL connection
- Verify account lookup is finding matches
- Add logging via Code node to debug

---

## Next Steps

1. ✅ Deploy workflow to n8n
2. ✅ Test with manual meeting
3. ✅ Adjust Slack channels/users as needed
4. ✅ Set production schedule (typically 15-30 min intervals)
5. 📊 Monitor execution logs weekly
6. 🔄 Expand to other triggers (email received, contact created, etc.)
