# MCP Vision Bridge

A Model Context Protocol (MCP) server that enables non-vision LLMs to utilize vision capabilities through vision-capable models via OpenRouter.

## Overview

The MCP Vision Bridge acts as an intermediary MCP server that connects LLMs without image input support (like GLM-4.6) to multimodal models (like Grok) through OpenRouter's unified API. This enables any MCP-compatible client, including OpenCode, to perform vision tasks using non-vision LLMs.

## Architecture

```
Non-vision LLM → MCP Vision Bridge → OpenRouter → Vision Model → Response Transformer → Text Response
```

### Core Components

1. **MCP Vision Server** - Main server exposing vision tools via MCP protocol
2. **Model Router** - Intelligent routing between non-vision and vision models  
3. **Image Processor** - Handles image encoding, preprocessing, and format conversion
4. **Response Transformer** - Converts multimodal responses to text-only format
5. **OpenRouter Client** - Manages communication with OpenRouter API
6. **OpenCode Integration Layer** - Ensures compatibility with OpenCode's MCP client

## Features

- **MCP Protocol Compliant** - Standard MCP server implementation
- **OpenRouter Integration** - Access to 75+ AI models through unified API
- **OpenCode Compatible** - Direct integration with OpenCode's MCP client
- **Privacy-First** - No persistent storage, temporary file cleanup
- **Multi-Model Support** - Primary and fallback vision models
- **Rate Limiting** - Built-in request throttling and error handling
- **Streaming Support** - Real-time response streaming capability

## Quick Start

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd vision-mcp

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your OpenRouter API key
```

### Basic Usage

```typescript
import { MCPVisionBridge } from './src/server/mcp-server'

const bridge = new MCPVisionBridge({
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY!,
    models: {
      primary: 'x-ai/grok-beta-vision',
      fallback: 'google/gemini-2.0-flash-001'
    }
  }
})

await bridge.start()
```

### OpenCode Integration

Add to your OpenCode configuration:

```json
{
  "mcpServers": {
    "vision-bridge": {
      "command": "node",
      "args": ["dist/server/mcp-server.js"],
      "env": {
        "OPENROUTER_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Available Tools

### `analyze_image`
Analyze an image using vision-capable models.

**Parameters:**
- `image_url` (string): URL or base64-encoded image data
- `prompt` (string): Analysis prompt
- `model` (string, optional): Vision model to use
- `max_tokens` (number, optional): Response length limit

### `describe_image`
Get detailed description of image content.

**Parameters:**
- `image_url` (string): URL or base64-encoded image data
- `detail_level` (string, optional): "low" or "high"

### `extract_text_from_image`
Extract text content from images (OCR).

**Parameters:**
- `image_url` (string): URL or base64-encoded image data
- `language` (string, optional): OCR language hint

## Documentation

- [Architecture Overview](docs/architecture.md)
- [API Reference](docs/api.md)
- [Deployment Guide](docs/deployment.md)
- [Integration Guide](docs/integration.md)
- [Configuration](docs/configuration.md)

## Supported Models

### Primary Vision Models
- `x-ai/grok-beta-vision` - Grok vision capabilities
- `google/gemini-2.0-flash-001` - Google's latest vision model
- `anthropic/claude-3-5-sonnet-20241022` - Anthropic's vision model

### Fallback Models
- Automatic failover to secondary models
- Rate limiting and error handling
- Cost optimization through model routing

## Security & Privacy

- **No Persistent Storage** - Images are processed in memory and cleaned up
- **API Key Protection** - Environment variable storage only
- **Input Validation** - Image format and size validation
- **Rate Limiting** - Built-in request throttling
- **Audit Logging** - Request tracking for compliance

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Support

- GitHub Issues: Report bugs and feature requests
- Documentation: Check the docs/ folder for detailed guides
- Examples: See examples/ folder for usage samples
# mata-mcp
