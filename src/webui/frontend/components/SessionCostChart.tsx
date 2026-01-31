import React, { useState, useEffect, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

interface SessionData {
  sessionId: string;
  date: string;
  provider: string;
  cost: number;
}

interface SessionsResponse {
  success: boolean;
  data: {
    sessions: SessionData[];
  };
}

interface GroupedSessionData {
  date: string;
  sessions: SessionData[];
  totalCost: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${month}/${day}`;
};

const getProviderColor = (provider: string): string => {
  const colors: Record<string, string> = {
    'anthropic': 'var(--color-accent-primary)',
    'openai': 'var(--color-accent-secondary)',
    'google': 'var(--color-accent-info)',
    'claude-max': 'var(--color-accent-warning)',
    'copilot': 'var(--color-accent-error)',
  };
  return colors[provider] || 'var(--color-data-neutral)';
};

const getProviderDisplayName = (provider: string): string => {
  const names: Record<string, string> = {
    'anthropic': 'Anthropic',
    'openai': 'OpenAI',
    'google': 'Google',
    'claude-max': 'Claude Max',
    'copilot': 'GitHub Copilot',
  };
  return names[provider] || provider;
};

// ============================================================================
// Main Component
// ============================================================================

export function SessionCostChart() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [hoveredSession, setHoveredSession] = useState<SessionData | null>(null);

  // Fetch sessions data
  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/stats/sessions');
        const data: SessionsResponse = await response.json();

        if (data.success) {
          setSessions(data.data.sessions);
        } else {
          setError('Failed to fetch session data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  // Get unique providers
  const providers = useMemo(() => {
    const providerSet = new Set(sessions.map(s => s.provider));
    return Array.from(providerSet).sort();
  }, [sessions]);

  // Filter sessions by provider
  const filteredSessions = useMemo(() => {
    if (selectedProvider === 'all') {
      return sessions;
    }
    return sessions.filter(s => s.provider === selectedProvider);
  }, [sessions, selectedProvider]);

  // Group sessions by date
  const groupedData = useMemo(() => {
    const grouped = new Map<string, SessionData[]>();

    filteredSessions.forEach(session => {
      if (!grouped.has(session.date)) {
        grouped.set(session.date, []);
      }
      grouped.get(session.date)!.push(session);
    });

    // Convert to array and sort by date
    const result: GroupedSessionData[] = Array.from(grouped.entries())
      .map(([date, sessions]) => ({
        date,
        sessions,
        totalCost: sessions.reduce((sum, s) => sum + s.cost, 0),
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return result;
  }, [filteredSessions]);

  // Calculate chart dimensions and scales
  const { chartWidth, chartHeight, padding, maxCost, barWidth, gap } = useMemo(() => {
    const width = 800;
    const height = 300;
    const pad = { top: 40, right: 20, bottom: 60, left: 80 };
    const chartWidth = width - pad.left - pad.right;
    const chartHeight = height - pad.top - pad.bottom;

    const maxCost = Math.max(...groupedData.map(d => d.totalCost), 1);

    const numBars = groupedData.length;
    const availableWidth = chartWidth;
    const barWidth = Math.max(20, Math.min(60, (availableWidth / numBars) - 4));
    const gap = Math.max(4, (availableWidth - (barWidth * numBars)) / (numBars + 1));

    return { chartWidth, chartHeight, padding: pad, maxCost, barWidth, gap };
  }, [groupedData]);

  // Y scale: cost to pixels (inverted, 0 at bottom)
  const yScale = (cost: number): number => {
    const ratio = cost / maxCost;
    return padding.top + chartHeight - ratio * chartHeight;
  };

  // X scale: index to pixels
  const xScale = (index: number): number => {
    return padding.left + gap + index * (barWidth + gap);
  };

  if (loading) {
    return (
      <div style={{
        padding: 'var(--spacing-4)',
        textAlign: 'center',
        color: 'var(--color-text-secondary)',
        fontFamily: 'var(--font-family-sans)',
        fontSize: 'var(--font-size-sm)',
      }}>
        Loading session cost data...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: 'var(--spacing-3)',
        background: 'var(--color-accent-error)20',
        border: '1px solid var(--color-accent-error)',
        color: 'var(--color-accent-error)',
        borderRadius: 'var(--radius-md)',
        fontFamily: 'var(--font-family-sans)',
        fontSize: 'var(--font-size-sm)',
      }}>
        <strong>Error:</strong> {error}
      </div>
    );
  }

  if (groupedData.length === 0) {
    return (
      <div style={{
        padding: 'var(--spacing-4)',
        textAlign: 'center',
        color: 'var(--color-text-secondary)',
        fontFamily: 'var(--font-family-sans)',
        fontSize: 'var(--font-size-sm)',
      }}>
        No session data available
      </div>
    );
  }

  return (
    <div className="session-cost-chart">
      {/* Header */}
      <div style={{
        marginBottom: 'var(--spacing-3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h3 style={{
            margin: 0,
            fontSize: 'var(--font-size-md)',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
          }}>
            Session Cost Chart
          </h3>
          <p style={{
            margin: 'var(--spacing-1) 0 0 0',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
          }}>
            Spending per session grouped by date
          </p>
        </div>

        {/* Provider filter */}
        <select
          value={selectedProvider}
          onChange={(e) => setSelectedProvider(e.target.value)}
          style={{
            padding: 'var(--spacing-2) var(--spacing-3)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border-default)',
            background: 'var(--color-bg-tertiary)',
            color: 'var(--color-text-primary)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-sm)',
            fontFamily: 'var(--font-family-sans)',
          }}
        >
          <option value="all">All Providers</option>
          {providers.map(provider => (
            <option key={provider} value={provider}>
              {getProviderDisplayName(provider)}
            </option>
          ))}
        </select>
      </div>

      {/* Chart */}
      <svg
        width={chartWidth + padding.left + padding.right}
        height={chartHeight + padding.top + padding.bottom}
        style={{
          fontFamily: 'var(--font-family-mono)',
          fontSize: 'var(--font-size-xs)',
        }}
      >
        {/* Background */}
        <rect
          x={0}
          y={0}
          width={chartWidth + padding.left + padding.right}
          height={chartHeight + padding.top + padding.bottom}
          fill="var(--color-bg-secondary)"
          rx="var(--radius-md)"
        />

        {/* Grid lines (horizontal) */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + chartHeight * (1 - ratio);
          return (
            <line
              key={ratio}
              x1={padding.left}
              y1={y}
              x2={padding.left + chartWidth}
              y2={y}
              stroke="var(--color-border-subtle)"
              strokeWidth={1}
              strokeDasharray="4,4"
            />
          );
        })}

        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + chartHeight * (1 - ratio);
          const cost = maxCost * ratio;
          return (
            <text
              key={ratio}
              x={padding.left - 10}
              y={y + 4}
              textAnchor="end"
              fill="var(--color-text-muted)"
              fontSize="var(--font-size-xs)"
            >
              {formatCurrency(cost)}
            </text>
          );
        })}

        {/* Bars */}
        {groupedData.map((group, index) => {
          const x = xScale(index);
          const y = yScale(group.totalCost);
          const height = (padding.top + chartHeight) - y;
          const isHovered = hoveredSession?.date === group.date;

          return (
            <g key={group.date}>
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={height}
                fill={getProviderColor(group.sessions[0]?.provider || 'unknown')}
                opacity={isHovered ? 0.9 : 0.7}
                style={{
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={() => setHoveredSession(group.sessions[0])}
                onMouseLeave={() => setHoveredSession(null)}
              />

              {/* X-axis label */}
              <text
                x={x + barWidth / 2}
                y={padding.top + chartHeight + 20}
                textAnchor="middle"
                fill="var(--color-text-muted)"
                fontSize="var(--font-size-xs)"
                transform={`rotate(-45, ${x + barWidth / 2}, ${padding.top + chartHeight + 20})`}
              >
                {formatDate(group.date)}
              </text>

              {/* Value label on top of bar */}
              <text
                x={x + barWidth / 2}
                y={y - 8}
                textAnchor="middle"
                fill="var(--color-text-primary)"
                fontSize="var(--font-size-xs)"
                fontWeight="bold"
              >
                {formatCurrency(group.totalCost)}
              </text>
            </g>
          );
        })}

        {/* Tooltip */}
        {hoveredSession && (
          <g>
            <rect
              x={padding.left + chartWidth / 2 - 100}
              y={padding.top}
              width={200}
              height={80}
              fill="var(--color-bg-elevated)"
              stroke="var(--color-border-default)"
              rx="var(--radius-sm)"
            />
            <text
              x={padding.left + chartWidth / 2}
              y={padding.top + 20}
              textAnchor="middle"
              fill="var(--color-text-primary)"
              fontSize="var(--font-size-sm)"
              fontWeight="bold"
            >
              {hoveredSession.sessionId}
            </text>
            <text
              x={padding.left + chartWidth / 2}
              y={padding.top + 40}
              textAnchor="middle"
              fill="var(--color-text-secondary)"
              fontSize="var(--font-size-xs)"
            >
              {formatDate(hoveredSession.date)}
            </text>
            <text
              x={padding.left + chartWidth / 2}
              y={padding.top + 60}
              textAnchor="middle"
              fill={getProviderColor(hoveredSession.provider)}
              fontSize="var(--font-size-xs)"
              fontWeight="bold"
            >
              {formatCurrency(hoveredSession.cost)}
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: 'var(--spacing-3)',
        marginTop: 'var(--spacing-3)',
        fontFamily: 'var(--font-family-mono)',
        fontSize: 'var(--font-size-xs)',
        color: 'var(--color-text-muted)',
      }}>
        {providers.map(provider => (
          <div key={provider} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
            <div
              style={{
                width: 12,
                height: 12,
                backgroundColor: getProviderColor(provider),
                borderRadius: '2px',
              }}
            />
            <span>{getProviderDisplayName(provider)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}