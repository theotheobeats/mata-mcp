# Deployment Guide

This guide covers various deployment options for the MCP Vision Bridge, from local development to production environments.

## Prerequisites

### System Requirements

- **Node.js:** Version 18.0 or higher
- **npm:** Version 8.0 or higher (or yarn/pnpm)
- **Memory:** Minimum 512MB RAM, 1GB recommended
- **Storage:** 100MB for application, additional space for temporary files
- **Network:** Internet access for OpenRouter API calls

### Required API Keys

- **OpenRouter API Key:** Get from [OpenRouter Dashboard](https://openrouter.ai/keys)

## Local Development

### 1. Setup

```bash
# Clone the repository
git clone <repository-url>
cd vision-mcp

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 2. Environment Configuration

```bash
# Required
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here

# Optional configurations
VISION_MODEL_PRIMARY=x-ai/grok-beta-vision
VISION_MODEL_FALLBACK=google/gemini-2.0-flash-001
MAX_IMAGE_SIZE=10485760
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60000
LOG_LEVEL=info
PORT=3000
```

### 3. Development Server

```bash
# Start development server with hot reload
npm run dev

# Or start production build
npm run build
npm start
```

### 4. Testing the Setup

```bash
# Run tests
npm test

# Test MCP server directly
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | npm start
```

## Docker Deployment

### 1. Dockerfile

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Production stage
FROM node:18-alpine AS production

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S mcp -u 1001

WORKDIR /app

# Copy dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=mcp:nodejs . .

# Build application
RUN npm run build && npm prune --production

# Switch to non-root user
USER mcp

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start application
CMD ["node", "dist/server/mcp-server.js"]
```

### 2. Docker Compose

```yaml
version: '3.8'

services:
  mcp-vision-bridge:
    build: .
    ports:
      - "3000:3000"
    environment:
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - VISION_MODEL_PRIMARY=x-ai/grok-beta-vision
      - VISION_MODEL_FALLBACK=google/gemini-2.0-flash-001
      - LOG_LEVEL=info
    volumes:
      - ./logs:/app/logs
      - /tmp:/tmp/vision-bridge  # Temporary image storage
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Optional: Add nginx for reverse proxy
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - mcp-vision-bridge
    restart: unless-stopped
```

### 3. Build and Run

```bash
# Build image
docker build -t mcp-vision-bridge:latest .

# Run with docker-compose
docker-compose up -d

# Or run directly
docker run -d \
  --name mcp-vision-bridge \
  -p 3000:3000 \
  -e OPENROUTER_API_KEY=your-api-key \
  mcp-vision-bridge:latest
```

## Cloud Deployment

### AWS Deployment

#### Using AWS ECS

1. **Create ECS Task Definition:**

```json
{
  "family": "mcp-vision-bridge",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "mcp-vision-bridge",
      "image": "your-account.dkr.ecr.region.amazonaws.com/mcp-vision-bridge:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "OPENROUTER_API_KEY",
          "value": "your-api-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/mcp-vision-bridge",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

2. **Deploy with CloudFormation or CDK**

#### Using AWS Lambda

```typescript
// lambda-handler.ts
import { APIGatewayProxyHandler } from 'aws-lambda'
import { MCPVisionBridge } from './src/server/mcp-server'

const bridge = new MCPVisionBridge({
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY!,
  }
})

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const request = JSON.parse(event.body!)
    const result = await bridge.processRequest(request)
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}
```

### Google Cloud Platform

#### Using Cloud Run

```yaml
# cloudbuild.yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/mcp-vision-bridge', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/mcp-vision-bridge']
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'mcp-vision-bridge'
      - '--image'
      - 'gcr.io/$PROJECT_ID/mcp-vision-bridge'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
      - '--set-env-vars'
      - 'OPENROUTER_API_KEY=your-api-key'
```

### Azure Deployment

#### Using Azure Container Instances

```bash
# Create resource group
az group create --name mcp-vision-bridge-rg --location eastus

