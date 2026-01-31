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
    <div style={{ padding: '20px', fontFamily: 'var(--font-family)', minHeight: '100vh', background: 'var(--color-bg-secondary)' }}>
      <header className="header">
        <h1>oh-im-broke Dashboard</h1>
        <p>Budget-conscious AI orchestration</p>
      </header>

      <nav className="nav-tabs" style={{ marginBottom: '30px' }}>
        <button
          className={activeTab === 'presets' ? 'active' : ''}
          onClick={() => setActiveTab('presets')}
        >
          Presets
        </button>
        <button
          className={activeTab === 'routing' ? 'active' : ''}
          onClick={() => setActiveTab('routing')}
        >
          Routing Logs
        </button>
        <button
          className={activeTab === 'budget' ? 'active' : ''}
          onClick={() => setActiveTab('budget')}
        >
          Budget
        </button>
        <button
          className={activeTab === 'usage' ? 'active' : ''}
          onClick={() => setActiveTab('usage')}
        >
          Usage
        </button>
        <button
          className={activeTab === 'settings' ? 'active' : ''}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Settings
        </button>
        <button
          className={activeTab === 'export' ? 'active' : ''}
          onClick={() => setActiveTab('export')}
        >
          Export
        </button>
        <button
          className={activeTab === 'stats' ? 'active' : ''}
          onClick={() => setActiveTab('stats')}
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
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-sm)' }}>
              Routing Logs
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
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
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-sm)' }}>
              Usage Tracking
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
              Real-time Claude Max and Copilot usage
            </p>
            <div style={{ display: 'grid', gap: '20px' }}>
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
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-sm)' }}>
              Export Data
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
              Download usage, config, and logs
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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
