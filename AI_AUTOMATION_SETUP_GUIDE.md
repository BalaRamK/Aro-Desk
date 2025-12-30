# AI Automation Builder & Integration Security Setup Guide

## Quick Start

### 1. Configure OpenAI API Key

**For Local Development:**
1. Get your API key from https://platform.openai.com/api-keys
2. Add to your `.env.local` file:
   ```
   OPENAI_API_KEY=sk-your-key-here
   ```

**For Vercel Deployment:**
1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name:** `OPENAI_API_KEY`
   - **Value:** Your OpenAI API key
4. Redeploy the project

### 2. Access the AI Automation Builder

1. Navigate to **Dashboard** → **Automation** → **AI Builder** tab
2. You'll see:
   - Chat interface on the left
   - Generated playbook preview on the right
   - Example templates to get started

### 3. Create Your First Automation

**Simple Example:**
```
Send an email to the CSM when a customer's health score drops below 40
```

**The AI will generate:**
- Playbook name and description
- Trigger configuration (health_score_change)
- Email action with CSM notification
- Save as a working playbook

**More Complex Example:**
```
Monitor high-value accounts over $500k. If their usage drops below 30% in a month, create an urgent task for the CSM and send a Slack notification to the success manager
```

---

## Integration Access Control

### Who Can Access Integration Features?

**Super Admin:** ✅ Full access
- View all integrations
- Create new integrations
- Edit integration configurations
- Delete integrations
- View sync logs and error details
- Monitor integration health

**Regular Users:** ❌ No access
- Cannot see integration sources
- Cannot view sync logs
- Cannot create/edit integrations
- Receive clear "Unauthorized" errors

### How to Check if You're a Super Admin

In the admin dashboard (`/admin`), your user account will have a **"Super Admin"** badge if you have admin privileges.

### If You Need Admin Access

Contact your platform administrator to be granted super admin privileges.

---

## Playbook Configuration Reference

### Trigger Types

#### 1. Health Score Change
```json
{
  "type": "health_score_change",
  "conditions": {
    "threshold": 40,
    "direction": "below"  // "above" or "below"
  }
}
```

#### 2. Account Milestone
```json
{
  "type": "account_milestone",
  "conditions": {
    "milestone": "contract_renewal",
    "days_before": 90
  }
}
```

#### 3. Customer Action
```json
{
  "type": "customer_action",
  "conditions": {
    "action": "email_opened",  // email_opened, page_visit, feature_used
    "frequency": "any"
  }
}
```

#### 4. Scheduled
```json
{
  "type": "scheduled",
  "conditions": {
    "schedule": "daily",  // daily, weekly, monthly
    "time": "09:00"
  }
}
```

#### 5. Webhook
```json
{
  "type": "webhook",
  "conditions": {
    "source": "external_system"
  }
}
```

### Action Types

#### Email Action
```json
{
  "type": "email",
  "config": {
    "template": "health_alert",
    "to": "csm_email",
    "subject": "Action Required: Health Score Alert",
    "include_metrics": true
  }
}
```

#### Slack Action
```json
{
  "type": "slack",
  "config": {
    "channel": "#customer-success",
    "message_template": "health_alert",
    "include_customer_details": true
  }
}
```

#### Create Task
```json
{
  "type": "create_task",
  "config": {
    "title": "Renewal Preparation",
    "assigned_to": "csm",
    "priority": "high",
    "due_date_offset_days": 30
  }
}
```

#### Update Account
```json
{
  "type": "update_account",
  "config": {
    "fields": {
      "status": "at_risk",
      "requires_review": true
    }
  }
}
```

#### Send Webhook
```json
{
  "type": "send_webhook",
  "config": {
    "url": "https://external-system.com/webhook",
    "method": "POST",
    "payload": {
      "account_id": "{{account.id}}",
      "event_type": "health_dropped"
    }
  }
}
```

### Conditions

