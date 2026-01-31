import React, { useState, useEffect } from 'react';

/**
 * DensityToggle Component
 * Allows users to switch between 'compact' and 'comfortable' display modes.
 * Persists preference in localStorage and applies data-density attribute to document root.
 */
export const DensityToggle: React.FC = () => {
  const STORAGE_KEY = 'webui-density';
  const [density, setDensity] = useState<'compact' | 'comfortable'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return (saved === 'comfortable' || saved === 'compact') ? saved : 'compact';
    } catch {
      return 'compact';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-density', density);
    try {
      localStorage.setItem(STORAGE_KEY, density);
    } catch (e) {
      // Graceful fallback if localStorage is unavailable
      console.warn('Failed to save density preference to localStorage', e);
    }
  }, [density]);

  const toggleDensity = () => {
    setDensity(prev => prev === 'compact' ? 'comfortable' : 'compact');
  };

  return (
    <button
      onClick={toggleDensity}
      className="density-toggle-btn"
      aria-label={`Switch to ${density === 'compact' ? 'comfortable' : 'compact'} mode`}
      title={`Current: ${density.charAt(0).toUpperCase() + density.slice(1)}`}
    >
      <div className="density-toggle-icon">
        {density === 'compact' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8h16M4 16h16" />
          </svg>
        )}
      </div>
      <span className="density-toggle-label">
        {density === 'compact' ? 'Compact' : 'Comfortable'}
      </span>

      <style>{`
        .density-toggle-btn {
          display: flex;
          align-items: center;
          gap: var(--spacing-2, 8px);
          padding: var(--spacing-1, 4px) var(--spacing-2, 8px);
          background: var(--color-bg-tertiary, #1a1a1a);
          border: 1px solid var(--color-border-default, #333333);
          border-radius: var(--radius-sm, 4px);
          color: var(--color-text-primary, #e0e0e0);
          font-family: var(--font-family-sans, sans-serif);
          font-size: var(--font-size-xs, 11px);
          cursor: pointer;
          transition: var(--transition-fast, 150ms ease);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
        }

        .density-toggle-btn:hover {
          background: var(--color-bg-elevated, #222222);
          border-color: var(--color-accent-primary, #00bcd4);
          color: var(--color-accent-primary, #00bcd4);
        }

        .density-toggle-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.8;
        }

        .density-toggle-btn:hover .density-toggle-icon {
          opacity: 1;
        }

        .density-toggle-label {
          min-width: 70px;
          text-align: left;
        }
      `}</style>
    </button>
  );
};
