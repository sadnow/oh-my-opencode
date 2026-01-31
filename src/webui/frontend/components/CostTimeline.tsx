import React, { useState, useMemo } from 'react';

interface TimelineEvent {
  timestamp: string;
  type: string;
  message: string;
}

interface SpendingData {
  timestamp: string;
  amount: number;
}

interface CostTimelineProps {
  events: TimelineEvent[];
  spendingData: SpendingData[];
}

type TimeRange = '1H' | '24H' | '1W' | '1M';

const TIME_RANGES: Record<TimeRange, number> = {
  '1H': 60 * 60 * 1000,      // 1 hour
  '24H': 24 * 60 * 60 * 1000, // 24 hours
  '1W': 7 * 24 * 60 * 60 * 1000, // 1 week
  '1M': 30 * 24 * 60 * 60 * 1000, // 1 month
};

// Color scale for event types (Bloomberg Terminal aesthetic)
const getEventColor = (type: string): string => {
  const typeLower = type.toLowerCase();
  if (typeLower.includes('alert') || typeLower.includes('error')) {
    return 'var(--color-accent-error)';
  }
  if (typeLower.includes('warning')) {
    return 'var(--color-accent-warning)';
  }
  if (typeLower.includes('tier') || typeLower.includes('change')) {
    return 'var(--color-accent-primary)';
  }
  if (typeLower.includes('anomaly')) {
    return 'var(--color-accent-secondary)';
  }
  return 'var(--color-accent-info)';
};

