/**
 * Model Router for MCP Vision Bridge
 * Intelligently selects the best model for each request
 */

import { ModelConfig, ModelSelection, VisionBridgeError } from '../types'
import { OpenRouterClient } from '../integrations/openrouter/client'
import { ModelManager } from '../integrations/openrouter/models'
import { logger } from '../utils/logging'

export interface RoutingRequest {
  hasImage?: boolean
  requiresHighQuality?: boolean
  requiresFastResponse?: boolean
  maxTokens?: number
  preferredModel?: string
  costSensitive?: boolean
  fallbackAllowed?: boolean
}

export interface RoutingMetrics {
  totalRequests: number
  successfulSelections: number
  fallbackSelections: number
  modelUsage: Record<string, number>
  averageConfidence: number
  lastSelection?: {
    model: string
    confidence: number
    reason: string
    timestamp: number
  }
}

export class ModelRouter {
  private metrics: RoutingMetrics = {
    totalRequests: 0,
    successfulSelections: 0,
    fallbackSelections: 0,
    modelUsage: {},
    averageConfidence: 0
  }

  private confidenceHistory: number[] = []

  constructor(
    private config: ModelConfig,
    private openRouterClient: OpenRouterClient,
    private modelManager: ModelManager
  ) {
    this.initializeModelManager()
  }

  private initializeModelManager(): void {
    // Set up model capabilities based on configuration
    this.modelManager.updateConfig(this.config)
    
    logger.info('Model router initialized', {
      primary: this.config.primary,
      fallback: this.config.fallback,
      defaultMaxTokens: this.config.defaultMaxTokens,
      defaultTemperature: this.config.defaultTemperature
    })
  }

  /**
   * Select the best model for a request
   */
  async selectModel(request: RoutingRequest): Promise<ModelSelection> {
    const startTime = Date.now()
    this.metrics.totalRequests++

    try {
      logger.debug('Selecting model for request', {
        hasImage: request.hasImage,
        requiresHighQuality: request.requiresHighQuality,
        preferredModel: request.preferredModel,
        maxTokens: request.maxTokens
      })

      // Use model manager to select model
      let selection = this.modelManager.selectModel(request)

      // Validate selected model
      const validation = this.modelManager.validateModel(selection.model, {
        hasImage: request.hasImage,
        maxTokens: request.maxTokens
      })

      if (!validation.valid) {
        logger.warn('Primary model selection failed validation', {
          model: selection.model,
          issues: validation.issues
        })

        // Try fallback models
        selection = await this.selectFallbackModel(request, validation.issues)
        this.metrics.fallbackSelections++
      } else {
        this.metrics.successfulSelections++
      }

      // Update metrics
      this.updateMetrics(selection)

      const duration = Date.now() - startTime
      logger.info('Model selected', {
        model: selection.model,
        confidence: selection.confidence,
        reason: selection.reason,
        duration,
        isFallback: selection.model !== this.config.primary
      })

      return selection

    } catch (error) {
      const duration = Date.now() - startTime
      
      logger.error('Model selection failed', error, {
        request,
        duration
      })

      // Return primary model as last resort
      const fallbackSelection: ModelSelection = {
        model: this.config.primary,
        confidence: 0.1,
        reason: 'Fallback due to selection error'
      }

      this.updateMetrics(fallbackSelection)
      return fallbackSelection
    }
  }

  /**
   * Select fallback model when primary selection fails
   */
  private async selectFallbackModel(request: RoutingRequest, issues: string[]): Promise<ModelSelection> {
    const availableModels = this.modelManager.getAvailableModels()
    
    // Remove the failed model from candidates
    const fallbackCandidates = availableModels.filter(model => 
      model !== this.config.primary && 
      this.modelManager.isModelAvailable(model)
    )

    // Try each fallback model
    for (const fallbackModel of fallbackCandidates) {
      const validation = this.modelManager.validateModel(fallbackModel, {
        hasImage: request.hasImage,
        maxTokens: request.maxTokens
      })

      if (validation.valid) {
        return {
          model: fallbackModel,
          confidence: 0.7,
          reason: `Fallback model selected due to: ${issues.join(', ')}`
        }
      }
    }

    // If no fallback works, return primary with low confidence
    return {
      model: this.config.primary,
      confidence: 0.3,
      reason: `All models failed validation. Issues: ${issues.join(', ')}`
    }
  }

