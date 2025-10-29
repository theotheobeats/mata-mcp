/**
 * OpenRouter Utility Functions
 * Helper functions for OpenRouter integration
 */

import { ChatMessage } from '../../types'
import { logger } from '../../utils/logging'

export interface RequestMetrics {
  startTime: number
  endTime?: number
  tokens?: {
    prompt: number
    completion: number
    total: number
  }
  model?: string
  success?: boolean
  error?: string
}

export class RequestTracker {
  private metrics: Map<string, RequestMetrics> = new Map()

  startRequest(requestId: string, model: string): void {
    this.metrics.set(requestId, {
      startTime: Date.now(),
      model
    })
  }

  endRequest(requestId: string, success: boolean, tokens?: RequestMetrics['tokens'], error?: string): void {
    const metric = this.metrics.get(requestId)
    if (metric) {
      metric.endTime = Date.now()
      metric.success = success
      metric.tokens = tokens
      metric.error = error
    }
  }

  getMetrics(requestId: string): RequestMetrics | undefined {
    return this.metrics.get(requestId)
  }

  getAllMetrics(): RequestMetrics[] {
    return Array.from(this.metrics.values())
  }

  clearOldMetrics(maxAge: number = 3600000): void { // 1 hour default
    const now = Date.now()
    for (const [id, metric] of this.metrics.entries()) {
      if (now - metric.startTime > maxAge) {
        this.metrics.delete(id)
      }
    }
  }
}

export const requestTracker = new RequestTracker()

/**
 * Format messages for OpenRouter API
 */
export function formatMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map(message => {
    // Ensure content is properly formatted
    if (typeof message.content === 'string') {
      return {
        ...message,
        content: message.content.trim()
      }
    }

    // Handle array content (for multimodal messages)
    if (Array.isArray(message.content)) {
      return {
        ...message,
        content: message.content.map(content => {
          if (content.type === 'text' && content.text) {
            return {
              ...content,
              text: content.text.trim()
            }
          }
          return content
        })
      }
    }

    return message
  })
}

/**
 * Validate image URL or data
 */
export function validateImageInput(imageUrl: string): { valid: boolean; type: 'url' | 'base64'; error?: string } {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return { valid: false, type: 'url', error: 'Image URL is required' }
  }

  // Check if it's a data URL
  if (imageUrl.startsWith('data:image/')) {
    // Validate base64 data URL format
    const dataUrlPattern = /^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/
    if (!dataUrlPattern.test(imageUrl)) {
      return { valid: false, type: 'base64', error: 'Invalid base64 image data format' }
    }
    return { valid: true, type: 'base64' }
  }

  // Check if it's a regular URL
  try {
    const url = new URL(imageUrl)
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, type: 'url', error: 'Image URL must use HTTP or HTTPS protocol' }
    }
    return { valid: true, type: 'url' }
  } catch {
    return { valid: false, type: 'url', error: 'Invalid URL format' }
  }
}

/**
 * Extract image format from URL or data
 */
export function extractImageFormat(imageUrl: string): string | null {
  if (imageUrl.startsWith('data:image/')) {
    const match = imageUrl.match(/^data:image\/([^;]+)/)
    return match ? match[1].toLowerCase() : null
  }

  try {
    const url = new URL(imageUrl)
    const pathname = url.pathname.toLowerCase()
    
    // Extract format from file extension
    const extension = pathname.split('.').pop()
    if (extension && ['jpeg', 'jpg', 'png', 'webp', 'gif'].includes(extension)) {
      return extension
    }
  } catch {
    // Invalid URL, return null
  }

  return null
}

/**
 * Calculate estimated cost for a request
 */
export function estimateRequestCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
  modelPricing: Record<string, { prompt: number; completion: number }>
): number {
  const pricing = modelPricing[model]
  if (!pricing) return 0

  const promptCost = (promptTokens / 1000) * pricing.prompt
  const completionCost = (completionTokens / 1000) * pricing.completion
  
  return promptCost + completionCost
}

/**
 * Create a request ID for tracking
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

/**
 * Sanitize sensitive data from logs
 */
export function sanitizeForLogging(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data
  }

  const sanitized = Array.isArray(data) ? [] : {}
  const sensitiveKeys = ['apiKey', 'password', 'token', 'secret', 'key', 'authorization']

  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeForLogging(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Retry decorator for async functions
 */
export function withRetry<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  options: {
    maxRetries?: number
    delay?: number
    backoff?: number
    retryCondition?: (error: any) => boolean
  } = {}
): (...args: T) => Promise<R> {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = 2,
    retryCondition = () => true
  } = options

  return async (...args: T): Promise<R> => {
    let lastError: any

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await fn(...args)
      } catch (error) {
        lastError = error

        if (attempt > maxRetries || !retryCondition(error)) {
          throw error
        }

        const waitTime = delay * Math.pow(backoff, attempt - 1)
        logger.warn('Retrying operation', {
          attempt,
          maxRetries,
          waitTime,
          error: error.message
        })

        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }

    throw lastError
  }
}

/**
 * Rate limiter for API requests
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map()

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  isAllowed(clientId: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now()
    const clientRequests = this.requests.get(clientId) || []

    // Remove old requests outside the window
    const validRequests = clientRequests.filter(time => now - time < this.windowMs)
    
    if (validRequests.length >= this.maxRequests) {
      const resetTime = Math.min(...validRequests) + this.windowMs
      return {
        allowed: false,
        remaining: 0,
        resetTime
      }
    }

    // Add current request
    validRequests.push(now)
    this.requests.set(clientId, validRequests)

    return {
      allowed: true,
      remaining: this.maxRequests - validRequests.length,
      resetTime: now + this.windowMs
    }
  }

  getRemainingRequests(clientId: string): number {
    const now = Date.now()
    const clientRequests = this.requests.get(clientId) || []
    const validRequests = clientRequests.filter(time => now - time < this.windowMs)
    return Math.max(0, this.maxRequests - validRequests.length)
  }

  reset(clientId: string): void {
    this.requests.delete(clientId)
  }

  clear(): void {
    this.requests.clear()
  }
}

/**
 * Memory-efficient image size validator
 */
export function validateImageSize(imageUrl: string, maxSize: number): Promise<{ valid: boolean; size?: number; error?: string }> {
  return new Promise((resolve) => {
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      // For data URLs, estimate size
      const base64Size = Math.ceil((imageUrl.length - imageUrl.indexOf(',') - 1) * 0.75)
      resolve({
        valid: base64Size <= maxSize,
        size: base64Size,
        error: base64Size > maxSize ? `Image size (${base64Size} bytes) exceeds limit (${maxSize} bytes)` : undefined
      })
      return
    }

    // For URLs, we can't easily check size without downloading
    // In a real implementation, you might use HEAD request or range requests
    resolve({
      valid: true,
      size: undefined,
      error: undefined
    })
  })
}

/**
 * Format token usage for logging
 */
export function formatTokenUsage(usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }): string {
  if (!usage) return 'unknown'
  
  return `tokens: ${usage.total_tokens} (prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens})`
}

/**
 * Create a simple circuit breaker
 */
export class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  constructor(
    private failureThreshold: number,
    private recoveryTimeout: number
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is open')
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failures = 0
    this.state = 'closed'
  }

  private onFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.failures >= this.failureThreshold) {
      this.state = 'open'
    }
  }

  getState(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    }
  }
}