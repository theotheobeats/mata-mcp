/**
 * Response Transformer for MCP Vision Bridge
 * Converts multimodal responses to text-only format for non-vision LLMs
 */

import { 
  ChatCompletionResponse, 
  VisionResponse, 
  TextBlock,
  StreamChunk 
} from '../types'
import { logger } from '../utils/logging'

export interface TransformOptions {
  includeMetadata?: boolean
  includeConfidence?: boolean
  includeProcessingTime?: boolean
  preserveFormatting?: boolean
  maxResponseLength?: number
  addAnalysisPrefix?: boolean
}

export interface StreamingTransformOptions extends TransformOptions {
  chunkSize?: number
  includeProgress?: boolean
}

export class ResponseTransformer {
  private defaultOptions: TransformOptions = {
    includeMetadata: true,
    includeConfidence: true,
    includeProcessingTime: true,
    preserveFormatting: false,
    maxResponseLength: 4000,
    addAnalysisPrefix: true
  }

  /**
   * Transform a complete vision response to text-only format
   */
  transformVisionResponse(
    response: ChatCompletionResponse,
    options: TransformOptions = {}
  ): VisionResponse {
    const opts = { ...this.defaultOptions, ...options }
    const startTime = Date.now()

    try {
      // Extract content from the response
      const content = this.extractContent(response)
      const metadata = this.extractMetadata(response, opts)

      // Format the response text
      const formattedText = this.formatResponseText(content, opts)

      // Create the transformed response
      const transformed: VisionResponse = {
        content: [
          {
            type: 'text',
            text: formattedText
          }
        ]
      }

      // Add metadata if requested
      if (opts.includeMetadata) {
        transformed.metadata = {
          ...metadata,
          processing_time_ms: opts.includeProcessingTime ? Date.now() - startTime : undefined
        }
      }

      logger.debug('Response transformed successfully', {
        originalLength: content.length,
        transformedLength: formattedText.length,
        hasMetadata: !!transformed.metadata
      })

      return transformed

    } catch (error) {
      logger.error('Failed to transform response', error, {
        responseId: response.id,
        model: response.model
      })

      // Return error response
      return {
        content: [
          {
            type: 'text',
            text: 'I apologize, but I encountered an error while processing the image. Please try again.'
          }
        ],
        metadata: {
          model_used: response.model,
          confidence_score: 0,
          processing_time_ms: Date.now() - startTime,
          error: error.message
        }
      }
    }
  }

  /**
   * Transform streaming response chunks
   */
  async *transformStreamingResponse(
    stream: AsyncGenerator<StreamChunk>,
    options: StreamingTransformOptions = {}
  ): AsyncGenerator<VisionResponse> {
    const opts = { ...this.defaultOptions, ...options }
    let accumulatedText = ''
    let chunkBuffer = ''
    let hasImageAnalysis = false

    try {
      for await (const chunk of stream) {
        if (chunk.type === 'error') {
          // Handle error chunk
          yield this.createErrorResponse(chunk.error || 'Streaming error occurred')
          break
        }

        if (chunk.type === 'done') {
          // Finalize the response
          if (accumulatedText.trim()) {
            const finalResponse = this.createFinalResponse(accumulatedText, opts)
            yield finalResponse
          }
          break
        }

        if (chunk.type === 'delta' && chunk.data) {
          chunkBuffer += chunk.data
          
          // Process complete sentences or when buffer gets large
          if (this.shouldProcessChunk(chunkBuffer, opts)) {
            const processedChunk = this.processChunk(chunkBuffer, opts)
            accumulatedText += processedChunk
            
            // Check if this appears to be image analysis
            if (!hasImageAnalysis && this.isImageAnalysis(accumulatedText)) {
              hasImageAnalysis = true
            }
            
            // Create intermediate response
            const intermediateResponse = this.createIntermediateResponse(
              accumulatedText, 
              hasImageAnalysis, 
              opts
            )
            
            yield intermediateResponse
            
            chunkBuffer = ''
          }
        }
      }

      // Handle any remaining buffer
      if (chunkBuffer.trim()) {
        const processedChunk = this.processChunk(chunkBuffer, opts)
        accumulatedText += processedChunk
        
        const finalResponse = this.createFinalResponse(accumulatedText, opts)
        yield finalResponse
      }

    } catch (error) {
      logger.error('Streaming transformation failed', error)
      yield this.createErrorResponse(`Streaming error: ${error.message}`)
    }
  }

