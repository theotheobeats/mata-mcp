/**
 * Core type definitions for MCP Vision Bridge
 */

// MCP Tool Types
export interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, any>
}

export interface MCPToolCall {
  name: string
  arguments: Record<string, any>
}

// Image Processing Types
export interface ImageData {
  url: string
  format: string
  size: number
  base64?: string
}

export interface ImageProcessingOptions {
  maxSize?: number
  allowedFormats?: string[]
  quality?: number
  maxDimension?: number
}

// OpenRouter Types
export interface OpenRouterConfig {
  apiKey: string
  baseURL?: string
  timeout?: number
  maxRetries?: number
  retryDelay?: number
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | Array<{
    type: 'text' | 'image_url'
    text?: string
    image_url?: {
      url: string
    }
  }>
}

export interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  max_tokens?: number
  temperature?: number
  stream?: boolean
}

export interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: ChatMessage
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// Vision Tool Types
export interface AnalyzeImageRequest {
  image_url: string
  prompt: string
  model?: string
  max_tokens?: number
  temperature?: number
  detail_level?: 'low' | 'medium' | 'high'
}

export interface DescribeImageRequest {
  image_url: string
  detail_level?: 'low' | 'medium' | 'high'
  include_objects?: boolean
  include_colors?: boolean
  include_text?: boolean
}

export interface ExtractTextRequest {
  image_url: string
  language?: string
  preserve_formatting?: boolean
  include_confidence?: boolean
}

// Response Types
export interface VisionResponse {
  content: Array<{
    type: 'text'
    text: string
  }>
  metadata?: {
    model_used?: string
    confidence_score?: number
    processing_time_ms?: number
    tokens_used?: number
    detected_objects?: string[]
    dominant_colors?: string[]
    extracted_text_blocks?: TextBlock[]
    total_confidence?: number
    language_detected?: string
  }
}

export interface TextBlock {
  text: string
  confidence: number
  bbox?: {
    x: number
    y: number
    width: number
    height: number
  }
}

// Model Routing Types
export interface ModelConfig {
  primary: string
  fallback: string[]
  defaultMaxTokens?: number
  defaultTemperature?: number
}

export interface ModelSelection {
  model: string
  confidence: number
  reason: string
}

// Error Types
export interface VisionBridgeError {
  code: string
  message: string
  details?: Record<string, any>
  retryable: boolean
  retryAfter?: number
}

// Configuration Types
export interface ServerConfig {
  server: {
    transport: 'stdio' | 'http'
    port?: number
    timeout?: number
    cors?: boolean
  }
  openrouter: OpenRouterConfig
  models: ModelConfig
  image: {
    maxSize: number
    allowedFormats: string[]
    quality: number
    maxDimension: number
    tempDir: string
    cleanupTempFiles: boolean
  }
  security: {
    rateLimit: {
      enabled: boolean
      requests: number
      window: number
      burst: number
    }
    allowedOrigins: string[]
    maxConcurrentRequests: number
    requestTimeout: number
  }
  performance: {
    cache: {
      enabled: boolean
      ttl: number
      maxSize: number
    }
    connectionPool: {
      size: number
      maxSockets: number
      keepAlive: boolean
    }
  }
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    format: 'json' | 'text'
    file?: string
  }
  monitoring: {
    metrics: {
      enabled: boolean
      port: number
      path: string
    }
    healthCheck: {
      enabled: boolean
      port: number
      path: string
    }
  }
}

// Rate Limiting Types
export interface RateLimitInfo {
  allowed: boolean
  remaining: number
  resetTime: number
  retryAfter?: number
}

// Cache Types
export interface CacheEntry<T = any> {
  data: T
  timestamp: number
  ttl: number
}

// Health Check Types
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  uptime: number
  version: string
  checks: {
    openrouter: 'up' | 'down' | 'degraded'
    cache: 'up' | 'down'
    memory: 'ok' | 'high' | 'critical'
  }
  metrics?: {
    requests_total: number
    requests_active: number
    cache_hit_rate: number
    average_response_time: number
  }
}

// Streaming Types
export interface StreamChunk {
  type: 'delta' | 'done' | 'error'
  data?: string
  error?: string
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

// Event Types
export interface VisionBridgeEvent {
  type: 'request_start' | 'request_end' | 'error' | 'cache_hit' | 'cache_miss'
  timestamp: number
  data: Record<string, any>
}

// Logging Types
export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  timestamp: number
  service: string
  metadata?: Record<string, any>
  error?: {
    name: string
    message: string
    stack?: string
  }
}