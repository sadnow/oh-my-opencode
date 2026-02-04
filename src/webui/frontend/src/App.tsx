import { useState, useEffect } from 'react'
import { PresetComparison } from '../components/PresetComparison'
import { ExportButton } from '../components/ExportButton'
import { RoutingLogsViewer } from '../components/RoutingLogsViewer'
import { BudgetDashboard } from '../components/BudgetDashboard'
import { ClaudeMaxUsage } from '../components/ClaudeMaxUsage'
import { CopilotUsage } from '../components/CopilotUsage'
import { QuotaMatrix } from '../components/QuotaMatrix'
import { Settings } from '../components/Settings'
import { StatsDashboard } from '../components/StatsDashboard'
import { CircuitBreakerGrid } from '../components/circuit-breaker/CircuitBreakerGrid'
import { CircuitDetailModal } from '../components/circuit-breaker/CircuitDetailModal'
import type { ModelStatus } from '../components/circuit-breaker/useCircuitStatus'
import { BudgetUsageChart, ModelDistributionChart } from '../components/charts'
import { ProviderHealthMatrix } from '../components/ProviderHealthMatrix'

type TabType = 'circuit' | 'presets' | 'routing' | 'budget' | 'usage' | 'settings' | 'export' | 'stats'

const TABS: TabType[] = ['circuit', 'presets', 'routing', 'budget', 'usage', 'settings', 'export', 'stats']

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('circuit')
  const [showHelp, setShowHelp] = useState(false)
  const [selectedModel, setSelectedModel] = useState<{
    modelId: string
    provider: string
    status: ModelStatus
  } | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Number keys 1-8 for tab navigation
      if (e.key >= '1' && e.key <= '8') {
        const index = parseInt(e.key) - 1
        if (index < TABS.length) {
          setActiveTab(TABS[index])
          e.preventDefault()
        }
      }
      
      // ? for help modal
      if (e.key === '?' && !e.shiftKey) {
        setShowHelp(prev => !prev)
        e.preventDefault()
      }
      
      // Escape to close help modal (CircuitDetailModal handles its own Escape)
      if (e.key === 'Escape' && showHelp) {
        setShowHelp(false)
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showHelp])

return (
    <div style={{ padding: 'var(--spacing-3)', fontFamily: 'var(--font-family-sans)', minHeight: '100vh', background: 'var(--color-bg-secondary)' }}>
      <header className="header" style={{ marginBottom: 'var(--spacing-3)' }}>
        <h1 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, margin: 0 }}>oh-im-broke Dashboard</h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 'var(--spacing-1) 0 0 0' }}>Budget-conscious AI orchestration</p>
      </header>

<nav className="nav-tabs" style={{ marginBottom: 'var(--spacing-4)', display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={activeTab === 'circuit' ? 'active' : ''}
          onClick={() => setActiveTab('circuit')}
          style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}
        >
          Circuit
        </button>
        <button
          type="button"
          className={activeTab === 'presets' ? 'active' : ''}
          onClick={() => setActiveTab('presets')}
          style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}
        >
          Presets
        </button>
        <button
          type="button"
          className={activeTab === 'routing' ? 'active' : ''}
          onClick={() => setActiveTab('routing')}
          style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}
        >
          Routing Logs
        </button>
        <button
          type="button"
          className={activeTab === 'budget' ? 'active' : ''}
          onClick={() => setActiveTab('budget')}
          style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}
        >
          Budget
        </button>
        <button
          type="button"
          className={activeTab === 'usage' ? 'active' : ''}
          onClick={() => setActiveTab('usage')}
          style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}
        >
          Usage
        </button>
        <button
          type="button"
          className={activeTab === 'settings' ? 'active' : ''}
          onClick={() => setActiveTab('settings')}
          style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}
        >
          ⚙️ Settings
        </button>
        <button
          type="button"
          className={activeTab === 'export' ? 'active' : ''}
          onClick={() => setActiveTab('export')}
          style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}
        >
          Export
        </button>
        <button
          type="button"
          className={activeTab === 'stats' ? 'active' : ''}
          onClick={() => setActiveTab('stats')}
          style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}
        >
          📊 Stats
        </button>
      </nav>

      <main>
        {activeTab === 'circuit' && (
          <div>
            <CircuitBreakerGrid
              onModelClick={(provider, modelId, status) => {
                setSelectedModel({ provider, modelId, status })
              }}
            />
            <div style={{ marginTop: 'var(--spacing-4)' }}>
              <ProviderHealthMatrix />
            </div>
          </div>
        )}

        {activeTab === 'presets' && (
          <div>
            <PresetComparison />
          </div>
        )}

