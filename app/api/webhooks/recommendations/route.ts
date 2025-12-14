import { type NextRequest, NextResponse } from "next/server"

// Store recent webhooks in memory (last 50)
const recentWebhooks: Array<{
  timestamp: string
  headers: Record<string, string>
  body: any
}> = []

const MAX_WEBHOOKS = 50

export async function POST(request: NextRequest) {
  try {
    console.log("===== VOICEHUB WEBHOOK RECEIVED =====")
    console.log("Timestamp:", new Date().toISOString())

    // Log all headers
    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      headers[key] = value
    })
    console.log("Headers:", JSON.stringify(headers, null, 2))

    // Parse and log the body
    const body = await request.json()
    console.log("Body:", JSON.stringify(body, null, 2))

    const webhookData = {
      timestamp: new Date().toISOString(),
      headers,
      body,
    }
    recentWebhooks.unshift(webhookData)
    if (recentWebhooks.length > MAX_WEBHOOKS) {
      recentWebhooks.pop()
    }

    // Log specific webhook event details if available
    if (body.event) {
      console.log("Event Type:", body.event)
    }
    if (body.callId) {
      console.log("Call ID:", body.callId)
    }
    if (body.status) {
      console.log("Status:", body.status)
    }

    console.log("===== END WEBHOOK =====")

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: "Webhook received successfully",
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Error processing webhook:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process webhook",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  console.log("[SERVER]Recommendation webhook endpoint accessed via GET")
  return NextResponse.json({
    message: "VoiceHub Recommendations Webhook Endpoint",
    status: "active",
    endpoint: "/api/webhooks/recommendations",
    method: "POST",
    recentWebhooks: recentWebhooks,
    count: recentWebhooks.length,
  })
}

export async function DELETE() {
  console.log("[SERVER]Clearing recommendation webhooks")
  recentWebhooks.length = 0
  return NextResponse.json({
    success: true,
    message: "Recommendation webhooks cleared",
  })
}
