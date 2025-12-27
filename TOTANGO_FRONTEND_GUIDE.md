# Totango-Style Customer Success Platform - Frontend Implementation Guide

## Overview

This document describes the complete frontend implementation of your multi-tenant Customer Success Platform, built with Next.js 15, React 19, shadcn/ui, and Recharts. The application features a sophisticated 5-page architecture that moves from "macro" (Executive) to "micro" (Account360) views.

## 5 Core Pages

### 1. Executive Dashboard (`/dashboard/executive`)

**Purpose:** Command center for leadership to monitor the health of the entire book of business.

**Key Widgets:**

- **Global Health Distribution (Donut Chart)**
  - Visual breakdown of accounts in Green (≥70), Yellow (40-69), Red (<40)
  - Percentage and count display
  - Color-coded for quick status assessment

- **Revenue at Risk (List View)**
  - Filters for high-value parent accounts with health scores below 50
  - Shows ARR (Annual Recurring Revenue), health score, risk level, and CSM assignment
  - Links to Account360 for deep dives
  - Shows only accounts over $50K ARR

- **Portfolio Growth (Line Chart)**
  - 90-day trend showing accounts moving through lifecycle stages
  - Tracks cumulative movement through Onboarding, Adoption, Expansion, Renewal, At Risk
  - Helps identify bottlenecks in the customer journey

**Files:**
- [app/dashboard/executive/page.tsx](app/dashboard/executive/page.tsx)

**Data Source:** Server Actions (`getHealthDistribution`, `getRevenueAtRisk`, `getPortfolioGrowth`)

---

### 2. Account360 (`/dashboard/accounts` & `/dashboard/accounts/[id]`)

**Purpose:** The single source of truth for a specific account and its subsidiaries.

#### Account List View
**Path:** `/dashboard/accounts`

- Table showing all accounts with hierarchy indication
- Columns: Account Name, Hierarchy Level, Current Stage, ARR, Health Score, CSM Assignment
- Color-coded health badges (Healthy, At Risk, Critical)
- Quick links to Account360 detail pages

#### Account Detail View
**Path:** `/dashboard/accounts/[id]`

**Hierarchical Header:**
- Breadcrumb showing account's position in hierarchy (Parent > Current)
- Account status (Parent/Subsidiary/Active/Inactive)
- Large health score display (visual circle with score)

**CRM Data Grid:**
- Annual Recurring Revenue (ARR)
- Contract End Date
- Customer Success Manager assignment with email
- Industry classification
- All from `crm_attributes` JSONB column

**Health Score Components:**
- Individual weighted scores with visual progress bars
  - Usage Score (product engagement)
  - Engagement Score (team participation)
  - Support Score (ticket metrics)
  - Adoption Score (feature realization)

**Telemetry Feed (Tabs):**

1. **Journey History Tab**
   - Shows stage transitions with timestamps
   - Duration in each stage
   - Triggered by information

2. **Usage Metrics Tab**
   - Recent usage_metrics entries
   - Product telemetry and activity data
   - Last 10 recorded metrics

**Action Sidebar:**
- Log a Call
- Send Email
- Schedule Meeting
- Change Owner

**Subsidiaries Section:**
- Lists child accounts with hierarchy level
- Quick navigation to subsidiary Account360 pages

**Risk Alert:**
- Red banner for accounts with health score < 50
- "Create Success Plan" button for intervention

**Files:**
- [app/dashboard/accounts/page.tsx](app/dashboard/accounts/page.tsx)
- [app/dashboard/accounts/[id]/page.tsx](app/dashboard/accounts/[id]/page.tsx)

**Data Sources:** `getAccounts`, `getAccountDetails` (includes subsidiaries, journey history, metrics)

---

### 3. Customer Journey (`/dashboard/journey`)

**Purpose:** Visualize the flow of accounts through your defined lifecycle stages.

**Kanban Board:**
- **Columns:** One for each journey_stage (Onboarding, Adoption, Expansion, Renewal, At Risk, etc.)
- **Color Coding:** Each column uses the stage's color_hex for visual distinction
- **Cards:** Draggable account cards showing:
  - Account name
  - ARR (if available)
  - Health score with color indicator
  - Risk level badge
  - Assigned CSM