{activeTab === 'routing' && (
          <div>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--spacing-2)' }}>
              Routing Logs
            </h2>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-3)' }}>
              Model selection decisions and tier changes
            </p>
            <RoutingLogsViewer />
          </div>
        )}

        {activeTab === 'budget' && (
          <div>
            <BudgetDashboard />
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
              gap: 'var(--spacing-4)', 
              marginTop: 'var(--spacing-4)' 
            }}>
              <BudgetUsageChart />
              <ModelDistributionChart />
            </div>
          </div>
        )}

{activeTab === 'usage' && (
          <div>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--spacing-2)' }}>
              Usage Tracking
            </h2>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-3)' }}>
              Real-time Claude Max and Copilot usage
            </p>
            <div style={{ display: 'grid', gap: 'var(--spacing-4)' }}>
              <QuotaMatrix />
              <ClaudeMaxUsage />
              <CopilotUsage />
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <Settings />
        )}

{activeTab === 'export' && (
          <div>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--spacing-2)' }}>
              Export Data
            </h2>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-3)' }}>
              Download usage, config, and logs
            </p>
            <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
              <ExportButton
                endpoint="/api/export/usage"
                label="Export Usage"
                filename="usage-export"
              />
              <ExportButton
                endpoint="/api/export/config"
                label="Export Config"
                filename="config-export"
              />
              <ExportButton
                endpoint="/api/export/presets"
                label="Export Presets"
                filename="presets-export"
              />
              <ExportButton
                endpoint="/api/export/routing-logs"
                label="Export Routing Logs"
                filename="routing-logs-export"
              />
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <StatsDashboard />
        )}
      </main>

      {/* Circuit Detail Modal */}
      {selectedModel && (
        <CircuitDetailModal
          isOpen={true}
          onClose={() => setSelectedModel(null)}
          modelId={selectedModel.modelId}
          provider={selectedModel.provider}
          status={selectedModel.status}
        />
      )}

      {showHelp && (
        <div 
          className="help-modal-overlay" 
          onClick={() => setShowHelp(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setShowHelp(false)
            }
          }}
          role="button"
          tabIndex={0}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 'var(--z-modal-backdrop)',
            backdropFilter: 'blur(2px)'
          }}
        >
          <div 
            className="help-modal" 
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation()
              }
            }}
            role="document"
            style={{
              backgroundColor: 'var(--color-bg-elevated)',
              padding: 'var(--spacing-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-strong)',
              boxShadow: 'var(--shadow-lg)',
              maxWidth: '400px',
              width: '90%',
              zIndex: 'var(--z-modal)'
            }}
          >
            <h2 style={{ 
              fontSize: 'var(--font-size-md)', 
              fontWeight: 600, 
              marginTop: 0, 
              marginBottom: 'var(--spacing-3)',
              color: 'var(--color-accent-primary)',
              borderBottom: '1px solid var(--color-border-subtle)',
              paddingBottom: 'var(--spacing-2)'
            }}>
              Keyboard Shortcuts
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td style={{ padding: 'var(--spacing-2) 0', fontWeight: 600, color: 'var(--color-text-primary)' }}>1 - 8</td>
                  <td style={{ padding: 'var(--spacing-2) 0', color: 'var(--color-text-secondary)', textAlign: 'right' }}>Switch Tabs</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td style={{ padding: 'var(--spacing-2) 0', fontWeight: 600, color: 'var(--color-text-primary)' }}>?</td>
                  <td style={{ padding: 'var(--spacing-2) 0', color: 'var(--color-text-secondary)', textAlign: 'right' }}>Toggle Help</td>
                </tr>
                <tr>
                  <td style={{ padding: 'var(--spacing-2) 0', fontWeight: 600, color: 'var(--color-text-primary)' }}>Esc</td>
                  <td style={{ padding: 'var(--spacing-2) 0', color: 'var(--color-text-secondary)', textAlign: 'right' }}>Close Modal</td>
                </tr>
              </tbody>
            </table>
            <div style={{ marginTop: 'var(--spacing-4)', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                type="button"
                onClick={() => setShowHelp(false)}
                style={{
                  padding: 'var(--spacing-1) var(--spacing-3)',
                  fontSize: 'var(--font-size-xs)',
                  backgroundColor: 'var(--color-bg-tertiary)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
