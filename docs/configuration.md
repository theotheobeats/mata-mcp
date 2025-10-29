# Configuration Guide

This guide covers all configuration options for the MCP Vision Bridge, including environment variables, configuration files, and runtime settings.

## Configuration Sources

Configuration can be provided through multiple sources (in order of precedence):

1. **Environment Variables** - Highest priority
2. **Configuration Files** - JSON/YAML files
3. **Command Line Arguments** - Runtime flags
4. **Default Values** - Built-in defaults

## Environment Variables

### Required Variables

```bash
# OpenRouter API Key (required)
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
```

### Optional Variables

#### Server Configuration

```bash
# MCP Server Settings
MCP_TRANSPORT=stdio                    # stdio | http (default: stdio)
MCP_PORT=3000                          # Port for HTTP transport (default: 3000)
MCP_TIMEOUT=30000                      # Request timeout in ms (default: 30000)
MCP_CORS=true                          # Enable CORS for HTTP (default: false)

# Logging
LOG_LEVEL=info                         # debug | info | warn | error (default: info)
LOG_FORMAT=json                        # json | text (default: json)
LOG_FILE=logs/app.log                  # Log file path (optional)
```

#### OpenRouter Configuration

```bash
# OpenRouter API Settings
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_TIMEOUT=30000               # API timeout in ms (default: 30000)
OPENROUTER_MAX_RETRIES=3               # Max retry attempts (default: 3)
OPENROUTER_RETRY_DELAY=1000            # Base retry delay in ms (default: 1000)

# Model Configuration
VISION_MODEL_PRIMARY=x-ai/grok-beta-vision
VISION_MODEL_FALLBACK=google/gemini-2.0-flash-001,anthropic/claude-3-5-sonnet-20241022
VISION_MODEL_MAX_TOKENS=1000           # Default max tokens (default: 1000)
VISION_MODEL_TEMPERATURE=0.7           # Default temperature (default: 0.7)
```

#### Image Processing

```bash
# Image Settings
MAX_IMAGE_SIZE=10485760                # Max image size in bytes (default: 10MB)
ALLOWED_IMAGE_FORMATS=jpeg,jpg,png,webp,gif
IMAGE_QUALITY=85                       # JPEG quality 1-100 (default: 85)
IMAGE_MAX_DIMENSION=2048               # Max width/height in pixels (default: 2048)
TEMP_DIR=/tmp/vision-bridge            # Temporary file directory (default: system temp)
CLEANUP_TEMP_FILES=true                # Auto-cleanup temp files (default: true)
```

#### Security & Rate Limiting

```bash
# Rate Limiting
RATE_LIMIT_ENABLED=true                # Enable rate limiting (default: true)
RATE_LIMIT_REQUESTS=100                # Requests per window (default: 100)
RATE_LIMIT_WINDOW=60000                # Time window in ms (default: 60000)
RATE_LIMIT_BURST=10                    # Burst requests allowed (default: 10)

# Security
ALLOWED_ORIGINS=https://localhost:3000 # CORS allowed origins (comma-separated)
MAX_CONCURRENT_REQUESTS=5              # Max concurrent requests (default: 5)
REQUEST_TIMEOUT=30000                  # Request timeout in ms (default: 30000)
```

#### Performance & Caching

```bash
# Caching
CACHE_ENABLED=true                     # Enable response caching (default: true)
CACHE_TTL=300                          # Cache TTL in seconds (default: 300)
CACHE_MAX_SIZE=100                     # Max cache entries (default: 100)

# Connection Pooling
CONNECTION_POOL_SIZE=10                # HTTP connection pool size (default: 10)
CONNECTION_POOL_MAX_SOCKETS=20         # Max sockets per pool (default: 20)
KEEP_ALIVE=true                        # Enable HTTP keep-alive (default: true)
```

#### Monitoring & Observability

```bash
# Metrics
METRICS_ENABLED=true                   # Enable metrics collection (default: true)
METRICS_PORT=9090                      # Metrics server port (default: 9090)
METRICS_PATH=/metrics                  # Metrics endpoint path (default: /metrics)

# Health Checks
HEALTH_CHECK_ENABLED=true              # Enable health checks (default: true)
HEALTH_CHECK_PORT=3001                 # Health check port (default: 3001)
HEALTH_CHECK_PATH=/health              # Health check path (default: /health)
```

## Configuration Files

### JSON Configuration

Create a `config.json` file:

