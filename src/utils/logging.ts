/**
 * Logging utility for MCP Vision Bridge
 */

import winston from 'winston'
import path from 'path'
import fs from 'fs'
import { LogEntry } from '../types'

export class Logger {
  private winston: winston.Logger
  private serviceName: string

  constructor(serviceName: string = 'mcp-vision-bridge') {
    this.serviceName = serviceName
    this.winston = this.createWinstonLogger()
  }

  private createWinstonLogger(): winston.Logger {
    const config = this.getConfig()
    
    // Create logs directory if it doesn't exist
    if (config.file) {
      const logDir = path.dirname(config.file)
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true })
      }
    }

    const transports: winston.transport[] = []

    // Console transport
    transports.push(
      new winston.transports.Console({
        format: config.format === 'json' 
          ? winston.format.combine(
              winston.format.timestamp(),
              winston.format.errors({ stack: true }),
              winston.format.json()
            )
          : winston.format.combine(
              winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
              winston.format.errors({ stack: true }),
              winston.format.colorize(),
              winston.format.printf(({ timestamp, level, message, ...meta }) => {
                const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
                return `${timestamp} [${level}]: ${message} ${metaStr}`
              })
            )
      })
    )

    // File transport
    if (config.file) {
      transports.push(
        new winston.transports.File({
          filename: config.file,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          )
        })
      )

      // Separate error log file
      const errorLogPath = config.file.replace('.log', '.error.log')
      transports.push(
        new winston.transports.File({
          filename: errorLogPath,
          level: 'error',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          )
        })
      )
    }

    return winston.createLogger({
      level: config.level,
      defaultMeta: { service: this.serviceName },
      transports,
      exitOnError: false
    })
  }

  private getConfig() {
    return {
      level: process.env.LOG_LEVEL || 'info',
      format: process.env.LOG_FORMAT || 'json',
      file: process.env.LOG_FILE
    }
  }

  // Logging methods
  debug(message: string, meta?: Record<string, any>): void {
    this.winston.debug(message, meta)
  }

  info(message: string, meta?: Record<string, any>): void {
    this.winston.info(message, meta)
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.winston.warn(message, meta)
  }

  error(message: string, error?: Error | any, meta?: Record<string, any>): void {
    if (error instanceof Error) {
      this.winston.error(message, {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        ...meta
      })
    } else {
      this.winston.error(message, { error, ...meta })
    }
  }

  // Specialized logging methods
  logRequest(method: string, url: string, statusCode: number, duration: number, meta?: Record<string, any>): void {
    this.info('HTTP Request', {
      type: 'http_request',
      method,
      url,
      statusCode,
      duration,
      ...meta
    })
  }

  logMCPRequest(toolName: string, args: Record<string, any>, duration: number, success: boolean, meta?: Record<string, any>): void {
    this.info('MCP Tool Request', {
      type: 'mcp_request',
      toolName,
      args: this.sanitizeArgs(args),
      duration,
      success,
      ...meta
    })
  }

  logOpenRouterRequest(model: string, tokens: number, duration: number, success: boolean, meta?: Record<string, any>): void {
    this.info('OpenRouter API Request', {
      type: 'openrouter_request',
      model,
      tokens,
      duration,
      success,
      ...meta
    })
  }

  logImageProcessing(imageUrl: string, format: string, size: number, duration: number, success: boolean, meta?: Record<string, any>): void {
    this.info('Image Processing', {
      type: 'image_processing',
      imageUrl: this.sanitizeUrl(imageUrl),
      format,
      size,
      duration,
      success,
      ...meta
    })
  }

  logRateLimit(clientId: string, allowed: boolean, remaining: number, resetTime: number, meta?: Record<string, any>): void {
    this.info('Rate Limit Check', {
      type: 'rate_limit',
      clientId: this.sanitizeClientId(clientId),
      allowed,
      remaining,
      resetTime,
      ...meta
    })
  }

  logCacheOperation(operation: 'get' | 'set' | 'hit' | 'miss', key: string, success: boolean, meta?: Record<string, any>): void {
    this.info('Cache Operation', {
      type: 'cache_operation',
      operation,
      key: this.sanitizeCacheKey(key),
      success,
      ...meta
    })
  }

  logHealthCheck(component: string, status: 'up' | 'down' | 'degraded', duration: number, meta?: Record<string, any>): void {
    const level = status === 'down' ? 'error' : status === 'degraded' ? 'warn' : 'info'
    this[level]('Health Check', {
      type: 'health_check',
      component,
      status,
      duration,
      ...meta
    })
  }

  logConfigChange(path: string, oldValue: any, newValue: any, meta?: Record<string, any>): void {
    this.info('Configuration Change', {
      type: 'config_change',
      path,
      oldValue,
      newValue,
      ...meta
    })
  }

  // Utility methods
  createChildLogger(component: string): Logger {
    return new Logger(`${this.serviceName}:${component}`)
  }

  // Sanitization methods for sensitive data
  private sanitizeArgs(args: Record<string, any>): Record<string, any> {
    const sanitized = { ...args }
    
    // Remove or mask sensitive fields
    const sensitiveFields = ['apiKey', 'password', 'token', 'secret', 'key']
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = this.maskValue(sanitized[field])
      }
    }
    
    return sanitized
  }

  private sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      // Remove query parameters and hash
      return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`
    } catch {
      // If URL parsing fails, just mask the URL
      return this.maskValue(url)
    }
  }

  private sanitizeClientId(clientId: string): string {
    // Hash or mask client ID for privacy
    if (clientId.length > 8) {
      return `${clientId.substring(0, 4)}...${clientId.substring(clientId.length - 4)}`
    }
    return this.maskValue(clientId)
  }

  private sanitizeCacheKey(key: string): string {
    // Remove sensitive parts from cache keys
    return key.replace(/([a-f0-9]{32,})/gi, (match) => match.substring(0, 8) + '...')
  }

  private maskValue(value: string): string {
    if (value.length <= 4) {
      return '*'.repeat(value.length)
    }
    return `${value.substring(0, 2)}...${value.substring(value.length - 2)}`
  }

  // Performance monitoring
  startTimer(label: string): () => void {
    const start = Date.now()
    return () => {
      const duration = Date.now() - start
      this.debug(`Timer completed: ${label}`, { duration, label })
      return duration
    }
  }

  // Structured logging for events
  logEvent(event: LogEntry): void {
    this.winston.log(event.level, event.message, {
      timestamp: event.timestamp,
      service: event.service,
      ...event.metadata,
      ...(event.error && { error: event.error })
    })
  }

  // Get current log level
  getLevel(): string {
    return this.winston.level
  }

  // Change log level at runtime
  setLevel(level: string): void {
    this.winston.level = level
    this.info('Log level changed', { newLevel: level })
  }

  // Flush logs (useful for testing)
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.winston.on('finish', resolve)
      this.winston.end()
    })
  }
}

// Export singleton logger
export const logger = new Logger()

// Export convenience functions
export const log = {
  debug: (message: string, meta?: Record<string, any>) => logger.debug(message, meta),
  info: (message: string, meta?: Record<string, any>) => logger.info(message, meta),
  warn: (message: string, meta?: Record<string, any>) => logger.warn(message, meta),
  error: (message: string, error?: Error | any, meta?: Record<string, any>) => logger.error(message, error, meta)
}