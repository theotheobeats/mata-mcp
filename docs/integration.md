# Integration Guide

This guide provides detailed instructions for integrating the MCP Vision Bridge with various clients and platforms, with a focus on OpenCode compatibility.

## OpenCode Integration

### Overview

OpenCode is an AI coding agent built for the terminal that supports MCP servers. The MCP Vision Bridge integrates seamlessly with OpenCode, enabling vision capabilities through non-vision LLMs.

### Setup Process

#### 1. Install OpenCode

```bash
# Install OpenCode
curl -fsSL https://opencode.ai/install | bash

# Verify installation
opencode --version
```

#### 2. Configure MCP Vision Bridge

Add the vision bridge to your OpenCode configuration:

```bash
# Create OpenCode config directory
mkdir -p ~/.config/opencode

# Create or edit config file
nano ~/.config/opencode/config.json
```

#### 3. Configuration Options

**Option A: Direct Node.js Execution**

```json
{
  "mcpServers": {
    "vision-bridge": {
      "command": "node",
      "args": ["/absolute/path/to/vision-mcp/dist/server/mcp-server.js"],
      "env": {
        "OPENROUTER_API_KEY": "sk-or-v1-your-api-key-here",
        "VISION_MODEL_PRIMARY": "x-ai/grok-beta-vision",
        "VISION_MODEL_FALLBACK": "google/gemini-2.0-flash-001",
        "LOG_LEVEL": "info",
        "MAX_IMAGE_SIZE": "10485760"
      }
    }
  }
}
```

**Option B: Docker Execution**

```json
{
  "mcpServers": {
    "vision-bridge": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e", "OPENROUTER_API_KEY=sk-or-v1-your-api-key-here",
        "-e", "VISION_MODEL_PRIMARY=x-ai/grok-beta-vision",
        "-v", "/tmp/vision-bridge:/tmp/vision-bridge",
        "mcp-vision-bridge:latest"
      ]
    }
  }
}
```

**Option C: NPM Script**

```json
{
  "mcpServers": {
    "vision-bridge": {
      "command": "npm",
      "args": ["run", "start:mcp"],
      "cwd": "/absolute/path/to/vision-mcp",
      "env": {
        "OPENROUTER_API_KEY": "sk-or-v1-your-api-key-here"
      }
    }
  }
}
```

#### 4. Testing the Integration

```bash
# Start OpenCode
opencode

# In OpenCode, test the connection
# /tools list

# Test vision capabilities
# /analyze_image https://example.com/image.jpg "What do you see?"
```

### OpenCode Usage Examples

#### Basic Image Analysis

```
User: Can you analyze this screenshot for me?
User: [attaches screenshot]

OpenCode: I'll analyze this screenshot using the vision bridge.
OpenCode: [Calls analyze_image tool]
OpenCode: This screenshot shows a modern web application interface with several key elements:
OpenCode: - A dark-themed dashboard with navigation sidebar
OpenCode: - Main content area displaying data visualizations
OpenCode: - User profile section in the top right
OpenCode: - Multiple charts and graphs showing performance metrics
```

#### Code Review with Vision

```
User: Can you review this code architecture diagram?
User: [attaches architecture diagram]

OpenCode: I'll analyze this architecture diagram to understand the system design.
OpenCode: [Calls describe_image tool with detail_level: "high"]
OpenCode: Based on the architecture diagram, I can see this is a microservices-based system with:
OpenCode: 
OpenCode: **Frontend Layer:**
OpenCode: - React-based web client
OpenCode: - Mobile app (iOS/Android)
OpenCode: 
OpenCode: **API Gateway:**
OpenCode: - Kong API Gateway for routing
OpenCode: - Authentication and rate limiting
OpenCode: 
OpenCode: **Core Services:**
OpenCode: - User Service (authentication, profiles)
OpenCode: - Order Service (order processing)
OpenCode: - Payment Service (transaction handling)
OpenCode: 
OpenCode: **Data Layer:**
OpenCode: - PostgreSQL for relational data
OpenCode: - Redis for caching
OpenCode: - MongoDB for document storage
```

#### Document Processing

