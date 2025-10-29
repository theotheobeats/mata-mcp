#!/usr/bin/env node

/**
 * OpenCode Integration Example
 * This demonstrates how to integrate MCP Vision Bridge with OpenCode
 */

const fs = require('fs')
const path = require('path')

class OpenCodeVisionIntegration {
  constructor() {
    this.configPath = this.getOpenCodeConfigPath()
  }

  getOpenCodeConfigPath() {
    const homeDir = process.env.HOME || process.env.USERPROFILE
    return path.join(homeDir, '.config', 'opencode', 'config.json')
  }

  // Generate OpenCode configuration for MCP Vision Bridge
  generateOpenCodeConfig(options = {}) {
    const {
      visionBridgePath = '/absolute/path/to/vision-mcp/dist/server/mcp-server.js',
      openRouterApiKey = process.env.OPENROUTER_API_KEY,
      primaryModel = 'x-ai/grok-beta-vision',
      fallbackModel = 'google/gemini-2.0-flash-001',
      useDocker = false,
      dockerImage = 'mcp-vision-bridge:latest'
    } = options

    const mcpServerConfig = useDocker ? {
      command: 'docker',
      args: [
        'run',
        '-i',
        '--rm',
        '-e', `OPENROUTER_API_KEY=${openRouterApiKey}`,
        '-e', `VISION_MODEL_PRIMARY=${primaryModel}`,
        '-e', `VISION_MODEL_FALLBACK=${fallbackModel}`,
        '-v', '/tmp/vision-bridge:/tmp/vision-bridge',
        dockerImage
      ]
    } : {
      command: 'node',
      args: [visionBridgePath],
      env: {
        OPENROUTER_API_KEY: openRouterApiKey,
        VISION_MODEL_PRIMARY: primaryModel,
        VISION_MODEL_FALLBACK: fallbackModel,
        LOG_LEVEL: 'info'
      }
    }

    return {
      mcpServers: {
        "vision-bridge": mcpServerConfig
      },
      // Additional OpenCode configuration
      theme: "dark",
      model: "anthropic/claude-3-5-sonnet-20241022",
      temperature: 0.7,
      maxTokens: 4000
    }
  }

