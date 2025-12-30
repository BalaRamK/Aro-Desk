/**
 * Account Profile Timeline Component
 * ===================================
 * 
 * Unified activity timeline displaying:
 * - Emails
 * - Meetings (from Outlook, calendar)
 * - Support Tickets
 * - Feature Updates
 * - Custom events
 * 
 * Uses shadcn/ui and Lucide icons for consistent styling.
 * Supports pagination with "Show More" button.
 */

'use client'

import React, { useState } from 'react'
import {
  Mail,
  Calendar,
  AlertCircle,
  Zap,
  ChevronDown,
  User,
  Building,
  MessageSquare,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// Type definitions for timeline events
export interface TimelineEvent {
  id: string
  type: 'Email' | 'Meeting' | 'Ticket' | 'FeatureUpdate' | 'Custom'
  timestamp: Date | string
  summary: string
  description?: string
  actor: {
    name: string
    email?: string
    avatar?: string
    role?: string
  }
  metadata?: {
    ticketId?: string
    severity?: 'Critical' | 'Urgent' | 'High' | 'Medium' | 'Low'
    status?: string
    duration?: number // in minutes
    attendees?: Array<{ name: string; email: string }>
    featureName?: string
    releaseVersion?: string
  }
}

interface TimelineProps {
  events: TimelineEvent[]
  itemsPerPage?: number
  onEventClick?: (event: TimelineEvent) => void
}

// Configuration for event types
const EVENT_CONFIG = {
  Email: {
    icon: Mail,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    label: 'Email',
    badge: <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Email</Badge>,
  },
  Meeting: {
    icon: Calendar,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    label: 'Meeting',
    badge: <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">Meeting</Badge>,
  },
  Ticket: {
    icon: AlertCircle,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    label: 'Support Ticket',
    badge: <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Ticket</Badge>,
  },
  FeatureUpdate: {
    icon: Zap,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    label: 'Feature Update',
    badge: <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Feature</Badge>,
  },
  Custom: {
    icon: MessageSquare,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-900/30',
    label: 'Event',
    badge: <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">Event</Badge>,
  },
}

/**
 * Format timestamp for display
 */
const formatTimestamp = (ts: Date | string): string => {
  const date = typeof ts === 'string' ? new Date(ts) : ts
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday'
  } else if (date.getFullYear() === today.getFullYear()) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
  }
}

/**
 * Single timeline event card
 */
const TimelineEventCard: React.FC<{
  event: TimelineEvent
  config: (typeof EVENT_CONFIG)[keyof typeof EVENT_CONFIG]
  onClick?: (event: TimelineEvent) => void
}> = ({ event, config, onClick }) => {
  const Icon = config.icon

  return (
    <div
      className="flex gap-4 cursor-pointer hover:opacity-80 transition-opacity"
      onClick={() => onClick?.(event)}
    >
      {/* Vertical line marker */}
      <div className="flex flex-col items-center">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center ${config.bgColor} border-2 ${config.color} border-current`}
        >
          <Icon className="w-5 h-5" />
        </div>
        {/* Continue line (will be visible unless last item) */}
        <div className="w-0.5 h-12 bg-slate-200 dark:bg-slate-700 mt-2" />
      </div>

      {/* Event content */}
      <div className="flex-1 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {config.badge}
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {formatTimestamp(event.timestamp)}
              </span>
            </div>
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              {event.summary}
            </h4>
            {event.description && (
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                {event.description}
              </p>
            )}
          </div>
        </div>

        {/* Actor info */}
        <div className="flex items-center gap-2 mt-2 text-xs text-slate-600 dark:text-slate-400">
          {event.actor.avatar ? (
            <img
              src={event.actor.avatar}
              alt={event.actor.name}
              className="w-5 h-5 rounded-full"
            />
          ) : (
            <User className="w-4 h-4" />
          )}
          <span>{event.actor.name}</span>
          {event.actor.role && <span className="text-slate-500">• {event.actor.role}</span>}
        </div>

        {/* Metadata: severity badge for tickets */}
        {event.metadata?.severity && (
          <div className="mt-2">
            <Badge
              className={`text-xs ${
                event.metadata.severity === 'Critical'
                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  : event.metadata.severity === 'Urgent'
                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
              }`}
            >
              {event.metadata.severity}
            </Badge>
          </div>
        )}

        {/* Metadata: meeting attendees */}
        {event.metadata?.attendees && event.metadata.attendees.length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Attendees ({event.metadata.attendees.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {event.metadata.attendees.slice(0, 3).map((attendee, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {attendee.name}
                </Badge>
              ))}
              {event.metadata.attendees.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{event.metadata.attendees.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Metadata: feature update */}
        {event.metadata?.featureName && (
          <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            <strong>Feature:</strong> {event.metadata.featureName}
            {event.metadata.releaseVersion && ` (v${event.metadata.releaseVersion})`}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Main Timeline Component
 */
export const AccountProfileTimeline: React.FC<TimelineProps> = ({
  events,
  itemsPerPage = 10,
  onEventClick,
}) => {
  const [displayCount, setDisplayCount] = useState(itemsPerPage)

  // Sort events by timestamp (newest first)
  const sortedEvents = [...events].sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime()
    const dateB = new Date(b.timestamp).getTime()
    return dateB - dateA
  })

  const visibleEvents = sortedEvents.slice(0, displayCount)
  const hasMore = displayCount < sortedEvents.length

  if (events.length === 0) {
    return (
      <Card className="p-8 text-center">
        <MessageSquare className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
        <p className="text-slate-600 dark:text-slate-400">
          No activity recorded yet. Check back soon!
        </p>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Activity Timeline
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {sortedEvents.length} events recorded
        </p>
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        {visibleEvents.map((event, idx) => (
          <div key={event.id}>
            <TimelineEventCard
              event={event}
              config={EVENT_CONFIG[event.type]}
              onClick={onEventClick}
            />
            {/* Remove line on last visible item */}
            {idx === visibleEvents.length - 1 && (
              <style>{`
                [data-timeline-event]:last-child > div:first-child > div:last-child {
                  display: none;
                }
              `}</style>
            )}
          </div>
        ))}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button
            variant="outline"
            onClick={() => setDisplayCount((prev) => prev + itemsPerPage)}
            className="w-full"
          >
            <ChevronDown className="w-4 h-4 mr-2" />
            Show More Events ({sortedEvents.length - displayCount} remaining)
          </Button>
        </div>
      )}
    </Card>
  )
}

export default AccountProfileTimeline
