#!/usr/bin/env node

/**
 * MCP Vision Bridge Server Entry Point
 * Main executable for the MCP Vision Bridge server
 */

import { MCPVisionServer } from './mcp-server'
import { loadConfig } from '../config/config-loader'
import { logger } from '../utils/logging'

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', reason, { promise })
  process.exit(1)
})

// Handle process signals
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully')
  await shutdown()
})

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully')
  await shutdown()
})

let server: MCPVisionServer | null = null

async function shutdown() {
  try {
    if (server) {
      await server.shutdown()
    }
    process.exit(0)
  } catch (error) {
    logger.error('Error during shutdown', error)
    process.exit(1)
  }
}

async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2)
    const configPath = args.find(arg => arg.startsWith('--config='))?.split('=')[1]
    const env = args.find(arg => arg.startsWith('--env='))?.split('=')[1]
    const help = args.includes('--help') || args.includes('-h')

    if (help) {
      printHelp()
      process.exit(0)
    }

    // Load configuration
    const config = await loadConfig(configPath, env)
    
    // Initialize and start server
    server = new MCPVisionServer()
    await server.initialize(configPath, env)
    
    logger.info('Starting MCP Vision Bridge Server...', {
      transport: config.server.transport,
      primaryModel: config.models.primary,
      logLevel: config.logging.level
    })

    await server.start()

  } catch (error) {
    logger.error('Failed to start server', error)
    process.exit(1)
  }
}

function printHelp() {
  console.log(`
MCP Vision Bridge Server

Usage: node dist/server/mcp-server.js [options]

Options:
  --config=<path>    Path to configuration file (JSON or YAML)
  --env=<environment> Environment (development, staging, production)
  --help, -h         Show this help message

Environment Variables:
  OPENROUTER_API_KEY     OpenRouter API key (required)
  VISION_MODEL_PRIMARY   Primary vision model
  VISION_MODEL_FALLBACK  Fallback vision models (comma-separated)
  LOG_LEVEL             Log level (debug, info, warn, error)
  MAX_IMAGE_SIZE        Maximum image size in bytes
  RATE_LIMIT_REQUESTS   Rate limit requests per window
  RATE_LIMIT_WINDOW     Rate limit window in milliseconds

Examples:
  # Start with default settings
  node dist/server/mcp-server.js

  # Start with custom config file
  node dist/server/mcp-server.js --config=./config.production.json

  # Start with environment
  node dist/server/mcp-server.js --env=production

  # Set environment variables
  OPENROUTER_API_KEY=your-key node dist/server/mcp-server.js
`)
}

// Start the server
if (require.main === module) {
  main().catch((error) => {
    logger.error('Fatal error', error)
    process.exit(1)
  })
}

export { MCPVisionServer }