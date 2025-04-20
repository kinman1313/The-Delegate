// src/contexts/AppContext.tsx
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { getConversations, createConversation, getConversationById } from '../services/apiService';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  model?: string;
}

interface Conversation {
  _id: string;
  title: string;
  messages: Message[];
  updatedAt: string;
}

interface UploadedFile {
  _id: string;
  originalName: string;
  mimetype: string;
  uploadedAt: string;
}

interface ModelSettings {
  model: string;
  temperature: number;
  maxTokens: number;
}

interface Settings {
  [provider: string]: ModelSettings;
}

interface AppContextType {
  // Auth state
  isAuthenticated: boolean;
  token: string | null;
  user: any | null;
  login: (userData: any, authToken: string) => void;
  logout: () => void;
  
  // Conversation state
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Message[];
  loadConversation: (id: string) => Promise<void>;
  createNewConversation: () => Promise<void>;
  
  // Model state
  selectedModel: string;
  settings: Settings;
  setSelectedModel: (model: string) => void;
  updateSettings: (provider: string, key: string, value: any) => void;
  
  // UI state
  isLoading: boolean;
  showSettings: boolean;
  showFileUpload: boolean;
  uploadedFiles: UploadedFile[];
  toggleSettings: () => void;
  toggleFileUpload: () => void;
  handleFileUploaded: (file: any) => void;
  
  // Message handling
  sendMessage: (content: string) => Promise<void>;
  clearChat: () => void;
}

// Create the context
export const AppContext = createContext<AppContextType | null>(null);

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  
  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  
  // Model state
  const [selectedModel, setSelectedModel] = useState<string>('claude');
  const [settings, setSettings] = useState<Settings>({
    claude: { model: 'claude-3-opus-20240229', temperature: 0.7, maxTokens: 1000 },
    openai: { model: 'gpt-4', temperature: 0.7, maxTokens: 1000 },
    gemini: { model: 'gemini-1.0-pro', temperature: 0.7, maxTokens: 1000 },
    deepseek: { model: 'deepseek-chat', temperature: 0.7, maxTokens: 1000 },
    huggingface: { model: 'meta-llama/Llama-2-70b-chat-hf', temperature: 0.7, maxTokens: 1000 }
  });
  
  // UI state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showFileUpload, setShowFileUpload] = useState<boolean>(false);
  
  // Check authentication on load
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      setIsAuthenticated(true);

      // Load conversations
      loadConversations(savedToken);
    }
  }, []);

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('llmSettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem('llmSettings', JSON.stringify(settings));
  }, [settings]);
  
  // Auth functions
  const login = (userData: any, authToken: string) => {
    setUser(userData);
    setToken(authToken);
    setIsAuthenticated(true);

    // Save to localStorage
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));

    // Load user's conversations
    loadConversations(authToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    setCurrentConversationId(null);
    setMessages([]);
    setConversations([]);

    // Clear from localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };
  
  // Conversation functions
  const loadConversations = async (authToken: string) => {
    try {
      const conversationsData = await getConversations(authToken);
      setConversations(conversationsData);

      // If there are conversations but none selected, select the most recent one
      if (conversationsData.length > 0 && !currentConversationId) {
        setCurrentConversationId(conversationsData[0]._id);
        await loadConversation(conversationsData[0]._id);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const loadConversation = async (id: string) => {
    try {
      if (!token) return;
      
      const { conversation, files } = await getConversationById(id, token);
      setMessages(conversation.messages);
      setCurrentConversationId(id);
      setUploadedFiles(files || []);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const createNewConversation = async () => {
    try {
      if (!token) return;

      const newConversation = await createConversation(token, "New Conversation");
      setConversations([newConversation, ...conversations]);
      setCurrentConversationId(newConversation._id);
      setMessages([]);
      setUploadedFiles([]);
    } catch (error) {
      console.error('Failed to create new conversation:', error);
    }
  };
  
  // Settings functions
  const updateSettings = (provider: string, key: string, value: any) => {
    setSettings({
      ...settings,
      [provider]: {
        ...settings[provider],
        [key]: value
      }
    });
  };
  
  // UI functions
  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };
  
  const toggleFileUpload = () => {
    setShowFileUpload(!showFileUpload);
  };
  
  const handleFileUploaded = (file: any) => {
    setUploadedFiles([...uploadedFiles, file]);
    setShowFileUpload(false);

    // Add a system message about the uploaded file
    const fileMessage = {
      role: 'system',
      content: `File uploaded: ${file.filename || file.originalName}`,
      timestamp: new Date().toISOString()
    };

    setMessages([...messages, fileMessage]);

    // If in a conversation, save the message
    if (token && currentConversationId) {
      import('../services/apiService').then(({ addMessage }) => {
        addMessage(currentConversationId, token as string, fileMessage);
      });
    }
  };
  
  // Message functions
  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    // If no conversation exists, create one
    if (!currentConversationId && isAuthenticated && token) {
      try {
        const newConversation = await createConversation(token, "New Conversation");
        setConversations([newConversation, ...conversations]);
        setCurrentConversationId(newConversation._id);
      } catch (error) {
        console.error('Failed to create new conversation:', error);
        return;
      }
    }

    // Add user message to chat
    const userMessage = {
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    // If authenticated, save the message to the backend
    if (isAuthenticated && currentConversationId && token) {
      try {
        const { addMessage } = await import('../services/apiService');
        await addMessage(currentConversationId, token, userMessage);
      } catch (error) {
        console.error('Failed to save message:', error);
      }
    }

    setIsLoading(true);

    try {
      // Call the LLM API through the backend
      const { callLLMApi } = await import('../services/apiService');
      const response = await callLLMApi(
        selectedModel,
        updatedMessages,
        settings[selectedModel],
        token
      );

      // Add assistant response to chat
      const assistantMessage = {
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toISOString(),
        model: selectedModel
      };

      setMessages([...updatedMessages, assistantMessage]);

      // If authenticated, save the assistant message to the backend
      if (isAuthenticated && currentConversationId && token) {
        try {
          const { addMessage } = await import('../services/apiService');
          await addMessage(currentConversationId, token, assistantMessage);
        } catch (error) {
          console.error('Failed to save assistant message:', error);
        }
      }
    } catch (error: any) {
      // Handle API errors
      const errorMessage = {
        role: 'system',
        content: `Error: ${error.message || 'Something went wrong'}`,
        timestamp: new Date().toISOString()
      };

      setMessages([...updatedMessages, errorMessage]);

      if (isAuthenticated && currentConversationId && token) {
        try {
          const { addMessage } = await import('../services/apiService');
          await addMessage(currentConversationId, token, errorMessage);
        } catch (saveError) {
          console.error('Failed to save error message:', saveError);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const clearChat = () => {
    setMessages([]);
  };
  
  // Provide context
  return (
    <AppContext.Provider
      value={{
        // Auth state
        isAuthenticated,
        token,
        user,
        login,
        logout,
        
        // Conversation state
        conversations,
        currentConversationId,
        messages,
        loadConversation,
        createNewConversation,
        
        // Model state
        selectedModel,
        settings,
        setSelectedModel,
        updateSettings,
        
        // UI state
        isLoading,
        showSettings,
        showFileUpload,
        uploadedFiles,
        toggleSettings,
        toggleFileUpload,
        handleFileUploaded,
        
        // Message handling
        sendMessage,
        clearChat
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

// Custom hook for using the app context
export const useApp = () => {
  const context = React.useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};