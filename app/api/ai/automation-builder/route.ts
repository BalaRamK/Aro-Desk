import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/actions/auth-local';

const GEMINI_API_KEY = process.env.GEMINI_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent';

interface AutomationRequest {
  description: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface PlaybookConfig {
  name: string;
  description: string;
  trigger_criteria: Record<string, any>;
  actions: Array<{
    type: string;
    config: Record<string, any>;
  }>;
  conditions: Array<{
    type: string;
    operator: string;
    value: any;
  }>;
}

/**
 * POST /api/ai/automation-builder
 * 
 * Generates automation/playbook configurations using AI based on user descriptions.
 * The AI understands the user's intent and builds the complete automation structure.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized: Please log in to use the automation builder' },
        { status: 401 }
      );
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { 
          error: 'AI service not configured. Please set GEMINI_KEY in environment variables.',
          suggestion: 'For Vercel deployments, add GEMINI_KEY to your project environment variables.'
        },
        { status: 500 }
      );
    }

    const body: AutomationRequest = await request.json();
    const { description, conversationHistory = [] } = body;

    if (!description || description.trim().length === 0) {
      return NextResponse.json(
        { error: 'Please provide a description of the automation you want to create' },
        { status: 400 }
      );
    }

    // Build the system prompt for AI
    const systemPrompt = `You are an expert automation engineer helping users build customer success automation playbooks (SuccessPlays). 

Your job is to:
1. Understand the user's automation requirements from their description
2. Ask clarifying questions if needed to understand their intent
3. Generate a complete playbook configuration that can be executed

When generating a playbook, you MUST provide JSON that follows this structure:
{
  "name": "Descriptive playbook name",
  "description": "What this playbook does",
  "trigger_criteria": {
    "type": "health_score_change|account_milestone|customer_action|scheduled|webhook",
    "conditions": { /* specific conditions based on type */ }
  },
  "actions": [
    {
      "type": "email|slack|create_task|update_account|send_webhook",
      "config": { /* action-specific configuration */ }
    }
  ],
  "conditions": [
    {
      "type": "account_property|customer_property|metric_threshold",
      "operator": "equals|greater_than|less_than|contains",
      "value": "the value to check"
    }
  ]
}

Supported trigger types:
- health_score_change: Triggers when health score changes above/below threshold
- account_milestone: Triggers when account reaches a milestone
- customer_action: Triggers on specific customer actions (email opens, page visits, etc.)
- scheduled: Triggers on a schedule (daily, weekly, monthly)
- webhook: Triggers from external webhook

Supported action types:
- email: Send personalized email to customer/CSM
- slack: Send Slack notification
- create_task: Create a task for the CSM
- update_account: Update account properties
- send_webhook: Trigger external webhook

Keep your responses helpful and concise. If the user's request is unclear, ask one or two clarifying questions before providing the full configuration.`;

    // Prepare conversation history for Gemini
    const conversationText = conversationHistory.length > 0
      ? conversationHistory.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n\n')
      : '';

    const fullPrompt = `${systemPrompt}

${conversationText ? `Previous conversation:\n${conversationText}\n\n` : ''}User: ${description}

Please respond as the automation assistant.`;

    // Call Gemini API
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Gemini API error:', error);
      return NextResponse.json(
        { 
          error: 'Failed to generate automation configuration',
          details: error.error?.message || 'Unknown error'
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const assistantMessage = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Try to extract JSON from the response
    let playbookConfig: PlaybookConfig | null = null;
    const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        playbookConfig = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error('Failed to parse playbook JSON:', e);
      }
    }

    return NextResponse.json({
      success: true,
      message: assistantMessage,
      playbookConfig,
      conversationHistory: [
        ...conversationHistory,
        { role: 'user', content: description },
        { role: 'assistant', content: assistantMessage }
      ]
    });
  } catch (error) {
    console.error('Automation builder error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process automation request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/automation-builder
 * 
 * Provides example prompts and automation templates to help users get started
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const examples = [
      {
        title: "Health Score Drop Alert",
        description: "Send email to CSM when a customer's health score drops below 40",
        prompt: "Create a playbook that monitors health scores and alerts the CSM when health drops below 40 for their accounts"
      },
      {
        title: "Renewal Reminder",
        description: "Create tasks 90 days before contract renewal",
        prompt: "Build an automation that creates renewal preparation tasks 90 days before contract expiration"
      },
      {
        title: "High-Value Win Celebration",
        description: "Send Slack notification when a deal is closed",
        prompt: "When a new high-value deal is closed (over $100k), send a Slack notification to the success team"
      },
      {
        title: "Upsell Opportunity",
        description: "Flag accounts for upsell when usage reaches 80%",
        prompt: "Create a playbook that identifies upsell opportunities when customers reach 80% platform usage"
      },
      {
        title: "Churn Risk Intervention",
        description: "Trigger intervention workflow for accounts showing churn signals",
        prompt: "Build an automation that detects churn risk signals (decreased usage, support tickets, sentiment) and triggers immediate CSM intervention"
      }
    ];

    return NextResponse.json({
      success: true,
      message: "Here are some example automation templates to get you started",
      examples,
      tips: [
        "Be specific about the trigger conditions",
        "Describe the desired actions in order",
        "Include any customer segments or filters needed",
        "Mention notification preferences (email, Slack, task, etc.)"
      ]
    });
  } catch (error) {
    console.error('Get examples error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch examples' },
      { status: 500 }
    );
  }
}
