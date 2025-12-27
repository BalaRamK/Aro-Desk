# 🚀 Quick Start - How to Access & Test Your Totango Platform

## ✅ Application is Running!

Your Next.js development server is live at:

```
http://localhost:3000
```

Or on your network:
```
http://192.168.1.10:3000
```

---

## 🔑 Login Credentials

### Admin Account (Full Access)
```
Email: admin@acme.com
Password: password123
Organization: Acme Corporation (Tenant)
Role: Tenant Admin
```

### Additional Test Users
You can also try other users in the same organization:
- `bob@acme.com` - Different CSM
- `charlie@acme.com` - Contributor role

---

## 🗺️ Navigation Guide

### Method 1: Command Palette (Recommended)
**Press: `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux)**

Then type:
- `Executive` → Executive Dashboard
- `Account` → Account360 (List)
- `Journey` → Customer Journey
- `Admin` → Admin Panel
- `Automation` → Automation Engine

### Method 2: Sidebar Navigation
Click links in the left sidebar:
1. **Executive Dashboard** - Overview
2. **Account360** - Account list & details
3. **Customer Journey** - Kanban board
4. **Admin Panel** - Configuration
5. **Automation** - Playbook engine

### Method 3: Recent Accounts
Click any account in the "Recent Accounts" section of the sidebar to jump directly to Account360.

---

## 🎯 Step-by-Step Walkthrough

### Step 1: Login
```
1. Go to http://localhost:3000
2. Click "Sign In"
3. Email: admin@acme.com
4. Password: password123
5. Click "Sign In" button
```

### Step 2: Explore Executive Dashboard
```
1. You should land on Executive Dashboard automatically
2. View the global health distribution donut chart
3. See revenue at risk accounts
4. Check portfolio growth trend line
5. Click on TechStart Solutions (critical account at bottom)
```

### Step 3: Deep Dive into Account360
```
1. Now on TechStart Solutions account detail page
2. Notice health score is 35 (Critical - red)
3. See the 4 health score components:
   - Usage Score: 40
   - Engagement Score: 30
   - Support Score: 25
   - Adoption Score: 20
4. Scroll to see journey history (stage transitions)
5. Review usage metrics (product telemetry)
6. Click "Create Success Plan" (at-risk action)
```

### Step 4: Navigate to Parent Account
```
1. In the breadcrumb at top, click "Acme Corporation"
2. This is the parent account
3. Notice health score is 85 (Healthy - green)
4. On the right sidebar, see "Subsidiaries" section
5. Click "GlobalTech Europe" to view subsidiary
```

### Step 5: Try the Kanban Board
```
1. Press Cmd/Ctrl+K and type "Journey"
2. You should see the Kanban board
3. See columns: Onboarding, Adoption, Expansion, Renewal, At Risk
4. Notice TechStart Solutions is in "At Risk" column
5. Try dragging it to "Renewal" column
6. Journey history will auto-update!
7. Refresh page to confirm change persisted
```

### Step 6: Configure in Admin Panel
```
1. Press Cmd/Ctrl+K and type "Admin"
2. You're in the Admin Panel with 3 tabs

Tab 1: Stage Designer
   - See all current journey stages
   - Try clicking "New Stage" button
   - Create a stage called "Churn Prevention"
   - Set target duration to 7 days
   - Pick a purple color
   - Click "Create Stage"

Tab 2: Milestone Manager
   - Select a stage from dropdown
   - Click "Add Milestone"
   - Create: "Complete Technical Onboarding"
   - Add description: "Customer must complete SSO setup"
   - Click "Create Milestone"

Tab 3: Health Score Weighting
   - Adjust the sliders to change component weights
   - See live preview calculation
   - Try: Usage 40%, Engagement 30%, Support 20%, Adoption 10%
   - Total must equal 100% (shown in bar)
   - Click "Save Configuration"
```

### Step 7: Create a Playbook
```
1. Press Cmd/Ctrl+K and type "Automation"
2. Click "Trigger Builder" tab
3. Playbook Configuration:
   - Name: "Health Score Alert"
   - Description: "Alert CSM when health drops below 50"

