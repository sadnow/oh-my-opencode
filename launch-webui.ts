#!/usr/bin/env bun
/**
 * Standalone WebUI Launcher for oh-im-broke
 * 
 * This script starts the oh-im-broke WebUI dashboard on port 3847
 * and opens it in your default browser.
 * 
 * Usage:
 *   bun run launch-webui.ts
 * 
 * Or add to package.json scripts:
 *   "webui": "bun run launch-webui.ts"
 */

import { startWebUI } from './src/webui/index'
import { exec } from 'child_process'
import { promisify } from 'util'
import { logger } from './src/shared/logger'

const execAsync = promisify(exec)

const PORT = 3847
const BIND = '0.0.0.0'

async function main() {
  logger.info('🚀 oh-im-broke WebUI Dashboard')

  try {
    // Start the WebUI server
    // Note: In production, you'd pass real configManager, usageTracker, budgetOrchestrator
    // For now, we'll start with minimal config
    const server = startWebUI({
      port: PORT,
      bind: BIND,
      configManager: null as any, // TODO: Initialize real config manager
      usageTracker: null,
      budgetOrchestrator: null,
    })

    logger.info('✅ Server started', { port: PORT, url: `http://localhost:${PORT}` })

    // Open browser cross-platform
    const url = `http://localhost:${PORT}`
    let openCommand: string

    switch (process.platform) {
      case 'win32':
        openCommand = `start ${url}`
        break
      case 'darwin':
        openCommand = `open ${url}`
        break
      default: // Linux and others
        openCommand = `xdg-open ${url}`
        break
    }

    try {
      await execAsync(openCommand)
      logger.info('🌐 Opening browser...')
    } catch (error) {
      logger.warn('⚠️  Could not open browser automatically')
      logger.info('Please open manually', { url })
    }

    logger.info('Dashboard features: Preset comparison, Budget health, Routing logs, Export data, Progressive disclosure')

    logger.info('Press Ctrl+C to stop the server.')

    // Keep process alive
    process.on('SIGINT', () => {
      logger.info('👋 Shutting down server...')
      server.stop()
      process.exit(0)
    })

  } catch (error: any) {
    if (error.code === 'EADDRINUSE') {
      logger.error('❌ Port already in use', { port: PORT })
      logger.info('WebUI server may already be running', { url: `http://localhost:${PORT}` })
      process.exit(1)
    } else {
      logger.error('❌ Failed to start server', { error: error.message })
      process.exit(1)
    }
  }
}

main()