```json
{
  "server": {
    "transport": "stdio",
    "port": 3000,
    "timeout": 30000,
    "cors": false
  },
  "openrouter": {
    "apiKey": "${OPENROUTER_API_KEY}",
    "baseURL": "https://openrouter.ai/api/v1",
    "timeout": 30000,
    "maxRetries": 3,
    "retryDelay": 1000
  },
  "models": {
    "primary": "x-ai/grok-beta-vision",
    "fallback": [
      "google/gemini-2.0-flash-001",
      "anthropic/claude-3-5-sonnet-20241022"
    ],
    "defaultMaxTokens": 1000,
    "defaultTemperature": 0.7
  },
  "image": {
    "maxSize": 10485760,
    "allowedFormats": ["jpeg", "jpg", "png", "webp", "gif"],
    "quality": 85,
    "maxDimension": 2048,
    "tempDir": "/tmp/vision-bridge",
    "cleanupTempFiles": true
  },
  "security": {
    "rateLimit": {
      "enabled": true,
      "requests": 100,
      "window": 60000,
      "burst": 10
    },
    "allowedOrigins": ["https://localhost:3000"],
    "maxConcurrentRequests": 5,
    "requestTimeout": 30000
  },
  "performance": {
    "cache": {
      "enabled": true,
      "ttl": 300,
      "maxSize": 100
    },
    "connectionPool": {
      "size": 10,
      "maxSockets": 20,
      "keepAlive": true
    }
  },
  "logging": {
    "level": "info",
    "format": "json",
    "file": "logs/app.log"
  },
  "monitoring": {
    "metrics": {
      "enabled": true,
      "port": 9090,
      "path": "/metrics"
    },
    "healthCheck": {
      "enabled": true,
      "port": 3001,
      "path": "/health"
    }
  }
}
```

### YAML Configuration

Create a `config.yaml` file:

```yaml
server:
  transport: stdio
  port: 3000
  timeout: 30000
  cors: false

openrouter:
  apiKey: ${OPENROUTER_API_KEY}
  baseURL: https://openrouter.ai/api/v1
  timeout: 30000
  maxRetries: 3
  retryDelay: 1000

models:
  primary: x-ai/grok-beta-vision
  fallback:
    - google/gemini-2.0-flash-001
    - anthropic/claude-3-5-sonnet-20241022
  defaultMaxTokens: 1000
  defaultTemperature: 0.7

image:
  maxSize: 10485760
  allowedFormats:
    - jpeg
    - jpg
    - png
    - webp
    - gif
  quality: 85
  maxDimension: 2048
  tempDir: /tmp/vision-bridge
  cleanupTempFiles: true

security:
  rateLimit:
    enabled: true
    requests: 100
    window: 60000
    burst: 10
  allowedOrigins:
    - https://localhost:3000
  maxConcurrentRequests: 5
  requestTimeout: 30000

performance:
  cache:
    enabled: true
    ttl: 300
    maxSize: 100
  connectionPool:
    size: 10
    maxSockets: 20
    keepAlive: true

logging:
  level: info
  format: json
  file: logs/app.log

monitoring:
  metrics:
    enabled: true
    port: 9090
    path: /metrics
  healthCheck:
    enabled: true
    port: 3001
    path: /health
```

### Environment-Specific Configurations

#### Development (`config.development.json`)

```json
{
  "logging": {
    "level": "debug",
    "format": "text"
  },
  "security": {
    "rateLimit": {
      "requests": 1000,
      "window": 60000
    }
  },
  "performance": {
    "cache": {
      "enabled": false
    }
  }
}
```

#### Production (`config.production.json`)

```json
{
  "logging": {
    "level": "warn",
    "format": "json",
    "file": "/var/log/vision-bridge/app.log"
  },
  "security": {
    "rateLimit": {
      "requests": 50,
      "window": 60000
    },
    "maxConcurrentRequests": 3
  },
  "performance": {
    "cache": {
      "enabled": true,
      "ttl": 600,
      "maxSize": 500
    }
  },
  "monitoring": {
    "metrics": {
      "enabled": true
    },
    "healthCheck": {
      "enabled": true
    }
  }
}
```

## Command Line Arguments

```bash
# Start server with command line options
node dist/server/mcp-server.js \
  --transport stdio \
  --port 3000 \
  --log-level info \
  --max-image-size 10485760 \
  --rate-limit-requests 100 \
  --rate-limit-window 60000

# Available options
--transport <stdio|http>          # Transport method (default: stdio)
--port <number>                   # Port for HTTP transport (default: 3000)
--log-level <debug|info|warn|error> # Log level (default: info)
--log-format <json|text>          # Log format (default: json)
--max-image-size <bytes>          # Max image size (default: 10485760)
--rate-limit-requests <number>    # Rate limit requests (default: 100)
--rate-limit-window <ms>          # Rate limit window (default: 60000)
--cache-enabled <boolean>         # Enable caching (default: true)
--cache-ttl <seconds>             # Cache TTL (default: 300)
--health-check-port <number>      # Health check port (default: 3001)
--metrics-port <number>           # Metrics port (default: 9090)
--help                            # Show help message
```

## Configuration Loading