```
User: Can you extract the text from this invoice?
User: [attaches invoice image]

OpenCode: I'll extract the text from this invoice for you.
OpenCode: [Calls extract_text_from_image tool]
OpenCode: Here's the extracted text from the invoice:
OpenCode: 
OpenCode: ```
OpenCode: ACME Corporation
OpenCode: 123 Business St, Suite 100
OpenCode: Tech City, TC 12345
OpenCode: 
OpenCode: INVOICE #2024-001
OpenCode: Date: January 15, 2024
OpenCode: 
OpenCode: Bill To:
OpenCode: John Doe
OpenCode: 456 Client Ave
OpenCode: Client City, CC 67890
OpenCode: 
OpenCode: Description                    Quantity    Rate      Amount
OpenCode: Web Development Services       40          $150      $6,000
OpenCode: UI/UX Design                   20          $125      $2,500
OpenCode: 
OpenCode: Subtotal: $8,500
OpenCode: Tax (8.5%): $722.50
OpenCode: Total: $9,222.50
OpenCode: ```
```

## MCP Client Integration

### JavaScript/TypeScript Client

#### Basic Setup

```typescript
import { ClientSession, StdioServerParameters } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

class VisionMCPClient {
  private session: ClientSession | null = null

  async connect(serverCommand: string, serverArgs: string[]) {
    const serverParams = new StdioServerParameters({
      command: serverCommand,
      args: serverArgs
    })

    const transport = new StdioTransport(serverParams)
    this.session = new ClientSession(transport)
    
    await this.session.initialize()
    return this.session
  }

  async analyzeImage(imageUrl: string, prompt: string) {
    if (!this.session) {
      throw new Error('Client not connected')
    }

    const result = await this.session.callTool({
      name: 'analyze_image',
      arguments: {
        image_url: imageUrl,
        prompt: prompt,
        detail_level: 'high'
      }
    })

    return result.content[0].text
  }

  async describeImage(imageUrl: string) {
    if (!this.session) {
      throw new Error('Client not connected')
    }

    const result = await this.session.callTool({
      name: 'describe_image',
      arguments: {
        image_url: imageUrl,
        detail_level: 'medium'
      }
    })

    return {
      description: result.content[0].text,
      metadata: result.metadata
    }
  }

  async extractText(imageUrl: string, language = 'en') {
    if (!this.session) {
      throw new Error('Client not connected')
    }

    const result = await this.session.callTool({
      name: 'extract_text_from_image',
      arguments: {
        image_url: imageUrl,
        language: language,
        preserve_formatting: true
      }
    })

    return {
      text: result.content[0].text,
      blocks: result.metadata?.extracted_text_blocks || []
    }
  }

  async disconnect() {
    if (this.session) {
      await this.session.close()
      this.session = null
    }
  }
}

// Usage example
async function main() {
  const client = new VisionMCPClient()
  
  try {
    await client.connect('node', ['dist/server/mcp-server.js'])
    
    const analysis = await client.analyzeImage(
      'https://example.com/diagram.png',
      'Explain this system architecture diagram'
    )
    
    console.log('Analysis:', analysis)
    
  } finally {
    await client.disconnect()
  }
}
```

#### Advanced Client with Error Handling