# Create container instance
az container create \
  --resource-group mcp-vision-bridge-rg \
  --name mcp-vision-bridge \
  --image your-registry/mcp-vision-bridge:latest \
  --cpu 1 \
  --memory 1.5 \
  --ports 3000 \
  --environment-variables \
    OPENROUTER_API_KEY=your-api-key \
    LOG_LEVEL=info
```

## Kubernetes Deployment

### 1. Deployment Manifest

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-vision-bridge
  labels:
    app: mcp-vision-bridge
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-vision-bridge
  template:
    metadata:
      labels:
        app: mcp-vision-bridge
    spec:
      containers:
      - name: mcp-vision-bridge
        image: mcp-vision-bridge:latest
        ports:
        - containerPort: 3000
        env:
        - name: OPENROUTER_API_KEY
          valueFrom:
            secretKeyRef:
              name: mcp-secrets
              key: openrouter-api-key
        - name: LOG_LEVEL
          value: "info"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: mcp-vision-bridge-service
spec:
  selector:
    app: mcp-vision-bridge
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

### 2. Secrets Management

```yaml
# k8s-secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: mcp-secrets
type: Opaque
stringData:
  openrouter-api-key: "sk-or-v1-your-api-key-here"
```

### 3. Deploy to Kubernetes

```bash
# Apply manifests
kubectl apply -f k8s-secrets.yaml
kubectl apply -f k8s-deployment.yaml

# Check deployment status
kubectl get pods -l app=mcp-vision-bridge
kubectl logs -l app=mcp-vision-bridge

# Scale deployment
kubectl scale deployment mcp-vision-bridge --replicas=5
```

## Serverless Deployment

### Vercel

```json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/server/mcp-server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "dist/server/mcp-server.js"
    }
  ],
  "env": {
    "OPENROUTER_API_KEY": "@openrouter-api-key"
  }
}
```

### Netlify Functions

```javascript
// netlify/function/mcp-vision-bridge.js
const { MCPVisionBridge } = require('../../dist/server/mcp-server')

