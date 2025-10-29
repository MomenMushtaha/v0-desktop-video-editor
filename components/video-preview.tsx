"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Maximize, Minimize } from "lucide-react"
import type { VideoClip } from "@/components/types"

interface VideoPreviewProps {
  clips: VideoClip[]
  currentTime: number
  isPlaying: boolean
  volume: number
  playbackSpeed: number
  onTimeUpdate: (time: number) => void
}

const TRIM_EPSILON = 0.03

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
  const [activeClipId, setActiveClipId] = useState<string | null>(null)

  useEffect(() => {
    if (!videoRef.current) return

    const video = videoRef.current
    video.volume = volume / 100
    video.playbackRate = playbackSpeed

    if (isPlaying) {
      const playPromise = video.play()
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.log("[ClipForge] Video play failed:", error)
        })
      }
    } else {
      video.pause()
    }
  }, [isPlaying, volume, playbackSpeed])

  useEffect(() => {
    const activeClip = clips.find(
      (clip) => currentTime >= clip.startTime && currentTime <= clip.startTime + clip.duration,
    )

    if (!activeClip || !videoRef.current) return

    const video = videoRef.current
    const timelineOffset = currentTime - activeClip.startTime
    const clampedOffset = Math.max(0, Math.min(timelineOffset, activeClip.duration))
    const desiredVideoTime = Math.min(
      Math.max(activeClip.trimStart + clampedOffset, activeClip.trimStart),
      activeClip.trimEnd,
    )

    if (activeClip.id !== activeClipId) {
      console.log("[ClipForge] Switching to clip:", activeClip.name)
      video.src = activeClip.url
      setActiveClipId(activeClip.id)

      video.onloadeddata = () => {
        console.log("[ClipForge] Video loaded successfully, dimensions:", video.videoWidth, "x", video.videoHeight)
        video.currentTime = desiredVideoTime
        if (isPlaying) {
          video.play().catch((error) => {
            console.log("[ClipForge] Video play failed after load:", error)
          })
        }
      }

      video.onerror = (e) => {
        console.log("[ClipForge] Video load error:", e)
      }
    } else {
      const timeDiff = Math.abs(video.currentTime - desiredVideoTime)
      if (timeDiff > 0.05) {
        video.currentTime = desiredVideoTime
      }
    }
  }, [currentTime, clips, activeClipId, isPlaying])

  const toggleFullscreen = async () => {
    // Check if running in Tauri
    let isTauri = false
    try {
      await import("@tauri-apps/api/window")
      isTauri = true
    } catch {
      isTauri = false
    }

    // In Tauri, use CSS-based fullscreen (browser fullscreen APIs don't work in webview)
    if (isTauri) {
      console.log("[ClipForge] Toggling CSS fullscreen for Tauri")
      setIsFullscreen(!isFullscreen)
      return
    }

    // In browser, use native fullscreen APIs
    const video = videoRef.current as any
    const container = containerRef.current as any
    const doc = document as any

    const exitDocumentFullscreen = async () => {
      const exitFullscreen =
        doc.exitFullscreen ||
        doc.webkitExitFullscreen ||
        doc.mozCancelFullScreen ||
        doc.msExitFullscreen

      if (!exitFullscreen) return false
      if (!doc.fullscreenElement && !doc.webkitFullscreenElement) return false

      await Promise.resolve(exitFullscreen.call(document))
      return true
    }

    const exitVideoFullscreen = async () => {
      if (!video) return false

      if (typeof video.webkitSetPresentationMode === "function" && video.webkitPresentationMode === "fullscreen") {
        video.webkitSetPresentationMode("inline")
        return true
      }

      if (typeof video.webkitExitFullscreen === "function") {
        video.webkitExitFullscreen()
        return true
      }

      return false
    }

    const enterVideoFullscreen = async () => {
      if (!video) return false

      try {
        if (typeof video.requestFullscreen === "function") {
          await Promise.resolve(video.requestFullscreen())
          return true
        }

        if (typeof video.webkitEnterFullscreen === "function") {
          video.webkitEnterFullscreen()
          return true
        }

        if (typeof video.webkitSetPresentationMode === "function" && video.webkitPresentationMode !== "fullscreen") {
          video.webkitSetPresentationMode("fullscreen")
          return true
        }
      } catch (error) {
        console.warn("Failed to enter video fullscreen", error)
      }

      return false
    }

    const enterContainerFullscreen = async () => {
      if (!container) return false

      const requestFullscreen =
        container.requestFullscreen ||
        container.webkitRequestFullscreen ||
        container.mozRequestFullScreen ||
        container.msRequestFullscreen

      if (!requestFullscreen) return false

      try {
        await Promise.resolve(requestFullscreen.call(container))
        return true
      } catch (error) {
        console.warn("Failed to enter container fullscreen", error)
        return false
      }
    }

    if (isFullscreen) {
      const exited = (await exitDocumentFullscreen()) || (await exitVideoFullscreen())
      if (exited) {
        setIsFullscreen(false)
      }
      return
    }

    const enteredVideo = await enterVideoFullscreen()
    if (enteredVideo) {
      setIsFullscreen(true)
      return
    }

    const enteredContainer = await enterContainerFullscreen()
    if (enteredContainer) {
      setIsFullscreen(true)
      return
    }

    console.warn("Fullscreen is not supported in this environment")
  }

  useEffect(() => {
    const updateFullscreenState = () => {
      const videoElement = videoRef.current as any
      const doc = document as any
      const isDocFullscreen = !!document.fullscreenElement || !!doc.webkitFullscreenElement
      const isVideoFullscreen =
        !!videoElement?.webkitDisplayingFullscreen || videoElement?.webkitPresentationMode === "fullscreen"
      setIsFullscreen(isDocFullscreen || isVideoFullscreen)
    }

    document.addEventListener("fullscreenchange", updateFullscreenState)
    document.addEventListener("webkitfullscreenchange", updateFullscreenState)

    const videoElement = videoRef.current as any
    if (videoElement) {
      videoElement.addEventListener("webkitbeginfullscreen", updateFullscreenState)
      videoElement.addEventListener("webkitendfullscreen", updateFullscreenState)
    }

    return () => {
      document.removeEventListener("fullscreenchange", updateFullscreenState)
      document.removeEventListener("webkitfullscreenchange", updateFullscreenState)
      if (videoElement) {
        videoElement.removeEventListener("webkitbeginfullscreen", updateFullscreenState)
        videoElement.removeEventListener("webkitendfullscreen", updateFullscreenState)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center overflow-hidden bg-black ${
        isFullscreen ? "fixed inset-0 z-50 w-screen h-screen" : "h-full w-full"
      }`}
    >
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
            className="w-full h-full object-contain"
            crossOrigin="anonymous"
            playsInline
            onTimeUpdate={(e) => {
              const video = e.currentTarget
              const activeClip = clips.find(
                (clip) => currentTime >= clip.startTime && currentTime <= clip.startTime + clip.duration,
              )
              if (!activeClip) return

              const trimmedDuration = Math.max(activeClip.trimEnd - activeClip.trimStart, TRIM_EPSILON)

              if (video.currentTime >= activeClip.trimEnd - TRIM_EPSILON) {
                const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime)
                const currentIndex = sortedClips.findIndex((clip) => clip.id === activeClip.id)
                const nextClip = sortedClips[currentIndex + 1]

                const endTimelineTime = activeClip.startTime + (activeClip.trimEnd - activeClip.trimStart)
                onTimeUpdate(nextClip ? nextClip.startTime : endTimelineTime)
                video.pause()
                return
              }

              const timelineTime = activeClip.startTime + Math.max(
                0,
                Math.min(video.currentTime - activeClip.trimStart, trimmedDuration),
              )
              onTimeUpdate(timelineTime)
            }}
            onLoadedMetadata={(e) => {
              console.log(
                "[ClipForge] Video metadata loaded:",
                e.currentTarget.videoWidth,
                "x",
                e.currentTarget.videoHeight,
              )
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