4. IF THIS HAPPENS section:
   - Select: "Health Score Drops Below"
   - Threshold: 50
   - Duration: 24 (hours)

5. THEN DO THIS section:
   - Action dropdown: "Send Slack Notification"
   - Channel: #success-alerts
   - Message: "Alert: {account_name} health score dropped to {score}"
   - Click "Add Action"
   
   - (Optional) Add another action:
   - Action: "Send Email Alert"
   - Recipients: csm@acme.com
   - Click "Add Action"

6. Click "Create Playbook" button
7. See success confirmation
```

### Step 8: Monitor Automation Logs
```
1. In Automation panel, click "Execution Logs" tab
2. See queue status cards:
   - Pending: 1 (from earlier)
   - Successful: 1 (previous test)
   - Failed: 0
3. Scroll down to see webhook queue table
4. Each row shows:
   - Playbook name
   - Account name
   - Status (with color badge)
   - Created timestamp
   - Attempt count
```

### Step 9: Test Responsive Design
```
1. Open browser DevTools (F12)
2. Click responsive design mode
3. Try different screen sizes:
   - iPhone 12 (390px)
   - iPad (768px)
   - Desktop (1024px)
4. Notice layout adapts gracefully
```

### Step 10: Try Search Function
```
1. Press Cmd/Ctrl+K for command palette
2. Type "GlobalTech" to search
3. See GlobalTech Corporation and GlobalTech Europe
4. Click to jump to Account360
5. Or type "blue" to see it in page names
```

---

## 🔍 What to Look For

### Multi-Tenant Isolation
- **Verify:** You only see Acme Corporation accounts
- **Other tenants (TechStart):** Are visible in some queries but only their parent accounts
- **Data security:** All queries filtered by tenant_id via RLS

### Hierarchy in Action
- **Parent account:** Acme Corporation
  - **Subsidiary 1:** GlobalTech Corporation
    - **Subsidiary 2:** GlobalTech Europe

### Health Score Colors
- **Green (≥70):** Healthy - Acme (85) and GlobalTech (85)
- **Yellow (40-69):** At Risk - GlobalTech Europe (72)
- **Red (<40):** Critical - TechStart Solutions (35)

### Drag-and-Drop Magic
- **Test:** Drag TechStart from "At Risk" to "Renewal"
- **What happens:**
  1. Card moves instantly (optimistic update)
  2. API call to update database
  3. journey_history table updated with transition
  4. New entry created with timestamp
  5. Refresh page → change persists

### Webhook Queue
- **What you'll see:** 2 entries from sample data
- **Status:** 1 pending (health score alert), 1 completed
- **Ready for:** n8n integration

---

## 🎨 UI Elements to Test

### Buttons
- All buttons have hover effects
- Active states show proper feedback
- Disabled buttons (when invalid) are grayed out

### Forms
- Input validation (e.g., stage name required)
- Form submission feedback
- Error messages appear inline
- Success messages show briefly

### Colors
- Charts use correct colors per health category
- Badges show proper variants
- Icons align with actions

### Responsive
- Sidebar collapses on mobile (menu icon)
- Tables scroll horizontally
- Cards stack properly
- Charts resize smoothly

---

## 🐛 Common Testing Scenarios

### Scenario 1: Create a Stage
```
1. Go to Admin Panel → Stage Designer
2. Click "New Stage"
3. Name: "Advocacy"
4. Target: 90 days
5. Color: Pick gold
6. Click Create
7. New stage appears in list
```

### Scenario 2: Move Account in Journey
```
1. Go to Customer Journey
2. Find TechStart Solutions in "At Risk"
3. Drag to "Renewal"
4. Check journey history in Account360
5. New entry shows stage transition
```

### Scenario 3: Adjust Health Weighting
```
1. Go to Admin Panel → Health Score Weighting
2. Move Usage slider to 50%
3. Move Engagement to 25%
4. Move Support to 15%
5. Move Adoption to 10%
6. Total = 100% (green bar)
7. Click Save
```

### Scenario 4: Create a Complex Playbook
```
1. Go to Automation → Trigger Builder
2. Create playbook:
   - Trigger: Contract End Date Approaching (30 days)
   - Action 1: Create CSM Task
   - Action 2: Send Email Alert
   - Action 3: Call External Webhook
