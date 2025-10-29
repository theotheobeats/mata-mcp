#!/usr/bin/env node

/**
 * Basic usage example for MCP Vision Bridge
 * This demonstrates how to use the vision bridge with a simple client
 */

const { spawn } = require('child_process')
const { ClientSession, StdioServerParameters } = require('@modelcontextprotocol/sdk/client/index.js')
const { StdioTransport } = require('@modelcontextprotocol/sdk/client/stdio.js')

class VisionBridgeClient {
  constructor() {
    this.session = null
  }

  async connect() {
    try {
      // Start the MCP Vision Bridge server
      const serverParams = new StdioServerParameters({
        command: 'node',
        args: ['../dist/server/mcp-server.js']
      })

      const transport = new StdioTransport(serverParams)
      this.session = new ClientSession(transport)
      
      await this.session.initialize()
      console.log('✅ Connected to MCP Vision Bridge')
      
      return true
    } catch (error) {
      console.error('❌ Failed to connect:', error.message)
      return false
    }
  }

  async analyzeImage(imageUrl, prompt) {
    if (!this.session) {
      throw new Error('Not connected to server')
    }

    try {
      console.log('🔍 Analyzing image...')
      
      const result = await this.session.callTool({
        name: 'analyze_image',
        arguments: {
          image_url: imageUrl,
          prompt: prompt,
          detail_level: 'high'
        }
      })

      console.log('📝 Analysis result:')
      console.log(result.content[0].text)
      
      if (result.metadata) {
        console.log('📊 Metadata:', {
          model: result.metadata.model_used,
          confidence: result.metadata.confidence_score,
          processingTime: `${result.metadata.processing_time_ms}ms`
        })
      }
      
      return result
    } catch (error) {
      console.error('❌ Analysis failed:', error.message)
      throw error
    }
  }

  async describeImage(imageUrl) {
    if (!this.session) {
      throw new Error('Not connected to server')
    }

    try {
      console.log('🖼️ Describing image...')
      
      const result = await this.session.callTool({
        name: 'describe_image',
        arguments: {
          image_url: imageUrl,
          detail_level: 'medium',
          include_objects: true,
          include_colors: true
        }
      })

      console.log('📝 Description:')
      console.log(result.content[0].text)
      
      if (result.metadata) {
        console.log('🔍 Detected objects:', result.metadata.detected_objects)
        console.log('🎨 Dominant colors:', result.metadata.dominant_colors)
      }
      
      return result
    } catch (error) {
      console.error('❌ Description failed:', error.message)
      throw error
    }
  }

  async extractText(imageUrl, language = 'en') {
    if (!this.session) {
      throw new Error('Not connected to server')
    }

    try {
      console.log('📄 Extracting text...')
      
      const result = await this.session.callTool({
        name: 'extract_text_from_image',
        arguments: {
          image_url: imageUrl,
          language: language,
          preserve_formatting: true,
          include_confidence: true
        }
      })

      console.log('📝 Extracted text:')
      console.log(result.content[0].text)
      
      if (result.metadata && result.metadata.extracted_text_blocks) {
        console.log('📊 Text blocks:', result.metadata.extracted_text_blocks.length)
        console.log('🎯 Overall confidence:', result.metadata.total_confidence)
      }
      
      return result
    } catch (error) {
      console.error('❌ Text extraction failed:', error.message)
      throw error
    }
  }

  async disconnect() {
    if (this.session) {
      await this.session.close()
      this.session = null
      console.log('👋 Disconnected from MCP Vision Bridge')
    }
  }
}

// Example usage
async function main() {
  const client = new VisionBridgeClient()
  
  try {
    // Connect to the vision bridge
    const connected = await client.connect()
    if (!connected) {
      process.exit(1)
    }

    // Example image URLs (replace with your own)
    const testImageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg'
    
    // Example 1: Analyze image with custom prompt
    console.log('\n' + '='.repeat(50))
    console.log('EXAMPLE 1: Custom Image Analysis')
    console.log('='.repeat(50))
    
    await client.analyzeImage(
      testImageUrl,
      'Describe this landscape image in detail, focusing on the natural elements and overall mood'
    )

    // Example 2: Get general description
    console.log('\n' + '='.repeat(50))
    console.log('EXAMPLE 2: General Image Description')
    console.log('='.repeat(50))
    
    await client.describeImage(testImageUrl)

    // Example 3: Extract text (if image contains text)
    console.log('\n' + '='.repeat(50))
    console.log('EXAMPLE 3: Text Extraction')
    console.log('='.repeat(50))
    
    // Note: This example image may not contain readable text
    // Replace with an image that has text for better demonstration
    const textImageUrl = 'https://via.placeholder.com/400x100/000000/FFFFFF?text=SAMPLE+TEXT+IMAGE'
    
    try {
      await client.extractText(textImageUrl, 'en')
    } catch (error) {
      console.log('ℹ️ Text extraction test completed (image may not contain text)')
    }

    console.log('\n✅ All examples completed successfully!')
    
  } catch (error) {
    console.error('💥 Example failed:', error.message)
    process.exit(1)
  } finally {
    await client.disconnect()
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, cleaning up...')
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, cleaning up...')
  process.exit(0)
})

// Run the example
if (require.main === module) {
  main().catch(console.error)
}

module.exports = { VisionBridgeClient }
