# AI Workflow Engine - Complete Implementation Guide

## 🚀 Quick Start

This guide provides complete code and configurations to implement the AI workflow engine connecting Cloudflare Workers, Render services, GitHub Gists, and GitHub Actions for the Heady project.

## 📁 File Structure to Create

```
ai-workflow-engine/
├── src/
│   ├── index.ts                 # Main Cloudflare Worker entry
│   ├── services/
│   │   ├── ai.ts               # Workers AI integration
│   │   ├── database.ts         # PostgreSQL client
│   │   ├── cache.ts            # Redis client
│   │   └── gist.ts             # GitHub Gist config loader
│   ├── routes/
│   │   ├── workflow.ts         # Workflow API endpoints
│   │   └── health.ts           # Health check
│   └── types/
│       └── env.ts              # TypeScript environment types
├── .github/
│   └── workflows/
│       ├── deploy.yml          # Deploy to Cloudflare
│       └── render-deploy.yml   # Deploy to Render
├── config/
│   └── workflow-config.json    # Sample configuration
├── wrangler.toml               # Cloudflare configuration
├── tsconfig.json               # TypeScript configuration
└── .env.example                # Environment variables template
```

## 1️⃣ Wrangler Configuration

Create `wrangler.toml`:

```toml
name = "ai-workflow-engine"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[observability]
enabled = true

[[ai]]
binding = "AI"

[[kv_namespaces]]
binding = "CONFIG"
id = "your_kv_id_here"

[vars]
PROJECT_NAME = "Heady"
ENVIRONMENT = "production"

# Add secrets via: wrangler secret put SECRET_NAME
# Required secrets:
# - DATABASE_URL (PostgreSQL from Render)
# - REDIS_URL (Redis from Render)
# - GITHUB_TOKEN (for Gist access)
```

## 2️⃣ TypeScript Configuration

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "lib": ["ES2021"],
    "module": "ES2022",
    "moduleResolution": "node",
    "types": ["@cloudflare/workers-types"],
    "resolveJsonModule": true,
    "allowJs": true,
    "checkJs": false,
    "jsx": "react",
    "noEmit": true,
    "isolatedModules": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

## 3️⃣ Main Worker Code

Create `src/index.ts`:

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { AIService } from './services/ai'
import { DatabaseService } from './services/database'
import { CacheService } from './services/cache'
import { GistService } from './services/gist'
import type { Env } from './types/env'

const app = new Hono<{ Bindings: Env }>()

// Middleware
app.use('/*', cors())

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    project: 'Heady AI Workflow Engine',
    timestamp: new Date().toISOString()
  })
})

// AI Workflow endpoint
app.post('/api/workflow', async (c) => {
  try {
    const { prompt, model = '@cf/meta/llama-2-7b-chat-int8' } = await c.req.json()
    
    // Initialize services
    const ai = new AIService(c.env.AI)
    const cache = new CacheService(c.env.REDIS_URL)
    const db = new DatabaseService(c.env.DATABASE_URL)
    const gist = new GistService(c.env.GITHUB_TOKEN)
    
    // Check cache first
    const cacheKey = `ai:${model}:${prompt}`
    const cached = await cache.get(cacheKey)
    if (cached) {
      return c.json({ result: cached, source: 'cache' })
    }
    
    // Load config from Gist
    const config = await gist.getConfig('workflow-config')
    
    // Process with AI
    const result = await ai.run(model, { prompt, ...config })
    
    // Cache result
    await cache.set(cacheKey, result, 3600)
    
    // Store in database
    await db.saveWorkflow({
      prompt,
      result,
      model,
      timestamp: new Date()
    })
    
    return c.json({ result, source: 'ai' })
  } catch (error) {
    return c.json({ error: error.message }, 500)
  }
})

export default app
```

## 4️⃣ Service Implementations

### AI Service (`src/services/ai.ts`):

```typescript
export class AIService {
  constructor(private ai: any) {}
  
  async run(model: string, input: any): Promise<string> {
    const response = await this.ai.run(model, input)
    return response.response || JSON.stringify(response)
  }
  
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.ai.run(
      '@cf/baai/bge-base-en-v1.5',
      { text }
    )
    return response.data[0]
  }
}
```

### Cache Service (`src/services/cache.ts`):

```typescript
import { createClient } from 'redis'

export class CacheService {
  private client: any
  
  constructor(redisUrl: string) {
    this.client = createClient({ url: redisUrl })
  }
  
  async get(key: string): Promise<string | null> {
    await this.client.connect()
    const value = await this.client.get(key)
    await this.client.disconnect()
    return value
  }
  