  // Backup existing OpenCode configuration
  backupExistingConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const backupPath = this.configPath + '.backup.' + Date.now()
        fs.copyFileSync(this.configPath, backupPath)
        console.log(`📋 Backed up existing config to: ${backupPath}`)
        return backupPath
      }
    } catch (error) {
      console.warn('⚠️ Could not backup existing config:', error.message)
    }
    return null
  }

  // Install OpenCode configuration
  async installConfig(options = {}) {
    try {
      // Create config directory if it doesn't exist
      const configDir = path.dirname(this.configPath)
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
        console.log(`📁 Created config directory: ${configDir}`)
      }

      // Backup existing config
      this.backupExistingConfig()

      // Generate new configuration
      const config = this.generateOpenCodeConfig(options)
      
      // Write configuration file
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2))
      console.log(`✅ OpenCode configuration installed to: ${this.configPath}`)

      return true
    } catch (error) {
      console.error('❌ Failed to install OpenCode configuration:', error.message)
      return false
    }
  }

  // Validate OpenCode installation
  async validateInstallation() {
    try {
      // Check if OpenCode is installed
      const { execSync } = require('child_process')
      
      try {
        const version = execSync('opencode --version', { encoding: 'utf8' }).trim()
        console.log(`✅ OpenCode is installed: ${version}`)
      } catch (error) {
        console.warn('⚠️ OpenCode is not installed or not in PATH')
        console.log('💡 Install OpenCode with: curl -fsSL https://opencode.ai/install | bash')
        return false
      }

      // Check if configuration file exists
      if (fs.existsSync(this.configPath)) {
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'))
        if (config.mcpServers && config.mcpServers['vision-bridge']) {
          console.log('✅ MCP Vision Bridge configuration found')
          return true
        } else {
          console.warn('⚠️ MCP Vision Bridge configuration not found in config file')
          return false
        }
      } else {
        console.warn('⚠️ OpenCode configuration file not found')
        return false
      }
    } catch (error) {
      console.error('❌ Validation failed:', error.message)
      return false
    }
  }

  // Generate usage examples for OpenCode
  generateUsageExamples() {
    return `
# OpenCode Vision Bridge Usage Examples

## Starting OpenCode
\`\`\`bash
opencode
\`\`\`

## Basic Image Analysis
In OpenCode, you can now use vision capabilities:

### Analyze an image with custom prompt
\`\`\`
User: Can you analyze this screenshot for UI/UX issues?
[Attach screenshot image]

OpenCode: I'll analyze this screenshot for UI/UX issues using the vision bridge.
[OpenCode will call the analyze_image tool]
OpenCode: I can see several UI/UX issues in this screenshot:
- The navigation menu is too crowded with 12 items
- The search bar is not prominently placed
- The call-to-action button lacks visual hierarchy
- Color contrast may be insufficient for accessibility
\`\`\`

### Describe image content
\`\`\`
User: What's in this diagram?
[Attach architecture diagram]

OpenCode: I'll describe this diagram for you.
[OpenCode will call the describe_image tool]
OpenCode: This is a system architecture diagram showing:
- Frontend: React web app and mobile apps
- API Gateway: Kong for routing and authentication
- Microservices: User, Order, Payment services
- Database: PostgreSQL, Redis, MongoDB
- External APIs: Payment processor, Email service
\`\`\`

### Extract text from documents
\`\`\`
User: Can you extract the key information from this invoice?
[Attach invoice image]

OpenCode: I'll extract the text from this invoice.
[OpenCode will call the extract_text_from_image tool]
OpenCode: Here's the extracted information:
- Company: ABC Corporation
- Invoice #: 2024-001
- Date: January 15, 2024
- Amount: $1,250.00
- Due Date: February 14, 2024
\`\`\`

## Advanced Usage

### Code Review with Vision
\`\`\`
User: Can you review this code architecture diagram and suggest improvements?
[Attach architecture diagram]

OpenCode: I'll analyze this architecture diagram and provide recommendations.
[Uses vision bridge to analyze the diagram]
OpenCode: Based on the architecture diagram, I recommend:
1. Add circuit breakers for external service calls
2. Implement distributed tracing for better observability
3. Consider event-driven architecture for better scalability
4. Add API versioning strategy
\`\`\`

### Design System Analysis
\`\`\`
User: Analyze this design mockup for consistency with our design system
[Attach design mockup]

OpenCode: I'll analyze this design for design system compliance.
[Uses vision bridge to examine the design]
OpenCode: Design system analysis:
✅ Consistent color palette
✅ Typography follows hierarchy
⚠️ Button styles vary across components
⚠️ Spacing is inconsistent (8px vs 16px grid)
❌ Icon style is not aligned with system
\`\`\`

## Tips for Best Results

1. **Be Specific**: Provide clear, detailed prompts for better analysis
2. **High Quality Images**: Use clear, well-lit images for best results
3. **Appropriate Context**: Give relevant background information
4. **Iterative Refinement**: Ask follow-up questions for deeper analysis
5. **Multiple Perspectives**: Try different analysis angles

## Troubleshooting

### If vision tools don't work:
1. Check that OpenCode is using the correct configuration
2. Verify the MCP Vision Bridge server is running
3. Ensure your OpenRouter API key is valid
4. Check the logs for any error messages

### Common Issues:
- **"Tool not found"**: Restart OpenCode to reload configuration
- **"API key invalid"**: Check your OPENROUTER_API_KEY environment variable
- **"Image too large"**: Reduce image size or increase MAX_IMAGE_SIZE
- **"Rate limited"**: Wait a moment and try again
`
  }

  // Save usage examples to file
  saveUsageExamples(outputPath = 'opencode-vision-examples.md') {
    try {
      fs.writeFileSync(outputPath, this.generateUsageExamples())
      console.log(`📚 Usage examples saved to: ${outputPath}`)
      return true
    } catch (error) {
      console.error('❌ Failed to save usage examples:', error.message)
      return false
    }
  }

  // Print installation summary
  printSummary(options) {
    console.log('\n' + '='.repeat(60))
    console.log('🎉 OpenCode Vision Bridge Integration Complete!')
    console.log('='.repeat(60))
    
    console.log('\n📋 Installation Summary:')
    console.log(`   Config file: ${this.configPath}`)
    console.log(`   Transport: ${options.useDocker ? 'Docker' : 'Direct Node.js'}`)
    console.log(`   Primary model: ${options.primaryModel}`)
    console.log(`   Fallback model: ${options.fallbackModel}`)
    
    console.log('\n🚀 Next Steps:')
    console.log('   1. Start OpenCode: opencode')
    console.log('   2. Try the vision capabilities!')
    console.log('   3. Check the usage examples for inspiration')
    
    console.log('\n💡 Example Commands in OpenCode:')
    console.log('   • "Analyze this screenshot for bugs"')
    console.log('   • "Describe this architecture diagram"')
    console.log('   • "Extract text from this document"')
    
    console.log('\n📚 Documentation:')
    console.log('   • Configuration: docs/configuration.md')
    console.log('   • API Reference: docs/api.md')
    console.log('   • Integration: docs/integration.md')
    
    console.log('\n' + '='.repeat(60))
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)
  const integration = new OpenCodeVisionIntegration()

  const options = {
    visionBridgePath: process.env.VISION_BRIDGE_PATH || '/absolute/path/to/vision-mcp/dist/server/mcp-server.js',
    openRouterApiKey: process.env.OPENROUTER_API_KEY,
    primaryModel: process.env.VISION_MODEL_PRIMARY || 'x-ai/grok-beta-vision',
    fallbackModel: process.env.VISION_MODEL_FALLBACK || 'google/gemini-2.0-flash-001',
    useDocker: args.includes('--docker'),
    dockerImage: process.env.DOCKER_IMAGE || 'mcp-vision-bridge:latest'
  }

  console.log('🔧 OpenCode Vision Bridge Integration Setup')
  console.log('='.repeat(50))

  // Validate required options
  if (!options.openRouterApiKey) {
    console.error('❌ OPENROUTER_API_KEY environment variable is required')
    console.log('💡 Set it with: export OPENROUTER_API_KEY=your-api-key')
    process.exit(1)
  }

  // Install configuration
  console.log('\n📦 Installing OpenCode configuration...')
  const installed = await integration.installConfig(options)
  
  if (!installed) {
    console.error('❌ Installation failed')
    process.exit(1)
  }

  // Validate installation
  console.log('\n🔍 Validating installation...')
  const valid = await integration.validateInstallation()
  
  if (!valid) {
    console.warn('⚠️ Some validation checks failed, but installation may still work')
  }

  // Save usage examples
  console.log('\n📚 Generating usage examples...')
  integration.saveUsageExamples()

  // Print summary
  integration.printSummary(options)
}

// Handle command line execution
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Setup failed:', error.message)
    process.exit(1)
  })
}

module.exports = { OpenCodeVisionIntegration }
