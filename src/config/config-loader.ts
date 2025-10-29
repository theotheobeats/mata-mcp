/**
 * Configuration loader for MCP Vision Bridge
 */

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import Joi from 'joi'
import { ServerConfig, DeepPartial } from '../types'

// Load environment variables
dotenv.config()

// Configuration schema for validation
const configSchema = Joi.object({
  server: Joi.object({
    transport: Joi.string().valid('stdio', 'http').default('stdio'),
    port: Joi.number().port().default(3000),
    timeout: Joi.number().positive().default(30000),
    cors: Joi.boolean().default(false)
  }).default(),

  openrouter: Joi.object({
    apiKey: Joi.string().required(),
    baseURL: Joi.string().uri().default('https://openrouter.ai/api/v1'),
    timeout: Joi.number().positive().default(30000),
    maxRetries: Joi.number().integer().min(0).default(3),
    retryDelay: Joi.number().positive().default(1000)
  }).required(),

  models: Joi.object({
    primary: Joi.string().required(),
    fallback: Joi.array().items(Joi.string()).default([]),
    defaultMaxTokens: Joi.number().positive().default(1000),
    defaultTemperature: Joi.number().min(0).max(2).default(0.7)
  }).required(),

  image: Joi.object({
    maxSize: Joi.number().positive().default(10485760), // 10MB
    allowedFormats: Joi.array().items(Joi.string()).default(['jpeg', 'jpg', 'png', 'webp', 'gif']),
    quality: Joi.number().min(1).max(100).default(85),
    maxDimension: Joi.number().positive().default(2048),
    tempDir: Joi.string().default('/tmp/vision-bridge'),
    cleanupTempFiles: Joi.boolean().default(true)
  }).default(),

  security: Joi.object({
    rateLimit: Joi.object({
      enabled: Joi.boolean().default(true),
      requests: Joi.number().positive().default(100),
      window: Joi.number().positive().default(60000), // 1 minute
      burst: Joi.number().positive().default(10)
    }).default(),
    allowedOrigins: Joi.array().items(Joi.string()).default(['http://localhost:3000']),
    maxConcurrentRequests: Joi.number().positive().default(5),
    requestTimeout: Joi.number().positive().default(30000)
  }).default(),

  performance: Joi.object({
    cache: Joi.object({
      enabled: Joi.boolean().default(true),
      ttl: Joi.number().positive().default(300), // 5 minutes
      maxSize: Joi.number().positive().default(100)
    }).default(),
    connectionPool: Joi.object({
      size: Joi.number().positive().default(10),
      maxSockets: Joi.number().positive().default(20),
      keepAlive: Joi.boolean().default(true)
    }).default()
  }).default(),

  logging: Joi.object({
    level: Joi.string().valid('debug', 'info', 'warn', 'error').default('info'),
    format: Joi.string().valid('json', 'text').default('json'),
    file: Joi.string().optional()
  }).default(),

  monitoring: Joi.object({
    metrics: Joi.object({
      enabled: Joi.boolean().default(true),
      port: Joi.number().port().default(9090),
      path: Joi.string().default('/metrics')
    }).default(),
    healthCheck: Joi.object({
      enabled: Joi.boolean().default(true),
      port: Joi.number().port().default(3001),
      path: Joi.string().default('/health')
    }).default()
  }).default()
})

