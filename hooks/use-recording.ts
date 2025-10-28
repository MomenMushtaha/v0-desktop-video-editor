"use client"

import { useState, useRef, useCallback } from "react"

export type RecordingType = "screen" | "webcam" | "screen-webcam"

interface UseRecordingReturn {
  isRecording: boolean
  recordingType: RecordingType | null
  recordingDuration: number
  startRecording: (type: RecordingType) => Promise<void>
  stopRecording: () => Promise<Blob | null>
  error: string | null
}

export function useRecording(): UseRecordingReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingType, setRecordingType] = useState<RecordingType | null>(null)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const startRecording = useCallback(async (type: RecordingType) => {
    try {
      setError(null)
      let stream: MediaStream

      if (type === "screen") {
        // Request screen capture
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            mediaSource: "screen",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: true,
        })
      } else if (type === "webcam") {
        // Request webcam
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: true,
        })
      } else {
        // screen-webcam: Combine both streams
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            mediaSource: "screen",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: true,
        })
        const webcamStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        })

        // For now, just use screen stream (PiP implementation would require canvas compositing)
        stream = screenStream
      }

      streamRef.current = stream

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
      })

      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.start(1000) // Collect data every second
      mediaRecorderRef.current = mediaRecorder

      setIsRecording(true)
      setRecordingType(type)
      setRecordingDuration(0)

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1)
      }, 1000)

      // Handle stream ending (user clicks "Stop sharing" in browser)
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        stopRecording()
      })
    } catch (err) {
      console.error("[v0] Recording error:", err)
      setError(err instanceof Error ? err.message : "Failed to start recording")
    }
  }, [])

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !isRecording) {
        resolve(null)
        return
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" })

        // Cleanup
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop())
          streamRef.current = null
        }
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }

        setIsRecording(false)
        setRecordingType(null)
        setRecordingDuration(0)
        chunksRef.current = []
        mediaRecorderRef.current = null

        resolve(blob)
      }

      mediaRecorderRef.current.stop()
    })
  }, [isRecording])

  return {
    isRecording,
    recordingType,
    recordingDuration,
    startRecording,
    stopRecording,
    error,
  }
}
