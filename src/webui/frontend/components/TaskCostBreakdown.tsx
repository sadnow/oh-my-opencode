import { useState, useEffect } from 'react'

interface CategoryData {
  category: string
  cost: number
  count: number
}

interface ByCategoryResponse {
  success: boolean
  data?: {
    categories: CategoryData[]
    totalCost: number
  }
  error?: string
}

type Period = '24h' | 'week' | 'month'

interface TaskTypeGroup {
  taskType: string
  cost: number
  count: number
  percentage: number
}

const TASK_TYPE_COLORS: Record<string, string> = {
  primary: '#0066cc',
  'background-task': '#28a745',
  subagent: '#ffc107'
}

const TASK_TYPE_LABELS: Record<string, string> = {
  primary: 'Primary Tasks',
  'background-task': 'Background Tasks',
  subagent: 'Subagent Tasks'
}

export function TaskCostBreakdown() {
  const [period, setPeriod] = useState<Period>('week')
  const [data, setData] = useState<TaskTypeGroup[]>([])
  const [totalCost, setTotalCost] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/stats/by-category')
      const responseData: ByCategoryResponse = await res.json()

      if (responseData.success && responseData.data) {
        // Group by taskType
        const taskTypeGroups: Record<string, { cost: number; count: number }> = {}

        responseData.data.categories.forEach((cat) => {
          // Extract taskType from category name
          // Categories are typically formatted like "primary:task-name" or "background-task:task-name"
          const taskType = cat.category.split(':')[0] || cat.category

          if (!taskTypeGroups[taskType]) {
            taskTypeGroups[taskType] = { cost: 0, count: 0 }
          }

          taskTypeGroups[taskType].cost += cat.cost
          taskTypeGroups[taskType].count += cat.count
        })

        const total = Object.values(taskTypeGroups).reduce((sum, group) => sum + group.cost, 0)
        setTotalCost(total)

        // Calculate percentages ensuring they sum to 100%
        const groups = Object.entries(taskTypeGroups).map(([taskType, group]) => {
          const percentage = total > 0 ? (group.cost / total) * 100 : 0
          return {
            taskType,
            cost: group.cost,
            count: group.count,
            percentage
          }
        })

        // Sort by cost descending
        groups.sort((a, b) => b.cost - a.cost)

        // Adjust percentages to ensure they sum to exactly 100%
        const totalPercentage = groups.reduce((sum, g) => sum + g.percentage, 0)
        if (total > 0 && Math.abs(totalPercentage - 100) > 0.01) {
          const diff = 100 - totalPercentage
          // Add the difference to the largest group
          if (groups.length > 0) {
            groups[0].percentage += diff
          }
        }

        setData(groups)
      } else {
        setError(responseData.error || 'Failed to fetch cost breakdown')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [period])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Task Cost Breakdown</h2>
          <p style={{ color: '#666', marginTop: '5px' }}>Cost distribution by task type</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            style={{
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid #dee2e6',
              background: 'white',
              cursor: 'pointer'
            }}
          >
            <option value="24h">Last 24 Hours</option>
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
          </select>
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              padding: '8px 16px',
              background: loading ? '#ccc' : '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            ⟳ Refresh
          </button>
        </div>
      </div>

      {loading && <p style={{ color: '#666' }}>Loading cost breakdown...</p>}

      {error && (
        <div style={{
          padding: '15px',
          background: '#f8d7da',
          color: '#721c24',
          borderRadius: '4px',
          marginBottom: '15px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Total Summary */}
          <div style={{
            padding: '20px',
            background: '#f8f9fa',
            borderRadius: '8px',
            marginBottom: '30px',
            border: '2px solid #0066cc'
          }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Total Cost</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#333' }}>
              {formatCurrency(totalCost)}
            </div>
          </div>

          {/* Task Type Breakdown */}
          <h3 style={{ marginTop: '30px', marginBottom: '15px' }}>Cost by Task Type</h3>

          {data.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>No cost data available.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {data.map((group) => {
                const color = TASK_TYPE_COLORS[group.taskType] || '#6c757d'
                const label = TASK_TYPE_LABELS[group.taskType] || group.taskType

                return (
                  <div
                    key={group.taskType}
                    style={{
                      padding: '20px',
                      background: 'white',
                      borderRadius: '8px',
                      border: '1px solid #dee2e6',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
                          {label}
                        </h4>
                        <div style={{ fontSize: '13px', color: '#666', marginTop: '3px' }}>
                          {formatNumber(group.count)} tasks
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: color }}>
                          {group.percentage.toFixed(1)}%
                        </div>
                        <div style={{ fontSize: '14px', color: '#666' }}>
                          {formatCurrency(group.cost)}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{
                        height: '12px',
                        background: '#e9ecef',
                        borderRadius: '6px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${group.percentage}%`,
                          background: color,
                          transition: 'width 0.3s ease',
                          borderRadius: '6px'
                        }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Percentage Validation */}
          {data.length > 0 && (
            <div style={{
              marginTop: '20px',
              padding: '10px',
              background: '#e7f3ff',
              borderRadius: '4px',
              fontSize: '13px',
              color: '#004085'
            }}>
              <strong>Verification:</strong> Percentages sum to{' '}
              {data.reduce((sum, g) => sum + g.percentage, 0).toFixed(1)}%
              {Math.abs(data.reduce((sum, g) => sum + g.percentage, 0) - 100) < 0.01 ? ' ✓' : ''}
            </div>
          )}
        </>
      )}
    </div>
  )
}