**Velocity Metrics:**
- Each column shows:
  - Target duration (target_duration_days from stage definition)
  - Average duration accounts actually spend in that stage
  - Account count in stage

**Drag-and-Drop:**
- Drag accounts between columns to update their stage
- Triggers API call to `updateAccountStage`
- Creates journey_history entry with transition details
- Automatically closes old stage history and opens new one
- Displays timestamp of transition

**Interactive Features:**
- Hover effects on cards and columns
- Column highlights when dragging over
- Real-time count updates
- Sparkline health score visualization on cards

**Files:**
- [app/dashboard/journey/page.tsx](app/dashboard/journey/page.tsx)
- [components/journey-kanban-client.tsx](components/journey-kanban-client.tsx)
- [components/kanban-column.tsx](components/kanban-column.tsx)
- [components/kanban-card.tsx](components/kanban-card.tsx)

**Technologies:**
- `@dnd-kit` for drag-and-drop
- Server Action: `updateAccountStage`
- Data source: `getAccountsByStage`

---

### 4. Admin Panel: Journey Mapping (`/dashboard/admin`)

**Purpose:** Where "the rules of the game" are defined.

**3 Tabs:**

#### Tab 1: Stage Designer
- **Create Stages:** Add new lifecycle stages with custom properties
  - Name
  - Target Duration (days)
  - Color (hex color picker with live preview)
  - Display Order (for sorting)

