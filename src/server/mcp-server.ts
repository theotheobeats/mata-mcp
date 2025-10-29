/**
 * MCP Vision Bridge Server
 * Main server implementation that exposes vision tools via MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  InitializeRequestSchema 
} from '@modelcontextprotocol/sdk/types.js'
import { configLoader } from '../config/config-loader'
import { logger } from '../utils/logging'
import { 
  ServerConfig, 
  VisionBridgeError,
  HealthStatus,
  AnalyzeImageRequest,
  DescribeImageRequest,
  ExtractTextRequest,
  VisionResponse
} from '../types'
import { OpenRouterClient } from '../integrations/openrouter/client'
import { ModelManager } from '../integrations/openrouter/models'
import { ImageProcessor } from '../core/image-processor'
import { ModelRouter } from '../core/model-router'
import { ResponseTransformer } from '../core/response-transformer'

export class MCPVisionServer {
  private server: Server
  private config: ServerConfig
  private openRouterClient: OpenRouterClient
  private modelManager: ModelManager
  private imageProcessor: ImageProcessor
  private modelRouter: ModelRouter
  private responseTransformer: ResponseTransformer
  private healthStatus: HealthStatus
  private startTime: number

  constructor() {
    this.startTime = Date.now()
    this.healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: 0,
      version: '1.0.0',
      checks: {
        openrouter: 'up',
        cache: 'up',
        memory: 'ok'
      }
    }
  }

  /**
   * Initialize the server with configuration
   */
  async initialize(configPath?: string, env?: string): Promise<void> {
    try {
      // Load configuration
      this.config = await configLoader.load(configPath, env)
      configLoader.validateRequired(this.config)

      logger.info('Initializing MCP Vision Bridge Server', {
        transport: this.config.server.transport,
        primaryModel: this.config.models.primary,
        fallbackModels: this.config.models.fallback
      })

      // Initialize components
      await this.initializeComponents()

      // Initialize MCP server
      this.initializeMCPServer()

      logger.info('MCP Vision Bridge Server initialized successfully')

    } catch (error) {
      logger.error('Failed to initialize server', error)
      throw error
    }
  }

  /**
   * Initialize all server components
   */
  private async initializeComponents(): Promise<void> {
    // Initialize OpenRouter client
    this.openRouterClient = new OpenRouterClient(this.config.openrouter)

    // Initialize model manager
    this.modelManager = new ModelManager(this.config.models)

    // Initialize image processor
    this.imageProcessor = new ImageProcessor({
      maxSize: this.config.image.maxSize,
      allowedFormats: this.config.image.allowedFormats,
      quality: this.config.image.quality,
      maxDimension: this.config.image.maxDimension,
      tempDir: this.config.image.tempDir,
      cleanupTempFiles: this.config.image.cleanupTempFiles
    })

    // Initialize model router
    this.modelRouter = new ModelRouter(
      this.config.models,
      this.openRouterClient,
      this.modelManager
    )

    // Initialize response transformer
    this.responseTransformer = new ResponseTransformer()

    // Test OpenRouter connectivity
    const connected = await this.openRouterClient.testConnection()
    if (!connected) {
      throw new Error('Failed to connect to OpenRouter API')
    }

    // Pre-warm models
    await this.modelRouter.preWarmModels()

    logger.info('All components initialized successfully')
  }

  /**
   * Initialize MCP server with tools and handlers
   */
  private initializeMCPServer(): void {
    this.server = new Server(
      {
        name: 'mcp-vision-bridge',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    )

    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.debug('Handling tools list request')
      
      return {
        tools: [
          {
            name: 'analyze_image',
            description: 'Analyze an image using vision-capable models through OpenRouter',
            inputSchema: {
              type: 'object',
              properties: {
                image_url: {
                  type: 'string',
                  description: 'URL or base64-encoded image data'
                },
                prompt: {
                  type: 'string',
                  description: 'Analysis prompt describing what to analyze in the image'
                },
                model: {
                  type: 'string',
                  description: 'Vision model to use (optional, uses primary model by default)'
                },
                max_tokens: {
                  type: 'number',
                  description: 'Maximum tokens in response (optional, defaults to 1000)'
                },
                temperature: {
                  type: 'number',
                  description: 'Sampling temperature 0-2 (optional, defaults to 0.7)'
                },
                detail_level: {
                  type: 'string',
                  enum: ['low', 'medium', 'high'],
                  description: 'Level of detail for analysis (optional, defaults to medium)'
                }
              },
              required: ['image_url', 'prompt']
            }
          },
          {
            name: 'describe_image',
            description: 'Get detailed description of image content with automatic analysis',
            inputSchema: {
              type: 'object',
              properties: {
                image_url: {
                  type: 'string',
                  description: 'URL or base64-encoded image data'
                },
                detail_level: {
                  type: 'string',
                  enum: ['low', 'medium', 'high'],
                  description: 'Level of detail: low (brief), medium (standard), high (comprehensive)'
                },
                include_objects: {
                  type: 'boolean',
                  description: 'Whether to include detected objects list (defaults to true)'
                },
                include_colors: {
                  type: 'boolean',
                  description: 'Whether to include color analysis (defaults to true)'
                },
                include_text: {
                  type: 'boolean',
                  description: 'Whether to extract any visible text (defaults to true)'
                }
              },
              required: ['image_url']
            }
          },
          {
            name: 'extract_text_from_image',
            description: 'Extract text content from images using OCR capabilities',
            inputSchema: {
              type: 'object',
              properties: {
                image_url: {
                  type: 'string',
                  description: 'URL or base64-encoded image data'
                },
                language: {
                  type: 'string',
                  description: 'Language hint for OCR (e.g., "en", "es", "fr")'
                },
                preserve_formatting: {
                  type: 'boolean',
                  description: 'Whether to preserve text formatting and layout'
                },
                include_confidence: {
                  type: 'boolean',
                  description: 'Whether to include confidence scores for text blocks'
                }
              },
              required: ['image_url']
            }
          }
        ]
      }
    })

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const startTime = Date.now()
      const { name, arguments: args } = request.params

      logger.logMCPRequest(name, args, 0, false, { requestId: request.id })

      try {
        let result: VisionResponse

        switch (name) {
          case 'analyze_image':
            result = await this.handleAnalyzeImage(args as AnalyzeImageRequest)
            break
          case 'describe_image':
            result = await this.handleDescribeImage(args as DescribeImageRequest)
            break
          case 'extract_text_from_image':
            result = await this.handleExtractText(args as ExtractTextRequest)
            break
          default:
            throw this.createError('TOOL_NOT_FOUND', `Tool '${name}' not found`)
        }

        const duration = Date.now() - startTime
        logger.logMCPRequest(name, args, duration, true, { 
          requestId: request.id,
          resultLength: result.content[0].text.length
        })

        return {
          content: result.content,
          metadata: result.metadata
        }

      } catch (error) {
        const duration = Date.now() - startTime
        logger.logMCPRequest(name, args, duration, false, { 
          requestId: request.id,
          error: error.message
        })

        // Return error in MCP format
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        }
      }
    })
  }

  /**
   * Handle analyze_image tool
   */
  private async handleAnalyzeImage(request: AnalyzeImageRequest): Promise<VisionResponse> {
    const { image_url, prompt, model, max_tokens, temperature, detail_level } = request

    // Validate inputs
    if (!image_url || !prompt) {
      throw this.createError('INVALID_INPUT', 'image_url and prompt are required')
    }

    // Process image
    const processedImage = await this.imageProcessor.processImage(image_url)

    // Select model
    const modelSelection = await this.modelRouter.selectModel({
      hasImage: true,
      preferredModel: model,
      maxTokens: max_tokens || this.config.models.defaultMaxTokens
    })

    // Create OpenRouter request
    const openRouterRequest = {
      model: modelSelection.model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: this.buildAnalysisPrompt(prompt, detail_level)
            },
            {
              type: 'image_url',
              image_url: {
                url: processedImage.url
              }
            }
          ]
        }
      ],
      max_tokens: max_tokens || this.config.models.defaultMaxTokens,
      temperature: temperature || this.config.models.defaultTemperature
    }

    // Make request to OpenRouter
    const response = await this.openRouterClient.createChatCompletion(openRouterRequest)

    // Transform response
    return this.responseTransformer.transformForTool(response, 'analyze', {
      includeMetadata: true,
      includeConfidence: true,
      addAnalysisPrefix: true
    })
  }

  /**
   * Handle describe_image tool
   */
  private async handleDescribeImage(request: DescribeImageRequest): Promise<VisionResponse> {
    const { 
      image_url, 
      detail_level = 'medium', 
      include_objects = true, 
      include_colors = true, 
      include_text = true 
    } = request

    // Validate inputs
    if (!image_url) {
      throw this.createError('INVALID_INPUT', 'image_url is required')
    }

    // Process image
    const processedImage = await this.imageProcessor.processImage(image_url)

    // Select model
    const modelSelection = await this.modelRouter.selectModel({
      hasImage: true,
      requiresHighQuality: detail_level === 'high'
    })

    // Build description prompt
    const prompt = this.buildDescriptionPrompt(detail_level, include_objects, include_colors, include_text)

    // Create OpenRouter request
    const openRouterRequest = {
      model: modelSelection.model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: processedImage.url
              }
            }
          ]
        }
      ],
      max_tokens: this.config.models.defaultMaxTokens,
      temperature: this.config.models.defaultTemperature
    }

    // Make request to OpenRouter
    const response = await this.openRouterClient.createChatCompletion(openRouterRequest)

    // Transform response
    return this.responseTransformer.transformForTool(response, 'describe', {
      includeMetadata: true,
      includeConfidence: true,
      addAnalysisPrefix: true
    })
  }

  /**
   * Handle extract_text_from_image tool
   */
  private async handleExtractText(request: ExtractTextRequest): Promise<VisionResponse> {
    const { 
      image_url, 
      language = 'en', 
      preserve_formatting = false, 
      include_confidence = true 
    } = request

    // Validate inputs
    if (!image_url) {
      throw this.createError('INVALID_INPUT', 'image_url is required')
    }

    // Process image
    const processedImage = await this.imageProcessor.processImage(image_url)

    // Select model (prefer models with good OCR capabilities)
    const modelSelection = await this.modelRouter.selectModel({
      hasImage: true,
      preferredModel: this.config.models.primary
    })

    // Build OCR prompt
    const prompt = this.buildOCRPrompt(language, preserve_formatting)

    // Create OpenRouter request
    const openRouterRequest = {
      model: modelSelection.model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: processedImage.url
              }
            }
          ]
        }
      ],
      max_tokens: this.config.models.defaultMaxTokens,
      temperature: 0.1 // Lower temperature for more consistent OCR
    }

    // Make request to OpenRouter
    const response = await this.openRouterClient.createChatCompletion(openRouterRequest)

    // Transform response
    return this.responseTransformer.transformForTool(response, 'extract-text', {
      includeMetadata: true,
      includeConfidence: include_confidence,
      addAnalysisPrefix: false
    })
  }

  /**
   * Build analysis prompt based on parameters
   */
  private buildAnalysisPrompt(userPrompt: string, detailLevel?: string): string {
    let prompt = `Please analyze the following image in detail. ${userPrompt}`

    if (detailLevel) {
      switch (detailLevel) {
        case 'low':
          prompt += ' Provide a brief, high-level analysis.'
          break
        case 'high':
          prompt += ' Provide a comprehensive, detailed analysis with specific observations.'
          break
        default:
          prompt += ' Provide a balanced, detailed analysis.'
      }
    }

    prompt += ' Focus on visual elements, composition, and any notable features.'
    
    return prompt
  }

  /**
   * Build description prompt based on parameters
   */
  private buildDescriptionPrompt(
    detailLevel: string, 
    includeObjects: boolean, 
    includeColors: boolean, 
    includeText: boolean
  ): string {
    let prompt = 'Please describe this image'

    switch (detailLevel) {
      case 'low':
        prompt += ' in a brief overview'
        break
      case 'high':
        prompt += ' in comprehensive detail'
        break
      default:
        prompt += ' in detail'
    }

    const elements = []
    if (includeObjects) elements.push('objects and subjects')
    if (includeColors) elements.push('colors and visual style')
    if (includeText) elements.push('any visible text')

    if (elements.length > 0) {
      prompt += `, including ${elements.join(', ')}`
    }

    prompt += '. Be objective and descriptive.'

    return prompt
  }

  /**
   * Build OCR prompt based on parameters
   */
  private buildOCRPrompt(language: string, preserveFormatting: boolean): string {
    let prompt = `Please extract all text from this image`

    if (language !== 'en') {
      prompt += ` (the text appears to be in ${language})`
    }

    if (preserveFormatting) {
      prompt += '. Preserve the original formatting, layout, and structure as much as possible.'
    } else {
      prompt += '. Extract the text content while maintaining readability.'
    }

    prompt += ' If no text is visible, please indicate that clearly.'

    return prompt
  }

  /**
   * Create VisionBridgeError
   */
  private createError(code: string, message: string, retryable = false): VisionBridgeError {
    return {
      code,
      message,
      retryable,
      retryAfter: retryable ? 1000 : undefined
    }
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      if (this.config.server.transport === 'stdio') {
        const transport = new StdioServerTransport()
        await this.server.connect(transport)
        logger.info('MCP Vision Bridge Server started with stdio transport')
      } else {
        throw new Error('HTTP transport not yet implemented')
      }
    } catch (error) {
      logger.error('Failed to start server', error)
      throw error
    }
  }

  /**
   * Get server health status
   */
  getHealthStatus(): HealthStatus {
    const uptime = Date.now() - this.startTime
    
    return {
      ...this.healthStatus,
      uptime: Math.floor(uptime / 1000),
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Get server statistics
   */
  getStats(): {
    config: ServerConfig
    openRouter: ReturnType<OpenRouterClient['getUsageStats']>
    modelRouter: ReturnType<ModelRouter['getMetrics']>
    imageProcessor: ReturnType<ImageProcessor['getStats']>
  } {
    return {
      config: this.config,
      openRouter: this.openRouterClient.getUsageStats(),
      modelRouter: this.modelRouter.getMetrics(),
      imageProcessor: this.imageProcessor.getStats()
    }
  }

  /**
   * Shutdown server and cleanup resources
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down MCP Vision Bridge Server')

    try {
      // Shutdown components
      await this.imageProcessor.shutdown()
      await this.openRouterClient.close()
      
      // Close MCP server
      if (this.server) {
        await this.server.close()
      }

      logger.info('MCP Vision Bridge Server shutdown complete')
    } catch (error) {
      logger.error('Error during shutdown', error)
    }
  }
}