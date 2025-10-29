"use client"

import type React from "react"

import { useRef, useState, useEffect } from "react"
import type { VideoClip } from "@/components/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react"

interface TimelineProps {
  clips: VideoClip[]
  currentTime: number
  duration: number
  selectedClipId: string | null
  zoom: number
  onClipSelect: (id: string | null) => void
  onClipsUpdate: (clips: VideoClip[]) => void
  onTimeUpdate: (time: number) => void
  onTrimUpdate: (clipId: string, trimStart: number, trimEnd: number) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomToFit: () => void
}

export default function Timeline({
  clips,
  currentTime,
  duration,
  selectedClipId,
  zoom,
  onClipSelect,
  onClipsUpdate,
  onTimeUpdate,
  onTrimUpdate,
  onZoomIn,
  onZoomOut,
  onZoomToFit,
}: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [draggedClipId, setDraggedClipId] = useState<string | null>(null)
  const [trimDragState, setTrimDragState] = useState<{
    clipId: string
    handle: "start" | "end"
    originalTrimStart: number
    originalTrimEnd: number
  } | null>(null)

  const pixelsPerSecond = zoom
  const timelineWidth = Math.max(duration * pixelsPerSecond, 1000)

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return
    const rect = timelineRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft
    const time = x / pixelsPerSecond
    onTimeUpdate(Math.max(0, Math.min(time, duration)))
  }

  const handleClipMouseDown = (e: React.MouseEvent, clipId: string) => {
    e.stopPropagation()
    setIsDragging(true)
    setDraggedClipId(clipId)
    onClipSelect(clipId)
  }

  const handleTrimHandleMouseDown = (e: React.MouseEvent, clipId: string, handle: "start" | "end", clip: VideoClip) => {
    e.stopPropagation()
    onClipSelect(clipId)
    setTrimDragState({
      clipId,
      handle,
      originalTrimStart: clip.trimStart,
      originalTrimEnd: clip.trimEnd,
    })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!timelineRef.current) return

    const rect = timelineRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft

    if (trimDragState) {
      const clip = clips.find((c) => c.id === trimDragState.clipId)
      if (!clip) return

      const deltaTime = x / pixelsPerSecond - clip.startTime

      if (trimDragState.handle === "start") {
        const newTrimStart = Math.max(
          0,
          Math.min(trimDragState.originalTrimStart + deltaTime, trimDragState.originalTrimEnd - 0.1),
        )
        onTrimUpdate(trimDragState.clipId, newTrimStart, trimDragState.originalTrimEnd)
      } else {
        const newTrimEnd = Math.max(trimDragState.originalTrimStart + 0.1, trimDragState.originalTrimStart + deltaTime)
        onTrimUpdate(trimDragState.clipId, trimDragState.originalTrimStart, newTrimEnd)
      }
      return
    }

    if (isDragging && draggedClipId) {
      const newStartTime = Math.max(0, x / pixelsPerSecond)
      onClipsUpdate(clips.map((clip) => (clip.id === draggedClipId ? { ...clip, startTime: newStartTime } : clip)))
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setDraggedClipId(null)
    setTrimDragState(null)
  }

  useEffect(() => {
    if (isDragging || trimDragState) {
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
      return () => {
        window.removeEventListener("mousemove", handleMouseMove)
        window.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [isDragging, draggedClipId, trimDragState, clips])

  return (
    <div className="h-64 border-t border-border bg-[var(--color-timeline-bg)]">
      <div className="flex h-full flex-col">
        {/* Timeline Header */}
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
          <h3 className="text-sm font-medium">Timeline</h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomOut} title="Zoom Out">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomToFit} title="Zoom to Fit">
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomIn} title="Zoom In">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <div className="mx-2 h-4 w-px bg-border" />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {clips.length} clip{clips.length !== 1 ? "s" : ""}
              </span>
              <span>•</span>
              <span>{Math.round(zoom)}px/s</span>
            </div>
          </div>
        </div>

        {/* Timeline Content */}
        <div
          ref={timelineRef}
          className="relative flex-1 overflow-x-auto overflow-y-hidden"
          onClick={handleTimelineClick}
        >
          {/* Time Ruler */}
          <div className="sticky top-0 z-10 flex h-8 border-b border-border bg-[var(--color-timeline-track)]">
            {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
              <div key={i} className="absolute flex flex-col items-start" style={{ left: `${i * pixelsPerSecond}px` }}>
                <div className="h-2 w-px bg-border" />
                <span className="ml-1 text-xs text-muted-foreground">{i}s</span>
              </div>
            ))}
          </div>

          {/* Track */}
          <div className="relative h-20 bg-[var(--color-timeline-track)]" style={{ width: `${timelineWidth}px` }}>
            {clips.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                Import or drag & drop videos to get started
              </div>
            )}

            {clips.map((clip) => {
              const visualDuration = clip.trimEnd - clip.trimStart
              const clipWidth = visualDuration * pixelsPerSecond
              const minWidth = 20
              const showText = clipWidth >= 80

              return (
                <div
                  key={clip.id}
                  className={cn(
                    "absolute top-2 h-16 cursor-move overflow-hidden rounded border-2 transition-all",
                    selectedClipId === clip.id ? "border-primary ring-2 ring-primary/50" : "border-primary/50",
                  )}
                  style={{
                    left: `${clip.startTime * pixelsPerSecond}px`,
                    width: `${Math.max(clipWidth, minWidth)}px`,
                  }}
                  onMouseDown={(e) => handleClipMouseDown(e, clip.id)}
                  onClick={(e) => {
                    e.stopPropagation()
                    onClipSelect(clip.id)
                  }}
                >
                  <div className="relative flex h-full flex-col justify-center bg-primary/80 px-2 hover:bg-primary">
                    {showText && (
                      <>
                        <span className="truncate text-xs font-medium text-primary-foreground">{clip.name}</span>
                        <span className="text-xs text-primary-foreground/70">{visualDuration.toFixed(1)}s</span>
                      </>
                    )}
                  </div>

                  <div
                    className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-primary-foreground/30 hover:bg-primary-foreground/50"
                    onMouseDown={(e) => handleTrimHandleMouseDown(e, clip.id, "start", clip)}
                    title="Drag to trim start"
                  />
                  <div
                    className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-primary-foreground/30 hover:bg-primary-foreground/50"
                    onMouseDown={(e) => handleTrimHandleMouseDown(e, clip.id, "end", clip)}
                    title="Drag to trim end"
                  />
                </div>
              )
            })}

            {/* Playhead */}
            <div
              className="absolute top-0 h-full w-0.5 bg-[var(--color-playhead)] shadow-lg"
              style={{ left: `${currentTime * pixelsPerSecond}px` }}
            >
              <div className="absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-[var(--color-playhead)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
