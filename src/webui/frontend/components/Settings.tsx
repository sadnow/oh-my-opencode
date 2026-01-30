import { useState, useEffect } from 'react'

interface QuotaTargets {
  claude_max_weekly_percent?: number
  copilot_monthly_percent?: number
  zen_monthly_dollars?: number
}

interface AdaptiveSettings {
  autoUpgrade: boolean
  autoDowngrade: boolean
  learningMode: 'conservative' | 'balanced' | 'aggressive'
  quotaTargets: QuotaTargets
}

interface SettingsResponse {
  success: boolean
  data?: AdaptiveSettings
  error?: string
}

export function Settings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Form state
  const [zenWeeklyBudget, setZenWeeklyBudget] = useState<string>('')
  const [claudeMaxTarget, setClaudeMaxTarget] = useState<string>('')
  const [copilotTarget, setCopilotTarget] = useState<string>('')
  const [autoUpgrade, setAutoUpgrade] = useState(true)
  const [autoDowngrade, setAutoDowngrade] = useState(true)
  const [learningMode, setLearningMode] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced')

  // Load current settings on mount
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const res = await fetch('/api/adaptive/settings')
      const data: SettingsResponse = await res.json()
      
      if (data.success && data.data) {
        const settings = data.data
        setAutoUpgrade(settings.autoUpgrade ?? true)
        setAutoDowngrade(settings.autoDowngrade ?? true)
        setLearningMode(settings.learningMode ?? 'balanced')
        
        if (settings.quotaTargets) {
          // zen_monthly_dollars in API, but we want weekly for user
          // Convert monthly to weekly for display (divide by 4)
          const monthlyZen = settings.quotaTargets.zen_monthly_dollars
          if (monthlyZen !== undefined) {
            setZenWeeklyBudget((monthlyZen / 4).toFixed(2))
          }
          if (settings.quotaTargets.claude_max_weekly_percent !== undefined) {
            setClaudeMaxTarget(settings.quotaTargets.claude_max_weekly_percent.toString())
          }
          if (settings.quotaTargets.copilot_monthly_percent !== undefined) {
            setCopilotTarget(settings.quotaTargets.copilot_monthly_percent.toString())
          }
        }
      } else {
        setError(data.error || 'Failed to load settings')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    
    try {
      // Convert weekly budget to monthly for API (multiply by 4)
      const zenMonthly = zenWeeklyBudget ? parseFloat(zenWeeklyBudget) * 4 : undefined
      
      const payload = {
        autoUpgrade,
        autoDowngrade,
        learningMode,
        quotaTargets: {
          ...(zenMonthly !== undefined && !isNaN(zenMonthly) ? { zen_monthly_dollars: zenMonthly } : {}),
          ...(claudeMaxTarget ? { claude_max_weekly_percent: parseFloat(claudeMaxTarget) } : {}),
          ...(copilotTarget ? { copilot_monthly_percent: parseFloat(copilotTarget) } : {}),
        },
      }
      
      const res = await fetch('/api/adaptive/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      
      const data = await res.json()
      
      if (data.success) {
        setSuccess('Settings saved successfully!' + (data.persisted ? ' (Config file updated)' : ' (Runtime only)'))
        // Reload to show saved values
        await loadSettings()
      } else {
        setError(data.error || 'Failed to save settings')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <p>Loading settings...</p>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-sm)' }}>
        Budget Settings
      </h2>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
        Configure your AI spending limits and automation preferences
      </p>

      {error && (
        <div className="card" style={{ 
          background: 'var(--color-error)', 
          color: 'white', 
          padding: '15px', 
          marginBottom: '20px',
          borderRadius: '8px'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div className="card" style={{ 
          background: 'var(--color-success)', 
          color: 'white', 
          padding: '15px', 
          marginBottom: '20px',
          borderRadius: '8px'
        }}>
          {success}
        </div>
      )}

      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '10px' }}>
          💰 Budget Limits
        </h3>
        
        <div style={{ display: 'grid', gap: '20px' }}>
          {/* OpenCode Zen Weekly Budget */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
              OpenCode Zen Weekly Budget ($)
              <span style={{ 
                display: 'inline-block',
                marginLeft: '8px',
                padding: '2px 8px',
                background: 'var(--color-accent)',
                color: 'white',
                borderRadius: '4px',
                fontSize: '11px'
              }}>
                Pay-per-use API
              </span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={zenWeeklyBudget}
              onChange={(e) => setZenWeeklyBudget(e.target.value)}
              placeholder="e.g., 20.00"
              style={{
                width: '200px',
                padding: '10px 12px',
                fontSize: '16px',
                border: '2px solid var(--color-border)',
                borderRadius: '6px',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
              }}
            />
            <p style={{ marginTop: '6px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Maximum amount to spend per week on OpenCode Zen API calls
            </p>
          </div>

          {/* Claude Max Weekly Target */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
              Claude Max Weekly Target (%)
              <span style={{ 
                display: 'inline-block',
                marginLeft: '8px',
                padding: '2px 8px',
                background: 'var(--color-success)',
                color: 'white',
                borderRadius: '4px',
                fontSize: '11px'
              }}>
                Subscription
              </span>
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={claudeMaxTarget}
              onChange={(e) => setClaudeMaxTarget(e.target.value)}
              placeholder="e.g., 70"
              style={{
                width: '200px',
                padding: '10px 12px',
                fontSize: '16px',
                border: '2px solid var(--color-border)',
                borderRadius: '6px',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
              }}
            />
            <p style={{ marginTop: '6px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Target percentage of your Claude Max weekly allowance to use before downgrading
            </p>
          </div>

          {/* Copilot Monthly Target */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
              Copilot Monthly Target (%)
              <span style={{ 
                display: 'inline-block',
                marginLeft: '8px',
                padding: '2px 8px',
                background: 'var(--color-success)',
                color: 'white',
                borderRadius: '4px',
                fontSize: '11px'
              }}>
                Subscription
              </span>
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={copilotTarget}
              onChange={(e) => setCopilotTarget(e.target.value)}
              placeholder="e.g., 80"
              style={{
                width: '200px',
                padding: '10px 12px',
                fontSize: '16px',
                border: '2px solid var(--color-border)',
                borderRadius: '6px',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
              }}
            />
            <p style={{ marginTop: '6px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Target percentage of your Copilot premium requests before downgrading
            </p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '10px' }}>
          ⚙️ Automation
        </h3>
        
        <div style={{ display: 'grid', gap: '20px' }}>
          {/* Auto Upgrade */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="checkbox"
              id="autoUpgrade"
              checked={autoUpgrade}
              onChange={(e) => setAutoUpgrade(e.target.checked)}
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
            <label htmlFor="autoUpgrade" style={{ cursor: 'pointer' }}>
              <span style={{ fontWeight: '600' }}>Auto-Upgrade</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Automatically use higher-quality models when budget headroom allows
              </p>
            </label>
          </div>

          {/* Auto Downgrade */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="checkbox"
              id="autoDowngrade"
              checked={autoDowngrade}
              onChange={(e) => setAutoDowngrade(e.target.checked)}
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
            <label htmlFor="autoDowngrade" style={{ cursor: 'pointer' }}>
              <span style={{ fontWeight: '600' }}>Auto-Downgrade</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Automatically switch to cheaper models when approaching budget limits
              </p>
            </label>
          </div>

          {/* Learning Mode */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
              Learning Mode
            </label>
            <select
              value={learningMode}
              onChange={(e) => setLearningMode(e.target.value as 'conservative' | 'balanced' | 'aggressive')}
              style={{
                width: '200px',
                padding: '10px 12px',
                fontSize: '16px',
                border: '2px solid var(--color-border)',
                borderRadius: '6px',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
              }}
            >
              <option value="conservative">Conservative (Stable)</option>
              <option value="balanced">Balanced (Default)</option>
              <option value="aggressive">Aggressive (Fast)</option>
            </select>
            <p style={{ marginTop: '6px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              How quickly the system adapts to your spending patterns
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
        <button
          onClick={saveSettings}
          disabled={saving}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            background: saving ? 'var(--color-text-secondary)' : 'var(--color-accent)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving...' : '💾 Save Settings'}
        </button>
        
        <button
          onClick={loadSettings}
          disabled={loading || saving}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-primary)',
            border: '2px solid var(--color-border)',
            borderRadius: '8px',
            cursor: loading || saving ? 'not-allowed' : 'pointer',
          }}
        >
          🔄 Reload
        </button>
      </div>
    </div>
  )
}
