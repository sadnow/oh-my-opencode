import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { WebUIMode } from '../../../config/schema'

interface ModeContextValue {
  mode: WebUIMode
  setMode: (mode: WebUIMode) => void
}

const ModeContext = createContext<ModeContextValue>({
  mode: 'beginner',
  setMode: () => {}
})

interface ModeProviderProps {
  children: ReactNode
  defaultMode?: WebUIMode
}

export function ModeProvider({ children, defaultMode }: ModeProviderProps) {
  const [mode, setModeState] = useState<WebUIMode>(() => {
    // Priority: config override > localStorage > default
    if (defaultMode) {
      return defaultMode
    }

    const stored = localStorage.getItem('oh-im-broke-user-mode')
    if (stored === 'beginner' || stored === 'power-user') {
      return stored
    }

    return 'beginner'
  })

  const setMode = (newMode: WebUIMode) => {
    setModeState(newMode)
    localStorage.setItem('oh-im-broke-user-mode', newMode)
  }

  // Sync with config changes
  useEffect(() => {
    if (defaultMode && mode !== defaultMode) {
      setModeState(defaultMode)
    }
  }, [defaultMode])

  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ModeContext.Provider>
  )
}

export function useMode(): ModeContextValue {
  const context = useContext(ModeContext)
  if (!context) {
    throw new Error('useMode must be used within a ModeProvider')
  }
  return context
}