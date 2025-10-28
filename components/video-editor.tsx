"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Upload,
  Download,
  Video,
  Webcam,
  Monitor,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Timeline from "@/components/timeline"
import VideoPreview from "@/components/video-preview"
import Toolbar from "@/components/toolbar"
import ExportDialog from "@/components/export-dialog"

export interface VideoClip {
  id: string
  name: string
  url: string
  duration: number
  startTime: number
  trimStart: number
  trimEnd: number
  track: number
}

export default function VideoEditor() {
  const [clips, setClips] = useState<VideoClip[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(100)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [zoom, setZoom] = useState(50) // pixels per second
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processVideoFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("video/")) {
        return
      }

      const url = URL.createObjectURL(file)
      const video = document.createElement("video")
      video.src = url

      video.onloadedmetadata = () => {
        const newClip: VideoClip = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          url,
          duration: video.duration,
          startTime: duration,
          trimStart: 0,
          trimEnd: video.duration,
          track: 0,
        }

        setClips((prev) => [...prev, newClip])
        setDuration((prev) => prev + video.duration)
      }
    })
  }

  const handleImportVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    processVideoFiles(files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      processVideoFiles(files)
    }
  }

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev * 1.5, 200))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev / 1.5, 10))
  }

  const handleZoomToFit = () => {
    if (duration === 0) return
    const targetWidth = 1200
    const newZoom = targetWidth / duration
    setZoom(Math.max(10, Math.min(newZoom, 200)))
  }

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault()
        setIsPlaying((prev) => !prev)
      }
      if (e.code === "ArrowLeft") {
        e.preventDefault()
        setCurrentTime((prev) => Math.max(0, prev - 1 / 30))
        setIsPlaying(false)
      }
      if (e.code === "ArrowRight") {
        e.preventDefault()
        setCurrentTime((prev) => Math.min(duration, prev + 1 / 30))
        setIsPlaying(false)
      }
      if (e.code === "KeyI" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        handleSetInPoint()
      }
      if (e.code === "KeyO" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        handleSetOutPoint()
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [duration, selectedClipId, currentTime, clips])

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const handlePreviousFrame = () => {
    setCurrentTime((prev) => Math.max(0, prev - 1 / 30))
    setIsPlaying(false)
  }

  const handleNextFrame = () => {
    setCurrentTime((prev) => Math.min(duration, prev + 1 / 30))
    setIsPlaying(false)
  }

  const handleSeek = (value: number[]) => {
    setCurrentTime(value[0])
  }

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0])
  }

  const handleSetInPoint = () => {
    if (!selectedClipId) return
    const clip = clips.find((c) => c.id === selectedClipId)
    if (!clip) return

    const relativeTime = currentTime - clip.startTime
    if (relativeTime < 0 || relativeTime >= clip.trimEnd - clip.trimStart) return

    const newTrimStart = clip.trimStart + relativeTime
    if (newTrimStart >= clip.trimEnd) return

    setClips((prev) =>
      prev.map((c) =>
        c.id === selectedClipId
          ? {
              ...c,
              trimStart: newTrimStart,
              duration: c.trimEnd - newTrimStart,
            }
          : c,
      ),
    )
  }

  const handleSetOutPoint = () => {
    if (!selectedClipId) return
    const clip = clips.find((c) => c.id === selectedClipId)
    if (!clip) return

    const relativeTime = currentTime - clip.startTime
    if (relativeTime <= 0 || relativeTime > clip.trimEnd - clip.trimStart) return

    const newTrimEnd = clip.trimStart + relativeTime
    if (newTrimEnd <= clip.trimStart) return

    setClips((prev) =>
      prev.map((c) =>
        c.id === selectedClipId
          ? {
              ...c,
              trimEnd: newTrimEnd,
              duration: newTrimEnd - c.trimStart,
            }
          : c,
      ),
    )
  }

  const handleSplitClip = () => {
    if (!selectedClipId) return
    const clip = clips.find((c) => c.id === selectedClipId)
    if (!clip) return

    const relativeTime = currentTime - clip.startTime
    if (relativeTime <= 0 || relativeTime >= clip.duration) return

    const firstPart: VideoClip = {
      ...clip,
      id: Math.random().toString(36).substr(2, 9),
      duration: relativeTime,
      trimEnd: clip.trimStart + relativeTime,
    }

    const secondPart: VideoClip = {
      ...clip,
      id: Math.random().toString(36).substr(2, 9),
      startTime: clip.startTime + relativeTime,
      duration: clip.duration - relativeTime,
      trimStart: clip.trimStart + relativeTime,
    }

    setClips((prev) => prev.map((c) => (c.id === selectedClipId ? firstPart : c)).concat(secondPart))
  }

  const handleExport = () => {
    setExportDialogOpen(true)
  }

  const handleTrimUpdate = (clipId: string, trimStart: number, trimEnd: number) => {
    setClips((prev) =>
      prev.map((c) =>
        c.id === clipId
          ? {
              ...c,
              trimStart,
              trimEnd,
              duration: trimEnd - trimStart,
            }
          : c,
      ),
    )
  }

  return (
    <div
      className="flex h-screen flex-col bg-background"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-primary bg-card p-12">
            <Upload className="h-16 w-16 text-primary" />
            <div className="text-center">
              <p className="text-2xl font-semibold">Drop video files here</p>
              <p className="text-muted-foreground">MP4, MOV, and other video formats supported</p>
            </div>
          </div>
        </div>
      )}

      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Video className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">ClipForge</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button variant="outline" size="sm">
            <Monitor className="mr-2 h-4 w-4" />
            Screen
          </Button>
          <Button variant="outline" size="sm">
            <Webcam className="mr-2 h-4 w-4" />
            Webcam
          </Button>
          <Button size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={handleImportVideo}
        />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Toolbar onSplit={handleSplitClip} selectedClipId={selectedClipId} />

        <div className="flex flex-1 flex-col">
          <VideoPreview
            clips={clips}
            currentTime={currentTime}
            isPlaying={isPlaying}
            volume={volume}
            playbackSpeed={playbackSpeed}
            onTimeUpdate={setCurrentTime}
          />

          <div className="border-t border-border bg-card p-4">
            <div className="mb-4 flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={handlePreviousFrame} title="Previous Frame (←)">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon">
                <SkipBack className="h-5 w-5" />
              </Button>
              <Button size="icon" onClick={handlePlayPause} title="Play/Pause (Space)">
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
              <Button variant="ghost" size="icon">
                <SkipForward className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleNextFrame} title="Next Frame (→)">
                <ChevronRight className="h-5 w-5" />
              </Button>

              <div className="mx-2 h-6 w-px bg-border" />
              <Button
                variant="outline"
                size="sm"
                onClick={handleSetInPoint}
                disabled={!selectedClipId}
                title="Set In Point (I)"
              >
                [ In
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSetOutPoint}
                disabled={!selectedClipId}
                title="Set Out Point (O)"
              >
                Out ]
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-16 bg-transparent">
                    {playbackSpeed}x
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setPlaybackSpeed(0.25)}>0.25x</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPlaybackSpeed(0.5)}>0.5x</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPlaybackSpeed(1)}>1x</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPlaybackSpeed(1.5)}>1.5x</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPlaybackSpeed(2)}>2x</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex flex-1 items-center gap-2">
                <span className="text-sm text-muted-foreground">{formatTime(currentTime)}</span>
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={handleSeek}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground">{formatTime(duration)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Volume2 className="h-5 w-5 text-muted-foreground" />
                <Slider value={[volume]} max={100} step={1} onValueChange={handleVolumeChange} className="w-24" />
              </div>
            </div>
          </div>

          <Timeline
            clips={clips}
            currentTime={currentTime}
            duration={duration}
            selectedClipId={selectedClipId}
            zoom={zoom}
            onClipSelect={setSelectedClipId}
            onClipsUpdate={setClips}
            onTimeUpdate={setCurrentTime}
            onTrimUpdate={handleTrimUpdate}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomToFit={handleZoomToFit}
          />
        </div>
      </div>

      <ExportDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen} clips={clips} />
    </div>
  )
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}
