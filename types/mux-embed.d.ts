declare module 'mux-embed' {
  interface MuxData {
    env_key?: string
    player_name?: string
    player_version?: string
    player_init_time?: number
    video_id?: string
    video_title?: string
    video_stream_type?: string
    viewer_user_id?: string
    experiment_name?: string
    sub_property_id?: string
  }

  interface MuxOptions {
    debug?: boolean
    hlsjs?: any
    Hls?: any
    data?: MuxData
  }

  export function monitor(video: HTMLVideoElement, options: MuxOptions): void
  export function updateData(data: any): void
}