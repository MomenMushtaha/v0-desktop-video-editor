"use client"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Scissors, Copy, Trash2, RotateCcw, RotateCw, ZoomIn, ZoomOut, Layers } from "lucide-react"

interface ToolbarProps {
  onSplit: () => void
  selectedClipId: string | null
}

export default function Toolbar({ onSplit, selectedClipId }: ToolbarProps) {
  return (
    <div className="flex w-16 flex-col items-center gap-2 border-r border-border bg-card py-4">
      <Button variant="ghost" size="icon" onClick={onSplit} disabled={!selectedClipId} title="Split clip">
        <Scissors className="h-5 w-5" />
      </Button>
      <Button variant="ghost" size="icon" disabled={!selectedClipId} title="Copy clip">
        <Copy className="h-5 w-5" />
      </Button>
      <Button variant="ghost" size="icon" disabled={!selectedClipId} title="Delete clip">
        <Trash2 className="h-5 w-5" />
      </Button>
      <Separator className="my-2 w-8" />
      <Button variant="ghost" size="icon" title="Undo">
        <RotateCcw className="h-5 w-5" />
      </Button>
      <Button variant="ghost" size="icon" title="Redo">
        <RotateCw className="h-5 w-5" />
      </Button>
      <Separator className="my-2 w-8" />
      <Button variant="ghost" size="icon" title="Zoom in">
        <ZoomIn className="h-5 w-5" />
      </Button>
      <Button variant="ghost" size="icon" title="Zoom out">
        <ZoomOut className="h-5 w-5" />
      </Button>
      <Button variant="ghost" size="icon" title="Layers">
        <Layers className="h-5 w-5" />
      </Button>
    </div>
  )
}
