import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TaskArtifact } from '@/types'
import { cn } from '@/lib/utils'
import { FileCode, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'

interface ArtifactViewerProps {
  artifact: TaskArtifact
}

export function ArtifactViewer({ artifact }: ArtifactViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(artifact.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const typeColors: Record<string, string> = {
    code: 'bg-blue-100 text-blue-700',
    file: 'bg-green-100 text-green-700',
    log: 'bg-gray-100 text-gray-700',
    report: 'bg-purple-100 text-purple-700',
    config: 'bg-orange-100 text-orange-700',
  }

  return (
    <Card className="border">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <FileCode className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{artifact.name}</span>
          <Badge variant="outline" className={cn('text-xs', typeColors[artifact.type] || '')}>
            {artifact.type}
          </Badge>
          {artifact.language && (
            <Badge variant="secondary" className="text-xs">
              {artifact.language}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>
      {isExpanded && (
        <CardContent className="p-0">
          <pre className="bg-gray-900 text-gray-100 p-4 text-xs font-mono overflow-x-auto rounded-b-lg max-h-96 overflow-y-auto">
            <code>{artifact.content}</code>
          </pre>
        </CardContent>
      )}
    </Card>
  )
}