  /**
   * Test model availability and health
   */
  async testModelHealth(modelId: string): Promise<{
    available: boolean
    responseTime?: number
    error?: string
  }> {
    const startTime = Date.now()

    try {
      // Create a minimal test request
      const testRequest = {
        model: modelId,
        messages: [
          {
            role: 'user',
            content: 'Hello'
          }
        ],
        max_tokens: 10
      }

      await this.openRouterClient.createChatCompletion(testRequest)
      
      const responseTime = Date.now() - startTime
      
      logger.debug('Model health test passed', { model: modelId, responseTime })
      
      return {
        available: true,
        responseTime
      }

    } catch (error) {
      const responseTime = Date.now() - startTime
      
      logger.warn('Model health test failed', { 
        model: modelId, 
        responseTime, 
        error: error.message 
      })
      
      return {
        available: false,
        responseTime,
        error: error.message
      }
    }
  }

  /**
   * Get routing metrics
   */
  getMetrics(): RoutingMetrics {
    return {
      ...this.metrics,
      averageConfidence: this.confidenceHistory.length > 0 
        ? this.confidenceHistory.reduce((a, b) => a + b, 0) / this.confidenceHistory.length
        : 0
    }
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulSelections: 0,
      fallbackSelections: 0,
      modelUsage: {},
      averageConfidence: 0
    }
    this.confidenceHistory = []
    
