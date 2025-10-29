# Architecture Overview

The MCP Vision Bridge is designed as a modular, scalable system that enables non-vision LLMs to access vision capabilities through vision-capable models via OpenRouter.

## System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Non-vision    │    │   MCP Vision     │    │   OpenRouter    │
│       LLM       │◄──►│     Bridge       │◄──►│      API        │
│   (GLM-4.6,     │    │                  │    │                 │
│    etc.)        │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Vision Models  │
                       │  (Grok, Gemini,  │
                       │   Claude, etc.)  │
                       └──────────────────┘
```

## Core Components

### 1. MCP Vision Server (`src/server/mcp-server.ts`)

The main MCP server that:
- Implements the MCP protocol specification
- Exposes vision-related tools to MCP clients
- Handles client connections and request routing
- Manages session state and tool execution

**Key Responsibilities:**
- Protocol compliance and message handling
- Tool definition and registration
- Request validation and processing
- Response formatting and delivery

### 2. Model Router (`src/core/model-router.ts`)

Intelligent routing system that:
- Selects appropriate vision models based on request type
- Handles model fallbacks and error recovery
- Manages rate limiting and cost optimization
- Provides model-specific parameter handling

**Routing Logic:**
```typescript
interface RoutingStrategy {
  selectModel(request: VisionRequest): ModelSelection
  handleFallback(error: Error, originalRequest: VisionRequest): ModelSelection
  optimizeForCost(models: Model[]): ModelSelection
  handleRateLimit(retryAfter: number): Promise<void>
}
```

### 3. Image Processor (`src/core/image-processor.ts`)

Handles all image-related processing:
- Image format validation and conversion
- Base64 encoding and URL handling
- Image optimization and compression
- Temporary file management

**Supported Formats:**
- JPEG/JPG
- PNG
- WebP
- GIF

**Processing Pipeline:**
```
Input Image → Validation → Format Conversion → Encoding → OpenRouter Format
```

### 4. Response Transformer (`src/core/response-transformer.ts`)

Converts multimodal responses to text-only format:
- Extracts text content from vision model responses
- Preserves metadata and confidence scores
- Handles streaming responses
- Formats output for non-vision LLMs

**Transformation Logic:**
```typescript
interface ResponseTransformer {
  transformVisionResponse(response: VisionResponse): TextResponse
  extractMetadata(response: VisionResponse): ResponseMetadata
  handleStreaming(stream: AsyncIterable<VisionResponse>): AsyncIterable<TextResponse>
}
```

### 5. OpenRouter Client (`src/integrations/openrouter/client.ts`)

Manages communication with OpenRouter API:
- Authentication and request formatting
- Response parsing and error handling
- Rate limiting and retry logic
- Model-specific parameter handling

**API Integration:**
```typescript
interface OpenRouterClient {
  createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>
  streamChatCompletion(request: ChatCompletionRequest): AsyncIterable<ChatCompletionResponse>
  listModels(): Promise<Model[]>
  getModelInfo(modelId: string): Promise<ModelInfo>
}
```

### 6. OpenCode Integration Layer (`src/integrations/opencode/compatibility.ts`)

Ensures seamless integration with OpenCode:
- MCP client compatibility layer
- Configuration management
- Session handling
- Privacy compliance

## Data Flow

### Request Processing Flow

1. **Input Reception**
   ```
   Non-vision LLM → MCP Client → MCP Vision Bridge
   ```

2. **Request Validation**
   - Image format and size validation
   - Parameter validation
   - Rate limit checking

3. **Image Processing**
   - Format conversion if needed
   - Base64 encoding
   - Optimization for model requirements

4. **Model Routing**
   - Select appropriate vision model
   - Apply routing strategy
   - Handle fallbacks if needed

5. **OpenRouter API Call**
   - Format request for OpenRouter
   - Send to vision model
   - Handle streaming if requested

6. **Response Transformation**
   - Extract text from vision response
   - Transform to MCP-compatible format
   - Add metadata and confidence scores

7. **Response Delivery**
   ```
   MCP Vision Bridge → MCP Client → Non-vision LLM
   ```

### Error Handling Flow

```
Request Error → Error Classification → Recovery Strategy → Fallback Model → Retry Logic
```

**Error Types:**
- Network errors (retry with exponential backoff)
- Rate limit errors (queue and retry after delay)
- Model errors (fallback to alternative model)
- Validation errors (return user-friendly error)

## Security Architecture

### Privacy Protection

1. **No Persistent Storage**
   - Images processed in memory only
   - Temporary files cleaned up immediately
   - No logging of sensitive image data

2. **API Key Security**
   - Environment variable storage
   - No hardcoded credentials
   - Secure transmission only

3. **Input Validation**
   - Image format whitelist
   - Size limitations
   - Malicious content detection

### Rate Limiting

```typescript
interface RateLimiter {
  checkLimit(clientId: string): boolean
  getRetryAfter(clientId: string): number
  incrementUsage(clientId: string): void
  resetUsage(clientId: string): void
}
```

## Scalability Considerations

### Horizontal Scaling

- Stateless server design
- Load balancer compatible
- Session management through external storage

### Performance Optimization

- Connection pooling for OpenRouter API
- Image caching for repeated requests
- Response compression
- Async processing for non-blocking operations

### Monitoring and Observability

- Structured logging (JSON format)
- Metrics collection (Prometheus compatible)
- Health check endpoints
- Performance profiling

## Configuration Management

### Environment Variables

```bash
# Required
OPENROUTER_API_KEY=your_api_key_here

# Optional
VISION_MODEL_PRIMARY=x-ai/grok-beta-vision
VISION_MODEL_FALLBACK=google/gemini-2.0-flash-001
MAX_IMAGE_SIZE=10485760
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60000
LOG_LEVEL=info
```

### Configuration File

```json
{
  "mcp": {
    "transport": "stdio",
    "timeout": 30000
  },
  "openrouter": {
    "baseURL": "https://openrouter.ai/api/v1",
    "timeout": 30000,
    "maxRetries": 3
  },
  "image": {
    "maxSize": 10485760,
    "allowedFormats": ["jpeg", "jpg", "png", "webp", "gif"],
    "tempDir": "/tmp/vision-bridge"
  },
  "security": {
    "rateLimit": {
      "requests": 100,
      "window": 60000
    }
  }
}
```

## Testing Strategy

### Unit Tests
- Component-level testing
- Mock external dependencies
- Edge case coverage

### Integration Tests
- End-to-end request flow
- OpenRouter API integration
- MCP protocol compliance

### Performance Tests
- Load testing with concurrent requests
- Memory usage monitoring
- Response time benchmarking

### Security Tests
- Input validation testing
- Rate limiting verification
- Privacy compliance checks
