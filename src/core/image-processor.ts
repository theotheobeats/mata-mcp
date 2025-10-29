/**
 * Image Processor for MCP Vision Bridge
 * Handles image validation, processing, and optimization
 */

import sharp from 'sharp'
import fs from 'fs/promises'
import path from 'path'
import axios from 'axios'
import { ImageData, ImageProcessingOptions, VisionBridgeError } from '../types'
import { logger } from '../utils/logging'

export class ImageProcessor {
  private tempDir: string
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(
    private options: ImageProcessingOptions = {}
  ) {
    this.options = {
      maxSize: 10 * 1024 * 1024, // 10MB default
      allowedFormats: ['jpeg', 'jpg', 'png', 'webp', 'gif'],
      quality: 85,
      maxDimension: 2048,
      ...options
    }

    this.tempDir = this.options.tempDir || '/tmp/vision-bridge'
    this.initializeTempDirectory()
    this.startCleanupScheduler()
  }

  private async initializeTempDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true })
      logger.debug('Image processor temp directory initialized', { tempDir: this.tempDir })
    } catch (error) {
      logger.error('Failed to create temp directory', error, { tempDir: this.tempDir })
    }
  }

  private startCleanupScheduler(): void {
    // Clean up old temp files every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupTempFiles().catch(error => {
        logger.error('Failed to cleanup temp files', error)
      })
    }, 5 * 60 * 1000)
  }

  /**
   * Process an image from URL or base64 data
   */
  async processImage(imageUrl: string): Promise<ImageData> {
    const startTime = Date.now()
    
    try {
      logger.logImageProcessing(imageUrl, 'unknown', 0, 0, false, { operation: 'start' })

      // Validate image input
      const validation = this.validateImageInput(imageUrl)
      if (!validation.valid) {
        throw this.createError('INVALID_IMAGE_INPUT', validation.error || 'Invalid image input')
      }

      let imageBuffer: Buffer
      let format: string
      let size: number

      if (validation.type === 'base64') {
        // Process base64 image
        const base64Data = imageUrl.split(',')[1]
        imageBuffer = Buffer.from(base64Data, 'base64')
        format = this.extractFormatFromDataUrl(imageUrl)
      } else {
        // Download image from URL
        const downloadResult = await this.downloadImage(imageUrl)
        imageBuffer = downloadResult.buffer
        format = downloadResult.format
      }

      size = imageBuffer.length

      // Validate image size
      if (size > this.options.maxSize!) {
        throw this.createError('IMAGE_TOO_LARGE', `Image size (${size} bytes) exceeds limit (${this.options.maxSize} bytes)`)
      }

      // Validate and normalize format
      if (!this.options.allowedFormats!.includes(format.toLowerCase())) {
        throw this.createError('UNSUPPORTED_FORMAT', `Image format '${format}' is not supported`)
      }

      // Optimize image if needed
      const optimizedBuffer = await this.optimizeImage(imageBuffer, format)
      const optimizedFormat = format.toLowerCase()

      // Create data URL
      const mimeType = this.getMimeType(optimizedFormat)
      const dataUrl = `data:${mimeType};base64,${optimizedBuffer.toString('base64')}`

      const result: ImageData = {
        url: dataUrl,
        format: optimizedFormat,
        size: optimizedBuffer.length,
        base64: optimizedBuffer.toString('base64')
      }

      const duration = Date.now() - startTime
      logger.logImageProcessing(imageUrl, optimizedFormat, optimizedBuffer.length, duration, true, {
        operation: 'complete',
        originalSize: size,
        optimizedSize: optimizedBuffer.length,
        compressionRatio: (optimizedBuffer.length / size).toFixed(2)
      })

      return result

    } catch (error) {
      const duration = Date.now() - startTime
      
      if (error instanceof Error && 'code' in error) {
        // Re-throw VisionBridgeError
        throw error
      }
      
      logger.logImageProcessing(imageUrl, 'unknown', 0, duration, false, {
        operation: 'error',
        error: error.message
      })
      
      throw this.createError('PROCESSING_ERROR', `Failed to process image: ${error.message}`)
    }
  }

  /**
   * Download image from URL
   */
  private async downloadImage(imageUrl: string): Promise<{ buffer: Buffer; format: string }> {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'MCP-Vision-Bridge/1.0'
        }
      })

      // Detect format from content type or URL
      const contentType = response.headers['content-type']
      let format = this.extractFormatFromContentType(contentType)
      
      if (!format) {
        format = this.extractFormatFromUrl(imageUrl)
      }

      if (!format) {
        // Try to detect format from buffer
        format = await this.detectImageFormat(Buffer.from(response.data))
      }

      if (!format) {
        throw new Error('Unable to detect image format')
      }

      return {
        buffer: Buffer.from(response.data),
        format
      }

    } catch (error) {
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw this.createError('IMAGE_URL_INACCESSIBLE', `Cannot access image URL: ${error.message}`)
      }
      
      if (error.response?.status === 404) {
        throw this.createError('IMAGE_NOT_FOUND', 'Image not found at the provided URL')
      }
      
      if (error.response?.status === 403) {
        throw this.createError('IMAGE_ACCESS_FORBIDDEN', 'Access to image is forbidden')
      }

      throw this.createError('DOWNLOAD_ERROR', `Failed to download image: ${error.message}`)
    }
  }

  /**
   * Optimize image for vision models
   */
  private async optimizeImage(buffer: Buffer, format: string): Promise<Buffer> {
    try {
      let sharpInstance = sharp(buffer)

      // Get image metadata
      const metadata = await sharpInstance.metadata()
      
      // Resize if image is too large
      if (metadata.width && metadata.height) {
        const maxDimension = this.options.maxDimension!
        
        if (metadata.width > maxDimension || metadata.height > maxDimension) {
          sharpInstance = sharpInstance.resize(maxDimension, maxDimension, {
            fit: 'inside',
            withoutEnlargement: true
          })
        }
      }

      // Convert format if necessary and apply quality settings
      switch (format.toLowerCase()) {
        case 'jpeg':
        case 'jpg':
          sharpInstance = sharpInstance.jpeg({ 
            quality: this.options.quality!,
            progressive: true,
            mozjpeg: true
          })
          break
        case 'png':
          sharpInstance = sharpInstance.png({ 
            quality: this.options.quality!,
            compressionLevel: 9,
            progressive: true
          })
          break
        case 'webp':
          sharpInstance = sharpInstance.webp({ 
            quality: this.options.quality!,
            effort: 4
          })
          break
        case 'gif':
          // Don't optimize GIFs (sharp doesn't handle animated GIFs well)
          return buffer
      }

      return await sharpInstance.toBuffer()

    } catch (error) {
      logger.warn('Image optimization failed, using original', { 
        format, 
        error: error.message 
      })
      return buffer
    }
  }

  /**
   * Validate image input format
   */
  private validateImageInput(imageUrl: string): { valid: boolean; type: 'url' | 'base64'; error?: string } {
    if (!imageUrl || typeof imageUrl !== 'string') {
      return { valid: false, type: 'url', error: 'Image URL is required' }
    }

    // Check if it's a data URL
    if (imageUrl.startsWith('data:image/')) {
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
   * Extract format from data URL
   */
  private extractFormatFromDataUrl(dataUrl: string): string {
    const match = dataUrl.match(/^data:image\/([^;]+)/)
    return match ? match[1].toLowerCase() : 'unknown'
  }

  /**
   * Extract format from content type header
   */
  private extractFormatFromContentType(contentType: string): string | null {
    if (!contentType) return null
    
    const match = contentType.match(/image\/([^;]+)/)
    return match ? match[1].toLowerCase() : null
  }

  /**
   * Extract format from URL
   */
  private extractFormatFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname.toLowerCase()
      const extension = pathname.split('.').pop()
      
      if (extension && ['jpeg', 'jpg', 'png', 'webp', 'gif'].includes(extension)) {
        return extension
      }
    } catch {
      // Invalid URL
    }
    
    return null
  }

  /**
   * Detect image format from buffer
   */
  private async detectImageFormat(buffer: Buffer): Promise<string | null> {
    try {
      const metadata = await sharp(buffer).metadata()
      return metadata.format || null
    } catch {
      return null
    }
  }

  /**
   * Get MIME type for format
   */
  private getMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      'jpeg': 'image/jpeg',
      'jpg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
      'gif': 'image/gif'
    }
    
    return mimeTypes[format.toLowerCase()] || 'image/jpeg'
  }

  /**
   * Create temporary file for image
   */
  private async createTempFile(buffer: Buffer, format: string): Promise<string> {
    const filename = `image_${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${format}`
    const filepath = path.join(this.tempDir, filename)
    
    await fs.writeFile(filepath, buffer)
    return filepath
  }

  /**
   * Clean up temporary files
   */
  private async cleanupTempFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir)
      const now = Date.now()
      const maxAge = 30 * 60 * 1000 // 30 minutes

      for (const file of files) {
        const filepath = path.join(this.tempDir, file)
        try {
          const stats = await fs.stat(filepath)
          if (now - stats.mtime.getTime() > maxAge) {
            await fs.unlink(filepath)
            logger.debug('Cleaned up temp file', { filepath, age: now - stats.mtime.getTime() })
          }
        } catch (error) {
          // File might have been deleted already
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup temp files', error)
    }
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
   * Get image metadata without full processing
   */
  async getImageMetadata(imageUrl: string): Promise<{
    width?: number
    height?: number
    format?: string
    size: number
    hasAlpha?: boolean
  }> {
    try {
      let buffer: Buffer
      let format: string

      if (imageUrl.startsWith('data:image/')) {
        const base64Data = imageUrl.split(',')[1]
        buffer = Buffer.from(base64Data, 'base64')
        format = this.extractFormatFromDataUrl(imageUrl)
      } else {
        const downloadResult = await this.downloadImage(imageUrl)
        buffer = downloadResult.buffer
        format = downloadResult.format
      }

      const metadata = await sharp(buffer).metadata()
      
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: buffer.length,
        hasAlpha: metadata.hasAlpha
      }

    } catch (error) {
      throw this.createError('METADATA_ERROR', `Failed to get image metadata: ${error.message}`)
    }
  }

  /**
   * Validate image for specific model requirements
   */
  validateForModel(imageUrl: string, modelCapabilities: {
    maxImageSize: number
    supportedFormats: string[]
  }): { valid: boolean; issues: string[] } {
    const issues: string[] = []

    try {
      // Basic format validation
      const format = imageUrl.startsWith('data:image/') 
        ? this.extractFormatFromDataUrl(imageUrl)
        : this.extractFormatFromUrl(imageUrl)

      if (!format) {
        issues.push('Unable to detect image format')
      } else if (!modelCapabilities.supportedFormats.includes(format.toLowerCase())) {
        issues.push(`Format '${format}' not supported by model`)
      }

      // Size validation (approximate for URLs)
      if (imageUrl.startsWith('data:image/')) {
        const base64Size = Math.ceil((imageUrl.length - imageUrl.indexOf(',') - 1) * 0.75)
        if (base64Size > modelCapabilities.maxImageSize) {
          issues.push(`Image size (${base64Size} bytes) exceeds model limit (${modelCapabilities.maxImageSize} bytes)`)
        }
      }

    } catch (error) {
      issues.push(`Validation error: ${error.message}`)
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }

  /**
   * Shutdown image processor and cleanup resources
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }

    // Final cleanup
    await this.cleanupTempFiles()
    
    logger.info('Image processor shutdown complete')
  }

  /**
   * Get processor statistics
   */
  getStats(): {
    tempDir: string
    options: ImageProcessingOptions
  } {
    return {
      tempDir: this.tempDir,
      options: { ...this.options }
    }
  }
}