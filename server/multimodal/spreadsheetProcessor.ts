import axios from 'axios';

// Add Node.js process type declaration
declare const process: {
  env: {
    CLAUDE_API_URL?: string;
    OPENAI_API_URL?: string;
    // Add other environment variables as needed
    [key: string]: string | undefined;
  }
};

interface Message {
  role: string;
  content: string;
}

interface LLMOptions {
  temperature?: number;
  model?: string;
  maxTokens?: number;
}

/**
 * Call an LLM API service
 * @param provider - LLM provider to use (e.g., 'claude', 'openai')
 * @param messages - Array of conversation messages
 * @param options - Configuration options for the LLM
 * @param token - Authentication token (optional)
 * @returns Response from the LLM
 */
export async function callLLMApi(
  provider: string,
  messages: Message[],
  options: LLMOptions = {},
  token?: string
): Promise<{ content: string }> {
  try {
    // Headers with optional auth token
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Configure endpoint based on provider
    let endpoint = '';
    let requestBody = {};
    
    switch (provider) {
      case 'claude':
        endpoint = process.env.CLAUDE_API_URL || 'https://api.anthropic.com/v1/messages';
        requestBody = {
          model: options.model || 'claude-3-opus-20240229',
          messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 1000,
        };
        break;
      case 'openai':
        endpoint = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';
        requestBody = {
          model: options.model || 'gpt-4',
          messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 1000,
        };
        break;
      // Add other providers as needed
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }

    // Make API request
    const response = await axios.post(endpoint, requestBody, { headers });
    
    // Extract content based on provider response structure
    let content = '';
    if (provider === 'claude') {
      content = response.data.content?.[0]?.text || '';
    } else if (provider === 'openai') {
      content = response.data.choices?.[0]?.message?.content || '';
    }

    return { content };
  } catch (error: any) {
    console.error(`Error calling ${provider} API:`, error.message);
    return { content: `Error: ${error.message}` };
  }
}
