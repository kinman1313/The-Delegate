﻿// ChatInterface.tsx
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { downloadFile } from '../../services/apiService';

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

interface ChatInterfaceProps {
    messages: Message[];
    isLoading: boolean;
    onSendMessage: (message: string) => void;
    onClearChat: () => void;
    selectedModel: string;
    uploadedFiles?: UploadedFile[];
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
    messages,
    isLoading,
    onSendMessage,
    onClearChat,
    selectedModel,
    uploadedFiles = []
}) => {
    const [input, setInput] = useState<string>('');
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    // Auto scroll to bottom when new messages are added
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSubmit = (e: React.FormEvent): void => {
        e.preventDefault();
        if (input.trim() && !isLoading) {
            onSendMessage(input);
            setInput('');
        }
    };

    // Format the timestamp
    const formatTime = (timestamp: string): string => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Get model display name
    const getModelName = (modelId: string): string => {
        const modelMap: Record<string, string> = {
            'claude': 'Claude',
            'openai': 'ChatGPT',
            'gemini': 'Gemini',
            'deepseek': 'DeepSeek',
            'huggingface': 'Hugging Face'
        };
        return modelMap[modelId] || modelId;
    };

    // Handle file download
    const handleFileClick = (fileId: string, token?: string): void => {
        downloadFile(fileId, token);
    };

    // Render files section
    const renderFiles = (): JSX.Element | null => {
        if (!uploadedFiles || uploadedFiles.length === 0) {
            return null;
        }

        return (
            <div className="files-section">
                <h3>Uploaded Files</h3>
                <div className="file-list">
                    {uploadedFiles.map(file => (
                        <div
                            key={file._id}
                            className="file-item"
                            onClick={() => handleFileClick(file._id)}
                        >
                            <div className="file-icon">
                                {getFileIcon(file.mimetype)}
                            </div>
                            <div className="file-details">
                                <div className="file-name">{file.originalName}</div>
                                <div className="file-meta">
                                    {formatFileDate(file.uploadedAt)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Get icon based on file type
    const getFileIcon = (mimetype: string): string => {
        if (mimetype.includes('text/csv')) {
            return '📊';
        } else if (mimetype.includes('application/json')) {
            return '📋';
        } else if (mimetype.includes('text/plain')) {
            return '📝';
        } else if (mimetype.includes('application/pdf')) {
            return '📄';
        } else if (mimetype.includes('word')) {
            return '📃';
        } else if (mimetype.includes('spreadsheet') || mimetype.includes('excel')) {
            return '📈';
        } else {
            return '📎';
        }
    };

    // Format file date
    const formatFileDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString([], {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div className="chat-interface">
            <div className="chat-header">
                <h2>Chat with {getModelName(selectedModel)}</h2>
                <button onClick={onClearChat} className="clear-chat-btn">Clear Chat</button>
            </div>

            <div className="chat-container">
                {uploadedFiles.length > 0 && (
                    <div className="files-sidebar">
                        {renderFiles()}
                    </div>
                )}

                <div className="chat-messages">
                    {messages.length === 0 ? (
                        <div className="empty-chat">
                            <p>No messages yet. Start a conversation!</p>
                        </div>
                    ) : (
                        messages.map((message, index) => (
                            <div key={index} className={`message ${message.role}`}>
                                <div className="message-header">
                                    <span className="message-sender">
                                        {message.role === 'user' ? 'You' :
                                            message.role === 'system' ? 'System' :
                                                getModelName(message.model || selectedModel)}
                                    </span>
                                    {message.timestamp && (
                                        <span className="message-time">{formatTime(message.timestamp)}</span>
                                    )}
                                </div>
                                <div className="message-content">
                                    <ReactMarkdown>{message.content}</ReactMarkdown>
                                </div>
                            </div>
                        ))
                    )}
                    {isLoading && (
                        <div className="message assistant loading">
                            <div className="message-header">
                                <span className="message-sender">{getModelName(selectedModel)}</span>
                            </div>
                            <div className="message-content">
                                <div className="typing-indicator">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            <form onSubmit={handleSubmit} className="chat-input">
                <textarea
                    value={input}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
                    placeholder="Type your message here..."
                    disabled={isLoading}
                    onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit(e as unknown as React.FormEvent);
                        }
                    }}
                />
                <button type="submit" disabled={isLoading || !input.trim()}>
                    Send
                </button>
            </form>
        </div>
    );
};

export default ChatInterface;
