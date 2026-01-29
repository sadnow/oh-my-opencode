import { useUserMode } from '../hooks/useUserMode'

export function ModeToggle() {
  const [mode, setMode] = useUserMode()

  const toggleMode = () => {
    setMode(mode === 'beginner' ? 'power-user' : 'beginner')
  }

  return (
    <button
      onClick={toggleMode}
      className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
    >
      {mode === 'beginner' ? 'Switch to Power User' : 'Switch to Beginner'}
    </button>
  )
}