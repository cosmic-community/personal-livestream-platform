import { StreamStatsProps } from '@/types'

export default function StreamStats({ session, isLive, viewerCount }: StreamStatsProps) {
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  const getStreamDuration = (): number => {
    if (!session || !isLive) return 0
    
    const startTime = new Date(session.metadata.start_time).getTime()
    const currentTime = new Date().getTime()
    return Math.floor((currentTime - startTime) / 1000)
  }

  const stats = [
    {
      label: 'Status',
      value: isLive ? (
        <span className="flex items-center gap-2">
          <div className="live-indicator"></div>
          LIVE
        </span>
      ) : 'Offline',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      label: 'Current Viewers',
      value: viewerCount.toLocaleString(),
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      label: 'Peak Viewers',
      value: session?.metadata.peak_viewers?.toLocaleString() || '0',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      label: 'Duration',
      value: isLive ? formatDuration(getStreamDuration()) : 
             session?.metadata.duration ? formatDuration(session.metadata.duration) : '0s',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
      )
    }
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div key={index} className="bg-muted rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-muted-foreground">
              {stat.icon}
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              {stat.label}
            </span>
          </div>
          <div className="text-lg font-semibold">
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  )
}