// src/services/agentService.ts
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

interface LLMModel {
  id: string;
  name: string;
  provider: string;
  capabilities: string[];
}

interface Tool {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
}

interface AgentStep {
  task: string;
  type: string;
  model?: {
    provider: string;
    model: string;
  };
  reasoning?: string;
  tools?: string[];
  result?: any;
}

interface AgentResponse {
  response: string;
  executionPath: {
    steps: AgentStep[];
  };
  modelUsed: string;
  reasoning?: string[];
}

/**
 * Execute an agent request
 * @param request User request to process
 * @param conversationId Optional conversation ID
 * @param token Authentication token
 * @returns Agent response
 */
export const executeAgentRequest = async (
  request: string,
  conversationId: string | undefined,
  token: string
): Promise<AgentResponse> => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/agent/execute`,
      {
        request,
        conversationId,
        showThinking: true, // Get intermediate steps
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Error executing agent request:', error);
    throw new Error(error.response?.data?.error || 'Failed to process request');
  }
};

/**
 * Get available models for the agent
 * @param token Authentication token
 * @returns List of available models
 */
export const getAvailableModels = async (token: string): Promise<LLMModel[]> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/agent/models`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error: any) {
    console.error('Error fetching available models:', error);
    throw new Error(error.response?.data?.error || 'Failed to fetch models');
  }
};

/**
 * Get available tools for the agent
 * @param token Authentication token
 * @returns List of available tools
 */
export const getAvailableTools = async (token: string): Promise<Tool[]> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/agent/tools`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error: any) {
    console.error('Error fetching available tools:', error);
    throw new Error(error.response?.data?.error || 'Failed to fetch tools');
  }
};

/**
 * Get agent execution history
 * @param token Authentication token
 * @param conversationId Optional conversation ID to filter by
 * @returns Agent execution history
 */
export const getAgentHistory = async (
  token: string,
  conversationId?: string
): Promise<any[]> => {
  try {
    const url = conversationId
      ? `${API_BASE_URL}/agent/history?conversationId=${conversationId}`
      : `${API_BASE_URL}/agent/history`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error: any) {
    console.error('Error fetching agent history:', error);
    throw new Error(error.response?.data?.error || 'Failed to fetch agent history');
  }
};

export default {
  executeAgentRequest,
  getAvailableModels,
  getAvailableTools,
  getAgentHistory,
};