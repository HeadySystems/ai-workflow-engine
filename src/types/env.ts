/**
 * Environment bindings and variables for Cloudflare Workers
 */

export interface Env {
  // Workers AI binding
  AI: any;
  
  // KV namespace for configuration
  CONFIG: KVNamespace;
  
  // Secrets
  DATABASE_URL: string;  // PostgreSQL from Render
  REDIS_URL: string;      // Redis from Render
  GITHUB_TOKEN: string;   // GitHub Personal Access Token
  GIST_ID: string;        // GitHub Gist ID for configuration
  
  // Environment variables
  PROJECT_NAME: string;
  ENVIRONMENT: string;
  API_VERSION: string;
}

export interface WorkflowRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface WorkflowResponse {
  result: string;
  source: 'cache' | 'ai';
  model: string;
  timestamp: string;
}

export interface WorkflowData {
  prompt: string;
  result: string;
  model: string;
  timestamp: Date;
}
