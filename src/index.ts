/**
 * Main exports for MCP Vision Bridge
 */

export { MCPVisionServer } from './server/mcp-server'
export { loadConfig, configLoader } from './config/config-loader'
export { logger, Logger } from './utils/logging'

// Core components
export { ImageProcessor } from './core/image-processor'
export { ModelRouter } from './core/model-router'
export { ResponseTransformer } from './core/response-transformer'

// Integrations
export { OpenRouterClient } from './integrations/openrouter/client'
export { ModelManager } from './integrations/openrouter/models'

// Types
export type {
  ServerConfig,
  VisionResponse,
  AnalyzeImageRequest,
  DescribeImageRequest,
  ExtractTextRequest,
  VisionBridgeError,
  HealthStatus
} from './types'