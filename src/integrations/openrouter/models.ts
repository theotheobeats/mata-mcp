/**
 * OpenRouter Model Configuration
 * Manages vision model settings and capabilities
 */

import { ModelConfig, ModelSelection } from '../../types'
import { logger } from '../../utils/logging'

export interface ModelInfo {
  id: string
  name: string
  description: string
  context_length: number
  pricing: {
    prompt: number
    completion: number
  }
  top_provider: {
    context_length: number
    max_completion_tokens: number
  }
  per_request_limits?: {
    prompt_tokens: number
    completion_tokens: number
  }
}

export interface ModelCapabilities {
  supportsImages: boolean
  supportsStreaming: boolean
  maxImageSize: number
  supportedFormats: string[]
  maxTokens: number
  contextLength: number
  pricing: {
    prompt: number
    completion: number
  }
}

export class ModelManager {
  private models: Map<string, ModelInfo> = new Map()
  private capabilities: Map<string, ModelCapabilities> = new Map()
  private config: ModelConfig

  constructor(config: ModelConfig) {
    this.config = config
    this.initializeModelCapabilities()
  }

  private initializeModelCapabilities(): void {
    // Define known vision models and their capabilities
    const visionModels: Record<string, Partial<ModelCapabilities>> = {
      'x-ai/grok-beta-vision': {
        supportsImages: true,
        supportsStreaming: true,
        maxImageSize: 8 * 1024 * 1024, // 8MB
        supportedFormats: ['jpeg', 'jpg', 'png', 'webp'],
        maxTokens: 4000,
        contextLength: 128000,
        pricing: { prompt: 0.005, completion: 0.015 }
      },
      'google/gemini-2.0-flash-001': {
        supportsImages: true,
        supportsStreaming: true,
        maxImageSize: 20 * 1024 * 1024, // 20MB
        supportedFormats: ['jpeg', 'jpg', 'png', 'webp', 'gif'],
        maxTokens: 4000,
        contextLength: 1000000,
        pricing: { prompt: 0.001, completion: 0.004 }
      },
      'anthropic/claude-3-5-sonnet-20241022': {
        supportsImages: true,
        supportsStreaming: true,
        maxImageSize: 5 * 1024 * 1024, // 5MB
        supportedFormats: ['jpeg', 'jpg', 'png'],
        maxTokens: 4000,
        contextLength: 200000,
        pricing: { prompt: 0.003, completion: 0.015 }
      },
      'openai/gpt-4o': {
        supportsImages: true,
        supportsStreaming: true,
        maxImageSize: 20 * 1024 * 1024, // 20MB
        supportedFormats: ['jpeg', 'jpg', 'png', 'webp', 'gif'],
        maxTokens: 4000,
        contextLength: 128000,
        pricing: { prompt: 0.005, completion: 0.015 }
      },
      'openai/gpt-4o-mini': {
        supportsImages: true,
        supportsStreaming: true,
        maxImageSize: 20 * 1024 * 1024, // 20MB
        supportedFormats: ['jpeg', 'jpg', 'png', 'webp', 'gif'],
        maxTokens: 4000,
        contextLength: 128000,
        pricing: { prompt: 0.00015, completion: 0.0006 }
      }
    }

    // Initialize capabilities for known models
    for (const [modelId, capabilities] of Object.entries(visionModels)) {
      this.capabilities.set(modelId, {
        supportsImages: false,
        supportsStreaming: false,
        maxImageSize: 10 * 1024 * 1024, // Default 10MB
        supportedFormats: ['jpeg', 'jpg', 'png'],
        maxTokens: 1000,
        contextLength: 4000,
        pricing: { prompt: 0.001, completion: 0.002 },
        ...capabilities
      } as ModelCapabilities)
    }
  }

  /**
   * Select the best model for a request
   */
  selectModel(request: {
    hasImage?: boolean
    requiresHighQuality?: boolean
    maxTokens?: number
    preferredModel?: string
  }): ModelSelection {
    const { hasImage, requiresHighQuality, maxTokens, preferredModel } = request

    // If preferred model is specified and available, use it
    if (preferredModel && this.isModelAvailable(preferredModel)) {
      const capabilities = this.capabilities.get(preferredModel)
      if (capabilities && (!hasImage || capabilities.supportsImages)) {
        return {
          model: preferredModel,
          confidence: 1.0,
          reason: 'Preferred model specified and available'
        }
      }
    }

    // Get available models
    const availableModels = this.getAvailableModels()

    // Filter models based on requirements
    let candidateModels = availableModels

    if (hasImage) {
      candidateModels = candidateModels.filter(model => 
        this.capabilities.get(model)?.supportsImages
      )
    }

    if (maxTokens && maxTokens > 2000) {
      candidateModels = candidateModels.filter(model => 
        (this.capabilities.get(model)?.maxTokens || 0) >= maxTokens
      )
    }

    // If no candidates found, fall back to any available model
    if (candidateModels.length === 0) {
      candidateModels = availableModels
    }

    // Select best model based on criteria
    const selectedModel = this.selectBestModel(candidateModels, {
      requiresHighQuality,
      hasImage
    })

    return {
      model: selectedModel,
      confidence: this.calculateConfidence(selectedModel, request),
      reason: this.getSelectionReason(selectedModel, request)
    }
  }

