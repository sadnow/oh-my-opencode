import React, { useState, useMemo } from 'react';

interface SpendingData {
  hour: number;
  day: number;
  amount: number;
}

interface SpendingHeatmapProps {
  data: SpendingData[];
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Color scale for spending intensity (Bloomberg Terminal aesthetic)
const getColorForIntensity = (intensity: number): string => {
  if (intensity === 0) return 'var(--color-bg-tertiary)';
  if (intensity < 0.2) return 'var(--color-data-neutral)';
  if (intensity < 0.4) return 'var(--color-accent-primary)';
  if (intensity < 0.6) return 'var(--color-accent-secondary)';
  if (intensity < 0.8) return 'var(--color-accent-warning)';
  return 'var(--color-accent-error)';
};

export function SpendingHeatmap({ data }: SpendingHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{ hour: number; day: number } | null>(null);

  // Build data matrix and calculate max amount for scaling
  const { dataMatrix, maxAmount } = useMemo(() => {
    const matrix: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));
    let max = 0;

    data.forEach(({ hour, day, amount }) => {
      if (day >= 0 && day < 7 && hour >= 0 && hour < 24) {
        matrix[day][hour] = amount;
        if (amount > max) max = amount;
      }
    });

    return { dataMatrix: matrix, maxAmount: max };
  }, [data]);

  const getIntensity = (amount: number): number => {
    if (maxAmount === 0) return 0;
    return amount / maxAmount;
  };

  const formatAmount = (amount: number): string => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
    return `$${amount.toFixed(2)}`;
  };

  const cellSize = 24;
  const gap = 2;
  const gridWidth = 24 * (cellSize + gap) - gap;
  const gridHeight = 7 * (cellSize + gap) - gap;
  const labelWidth = 40;
  const labelHeight = 20;

  return (
    <div className="spending-heatmap">
      <svg
        width={gridWidth + labelWidth}
        height={gridHeight + labelHeight}
        style={{
          fontFamily: 'var(--font-family-mono)',
          fontSize: 'var(--font-size-xs)',
        }}
      >
        {/* Day labels */}
        {DAYS.map((day, dayIndex) => (
          <text
            key={day}
            x={labelWidth - 5}
            y={dayIndex * (cellSize + gap) + cellSize / 2 + 4}
            textAnchor="end"
            fill="var(--color-text-secondary)"
          >
            {day}
          </text>
        ))}

        {/* Hour labels */}
        {HOURS.filter((h) => h % 3 === 0).map((hour) => (
          <text
            key={hour}
            x={labelWidth + hour * (cellSize + gap) + cellSize / 2}
            y={gridHeight + 15}
            textAnchor="middle"
            fill="var(--color-text-muted)"
          >
            {hour}
          </text>
        ))}

        {/* Heatmap cells */}
        {dataMatrix.map((row, dayIndex) =>
          row.map((amount, hourIndex) => {
            const intensity = getIntensity(amount);
            const color = getColorForIntensity(intensity);
            const x = labelWidth + hourIndex * (cellSize + gap);
            const y = dayIndex * (cellSize + gap);

            return (
              <g key={`${dayIndex}-${hourIndex}`}>
                <rect
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  fill={color}
                  rx={2}
                  onMouseEnter={() => setHoveredCell({ hour: hourIndex, day: dayIndex })}
                  onMouseLeave={() => setHoveredCell(null)}
                  style={{ cursor: 'pointer', transition: 'fill var(--transition-fast)' }}
                />
              </g>
            );
          })
        )}

        {/* Tooltip */}
        {hoveredCell && (
          <g>
            <rect
              x={labelWidth + hoveredCell.hour * (cellSize + gap) + cellSize + 5}
              y={hoveredCell.day * (cellSize + gap)}
              width={140}
              height={55}
              fill="var(--color-bg-elevated)"
              stroke="var(--color-border-default)"
              rx={4}
            />
            <text
              x={labelWidth + hoveredCell.hour * (cellSize + gap) + cellSize + 15}
              y={hoveredCell.day * (cellSize + gap) + 15}
              fill="var(--color-text-primary)"
              fontSize="var(--font-size-xs)"
            >
              {DAYS[hoveredCell.day]} {hoveredCell.hour}:00
            </text>
            <text
              x={labelWidth + hoveredCell.hour * (cellSize + gap) + cellSize + 15}
              y={hoveredCell.day * (cellSize + gap) + 32}
              fill="var(--color-accent-primary)"
              fontSize="var(--font-size-sm)"
              fontWeight="bold"
            >
              {formatAmount(dataMatrix[hoveredCell.day][hoveredCell.hour])}
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-2)',
          marginTop: 'var(--spacing-3)',
          fontFamily: 'var(--font-family-mono)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-muted)',
        }}
      >
        <span>Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((intensity, i) => (
          <div
            key={i}
            style={{
              width: 16,
              height: 16,
              backgroundColor: getColorForIntensity(intensity),
              borderRadius: 'var(--radius-sm)',
            }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}