import { useState, useEffect, useCallback, useRef } from 'react'

// ============================================================================
// Types matching the API response shape
// ============================================================================

export interface CircuitState {
  state: 'closed' | 'open' | 'half_open'
  failureCount: number
  lastFailureAt: number | null
  lastSuccessAt: number | null
  lastLatencyMs: number | null
}

export interface ModelStatus {
  circuit: CircuitState
  available: boolean
  inCache: boolean
}

export interface ProviderStatus {
  connected: boolean
  usagePercent: number
  quotaTarget: number | null
  autoDisabled: boolean
  models: Record<string, ModelStatus>
}

export interface CircuitStatusData {
  timestamp: number
  providers: Record<string, ProviderStatus>
}

interface CircuitStatusResponse {
  success: boolean
  data: CircuitStatusData
  error?: string
}

interface WebSocketMessage {
  type: 'budget_update' | 'tier_change' | 'alert' | 'usage_update' | 'circuit_update' | 'connected'
  timestamp: number
  data: unknown
}

interface CircuitUpdateData {
  provider: string
  state: 'closed' | 'open' | 'half_open'
  failureCount: number
  timestamp: number
}

// ============================================================================
// Custom Hook
// ============================================================================

export function useCircuitStatus(pollInterval = 30000) {
  const [data, setData] = useState<CircuitStatusData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/orchestration/circuit-status')
      
      if (!response.ok) {
        throw new Error(`Failed to fetch circuit status: ${response.status} ${response.statusText}`)
      }

      const result: CircuitStatusResponse = await response.json()

      if (result.success && result.data) {
        setData(result.data)
        setLastUpdated(result.data.timestamp)
        setError(null)
      } else {
        throw new Error(result.error || 'Failed to fetch circuit status')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Circuit status fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // WebSocket connection for real-time updates
  const connectWebSocket = useCallback(() => {
    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)

      ws.onopen = () => {
        console.log('WebSocket connected for circuit status updates')
        // Clear any pending reconnect attempts
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
      }

      ws.onmessage = (event) => {
        try {
          const msg: WebSocketMessage = JSON.parse(event.data)
          
          if (msg.type === 'circuit_update') {
            // Circuit breaker state changed - refresh full status
            // We could merge the update, but a full refresh ensures consistency
            const circuitData = msg.data as CircuitUpdateData
            console.log('Circuit update received:', circuitData)
            fetchStatus()
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected, will attempt reconnect in 5s')
        wsRef.current = null
        
        // Attempt to reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket()
        }, 5000)
      }

      wsRef.current = ws
    } catch (err) {
      console.error('Failed to create WebSocket connection:', err)
      
      // Attempt to reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket()
      }, 5000)
    }
  }, [fetchStatus])

  // Initial fetch + polling
  useEffect(() => {
    // Fetch immediately on mount
    fetchStatus()

    // Set up polling interval
    if (pollInterval > 0) {
      pollIntervalRef.current = setInterval(() => {
        fetchStatus()
      }, pollInterval)
    }

    // Cleanup
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [fetchStatus, pollInterval])

  // WebSocket connection lifecycle
  useEffect(() => {
    connectWebSocket()

    // Cleanup
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [connectWebSocket])

  const refresh = useCallback(() => {
    setIsLoading(true)
    return fetchStatus()
  }, [fetchStatus])

  return {
    providers: data?.providers ?? null,
    isLoading,
    error,
    lastUpdated,
    refresh
  }
}
