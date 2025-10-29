/**
 * OpenRouter API Client
 * Handles communication with OpenRouter API for vision models
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { 
  OpenRouterConfig, 
  ChatCompletionRequest, 
  ChatCompletionResponse, 
  VisionBridgeError,
  StreamChunk 
} from '../../types'
import { logger } from '../../utils/logging'

export class OpenRouterClient {
  private client: AxiosInstance
  private config: OpenRouterConfig
  private requestCount = 0
  private lastRequestTime = 0

  constructor(config: OpenRouterConfig) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    }

    this.client = this.createAxiosClient()
  }

  private createAxiosClient(): AxiosInstance {
    const { apiKey, baseURL, timeout } = this.config

    const client = axios.create({
      baseURL: baseURL || 'https://openrouter.ai/api/v1',
      timeout: timeout || 30000,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mcp-vision-bridge.example.com',
        'X-Title': 'MCP Vision Bridge'
      },
      // Enable connection pooling
      httpAgent: new (require('http')).Agent({
        keepAlive: true,
        maxSockets: 10,
        maxFreeSockets: 5
      }),
      httpsAgent: new (require('https')).Agent({
        keepAlive: true,
        maxSockets: 10,
        maxFreeSockets: 5
      })
    })

    // Request interceptor for logging and metrics
    client.interceptors.request.use(
      (config) => {
        this.requestCount++
        this.lastRequestTime = Date.now()
        
        logger.debug('OpenRouter request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          model: config.data?.model,
          hasImage: this.hasImageContent(config.data?.messages)
        })

        return config
      },
      (error) => {
        logger.error('OpenRouter request error', error)
        return Promise.reject(error)
      }
    )

    // Response interceptor for logging and error handling
    client.interceptors.response.use(
      (response) => {
        const duration = Date.now() - this.lastRequestTime
        
        logger.logOpenRouterRequest(
          response.data.model || 'unknown',
          response.data.usage?.total_tokens || 0,
          duration,
          true,
          {
            requestId: response.data.id,
            finishReason: response.data.choices?.[0]?.finish_reason
          }
        )

        return response
      },
      (error) => {
        const duration = Date.now() - this.lastRequestTime
        const model = error.config?.data?.model || 'unknown'
        
        logger.logOpenRouterRequest(model, 0, duration, false, {
          error: error.response?.data?.error || error.message,
          status: error.response?.status
        })

        return Promise.reject(this.handleError(error))
      }
    )

    return client
  }

  private hasImageContent(messages: any[]): boolean {
    if (!Array.isArray(messages)) return false
    
    return messages.some(message => 
      Array.isArray(message.content) && 
      message.content.some((content: any) => content.type === 'image_url')
    )
  }

  private handleError(error: any): VisionBridgeError {
    const response = error.response
    const request = error.config

    // Network errors
    if (!response) {
      return {
        code: 'NETWORK_ERROR',
        message: `Network error: ${error.message}`,
        details: {
          url: request?.url,
          method: request?.method?.toUpperCase()
        },
        retryable: true,
        retryAfter: this.config.retryDelay
      }
    }

    const { status, data } = response
    const errorData = data?.error || {}

    switch (status) {
      case 400:
        return {
          code: 'BAD_REQUEST',
          message: errorData.message || 'Bad request',
          details: errorData,
          retryable: false
        }

      case 401:
        return {
          code: 'AUTHENTICATION_ERROR',
          message: 'Invalid or missing API key',
          details: errorData,
          retryable: false
        }

      case 403:
        return {
          code: 'AUTHORIZATION_ERROR',
          message: 'Access forbidden',
          details: errorData,
          retryable: false
        }

      case 404:
        return {
          code: 'MODEL_NOT_FOUND',
          message: `Model not found: ${request?.data?.model}`,
          details: { model: request?.data?.model },
          retryable: false
        }

      case 429:
        const retryAfter = parseInt(response.headers['retry-after'] || '60')
        return {
          code: 'RATE_LIMITED',
          message: 'Rate limit exceeded',
          details: {
            ...errorData,
            retryAfter,
            limit: response.headers['x-ratelimit-limit'],
            remaining: response.headers['x-ratelimit-remaining']
          },
          retryable: true,
          retryAfter: retryAfter * 1000
        }

      case 500:
      case 502:
      case 503:
      case 504:
        return {
          code: 'SERVER_ERROR',
          message: errorData.message || 'OpenRouter server error',
          details: errorData,
          retryable: true,
          retryAfter: this.config.retryDelay
        }

      default:
        return {
          code: 'UNKNOWN_ERROR',
          message: errorData.message || `HTTP ${status}: ${error.message}`,
          details: { status, ...errorData },
          retryable: status >= 500
        }
    }
  }

  /**
   * Create a chat completion
   */
  async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const maxRetries = this.config.maxRetries || 3
    let lastError: VisionBridgeError

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.post('/chat/completions', request)
        return response.data
      } catch (error) {
        lastError = error as VisionBridgeError

        // Don't retry on non-retryable errors
        if (!lastError.retryable || attempt === maxRetries) {
          throw lastError
        }

        // Exponential backoff
        const delay = (lastError.retryAfter || this.config.retryDelay || 1000) * Math.pow(2, attempt - 1)
        
        logger.warn('Retrying OpenRouter request', {
          attempt,
          maxRetries,
          delay,
          error: lastError.code
        })

        await this.delay(delay)
      }
    }

    throw lastError!
  }

  /**
   * Stream a chat completion
   */
  async *streamChatCompletion(request: ChatCompletionRequest): AsyncGenerator<StreamChunk> {
    const maxRetries = this.config.maxRetries || 3
    let lastError: VisionBridgeError

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.post('/chat/completions', {
          ...request,
          stream: true
        }, {
          responseType: 'stream',
          timeout: (this.config.timeout || 30000) * 2 // Longer timeout for streaming
        })

        const stream = response.data

        for await (const chunk of stream) {
          const lines = chunk.toString().split('\n')
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              
              if (data === '[DONE]') {
                yield { type: 'done' }
                return
              }
              
              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content
                
                if (content) {
                  yield { type: 'delta', data: content }
                }
              } catch (e) {
                // Skip invalid JSON
                logger.debug('Skipping invalid streaming data', { data })
              }
            }
          }
        }

        // If we get here, streaming completed successfully
        yield { type: 'done' }
        return

      } catch (error) {
        lastError = error as VisionBridgeError

        // Don't retry on non-retryable errors
        if (!lastError.retryable || attempt === maxRetries) {
          yield { type: 'error', error: lastError.message }
          throw lastError
        }

        // Exponential backoff
        const delay = (lastError.retryAfter || this.config.retryDelay || 1000) * Math.pow(2, attempt - 1)
        
        logger.warn('Retrying OpenRouter streaming request', {
          attempt,
          maxRetries,
          delay,
          error: lastError.code
        })

        await this.delay(delay)
      }
    }

    yield { type: 'error', error: lastError!.message }
    throw lastError!
  }

  /**
   * List available models
   */
  async listModels(): Promise<any> {
    try {
      const response = await this.client.get('/models')
      return response.data
    } catch (error) {
      logger.error('Failed to list models', error)
      throw this.handleError(error)
    }
  }

  /**
   * Get model information
   */
  async getModelInfo(modelId: string): Promise<any> {
    try {
      const response = await this.client.get(`/models/${modelId}`)
      return response.data
    } catch (error) {
      logger.error('Failed to get model info', error, { modelId })
      throw this.handleError(error)
    }
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.listModels()
      return true
    } catch (error) {
      logger.error('OpenRouter connection test failed', error)
      return false
    }
  }

  /**
   * Get API usage statistics
   */
  getUsageStats(): { requestCount: number; lastRequestTime: number } {
    return {
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime
    }
  }

  /**
   * Update API key at runtime
   */
  updateApiKey(apiKey: string): void {
    this.config.apiKey = apiKey
    this.client.defaults.headers['Authorization'] = `Bearer ${apiKey}`
    
    logger.info('OpenRouter API key updated')
  }

  /**
   * Get client configuration
   */
  getConfig(): OpenRouterConfig {
    return { ...this.config }
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Close the client and cleanup resources
   */
  async close(): Promise<void> {
    // Close HTTP agents
    if (this.client.defaults.httpAgent) {
      this.client.defaults.httpAgent.destroy()
    }
    if (this.client.defaults.httpsAgent) {
      this.client.defaults.httpsAgent.destroy()
    }
    
    logger.info('OpenRouter client closed')
  }
}