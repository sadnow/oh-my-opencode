import React from 'react';

interface BudgetGaugeProps {
  percentage: number;
  label?: string;
  size?: number;
  strokeWidth?: number;
}

/**
 * BudgetGauge - A compact, professional circular progress gauge.
 * Follows Bloomberg Terminal aesthetic: high information density, subtle but clear status colors.
 */
export const BudgetGauge: React.FC<BudgetGaugeProps> = ({
  percentage,
  label,
  size = 80,
  strokeWidth = 8,
}) => {
  // Clamp percentage between 0 and 100
  const clampedPercentage = Math.min(100, Math.max(0, percentage));
  
  // SVG Circle calculations
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedPercentage / 100) * circumference;

  // Color logic based on thresholds
  const getStatusColor = (pct: number) => {
    if (pct >= 90) return 'var(--color-status-error)';
    if (pct >= 70) return 'var(--color-status-warning)';
    if (pct >= 50) return 'var(--color-status-info)';
    return 'var(--color-status-success)';
  };

  const statusColor = getStatusColor(clampedPercentage);

  return (
    <div 
      className="budget-gauge-container"
      style={{ 
        width: size, 
        height: size, 
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-family-mono)',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Background Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          stroke="var(--color-bg-tertiary)"
          strokeWidth={strokeWidth}
        />
        {/* Progress Bar */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          stroke={statusColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          style={{
            strokeDashoffset: offset,
            transition: 'stroke-dashoffset var(--transition-normal), stroke var(--transition-normal)',
            strokeLinecap: 'round',
          }}
        />
      </svg>
      
      {/* Center Text */}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            fontSize: size * 0.22,
            fontWeight: 'bold',
            color: 'var(--color-text-primary)',
            lineHeight: 1,
          }}
        >
          {Math.round(clampedPercentage)}%
        </span>
        {label && (
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-secondary)',
              marginTop: '2px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
};

export default BudgetGauge;
