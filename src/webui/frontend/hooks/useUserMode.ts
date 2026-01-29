import { useMode } from '../context/ModeContext'
import type { WebUIMode } from '../../../config/schema'

export function useUserMode(): [WebUIMode, (mode: WebUIMode) => void] {
  const { mode, setMode } = useMode()
  return [mode, setMode]
}