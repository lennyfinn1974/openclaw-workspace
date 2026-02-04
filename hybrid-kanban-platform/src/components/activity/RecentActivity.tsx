import React, { useState } from 'react'
import { useActivityStore, getActivityIcon, getActivityColor } from '@/stores/activity'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Activity,
  Clock,
  ChevronDown,
  ChevronUp,
  Trash2,
  Filter
} from 'lucide-react'

interface RecentActivityProps {
  limit?: number
  showHeader?: boolean
  className?: string
}

export function RecentActivity({ limit = 10, showHeader = true, className }: RecentActivityProps) {
  const { activities, clearActivities, getRecentActivities } = useActivityStore()
  const [expanded, setExpanded] = useState(false)
  const [filter, setFilter] = useState<string | null>(null)

  const displayLimit = expanded ? 50 : limit
  const recentActivities = getRecentActivities(displayLimit)
  
  const filteredActivities = filter 
    ? recentActivities.filter(activity => activity.type === filter)
    : recentActivities

  const availableFilters = Array.from(new Set(activities.map(a => a.type)))

  if (activities.length === 0) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className="pt-0">
          <div className="text-center py-8">
            <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground mb-2">No recent activity</p>
            <p className="text-xs text-muted-foreground">
              Create or update tasks to see activity here
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Recent Activity
              <Badge variant="secondary" className="ml-1 text-xs">
                {activities.length}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Filter Toggle */}
              {availableFilters.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilter(filter ? null : availableFilters[0])}
                  className="h-7 px-2 text-xs"
                >
                  <Filter className="h-3 w-3 mr-1" />
                  {filter ? 'All' : 'Filter'}
                </Button>
              )}
              
              {/* Clear Activities */}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearActivities}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <CardDescription>
            Latest updates and changes across your workspace
          </CardDescription>
        </CardHeader>
      )}
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          {filteredActivities.map((activity, index) => (
            <div 
              key={activity.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border bg-card/50 hover:bg-accent/20 transition-colors",
                index === 0 && "border-primary/20 bg-primary/5"
              )}
            >
              {/* Activity Icon */}
              <div className="flex-shrink-0 mt-0.5">
                <span className="text-base" title={activity.type}>
                  {getActivityIcon(activity.type)}
                </span>
              </div>
              
              {/* Activity Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium leading-none mb-1">
                      {activity.title}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {activity.description}
                    </p>
                  </div>
                  
                  {/* Timestamp */}
                  <div className="flex-shrink-0 text-right">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatTime(activity.timestamp)}
                    </div>
                    {activity.timestamp.split('T')[0] !== new Date().toISOString().split('T')[0] && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(activity.timestamp).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Additional Metadata */}
                <div className="flex items-center gap-2 mt-2">
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs", getActivityColor(activity.type))}
                  >
                    {activity.userName}
                  </Badge>
                  
                  {activity.taskTitle && (
                    <Badge variant="secondary" className="text-xs">
                      {activity.taskTitle}
                    </Badge>
                  )}
                  
                  {activity.metadata?.from && activity.metadata?.to && (
                    <span className="text-xs text-muted-foreground">
                      {activity.metadata.from} → {activity.metadata.to}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {/* Show More/Less Toggle */}
          {recentActivities.length > limit && (
            <div className="text-center pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="text-xs"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Show More ({activities.length - limit} more)
                  </>
                )}
              </Button>
            </div>
          )}
          
          {filteredActivities.length === 0 && filter && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">
                No activities found for selected filter
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilter(null)}
                className="mt-2 text-xs"
              >
                Clear Filter
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Compact version for sidebar or small spaces
export function RecentActivityCompact() {
  const { getRecentActivities } = useActivityStore()
  const activities = getRecentActivities(5)

  if (activities.length === 0) {
    return (
      <div className="p-3 text-center">
        <p className="text-xs text-muted-foreground">No recent activity</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-center gap-2 p-2 rounded text-xs">
          <span>{getActivityIcon(activity.type)}</span>
          <div className="flex-1 min-w-0">
            <p className="truncate font-medium">{activity.title}</p>
            <p className="truncate text-muted-foreground text-[10px]">
              {activity.description}
            </p>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {formatTime(activity.timestamp)}
          </span>
        </div>
      ))}
    </div>
  )
}