#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read current config
const configPath = path.join(process.env.HOME, '.openclaw/openclaw.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Add Ollama auth profile
if (!config.auth) config.auth = {};
if (!config.auth.profiles) config.auth.profiles = {};

config.auth.profiles['ollama:default'] = {
  provider: 'ollama',
  mode: 'api_key'  // Ollama typically uses dummy API key
};

// Add Ollama provider
if (!config.models) config.models = {};
if (!config.models.providers) config.models.providers = {};

config.models.providers.ollama = {
  baseUrl: 'http://localhost:11434/v1',
  auth: 'api-key',
  api: 'openai-completions',
  models: [
    {
      id: 'qwen2.5:7b',
      name: 'Qwen2.5 7B',
      reasoning: false,
      input: ['text'],
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0
      },
      contextWindow: 128000,
      maxTokens: 8192
    },
    {
      id: 'qwen2.5:32b', 
      name: 'Qwen2.5 32B',
      reasoning: false,
      input: ['text'],
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0
      },
      contextWindow: 128000,
      maxTokens: 8192
    },
    {
      id: 'llama3:latest',
      name: 'Llama3 Latest',
      reasoning: false,
      input: ['text'],
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0
      },
      contextWindow: 8192,
      maxTokens: 4096
    }
  ]
};

// Add model aliases
if (!config.agents.defaults.models) config.agents.defaults.models = {};

config.agents.defaults.models['ollama/qwen2.5:7b'] = {
  alias: 'qwen7b'
};

config.agents.defaults.models['ollama/qwen2.5:32b'] = {
  alias: 'qwen32b'
};

config.agents.defaults.models['ollama/llama3:latest'] = {
  alias: 'llama3'
};

// Write updated config
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log('✅ Ollama support added to OpenClaw configuration');
console.log('📝 Run "openclaw gateway restart" to apply changes');