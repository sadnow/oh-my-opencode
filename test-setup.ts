import { beforeEach, afterEach } from "bun:test"
import { _resetForTesting } from "./src/features/claude-code-session-state/state"
import { _resetOibSessionStateForTesting } from "./src/hooks/oib-autoselect"
import { resetGlobalOverrideManager } from "./src/features/budget-orchestrator/global-override"
import { resetOverrideManager } from "./src/features/budget-orchestrator/override"
import { resetWeightCalculator } from "./src/features/budget-orchestrator/provider-weight-calculator"
import { resetClaudeMaxUsageTracker } from "./src/features/claude-max-usage"

// Store original TMUX value to prevent test pollution
const ORIGINAL_TMUX = process.env.TMUX

beforeEach(() => {
  // Reset session state
  _resetForTesting()
  _resetOibSessionStateForTesting()
  
  // Reset budget orchestrator singletons
  resetGlobalOverrideManager()
  resetOverrideManager()
  resetWeightCalculator()
  
  // Reset usage trackers
  resetClaudeMaxUsageTracker()
})

afterEach(() => {
  // Restore TMUX environment variable to prevent test pollution from module mocks
  if (ORIGINAL_TMUX !== undefined) {
    process.env.TMUX = ORIGINAL_TMUX
  } else {
    delete process.env.TMUX
  }
})