  /**
   * Extract content from OpenRouter response
   */
  private extractContent(response: ChatCompletionResponse): string {
    const choice = response.choices?.[0]
    if (!choice) {
      throw new Error('No choices in response')
    }

    const message = choice.message
    if (!message) {
      throw new Error('No message in choice')
    }

    // Handle different content formats
    if (typeof message.content === 'string') {
      return message.content
    }

    if (Array.isArray(message.content)) {
      // Combine text content, ignore image content
      const textContent = message.content
        .filter(item => item.type === 'text' && item.text)
        .map(item => item.text)
        .join(' ')
      
      return textContent || 'No text content available'
    }

    return 'No content available'
  }

  /**
   * Extract metadata from response
   */
  private extractMetadata(response: ChatCompletionResponse, options: TransformOptions): VisionResponse['metadata'] {
    const metadata: VisionResponse['metadata'] = {
      model_used: response.model
    }

    // Add token usage if available
    if (response.usage) {
      metadata.tokens_used = response.usage.total_tokens
    }

    // Add confidence score (this would typically come from model-specific parsing)
    if (options.includeConfidence) {
      metadata.confidence_score = this.estimateConfidence(response)
    }

    // Add finish reason
    const finishReason = response.choices?.[0]?.finish_reason
    if (finishReason && finishReason !== 'stop') {
      metadata.finish_reason = finishReason
    }

    return metadata
  }

  /**
   * Format response text based on options
   */
  private formatResponseText(content: string, options: TransformOptions): string {
    let formatted = content.trim()

    // Add analysis prefix if requested
    if (options.addAnalysisPrefix && this.appearsToBeImageAnalysis(formatted)) {
      formatted = `Image Analysis:\n\n${formatted}`
    }

    // Preserve or normalize formatting
    if (!options.preserveFormatting) {
      // Normalize whitespace and line breaks
      formatted = formatted
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
    }

    // Truncate if too long
    if (options.maxResponseLength && formatted.length > options.maxResponseLength) {
      formatted = this.truncateResponse(formatted, options.maxResponseLength)
    }

    return formatted
  }

  /**
   * Estimate confidence score from response characteristics
   */
  private estimateConfidence(response: ChatCompletionResponse): number {
    let confidence = 0.7 // Base confidence

    // Adjust based on response length (longer responses often indicate more thorough analysis)
    const content = this.extractContent(response)
    if (content.length > 200) confidence += 0.1
    if (content.length > 500) confidence += 0.1

    // Adjust based on token usage
    if (response.usage) {
      const { prompt_tokens, completion_tokens } = response.usage
      const ratio = completion_tokens / Math.max(prompt_tokens, 1)
      
      // Higher completion ratio might indicate more detailed analysis
      if (ratio > 0.5) confidence += 0.1
    }

    // Adjust based on finish reason
    const finishReason = response.choices?.[0]?.finish_reason
    if (finishReason === 'stop') confidence += 0.1
    if (finishReason === 'length') confidence -= 0.2

    return Math.max(0, Math.min(1, confidence))
  }

  /**
   * Check if content appears to be image analysis
   */
  private appearsToBeImageAnalysis(content: string): boolean {
    const analysisKeywords = [
      'image', 'picture', 'photo', 'visual', 'see', 'observe', 'notice',
      'depicts', 'shows', 'displays', 'contains', 'features', 'elements'
    ]
    
    const lowerContent = content.toLowerCase()
    return analysisKeywords.some(keyword => lowerContent.includes(keyword))
  }

  /**
   * Check if accumulated text contains image analysis indicators
   */
  private isImageAnalysis(text: string): boolean {
    const indicators = [
      'i can see', 'the image shows', 'in this picture', 'the photo depicts',
      'visual analysis', 'image content', 'what i observe'
    ]
    
    const lowerText = text.toLowerCase()
    return indicators.some(indicator => lowerText.includes(indicator))
  }

  /**
   * Determine if chunk should be processed
   */
  private shouldProcessChunk(chunk: string, options: StreamingTransformOptions): boolean {
    const chunkSize = options.chunkSize || 100
    
    // Process if chunk is large enough
    if (chunk.length >= chunkSize) return true
    
    // Process if chunk ends with sentence punctuation
    if (/[.!?]\s*$/.test(chunk)) return true
    
    // Process if chunk ends with line break
    if (/\n\s*$/.test(chunk)) return true
    
    return false
  }

  /**
   * Process a chunk of text
   */
  private processChunk(chunk: string, options: StreamingTransformOptions): string {
    let processed = chunk.trim()
    
    // Add spacing if needed
    if (processed && !processed.match(/^[.!?\n]/)) {
      processed = ' ' + processed
    }
    
    return processed
  }

