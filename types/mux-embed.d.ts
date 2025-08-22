declare module 'mux-embed' {
  interface MuxDataOptions {
    debug?: boolean
    hlsjs?: any
    Hls?: any
    data?: {
      env_key: string
      player_name?: string
      player_version?: string
      player_init_time?: number
      video_id?: string
      video_title?: string
      video_stream_type?: 'live' | 'on-demand'
      viewer_user_id?: string
      experiment_name?: string
      sub_property_id?: string
      page_type?: string
      video_language?: string
      video_variant_name?: string
      video_variant_id?: string
      video_series?: string
      video_duration?: number
      video_encoding_variant?: string
      video_cdn?: string
      custom_1?: string
      custom_2?: string
      custom_3?: string
      custom_4?: string
      custom_5?: string
      custom_6?: string
      custom_7?: string
      custom_8?: string
      custom_9?: string
      custom_10?: string
    }
  }

  interface MuxDataUpdateOptions {
    video_id?: string
    video_title?: string
    video_stream_type?: 'live' | 'on-demand'
    viewer_user_id?: string
    experiment_name?: string
    video_language?: string
    video_variant_name?: string
    video_variant_id?: string
    video_series?: string
    video_duration?: number
    video_encoding_variant?: string
    video_cdn?: string
    custom_1?: string
    custom_2?: string
    custom_3?: string
    custom_4?: string
    custom_5?: string
    custom_6?: string
    custom_7?: string
    custom_8?: string
    custom_9?: string
    custom_10?: string
  }

  export function monitor(element: HTMLVideoElement, options: MuxDataOptions): void
  export function updateData(options: MuxDataUpdateOptions): void
  export function destroyMonitor(): void
}