```typescript
import { EventEmitter } from 'events'

class RobustVisionMCPClient extends EventEmitter {
  private session: ClientSession | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private reconnectDelay = 1000

  async connectWithRetry(serverCommand: string, serverArgs: string[]) {
    while (this.reconnectAttempts < this.maxReconnectAttempts) {
      try {
        await this.connect(serverCommand, serverArgs)
        this.reconnectAttempts = 0
        this.emit('connected')
        return
      } catch (error) {
        this.reconnectAttempts++
        this.emit('connectionError', error)
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          throw new Error(`Failed to connect after ${this.maxReconnectAttempts} attempts`)
        }
        
        await this.delay(this.reconnectDelay * this.reconnectAttempts)
      }
    }
  }

  async analyzeImageWithRetry(imageUrl: string, prompt: string, maxRetries = 3) {
    let lastError: Error
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.analyzeImage(imageUrl, prompt)
      } catch (error) {
        lastError = error as Error
        
        if (attempt === maxRetries) {
          throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`)
        }
        
        // Check if error is retryable
        if (this.isRetryableError(error)) {
          await this.delay(1000 * attempt)
          continue
        } else {
          throw error
        }
      }
    }
    
    throw lastError!
  }

  private isRetryableError(error: any): boolean {
    const retryableCodes = ['RATE_LIMITED', 'MODEL_UNAVAILABLE', 'NETWORK_ERROR']
    return retryableCodes.includes(error.code) || error.message?.includes('timeout')
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
```

### Python Client

#### Basic Implementation

```python
import asyncio
import json
from typing import Optional, Dict, Any
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

class VisionMCPClient:
    def __init__(self):
        self.session: Optional[ClientSession] = None
    
    async def connect(self, command: str, args: list):
        """Connect to MCP server"""
        server_params = StdioServerParameters(
            command=command,
            args=args
        )
        
        stdio_transport = await stdio_client(server_params)
        self.stdio, self.write = stdio_transport
        self.session = ClientSession(self.stdio, self.write)
        
        await self.session.initialize()
    
    async def analyze_image(self, image_url: str, prompt: str) -> str:
        """Analyze image with custom prompt"""
        if not self.session:
            raise RuntimeError("Client not connected")
        
        result = await self.session.call_tool(
            name="analyze_image",
            arguments={
                "image_url": image_url,
                "prompt": prompt,
                "detail_level": "high"
            }
        )
        
        return result.content[0].text
    
    async def describe_image(self, image_url: str) -> Dict[str, Any]:
        """Get image description"""
        if not self.session:
            raise RuntimeError("Client not connected")
        
        result = await self.session.call_tool(
            name="describe_image",
            arguments={
                "image_url": image_url,
                "detail_level": "medium",
                "include_objects": True,
                "include_colors": True
            }
        )
        
        return {
            "description": result.content[0].text,
            "metadata": result.metadata
        }
    
    async def extract_text(self, image_url: str, language: str = "en") -> Dict[str, Any]:
        """Extract text from image"""
        if not self.session:
            raise RuntimeError("Client not connected")
        
        result = await self.session.call_tool(
            name="extract_text_from_image",
            arguments={
                "image_url": image_url,
                "language": language,
                "preserve_formatting": True,
                "include_confidence": True
            }
        )
        
        return {
            "text": result.content[0].text,
            "blocks": result.metadata.get("extracted_text_blocks", []),
            "confidence": result.metadata.get("total_confidence")
        }
    
    async def disconnect(self):
        """Disconnect from server"""
        if self.session:
            await self.session.close()
            self.session = None

# Usage example
async def main():
    client = VisionMCPClient()
    
    try:
        await client.connect("node", ["dist/server/mcp-server.js"])
        
        # Analyze image
        analysis = await client.analyze_image(
            "https://example.com/diagram.png",
            "Explain this system architecture"
        )
        print("Analysis:", analysis)
        
        # Extract text
        text_result = await client.extract_text("https://example.com/document.jpg")
        print("Extracted text:", text_result["text"])
        
    finally:
        await client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
```

### HTTP Client Integration

#### REST API Wrapper

```typescript
// For clients that prefer HTTP over stdio
class HTTPVisionMCPClient {
  private baseURL: string
  private apiKey: string

  constructor(baseURL: string, apiKey: string) {
    this.baseURL = baseURL
    this.apiKey = apiKey
  }

  async analyzeImage(imageUrl: string, prompt: string) {
    const response = await fetch(`${this.baseURL}/tools/analyze_image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        image_url: imageUrl,
        prompt: prompt
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    return result.content[0].text
  }

  async describeImage(imageUrl: string) {
    const response = await fetch(`${this.baseURL}/tools/describe_image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        image_url: imageUrl,
        detail_level: 'medium'
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  }
}
```

## Framework Integrations

### LangChain Integration

```typescript
import { LangChainTool } from '@langchain/core/tools'
import { VisionMCPClient } from './vision-mcp-client'

export class AnalyzeImageTool extends LangChainTool {
  name = "analyze_image"
  description = "Analyze an image using vision-capable models"

  constructor(private mcpClient: VisionMCPClient) {
    super()
  }

  async _call(input: string): Promise<string> {
    try {
      const { image_url, prompt } = JSON.parse(input)
      return await this.mcpClient.analyzeImage(image_url, prompt)
    } catch (error) {
      return `Error analyzing image: ${error.message}`
    }
  }
}

// Usage in LangChain
const visionTool = new AnalyzeImageTool(mcpClient)
const llm = new ChatOpenAI({ model: "gpt-4" })
const agent = createOpenAIFunctionsAgent({ llm, tools: [visionTool], prompt })
```

### Vercel AI SDK Integration

```typescript
import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { VisionMCPClient } from './vision-mcp-client'

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const mcpClient = new VisionMCPClient()

export async function POST(req: Request) {
  const { messages, imageUrl, prompt } = await req.json()

  // If image analysis is requested
  if (imageUrl && prompt) {
    const analysis = await mcpClient.analyzeImage(imageUrl, prompt)
    
    return Response.json({
      analysis,
      message: "Image analyzed successfully"
    })
  }

  // Regular chat completion
  const result = await streamText({
    model: openai('gpt-4'),
    messages,
  })

  return result.toAIStreamResponse()
}
```

### Next.js Integration

```typescript
// app/api/vision/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { VisionMCPClient } from '@/lib/vision-mcp-client'

const mcpClient = new VisionMCPClient()

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, prompt, action } = await request.json()

    let result
    switch (action) {
      case 'analyze':
        result = await mcpClient.analyzeImage(imageUrl, prompt)
        break
      case 'describe':
        result = await mcpClient.describeImage(imageUrl)
        break
      case 'extract-text':
        result = await mcpClient.extractText(imageUrl)
        break
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    return NextResponse.json({ result })
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
```

## Testing Integration

### Unit Tests

```typescript
// tests/integration/opencode.test.ts
import { VisionMCPClient } from '../../src/integrations/opencode/client'

describe('OpenCode Integration', () => {
  let client: VisionMCPClient

  beforeEach(() => {
    client = new VisionMCPClient()
  })

  afterEach(async () => {
    await client.disconnect()
  })

  it('should connect to MCP server', async () => {
    await client.connect('node', ['dist/server/mcp-server.js'])
    expect(client.isConnected()).toBe(true)
  })

  it('should analyze image', async () => {
    await client.connect('node', ['dist/server/mcp-server.js'])
    
    const result = await client.analyzeImage(
      'https://example.com/test.jpg',
      'What do you see?'
    )
    
    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('should handle errors gracefully', async () => {
    await client.connect('node', ['dist/server/mcp-server.js'])
    
    await expect(
      client.analyzeImage('invalid-url', 'test')
    ).rejects.toThrow()
  })
})
```

### Integration Tests

```typescript
// tests/e2e/opencode-workflow.test.ts
import { spawn } from 'child_process'

describe('OpenCode Vision Bridge E2E', () => {
  it('should work with OpenCode CLI', async () => {
    // This test would require OpenCode to be installed
    // and would test the full integration workflow
    
    const opencode = spawn('opencode', ['--version'])
    
    let output = ''
    opencode.stdout.on('data', (data) => {
      output += data.toString()
    })
    
    await new Promise((resolve) => {
      opencode.on('close', resolve)
    })
    
    expect(output).toContain('OpenCode')
  })
})
```

## Best Practices

### Error Handling

1. **Always implement retry logic** for network operations
2. **Handle rate limiting** gracefully with exponential backoff
3. **Provide meaningful error messages** to users
4. **Log errors appropriately** for debugging

### Performance

1. **Cache results** when appropriate
2. **Use connection pooling** for multiple requests
3. **Implement request timeouts** to prevent hanging
4. **Monitor memory usage** for large images

### Security

1. **Validate image URLs** before processing
2. **Implement rate limiting** to prevent abuse
3. **Sanitize user inputs** to prevent injection
4. **Use HTTPS** for all external communications

### User Experience

1. **Provide progress indicators** for long operations
2. **Show confidence scores** when available
3. **Offer multiple detail levels** for analysis
4. **Support streaming responses** for real-time feedback

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check if MCP server is running
   - Verify command and arguments are correct
   - Ensure proper permissions

2. **Authentication Errors**
   - Verify OpenRouter API key is valid
   - Check environment variables
   - Ensure API key has proper permissions

3. **Image Processing Errors**
   - Verify image URL is accessible
   - Check image format is supported
   - Ensure image size is within limits

4. **Rate Limiting**
   - Implement proper retry logic
   - Monitor API usage
   - Consider upgrading plan if needed

### Debug Mode

```typescript
// Enable debug logging
process.env.DEBUG = 'mcp:*'
process.env.LOG_LEVEL = 'debug'

// Test connection
const client = new VisionMCPClient()
await client.connect('node', ['dist/server/mcp-server.js'])
console.log('Connection successful!')
```

### Health Checks

```typescript
// Add health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test MCP connection
    await client.listTools()
    res.json({ status: 'healthy', timestamp: new Date().toISOString() })
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})
```
