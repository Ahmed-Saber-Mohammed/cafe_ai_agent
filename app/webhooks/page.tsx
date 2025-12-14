"use client"

import { useState, useEffect, useRef } from "react"

interface WebhookData {
  timestamp: string
  headers: Record<string, string>
  body: any
}

const WebhookSection = ({
  title,
  webhooks,
  webhookUrl,
}: { title: string; webhooks: WebhookData[]; webhookUrl: string }) => {
  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center justify-between rounded-lg bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-600">
            Webhook URL: <code className="rounded bg-gray-100 px-2 py-1 text-xs">{webhookUrl}</code>
          </p>
        </div>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
          {webhooks.length} events
        </span>
      </div>

      <div className="space-y-4">
        {webhooks.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
            <p className="text-gray-500">No webhooks received yet.</p>
          </div>
        ) : (
          webhooks.map((webhook, index) => (
            <div
              key={`${webhook.timestamp}-${index}`}
              className="rounded-lg border border-gray-200 bg-white p-6 shadow-md"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">
                  {new Date(webhook.timestamp).toLocaleString()}
                </span>
                {webhook.body.event && (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                    {webhook.body.event}
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-gray-700">Body</h4>
                  <pre className="overflow-x-auto rounded-lg bg-gray-50 p-4 text-xs text-gray-800">
                    {JSON.stringify(webhook.body, null, 2)}
                  </pre>
                </div>
                <details className="cursor-pointer">
                  <summary className="text-sm font-semibold text-gray-700">Headers</summary>
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-50 p-4 text-xs text-gray-800">
                    {JSON.stringify(webhook.headers, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function WebhooksPage() {
  const [recommendationWebhooks, setRecommendationWebhooks] = useState<WebhookData[]>([])
  const [orderWebhooks, setOrderWebhooks] = useState<WebhookData[]>([])
  const [pollingPhase, setPollingPhase] = useState<"recommendations" | "orders" | "stopped">("recommendations")
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const clearWebhookData = async () => {
      try {
        console.log("Webhooks page: Clearing webhook data on load")
        await Promise.all([
          fetch("/api/webhooks/recommendations", { method: "DELETE" }),
          fetch("/api/webhooks/orders", { method: "DELETE" }),
        ])
        console.log("Webhooks page: Webhook data cleared")
      } catch (error) {
        console.error("Webhooks page: Error clearing webhook data:", error)
      }
    }

    clearWebhookData()
  }, [])

  useEffect(() => {
    if (pollingPhase === "stopped" && orderWebhooks.length > 0) {
      console.log("Webhooks page: Order cycle complete, preparing for next cycle")

      // Wait 20 seconds before resetting
      const resetTimer = setTimeout(async () => {
        console.log("Webhooks page: Resetting for new cycle")

        // Clear webhook data on server
        await Promise.all([
          fetch("/api/webhooks/recommendations", { method: "DELETE" }),
          fetch("/api/webhooks/orders", { method: "DELETE" }),
        ])

        // Reset local state
        setRecommendationWebhooks([])
        setOrderWebhooks([])
        setPollingPhase("recommendations")

        console.log("Webhooks page: Ready for new cycle")
      }, 20000)

      return () => clearTimeout(resetTimer)
    }
  }, [pollingPhase, orderWebhooks.length])

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const response = await fetch("/api/webhooks/recommendations")
        const data = await response.json()

        if (data.recentWebhooks && data.recentWebhooks.length > 0) {
          console.log("Recommendations received, switching to order polling")
          setRecommendationWebhooks(data.recentWebhooks)
          setPollingPhase("orders")
        }
      } catch (error) {
        console.error("Error fetching recommendations:", error)
      }
    }

    const fetchOrders = async () => {
      try {
        const response = await fetch("/api/webhooks/orders")
        const data = await response.json()

        if (data.recentWebhooks && data.recentWebhooks.length > 0) {
          console.log("Orders received, stopping polling")
          setOrderWebhooks(data.recentWebhooks)
          setPollingPhase("stopped")
        }
      } catch (error) {
        console.error("Error fetching orders:", error)
      }
    }

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    // Start polling based on current phase
    if (pollingPhase === "recommendations") {
      console.log("Starting recommendation polling")
      fetchRecommendations() // Fetch immediately
      intervalRef.current = setInterval(fetchRecommendations, 2000)
    } else if (pollingPhase === "orders") {
      console.log("Starting order polling")
      fetchOrders() // Fetch immediately
      intervalRef.current = setInterval(fetchOrders, 2000)
    } else {
      console.log("Polling stopped")
    }

    // Cleanup interval on unmount or phase change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [pollingPhase])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Webhook Logs</h1>
            <p className="mt-2 text-gray-600">
              Monitor incoming webhooks from VoiceHub
              <span className="ml-2 text-sm font-medium">
                {pollingPhase === "recommendations" && "• Waiting for recommendations..."}
                {pollingPhase === "orders" && "• Waiting for order..."}
                {pollingPhase === "stopped" && "• Order complete"}
              </span>
            </p>
          </div>
        </div>

        <WebhookSection
          title="Recommendations"
          webhooks={recommendationWebhooks}
          webhookUrl="/api/webhooks/recommendations"
        />
        <WebhookSection title="Orders" webhooks={orderWebhooks} webhookUrl="/api/webhooks/orders" />
      </div>
    </div>
  )
}
