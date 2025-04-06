// services/apiService.js
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Authentication services
export const register = async (username, email, password) => {
  try {
    const response = await fetch(`${API_BASE_URL}/users/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Registration failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Register Error:', error);
    throw error;
  }
};

export const login = async (email, password) => {
  try {
    const response = await fetch(`${API_BASE_URL}/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Login failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Login Error:', error);
    throw error;
  }
};

// API Key management
export const saveApiKey = async (token, provider, apiKey) => {
  try {
    const response = await fetch(`${API_BASE_URL}/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ provider, apiKey }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to save API key');
    }

    return await response.json();
  } catch (error) {
    console.error('Save API Key Error:', error);
    throw error;
  }
};

export const getApiKeys = async (token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/keys`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get API keys');
    }

    return await response.json();
  } catch (error) {
    console.error('Get API Keys Error:', error);
    throw error;
  }
};

// Conversation services
export const getConversations = async (token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/conversations`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch conversations');
    }

    return await response.json();
  } catch (error) {
    console.error('Get Conversations Error:', error);
    throw error;
  }
};

export const getConversationById = async (conversationId, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch conversation');
    }

    return await response.json();
  } catch (error) {
    console.error('Get Conversation Error:', error);
    throw error;
  }
};

export const createConversation = async (token, title = 'New Conversation', messages = []) => {
  try {
    const response = await fetch(`${API_BASE_URL}/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ title, messages }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create conversation');
    }

    return await response.json();
  } catch (error) {
    console.error('Create Conversation Error:', error);
    throw error;
  }
};

export const addMessage = async (conversationId, token, message) => {
  try {
    const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to add message');
    }

    return await response.json();
  } catch (error) {
    console.error('Add Message Error:', error);
    throw error;
  }
};

// File upload services
export const uploadFile = async (formData, token) => {
  try {
    // Use XMLHttpRequest for progress monitoring
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.open('POST', `${API_BASE_URL}/files/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText);
            reject(new Error(errorData.error || 'File upload failed'));
          } catch (e) {
            reject(new Error('File upload failed'));
          }
        }
      };
      
      xhr.onerror = () => {
        reject(new Error('Network error during file upload'));
      };
      
      xhr.send(formData);
    });
  } catch (error) {
    console.error('Upload File Error:', error);
    throw error;
  }
};

// LLM API calls
export const callLLMApi = async (provider, messages, settings, token) => {
  if (!token) {
    throw new Error('Authentication required');
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/chat/${provider}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages,
        settings
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error calling ${provider} API`);
    }

    return await response.json();
  } catch (error) {
    console.error(`${provider} API Error:`, error);
    throw error;
  }
};

// Agent API calls
export const sendAgentRequest = async (userRequest, conversationId, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/agent/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        request: userRequest,
        conversationId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to process agent request');
    }

    return await response.json();
  } catch (error) {
    console.error('Agent Request Error:', error);
    throw error;
  }
};

export const getAvailableAgentTools = async (token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/agent/tools`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get available tools');
    }

    return await response.json();
  } catch (error) {
    console.error('Get Agent Tools Error:', error);
    throw error;
  }
};

// Multi-modal context API calls
export const getContextItems = async (conversationId, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/context?conversationId=${conversationId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get context items');
    }

    return await response.json();
  } catch (error) {
    console.error('Get Context Items Error:', error);
    throw error;
  }
};

export const createContextReference = async (contextRef, selector, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/context/reference`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        contextRef,
        selector,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create context reference');
    }

    return await response.json();
  } catch (error) {
    console.error('Create Context Reference Error:', error);
    throw error;
  }
};

export const generateVisualization = async (dataContextRef, visualizationType, options, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/visualizations/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        dataContextRef,
        visualizationType,
        options,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate visualization');
    }

    return await response.json();
  } catch (error) {
    console.error('Generate Visualization Error:', error);
    throw error;
  }
};
