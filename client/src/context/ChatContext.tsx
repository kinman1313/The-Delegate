import { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { 
    getConversations, 
    createConversation, 
    addMessage, 
    callLLMApi 
} from '../services/apiService';
import { useAuth } from './AuthContext';

// Define types for messages, settings, and files
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  model?: string;
}

interface Settings {
  model: string;
  temperature: number;
  maxTokens: number;
}

interface UploadedFile {
  id: string;
  name: string;
  url: string;
}

interface Conversation {
  _id: string;
  title: string;
  messages: Message[];
  files?: UploadedFile[];
}

interface ChatContextType {
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Message[];
  isLoading: boolean;
  selectedModel: string;
  settings: Record<string, Settings>;
  uploadedFiles: UploadedFile[];
  setUploadedFiles: (files: UploadedFile[]) => void;
  setSettings: (settings: Record<string, Settings>) => void;
  setSelectedModel: (model: string) => void;
  loadConversation: (conversationId: string) => Promise<void>;
  newConversation: () => Promise<Conversation | undefined>;
  sendMessage: (content: string) => Promise<void>;
  clearChat: () => void;
  updateSettings: (provider: string, key: keyof Settings, value: any) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider = ({ children }: ChatProviderProps) => {
  const { token, isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('claude');
  const [settings, setSettings] = useState<Record<string, Settings>>({
    claude: { model: 'claude-3-opus-20240229', temperature: 0.7, maxTokens: 1000 },
    openai: { model: 'gpt-4', temperature: 0.7, maxTokens: 1000 },
    gemini: { model: 'gemini-1.0-pro', temperature: 0.7, maxTokens: 1000 },
    deepseek: { model: 'deepseek-chat', temperature: 0.7, maxTokens: 1000 },
    huggingface: { model: 'meta-llama/Llama-2-70b-chat-hf', temperature: 0.7, maxTokens: 1000 },
  });
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  // Load conversations when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
    } else {
      setConversations([]);
      setCurrentConversationId(null);
      setMessages([]);
    }
  }, [isAuthenticated, token]);

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

  const loadConversations = async () => {
    if (!token) return;

    try {
      const data = await getConversations(token);
      setConversations(data);

      // Select most recent conversation if none is selected
      if (data.length > 0 && !currentConversationId) {
        setCurrentConversationId(data[0]._id);
        await loadConversation(data[0]._id);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const loadConversation = async (conversationId: string) => {
    if (!token || !conversationId) return;

    try {
      const conversations = await getConversations(token);
      const conversation = conversations.find((conv: Conversation) => conv._id === conversationId);
      if (conversation) {
        if (!conversation.messages) {
          setMessages([]);
        } else {
          setMessages(conversation.messages);
        }
        setCurrentConversationId(conversationId);
        setUploadedFiles(conversation.files || []);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const newConversation = async (): Promise<Conversation | undefined> => {
    if (!token) return;

    try {
      const conversation = await createConversation(token, 'New Conversation');
      setConversations([conversation, ...conversations]);
      setCurrentConversationId(conversation._id);
      setMessages([]);
      setUploadedFiles([]);
      return conversation;
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    // If no conversation exists, create one
    if (!currentConversationId && isAuthenticated) {
      const conv = await newConversation();
      if (!conv) return;
    }

    // Add user message
    const userMessage: Message = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Save message if authenticated
    if (token && currentConversationId) {
      try {
        await addMessage(currentConversationId, token, userMessage);
      } catch (error) {
        console.error('Failed to save message:', error);
      }
    }

    try {
      // Call LLM API
      const response = await callLLMApi(
        selectedModel,
        [...messages, userMessage],
        settings[selectedModel],
        token || ''
      );

      // Add assistant response
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toISOString(),
        model: selectedModel,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Save assistant message if authenticated
      if (token && currentConversationId) {
        try {
          await addMessage(currentConversationId, token, assistantMessage);
        } catch (error) {
          console.error('Failed to save assistant message:', error);
        }
      }
    } catch (error: any) {
      console.error('Error calling LLM API:', error);

      // Add error message
      const errorMessage: Message = {
        role: 'system',
        content: `Error: ${error.message || 'Something went wrong'}`,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ChatContext.Provider
      value={{
        conversations,
        currentConversationId,
        messages,
        isLoading,
        selectedModel,
        settings,
        uploadedFiles,
        setUploadedFiles,
        setSettings,
        setSelectedModel,
        loadConversation,
        newConversation,
        sendMessage,
        clearChat: () => setMessages([]),
        updateSettings: (provider, key, value) => {
          setSettings((prev) => ({
            ...prev,
            [provider]: {
              ...prev[provider],
              [key]: value,
            },
          }));
        },
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

// Custom hook for using chat context
export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};