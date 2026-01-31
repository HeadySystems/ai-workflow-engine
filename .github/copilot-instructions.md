# AI Workflow Engine - GitHub Copilot Instructions

## Project Overview

This is an intelligent AI workflow engine that integrates multiple cloud services to create a scalable, edge-optimized data processing and AI model orchestration platform.

## Architecture Components

### 1. **Cloudflare Workers AI** (Edge Processing Layer)
- Use Workers AI for running machine learning models at the edge
- Implement AI Gateway for observability, caching, and model routing
- Leverage Vectorize (vector database) for semantic search and RAG patterns
- Use KV Storage for global configuration caching
- Models to integrate: Llama, embedding models, image classification

### 2. **Render Services** (Data Persistence Layer)
- **PostgreSQL**: Store workflow state, user data, audit logs, and relational data
- **Redis**: High-performance caching, session management, real-time data access
- Implement Redis Data Integration (RDI) for CDC pipeline from PostgreSQL to Redis
- External connection URLs stored securely in 1Password

### 3. **GitHub Gists** (Configuration Management)
- Store workflow configurations as version-controlled JSON files
- Maintain API endpoint mappings across environments (dev/staging/prod)
- Share AI prompt templates and model configurations
- Track environment-specific settings

### 4. **GitHub Actions** (CI/CD & Automation)
- Automated deployment to Render on git push
- Scheduled workflow orchestration for data processing
- AI model version management and updates
- Integration testing for AI responses and data pipelines

## Technical Requirements

### Code Style
- Use TypeScript for Cloudflare Workers
- Follow modern async/await patterns
- Implement proper error handling and logging
- Write unit tests for critical functions

### Data Flow Pattern
```
User Request → Cloudflare Worker (Edge)
     ↓
Workers AI (LLM/Embedding Processing)
     ↓
Redis Cache Check → PostgreSQL (if cache miss)
     ↓
GitHub Gist (Load Config/Prompts)
     ↓
Response → User
```

### Security
- Never hardcode credentials - use environment variables
- Store database URLs in 1Password with op:// references
- Implement rate limiting at edge
- Validate all inputs before processing
- Use HTTPS for all external connections

### Performance Optimization
- Cache AI responses in Redis with TTL
- Use streaming for long AI generations
- Implement connection pooling for PostgreSQL
- Leverage Cloudflare's global CDN for static assets

## Key Features to Implement

1. **AI Model Orchestration**
   - Dynamic model selection based on request type
   - Fallback mechanisms for model failures
   - Token usage tracking and cost optimization

2. **Real-time Data Sync**
   - PostgreSQL → Redis CDC pipeline
   - Webhook handlers for external events
   - Event-driven architecture

3. **Workflow Automation**
   - GitHub Actions workflows for deployment
   - Scheduled data processing jobs
   - Automated model performance monitoring

4. **Configuration Management**
   - Gist-based config with versioning
   - Environment-specific overrides
   - Hot-reload configuration updates

## Development Guidelines

- **Always check Redis cache first** before querying PostgreSQL
- **Stream AI responses** to improve perceived latency
- **Log all AI interactions** for debugging and analytics
- **Use TypeScript types** for all data structures
- **Write tests** for critical business logic
- **Document API endpoints** using OpenAPI/Swagger

## File Structure
```
/
├── .github/
│   ├── workflows/          # GitHub Actions CI/CD
│   └── copilot-instructions.md
├── src/
│   ├── workers/            # Cloudflare Workers code
│   ├── models/             # Data models and types
│   ├── services/           # Business logic
│   └── utils/              # Helper functions
├── config/                 # Configuration templates
├── tests/                  # Test files
└── docs/                   # Documentation
```

## Integration Checklist

- [ ] Set up Cloudflare Workers with Workers AI binding
- [ ] Configure PostgreSQL connection with connection pooling
- [ ] Set up Redis client with automatic reconnection
- [ ] Create GitHub Gists for configuration storage
- [ ] Implement GitHub Actions deployment workflow
- [ ] Add 1Password CLI integration for secrets
- [ ] Set up AI Gateway for model monitoring
- [ ] Implement RDI pipeline for PostgreSQL → Redis sync
- [ ] Add error tracking and logging
- [ ] Create API documentation

## Example Code Patterns

When generating code, follow these patterns:

### Cloudflare Worker Handler
```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // Check Redis cache
      const cached = await env.REDIS.get(cacheKey);
      if (cached) return new Response(cached);
      
      // Process with AI
      const result = await env.AI.run(model, { prompt });
      
      // Cache result
      await env.REDIS.set(cacheKey, result, { ex: 3600 });
      
      return new Response(result);
    } catch (error) {
      return new Response('Error', { status: 500 });
    }
  }
};
```

### Database Query with Caching
```typescript
async function getWorkflow(id: string): Promise<Workflow> {
  // Try Redis first
  const cached = await redis.get(`workflow:${id}`);
  if (cached) return JSON.parse(cached);
  
  // Query PostgreSQL
  const workflow = await db.query(
    'SELECT * FROM workflows WHERE id = $1',
    [id]
  );
  
  // Cache for 1 hour
  await redis.setex(
    `workflow:${id}`,
    3600,
    JSON.stringify(workflow)
  );
  
  return workflow;
}
```

## Deployment Strategy

1. **Development**: Push to `main` branch
2. **CI/CD**: GitHub Actions runs tests and deploys to Render
3. **Staging**: Test on Render preview environment
4. **Production**: Cloudflare Workers deployed via Wrangler
5. **Monitoring**: AI Gateway + custom logging

## Best Practices

- Use semantic versioning for releases
- Keep dependencies up to date
- Monitor AI model performance and costs
- Implement circuit breakers for external services
- Use feature flags for gradual rollouts
- Document all API changes
- Write migration scripts for database changes