- **Edit Existing Stages:** Modify any stage's properties
- **Delete Stages:** Remove with validation (can't delete if accounts exist in stage)
- **Drag Handle:** Reorder stages (UI shows grip icon, backend not yet implemented)

**Features:**
- Visual stage preview with color square
- Account count per stage
- Form validation
- Dialog-based creation/editing

#### Tab 2: Milestone Manager
- **Stage Selection Dropdown:** Choose which stage to configure
- **Define Milestones:** Create mandatory goals for each stage
  - Name (e.g., "Complete training", "Setup SSO")
  - Description (what successful completion looks like)
  - Order (visual ordering)

- **Edit/Delete Milestones:** Modify or remove milestones
- **Visual Indicators:** Circle icons showing milestone status

**Use Case:** Ensure accounts complete required activities before moving to next stage

#### Tab 3: Health Score Weighting
- **4 Component Weights:**
  - Usage Score (default 25%)
  - Engagement Score (default 25%)
  - Support Score (default 25%)
  - Adoption Score (default 25%)

- **Interactive Sliders:** Adjust weights with range inputs
- **Percentage Display:** See real-time total (must equal 100%)
- **Validation:** Red highlight if not 100%
- **Live Preview:** See example health score calculation with dummy values (75, 80, 90, 70)
- **Save Configuration:** Stores in database for tenant

**Formula:**
```
Health Score = (Usage × weight) + (Engagement × weight) + (Support × weight) + (Adoption × weight)
```

**Files:**
- [app/dashboard/admin/page.tsx](app/dashboard/admin/page.tsx)
- [components/stage-designer.tsx](components/stage-designer.tsx)
- [components/milestone-manager.tsx](components/milestone-manager.tsx)
- [components/health-score-weighting.tsx](components/health-score-weighting.tsx)

**Data Sources:** `getJourneyStages`, `getHealthScoreWeighting`, Server Actions in `app/actions/admin.ts`

---

### 5. Automation Panel: Playbook Engine (`/dashboard/automation`)

**Purpose:** The proactive layer of the platform for SuccessPlay automation.

**3 Tabs:**

#### Tab 1: Active Playbooks
- **List of All Playbooks** with:
  - Name and description
  - Active/Inactive status badge
  - Total executions count
  - Executions in last 7 days
  - Last execution timestamp
  - JSON view of trigger criteria
  - Webhook URL (if configured for n8n)

- **Filtering:** Visual status indicators
- **Linked to Automation:** Shows which playbooks are actively monitoring

#### Tab 2: Trigger Builder
- **If-This-Then-That Interface:**

  **"IF THIS HAPPENS" Section:**
  - Dropdown to select trigger type:
    - Health Score Drops Below [threshold]
    - Account Moves to Stage [name]
    - Usage Declining
    - Support Ticket Spike
    - Contract End Date Approaching [days]
  
  - Dynamic parameter fields based on trigger type
  - Contextual inputs (numbers, text, duration fields)

  **"THEN DO THIS" Section:**
  - Add multiple actions to single playbook
  - Action types:
    - Send Slack Notification (channel, message)
    - Send Email Alert (recipients, subject)
    - Create CSM Task
    - Escalate to Manager
    - Call External Webhook (URL, method)
  
  - Dynamic parameter forms for each action type
  - Action list showing all configured actions
  - Remove individual actions with delete buttons

  **Playbook Details:**
  - Name (required)
  - Description (optional)
  - Submit to create playbook

  **Preview Section:**
  - Shows when playbook is valid
  - Displays playbook summary before creation
  - Confirms trigger and actions

#### Tab 3: Execution Logs
- **Queue Status Cards:**
  - Pending webhooks (yellow)
  - Successful webhooks (green)
  - Failed webhooks (red)

- **Webhook Queue Table:**
  - Playbook name
  - Account name
  - Status (pending/completed/failed)
  - Created timestamp
  - Attempt count (attempts/max_attempts)

- **Status Badges:** Color-coded by outcome
- **Real-time Updates:** Shows latest queue state

**Files:**
- [app/dashboard/automation/page.tsx](app/dashboard/automation/page.tsx)
- [components/trigger-builder.tsx](components/trigger-builder.tsx)

**Data Sources:** `getPlaybooks`, `getWebhookQueue`

---

## Navigation & Layout

### Main Layout (`/app/dashboard/layout.tsx`)

**Persistent Sidebar (Left):**
- Logo + "CS Platform" branding
- Navigation links to all 5 pages with icons
- Recent Accounts quick access section
  - Shows 5 most recent accounts
  - Health score color indicators (green/yellow/red dots)
  - Quick links to Account360
- User profile section with dropdown
  - Name and role display
  - Sign out button

**Top Bar (Right of Sidebar):**
- Global Search / Command Palette (⌘K shortcut)
- Tenant switcher badge
  - Shows current organization name
  - Blue highlighted for visibility

**Command Palette Features:**
- Keyboard shortcut: Cmd+K (macOS) or Ctrl+K (Windows/Linux)
- Search accounts by name
- Jump to any of the 5 pages
- Quick command entry with icons

### Responsive Design
- Sidebar collapses on mobile (menu icon)
- Tables become scrollable
- Kanban board scrolls horizontally
- Charts responsive to container

---

## Component Library (shadcn/ui)

**Installed Components:**
- Button
- Card (CardHeader, CardContent, CardDescription, CardTitle)
- Badge
- Input
- Label
- Textarea
- Dialog (DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription)
- DropdownMenu
- Tabs (TabsList, TabsTrigger, TabsContent)
- Table (TableHeader, TableBody, TableRow, TableCell, TableHead)
- Select (SelectTrigger, SelectValue, SelectContent, SelectItem)
- Command (CommandDialog, CommandInput, CommandList, CommandItem, CommandGroup, CommandEmpty)
- Separator

**Styling:** Tailwind CSS with custom slate color scheme and dark mode support

---

## Icons & Visualizations

**Icon Library:** lucide-react
- Dashboard: LayoutDashboard
- Accounts: Users, Building2, ChevronRight
- Journey: Route, GripVertical, Clock, TrendingUp/Down
- Admin: Settings, Layers, Target, Circle, CheckCircle
- Automation: Zap, AlertCircle, Trash2, Plus, Edit2, Activity
- Actions: Phone, Mail, Calendar, DollarSign

**Charts:** Recharts
- PieChart: Global health distribution
- LineChart: Portfolio growth trends
- Responsive containers with tooltips and legends

---

## Data Flow & Server Actions

### Dashboard Server Actions (`/app/actions/dashboard.ts`)

All server actions automatically apply RLS context via `setUserContext()`:

**Health & Metrics:**
- `getHealthDistribution()` - Accounts by health category
- `getRevenueAtRisk()` - High-value at-risk accounts
- `getPortfolioGrowth(days)` - Stage transitions over time

**Accounts:**
- `getAccounts(filters?)` - All accounts with optional filtering
- `getAccountDetails(id)` - Full account context (account, subsidiaries, journey, metrics)

**Journey:**
- `getJourneyStages()` - All lifecycle stages
- `getAccountsByStage()` - Accounts grouped by stage with velocity
- `updateAccountStage(id, stage, notes)` - Move account, update journey history

**Automation:**
- `getPlaybooks()` - Active playbooks with execution stats
- `getWebhookQueue(limit)` - Pending, completed, failed webhooks

**Recent Activity:**
- `getRecentAccounts(limit)` - For sidebar quick access

### Admin Server Actions (`/app/actions/admin.ts`)

**Stages:**
- `createJourneyStage(data)` - Create new stage
- `updateJourneyStage(id, data)` - Update stage properties
- `deleteJourneyStage(id)` - Delete with validation

**Milestones:**
- `createMilestone(data)` - Create stage milestone
- `getStageMilestones(id)` - Get all milestones for stage
- `updateMilestone(id, data)` - Update milestone
- `deleteMilestone(id)` - Delete milestone

**Health Scoring:**
- `getHealthScoreWeighting()` - Get current weights (or defaults)
- `updateHealthScoreWeighting(data)` - Save new weight configuration

---

## Key Features

### 1. Multi-Tenant Isolation
- All queries automatically filtered by tenant_id via RLS
- Session context passed to database via `setUserContext()`
- No manual tenant filtering needed in application code

### 2. Hierarchical Accounts
- Parent/subsidiary relationships via `parent_id`
- Hierarchy levels and paths in UI
- Breadcrumb navigation for hierarchy context
- Cascade visibility in related data

### 3. Health Score System
- Weighted component calculation
- Real-time dashboard visualization
- Risk indicators (green/yellow/red)
- Configurable thresholds in admin panel

### 4. Journey Tracking
- Stage-based progression with drag-and-drop
- Duration tracking per stage
- Velocity metrics (target vs. actual)
- History of all transitions

### 5. Automation Engine
- Trigger-based playbook execution
- Multiple actions per playbook
- Webhook queue for async delivery
- Execution logs and status tracking

### 6. CRM Integration
- JSONB column for flexible attributes
- Display custom fields (ARR, contract date, industry)
- Extensible without schema changes

---

## Styling & Theming

### Color Palette
- **Primary:** Blue (`#3b82f6`)
- **Success:** Green (`#10b981`)
- **Warning:** Yellow (`#f59e0b`)
- **Danger:** Red (`#ef4444`)
- **Neutral:** Slate (50-900)

### Dark Mode
- Full dark mode support via Tailwind CSS
- `dark:` prefixed classes throughout
- User preference auto-detected

### Responsive Breakpoints
- Mobile (default)
- Tablet: `md:` (768px)
- Desktop: `lg:` (1024px)
- Large: `xl:` (1280px)

---

## Performance Optimizations

1. **Server Components:** Most pages are server components for initial load
2. **Client Components:** Only interactive components use 'use client'
3. **Data Fetching:** Server Actions with RLS applied server-side
4. **Code Splitting:** Each page is lazy-loaded
5. **Image Optimization:** lucide-react for efficient icons

---

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 16 running with migrations applied
- Environment variables configured in `.env.local`

### Installation
```bash
npm install
npm run dev
```

### Access the Platform
```
http://localhost:3000
Login: admin@acme.com
Password: password123
```

### Navigate Pages
- **Command Palette:** Press Cmd/Ctrl+K to jump between pages
- **Sidebar:** Click navigation links
- **Breadcrumbs:** Navigate hierarchy

---

## Future Enhancements

1. **Email Templates Manager** - UI for composing automated success emails
2. **Alert Logs** - History of all automated actions executed
3. **Bulk Actions** - Update multiple accounts at once
4. **Custom Fields** - Admin-defined fields for CRM data
5. **Integrations Panel** - Connect to Slack, HubSpot, Salesforce
6. **Reporting** - Custom report builder with saved views
7. **Mobile App** - React Native companion app
8. **Calendar View** - Timeline view of contract renewals
9. **Forecasting** - Predict churn/expansion based on health trends
10. **Team Collaboration** - Comments, mentions, activity feeds

---

## Support

For issues or questions:
1. Check [PLATFORM_SETUP_GUIDE.md](PLATFORM_SETUP_GUIDE.md) for setup help
2. Review database schema in [database/migrations/](database/migrations/)
3. Check [app/actions/](app/actions/) for data flow documentation

---

**Last Updated:** December 27, 2025
**Version:** 1.0.0
**Status:** Production Ready ✅