    logger.info('Model router metrics reset')
  }

  /**
   * Update routing metrics
   */
  private updateMetrics(selection: ModelSelection): void {
    // Update model usage
    this.metrics.modelUsage[selection.model] = (this.metrics.modelUsage[selection.model] || 0) + 1

    // Update confidence history
    this.confidenceHistory.push(selection.confidence)
    if (this.confidenceHistory.length > 100) {
      this.confidenceHistory.shift() // Keep only last 100
    }

    // Update last selection
    this.metrics.lastSelection = {
      model: selection.model,
      confidence: selection.confidence,
      reason: selection.reason,
      timestamp: Date.now()
    }
  }

  /**
   * Get model recommendations for different use cases
   */
  getRecommendations(useCase: 'vision' | 'text' | 'high-quality' | 'fast' | 'cost-effective'): string[] {
    return this.modelManager.getPreferredModels(useCase)
  }

  /**
   * Estimate cost for a request
   */
  estimateCost(modelId: string, promptTokens: number, completionTokens: number): number {
    return this.modelManager.estimateCost(modelId, promptTokens, completionTokens)
  }

  /**
   * Get cost-optimized model selection
   */
  selectCostOptimizedModel(request: RoutingRequest, estimatedTokens: {
    prompt: number
    completion: number
  }): ModelSelection {
    const availableModels = this.modelManager.getAvailableModels()
    
    let bestModel = availableModels[0]
    let lowestCost = Infinity

    for (const model of availableModels) {
      const cost = this.estimateCost(model, estimatedTokens.prompt, estimatedTokens.completion)
      
      if (cost < lowestCost) {
        // Check if model meets requirements
        const validation = this.modelManager.validateModel(model, {
          hasImage: request.hasImage,
          maxTokens: request.maxTokens
        })

        if (validation.valid) {
          lowestCost = cost
          bestModel = model
        }
      }
    }

    return {
      model: bestModel,
      confidence: 0.8,
      reason: `Cost-optimized selection (estimated cost: $${lowestCost.toFixed(4)})`
    }
  }

  /**
   * Get performance-optimized model selection
   */
  selectPerformanceOptimizedModel(request: RoutingRequest): ModelSelection {
    // For performance, prefer faster models
    const performancePriority = [
      'google/gemini-2.0-flash-001',
      'openai/gpt-4o-mini',
      'x-ai/grok-beta-vision',
      'openai/gpt-4o',
      'anthropic/claude-3-5-sonnet-20241022'
    ]

    const availableModels = this.modelManager.getAvailableModels()
    
    for (const priorityModel of performancePriority) {
      if (availableModels.includes(priorityModel)) {
        const validation = this.modelManager.validateModel(priorityModel, {
          hasImage: request.hasImage,
          maxTokens: request.maxTokens
        })

        if (validation.valid) {
          return {
            model: priorityModel,
            confidence: 0.9,
            reason: 'Performance-optimized selection'
          }
        }
      }
    }

    // Fallback to any available model
    const fallback = availableModels[0]
    return {
      model: fallback,
      confidence: 0.6,
      reason: 'Performance-optimized fallback'
    }
  }

  /**
   * Update model configuration
   */
  updateConfiguration(newConfig: Partial<ModelConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.modelManager.updateConfig(this.config)
    
    logger.logConfigChange('model-router', this.config, newConfig)
  }

  /**
   * Get current configuration
   */
  getConfiguration(): ModelConfig {
    return { ...this.config }
  }

  /**
   * Pre-warm models by testing their availability
   */
  async preWarmModels(): Promise<Record<string, {
    available: boolean
    responseTime?: number
    error?: string
  }>> {
    const models = this.modelManager.getAvailableModels()
    const results: Record<string, any> = {}

    logger.info('Pre-warming models', { modelCount: models.length })

    // Test models in parallel with limited concurrency
    const concurrencyLimit = 3
    const batches = []
    
    for (let i = 0; i < models.length; i += concurrencyLimit) {
      batches.push(models.slice(i, i + concurrencyLimit))
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (model) => {
        const result = await this.testModelHealth(model)
        return { model, result }
      })

      const batchResults = await Promise.allSettled(batchPromises)
      
      for (const batchResult of batchResults) {
        if (batchResult.status === 'fulfilled') {
          const { model, result } = batchResult.value
          results[model] = result
        } else {
          results[batchResult.reason.model] = {
            available: false,
            error: batchResult.reason.error
          }
        }
      }
    }

    const availableCount = Object.values(results).filter((r: any) => r.available).length
    logger.info('Model pre-warming complete', {
      total: models.length,
      available: availableCount,
      unavailable: models.length - availableCount
    })

    return results
  }

  /**
   * Get model load balancing statistics
   */
  getLoadBalancingStats(): {
    modelUsage: Record<string, number>
    usagePercentages: Record<string, number>
    totalRequests: number
  } {
    const totalRequests = Object.values(this.metrics.modelUsage).reduce((a, b) => a + b, 0)
    
    const usagePercentages: Record<string, number> = {}
    for (const [model, count] of Object.entries(this.metrics.modelUsage)) {
      usagePercentages[model] = totalRequests > 0 ? (count / totalRequests) * 100 : 0
    }

    return {
      modelUsage: { ...this.metrics.modelUsage },
      usagePercentages,
      totalRequests
    }
  }

  /**
   * Force selection of specific model (for testing/debugging)
   */
  forceModelSelection(modelId: string, reason: string): ModelSelection {
    if (!this.modelManager.isModelAvailable(modelId)) {
      throw new Error(`Model ${modelId} is not available`)
    }

    const selection: ModelSelection = {
      model: modelId,
      confidence: 1.0,
      reason: `Forced selection: ${reason}`
    }

    this.updateMetrics(selection)
    
    logger.warn('Forced model selection', { model: modelId, reason })
    
    return selection
  }
}