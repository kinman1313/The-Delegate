import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { getConversations, addMessage, callLLMApi } from '../services/apiService';
// Import FileUploader without trying to import the non-existent type
import FileUploader from '../components/multimodal/FileUploader';

// This is our local interface definition
interface LocalFileUploadResult {
  reference: string;
  type: string;
  filename: string;
  fileId: string;
  _id?: string;
  originalName?: string;
  mimetype?: string;
  uploadedAt?: string;
  url?: string;
}

interface Message {
  role: 'user' | 'assistant';
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
  _id: string;
  originalName: string;
  mimetype: string;
  uploadedAt: string;
}

interface Conversation {
  id: string;
  _id: string;
  title: string;
  updatedAt: string;
  messages: Message[];
  files?: UploadedFile[];
}

function Chat() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showFileUpload, setShowFileUpload] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('claude');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [settings, setSettings] = useState<Record<string, Settings>>({
    claude: { model: 'claude-3-opus-20240229', temperature: 0.7, maxTokens: 1000 },
    openai: { model: 'gpt-4', temperature: 0.7, maxTokens: 1000 },
    gemini: { model: 'gemini-1.0-pro', temperature: 0.7, maxTokens: 1000 },
    deepseek: { model: 'deepseek-chat', temperature: 0.7, maxTokens: 1000 },
    huggingface: { model: 'meta-llama/Llama-2-70b-chat-hf', temperature: 0.7, maxTokens: 1000 },
  });
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  // Token would be retrieved from your auth context or localStorage
  const token = localStorage.getItem('token') || '';

  // Load conversation when conversationId changes
  useEffect(() => {
    if (conversationId) {
      loadConversation(conversationId);
    }
  }, [conversationId]);

  const loadConversation = async (id: string) => {
    try {
      const conversations = await getConversations(token);
      const conversation = conversations.find((conv: Conversation) => conv.id === id);
      if (conversation) {
        setMessages(conversation.messages);
        setUploadedFiles(conversation.files || []);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  // Handler functions
  const handleSendMessage = async (content: string) => {
    setIsLoading(true);

    try {
      // Add user message
      const userMessage: Message = { role: 'user', content, timestamp: new Date().toISOString() };
      setMessages((prev) => [...prev, userMessage]);

      // Call LLM API
      const response = await callLLMApi(
        selectedModel,
        [...messages, userMessage],
        settings[selectedModel],
        token
      );

      // Add assistant response
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.content,
          timestamp: new Date().toISOString(),
          model: selectedModel,
        },
      ]);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNewConversation = () => {
    // New conversation logic
  };

  const handleToggleFileUpload = () => {
    setShowFileUpload(!showFileUpload);
  };

  const handleToggleSettings = () => {
    setShowSettings(!showSettings);
  };

  const handleLogout = () => {
    // Logout logic
    localStorage.removeItem('token');
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
  };

  const handleFileUploaded = (fileData: LocalFileUploadResult) => {
    // Map from FileUploader's result to our local structure
    const uploadedFile: UploadedFile = {
      id: fileData.fileId,
      _id: fileData._id || fileData.fileId, // Use _id if available, otherwise fileId
      name: fileData.filename,
      originalName: fileData.originalName || fileData.filename, // Use originalName if available
      mimetype: fileData.mimetype || fileData.type, // Use mimetype if available
      uploadedAt: fileData.uploadedAt || new Date().toISOString(), // Use uploadedAt if available
      url: fileData.url || fileData.reference // Use url if available, otherwise reference
    };
    setUploadedFiles((prev) => [...prev, uploadedFile]);
    setShowFileUpload(false);
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const handleSettingsChange = (provider: string, key: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [key]: value,
      },
    }));
  };

  return (
    <Layout
      // Header props
      onNewChat={handleCreateNewConversation}
      onToggleFileUpload={handleToggleFileUpload}
      onToggleSettings={handleToggleSettings}
      onLogout={handleLogout}
      showSettings={showSettings}
      
      // Sidebar props
      selectedModel={selectedModel}
      onModelChange={handleModelChange}
      conversations={conversations}
      conversationId={conversationId ?? null}
      onSelectConversation={(id) => loadConversation(id)}
      settings={settings}
      onSettingsChange={handleSettingsChange}
      token={token}
      
      // Main content props
      activeInterface="chat"
      messages={messages}
      isLoading={isLoading}
      onSendMessage={handleSendMessage}
      onClearChat={handleClearChat}
      uploadedFiles={uploadedFiles}
      showFileUpload={showFileUpload}
      
      // Missing required props
      currentConversationId={conversationId ?? null}
      onFileUploaded={handleFileUploaded}
      onCancelFileUpload={() => setShowFileUpload(false)}
    />
  );
}

export default Chat;