"use client"

import { Button } from "@/components/ui/button"
import { Circle, Square } from "lucide-react"

interface RecordingControlsProps {
  isRecording: boolean
  recordingType: string | null
  recordingDuration: number
  onStop: () => void
}

export default function RecordingControls({
  isRecording,
  recordingType,
  recordingDuration,
  onStop,
}: RecordingControlsProps) {
  if (!isRecording) return null

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full bg-red-500 px-6 py-3 shadow-lg">
      <Circle className="h-4 w-4 fill-white text-white animate-pulse" />
      <span className="text-sm font-medium text-white">
        Recording {recordingType} - {formatDuration(recordingDuration)}
      </span>
      <Button size="sm" variant="secondary" onClick={onStop} className="rounded-full">
        <Square className="mr-2 h-4 w-4" />
        Stop
      </Button>
    </div>
  )
}