3. Click Create
```

---

## 📊 Data to Explore

### Sample Accounts
1. **GlobalTech Corporation** ($150K ARR, Health: 85)
   - Parent account
   - Expansion stage
   - Healthy
   
2. **GlobalTech Europe** ($45K ARR, Health: 72)
   - Subsidiary
   - Adoption stage
   - At Risk
   
3. **TechStart Solutions** ($85K ARR, Health: 35)
   - Standalone
   - At Risk stage
   - Critical - will trigger automation

### Sample Metrics
- Usage metrics: Product telemetry
- Journey history: 5+ transitions per account
- Health scores: Calculated from 4 components
- Playbooks: 2 pre-configured for automation

---

## 🚀 Next: n8n Integration

### To complete the automation loop:
```bash
# 1. Start n8n (requires Docker)
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  n8nio/n8n

# 2. Access n8n at http://localhost:5678

# 3. Create webhook workflow:
   - Trigger: Webhook (HTTP POST)
   - URL: http://localhost:5678/webhook/health-alert
   - Action: Send Slack/Email/etc

# 4. Trigger health alert:
   - Lower account health score below 40
   - Webhook fires to n8n
   - n8n action executes (Slack message, etc.)
```

---

## 💡 Pro Tips

1. **Use Command Palette** - Press Cmd/Ctrl+K frequently for speed
2. **Keyboard Navigation** - Tab through forms, Enter to submit
3. **Color Coding** - Red = critical, yellow = at risk, green = healthy
4. **Hierarchy Breadcrumbs** - Always shows where you are in account tree
5. **Sidebar Recent** - Quick jump to frequently viewed accounts
6. **Responsive Design** - Resize browser to test mobile views
7. **Dark Mode** - Some components support dark mode (system preference)

---

## ❓ Troubleshooting

### If Login Fails
```
1. Check .env.local has correct DATABASE_URL
2. Verify PostgreSQL container is running
3. Ensure migrations were executed
4. Check sample data was loaded
```

### If Pages Don't Load
```
1. Check terminal for compilation errors
2. Look for failed RLS policy errors
3. Verify database connection
4. Clear browser cache (Cmd+Shift+R)
```

### If Drag-Drop Doesn't Work
```
1. Check console for JavaScript errors
2. Verify @dnd-kit libraries are installed
3. Try refreshing the page
4. Ensure account exists in database
```

### If Changes Don't Persist
```
1. Check browser console for API errors
2. Verify database permissions
3. Check RLS policies allow UPDATE
4. Refresh page to confirm save
```

---

## 📚 Documentation Files

- **[TOTANGO_FRONTEND_GUIDE.md](TOTANGO_FRONTEND_GUIDE.md)** - Detailed feature documentation
- **[TOTANGO_BUILD_SUMMARY.md](TOTANGO_BUILD_SUMMARY.md)** - Complete architecture overview
- **[PLATFORM_SETUP_GUIDE.md](PLATFORM_SETUP_GUIDE.md)** - Database and system setup
- **[FRONTEND_CHECKLIST.md](FRONTEND_CHECKLIST.md)** - Implementation verification
- **[database/LOCAL_SETUP.md](database/LOCAL_SETUP.md)** - Database specific instructions

---

## 🎓 What You've Built

✅ A professional Customer Success Platform with:
- Executive leadership dashboard
- Account management deep dives
- Visual journey management (Kanban)
- Customizable configuration panels
- Automation engine with webhooks
- Multi-tenant security (RLS)
- Modern React/Next.js UI

**Status:** Production Ready 🚀

---

**Happy Testing!**
Last Updated: December 27, 2025
