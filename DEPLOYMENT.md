# Deployment Guide - AI Workflow Engine

## 🚀 Quick Deploy

### Prerequisites
- Node.js 18+
- Cloudflare account with Workers AI enabled
- Render PostgreSQL and Redis instances (already created)
- GitHub account for Gists

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Configure Secrets

```bash
# Set Cloudflare secrets
wrangler secret put DATABASE_URL
# Enter: postgresql://heady_postgres_user:...@oregon-postgres.render.com:5432/heady_postgres

wrangler secret put REDIS_URL  
# Enter: rediss://red-d5um73coud1c73fv8phg:...@oregon-redis.render.com:6379

wrangler secret put GITHUB_TOKEN
# Enter your GitHub Personal Access Token

wrangler secret put GIST_ID
# Enter your Gist ID after creating the config gist
```

### Step 3: Create Configuration Gist

1. Go to https://gist.github.com
2. Create new gist: `workflow-config.json`
3. Add content:

```json
{
  "temperature": 0.7,
  "max_tokens": 2048,
  "models": {
    "llm": "@cf/meta/llama-2-7b-chat-int8",
    "embedding": "@cf/baai/bge-base-en-v1.5"
  }
}
```

4. Copy the Gist ID from URL

### Step 4: Deploy to Cloudflare

```bash
npm run deploy
```

### Step 5: Test Your Deployment

```bash
curl https://ai-workflow-engine.YOUR_SUBDOMAIN.workers.dev/health

curl -X POST https://ai-workflow-engine.YOUR_SUBDOMAIN.workers.dev/api/workflow \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Explain the Heady project"}'
```

## 🔐 GitHub Actions Setup

### Add Secrets to GitHub

1. Go to repository Settings > Secrets and variables > Actions
2. Add:
   - `CLOUDFLARE_API_TOKEN` - Get from Cloudflare dashboard
   - `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

### Automatic Deployment

Now every push to `main` will automatically deploy!

## ✅ Verification

```bash
# Check health
curl https://ai-workflow-engine.YOUR_SUBDOMAIN.workers.dev/health

# Test AI workflow
curl -X POST https://ai-workflow-engine.YOUR_SUBDOMAIN.workers.dev/api/workflow \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is the Heady project?"}'  

# Test embeddings
curl -X POST https://ai-workflow-engine.YOUR_SUBDOMAIN.workers.dev/api/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "Heady AI Workflow Engine"}'
```

## 📄 Architecture Summary

```
User → Cloudflare Worker (Edge AI)
       ↓
   In-memory Cache
       ↓
   Workers AI (Llama-2)
       ↓  
   GitHub Gist (Config)
       ↓
   KV Storage (History)
```

## 🔗 Connected Resources

- **PostgreSQL**: `heady-postgres` (Render, Basic-1gb)
- **Redis**: `heady-redis` (Render, Standard-1gb)  
- **Workers AI**: Cloudflare edge network
- **Gist**: GitHub configuration storage
- **Actions**: Automated CI/CD

## 🎉 You're Done!

Your AI workflow engine is now live and connected to all Heady project resources!
