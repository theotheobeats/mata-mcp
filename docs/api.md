# API Reference

The MCP Vision Bridge exposes a set of vision-related tools through the Model Context Protocol (MCP). This document describes the available tools, their parameters, and response formats.

## MCP Tools

### `analyze_image`

Analyze an image using vision-capable models through OpenRouter.

**Description:** Send an image to a vision-capable model with a custom prompt to get detailed analysis and insights.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image_url` | string | Yes | URL or base64-encoded image data. Can be a public URL or data URL (e.g., `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...`) |
| `prompt` | string | Yes | Text prompt describing what to analyze in the image |
| `model` | string | No | Vision model to use. Defaults to primary model configured in server |
| `max_tokens` | number | No | Maximum tokens in response. Defaults to 1000 |
| `temperature` | number | No | Sampling temperature (0-2). Defaults to 0.7 |
| `detail_level` | string | No | Level of detail: "low", "medium", "high". Defaults to "medium" |

**Example Request:**
```json
{
  "tool": "analyze_image",
  "arguments": {
    "image_url": "https://example.com/image.jpg",
    "prompt": "Describe this image in detail, focusing on the main objects and their relationships",
    "model": "x-ai/grok-beta-vision",
    "max_tokens": 1500,
    "detail_level": "high"
  }
}
```

**Response Format:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "This image shows a modern office space with several key elements..."
    }
  ],
  "metadata": {
    "model_used": "x-ai/grok-beta-vision",
    "confidence_score": 0.92,
    "processing_time_ms": 1250,
    "tokens_used": 847
  }
}
```

### `describe_image`

Get a detailed description of image content with automatic analysis.

**Description:** Automatically analyze and describe the contents of an image without requiring a custom prompt.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image_url` | string | Yes | URL or base64-encoded image data |
| `detail_level` | string | No | Level of detail: "low" (brief overview), "medium" (standard description), "high" (comprehensive analysis). Defaults to "medium" |
| `include_objects` | boolean | No | Whether to include detected objects list. Defaults to true |
| `include_colors` | boolean | No | Whether to include color analysis. Defaults to true |
| `include_text` | boolean | No | Whether to extract any visible text. Defaults to true |

**Example Request:**
```json
{
  "tool": "describe_image",
  "arguments": {
    "image_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "detail_level": "high",
    "include_objects": true,
    "include_colors": true,
    "include_text": true
  }
}
```

**Response Format:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "This is a high-quality photograph of a bustling city street scene taken during golden hour..."
    }
  ],
  "metadata": {
    "model_used": "google/gemini-2.0-flash-001",
    "detected_objects": ["person", "car", "traffic light", "building", "tree"],
    "dominant_colors": ["#FF6B35", "#004E89", "#1A659E"],
    "extracted_text": ["STOP", "MAIN ST", "CAFE"],
    "confidence_score": 0.89,
    "processing_time_ms": 980
  }
}
```

### `extract_text_from_image`

Extract text content from images using OCR capabilities.

**Description:** Perform optical character recognition (OCR) on images to extract readable text content.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image_url` | string | Yes | URL or base64-encoded image data |
| `language` | string | No | Language hint for OCR (e.g., "en", "es", "fr", "zh"). Defaults to "en" |
| `preserve_formatting` | boolean | No | Whether to preserve text formatting and layout. Defaults to false |
| `include_confidence` | boolean | No | Whether to include confidence scores for each text block. Defaults to true |

**Example Request:**
```json
{
  "tool": "extract_text_from_image",
  "arguments": {
    "image_url": "https://example.com/document.jpg",
    "language": "en",
    "preserve_formatting": true,
    "include_confidence": true
  }
}
```

**Response Format:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "ACME Corporation\\nQuarterly Report Q4 2023\\n\\nRevenue: $2,450,000\\nExpenses: $1,890,000\\nNet Income: $560,000"
    }
  ],
  "metadata": {
    "model_used": "anthropic/claude-3-5-sonnet-20241022",
    "extracted_text_blocks": [
      {
        "text": "ACME Corporation",
        "confidence": 0.98,
        "bbox": {"x": 100, "y": 50, "width": 200, "height": 30}
      },
      {
        "text": "Quarterly Report Q4 2023",
        "confidence": 0.95,
        "bbox": {"x": 80, "y": 90, "width": 240, "height": 25}
      }
    ],
    "total_confidence": 0.96,
    "processing_time_ms": 750,
    "language_detected": "en"
  }
}
```

## Error Handling

### Error Response Format