// Default configuration
const defaultConfig: ServerConfig = {
  server: {
    transport: 'stdio',
    port: 3000,
    timeout: 30000,
    cors: false
  },
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    baseURL: 'https://openrouter.ai/api/v1',
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 1000
  },
  models: {
    primary: process.env.VISION_MODEL_PRIMARY || 'x-ai/grok-beta-vision',
    fallback: (process.env.VISION_MODEL_FALLBACK || 'google/gemini-2.0-flash-001,anthropic/claude-3-5-sonnet-20241022')
      .split(',')
      .map(m => m.trim())
      .filter(m => m),
    defaultMaxTokens: parseInt(process.env.VISION_MODEL_MAX_TOKENS || '1000'),
    defaultTemperature: parseFloat(process.env.VISION_MODEL_TEMPERATURE || '0.7')
  },
  image: {
    maxSize: parseInt(process.env.MAX_IMAGE_SIZE || '10485760'),
    allowedFormats: (process.env.ALLOWED_IMAGE_FORMATS || 'jpeg,jpg,png,webp,gif')
      .split(',')
      .map(f => f.trim().toLowerCase()),
    quality: parseInt(process.env.IMAGE_QUALITY || '85'),
    maxDimension: parseInt(process.env.IMAGE_MAX_DIMENSION || '2048'),
    tempDir: process.env.TEMP_DIR || '/tmp/vision-bridge',
    cleanupTempFiles: process.env.CLEANUP_TEMP_FILES === 'true'
  },
  security: {
    rateLimit: {
      enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
      requests: parseInt(process.env.RATE_LIMIT_REQUESTS || '100'),
      window: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'),
      burst: parseInt(process.env.RATE_LIMIT_BURST || '10')
    },
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
      .split(',')
      .map(o => o.trim()),
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '5'),
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000')
  },
  performance: {
    cache: {
      enabled: process.env.CACHE_ENABLED !== 'false',
      ttl: parseInt(process.env.CACHE_TTL || '300'),
      maxSize: parseInt(process.env.CACHE_MAX_SIZE || '100')
    },
    connectionPool: {
      size: parseInt(process.env.CONNECTION_POOL_SIZE || '10'),
      maxSockets: parseInt(process.env.CONNECTION_POOL_MAX_SOCKETS || '20'),
      keepAlive: process.env.KEEP_ALIVE !== 'false'
    }
  },
  logging: {
    level: (process.env.LOG_LEVEL as any) || 'info',
    format: (process.env.LOG_FORMAT as any) || 'json',
    file: process.env.LOG_FILE || undefined
  },
  monitoring: {
    metrics: {
      enabled: process.env.METRICS_ENABLED !== 'false',
      port: parseInt(process.env.METRICS_PORT || '9090'),
      path: process.env.METRICS_PATH || '/metrics'
    },
    healthCheck: {
      enabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
      port: parseInt(process.env.HEALTH_CHECK_PORT || '3001'),
      path: process.env.HEALTH_CHECK_PATH || '/health'
    }
  }
}

export class ConfigLoader {
  private config: ServerConfig | null = null

