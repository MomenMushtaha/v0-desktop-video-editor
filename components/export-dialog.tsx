"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, CheckCircle2, Loader2 } from "lucide-react"
import type { VideoClip } from "./video-editor"

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clips: VideoClip[]
}

export default function ExportDialog({ open, onOpenChange, clips }: ExportDialogProps) {
  const [filename, setFilename] = useState("output.mp4")
  const [resolution, setResolution] = useState("1080p")
  const [quality, setQuality] = useState("high")
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportComplete, setExportComplete] = useState(false)

  const handleExport = () => {
    setIsExporting(true)
    setExportProgress(0)

    // Simulate export progress
    const interval = setInterval(() => {
      setExportProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsExporting(false)
          setExportComplete(true)
          return 100
        }
        return prev + 10
      })
    }, 300)
  }

  const handleClose = () => {
    setExportProgress(0)
    setExportComplete(false)
    setIsExporting(false)
    onOpenChange(false)
  }

  const getResolutionDimensions = () => {
    switch (resolution) {
      case "2160p":
        return "3840x2160"
      case "1080p":
        return "1920x1080"
      case "720p":
        return "1280x720"
      case "480p":
        return "854x480"
      default:
        return "original"
    }
  }

  const getQualityBitrate = () => {
    switch (quality) {
      case "high":
        return "8M"
      case "medium":
        return "4M"
      case "low":
        return "2M"
      default:
        return "4M"
    }
  }

  const generateFFmpegCommand = () => {
    const inputs = clips.map((clip, i) => `-i "${clip.name}"`).join(" ")
    const filters = clips
      .map((clip, i) => {
        const trimFilter = `[${i}:v]trim=start=${clip.trimStart}:end=${clip.trimEnd},setpts=PTS-STARTPTS[v${i}]`
        return trimFilter
      })
      .join("; ")
    const concat = `${clips.map((_, i) => `[v${i}]`).join("")}concat=n=${clips.length}:v=1:a=0[outv]`

    return `ffmpeg ${inputs} -filter_complex "${filters}; ${concat}" -map "[outv]" -c:v libx264 -preset medium -b:v ${getQualityBitrate()} -s ${getResolutionDimensions()} "${filename}"`
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Export Video</DialogTitle>
          <DialogDescription>Configure your export settings and render your final video.</DialogDescription>
        </DialogHeader>

        {!exportComplete ? (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="filename">Output Filename</Label>
              <Input
                id="filename"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="output.mp4"
                disabled={isExporting}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="resolution">Resolution</Label>
                <Select value={resolution} onValueChange={setResolution} disabled={isExporting}>
                  <SelectTrigger id="resolution">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2160p">4K (2160p)</SelectItem>
                    <SelectItem value="1080p">Full HD (1080p)</SelectItem>
                    <SelectItem value="720p">HD (720p)</SelectItem>
                    <SelectItem value="480p">SD (480p)</SelectItem>
                    <SelectItem value="original">Original</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quality">Quality</Label>
                <Select value={quality} onValueChange={setQuality} disabled={isExporting}>
                  <SelectTrigger id="quality">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High (8 Mbps)</SelectItem>
                    <SelectItem value="medium">Medium (4 Mbps)</SelectItem>
                    <SelectItem value="low">Low (2 Mbps)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>FFmpeg Command (for Electron integration)</Label>
              <div className="rounded-md bg-muted p-3">
                <code className="text-xs text-muted-foreground">{generateFFmpegCommand()}</code>
              </div>
            </div>

            {isExporting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Exporting...</span>
                  <span className="font-medium">{exportProgress}%</span>
                </div>
                <Progress value={exportProgress} />
              </div>
            )}
          </div>
        ) : (
          <div className="py-8">
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-500">
                Export complete! In the full Electron app, your video would be saved to the selected location.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          {!exportComplete ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isExporting}>
                Cancel
              </Button>
              <Button onClick={handleExport} disabled={isExporting || clips.length === 0}>
                {isExporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export Video
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
