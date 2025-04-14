// src/components/layout/MainContent.tsx
import React from 'react';
import ChatInterface from '../chat/ChatInterface';
import FileUpload from '../multimodal/FileUpload';
import AgentInterface from '../agent/AgentInterface';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: string;
    model?: string;
}

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

interface MainContentProps {
    activeInterface?: 'chat' | 'agent';
    messages: Message[];
    isLoading: boolean;
    onSendMessage: (message: string) => void;
    onClearChat: () => void;
    selectedModel: string;
    uploadedFiles: UploadedFile[];
    showFileUpload: boolean;
    conversationId: string | null;
    token: string | null;
    onFileUploaded: (fileData: FileUploadResult) => void;
    onCancelFileUpload: () => void;
}

const MainContent: React.FC<MainContentProps> = ({
    activeInterface = 'chat', // 'chat' or 'agent'
    messages,
    isLoading,
    onSendMessage,
    onClearChat,
    selectedModel,
    uploadedFiles,
    showFileUpload,
    conversationId,
    token,
    onFileUploaded,
    onCancelFileUpload
}) => {
    return (
        <div className= "main-content" >
        { showFileUpload && (
            <FileUpload 
            conversationId={ conversationId }
    token = { token }
    onFileUploaded = { onFileUploaded }
    onCancel = { onCancelFileUpload }
        />
)}

{
    activeInterface === 'chat' ? (
            <ChatInterface 
                messages= { messages } 
        isLoading = { isLoading }
    onSendMessage = { onSendMessage }
    onClearChat = { onClearChat }
    selectedModel = { selectedModel }
    uploadedFiles = { uploadedFiles }
        />
) : (
    <AgentInterface 
        conversationId= { conversationId }
            />
        )
}
</div>
);
};

export default MainContent;