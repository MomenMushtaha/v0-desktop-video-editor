"use client"

import type React from "react"

import { useCallback, useEffect, useRef, useState } from "react"
import type { VideoClip } from "@/components/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react"
import { Selectable } from "@/components/selectable"

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
  onTrimmingModeChange: (isTrimming: boolean) => void
}

const MIN_TIMELINE_WIDTH = 640
const MIN_CLIP_WIDTH = 56
const FULL_LABEL_THRESHOLD = 120
const DURATION_ONLY_THRESHOLD = 80
const MIN_TRIM_GAP = 0.1

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
  onTrimmingModeChange,
}: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [isDraggingClip, setIsDraggingClip] = useState(false)
  const [draggedClipId, setDraggedClipId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false)
  const [trimDragState, setTrimDragState] = useState<{
    clipId: string
    handle: "start" | "end"
    originalTrimStart: number
    originalTrimEnd: number
    startX: number
    handlePositionX: number
  } | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!timelineRef.current) return

    const element = timelineRef.current

    const updateWidth = () => setViewportWidth(element.clientWidth)
    updateWidth()

    let observer: ResizeObserver | undefined
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => updateWidth())
      observer.observe(element)
    }

    window.addEventListener("resize", updateWidth)

    return () => {
      observer?.disconnect()
      window.removeEventListener("resize", updateWidth)
    }
  }, [])

  const pixelsPerSecond = zoom
  const timelineWidth = Math.max(duration * pixelsPerSecond, viewportWidth, MIN_TIMELINE_WIDTH)

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return
    const rect = timelineRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft
    const time = x / pixelsPerSecond
    onTimeUpdate(Math.max(0, Math.min(time, duration)))
  }

  const handleClipMouseDown = (e: React.MouseEvent, clipId: string) => {
    e.stopPropagation()

    if (!timelineRef.current) return

    const clip = clips.find((c) => c.id === clipId)
    if (!clip) return

    const rect = timelineRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left + timelineRef.current.scrollLeft
    const clipLeftEdge = clip.startTime * pixelsPerSecond
    const offset = clickX - clipLeftEdge

    setDragOffset(offset)
    setIsDraggingClip(true)
    setDraggedClipId(clipId)
    onClipSelect(clipId)
  }

  const handleTrimHandleMouseDown = (e: React.MouseEvent, clipId: string, handle: "start" | "end", clip: VideoClip) => {
    e.stopPropagation()
    if (!timelineRef.current) return

    onClipSelect(clipId)
    onTrimmingModeChange(true)

    const rect = timelineRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left + timelineRef.current.scrollLeft

    setTrimDragState({
      clipId,
      handle,
      originalTrimStart: clip.trimStart,
      originalTrimEnd: clip.trimEnd,
      startX: mouseX,
      handlePositionX: mouseX,
    })
  }

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!timelineRef.current) return

      const rect = timelineRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left + timelineRef.current.scrollLeft

      if (trimDragState) {
        const clip = clips.find((c) => c.id === trimDragState.clipId)
        if (!clip) return

        const deltaX = x - trimDragState.startX
        const deltaTime = deltaX / pixelsPerSecond

        if (trimDragState.handle === "start") {
          const newTrimStart = Math.max(0, Math.min(trimDragState.originalTrimStart + deltaTime, trimDragState.originalTrimEnd - MIN_TRIM_GAP))
          onTrimUpdate(trimDragState.clipId, newTrimStart, trimDragState.originalTrimEnd)
        } else {
          const newTrimEnd = Math.max(trimDragState.originalTrimStart + MIN_TRIM_GAP, Math.min(trimDragState.originalTrimEnd + deltaTime, clip.duration))
          onTrimUpdate(trimDragState.clipId, trimDragState.originalTrimStart, newTrimEnd)
        }
        return
      }

      if (isDraggingPlayhead) {
        const time = x / pixelsPerSecond
        onTimeUpdate(Math.max(0, Math.min(time, duration)))
        return
      }

      if (isDraggingClip && draggedClipId) {
        const newStartTime = Math.max(0, (x - dragOffset) / pixelsPerSecond)
        onClipsUpdate(clips.map((clip) => (clip.id === draggedClipId ? { ...clip, startTime: newStartTime } : clip)))
      }
    },
    [clips, draggedClipId, dragOffset, duration, isDraggingClip, isDraggingPlayhead, onClipsUpdate, onTimeUpdate, onTrimUpdate, pixelsPerSecond, trimDragState],
  )

  const handleMouseUp = useCallback(() => {
    setIsDraggingClip(false)
    setDraggedClipId(null)
    setIsDraggingPlayhead(false)
    if (trimDragState) {
      onTrimmingModeChange(false)
    }
    setTrimDragState(null)
  }, [trimDragState, onTrimmingModeChange])

  useEffect(() => {
    if (!isDraggingClip && !isDraggingPlayhead && !trimDragState) {
      return
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp, isDraggingClip, isDraggingPlayhead, trimDragState])

  return (
    <div className="h-[clamp(12rem,32vh,17rem)] border-t border-border bg-[var(--color-timeline-bg)]">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
          <h3 className="text-sm font-medium">Timeline</h3>
          <div className="flex items-center gap-2">
            <Selectable
              id="timeline-zoom-out-button"
              name="Timeline Zoom Out Button"
              type="button"
              description="Zoom out on the timeline"
            >
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomOut} title="Zoom Out">
                <ZoomOut className="h-4 w-4" />
              </Button>
            </Selectable>
            <Selectable
              id="timeline-zoom-to-fit-button"
              name="Timeline Zoom to Fit Button"
              type="button"
              description="Zoom timeline to fit all clips"
            >
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomToFit} title="Zoom to Fit">
                <Maximize2 className="h-4 w-4" />
              </Button>
            </Selectable>
            <Selectable
              id="timeline-zoom-in-button"
              name="Timeline Zoom In Button"
              type="button"
              description="Zoom in on the timeline"
            >
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomIn} title="Zoom In">
                <ZoomIn className="h-4 w-4" />
              </Button>
            </Selectable>
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

        <div
          ref={timelineRef}
          className="relative flex-1 overflow-x-auto overflow-y-hidden"
          onClick={handleTimelineClick}
        >
          <div className="sticky top-0 z-10 flex h-8 border-b border-border bg-[var(--color-timeline-track)]">
            {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
              <div key={i} className="absolute flex flex-col items-start" style={{ left: `${i * pixelsPerSecond}px` }}>
                <div className="h-2 w-px bg-border" />
                <span className="ml-1 text-xs text-muted-foreground">{i}s</span>
              </div>
            ))}
          </div>

          <div className="relative h-[clamp(3.5rem,8vh,5rem)] bg-[var(--color-timeline-track)]" style={{ width: `${timelineWidth}px` }}>
            {clips.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                Import or drag &amp; drop videos to get started
              </div>
            )}

            {clips.map((clip) => {
              const trimmedDuration = Math.max(clip.trimEnd - clip.trimStart, MIN_TRIM_GAP)
              const rawTotalWidth = clip.duration * pixelsPerSecond
              const totalWidth = Math.max(rawTotalWidth, MIN_CLIP_WIDTH)
              const widthScale = rawTotalWidth > 0 ? totalWidth / rawTotalWidth : 1
              const scaledTrimStart = clip.trimStart * pixelsPerSecond * widthScale
              const computedActiveWidth = Math.max((clip.trimEnd - clip.trimStart) * pixelsPerSecond * widthScale, 6)
              const clampedActiveWidth = Math.min(computedActiveWidth, totalWidth)
              const showFullLabel = clampedActiveWidth >= FULL_LABEL_THRESHOLD
              const showDuration = clampedActiveWidth >= DURATION_ONLY_THRESHOLD
              const isSelected = selectedClipId === clip.id

              const startTrimWidth = Math.max(0, Math.min(scaledTrimStart, totalWidth))
              const activeLeft = Math.max(0, Math.min(startTrimWidth, totalWidth - clampedActiveWidth))
              const endTrimWidth = Math.max(0, totalWidth - (activeLeft + clampedActiveWidth))

              return (
                <div
                  key={clip.id}
                  className={cn(
                    "absolute inset-y-[0.45rem] select-none overflow-visible rounded-lg border border-white/10 bg-slate-900/50 shadow transition-all duration-150 ease-out",
                    "cursor-move",
                    isSelected
                      ? "ring-2 ring-blue-500 shadow-lg shadow-blue-500/25"
                      : "ring-1 ring-transparent hover:border-white/20 hover:shadow-lg",
                  )}
                  style={{
                    left: `${clip.startTime * pixelsPerSecond}px`,
                    width: `${totalWidth}px`,
                  }}
                  onMouseDown={(e) => handleClipMouseDown(e, clip.id)}
                  onClick={(e) => {
                    e.stopPropagation()
                    onClipSelect(clip.id)
                  }}
                >
                  <div className="relative h-full w-full">
                    {startTrimWidth > 0 && (
                      <div
                        className="absolute inset-y-0 left-0 rounded-l-lg border-r border-white/10 bg-white/5"
                        style={{
                          width: `${startTrimWidth}px`,
                          backgroundImage:
                            "repeating-linear-gradient(135deg, transparent, transparent 6px, rgba(255,255,255,0.12) 6px, rgba(255,255,255,0.12) 12px)",
                        }}
                      />
                    )}

                    {endTrimWidth > 0 && (
                      <div
                        className="absolute inset-y-0 right-0 rounded-r-lg border-l border-white/10 bg-white/5"
                        style={{
                          width: `${endTrimWidth}px`,
                          backgroundImage:
                            "repeating-linear-gradient(135deg, transparent, transparent 6px, rgba(255,255,255,0.12) 6px, rgba(255,255,255,0.12) 12px)",
                        }}
                      />
                    )}

                    <div
                      className={cn(
                        "absolute top-1/2 flex h-[calc(100%-0.5rem)] -translate-y-1/2 flex-col justify-center rounded-md border border-white/20 bg-gradient-to-r from-blue-600/90 via-blue-500/80 to-blue-400/80 px-2 py-1.5 sm:px-3 sm:py-2",
                        isSelected ? "shadow-lg shadow-blue-500/25" : "shadow",
                      )}
                      style={{
                        left: `${activeLeft}px`,
                        width: `${clampedActiveWidth}px`,
                      }}
                    >
                      <div className="relative z-10 flex flex-col gap-1 text-white">
                        <span
                          className={cn(
                            "truncate text-[0.7rem] font-semibold drop-shadow-sm sm:text-xs",
                            !showFullLabel && "uppercase tracking-wide text-white/90",
                          )}
                          title={clip.name}
                        >
                          {clip.name}
                        </span>
                        {showDuration ? (
                          <span className="text-[0.65rem] font-medium text-white/80 sm:text-[0.7rem]">
                            {trimmedDuration.toFixed(1)}s
                          </span>
                        ) : (
                          <div className="flex items-center gap-1 text-[0.65rem] font-medium text-white/80">
                            <span className="inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-white/75" />
                            {trimmedDuration.toFixed(1)}s
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      className={cn(
                        "absolute top-1/2 flex h-[70%] w-4 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white/10 transition-colors duration-150 hover:bg-white/25",
                        isSelected && "bg-white/20",
                      )}
                      style={{ left: `${activeLeft}px`, transform: "translate(-50%, -50%)" }}
                      onMouseDown={(e) => handleTrimHandleMouseDown(e, clip.id, "start", clip)}
                      title="Drag to trim start"
                    >
                      <span className="h-6 w-[3px] rounded-full bg-white/80 sm:h-7" />
                    </div>
                    <div
                      className={cn(
                        "absolute top-1/2 flex h-[70%] w-4 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white/10 transition-colors duration-150 hover:bg-white/25",
                        isSelected && "bg-white/20",
                      )}
                      style={{ left: `${activeLeft + clampedActiveWidth}px`, transform: "translate(-50%, -50%)" }}
                      onMouseDown={(e) => handleTrimHandleMouseDown(e, clip.id, "end", clip)}
                      title="Drag to trim end"
                    >
                      <span className="h-6 w-[3px] rounded-full bg-white/80 sm:h-7" />
                    </div>
                  </div>
                </div>
              )
            })}

            <div
              className="absolute top-0 z-20 flex h-full -translate-x-1/2 items-center pointer-events-none"
              style={{ left: `${currentTime * pixelsPerSecond}px` }}
            >
              <div
                className="flex h-full flex-col items-center pointer-events-auto cursor-ew-resize"
                onMouseDown={(e) => {
                  e.stopPropagation()
                  setIsDraggingPlayhead(true)
                }}
              >
                <div className="h-4 w-4 rounded-full border-2 border-background bg-[var(--color-playhead)] shadow-md transition-transform duration-150 ease-out" />
                <div className="flex-1 w-[3px] bg-[var(--color-playhead)] shadow-lg" />
              </div>
            </div>
            <div
              className="absolute top-0 z-10 h-full w-10 cursor-ew-resize"
              style={{ left: `${currentTime * pixelsPerSecond - 20}px` }}
              onMouseDown={(e) => {
                e.stopPropagation()
                setIsDraggingPlayhead(true)
              }}
              title="Drag to scrub timeline"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
