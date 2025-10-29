#!/usr/bin/env node

/**
 * OpenRouter Integration Example
 * This demonstrates direct integration with OpenRouter API
 * for testing and development purposes
 */

import axios, { AxiosInstance } from 'axios'

interface OpenRouterConfig {
  apiKey: string
  baseURL?: string
  timeout?: number
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | Array<{
    type: 'text' | 'image_url'
    text?: string
    image_url?: {
      url: string
    }
  }>
}

interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  max_tokens?: number
  temperature?: number
  stream?: boolean
}

interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: ChatMessage
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

class OpenRouterClient {
  private client: AxiosInstance
  private config: OpenRouterConfig

  constructor(config: OpenRouterConfig) {
    this.config = {
      baseURL: 'https://openrouter.ai/api/v1',
      timeout: 30000,
      ...config
    }

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mcp-vision-bridge.example.com',
        'X-Title': 'MCP Vision Bridge'
      }
    })
  }

  // List available models
  async listModels() {
    try {
      const response = await this.client.get('/models')
      return response.data
    } catch (error) {
      console.error('Failed to list models:', error.message)
      throw error
    }
  }

  // Get model information
  async getModelInfo(modelId: string) {
    try {
      const response = await this.client.get(`/models/${modelId}`)
      return response.data
    } catch (error) {
      console.error(`Failed to get model info for ${modelId}:`, error.message)
      throw error
    }
  }

  // Create chat completion
  async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    try {
      const response = await this.client.post('/chat/completions', request)
      return response.data
    } catch (error) {
      console.error('Failed to create chat completion:', error.message)
      throw error
    }
  }

  // Stream chat completion
  async *streamChatCompletion(request: ChatCompletionRequest) {
    try {
      const response = await this.client.post('/chat/completions', {
        ...request,
        stream: true
      }, {
        responseType: 'stream'
      })

      const stream = response.data

      for await (const chunk of stream) {
        const lines = chunk.toString().split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            
            if (data === '[DONE]') {
              return
            }
            
            try {
              const parsed = JSON.parse(data)
              yield parsed
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to stream chat completion:', error.message)
      throw error
    }
  }

  // Test vision capabilities
  async testVisionCapabilities() {
    console.log('🧪 Testing OpenRouter Vision Capabilities')
    console.log('='.repeat(50))

    // Test image URL
    const testImageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg'

    // Test different vision models
    const visionModels = [
      'x-ai/grok-beta-vision',
      'google/gemini-2.0-flash-001',
      'anthropic/claude-3-5-sonnet-20241022'
    ]

    for (const model of visionModels) {
      console.log(`\n🔍 Testing model: ${model}`)
      
      try {
        const request: ChatCompletionRequest = {
          model: model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Describe this image in detail, focusing on the natural elements and overall mood.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: testImageUrl
                  }
                }
              ]
            }
          ],
          max_tokens: 500,
          temperature: 0.7
        }

        const response = await this.createChatCompletion(request)
        
        console.log(`✅ Success! Response: ${response.choices[0].message.content}`)
        
        if (response.usage) {
          console.log(`📊 Usage: ${response.usage.total_tokens} tokens`)
        }
        
      } catch (error) {
        console.error(`❌ Failed: ${error.message}`)
      }
    }
  }

  // Test base64 image support
  async testBase64Image() {
    console.log('\n🖼️ Testing Base64 Image Support')
    console.log('='.repeat(50))

    // Create a simple base64 image (1x1 red pixel)
    const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

    try {
      const request: ChatCompletionRequest = {
        model: 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'What color is this image?'
              },
              {
                type: 'image_url',
                image_url: {
                  url: base64Image
                }
              }
            ]
          }
        ]
      }

      const response = await this.createChatCompletion(request)
      console.log(`✅ Base64 test successful: ${response.choices[0].message.content}`)
      
    } catch (error) {
      console.error(`❌ Base64 test failed: ${error.message}`)
    }
  }

  // Test error handling
  async testErrorHandling() {
    console.log('\n🚨 Testing Error Handling')
    console.log('='.repeat(50))

    // Test with invalid model
    try {
      const request: ChatCompletionRequest = {
        model: 'invalid/model',
        messages: [
          {
            role: 'user',
            content: 'Hello'
          }
        ]
      }

      await this.createChatCompletion(request)
      console.log('❌ Should have failed with invalid model')
      
    } catch (error) {
      console.log(`✅ Correctly handled invalid model: ${error.message}`)
    }

    // Test with invalid API key
    try {
      const invalidClient = new OpenRouterClient({
        apiKey: 'invalid-key'
      })

      await invalidClient.createChatCompletion({
        model: 'google/gemini-2.0-flash-001',
        messages: [{ role: 'user', content: 'Hello' }]
      })
      
      console.log('❌ Should have failed with invalid API key')
      
    } catch (error) {
      console.log(`✅ Correctly handled invalid API key: ${error.message}`)
    }
  }

  // Performance test
  async performanceTest() {
    console.log('\n⚡ Performance Test')
    console.log('='.repeat(50))

    const testImageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg'
    const numRequests = 3

    const startTime = Date.now()

    for (let i = 1; i <= numRequests; i++) {
      console.log(`Request ${i}/${numRequests}...`)
      
      const start = Date.now()
      
      try {
        const response = await this.createChatCompletion({
          model: 'google/gemini-2.0-flash-001',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Briefly describe this image (request ${i}).`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: testImageUrl
                  }
                }
              ]
            }
          ],
          max_tokens: 100
        })
        
        const duration = Date.now() - start
        console.log(`✅ Request ${i} completed in ${duration}ms`)
        
      } catch (error) {
        console.error(`❌ Request ${i} failed: ${error.message}`)
      }
    }

    const totalDuration = Date.now() - startTime
    console.log(`\n📊 Total time: ${totalDuration}ms`)
    console.log(`📊 Average time: ${Math.round(totalDuration / numRequests)}ms`)
  }

  // Interactive chat
  async interactiveChat() {
    console.log('\n💬 Interactive Chat Mode')
    console.log('='.repeat(50))
    console.log('Type your messages (or "quit" to exit)')
    console.log('Use "image:" prefix to send images')
    console.log('Example: "image: https://example.com/image.jpg Describe this"')
    console.log('')

    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    })

    const messages: ChatMessage[] = []

    const askQuestion = () => {
      readline.question('You: ', async (input) => {
        if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'exit') {
          readline.close()
          return
        }

        try {
          let message: ChatMessage

          if (input.startsWith('image:')) {
            // Handle image input
            const parts = input.substring(6).trim().split(' ')
            const imageUrl = parts[0]
            const prompt = parts.slice(1).join(' ') || 'Describe this image'

            message = {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageUrl
                  }
                }
              ]
            }
          } else {
            // Handle text input
            message = {
              role: 'user',
              content: input
            }
          }

          messages.push(message)

          const response = await this.createChatCompletion({
            model: 'google/gemini-2.0-flash-001',
            messages: messages,
            max_tokens: 500
          })

          const assistantMessage = response.choices[0].message
          messages.push(assistantMessage)

          console.log(`Assistant: ${assistantMessage.content}`)
          console.log('')

        } catch (error) {
          console.error('Error:', error.message)
          console.log('')
        }

        askQuestion()
      })
    }

    askQuestion()
  }
}

// Main execution
async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY

  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY environment variable is required')
    console.log('💡 Set it with: export OPENROUTER_API_KEY=your-api-key')
    process.exit(1)
  }

  const client = new OpenRouterClient({ apiKey })

  const args = process.argv.slice(2)
  const command = args[0] || 'test'

  try {
    switch (command) {
      case 'models':
        console.log('📋 Available Models:')
        const models = await client.listModels()
        console.log(JSON.stringify(models, null, 2))
        break

      case 'test':
        await client.testVisionCapabilities()
        await client.testBase64Image()
        await client.testErrorHandling()
        break

      case 'performance':
        await client.performanceTest()
        break

      case 'chat':
        await client.interactiveChat()
        break

      case 'model':
        const modelId = args[1]
        if (!modelId) {
          console.error('Usage: npm run openrouter:example -- model <model-id>')
          process.exit(1)
        }
        const modelInfo = await client.getModelInfo(modelId)
        console.log('Model Info:', JSON.stringify(modelInfo, null, 2))
        break

      default:
        console.log('Usage: npm run openrouter:example -- <command>')
        console.log('Commands:')
        console.log('  models     - List available models')
        console.log('  test       - Run all tests (default)')
        console.log('  performance - Run performance test')
        console.log('  chat       - Start interactive chat')
        console.log('  model <id> - Get model information')
        break
    }
  } catch (error) {
    console.error('💥 Error:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

export { OpenRouterClient }
