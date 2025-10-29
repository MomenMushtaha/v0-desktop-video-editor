"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
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
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Timeline from "@/components/timeline"
import VideoPreview from "@/components/video-preview"
import Toolbar from "@/components/toolbar"
import ExportDialog from "@/components/export-dialog"
import type { VideoClip } from "@/components/types"
import { reportErrorToClaude, reportInfoToClaude, reportButtonClickToClaude } from "@/lib/claude-reporter"
import { open } from "@tauri-apps/plugin-dialog"
import { convertFileSrc } from "@tauri-apps/api/core"
import { useClaudeObserver } from "@/lib/claude-observer"
import { InteractiveTerminal } from "@/components/interactive-terminal"
import { Selectable } from "@/components/selectable"

export default function VideoEditor() {
  // Initialize Claude Observer
  const observer = useClaudeObserver({
    componentName: "VideoEditor",
    trackStateChanges: true,
    trackMounts: true,
    trackRenders: false
  })

  const [clips, setClips] = useState<VideoClip[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(100)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [zoom, setZoom] = useState(50)
  const [showLayers, setShowLayers] = useState(false)

  const resetEditorState = (reason: string) => {
    setClips([])
    setDuration(0)
    setCurrentTime(0)
    setSelectedClipId(null)
    void observer.trackInfo(`Reset editor state: ${reason}`)
  }

  // Track critical state changes (removed observer from dependencies to prevent infinite loops)
  useEffect(() => {
    const clipsInfo = `${clips.length} clips (${clips.map(c => c.name).join(", ")})`
    observer.trackState("clips", "", clipsInfo)
  }, [clips])

  useEffect(() => {
    observer.trackState("duration", 0, duration)
  }, [duration])

  const processVideoFiles = async (files: FileList | File[], options?: { replaceExisting?: boolean }) => {
    try {
      const videoFiles = Array.from(files).filter((file) => file.type.startsWith("video/"))

      if (videoFiles.length === 0) {
        // User validation - don't report as error
        console.log("[ClipForge] No valid video files found")
        return
      }

      if (options?.replaceExisting && videoFiles.length > 0) {
        resetEditorState("drag-and-drop import")
      }

      for (const file of videoFiles) {
        try {
          const url = URL.createObjectURL(file)
          const video = document.createElement("video")
          video.src = url

          video.onloadedmetadata = async () => {
            let newClip: VideoClip | null = null

            setDuration((prevDuration) => {
              newClip = {
                id: Math.random().toString(36).substring(2, 11),
                name: file.name,
                url,
                duration: video.duration,
                startTime: prevDuration,
                trimStart: 0,
                trimEnd: video.duration,
                track: 0,
              }
              return prevDuration + video.duration
            })

            if (newClip) {
              setClips((prev) => {
                const updated = [...prev, newClip!]
                void observer.trackInfo(`Clips state updated, new length: ${updated.length}`)
                return updated
              })
              setSelectedClipId((prev) => prev ?? newClip!.id)
              await reportInfoToClaude(`Video "${file.name}" loaded (${video.duration.toFixed(1)}s)`, "Process Video Files")
            }
          }

          video.onerror = async (e) => {
            // Technical error - file couldn't be loaded (corrupted, unsupported format, etc.)
            await reportErrorToClaude(`Failed to load video "${file.name}" - file may be corrupted or unsupported format`, "Process Video Files")
            console.error(`[ClipForge] Failed to load video ${file.name}:`, e)
          }

          video.load()
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          await reportErrorToClaude(`Error processing "${file.name}": ${errorMsg}`, "Process Video Files")
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      await reportErrorToClaude(errorMsg, "Process Video Files")
    }
  }

  const handleImportVideo = async () => {
    await observer.trackInteraction("clicked", "Import Button")

    try {
      await observer.trackCall("handleImportVideo")

      const selected = await observer.trackAsync("open file dialog", open({
        multiple: true,
        filters: [{
          name: 'Video',
          extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv']
        }]
      }))

      if (!selected) {
        // User cancelled - don't report as error
        console.log("[ClipForge] User cancelled file selection")
        await observer.trackInfo("User cancelled file selection")
        return
      }

      const filePaths = Array.isArray(selected) ? selected : [selected]
      await observer.trackInfo(`Selected ${filePaths.length} file(s): ${filePaths.join(", ")}`)
      await reportInfoToClaude(`Importing ${filePaths.length} file(s)`, "Import Video")

      if (clips.length > 0) {
        resetEditorState("file picker import")
      }

      // Process each file path
      for (const filePath of filePaths) {
        try {
          await observer.trackInfo(`Processing file: ${filePath}`)

          const url = convertFileSrc(filePath)
          await observer.trackInfo(`Converted to URL: ${url}`)

          const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'Unknown'
          const video = document.createElement("video")
          video.src = url

          video.onloadedmetadata = async () => {
            await observer.trackInfo(`Video metadata loaded: ${fileName} (${video.duration}s)`)

            // Use callback to get current values and create clip
            let newClip: VideoClip | null = null

            setDuration((prevDuration) => {
              observer.trackInfo(`Creating clip with startTime: ${prevDuration}, duration: ${video.duration}`)

              newClip = {
                id: Math.random().toString(36).substring(2, 11),
                name: fileName,
                url,
                duration: video.duration,
                startTime: prevDuration,
                trimStart: 0,
                trimEnd: video.duration,
                track: 0,
              }
              return prevDuration + video.duration
            })

            // Add clip after duration is updated
            if (newClip) {
              await observer.trackInfo(`Adding clip to state: ${JSON.stringify(newClip).substring(0, 100)}`)
              setClips((prev) => {
                const updated = [...prev, newClip!]
                void observer.trackInfo(`Clips state updated, new length: ${updated.length}`)
                return updated
              })
              setSelectedClipId((prev) => prev ?? newClip!.id)
            }

            await reportInfoToClaude(`Video "${fileName}" loaded (${video.duration.toFixed(1)}s)`, "Import Video")
            await observer.trackInfo(`Completed video load for: ${fileName}`)
          }

          video.onerror = async (e) => {
            await reportErrorToClaude(`Failed to load video "${fileName}" - file may be corrupted or unsupported format`, "Import Video")
            console.error(`[ClipForge] Failed to load video ${fileName}:`, e)
          }

          video.load()
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          await reportErrorToClaude(`Error processing file: ${errorMsg}`, "Import Video")
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      await reportErrorToClaude(errorMsg, "Import Video")
    }
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    try {
      const files = e.dataTransfer.files
      if (!files || files.length === 0) {
        // User validation - don't report as error
        console.log("[ClipForge] No files dropped")
        return
      }

      await reportInfoToClaude(`Dropped ${files.length} file(s)`, "Drag and Drop")
      await processVideoFiles(files, { replaceExisting: true })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      await reportErrorToClaude(errorMsg, "Drag and Drop")
    }
  }

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev * 1.5, 200))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev / 1.5, 30))
  }

  const handleZoomToFit = () => {
    if (duration === 0) return
    const targetWidth = 1200
    const newZoom = targetWidth / duration
    setZoom(Math.max(30, Math.min(newZoom, 200)))
  }

  const handleToggleLayers = () => {
    setShowLayers((prev) => !prev)
  }

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const handlePreviousClip = useCallback(() => {
    if (clips.length <= 1) return

    const currentIndex = clips.findIndex((c) => c.id === selectedClipId)
    if (currentIndex > 0) {
      const previousClip = clips[currentIndex - 1]
      setSelectedClipId(previousClip.id)
      setCurrentTime(previousClip.startTime)
      setIsPlaying(false)
    }
  }, [clips, selectedClipId])

  const handleNextClip = useCallback(() => {
    if (clips.length <= 1) return

    const currentIndex = clips.findIndex((c) => c.id === selectedClipId)
    if (currentIndex < clips.length - 1) {
      const nextClip = clips[currentIndex + 1]
      setSelectedClipId(nextClip.id)
      setCurrentTime(nextClip.startTime)
      setIsPlaying(false)
    }
  }, [clips, selectedClipId])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Check if user is typing in an input field
      const target = e.target as HTMLElement
      const isTyping = target.tagName === "INPUT" ||
                      target.tagName === "TEXTAREA" ||
                      target.isContentEditable

      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault()
        setIsPlaying((prev) => !prev)
      }
      if (e.code === "ArrowLeft" && !isTyping) {
        e.preventDefault()
        handlePreviousClip()
      }
      if (e.code === "ArrowRight" && !isTyping) {
        e.preventDefault()
        handleNextClip()
      }
      if (e.code === "KeyI" && !e.ctrlKey && !e.metaKey && !isTyping) {
        e.preventDefault()
        handleSetInPoint()
      }
      if (e.code === "KeyO" && !e.ctrlKey && !e.metaKey && !isTyping) {
        e.preventDefault()
        handleSetOutPoint()
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [duration, selectedClipId, currentTime, clips, handlePreviousClip, handleNextClip])

  const handleSkipBackward = () => {
    setCurrentTime((prev) => Math.max(0, prev - 5))
    setIsPlaying(false)
  }

  const handleSkipForward = () => {
    setCurrentTime((prev) => Math.min(duration, prev + 5))
    setIsPlaying(false)
  }

  const handleSeek = (value: number[]) => {
    setCurrentTime(value[0])
  }

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0])
  }

  const handleSetInPoint = async () => {
    try {
      if (!selectedClipId) {
        // User validation - don't report as error
        console.log("[ClipForge] No clip selected for in point")
        return
      }

      const clip = clips.find((c) => c.id === selectedClipId)
      if (!clip) {
        // Technical error - this shouldn't happen
        await reportErrorToClaude("Selected clip not found in state", "Set In Point")
        return
      }

      const relativeTime = currentTime - clip.startTime
      if (relativeTime < 0 || relativeTime >= clip.trimEnd - clip.trimStart) {
        // User validation - don't report as error
        console.log("[ClipForge] Playhead position is outside clip range")
        return
      }

      const newTrimStart = clip.trimStart + relativeTime
      if (newTrimStart >= clip.trimEnd) {
        // User validation - don't report as error
        console.log("[ClipForge] In point cannot be after out point")
        return
      }

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
      await reportInfoToClaude(`Set in point at ${relativeTime.toFixed(2)}s for "${clip.name}"`, "Set In Point")
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      await reportErrorToClaude(errorMsg, "Set In Point")
    }
  }

  const handleSetOutPoint = async () => {
    try {
      if (!selectedClipId) {
        // User validation - don't report as error
        console.log("[ClipForge] No clip selected for out point")
        return
      }

      const clip = clips.find((c) => c.id === selectedClipId)
      if (!clip) {
        // Technical error - this shouldn't happen
        await reportErrorToClaude("Selected clip not found in state", "Set Out Point")
        return
      }

      const relativeTime = currentTime - clip.startTime
      if (relativeTime <= 0 || relativeTime > clip.trimEnd - clip.trimStart) {
        // User validation - don't report as error
        console.log("[ClipForge] Playhead position is outside clip range")
        return
      }

      const newTrimEnd = clip.trimStart + relativeTime
      if (newTrimEnd <= clip.trimStart) {
        // User validation - don't report as error
        console.log("[ClipForge] Out point cannot be before in point")
        return
      }

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
      await reportInfoToClaude(`Set out point at ${relativeTime.toFixed(2)}s for "${clip.name}"`, "Set Out Point")
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      await reportErrorToClaude(errorMsg, "Set Out Point")
    }
  }

  const handleSplitClip = async () => {
    try {
      if (!selectedClipId) {
        // User validation - don't report as error
        console.log("[ClipForge] No clip selected for split")
        return
      }

      const clip = clips.find((c) => c.id === selectedClipId)
      if (!clip) {
        // Technical error - this shouldn't happen
        await reportErrorToClaude("Selected clip not found in state", "Split Clip")
        return
      }

      const relativeTime = currentTime - clip.startTime
      if (relativeTime <= 0 || relativeTime >= clip.duration) {
        // User validation - don't report as error
        console.log("[ClipForge] Playhead must be within the clip boundaries")
        return
      }

      const firstPart: VideoClip = {
        ...clip,
        id: Math.random().toString(36).substring(2, 11),
        duration: relativeTime,
        trimEnd: clip.trimStart + relativeTime,
      }

      const secondPart: VideoClip = {
        ...clip,
        id: Math.random().toString(36).substring(2, 11),
        startTime: clip.startTime + relativeTime,
        duration: clip.duration - relativeTime,
        trimStart: clip.trimStart + relativeTime,
      }

      setClips((prev) => prev.map((c) => (c.id === selectedClipId ? firstPart : c)).concat(secondPart))
      await reportInfoToClaude(`Split "${clip.name}" at ${relativeTime.toFixed(2)}s`, "Split Clip")
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      await reportErrorToClaude(errorMsg, "Split Clip")
    }
  }

  const handleExport = async () => {
    try {
      if (clips.length === 0) {
        // User validation - don't report as error
        console.log("[ClipForge] No clips to export")
        return
      }

      await reportInfoToClaude(`Opening export dialog with ${clips.length} clip(s)`, "Export")
      setExportDialogOpen(true)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      await reportErrorToClaude(errorMsg, "Export")
    }
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

  const handleLoadSample = async () => {
    try {
      await reportInfoToClaude("Loading sample video", "Load Sample Button")
      await reportButtonClickToClaude("Load Sample", true)

      const sampleUrl = "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4"
      const video = document.createElement("video")
      video.src = sampleUrl
      video.crossOrigin = "anonymous"

      video.onloadedmetadata = async () => {
        console.log("[ClipForge] Sample video loaded successfully, duration:", video.duration)
        const newClip: VideoClip = {
          id: Math.random().toString(36).substring(2, 11),
          name: "Sample Video - Sintel.mp4",
          url: sampleUrl,
          duration: video.duration,
          startTime: duration,
          trimStart: 0,
          trimEnd: video.duration,
          track: 0,
        }

        setClips((prev) => [...prev, newClip])
        setDuration((prev) => prev + video.duration)
        await reportInfoToClaude(`Sample video loaded successfully (${video.duration.toFixed(1)}s)`, "Load Sample")
      }

      video.onerror = async (e) => {
        console.error("[ClipForge] Failed to load sample video:", e)
        await reportErrorToClaude("Failed to load sample video from network, using mock", "Load Sample")

        // Fallback: create a mock clip with placeholder data if video fails to load
        const mockDuration = 30
        const newClip: VideoClip = {
          id: Math.random().toString(36).substring(2, 11),
          name: "Sample Video (Mock).mp4",
          url: "/sample-video-concept.png",
          duration: mockDuration,
          startTime: duration,
          trimStart: 0,
          trimEnd: mockDuration,
          track: 0,
        }

        setClips((prev) => [...prev, newClip])
        setDuration((prev) => prev + mockDuration)
      }

      // Trigger the video to load
      video.load()
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      await reportErrorToClaude(errorMsg, "Load Sample Button")
      await reportButtonClickToClaude("Load Sample", false, errorMsg)
    }
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
        <button
          onClick={() => {
            setClips([])
            setCurrentTime(0)
            setDuration(0)
            setIsPlaying(false)
            setSelectedClipId(null)
          }}
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <img src="/clipforge-logo.png" alt="ClipForge Logo" className="h-8 w-8 object-contain" />
          <h1 className="text-xl font-semibold">ClipForge</h1>
        </button>
        <div className="flex items-center gap-2">
          <Selectable
            id="import-button"
            name="Import Button"
            type="button"
            description="Button to import video files from your computer"
          >
            <Button variant="outline" size="sm" onClick={handleImportVideo}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
          </Selectable>
          <Selectable
            id="load-sample-button"
            name="Load Sample Button"
            type="button"
            description="Button to load a sample video for testing"
          >
            <Button variant="outline" size="sm" onClick={handleLoadSample}>
              <Video className="mr-2 h-4 w-4" />
              Load Sample
            </Button>
          </Selectable>
          <Selectable
            id="export-button"
            name="Export Button"
            type="button"
            description="Button to export the edited video"
          >
            <Button size="sm" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </Selectable>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Toolbar
          onSplit={handleSplitClip}
          selectedClipId={selectedClipId}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onToggleLayers={handleToggleLayers}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          <Selectable
            id="video-preview"
            name="Video Preview"
            type="component"
            description="Main video preview area showing the current frame of the timeline"
            className="flex-1 min-h-0 overflow-auto"
          >
            <VideoPreview
              clips={clips}
              currentTime={currentTime}
              isPlaying={isPlaying}
              volume={volume}
              playbackSpeed={playbackSpeed}
              onTimeUpdate={setCurrentTime}
            />
          </Selectable>

          <div className="border-t border-border bg-card p-4 flex-shrink-0">
            <div className="mb-4 flex items-center gap-4">
              <Selectable
                id="previous-clip-button"
                name="Previous Clip Button"
                type="button"
                description="Navigate to the previous clip in the timeline"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePreviousClip}
                  disabled={clips.length <= 1}
                  title="Previous Clip"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              </Selectable>

              <Selectable
                id="skip-back-button"
                name="Skip Back Button"
                type="button"
                description="Skip backward 5 seconds in the video"
              >
                <Button variant="ghost" size="icon" onClick={handleSkipBackward} title="Skip Back 5s">
                  <SkipBack className="h-5 w-5" />
                </Button>
              </Selectable>

              <Selectable
                id="play-pause-button"
                name="Play/Pause Button"
                type="button"
                description="Toggle video playback (keyboard shortcut: Space)"
              >
                <Button size="icon" onClick={handlePlayPause} title="Play/Pause (Space)">
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>
              </Selectable>

              <Selectable
                id="skip-forward-button"
                name="Skip Forward Button"
                type="button"
                description="Skip forward 5 seconds in the video"
              >
                <Button variant="ghost" size="icon" onClick={handleSkipForward} title="Skip Forward 5s">
                  <SkipForward className="h-5 w-5" />
                </Button>
              </Selectable>

              <Selectable
                id="next-clip-button"
                name="Next Clip Button"
                type="button"
                description="Navigate to the next clip in the timeline"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNextClip}
                  disabled={clips.length <= 1}
                  title="Next Clip"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </Selectable>

              <div className="mx-2 h-6 w-px bg-border" />

              <Selectable
                id="set-in-point-button"
                name="Set In Point Button"
                type="button"
                description="Set the in point (start) for trimming the selected clip (keyboard shortcut: I)"
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSetInPoint}
                  disabled={!selectedClipId}
                  title="Set In Point (I)"
                >
                  [ In
                </Button>
              </Selectable>

              <Selectable
                id="set-out-point-button"
                name="Set Out Point Button"
                type="button"
                description="Set the out point (end) for trimming the selected clip (keyboard shortcut: O)"
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSetOutPoint}
                  disabled={!selectedClipId}
                  title="Set Out Point (O)"
                >
                  Out ]
                </Button>
              </Selectable>

              <Selectable
                id="playback-speed-dropdown"
                name="Playback Speed Dropdown"
                type="dropdown"
                description="Control video playback speed from 0.25x to 2x"
              >
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
              </Selectable>

              <Selectable
                id="timeline-scrubber"
                name="Timeline Scrubber"
                type="slider"
                description="Video timeline scrubber to navigate through the video"
                className="flex flex-1 items-center gap-2"
              >
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
              </Selectable>

              <Selectable
                id="volume-control"
                name="Volume Control"
                type="slider"
                description="Adjust video playback volume"
              >
                <div className="flex items-center gap-2">
                  <Volume2 className="h-5 w-5 text-muted-foreground" />
                  <Slider value={[volume]} max={100} step={1} onValueChange={handleVolumeChange} className="w-24" />
                </div>
              </Selectable>
            </div>
          </div>

          <Selectable
            id="timeline"
            name="Timeline"
            type="component"
            description="Video timeline showing all clips, allowing trimming and clip selection"
            className="flex-shrink-0"
          >
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
          </Selectable>

        </div>
      </div>

      {/* Interactive Terminal - Fixed at bottom */}
      <InteractiveTerminal />

      <ExportDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen} clips={clips} />
    </div>
  )
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}
