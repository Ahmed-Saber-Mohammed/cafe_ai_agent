import { type NextRequest, NextResponse } from "next/server"

// Store recent order webhooks in memory (last 50)
const recentOrderWebhooks: Array<{
  timestamp: string
  headers: Record<string, string>
  body: any
}> = []

const MAX_WEBHOOKS = 50

export async function POST(request: NextRequest) {
  try {
    console.log("===== VOICEHUB ORDER WEBHOOK RECEIVED =====")
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
    recentOrderWebhooks.unshift(webhookData)
    if (recentOrderWebhooks.length > MAX_WEBHOOKS) {
      recentOrderWebhooks.pop()
    }

    // Log specific webhook event details if available
    if (body.event) {
      console.log("Event Type:", body.event)
    }
    if (body.items_ids) {
      console.log("Order Items:", body.items_ids)
    }

    console.log("===== END ORDER WEBHOOK =====")

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: "Order webhook received successfully",
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Error processing order webhook:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process order webhook",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  console.log("[SERVER]Order webhook endpoint accessed via GET")
  return NextResponse.json({
    message: "VoiceHub Order Webhook Endpoint",
    status: "active",
    endpoint: "/api/webhooks/orders",
    method: "POST",
    recentWebhooks: recentOrderWebhooks,
    count: recentOrderWebhooks.length,
  })
}

export async function DELETE() {
  console.log("[SERVER]Clearing order webhooks")
  recentOrderWebhooks.length = 0
  return NextResponse.json({
    success: true,
    message: "Order webhooks cleared",
  })
}