  async set(key: string, value: string, ttl: number): Promise<void> {
    await this.client.connect()
    await this.client.setEx(key, ttl, value)
    await this.client.disconnect()
  }
}
```

### Database Service (`src/services/database.ts`):

```typescript
import postgres from 'postgres'

export class DatabaseService {
  private sql: any
  
  constructor(databaseUrl: string) {
    this.sql = postgres(databaseUrl)
  }
  
  async saveWorkflow(data: any): Promise<void> {
    await this.sql`
      INSERT INTO workflows (prompt, result, model, created_at)
      VALUES (${data.prompt}, ${data.result}, ${data.model}, ${data.timestamp})
    `
  }
  
  async getWorkflows(limit = 10): Promise<any[]> {
    return await this.sql`
      SELECT * FROM workflows
      ORDER BY created_at DESC
      LIMIT ${limit}
    `
  }
}
```

### Gist Service (`src/services/gist.ts`):

```typescript
export class GistService {
  constructor(private token: string) {}
  
  async getConfig(gistId: string): Promise<any> {
    const response = await fetch(
      `https://api.github.com/gists/${gistId}`,
      {
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    )
    const gist = await response.json()
    const content = Object.values(gist.files)[0].content
    return JSON.parse(content)
  }
}
```

## 5️⃣ Environment Types (`src/types/env.ts`):

```typescript
export interface Env {
  AI: any
  DATABASE_URL: string
  REDIS_URL: string
  GITHUB_TOKEN: string
  CONFIG: KVNamespace
}
```

## 6️⃣ GitHub Actions - Cloudflare Deploy

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm install
        
      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

## 7️⃣ Database Schema

Run on your Render PostgreSQL:

```sql
CREATE TABLE IF NOT EXISTS workflows (
  id SERIAL PRIMARY KEY,
  prompt TEXT NOT NULL,
  result TEXT NOT NULL,
  model VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workflows_created ON workflows(created_at DESC);
```

## 8️⃣ Configuration Gist

Create a GitHub Gist named `workflow-config.json`:

```json
{
  "temperature": 0.7,
  "max_tokens": 2048,
  "top_p": 1.0,
  "stream": false,
  "models": {
    "llm": "@cf/meta/llama-2-7b-chat-int8",
    "embedding": "@cf/baai/bge-base-en-v1.5"
  },
  "caching": {
    "enabled": true,
    "ttl": 3600
  }
}
```

## 9️⃣ Setup Instructions

### Step 1: Configure Secrets

```bash
# Cloudflare secrets
wrangler secret put DATABASE_URL
# Paste: postgresql://heady_postgres_user:...@oregon-postgres.render.com/heady_postgres

wrangler secret put REDIS_URL
# Paste: rediss://red-d5um73coud1c73fv8phg:...@oregon-redis.render.com:6379

wrangler secret put GITHUB_TOKEN
# Paste your GitHub Personal Access Token
```

### Step 2: Deploy

```bash
npm install
npm run deploy
```

### Step 3: Test

```bash
curl -X POST https://ai-workflow-engine.YOUR_SUBDOMAIN.workers.dev/api/workflow \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain the Heady project architecture",
    "model": "@cf/meta/llama-2-7b-chat-int8"
  }'
```

## 🔗 Connecting Resources

### Render PostgreSQL Connection:
- External URL: `op://Shared/heady-postgres-external/credential`
- Stored in 1Password for security

### Render Redis Connection:
- External URL: `op://Shared/heady-redis-external/credential`
- Stored in 1Password for security

### GitHub Gist:
- Create at: https://gist.github.com
- Use Gist ID in `GistService`

### Cloudflare Workers AI:
- Enabled via wrangler.toml `[[ai]]` binding
- Access via `c.env.AI`

## ✅ Implementation Checklist

- [x] Repository created
- [x] Package.json configured
- [ ] Create all source files
- [ ] Configure wrangler.toml
- [ ] Set up GitHub Actions
- [ ] Deploy database schema
- [ ] Create configuration Gist
- [ ] Add Cloudflare secrets
- [ ] Deploy to Workers
- [ ] Test end-to-end

## 🚨 Next Steps

1. **Create remaining files** - Use the code above
2. **Configure Cloudflare** - Add API token to GitHub Secrets
3. **Deploy database schema** - Run SQL on Render PostgreSQL
4. **Create Gist** - Store configuration
5. **Test workflow** - Use curl command above

This implementation connects all resources for a complete AI workflow engine!