export function CostTimeline({ events, spendingData }: CostTimelineProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('24H');
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null);

  // Calculate time window
  const { startTime, endTime, filteredEvents, filteredSpending } = useMemo(() => {
    const now = Date.now();
    const rangeMs = TIME_RANGES[timeRange];
    const start = now - rangeMs;
    const end = now;

    const filteredEvents = events.filter(
      (e) => new Date(e.timestamp).getTime() >= start && new Date(e.timestamp).getTime() <= end
    );

    const filteredSpending = spendingData.filter(
      (d) => new Date(d.timestamp).getTime() >= start && new Date(d.timestamp).getTime() <= end
    );

    return { startTime: start, endTime: end, filteredEvents, filteredSpending };
  }, [events, spendingData, timeRange]);

  // Calculate chart dimensions and scales
  const { chartWidth, chartHeight, padding, xScale, yScale, maxAmount } = useMemo(() => {
    const width = 800;
    const height = 200;
    const pad = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - pad.left - pad.right;
    const chartHeight = height - pad.top - pad.bottom;

    // Calculate max amount for Y scale
    const maxAmount = Math.max(...filteredSpending.map((d) => d.amount), 1);

    // X scale: time to pixels
    const xScale = (timestamp: string): number => {
      const time = new Date(timestamp).getTime();
      const ratio = (time - startTime) / (endTime - startTime);
      return pad.left + ratio * chartWidth;
    };

    // Y scale: amount to pixels (inverted, 0 at bottom)
    const yScale = (amount: number): number => {
      const ratio = amount / maxAmount;
      return pad.top + chartHeight - ratio * chartHeight;
    };

    return { chartWidth, chartHeight, padding: pad, xScale, yScale, maxAmount };
  }, [startTime, endTime, filteredSpending]);

  // Format time for labels
  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Format date for labels
  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}/${day}`;
  };

  // Format amount
  const formatAmount = (amount: number): string => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
    return `$${amount.toFixed(2)}`;
  };

  // Generate spending curve path
  const spendingPath = useMemo(() => {
    if (filteredSpending.length === 0) return '';

    const points = filteredSpending
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map((d) => {
        const x = xScale(d.timestamp);
        const y = yScale(d.amount);
        return `${x},${y}`;
      });

    return points.join(' ');
  }, [filteredSpending, xScale, yScale]);

  // Generate area fill path
  const areaPath = useMemo(() => {
    if (filteredSpending.length === 0) return '';

    const points = filteredSpending
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map((d) => {
        const x = xScale(d.timestamp);
        const y = yScale(d.amount);
        return `${x},${y}`;
      });

    const firstX = xScale(filteredSpending[0].timestamp);
    const lastX = xScale(filteredSpending[filteredSpending.length - 1].timestamp);
    const bottomY = padding.top + chartHeight;

    return `${points.join(' ')} ${lastX},${bottomY} ${firstX},${bottomY}`;
  }, [filteredSpending, xScale, yScale, padding, chartHeight]);

  return (
    <div className="cost-timeline">
      {/* Zoom controls */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--spacing-2)',
          marginBottom: 'var(--spacing-3)',
          fontFamily: 'var(--font-family-mono)',
          fontSize: 'var(--font-size-xs)',
        }}
      >
        {(['1H', '24H', '1W', '1M'] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            style={{
              padding: 'var(--spacing-1) var(--spacing-2)',
              backgroundColor: timeRange === range ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)',
              color: timeRange === range ? 'var(--color-bg-primary)' : 'var(--color-text-secondary)',
              border: `1px solid ${timeRange === range ? 'var(--color-accent-primary)' : 'var(--color-border-default)'}`,
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-xs)',
              fontFamily: 'var(--font-family-mono)',
              transition: 'all var(--transition-fast)',
            }}
          >
            {range}
          </button>
        ))}
      </div>

      {/* Timeline chart */}
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
          const amount = maxAmount * ratio;
          return (
            <text
              key={ratio}
              x={padding.left - 10}
              y={y + 4}
              textAnchor="end"
              fill="var(--color-text-muted)"
              fontSize="var(--font-size-xs)"
            >
              {formatAmount(amount)}
            </text>
          );
        })}

        {/* X-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const x = padding.left + chartWidth * ratio;
          const time = new Date(startTime + (endTime - startTime) * ratio);
          const label = timeRange === '1H' ? formatTime(time.toISOString()) : formatDate(time.toISOString());
          return (
            <text
              key={ratio}
              x={x}
              y={padding.top + chartHeight + 20}
              textAnchor="middle"
              fill="var(--color-text-muted)"
              fontSize="var(--font-size-xs)"
            >
              {label}
            </text>
          );
        })}

        {/* Spending area fill */}
        {areaPath && (
          <polygon
            points={areaPath}
            fill="var(--color-accent-primary)"
            fillOpacity={0.1}
          />
        )}

        {/* Spending curve */}
        {spendingPath && (
          <polyline
            points={spendingPath}
            fill="none"
            stroke="var(--color-accent-primary)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Event markers */}
        {filteredEvents.map((event, index) => {
          const x = xScale(event.timestamp);
          const y = padding.top + chartHeight / 2; // Center vertically
          const color = getEventColor(event.type);
          const isSelected = selectedEvent?.timestamp === event.timestamp;
          const isHovered = hoveredEvent?.timestamp === event.timestamp;

          return (
            <g key={index}>
              {/* Vertical line to curve */}
              <line
                x1={x}
                y1={padding.top}
                x2={x}
                y2={padding.top + chartHeight}
                stroke={color}
                strokeWidth={isSelected || isHovered ? 2 : 1}
                strokeDasharray="4,4"
                opacity={isSelected || isHovered ? 0.8 : 0.3}
              />

              {/* Event point */}
              <circle
                cx={x}
                cy={y}
                r={isSelected || isHovered ? 8 : 6}
                fill={color}
                stroke="var(--color-bg-secondary)"
                strokeWidth={2}
                style={{ cursor: 'pointer', transition: 'all var(--transition-fast)' }}
                onClick={() => setSelectedEvent(event)}
                onMouseEnter={() => setHoveredEvent(event)}
                onMouseLeave={() => setHoveredEvent(null)}
              />

              {/* Event label (on hover) */}
              {(isHovered || isSelected) && (
                <g>
                  <rect
                    x={x + 12}
                    y={y - 20}
                    width={150}
                    height={40}
                    fill="var(--color-bg-elevated)"
                    stroke="var(--color-border-default)"
                    rx="var(--radius-sm)"
                  />
                  <text
                    x={x + 20}
                    y={y - 4}
                    fill="var(--color-text-primary)"
                    fontSize="var(--font-size-xs)"
                    fontWeight="bold"
                  >
                    {event.type}
                  </text>
                  <text
                    x={x + 20}
                    y={y + 12}
                    fill="var(--color-text-secondary)"
                    fontSize="var(--font-size-xs)"
                  >
                    {formatTime(event.timestamp)}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Event details panel */}
      {selectedEvent && (
        <div
          style={{
            marginTop: 'var(--spacing-3)',
            padding: 'var(--spacing-3)',
            backgroundColor: 'var(--color-bg-tertiary)',
            border: `1px solid var(--color-border-default)`,
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-family-mono)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--spacing-2)',
            }}
          >
            <span
              style={{
                color: getEventColor(selectedEvent.type),
                fontWeight: 'bold',
                fontSize: 'var(--font-size-md)',
              }}
            >
              {selectedEvent.type}
            </span>
            <button
              onClick={() => setSelectedEvent(null)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-lg)',
                padding: 0,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
          <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-2)' }}>
            {new Date(selectedEvent.timestamp).toLocaleString()}
          </div>
          <div style={{ color: 'var(--color-text-primary)' }}>{selectedEvent.message}</div>
        </div>
      )}

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--spacing-3)',
          marginTop: 'var(--spacing-3)',
          fontFamily: 'var(--font-family-mono)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
          <div
            style={{
              width: 12,
              height: 12,
              backgroundColor: 'var(--color-accent-primary)',
              borderRadius: '50%',
            }}
          />
          <span>Spending</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
          <div
            style={{
              width: 12,
              height: 12,
              backgroundColor: 'var(--color-accent-error)',
              borderRadius: '50%',
            }}
          />
          <span>Alerts</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
          <div
            style={{
              width: 12,
              height: 12,
              backgroundColor: 'var(--color-accent-warning)',
              borderRadius: '50%',
            }}
          />
          <span>Warnings</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
          <div
            style={{
              width: 12,
              height: 12,
              backgroundColor: 'var(--color-accent-secondary)',
              borderRadius: '50%',
            }}
          />
          <span>Anomalies</span>
        </div>
      </div>
    </div>
  );
}