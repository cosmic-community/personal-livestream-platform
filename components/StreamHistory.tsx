import { StreamSession } from '@/types'

interface StreamHistoryProps {
  sessions: StreamSession[]
}

export default function StreamHistory({ sessions }: StreamHistoryProps) {
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else if (minutes > 0) {
      return `${minutes}m`
    } else {
      return `${seconds}s`
    }
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'live':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'ended':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'starting':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  if (sessions.length === 0) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Stream History</h2>
        <div className="text-center py-8">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-500">No stream sessions yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Your streaming history will appear here
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-4">Stream History</h2>
      <div className="space-y-4">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`status-badge ${getStatusColor(session.metadata?.status || 'ended')}`}>
                  {(session.metadata?.status || 'ended').toUpperCase()}
                </span>
                <span className="text-sm text-muted-foreground">
                  {session.metadata?.stream_type || 'unknown'}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDate(session.created_at)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Duration:</span>
                <span className="ml-1 font-medium">
                  {session.metadata?.duration ? formatDuration(session.metadata.duration) : 'In progress'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Peak viewers:</span>
                <span className="ml-1 font-medium">
                  {session.metadata?.peak_viewers || 0}
                </span>
              </div>
            </div>

            {session.metadata?.status === 'live' && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <div className="live-indicator"></div>
                <span className="text-red-600 font-medium">Currently streaming</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {sessions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            Showing {sessions.length} recent session{sessions.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}