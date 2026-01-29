import { useState } from 'react'
import { PresetComparison } from '../components/PresetComparison'
import { ExportButton } from '../components/ExportButton'

type TabType = 'presets' | 'routing' | 'budget' | 'export'

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('presets')
  
  const tabStyle = (tab: TabType) => ({
    padding: '10px 20px',
    border: 'none',
    background: activeTab === tab ? '#0066cc' : '#f0f0f0',
    color: activeTab === tab ? 'white' : '#333',
    cursor: 'pointer',
    marginRight: '5px',
    borderRadius: '4px 4px 0 0',
    fontWeight: activeTab === tab ? 'bold' : 'normal',
  })
  
  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <header>
        <h1 style={{ margin: 0, color: '#333' }}>oh-im-broke Dashboard</h1>
        <p style={{ color: '#666', marginTop: '5px' }}>Budget-conscious AI orchestration</p>
        <nav style={{ marginTop: '20px', borderBottom: '2px solid #0066cc' }}>
          <button onClick={() => setActiveTab('presets')} style={tabStyle('presets')}>
            Presets
          </button>
          <button onClick={() => setActiveTab('routing')} style={tabStyle('routing')}>
            Routing Logs
          </button>
          <button onClick={() => setActiveTab('budget')} style={tabStyle('budget')}>
            Budget
          </button>
          <button onClick={() => setActiveTab('export')} style={tabStyle('export')}>
            Export
          </button>
        </nav>
      </header>
      
      <main style={{ marginTop: '30px' }}>
        {activeTab === 'presets' && (
          <div>
            <PresetComparison />
          </div>
        )}
        
        {activeTab === 'routing' && (
          <div>
            <h2>Routing Logs</h2>
            <p style={{ color: '#666' }}>Model selection decisions and tier changes</p>
            <div style={{ padding: '20px', background: '#f9f9f9', borderRadius: '4px' }}>
              <p>Coming soon: Real-time routing logs viewer</p>
              <p style={{ fontSize: '14px', color: '#888' }}>
                Will display data from /api/routing-logs
              </p>
            </div>
          </div>
        )}
        
        {activeTab === 'budget' && (
          <div>
            <h2>Budget Dashboard</h2>
            <p style={{ color: '#666' }}>Usage tracking and cost analysis</p>
            <div style={{ padding: '20px', background: '#f9f9f9', borderRadius: '4px' }}>
              <p>Coming soon: Budget orchestration dashboard</p>
              <p style={{ fontSize: '14px', color: '#888' }}>
                Will display data from /api/budget/dashboard
              </p>
            </div>
          </div>
        )}
        
        {activeTab === 'export' && (
          <div>
            <h2>Export Data</h2>
            <p style={{ color: '#666' }}>Download usage, config, and logs</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
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
      </main>
    </div>
  )
}

export default App
