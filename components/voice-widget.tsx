"use client"

import { useEffect } from "react"

export function VoiceWidget() {
  useEffect(() => {
    const widget = document.createElement("dq-voice")
    widget.setAttribute("agent-id", process.env.NEXT_PUBLIC_VOICEHUB_AGENT_ID || "")
    widget.setAttribute("api-key", process.env.NEXT_PUBLIC_VOICEHUB_API_KEY || "")
    widget.setAttribute("type", "WebAudio")

    // Append to body
    document.body.appendChild(widget)

    // Load the widget script
    const script = document.createElement("script")
    script.src = "https://voicehub.dataqueue.ai/DqVoiceWidget.js"
    script.async = true

    script.onload = () => {

      setTimeout(() => {
        const dqWidget = document.querySelector("dq-voice") as any
        if (dqWidget) {
          console.log("Widget initialized successfully")
        }
      }, 500)
    }

    script.onerror = () => {
      console.log("ERROR: Failed to load widget script")
    }

    document.body.appendChild(script)

    // Cleanup function
    return () => {
      console.log("VoiceWidget component unmounting")
      if (widget && widget.parentNode) {
        widget.parentNode.removeChild(widget)
      }
      if (script && script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [])

  return null
}
