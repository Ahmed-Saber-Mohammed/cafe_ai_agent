"use client"

import { VoiceWidget } from "@/components/voice-widget"
import { useState, useEffect, useRef } from "react"
import menuItems from "@/data/menu-items.json"

interface OrderItem {
  item_id: number | string
  size: string | null
  quantity: number
}

export default function Home() {
  const [recommendationItems, setRecommendationItems] = useState<number[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [hasRecommendations, setHasRecommendations] = useState(false)
  const [hasOrder, setHasOrder] = useState(false)
  const [pollingPhase, setPollingPhase] = useState<"recommendations" | "orders" | "stopped">("recommendations")
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const clearWebhookData = async () => {
      try {
        console.log("Main page: Clearing webhook data on load")
        await Promise.all([
          fetch("/api/webhooks/recommendations", { method: "DELETE" }),
          fetch("/api/webhooks/orders", { method: "DELETE" }),
        ])
        console.log("Main page: Webhook data cleared")
      } catch (error) {
        console.error("Main page: Error clearing webhook data:", error)
      }
    }

    clearWebhookData()
  }, [])

  useEffect(() => {
    if (pollingPhase === "stopped" && hasOrder) {
      console.log("Main page: Order cycle complete, preparing for next cycle")

      const resetTimer = setTimeout(async () => {
        console.log("Main page: Resetting for new cycle")

        // Clear webhook data on server
        await Promise.all([
          fetch("/api/webhooks/recommendations", { method: "DELETE" }),
          fetch("/api/webhooks/orders", { method: "DELETE" }),
        ])

        // Reset local state
        setRecommendationItems([])
        setOrderItems([])
        setHasRecommendations(false)
        setHasOrder(false)
        setPollingPhase("recommendations")

        console.log("Main page: Ready for new cycle")
      }, 20000)

      return () => clearTimeout(resetTimer)
    }
  }, [pollingPhase, hasOrder])

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const response = await fetch("/api/webhooks/recommendations")
        const data = await response.json()

        if (data.recentWebhooks && data.recentWebhooks.length > 0) {
          const latestRecommendation = data.recentWebhooks[0]

          if (latestRecommendation.body?.items_ids) {
            let itemIds: number[] = []
            const itemsData = latestRecommendation.body.items_ids

            if (typeof itemsData === "string") {
              // CSV string: "1,2,3"
              itemIds = itemsData.split(",").map((id: string) => Number.parseInt(id.trim()))
            } else if (Array.isArray(itemsData)) {
              // Already an array
              itemIds = itemsData.map((id: any) => Number.parseInt(String(id)))
            } else if (typeof itemsData === "number") {
              // Single number
              itemIds = [itemsData]
            }

            console.log("Main page: Parsed recommendation IDs:", itemIds)
            setRecommendationItems(itemIds)
            setHasRecommendations(true)
            setPollingPhase("orders")
          }
        }
      } catch (error) {
        console.error("Main page: Error fetching recommendations:", error)
      }
    }

    const fetchOrders = async () => {
      try {
        const response = await fetch("/api/webhooks/orders")
        const data = await response.json()

        if (data.recentWebhooks && data.recentWebhooks.length > 0) {
          const latestOrder = data.recentWebhooks[0]
          const body = latestOrder.body

          console.log("Main page: Raw order body:", JSON.stringify(body, null, 2))

          try {
            let orderData = null

            // 1. Check for Final_order field (stringified JSON)
            if (body?.Final_order) {
              console.log("Main page: Found Final_order, parsing...")
              const parsed = JSON.parse(body.Final_order)
              console.log("Main page: Parsed Final_order:", JSON.stringify(parsed, null, 2))
              orderData = parsed.order || parsed
            }
            // 2. Check for order field (object)
            else if (body?.order) {
              console.log("Main page: Found order field")
              orderData = body.order
            }
            // 3. Check if body itself is the order (already contains items)
            else if (body?.items && Array.isArray(body.items)) {
              console.log("Main page: Body contains items directly")
              orderData = body
            }

            if (orderData?.items && Array.isArray(orderData.items)) {
              console.log("Main page: Processing items, count:", orderData.items.length)
              const items = orderData.items.map((item: any) => {
                console.log("Main page: Raw item:", JSON.stringify(item, null, 2))
                return {
                  item_id: item.item_id,
                  size: item.size || null,
                  quantity: item.quantity || 1,
                }
              })

              console.log("Main page: Parsed order items:", JSON.stringify(items, null, 2))
              setOrderItems(items)
              setHasOrder(true)
              setPollingPhase("stopped")
            } else {
              console.log("Main page: No valid items found in orderData")
            }
          } catch (parseError) {
            console.error("Main page: Error parsing order data:", parseError)
            console.error("Main page: Raw order body:", body)
          }
        }
      } catch (error) {
        console.error("Main page: Error fetching orders:", error)
      }
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    if (pollingPhase === "recommendations") {
      console.log("Main page: Starting recommendation polling")
      fetchRecommendations()
      intervalRef.current = setInterval(fetchRecommendations, 2000)
    } else if (pollingPhase === "orders") {
      console.log("Main page: Starting order polling")
      fetchOrders()
      intervalRef.current = setInterval(fetchOrders, 2000)
    } else {
      console.log("Main page: Polling stopped")
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [pollingPhase])

  const getImageUrl = (imagePath?: string): string => {
    if (!imagePath) return "/coffee-cup.png"
    if (imagePath.startsWith("http")) return imagePath
    return `https://raw.githubusercontent.com/Ahmed-Saber-Mohammed/menu-images/main/${imagePath}`
  }

  const calculateInvoice = () => {
    if (!hasOrder) return null

    const items = orderItems
      .map((orderItem) => {
        let menuItem = null

        const itemIdStr = String(orderItem.item_id).toLowerCase().trim()

        // Try numeric lookup first
        const numId = Number.parseInt(itemIdStr)
        if (!Number.isNaN(numId)) {
          menuItem = menuItems.find((item) => item.item === numId)
        }

        // If not found, try to match by product name
        if (!menuItem) {
          // Convert "Americano_ID" to "Americano" for matching
          const productName = itemIdStr.replace(/_id$|_ID$/, "")
          menuItem = menuItems.find(
            (item) =>
              item.name_en.toLowerCase().includes(productName) ||
              item.name_ar.toLowerCase().includes(productName) ||
              productName.includes(item.name_en.toLowerCase()),
          )
        }

        if (!menuItem) {
          console.log("Main page: Menu item not found for ID:", orderItem.item_id)
          return null
        }

        const price = menuItem.sizes[orderItem.size as keyof typeof menuItem.sizes] || 0
        const subtotal = price * orderItem.quantity

        return {
          ...menuItem,
          selectedSize: orderItem.size,
          quantity: orderItem.quantity,
          price,
          subtotal,
        }
      })
      .filter(Boolean)

    const total = items.reduce((sum, item) => sum + (item?.subtotal || 0), 0)
    const currency = items[0]?.currency || "KWD"

    return { items, total, currency }
  }

  const invoice = calculateInvoice()

  const displayContent = hasOrder
    ? orderItems
        .map((orderItem) => {
          let menuItem = null

          const itemIdStr = String(orderItem.item_id).toLowerCase().trim()
          const numId = Number.parseInt(itemIdStr)
          if (!Number.isNaN(numId)) {
            menuItem = menuItems.find((item) => item.item === numId)
          }

          if (!menuItem) {
            const productName = itemIdStr.replace(/_id$|_ID$/, "")
            menuItem = menuItems.find(
              (item) =>
                item.name_en.toLowerCase().includes(productName) ||
                item.name_ar.toLowerCase().includes(productName) ||
                productName.includes(item.name_en.toLowerCase()),
            )
          }

          return menuItem ? { ...menuItem, selectedSize: orderItem.size, quantity: orderItem.quantity } : null
        })
        .filter(Boolean)
    : hasRecommendations
      ? menuItems
          .filter((item) => recommendationItems.includes(item.item))
          .map((item) => ({ ...item, selectedSize: null, quantity: 1 }))
      : []

  const displayTitle = hasOrder ? "Your Order" : hasRecommendations ? "Recommended for You" : ""

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="fixed top-6 left-6 z-30">
        <img
          src="https://www.cariboucoffee.com/wp-content/themes/takeoff/assets/images/logo.svg"
          alt="Caribou Coffee"
          className="h-12 md:h-16"
        />
      </div>

      {!hasRecommendations && !hasOrder ? (
        <div className="fixed inset-0 z-0">
          <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
            <source
              src="https://cdn.dribbble.com/userupload/29548908/file/large-4b876741f321850c2d328b676dcfb002.mp4"
              type="video/mp4"
            />
          </video>
        </div>
      ) : (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 py-24 px-4">
          <div className="container mx-auto max-w-7xl">
            <h2 className="text-3xl font-bold text-center mb-8 text-amber-900">{displayTitle}</h2>

            <div className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayContent.map((item: any) => (
                  <div
                    key={`${item.item}-${item.selectedSize}`}
                    className="bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-105"
                  >
                    <div className="relative h-64 w-full overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50">
                      <img
                        src={getImageUrl(item.image) || "/placeholder.svg"}
                        alt={item.name_en}
                        className="h-full w-full object-contain p-4"
                        onError={(e) => {
                          e.currentTarget.src = "/coffee-cup.png"
                        }}
                      />
                      {item.quantity > 1 && (
                        <div className="absolute top-2 right-2 bg-amber-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
                          {item.quantity}
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <div className="mb-2">
                        <h3 className="text-xl font-bold text-amber-900">{item.name_en}</h3>
                        <p className="text-sm text-gray-500 font-arabic">{item.name_ar}</p>
                      </div>

                      <div className="text-xs text-gray-500 mb-3">
                        <span className="font-semibold">{item.category}</span>
                        {item.subsection && (
                          <>
                            <span className="mx-1">•</span>
                            <span>{item.subsection}</span>
                          </>
                        )}
                      </div>

                      {item.selectedSize ? (
                        <div className="bg-amber-50 rounded-lg p-3">
                          <div className="flex justify-between items-center">
                            <span className="capitalize text-gray-700 font-medium">{item.selectedSize}</span>
                            <span className="font-bold text-amber-700 text-lg">
                              {item.sizes[item.selectedSize]} {item.currency}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {Object.entries(item.sizes).map(([size, price]) => (
                            <div key={size} className="flex justify-between items-center text-sm">
                              <span className="capitalize text-gray-600">{size}</span>
                              <span className="font-semibold text-amber-700">
                                {price} {item.currency}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {hasOrder && invoice && (
                <div className="w-full">
                  <div className="bg-white rounded-xl shadow-lg p-4 max-w-6xl mx-auto">
                    <div className="border-b border-amber-200 pb-2 mb-3">
                      <h3 className="text-xl font-bold text-amber-900">Invoice</h3>
                      <p className="text-xs text-gray-500">Order Summary</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                      {invoice.items.map((item: any, index: number) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-3 bg-amber-50/30">
                          <div className="mb-2">
                            <h4 className="font-bold text-gray-800 text-sm">{item.name_en}</h4>
                            <p className="text-xs text-gray-500 font-arabic">{item.name_ar}</p>
                          </div>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between text-gray-600">
                              <span className="capitalize">Size:</span>
                              <span>{item.selectedSize}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                              <span>Qty:</span>
                              <span>{item.quantity}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                              <span>Price:</span>
                              <span>
                                {item.price.toFixed(3)} {item.currency}
                              </span>
                            </div>
                            <div className="flex justify-between items-center pt-1 border-t border-amber-200">
                              <span className="font-bold text-gray-800 text-xs">Subtotal:</span>
                              <span className="font-bold text-amber-700 text-sm">
                                {item.subtotal.toFixed(3)} {item.currency}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-amber-200 pt-3">
                      <div className="max-w-md ml-auto">
                        <div className="flex justify-between items-center text-lg font-bold text-amber-900">
                          <span>Total</span>
                          <span>
                            {invoice.total.toFixed(3)} {invoice.currency}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg text-center">
                      <p className="text-sm font-semibold text-gray-800">Thank you for your order!</p>
                      <p className="text-xs text-gray-600 mt-1">Caribou Coffee - Drive-Thru Service</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <VoiceWidget />
    </main>
  )
}
