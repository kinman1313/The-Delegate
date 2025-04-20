// src/views/ChatView.tsx
import React from 'react';
import ChatInterface from '../components/ChatInterface';
import FileUpload from '../components/FileUpload';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
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

interface ChatViewProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onClearChat: () => void;
  selectedModel: string;
  uploadedFiles: UploadedFile[];
  showFileUpload: boolean;
  conversationId: string | null;
  onFileUploaded: (fileData: FileUploadResult) => void;
  onCancelFileUpload: () => void;
}

const ChatView: React.FC<ChatViewProps> = ({
  messages,
  isLoading,
  onSendMessage,
  onClearChat,
  selectedModel,
  uploadedFiles,
  showFileUpload,
  conversationId,
  onFileUploaded,
  onCancelFileUpload
}) => {
  return (
    <div className="chat-view">
      {showFileUpload && (
        <FileUpload
          conversationId={conversationId}
          token={localStorage.getItem('token')}
          onFileUploaded={onFileUploaded}
          onCancel={onCancelFileUpload}
        />
      )}
      
      <ChatInterface
        messages={messages}
        isLoading={isLoading}
        onSendMessage={onSendMessage}
        onClearChat={onClearChat}
        selectedModel={selectedModel}
        uploadedFiles={uploadedFiles}
      />
    </div>
  );
};

export default ChatView;