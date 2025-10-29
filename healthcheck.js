#!/usr/bin/env node

/**
 * Health Check Script
 * Used by Docker and Kubernetes for container health monitoring
 */

const http = require('http')

const config = {
  host: process.env.HEALTH_CHECK_HOST || 'localhost',
  port: process.env.HEALTH_CHECK_PORT || '3001',
  path: process.env.HEALTH_CHECK_PATH || '/health',
  timeout: 5000
}

function checkHealth() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: config.host,
      port: config.port,
      path: config.path,
      method: 'GET',
      timeout: config.timeout
    }

    const req = http.request(options, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data)
          
          if (res.statusCode === 200 && response.status === 'healthy') {
            console.log(`✅ Health check passed: ${response.status}`)
            console.log(`📊 Uptime: ${response.uptime}s`)
            console.log(`🔧 Version: ${response.version}`)
            resolve(true)
          } else {
            console.error(`❌ Health check failed: ${response.status}`)
            console.error(`💬 Message: ${response.message}`)
            reject(new Error(`Health check failed: ${response.status}`))
          }
        } catch (error) {
          console.error('❌ Failed to parse health check response:', error.message)
          reject(error)
        }
      })
    })

    req.on('error', (error) => {
      console.error('❌ Health check request failed:', error.message)
      reject(error)
    })

    req.on('timeout', () => {
      console.error('❌ Health check timed out')
      req.destroy()
      reject(new Error('Health check timeout'))
    })

    req.end()
  })
}

async function main() {
  try {
    await checkHealth()
    process.exit(0)
  } catch (error) {
    console.error('💥 Health check failed:', error.message)
    process.exit(1)
  }
}

// Run health check
if (require.main === module) {
  main()
}

module.exports = { checkHealth }
