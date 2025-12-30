'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Send, Loader2, Sparkles, Copy, Check } from 'lucide-react'
import { savePlaybook } from '@/app/actions/playbooks'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface PlaybookConfig {
  name: string
  description: string
  trigger_criteria: Record<string, any>
  actions: Array<any>
  conditions: Array<any>
}

interface AIResponse {
  success: boolean
  message: string
  playbookConfig?: PlaybookConfig
  conversationHistory?: Message[]
}

export function AIAutomationBuilder() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generatedPlaybook, setGeneratedPlaybook] = useState<PlaybookConfig | null>(null)
  const [copied, setCopied] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    // Add user message
    const userMessage: Message = { role: 'user', content: input }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/ai/automation-builder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: input,
          conversationHistory: messages,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate automation')
      }

      const data: AIResponse = await response.json()
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
      }
      setMessages((prev) => [...prev, assistantMessage])

      if (data.playbookConfig) {
        setGeneratedPlaybook(data.playbookConfig)
      }
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to process request'}`,
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const copyPlaybookJson = () => {
    if (generatedPlaybook) {
      navigator.clipboard.writeText(JSON.stringify(generatedPlaybook, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSavePlaybook = async () => {
    if (!generatedPlaybook) return

    setSaving(true)
    setSaveMessage(null)

    try {
      const result = await savePlaybook(generatedPlaybook)
      setSaveMessage({ type: 'success', text: `Playbook "${generatedPlaybook.name}" saved successfully!` })
      // Reset after successful save
      setTimeout(() => {
        setMessages([])
        setInput('')
        setGeneratedPlaybook(null)
      }, 2000)
    } catch (error) {
      setSaveMessage({ 
        type: 'error', 
        text: `Failed to save playbook: ${error instanceof Error ? error.message : 'Unknown error'}` 
      })
    } finally {
      setSaving(false)
    }
  }

  const handleLoadExample = (prompt: string) => {
    setInput(prompt)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* Chat Interface */}
      <div className="lg:col-span-2 flex flex-col">
        <Card className="flex-1 flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                  AI Automation Builder
                </CardTitle>
                <CardDescription>
                  Describe the automation you want to create, and AI will build it for you
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-4">
              {messages.length === 0 ? (
                <div className="text-center text-slate-500 py-8">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                  <p>Start by describing the automation you want to create</p>
                  <p className="text-sm mt-2">Examples: "Send email when health drops", "Create renewal tasks 90 days before renewal"</p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-lg">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe your automation..."
                disabled={loading}
                className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800"
              />
              <Button
                type="submit"
                disabled={loading || !input.trim()}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar: Generated Config & Examples */}
      <div className="space-y-4 h-full overflow-y-auto">
        {/* Generated Playbook */}
        {generatedPlaybook && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Generated Playbook</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={copyPlaybookJson}
                  className="h-auto p-1"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {saveMessage && (
                <div className={`text-xs p-2 rounded ${
                  saveMessage.type === 'success' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' 
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                }`}>
                  {saveMessage.text}
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">NAME</p>
                <p className="text-sm font-medium">{generatedPlaybook.name}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">DESCRIPTION</p>
                <p className="text-sm">{generatedPlaybook.description}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">TRIGGER</p>
                <Badge variant="secondary" className="text-xs">
                  {generatedPlaybook.trigger_criteria.type}
                </Badge>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">ACTIONS ({generatedPlaybook.actions.length})</p>
                <div className="space-y-1">
                  {generatedPlaybook.actions.map((action, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {action.type}
                    </Badge>
                  ))}
                </div>
              </div>

              <pre className="text-xs bg-slate-900 text-slate-100 p-2 rounded overflow-x-auto max-h-48">
                {JSON.stringify(generatedPlaybook, null, 2)}
              </pre>

              <Button 
                className="w-full text-xs" 
                onClick={handleSavePlaybook}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save as Playbook'
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Example Templates */}
        {messages.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Example Templates</CardTitle>
              <CardDescription className="text-xs">
                Click to get started with a template
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <button
                onClick={() => handleLoadExample('Create a playbook that sends an email to the CSM when health score drops below 40')}
                className="w-full text-left p-2 text-xs bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
              >
                <p className="font-medium">Health Score Alert</p>
                <p className="text-slate-500 text-xs">Email on health drop</p>
              </button>

              <button
                onClick={() => handleLoadExample('Build an automation that creates renewal prep tasks 90 days before contract renewal')}
                className="w-full text-left p-2 text-xs bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
              >
                <p className="font-medium">Renewal Reminder</p>
                <p className="text-slate-500 text-xs">90 days before renewal</p>
              </button>

              <button
                onClick={() => handleLoadExample('Send a Slack notification to the team when a high-value deal over $100k is closed')}
                className="w-full text-left p-2 text-xs bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
              >
                <p className="font-medium">Deal Win Alert</p>
                <p className="text-slate-500 text-xs">Slack on high-value deals</p>
              </button>

              <button
                onClick={() => handleLoadExample('Create a playbook that flags accounts for upsell when usage reaches 80% of their plan')}
                className="w-full text-left p-2 text-xs bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
              >
                <p className="font-medium">Upsell Opportunity</p>
                <p className="text-slate-500 text-xs">At 80% usage</p>
              </button>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-blue-900 dark:text-blue-100">
              <AlertCircle className="h-4 w-4" />
              Pro Tips
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2 text-blue-800 dark:text-blue-200">
            <p>✨ Be specific about trigger conditions</p>
            <p>📋 Describe actions in the order they should execute</p>
            <p>🎯 Mention customer segments or filters if needed</p>
            <p>📢 Specify notification preferences (email, Slack, task, etc.)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
