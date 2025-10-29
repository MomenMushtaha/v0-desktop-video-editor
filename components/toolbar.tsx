"use client"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Scissors, Copy, Trash2, RotateCcw, RotateCw } from "lucide-react"
import { Selectable } from "@/components/selectable"

interface ToolbarProps {
  onSplit: () => void
  onCopy: () => void | Promise<void>
  onDelete: () => void | Promise<void>
  selectedClipId: string | null
}

export default function Toolbar({ onSplit, onCopy, onDelete, selectedClipId }: ToolbarProps) {
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
        <Button
          variant="ghost"
          size="icon"
          disabled={!selectedClipId}
          title="Copy clip (Cmd+C)"
          onClick={() => {
            void onCopy()
          }}
        >
          <Copy className="h-5 w-5" />
        </Button>
      </Selectable>

      <Selectable
        id="delete-clip-button"
        name="Delete Clip Button"
        type="button"
        description="Delete the selected clip from the timeline"
      >
        <Button
          variant="ghost"
          size="icon"
          disabled={!selectedClipId}
          title="Delete clip (Backspace)"
          onClick={() => {
            void onDelete()
          }}
        >
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

    </div>
  )
}