All tools return errors in a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional error context"
    }
  }
}
```

### Common Error Codes

| Error Code | Description | HTTP Status |
|------------|-------------|-------------|
| `INVALID_IMAGE_URL` | Image URL is malformed or inaccessible | 400 |
| `UNSUPPORTED_FORMAT` | Image format not supported | 400 |
| `IMAGE_TOO_LARGE` | Image exceeds size limit | 413 |
| `RATE_LIMITED` | Rate limit exceeded | 429 |
| `MODEL_UNAVAILABLE` | Requested model is temporarily unavailable | 503 |
| `PROCESSING_ERROR` | Image processing failed | 500 |
| `AUTHENTICATION_ERROR` | Invalid or missing API key | 401 |

### Error Examples

**Invalid Image URL:**
```json
{
  "error": {
    "code": "INVALID_IMAGE_URL",
    "message": "The provided image URL is invalid or the image cannot be accessed",
    "details": {
      "url": "invalid-url-format",
      "reason": "URL must be a valid HTTP(S) URL or data URL"
    }
  }
}
```

**Rate Limited:**
```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Please try again later",
    "details": {
      "retry_after": 60,
      "limit": 100,
      "window": "1 minute"
    }
  }
}
```

## Rate Limiting

The API implements rate limiting to ensure fair usage and system stability.

### Rate Limit Headers

Rate limit information is included in response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
X-RateLimit-Window: 60
```

### Rate Limit Tiers

| Tier | Requests per Minute | Concurrent Requests |
|------|-------------------|-------------------|
| Free | 10 | 1 |
| Standard | 100 | 5 |
| Premium | 500 | 20 |
| Enterprise | 2000 | 100 |

## Streaming Responses

For long-running vision tasks, streaming responses are supported:

### Streaming Request

```json
{
  "tool": "analyze_image",
  "arguments": {
    "image_url": "https://example.com/large-image.jpg",
    "prompt": "Provide a comprehensive analysis of this complex diagram",
    "stream": true
  }
}
```

### Streaming Response Format

```
data: {"delta": "Initial analysis starting..."}
data: {"delta": "I can see this is a technical diagram showing..."}
data: {"delta": "The main components include:"}
data: {"delta": "1. Input processing unit"}
data: {"delta": "2. Data transformation layer"}
data: {"delta": "3. Output generation module"}
data: {"done": true}
```

## Model-Specific Features

### Grok Vision (`x-ai/grok-beta-vision`)

- **Strengths:** Real-time analysis, current events context
- **Max Image Size:** 8MB
- **Supported Formats:** JPEG, PNG, WebP
- **Special Features:** Can analyze recent images with current context

### Gemini Vision (`google/gemini-2.0-flash-001`)

- **Strengths:** High accuracy, detailed analysis
- **Max Image Size:** 20MB
- **Supported Formats:** JPEG, PNG, WebP, GIF
- **Special Features:** Excellent OCR, multi-language support

### Claude Vision (`anthropic/claude-3-5-sonnet-20241022`)

- **Strengths:** Reasoning, complex analysis
- **Max Image Size:** 5MB
- **Supported Formats:** JPEG, PNG
- **Special Features:** Strong analytical reasoning, safety-focused

## Best Practices

### Image Optimization

1. **Format Selection:**
   - Use JPEG for photographs
   - Use PNG for graphics with transparency
   - Avoid GIF for static images (use JPEG instead)

2. **Size Optimization:**
   - Resize images to reasonable dimensions (max 2048x2048)
   - Compress images while maintaining quality
   - Consider using WebP for better compression

3. **Quality Settings:**
   - JPEG quality: 80-85% for good balance
   - PNG: Use compression level 6-9
   - WebP: Quality 80-85%

### Prompt Engineering

1. **Be Specific:** Clear, detailed prompts yield better results
2. **Context Matters:** Provide relevant background information
3. **Structured Requests:** Use bullet points for complex analyses
4. **Iterative Refinement:** Start broad, then ask follow-up questions

### Error Handling

1. **Retry Logic:** Implement exponential backoff for transient errors
2. **Fallback Models:** Have backup models configured
3. **Graceful Degradation:** Handle partial failures gracefully
4. **User Feedback:** Provide meaningful error messages to users

## SDK Examples

### JavaScript/TypeScript

```typescript
import { MCPClient } from '@modelcontextprotocol/sdk/client/index.js'

const client = new MCPClient({
  name: "vision-client",
  version: "1.0.0"
})

await client.connect({
  transport: new StdioTransport({
    command: "node",
    args: ["dist/server/mcp-server.js"]
  })
})

// Analyze image
const result = await client.callTool({
  name: "analyze_image",
  arguments: {
    image_url: "https://example.com/image.jpg",
    prompt: "Describe this image in detail"
  }
})

console.log(result.content[0].text)
```

### Python

```python
import asyncio
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def analyze_image(image_url: str, prompt: str):
    server_params = StdioServerParameters(
        command="node",
        args=["dist/server/mcp-server.js"]
    )
    
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            result = await session.call_tool(
                name="analyze_image",
                arguments={
                    "image_url": image_url,
                    "prompt": prompt
                }
            )
            
            return result.content[0].text

# Usage
description = await analyze_image(
    "https://example.com/image.jpg",
    "What objects can you see in this image?"
)
print(description)
```
