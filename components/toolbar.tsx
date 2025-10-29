"use client"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Scissors, Copy, Trash2, RotateCcw, RotateCw, ZoomIn, ZoomOut, Layers } from "lucide-react"
import { Selectable } from "@/components/selectable"

interface ToolbarProps {
  onSplit: () => void
  selectedClipId: string | null
  onZoomIn?: () => void
  onZoomOut?: () => void
  onToggleLayers?: () => void
}

export default function Toolbar({ onSplit, selectedClipId, onZoomIn, onZoomOut, onToggleLayers }: ToolbarProps) {
  return (
    <div className="flex w-16 flex-col items-center gap-2 border-r border-border bg-card py-4">
      <Selectable
        id="split-clip-button"
        name="Split Clip Button"
        type="button"
        description="Split the selected clip at the current playhead position"
      >
        <Button variant="ghost" size="icon" onClick={onSplit} disabled={!selectedClipId} title="Split clip">
          <Scissors className="h-5 w-5" />
        </Button>
      </Selectable>

      <Selectable
        id="copy-clip-button"
        name="Copy Clip Button"
        type="button"
        description="Copy the selected clip"
      >
        <Button variant="ghost" size="icon" disabled={!selectedClipId} title="Copy clip">
          <Copy className="h-5 w-5" />
        </Button>
      </Selectable>

      <Selectable
        id="delete-clip-button"
        name="Delete Clip Button"
        type="button"
        description="Delete the selected clip from the timeline"
      >
        <Button variant="ghost" size="icon" disabled={!selectedClipId} title="Delete clip">
          <Trash2 className="h-5 w-5" />
        </Button>
      </Selectable>

      <Separator className="my-2 w-8" />

      <Selectable
        id="undo-button"
        name="Undo Button"
        type="button"
        description="Undo the last action"
      >
        <Button variant="ghost" size="icon" title="Undo">
          <RotateCcw className="h-5 w-5" />
        </Button>
      </Selectable>

      <Selectable
        id="redo-button"
        name="Redo Button"
        type="button"
        description="Redo the last undone action"
      >
        <Button variant="ghost" size="icon" title="Redo">
          <RotateCw className="h-5 w-5" />
        </Button>
      </Selectable>

      <Separator className="my-2 w-8" />

      <Selectable
        id="zoom-in-button"
        name="Zoom In Button"
        type="button"
        description="Zoom in on the timeline"
      >
        <Button variant="ghost" size="icon" onClick={onZoomIn} title="Zoom in">
          <ZoomIn className="h-5 w-5" />
        </Button>
      </Selectable>

      <Selectable
        id="zoom-out-button"
        name="Zoom Out Button"
        type="button"
        description="Zoom out on the timeline"
      >
        <Button variant="ghost" size="icon" onClick={onZoomOut} title="Zoom out">
          <ZoomOut className="h-5 w-5" />
        </Button>
      </Selectable>

      <Selectable
        id="layers-button"
        name="Layers Button"
        type="button"
        description="Toggle layers panel"
      >
        <Button variant="ghost" size="icon" onClick={onToggleLayers} title="Layers">
          <Layers className="h-5 w-5" />
        </Button>
      </Selectable>
    </div>
  )
}