  /**
   * Load configuration from multiple sources
   */
  async load(configPath?: string, env?: string, overrides?: DeepPartial<ServerConfig>): Promise<ServerConfig> {
    try {
      let loadedConfig = { ...defaultConfig }

      // Load from file if provided
      if (configPath && fs.existsSync(configPath)) {
        const fileConfig = this.loadFromFile(configPath)
        loadedConfig = this.mergeConfigs(loadedConfig, fileConfig)
      }

      // Load environment-specific config
      if (env) {
        const envConfigPath = this.getEnvConfigPath(configPath, env)
        if (envConfigPath && fs.existsSync(envConfigPath)) {
          const envConfig = this.loadFromFile(envConfigPath)
          loadedConfig = this.mergeConfigs(loadedConfig, envConfig)
        }
      }

      // Apply overrides
      if (overrides) {
        loadedConfig = this.mergeConfigs(loadedConfig, overrides)
      }

      // Validate configuration
      const validatedConfig = await this.validateConfig(loadedConfig)
      
      this.config = validatedConfig
      return validatedConfig
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to load configuration: ${message}`)
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ServerConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call load() first.')
    }
    return this.config
  }

  /**
   * Load configuration from file
   */
  private loadFromFile(configPath: string): DeepPartial<ServerConfig> {
    const ext = path.extname(configPath).toLowerCase()
    
    try {
      const content = fs.readFileSync(configPath, 'utf8')
      
      switch (ext) {
        case '.json':
          return JSON.parse(content)
        case '.yaml':
        case '.yml':
          return this.parseYAML(content)
        default:
          throw new Error(`Unsupported configuration file format: ${ext}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to load configuration file ${configPath}: ${message}`)
    }
  }

  /**
   * Parse YAML content
   */
  private parseYAML(content: string): any {
    // Simple YAML parser - in production, use a proper YAML library like js-yaml
    try {
      // This is a very basic YAML parser for simple key-value pairs
      // For complex YAML, consider using js-yaml library
      const lines = content.split('\n')
      const result: any = {}
      
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        
        const colonIndex = trimmed.indexOf(':')
        if (colonIndex === -1) continue
        
        const key = trimmed.substring(0, colonIndex).trim()
        const value = trimmed.substring(colonIndex + 1).trim()
        
        if (value.startsWith('"') && value.endsWith('"')) {
          result[key] = value.slice(1, -1)
        } else if (value.startsWith("'") && value.endsWith("'")) {
          result[key] = value.slice(1, -1)
        } else if (value === 'true') {
          result[key] = true
        } else if (value === 'false') {
          result[key] = false
        } else if (!isNaN(Number(value))) {
          result[key] = Number(value)
        } else {
          result[key] = value
        }
      }
      
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to parse YAML: ${message}`)
    }
  }

  /**
   * Get environment-specific config path
   */
  private getEnvConfigPath(basePath: string | undefined, env: string): string | null {
    if (!basePath) return null
    
    const dir = path.dirname(basePath)
    const ext = path.extname(basePath)
    const basename = path.basename(basePath, ext)
    
    return path.join(dir, `${basename}.${env}${ext}`)
  }

  /**
   * Deep merge two configuration objects
   */
  private mergeConfigs(base: any, override: any): any {
    const result = { ...base }
    
    for (const key in override) {
      if (override.hasOwnProperty(key)) {
        if (override[key] && typeof override[key] === 'object' && !Array.isArray(override[key])) {
          result[key] = this.mergeConfigs(result[key] || {}, override[key])
        } else {
          result[key] = override[key]
        }
      }
    }
    
    return result
  }

  /**
   * Validate configuration against schema
   */
  private async validateConfig(config: DeepPartial<ServerConfig>): Promise<ServerConfig> {
    try {
      const { error, value } = configSchema.validate(config, {
        allowUnknown: false,
        abortEarly: false
      })
      
      if (error) {
        const errorMessages = error.details.map(detail => `${detail.path.join('.')}: ${detail.message}`)
        throw new Error(`Configuration validation failed:\n${errorMessages.join('\n')}`)
      }
      
      return value as ServerConfig
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Configuration validation error: ${message}`)
    }
  }

  /**
   * Check if required configuration is present
   */
  validateRequired(config: ServerConfig): void {
    const required = [
      { path: 'openrouter.apiKey', value: config.openrouter.apiKey },
      { path: 'models.primary', value: config.models.primary }
    ]
    
    const missing = required.filter(item => !item.value)
    
    if (missing.length > 0) {
      const missingFields = missing.map(item => item.path).join(', ')
      throw new Error(`Missing required configuration: ${missingFields}`)
    }
  }

  /**
   * Get configuration for specific environment
   */
  getEnvConfig(): Record<string, string> {
    const config = this.getConfig()
    
    return {
      NODE_ENV: process.env.NODE_ENV || 'development',
      OPENROUTER_API_KEY: config.openrouter.apiKey,
      VISION_MODEL_PRIMARY: config.models.primary,
      VISION_MODEL_FALLBACK: config.models.fallback.join(','),
      LOG_LEVEL: config.logging.level,
      MAX_IMAGE_SIZE: config.image.maxSize.toString(),
      RATE_LIMIT_ENABLED: config.security.rateLimit.enabled.toString(),
      RATE_LIMIT_REQUESTS: config.security.rateLimit.requests.toString(),
      RATE_LIMIT_WINDOW: config.security.rateLimit.window.toString()
    }
  }
}

// Export singleton instance
export const configLoader = new ConfigLoader()

// Export convenience function
export async function loadConfig(
  configPath?: string,
  env?: string,
  overrides?: DeepPartial<ServerConfig>
): Promise<ServerConfig> {
  return configLoader.load(configPath, env, overrides)
}