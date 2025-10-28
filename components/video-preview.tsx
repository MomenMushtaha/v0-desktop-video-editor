"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Maximize, Minimize } from "lucide-react"
import type { VideoClip } from "./video-editor"

interface VideoPreviewProps {
  clips: VideoClip[]
  currentTime: number
  isPlaying: boolean
  volume: number
  playbackSpeed: number
  onTimeUpdate: (time: number) => void
}

export default function VideoPreview({
  clips,
  currentTime,
  isPlaying,
  volume,
  playbackSpeed,
  onTimeUpdate,
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (!videoRef.current) return

    const video = videoRef.current
    video.volume = volume / 100
    video.playbackRate = playbackSpeed

    if (isPlaying) {
      video.play()
    } else {
      video.pause()
    }
  }, [isPlaying, volume, playbackSpeed])

  useEffect(() => {
    // Find the clip that should be playing at currentTime
    const activeClip = clips.find(
      (clip) => currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration,
    )

    if (activeClip && videoRef.current) {
      const relativeTime = currentTime - activeClip.startTime + activeClip.trimStart
      videoRef.current.src = activeClip.url
      videoRef.current.currentTime = relativeTime
    }
  }, [currentTime, clips])

  const toggleFullscreen = () => {
    if (!containerRef.current) return

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [])

  return (
    <div ref={containerRef} className="relative flex flex-1 items-center justify-center bg-black">
      {clips.length === 0 ? (
        <div className="text-center">
          <div className="mb-4 text-6xl">🎬</div>
          <h2 className="mb-2 text-xl font-semibold text-white">No clips imported</h2>
          <p className="text-sm text-gray-400">Click Import to add video files to your timeline</p>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            className="max-h-full max-w-full"
            onTimeUpdate={(e) => {
              const video = e.currentTarget
              const activeClip = clips.find(
                (clip) => currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration,
              )
              if (activeClip) {
                const newTime = activeClip.startTime + (video.currentTime - activeClip.trimStart)
                onTimeUpdate(newTime)
              }
            }}
          />
          <canvas ref={canvasRef} className="hidden" />

          <Button
            variant="ghost"
            size="icon"
            className="absolute bottom-4 left-4 bg-black/50 text-white hover:bg-black/70"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </>
      )}
      <div className="absolute bottom-4 right-4 rounded bg-black/50 px-2 py-1 text-xs text-white">
        {clips.length} clip{clips.length !== 1 ? "s" : ""}
      </div>
    </div>
  )
}
