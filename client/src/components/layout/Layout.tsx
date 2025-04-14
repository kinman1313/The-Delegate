// src/components/layout/Layout.tsx
import React, { ReactNode } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import MainContent from './MainContent';

// Message Interface
interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: string;
    model?: string;
}

// Conversation Interface
interface Conversation {
    _id: string;
    title: string;
    updatedAt: string;
    summary?: string;
}

// Settings Interface
interface ModelSettings {
    apiKey?: string;
    model?: string;
    temperature: number;
    maxTokens: number;
}

interface Settings {
    [model: string]: ModelSettings;
}

// File Interfaces
interface UploadedFile {
    _id: string;
    originalName: string;
    mimetype: string;
    uploadedAt: string;
}

interface FileUploadResult {
    fileId: string;
    filename: string;
    reference: string;
    type: string;
}

interface LayoutProps {
    // Header props
    onNewChat: () => void;
    onToggleFileUpload: () => void;
    onToggleSettings: () => void;
    onLogout: () => void;
    showSettings: boolean;

    // Sidebar props
    selectedModel: string;
    onModelChange: (modelId: string) => void;
    conversations: Conversation[];
    currentConversationId: string | null;
    onSelectConversation: (conversationId: string) => void;
    settings: Settings;
    onSettingsChange: (provider: string, key: string, value: any) => void;
    token: string | null;

    // Main content props
    activeInterface?: 'chat' | 'agent';
    messages: Message[];
    isLoading: boolean;
    onSendMessage: (message: string) => void;
    onClearChat: () => void;
    uploadedFiles: UploadedFile[];
    showFileUpload: boolean;
    conversationId: string | null;
    onFileUploaded: (fileData: FileUploadResult) => void;
    onCancelFileUpload: () => void;

    // Other props
    children?: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({
    // Header props
    onNewChat,
    onToggleFileUpload,
    onToggleSettings,
    onLogout,
    showSettings,

    // Sidebar props
    selectedModel,
    onModelChange,
    conversations,
    currentConversationId,
    onSelectConversation,
    settings,
    onSettingsChange,
    token,

    // Main content props
    activeInterface,
    messages,
    isLoading,
    onSendMessage,
    onClearChat,
    uploadedFiles,
    showFileUpload,
    conversationId,
    onFileUploaded,
    onCancelFileUpload,

    children
}) => {
    return (
        <div className="app">
        <Header 
        onNewChat={ onNewChat }
    onToggleFileUpload = { onToggleFileUpload }
    onToggleSettings = { onToggleSettings }
    onLogout = { onLogout }
    showSettings = { showSettings }
        />

        <div className="app-container">
            <Sidebar 
          selectedModel={ selectedModel }
    onModelChange = { onModelChange }
    conversations = { conversations }
    currentConversationId = { currentConversationId }
    onSelectConversation = { onSelectConversation }
    settings = { settings }
    onSettingsChange = { onSettingsChange }
    showSettings = { showSettings }
    token = { token }
        />

        <MainContent 
          activeInterface={ activeInterface }
    messages = { messages }
    isLoading = { isLoading }
    onSendMessage = { onSendMessage }
    onClearChat = { onClearChat }
    selectedModel = { selectedModel }
    uploadedFiles = { uploadedFiles }
    showFileUpload = { showFileUpload }
    conversationId = { conversationId }
    token = { token }
    onFileUploaded = { onFileUploaded }
    onCancelFileUpload = { onCancelFileUpload }
        />

        { children }
        </div>
        </div>
  );
};

export default Layout;
