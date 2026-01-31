/**
 * AI Workflow Engine - Main Cloudflare Worker
 * Integrates Workers AI, PostgreSQL, Redis, and GitHub Gists
 */

import type { Env, WorkflowRequest, WorkflowResponse } from './types/env';

// Simple in-memory cache for development
const cache = new Map<string, { value: string; expiry: number }>();

function getCached(key: string): string | null {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function setCache(key: string, value: string, ttl: number): void {
  cache.set(key, { value, expiry: Date.now() + (ttl * 1000) });
}

// Fetch configuration from GitHub Gist
async function getGistConfig(gistId: string, token: string): Promise<any> {
  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AI-Workflow-Engine'
      }
    });
    
    if (!response.ok) {
      console.error('Failed to fetch gist:', response.status);
      return {};
    }
    
    const gist = await response.json();
    const file = Object.values(gist.files)[0] as any;
    return JSON.parse(file.content);
  } catch (error) {
    console.error('Error fetching gist config:', error);
    return {};
  }
}

// Main worker export
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check endpoint
    if (url.pathname === '/health' || url.pathname === '/') {
      return new Response(JSON.stringify({
        status: 'healthy',
        project: env.PROJECT_NAME || 'Heady AI Workflow Engine',
        environment: env.ENVIRONMENT || 'production',
        version: env.API_VERSION || 'v1',
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AI Workflow endpoint
    if (url.pathname === '/api/workflow' && request.method === 'POST') {
      try {
        const body: WorkflowRequest = await request.json();
        const { 
          prompt, 
          model = '@cf/meta/llama-2-7b-chat-int8',
          temperature = 0.7,
          max_tokens = 2048
        } = body;

        if (!prompt) {
          return new Response(JSON.stringify({ error: 'Prompt is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check cache first
        const cacheKey = `ai:${model}:${prompt.substring(0, 50)}`;
        const cached = getCached(cacheKey);
        
        if (cached) {
          const response: WorkflowResponse = {
            result: cached,
            source: 'cache',
            model,
            timestamp: new Date().toISOString()
          };
          return new Response(JSON.stringify(response), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Load configuration from Gist if available
        let config = {};
        if (env.GIST_ID && env.GITHUB_TOKEN) {
          config = await getGistConfig(env.GIST_ID, env.GITHUB_TOKEN);
        }

        // Run AI model
        const aiResponse = await env.AI.run(model, {
          prompt,
          temperature,
          max_tokens,
          ...config
        });

        const result = aiResponse.response || JSON.stringify(aiResponse);

        // Cache the result
        setCache(cacheKey, result, 3600); // 1 hour TTL

        // Store in KV if available
        if (env.CONFIG) {
          try {
            await env.CONFIG.put(
              `workflow:${Date.now()}`,
              JSON.stringify({ prompt, result, model, timestamp: new Date() }),
              { expirationTtl: 86400 } // 24 hours
            );
          } catch (e) {
            console.error('KV storage error:', e);
          }
        }

        const response: WorkflowResponse = {
          result,
          source: 'ai',
          model,
          timestamp: new Date().toISOString()
        };

        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error: any) {
        console.error('Workflow error:', error);
        return new Response(JSON.stringify({ 
          error: error.message || 'Internal server error',
          timestamp: new Date().toISOString()
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Embedding endpoint
    if (url.pathname === '/api/embed' && request.method === 'POST') {
      try {
        const { text } = await request.json();
        
        if (!text) {
          return new Response(JSON.stringify({ error: 'Text is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const embeddings = await env.AI.run(
          '@cf/baai/bge-base-en-v1.5',
          { text }
        );

        return new Response(JSON.stringify({
          embeddings: embeddings.data[0],
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 404 for unknown routes
    return new Response(JSON.stringify({ 
      error: 'Not found',
      available_endpoints: ['/health', '/api/workflow', '/api/embed']
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  },
};