exports.handler = async (event, context) => {
  try {
    const bridge = new MCPVisionBridge({
      openrouter: {
        apiKey: process.env.OPENROUTER_API_KEY,
      }
    })

    const result = await bridge.processRequest(JSON.parse(event.body))
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}
```

## OpenCode Integration

### 1. OpenCode Configuration

Add to your OpenCode configuration file (`~/.config/opencode/config.json`):

```json
{
  "mcpServers": {
    "vision-bridge": {
      "command": "node",
      "args": ["/path/to/vision-mcp/dist/server/mcp-server.js"],
      "env": {
        "OPENROUTER_API_KEY": "your-openrouter-api-key",
        "VISION_MODEL_PRIMARY": "x-ai/grok-beta-vision",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### 2. Docker Integration

```json
{
  "mcpServers": {
    "vision-bridge": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e", "OPENROUTER_API_KEY=your-api-key",
        "mcp-vision-bridge:latest"
      ]
    }
  }
}
```

### 3. Testing Integration

```bash
# Start OpenCode
opencode

# In OpenCode, test the vision bridge
# /analyze_image https://example.com/image.jpg "Describe this image"
```

## Monitoring and Logging

### 1. Health Checks

```javascript
// healthcheck.js
const http = require('http')

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/health',
  method: 'GET',
  timeout: 2000
}

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0)
  } else {
    process.exit(1)
  }
})

req.on('error', () => {
  process.exit(1)
})

req.on('timeout', () => {
  req.destroy()
  process.exit(1)
})

req.end()
```

### 2. Logging Configuration

```javascript
// src/utils/logging.ts
import winston from 'winston'

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'mcp-vision-bridge' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
})
```

### 3. Metrics Collection

```javascript
// src/utils/metrics.ts
import { register, Counter, Histogram } from 'prom-client'

// Request metrics
export const requestCounter = new Counter({
  name: 'mcp_vision_requests_total',
  help: 'Total number of requests',
  labelNames: ['tool', 'status']
})

export const requestDuration = new Histogram({
  name: 'mcp_vision_request_duration_seconds',
  help: 'Request duration in seconds',
  labelNames: ['tool']
})

export const imageProcessingCounter = new Counter({
  name: 'mcp_vision_images_processed_total',
  help: 'Total number of images processed',
  labelNames: ['format', 'size_range']
})
```

## Security Considerations

### 1. Environment Variables

```bash
# Use secure environment variable management
# AWS Systems Manager Parameter Store
aws ssm put-parameter --name "/mcp/vision/api-key" --value "your-api-key" --type SecureString

# Azure Key Vault
az keyvault secret set --vault-name "mcp-vision-vault" --name "openrouter-api-key" --value "your-api-key"

# Kubernetes Secrets
kubectl create secret generic mcp-secrets --from-literal=openrouter-api-key=your-api-key
```

### 2. Network Security

```yaml
# Kubernetes Network Policy
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: mcp-vision-bridge-netpol
spec:
  podSelector:
    matchLabels:
      app: mcp-vision-bridge
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: opencode
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except:
          - 10.0.0.0/8
          - 172.16.0.0/12
          - 192.168.0.0/16
    ports:
    - protocol: TCP
      port: 443  # HTTPS
```

### 3. Container Security

```dockerfile
# Security best practices
FROM node:18-alpine AS builder

# Use non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S mcp -u 1001

# Security updates
RUN apk update && apk upgrade

# Production stage with security hardening
FROM node:18-alpine AS production

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcp -u 1001

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Switch to non-root user
USER mcp

# Read-only filesystem
COPY --chown=mcp:nodejs . .
RUN npm run build

# Use read-only filesystem
USER root
RUN chmod -R g=u /app
USER mcp

CMD ["node", "dist/server/mcp-server.js"]
```

## Troubleshooting

### Common Issues

1. **API Key Issues**
   ```bash
   # Check environment variable
   echo $OPENROUTER_API_KEY
   
   # Test API key validity
   curl -H "Authorization: Bearer $OPENROUTER_API_KEY" \
        https://openrouter.ai/api/v1/models
   ```

2. **Memory Issues**
   ```bash
   # Monitor memory usage
   docker stats mcp-vision-bridge
   
   # Increase memory limits
   # Docker: docker run -m 1g ...
   # Kubernetes: resources.limits.memory: "1Gi"
   ```

3. **Network Issues**
   ```bash
   # Test connectivity
   curl -I https://openrouter.ai/api/v1
   
   # Check DNS resolution
   nslookup openrouter.ai
   ```

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug npm start

# Enable MCP protocol debugging
DEBUG=mcp:* npm start

# Enable OpenRouter API debugging
DEBUG=openrouter:* npm start
```

## Performance Optimization

### 1. Caching

```javascript
// src/core/cache.ts
import NodeCache from 'node-cache'

const cache = new NodeCache({ 
  stdTTL: 300, // 5 minutes
  checkperiod: 120,
  useClones: false
})

export const cacheImageResult = (key: string, result: any) => {
  cache.set(key, result)
}

export const getCachedResult = (key: string) => {
  return cache.get(key)
}
```

### 2. Connection Pooling

```javascript
// src/integrations/openrouter/client.ts
import axios from 'axios'

const httpAgent = new http.Agent({ 
  keepAlive: true,
  maxSockets: 10,
  maxFreeSockets: 5
})

const httpsAgent = new https.Agent({ 
  keepAlive: true,
  maxSockets: 10,
  maxFreeSockets: 5
})

const client = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 30000
})
```

### 3. Load Balancing

```yaml
# nginx.conf
upstream mcp_vision_bridge {
    least_conn;
    server mcp-vision-bridge-1:3000;
    server mcp-vision-bridge-2:3000;
    server mcp-vision-bridge-3:3000;
}

server {
    listen 80;
    location / {
        proxy_pass http://mcp_vision_bridge;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
