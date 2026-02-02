import React, { useState, useEffect } from 'react';

interface Alert {
  timestamp: string;
  level: 'error' | 'warning' | 'info';
  message: string;
}

interface ApiResponse {
  success: boolean;
  data: {
    alerts: Alert[];
  };
}

type FilterLevel = 'all' | 'error' | 'warning' | 'info';

export const AlertTimeline: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<FilterLevel>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/alerts');
        const result: ApiResponse = await response.json();
        if (result.success) {
          // Sort by timestamp descending (newest first)
          const sortedAlerts = [...result.data.alerts].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          setAlerts(sortedAlerts);
        } else {
          setError('Failed to fetch alerts');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
    // Refresh every 30 seconds
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredAlerts = filter === 'all' 
    ? alerts 
    : alerts.filter(alert => alert.level === filter);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'var(--color-accent-error)';
      case 'warning': return 'var(--color-accent-warning)';
      case 'info': return 'var(--color-accent-info)';
      default: return 'var(--color-text-muted)';
    }
  };

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading && alerts.length === 0) {
    return <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', padding: 'var(--spacing-3)' }}>Loading alerts...</div>;
  }

  if (error && alerts.length === 0) {
    return <div style={{ color: 'var(--color-accent-error)', fontSize: 'var(--font-size-sm)', padding: 'var(--spacing-3)' }}>Error: {error}</div>;
  }

  return (
    <div style={{ 
      background: 'var(--color-bg-tertiary)', 
      borderRadius: 'var(--radius-md)', 
      border: '1px solid var(--color-border-default)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      maxHeight: '500px'
    }}>
      <div style={{ 
        padding: 'var(--spacing-2) var(--spacing-3)', 
        borderBottom: '1px solid var(--color-border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--color-bg-elevated)'
      }}>
        <h3 style={{ 
          margin: 0, 
          fontSize: 'var(--font-size-sm)', 
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          Alert Timeline
        </h3>
        <select 
          value={filter} 
          onChange={(e) => setFilter(e.target.value as FilterLevel)}
          style={{
            background: 'var(--color-bg-primary)',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border-strong)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--font-size-xs)',
            padding: '2px 4px',
            outline: 'none'
          }}
        >
          <option value="all">All Levels</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
      </div>

      <div style={{ 
        overflowY: 'auto', 
        padding: 'var(--spacing-3) var(--spacing-3) var(--spacing-3) var(--spacing-4)',
        position: 'relative'
      }}>
        {/* Vertical Line */}
        <div style={{
          position: 'absolute',
          left: 'var(--spacing-4)',
          top: 'var(--spacing-3)',
          bottom: 'var(--spacing-3)',
          width: '1px',
          background: 'var(--color-border-strong)',
          zIndex: 0
        }} />

        {filteredAlerts.length === 0 ? (
          <div style={{ 
            color: 'var(--color-text-dim)', 
            fontSize: 'var(--font-size-xs)', 
            textAlign: 'center',
            padding: 'var(--spacing-4) 0'
          }}>
            No alerts found
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
            {filteredAlerts.map((alert, index) => (
              <div key={`${alert.timestamp}-${index}`} style={{ 
                display: 'flex', 
                gap: 'var(--spacing-3)',
                position: 'relative',
                zIndex: 1
              }}>
                {/* Dot */}
                <div style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  background: getLevelColor(alert.level),
                  border: '2px solid var(--color-bg-tertiary)',
                  marginTop: '4px',
                  marginLeft: '-4px',
                  flexShrink: 0
                }} />
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'baseline' 
                  }}>
                    <span style={{ 
                      fontSize: 'var(--font-size-xs)', 
                      fontWeight: 600,
                      color: getLevelColor(alert.level),
                      textTransform: 'uppercase'
                    }}>
                      {alert.level}
                    </span>
                    <span style={{ 
                      fontSize: 'var(--font-size-xs)', 
                      color: 'var(--color-text-muted)',
                      fontFamily: 'var(--font-family-mono)'
                    }}>
                      {formatRelativeTime(alert.timestamp)}
                    </span>
                  </div>
                  <div style={{ 
                    fontSize: 'var(--font-size-sm)', 
                    color: 'var(--color-text-primary)',
                    lineHeight: 'var(--line-height-tight)',
                    wordBreak: 'break-word'
                  }}>
                    {alert.message}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
