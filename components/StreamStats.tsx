import { StreamStatsProps } from '@/types'

export default function StreamStats({ session, isLive, viewerCount, stats }: StreamStatsProps) {
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
    
    const startTime = new Date(session.metadata?.start_time || Date.now()).getTime()
    const currentTime = new Date().getTime()
    return Math.floor((currentTime - startTime) / 1000)
  }

  const streamStats = [
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
      value: session?.metadata?.peak_viewers?.toLocaleString() || '0',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      label: 'Duration',
      value: isLive ? formatDuration(getStreamDuration()) : 
             session?.metadata?.duration ? formatDuration(session.metadata.duration) : '0s',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
      )
    }
  ]

  // Add technical stats if available
  const technicalStats = []
  if (stats) {
    technicalStats.push(
      {
        label: 'Bitrate',
        value: `${Math.round(stats.averageBitrate / 1000)}kbps`,
        icon: (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        )
      },
      {
        label: 'Frame Rate',
        value: `${stats.frameRate}fps`,
        icon: (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        )
      },
      {
        label: 'Resolution',
        value: stats.resolution,
        icon: (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
          </svg>
        )
      },
      {
        label: 'Quality',
        value: (
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            stats.connectionQuality === 'excellent' ? 'bg-green-100 text-green-800' :
            stats.connectionQuality === 'good' ? 'bg-blue-100 text-blue-800' :
            stats.connectionQuality === 'fair' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {stats.connectionQuality}
          </span>
        ),
        icon: (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )
      }
    )
  }

  const allStats = [...streamStats, ...technicalStats]

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Stream Statistics</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {allStats.map((stat, index) => (
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

      {stats && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-muted rounded-lg p-4">
            <h4 className="font-medium mb-2">Connection Statistics</h4>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div>Latency: {stats.latency}ms</div>
              <div>Packet Loss: {stats.packetLoss.toFixed(2)}%</div>
              <div>Bytes Sent: {(stats.totalBytesSent / 1024 / 1024).toFixed(2)} MB</div>
              <div>Bytes Received: {(stats.totalBytesReceived / 1024 / 1024).toFixed(2)} MB</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}