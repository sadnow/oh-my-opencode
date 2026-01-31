import { useState } from 'react'
import { PresetComparison } from '../components/PresetComparison'
import { ExportButton } from '../components/ExportButton'
import { RoutingLogsViewer } from '../components/RoutingLogsViewer'
import { BudgetDashboard } from '../components/BudgetDashboard'
import { ClaudeMaxUsage } from '../components/ClaudeMaxUsage'
import { CopilotUsage } from '../components/CopilotUsage'
import { Settings } from '../components/Settings'
import { StatsDashboard } from '../components/StatsDashboard'

type TabType = 'presets' | 'routing' | 'budget' | 'usage' | 'settings' | 'export' | 'stats'

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('budget')

return (
    <div style={{ padding: 'var(--spacing-3)', fontFamily: 'var(--font-family-sans)', minHeight: '100vh', background: 'var(--color-bg-secondary)' }}>
      <header className="header" style={{ marginBottom: 'var(--spacing-3)' }}>
        <h1 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, margin: 0 }}>oh-im-broke Dashboard</h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 'var(--spacing-1) 0 0 0' }}>Budget-conscious AI orchestration</p>
      </header>

<nav className="nav-tabs" style={{ marginBottom: 'var(--spacing-4)', display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
        <button
          className={activeTab === 'presets' ? 'active' : ''}
          onClick={() => setActiveTab('presets')}
          style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}
        >
          Presets
        </button>
        <button
          className={activeTab === 'routing' ? 'active' : ''}
          onClick={() => setActiveTab('routing')}
          style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}
        >
          Routing Logs
        </button>
        <button
          className={activeTab === 'budget' ? 'active' : ''}
          onClick={() => setActiveTab('budget')}
          style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}
        >
          Budget
        </button>
        <button
          className={activeTab === 'usage' ? 'active' : ''}
          onClick={() => setActiveTab('usage')}
          style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}
        >
          Usage
        </button>
        <button
          className={activeTab === 'settings' ? 'active' : ''}
          onClick={() => setActiveTab('settings')}
          style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}
        >
          ⚙️ Settings
        </button>
        <button
          className={activeTab === 'export' ? 'active' : ''}
          onClick={() => setActiveTab('export')}
          style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}
        >
          Export
        </button>
        <button
          className={activeTab === 'stats' ? 'active' : ''}
          onClick={() => setActiveTab('stats')}
          style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}
        >
          📊 Stats
        </button>
      </nav>

      <main>
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
          <BudgetDashboard />
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
    </div>
  )
}

export default App
