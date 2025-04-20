const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Interfaces for type safety
interface RegisterResponse {
  id: string;
  username: string;
  email: string;
}

interface LoginResponse {
  token: string;
}

interface ApiKey {
  id: string;
  provider: string;
  apiKey: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
}

interface Message {
  id: string;
  content: string;
  sender: string;
  timestamp: string;
}

interface VisualizationResponse {
  id: string;
  url: string;
}

interface ContextItem {
  id: string;
  type: string;
  data: any;
}

// Authentication services
export const register = async (
  username: string,
  email: string,
  password: string
): Promise<RegisterResponse> => {
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

export const login = async (
  email: string,
  password: string
): Promise<LoginResponse> => {
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
export const saveApiKey = async (
  token: string,
  provider: string,
  apiKey: string
): Promise<ApiKey> => {
  try {
    const response = await fetch(`${API_BASE_URL}/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
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

export const getApiKeys = async (token: string): Promise<ApiKey[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/keys`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
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

/**
 * Execute an agent request
 * @param request - User request to process
 * @param conversationId - Optional conversation ID
 * @param token - Authentication token
 * @returns Agent response
 */
export const executeAgentRequest = async (
  request: string,
  conversationId: string | undefined,
  token: string
): Promise<any> => {
  try {
    const response = await fetch(`${API_BASE_URL}/agent/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        request,
        conversationId,
        showThinking: true // Get intermediate steps
      })
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

/**
 * Get available tools for the agent
 * @param token - Authentication token
 * @returns List of available tools
 */
export const getAvailableTools = async (token: string): Promise<any[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/agent/tools`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch available tools');
    }

    return await response.json();
  } catch (error) {
    console.error('Get Available Tools Error:', error);
    throw error;
  }
};

/**
 * Get agent execution history
 * @param token - Authentication token
 * @param conversationId - Optional conversation ID to filter by
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
      
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch agent history');
    }

    return await response.json();
  } catch (error) {
    console.error('Get Agent History Error:', error);
    throw error;
  }
};

// Conversation services
export const getConversations = async (token: string): Promise<Conversation[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/conversations`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
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

export const getConversationById = async (
  conversationId: string,
  token: string
): Promise<Conversation> => {
  try {
    const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
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

export const createConversation = async (
  token: string,
  title: string = 'New Conversation',
  messages: Message[] = []
): Promise<Conversation> => {
  try {
    const response = await fetch(`${API_BASE_URL}/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
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

export const addMessage = async (
  conversationId: string,
  token: string,
  message: Message
): Promise<Message> => {
  try {
    const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
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
* Upload a file to the server
 * @param formData - FormData containing the file and metadata
 * @param token - Authentication token
 * @returns The uploaded file data
 */
export const uploadFile = async (formData: FormData, token: string): Promise<any> => {
  try {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.open('POST', `${API_BASE_URL}/files/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          // You can track progress here if needed
          const progress = Math.round((event.loaded / event.total) * 100);
          console.log(`Upload progress: ${progress}%`);
        }
      });
      
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (e) {
            reject(new Error('Invalid response format'));
          }
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText);
            reject(new Error(errorData.error || 'Upload failed'));
          } catch (e) {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      };
      
      xhr.onerror = function() {
        reject(new Error('Network error during file upload'));
      };
      
      xhr.send(formData);
    });
  } catch (error) {
    console.error('Upload File Error:', error);
    throw error;
  }
};

/**
 * Download a file from the server
 * @param fileId - ID of the file to download
 * @param token - Authentication token
 */
export const downloadFile = async (fileId: string, token?: string): Promise<void> => {
  try {
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Create a download link
    const response = await fetch(`${API_BASE_URL}/files/${fileId}/download`, { headers });
    
    if (!response.ok) {
      throw new Error('File download failed');
    }
    
    // Get the blob data
    const blob = await response.blob();
    
    // Get filename from the Content-Disposition header if available
    const contentDisposition = response.headers.get('Content-Disposition');
    const fileNameMatch = contentDisposition && contentDisposition.match(/filename="(.+?)"/);
    const fileName = fileNameMatch ? fileNameMatch[1] : `file-${fileId}`;
    
    // Create a download link and trigger download
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Download File Error:', error);
    throw error;
  }
};

/**
 * Get uploaded files for a conversation
 * @param conversationId - Conversation ID
 * @param token - Authentication token
 * @returns List of files for the conversation
 */
export const getConversationFiles = async (conversationId: string, token: string): Promise<any[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/files?conversationId=${conversationId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get files');
    }

    return await response.json();
  } catch (error) {
    console.error('Get Conversation Files Error:', error);
    throw error;
  }
};

/**
 * Process a document using the document processor
 * @param fileId - ID of the file to process
 * @param processingType - Type of processing to perform (e.g., 'summary', 'extraction')
 * @param options - Processing options
 * @param token - Authentication token
 * @returns Processing results
 */
export const processDocument = async (
  fileId: string, 
  processingType: string, 
  options: any = {},
  token: string
): Promise<any> => {
  try {
    const response = await fetch(`${API_BASE_URL}/files/${fileId}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        processingType,
        options
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Document processing failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Process Document Error:', error);
    throw error;
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
export const callLLMApi = async (
  provider: string,
  messages: Message[],
  settings: any,
  token: string
): Promise<any> => {
  if (!token) {
    throw new Error('Authentication required');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/chat/${provider}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages,
        settings,
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

// Add similar type annotations for the remaining functions...