  /**
   * Create intermediate response for streaming
   */
  private createIntermediateResponse(
    text: string, 
    hasImageAnalysis: boolean, 
    options: StreamingTransformOptions
  ): VisionResponse {
    const prefix = hasImageAnalysis && options.addAnalysisPrefix ? 'Analyzing image...\n\n' : ''
    
    return {
      content: [
        {
          type: 'text',
          text: prefix + text
        }
      ],
      metadata: {
        model_used: 'streaming',
        confidence_score: 0.5,
        streaming: true,
        partial: true
      }
    }
  }

  /**
   * Create final response from accumulated text
   */
  private createFinalResponse(text: string, options: TransformOptions): VisionResponse {
    return {
      content: [
        {
          type: 'text',
          text: this.formatResponseText(text, options)
        }
      ],
      metadata: {
        model_used: 'streaming',
        confidence_score: 0.8,
        streaming: false,
        partial: false
      }
    }
  }

  /**
   * Create error response
   */
  private createErrorResponse(errorMessage: string): VisionResponse {
    return {
      content: [
        {
          type: 'text',
          text: `I apologize, but I encountered an error while processing your request: ${errorMessage}. Please try again.`
        }
      ],
      metadata: {
        model_used: 'error',
        confidence_score: 0,
        error: errorMessage
      }
    }
  }

  /**
   * Truncate response to maximum length
   */
  private truncateResponse(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    
    // Try to truncate at a sentence boundary
    const truncated = text.substring(0, maxLength - 50)
    const lastSentence = truncated.lastIndexOf('.')
    const lastLineBreak = truncated.lastIndexOf('\n')
    
    const cutoff = Math.max(lastSentence, lastLineBreak)
    
    if (cutoff > maxLength * 0.7) {
      return truncated.substring(0, cutoff + 1) + '\n\n[Response truncated]'
    }
    
    return truncated + '...\n\n[Response truncated]'
  }

  /**
   * Extract text blocks from OCR responses
   */
  extractTextBlocks(response: ChatCompletionResponse): TextBlock[] {
    const content = this.extractContent(response)
    
    // This is a simplified implementation
    // In a real implementation, you might parse structured responses
    // or use model-specific parsing for better OCR results
    
    const lines = content.split('\n').filter(line => line.trim())
    
    return lines.map((line, index) => ({
      text: line.trim(),
      confidence: 0.8, // Default confidence
      bbox: {
        x: 0,
        y: index * 20,
        width: line.length * 10,
        height: 20
      }
    }))
  }

  /**
   * Transform response for specific tool types
   */
  transformForTool(
    response: ChatCompletionResponse,
    toolType: 'analyze' | 'describe' | 'extract-text',
    options: TransformOptions = {}
  ): VisionResponse {
    const baseTransformed = this.transformVisionResponse(response, options)
    
    // Add tool-specific formatting
    switch (toolType) {
      case 'analyze':
        if (options.addAnalysisPrefix && !baseTransformed.content[0].text.startsWith('Image Analysis:')) {
          baseTransformed.content[0].text = `Image Analysis:\n\n${baseTransformed.content[0].text}`
        }
        break
        
      case 'describe':
        if (options.addAnalysisPrefix && !baseTransformed.content[0].text.startsWith('Image Description:')) {
          baseTransformed.content[0].text = `Image Description:\n\n${baseTransformed.content[0].text}`
        }
        break
        
      case 'extract-text':
        // For OCR, extract text blocks if available
        const textBlocks = this.extractTextBlocks(response)
        if (textBlocks.length > 0) {
          baseTransformed.metadata = {
            ...baseTransformed.metadata,
            extracted_text_blocks: textBlocks,
            total_confidence: textBlocks.reduce((sum, block) => sum + block.confidence, 0) / textBlocks.length
          }
        }
        break
    }
    
    return baseTransformed
  }

  /**
   * Get transformation statistics
   */
  getStats(): {
    totalTransformations: number
    averageResponseLength: number
    streamingTransformations: number
  } {
    // This would track statistics in a real implementation
    return {
      totalTransformations: 0,
      averageResponseLength: 0,
      streamingTransformations: 0
    }
  }

  /**
   * Update default options
   */
  updateDefaultOptions(newOptions: Partial<TransformOptions>): void {
    this.defaultOptions = { ...this.defaultOptions, ...newOptions }
    
    logger.debug('Response transformer options updated', newOptions)
  }

  /**
   * Get current default options
   */
  getDefaultOptions(): TransformOptions {
    return { ...this.defaultOptions }
  }
}