  private selectBestModel(models: string[], criteria: {
    requiresHighQuality?: boolean
    hasImage?: boolean
  }): string {
    if (models.length === 0) {
      throw new Error('No available models')
    }

    // Priority order for vision models
    const priorityOrder = [
      'x-ai/grok-beta-vision',
      'google/gemini-2.0-flash-001',
      'anthropic/claude-3-5-sonnet-20241022',
      'openai/gpt-4o',
      'openai/gpt-4o-mini'
    ]

    // Find highest priority available model
    for (const priorityModel of priorityOrder) {
      if (models.includes(priorityModel)) {
        return priorityModel
      }
    }

    // Fallback to first available model
    return models[0]
  }

  private calculateConfidence(model: string, request: any): number {
    const capabilities = this.capabilities.get(model)
    if (!capabilities) return 0.5

    let confidence = 0.5

    // Boost confidence for vision models when image is present
    if (request.hasImage && capabilities.supportsImages) {
      confidence += 0.3
    }

    // Boost confidence for high-quality models when requested
    if (request.requiresHighQuality) {
      if (model.includes('gpt-4o') || model.includes('claude-3-5-sonnet')) {
        confidence += 0.2
      }
    }

    // Reduce confidence if model doesn't meet requirements
    if (request.hasImage && !capabilities.supportsImages) {
      confidence -= 0.5
    }

    return Math.max(0, Math.min(1, confidence))
  }

  private getSelectionReason(model: string, request: any): string {
    const reasons = []

    if (request.hasImage) {
      reasons.push('supports image processing')
    }

    if (request.requiresHighQuality) {
      reasons.push('high-quality output')
    }

    if (model === this.config.primary) {
      reasons.push('primary model')
    } else if (this.config.fallback.includes(model)) {
      reasons.push('fallback model')
    }

    return reasons.length > 0 ? reasons.join(', ') : 'default selection'
  }

  /**
   * Check if a model is available and configured
   */
  isModelAvailable(modelId: string): boolean {
    return this.config.primary === modelId || this.config.fallback.includes(modelId)
  }

  /**
   * Get all available models
   */
  getAvailableModels(): string[] {
    return [this.config.primary, ...this.config.fallback].filter(Boolean)
  }

  /**
   * Get model capabilities
   */
  getModelCapabilities(modelId: string): ModelCapabilities | null {
    return this.capabilities.get(modelId) || null
  }

  /**
   * Validate model for specific requirements
   */
  validateModel(modelId: string, requirements: {
    hasImage?: boolean
    maxTokens?: number
    minContextLength?: number
  }): { valid: boolean; issues: string[] } {
    const issues: string[] = []
    const capabilities = this.capabilities.get(modelId)

    if (!capabilities) {
      issues.push('Model capabilities not known')
      return { valid: false, issues }
    }

    if (requirements.hasImage && !capabilities.supportsImages) {
      issues.push('Model does not support images')
    }

    if (requirements.maxTokens && capabilities.maxTokens < requirements.maxTokens) {
      issues.push(`Model max tokens (${capabilities.maxTokens}) insufficient for request (${requirements.maxTokens})`)
    }

    if (requirements.minContextLength && capabilities.contextLength < requirements.minContextLength) {
      issues.push(`Model context length (${capabilities.contextLength}) insufficient (${requirements.minContextLength})`)
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }

  /**
   * Get model pricing information
   */
  getModelPricing(modelId: string): { prompt: number; completion: number } | null {
    const capabilities = this.capabilities.get(modelId)
    return capabilities?.pricing || null
  }

  /**
   * Estimate cost for a request
   */
  estimateCost(modelId: string, promptTokens: number, completionTokens: number): number {
    const pricing = this.getModelPricing(modelId)
    if (!pricing) return 0

    return (promptTokens / 1000) * pricing.prompt + (completionTokens / 1000) * pricing.completion
  }

  /**
   * Update model configuration
   */
  updateConfig(newConfig: Partial<ModelConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    logger.logConfigChange('models', this.config, { ...this.config, ...newConfig })
  }

  /**
   * Get current configuration
   */
  getConfig(): ModelConfig {
    return { ...this.config }
  }

  /**
   * Add or update model capabilities
   */
  setModelCapabilities(modelId: string, capabilities: Partial<ModelCapabilities>): void {
    const existing = this.capabilities.get(modelId) || {
      supportsImages: false,
      supportsStreaming: false,
      maxImageSize: 10 * 1024 * 1024,
      supportedFormats: ['jpeg', 'jpg', 'png'],
      maxTokens: 1000,
      contextLength: 4000,
      pricing: { prompt: 0.001, completion: 0.002 }
    }

    this.capabilities.set(modelId, { ...existing, ...capabilities })
    
    logger.debug('Updated model capabilities', { modelId, capabilities })
  }

  /**
   * Get models sorted by preference for a use case
   */
  getPreferredModels(useCase: 'vision' | 'text' | 'high-quality' | 'fast'): string[] {
    const available = this.getAvailableModels()
    
    switch (useCase) {
      case 'vision':
        return available.filter(model => 
          this.capabilities.get(model)?.supportsImages
        ).sort((a, b) => {
          // Prioritize known good vision models
          const priority = ['x-ai/grok-beta-vision', 'google/gemini-2.0-flash-001', 'openai/gpt-4o']
          const aIndex = priority.indexOf(a)
          const bIndex = priority.indexOf(b)
          if (aIndex === -1 && bIndex === -1) return 0
          if (aIndex === -1) return 1
          if (bIndex === -1) return -1
          return aIndex - bIndex
        })
      
      case 'high-quality':
        return available.filter(model => 
          model.includes('gpt-4o') || model.includes('claude-3-5-sonnet')
        )
      
      case 'fast':
        return available.filter(model => 
          model.includes('mini') || model.includes('flash')
        )
      
      default:
        return available
    }
  }
}