```json
{
  "type": "account_property",
  "operator": "greater_than",  // equals, greater_than, less_than, contains
  "field": "annual_revenue",
  "value": 100000
}
```

---

## Conversation Tips for AI

**Be Specific:**
- ❌ "Create an automation"
- ✅ "Send an email to the CSM when health score drops below 40"

**Describe Actions in Order:**
- ❌ "Monitor accounts and do stuff"
- ✅ "Check if usage is low, create a task, then notify Slack"

**Include Filters/Segments:**
- ❌ "Send notifications"
- ✅ "For high-value accounts over $500k, send notifications"

**Specify Preferences:**
- ❌ "Let them know about the issue"
- ✅ "Send a Slack notification to the success manager"

**Ask for Refinement:**
- "Can you add a condition to only run for enterprise customers?"
- "Modify the email template to include ARR information"
- "What actions would you recommend for churn risk?"

---

## Troubleshooting

### "Unauthorized: Super admin access required"
- You don't have admin privileges
- Contact your platform administrator
- Check if your user role is set to "Super Admin"

### "Failed to generate automation configuration"
- Ensure `OPENAI_API_KEY` is set correctly
- Check that your API key is active (visit https://platform.openai.com/api-keys)
- Verify you have API credits available
- Check the browser console for detailed error messages

### AI Generated Invalid JSON
- The AI tried its best but the structure wasn't valid
- Try describing the automation differently
- Use the exact format from the examples
- Break complex automations into smaller, simpler ones

### Playbook Doesn't Execute
- Verify the trigger conditions are correct
- Check that the actions reference valid fields
- Review execution logs in the "Execution Logs" tab
- Test with a simple automation first

### "Unable to resolve tenant"
- Ensure you're logged into an account
- Check your user profile has a valid tenant
- Try logging out and back in

---

## API Reference

### Generate Playbook
```bash
curl -X POST /api/ai/automation-builder \
  -H "Content-Type: application/json" \
  -d {
    "description": "Send email when health drops",
    "conversationHistory": []
  }
```

**Response:**
```json
{
  "success": true,
  "message": "...",
  "playbookConfig": { ... },
  "conversationHistory": [ ... ]
}
```

### Get Templates
```bash
curl -X GET /api/ai/automation-builder
```

---

## Best Practices

1. **Start Simple**
   - Create basic automations first
   - Add complexity gradually
   - Test before deploying

2. **Use Descriptive Names**
   - ✅ "Health Score Drop - CSM Alert"
   - ❌ "Playbook 1"

3. **Test Automations**
   - Review generated playbook before saving
   - Test trigger conditions manually
   - Monitor execution logs

4. **Review Regularly**
   - Check playbook execution frequency
   - Monitor error rates
   - Refine triggers and actions

5. **Document Intent**
   - Include description of why automation exists
   - Note any special business logic
   - Keep stakeholders informed

---

## Examples

### Example 1: Health Score Alert
```
Send email to CSM when health score drops below 40
```
**Use Case:** Early warning system for at-risk accounts

### Example 2: Renewal Reminder
```
Create a task 90 days before contract renewal for renewal preparation
```
**Use Case:** Proactive renewal management

### Example 3: Upsell Opportunity
```
Flag accounts for upsell when they reach 80% usage of their plan
```
**Use Case:** Identify expansion opportunities

### Example 4: Churn Intervention
```
For customers who haven't used the platform in 30 days, send an email to the CSM and create a priority task
```
**Use Case:** Prevent churn with immediate intervention

### Example 5: Win Celebration
```
Send Slack notification to the team when a deal over $100k is closed
```
**Use Case:** Team celebration and visibility

---

## Support & Feedback

- **Bug Reports:** Open an issue in your project repository
- **Feature Requests:** Discuss with your product team
- **AI Improvements:** Provide feedback on generated playbooks
- **Integration Questions:** Check N8N documentation at https://docs.n8n.io

---

**Last Updated:** December 30, 2025
