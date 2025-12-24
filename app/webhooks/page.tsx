"use client"

import { useState, useEffect, useRef } from "react"

interface WebhookData {
  timestamp: string
  headers: Record<string, string>
  body: any
  isNew?: boolean
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
              className={`rounded-lg border ${webhook.isNew ? "border-2 border-green-500 shadow-lg animate-pulse" : "border-gray-200"} bg-white p-6 shadow-md transition-all duration-500`}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">
                  {new Date(webhook.timestamp).toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                <div className="flex items-center gap-2">
                  {webhook.isNew && (
                    <span className="rounded-full bg-green-500 px-3 py-1 text-xs font-bold text-white uppercase animate-pulse">
                      NEW
                    </span>
                  )}
                  {webhook.body.event && (
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                      {webhook.body.event}
                    </span>
                  )}
                </div>
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
  const [allRecommendationWebhooks, setAllRecommendationWebhooks] = useState<WebhookData[]>([])
  const [allOrderWebhooks, setAllOrderWebhooks] = useState<WebhookData[]>([])
  const [pollingPhase, setPollingPhase] = useState<"recommendations" | "orders" | "stopped">("recommendations")
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastRecommendationCountRef = useRef(0)
  const lastOrderCountRef = useRef(0)

  useEffect(() => {
    const savedRecommendations = localStorage.getItem("webhook_recommendations")
    const savedOrders = localStorage.getItem("webhook_orders")

    if (savedRecommendations) {
      setAllRecommendationWebhooks(JSON.parse(savedRecommendations))
    }
    if (savedOrders) {
      setAllOrderWebhooks(JSON.parse(savedOrders))
    }
  }, [])

  useEffect(() => {
    if (allRecommendationWebhooks.length > 0) {
      localStorage.setItem("webhook_recommendations", JSON.stringify(allRecommendationWebhooks))
    }
  }, [allRecommendationWebhooks])

  useEffect(() => {
    if (allOrderWebhooks.length > 0) {
      localStorage.setItem("webhook_orders", JSON.stringify(allOrderWebhooks))
    }
  }, [allOrderWebhooks])

  useEffect(() => {
    if (pollingPhase === "stopped" && allOrderWebhooks.length > 0) {
      console.log("Order cycle complete")

      const removeNewBadgeTimer = setTimeout(() => {
        setAllRecommendationWebhooks((prev) => prev.map((w) => ({ ...w, isNew: false })))
        setAllOrderWebhooks((prev) => prev.map((w) => ({ ...w, isNew: false })))
        setPollingPhase("recommendations")
        console.log("Ready for new cycle")
      }, 30000)

      return () => clearTimeout(removeNewBadgeTimer)
    }
  }, [pollingPhase, allOrderWebhooks.length])

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const response = await fetch("/api/webhooks/recommendations")
        const data = await response.json()

        if (data.recentWebhooks && data.recentWebhooks.length > lastRecommendationCountRef.current) {
          console.log("Recommendations received, switching to order polling")

          const newWebhooks = data.recentWebhooks
            .slice(0, data.recentWebhooks.length - lastRecommendationCountRef.current)
            .map((w: WebhookData) => ({ ...w, isNew: true }))

          setAllRecommendationWebhooks((prev) => [...newWebhooks, ...prev])
          lastRecommendationCountRef.current = data.recentWebhooks.length
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

        if (data.recentWebhooks && data.recentWebhooks.length > lastOrderCountRef.current) {
          console.log("Orders received, stopping polling")

          const newWebhooks = data.recentWebhooks
            .slice(0, data.recentWebhooks.length - lastOrderCountRef.current)
            .map((w: WebhookData) => ({ ...w, isNew: true }))

          setAllOrderWebhooks((prev) => [...newWebhooks, ...prev])
          lastOrderCountRef.current = data.recentWebhooks.length
          setPollingPhase("stopped")
        }
      } catch (error) {
        console.error("Error fetching orders:", error)
      }
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    if (pollingPhase === "recommendations") {
      console.log("Starting recommendation polling")
      fetchRecommendations()
      intervalRef.current = setInterval(fetchRecommendations, 2000)
    } else if (pollingPhase === "orders") {
      console.log("Starting order polling")
      fetchOrders()
      intervalRef.current = setInterval(fetchOrders, 2000)
    } else {
      console.log("Polling stopped")
    }

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
          <button
            onClick={() => {
              if (confirm("Are you sure you want to clear all webhook logs?")) {
                setAllRecommendationWebhooks([])
                setAllOrderWebhooks([])
                localStorage.removeItem("webhook_recommendations")
                localStorage.removeItem("webhook_orders")
                lastRecommendationCountRef.current = 0
                lastOrderCountRef.current = 0
              }
            }}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
          >
            Clear All Logs
          </button>
        </div>

        <WebhookSection
          title="Recommendations"
          webhooks={allRecommendationWebhooks}
          webhookUrl="/api/webhooks/recommendations"
        />
        <WebhookSection title="Orders" webhooks={allOrderWebhooks} webhookUrl="/api/webhooks/orders" />
      </div>
    </div>
  )
}