### Automatic Loading

The server automatically loads configuration from:

1. Environment variables
2. `config.json` (if exists)
3. Environment-specific config (e.g., `config.development.json`)
4. Default values

### Manual Loading

```typescript
import { loadConfig } from './src/config/config-loader'

// Load configuration
const config = await loadConfig({
  configPath: './config.json',
  env: process.env.NODE_ENV || 'development',
  overrides: {
    logLevel: 'debug'
  }
})

// Use configuration
const server = new MCPVisionServer(config)
```

### Configuration Validation

```typescript
import { z } from 'zod'

const ConfigSchema = z.object({
  server: z.object({
    transport: z.enum(['stdio', 'http']).default('stdio'),
    port: z.number().min(1).max(65535).default(3000),
    timeout: z.number().positive().default(30000)
  }),
  openrouter: z.object({
    apiKey: z.string().min(1),
    baseURL: z.string().url().default('https://openrouter.ai/api/v1'),
    timeout: z.number().positive().default(30000),
    maxRetries: z.number().int().min(0).default(3)
  }),
  models: z.object({
    primary: z.string(),
    fallback: z.array(z.string()).default([]),
    defaultMaxTokens: z.number().positive().default(1000),
    defaultTemperature: z.number().min(0).max(2).default(0.7)
  })
})

// Validate configuration
const validatedConfig = ConfigSchema.parse(config)
```

## Dynamic Configuration

### Runtime Updates

```typescript
class ConfigManager {
  private config: ServerConfig
  private listeners: Set<(config: ServerConfig) => void> = new Set()

  updateConfig(updates: Partial<ServerConfig>) {
    this.config = { ...this.config, ...updates }
    this.notifyListeners()
  }

  onConfigChange(listener: (config: ServerConfig) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.config))
  }
}
```

### Hot Reloading

```typescript
import { watch } from 'fs'

// Watch configuration file for changes
watch('./config.json', { persistent: false }, (eventType, filename) => {
  if (eventType === 'change') {
    console.log('Configuration file changed, reloading...')
    loadConfig().then(config => {
      configManager.updateConfig(config)
    }).catch(error => {
      console.error('Failed to reload configuration:', error)
    })
  }
})
```

## Environment-Specific Setup

### Development

```bash
# .env.development
NODE_ENV=development
LOG_LEVEL=debug
CACHE_ENABLED=false
RATE_LIMIT_REQUESTS=1000
VISION_MODEL_PRIMARY=x-ai/grok-beta-vision
```

### Staging

```bash
# .env.staging
NODE_ENV=staging
LOG_LEVEL=info
CACHE_ENABLED=true
CACHE_TTL=300
RATE_LIMIT_REQUESTS=200
VISION_MODEL_PRIMARY=google/gemini-2.0-flash-001
```

### Production

```bash
# .env.production
NODE_ENV=production
LOG_LEVEL=warn
CACHE_ENABLED=true
CACHE_TTL=600
RATE_LIMIT_REQUESTS=50
VISION_MODEL_PRIMARY=x-ai/grok-beta-vision
VISION_MODEL_FALLBACK=google/gemini-2.0-flash-001,anthropic/claude-3-5-sonnet-20241022
```

## Docker Configuration

### Dockerfile Environment

```dockerfile
FROM node:18-alpine

# Set environment
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV CACHE_ENABLED=true
ENV RATE_LIMIT_ENABLED=true

# Copy configuration
COPY config.production.json /app/config.json

# Set working directory
WORKDIR /app

# Install dependencies and build
RUN npm ci --only=production && npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S mcp -u 1001
RUN chown -R mcp:nodejs /app
USER mcp

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

CMD ["node", "dist/server/mcp-server.js"]
```

### Docker Compose Environment

```yaml
version: '3.8'

services:
  mcp-vision-bridge:
    build: .
    environment:
      - NODE_ENV=production
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - LOG_LEVEL=info
      - CACHE_ENABLED=true
      - RATE_LIMIT_ENABLED=true
      - RATE_LIMIT_REQUESTS=100
      - RATE_LIMIT_WINDOW=60000
    volumes:
      - ./logs:/app/logs
      - /tmp/vision-bridge:/tmp/vision-bridge
    ports:
      - "3000:3000"
      - "9090:9090"  # Metrics
      - "3001:3001"  # Health check
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## Kubernetes Configuration

### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mcp-vision-bridge-config
data:
  config.json: |
    {
      "server": {
        "transport": "stdio",
        "timeout": 30000
      },
      "logging": {
        "level": "info",
        "format": "json"
      },
      "performance": {
        "cache": {
          "enabled": true,
          "ttl": 300
        }
      }
    }
```

### Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mcp-vision-bridge-secrets
type: Opaque
stringData:
  OPENROUTER_API_KEY: "sk-or-v1-your-api-key-here"
  VISION_MODEL_PRIMARY: "x-ai/grok-beta-vision"
  VISION_MODEL_FALLBACK: "google/gemini-2.0-flash-001"
```

### Deployment with Config

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-vision-bridge
spec:
  template:
    spec:
      containers:
      - name: mcp-vision-bridge
        image: mcp-vision-bridge:latest
        envFrom:
        - configMapRef:
            name: mcp-vision-bridge-config
        - secretRef:
            name: mcp-vision-bridge-secrets
        volumeMounts:
        - name: config-volume
          mountPath: /app/config
        ports:
        - containerPort: 3000
        - containerPort: 9090
        - containerPort: 3001
      volumes:
      - name: config-volume
        configMap:
          name: mcp-vision-bridge-config
```

## Configuration Validation

### Schema Validation

```typescript
import Joi from 'joi'

const configSchema = Joi.object({
  server: Joi.object({
    transport: Joi.string().valid('stdio', 'http').default('stdio'),
    port: Joi.number().port().default(3000),
    timeout: Joi.number().positive().default(30000)
  }).default(),
  
  openrouter: Joi.object({
    apiKey: Joi.string().required(),
    baseURL: Joi.string().uri().default('https://openrouter.ai/api/v1'),
    timeout: Joi.number().positive().default(30000),
    maxRetries: Joi.number().integer().min(0).default(3)
  }).required(),
  
  models: Joi.object({
    primary: Joi.string().required(),
    fallback: Joi.array().items(Joi.string()).default([]),
    defaultMaxTokens: Joi.number().positive().default(1000),
    defaultTemperature: Joi.number().min(0).max(2).default(0.7)
  }).required(),
  
  security: Joi.object({
    rateLimit: Joi.object({
      enabled: Joi.boolean().default(true),
      requests: Joi.number().positive().default(100),
      window: Joi.number().positive().default(60000)
    }).default()
  }).default()
})

// Validate configuration
const { error, value } = configSchema.validate(config)
if (error) {
  throw new Error(`Configuration validation failed: ${error.message}`)
}
```

### Runtime Validation

```typescript
class ConfigValidator {
  static validateImageSize(size: number): boolean {
    const maxSize = parseInt(process.env.MAX_IMAGE_SIZE || '10485760')
    return size > 0 && size <= maxSize
  }
  
  static validateImageFormat(format: string): boolean {
    const allowedFormats = (process.env.ALLOWED_IMAGE_FORMATS || 'jpeg,jpg,png,webp,gif')
      .split(',')
      .map(f => f.trim().toLowerCase())
    return allowedFormats.includes(format.toLowerCase())
  }
  
  static validateRateLimit(clientId: string): boolean {
    // Implementation for rate limit validation
    return true
  }
}
```

## Troubleshooting Configuration

### Common Issues

1. **Missing API Key**
   ```bash
   # Error: OPENROUTER_API_KEY is required
   # Solution: Set the environment variable
   export OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
   ```

2. **Invalid Configuration File**
   ```bash
   # Error: Configuration file contains invalid JSON
   # Solution: Validate JSON syntax
   node -e "JSON.parse(require('fs').readFileSync('config.json', 'utf8'))"
   ```

3. **Port Already in Use**
   ```bash
   # Error: listen EADDRINUSE :::3000
   # Solution: Change port or kill existing process
   lsof -ti:3000 | xargs kill -9
   ```

4. **Permission Denied**
   ```bash
   # Error: EACCES: permission denied
   # Solution: Check file permissions and ownership
   chmod 644 config.json
   chown $USER:$USER config.json
   ```

### Debug Configuration

```typescript
// Enable configuration debugging
process.env.DEBUG = 'config:*'

// Log configuration loading
import { logger } from './src/utils/logging'

logger.debug('Loading configuration', { 
  configPath: configPath,
  environment: process.env.NODE_ENV,
  hasApiKey: !!process.env.OPENROUTER_API_KEY 
})

// Validate critical configuration
const criticalConfig = {
  apiKey: process.env.OPENROUTER_API_KEY,
  primaryModel: process.env.VISION_MODEL_PRIMARY
}

for (const [key, value] of Object.entries(criticalConfig)) {
  if (!value) {
    logger.error(`Missing critical configuration: ${key}`)
    process.exit(1)
  }
}
```

### Configuration Testing

```typescript
// Test configuration loading
import { loadConfig } from './src/config/config-loader'

async function testConfiguration() {
  try {
    const config = await loadConfig()
    console.log('Configuration loaded successfully:', {
      transport: config.server.transport,
      primaryModel: config.models.primary,
      hasApiKey: !!config.openrouter.apiKey
    })
  } catch (error) {
    console.error('Configuration test failed:', error.message)
    process.exit(1)
  }
}

testConfiguration()
```
