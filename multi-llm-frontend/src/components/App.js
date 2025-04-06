// App.js - Main application component

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import ModelSelector from './components/ModelSelector';
import ChatInterface from './components/ChatInterface';
import SettingsPanel from './components/SettingsPanel';
import SidebarConversations from './components/SidebarConversations';
import Login from './components/Login';
import Register from './components/Register';
import FileUpload from './components/FileUpload';
import { callLLMApi, getConversations, createConversation, getConversation, addMessage } from './services/apiService';

function App() {
  const [selectedModel, setSelectedModel] = useState('claude');
  const [settings, setSettings] = useState({
    claude: { model: 'claude-3-opus-20240229', temperature: 0.7, maxTokens: 1000 },
    openai: { model: 'gpt-4', temperature: 0.7, maxTokens: 1000 },
    gemini: { model: 'gemini-1.0-pro', temperature: 0.7, maxTokens: 1000 },
    deepseek: { model: 'deepseek-chat', temperature: 0.7, maxTokens: 1000 },
    huggingface: { model: 'meta-llama/Llama-2-70b-chat-hf', temperature: 0.7, maxTokens: 1000 }
  });
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);

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
  
  // Load conversations for authenticated user
  const loadConversations = async (authToken) => {
    try {
      const conversationsData = await getConversations(authToken);
      setConversations(conversationsData);
      
      // If there are conversations but none selected, select the most recent one
      if (conversationsData.length > 0 && !currentConversationId) {
        setCurrentConversationId(conversationsData[0]._id);
        loadConversation(conversationsData[0]._id, authToken);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };
  
  // Load a specific conversation
  const loadConversation = async (conversationId, authToken) => {
    try {
      const { conversation, files } = await getConversation(conversationId, authToken || token);
      setMessages(conversation.messages);
      setCurrentConversationId(conversationId);
      setUploadedFiles(files || []);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const handleModelChange = (model) => {
    setSelectedModel(model);
  };

  const handleSettingsChange = (provider, key, value) => {
    setSettings({
      ...settings,
      [provider]: {
        ...settings[provider],
        [key]: value
      }
    });
  };
  
  const handleLogin = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setIsAuthenticated(true);
    
    // Save to localStorage
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    
    // Load user's conversations
    loadConversations(authToken);
  };
  
  const handleLogout = () => {
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
  
  const createNewConversation = async () => {
    try {
      const newConversation = await createConversation(token, "New Conversation");
      setConversations([newConversation, ...conversations]);
      setCurrentConversationId(newConversation._id);
      setMessages([]);
      setUploadedFiles([]);
    } catch (error) {
      console.error('Failed to create new conversation:', error);
    }
  };
  
  const toggleFileUpload = () => {
    setShowFileUpload(!showFileUpload);
  };

  const sendMessage = async (content) => {
    if (!content.trim()) return;
    
    // If no conversation exists, create one
    if (!currentConversationId && isAuthenticated) {
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
    if (isAuthenticated && currentConversationId) {
      try {
        await addMessage(currentConversationId, token, userMessage);
      } catch (error) {
        console.error('Failed to save message:', error);
      }
    }
    
    setIsLoading(true);
    
    try {
      // Call the LLM API through the backend
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
      if (isAuthenticated && currentConversationId) {
        try {
          await addMessage(currentConversationId, token, assistantMessage);
        } catch (error) {
          console.error('Failed to save assistant message:', error);
        }
      }
    } catch (error) {
      // Handle API errors
      const errorMessage = { 
        role: 'system', 
        content: `Error: ${error.message}`, 
        timestamp: new Date().toISOString() 
      };
      
      setMessages([...updatedMessages, errorMessage]);
      
      if (isAuthenticated && currentConversationId) {
        try {
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
    if (isAuthenticated && currentConversationId) {
      // Only clear the UI, but keep the conversation in the database
      setMessages([]);
    } else {
      setMessages([]);
    }
  };

  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };
  
  const handleFileUpload = (file) => {
    setUploadedFiles([...uploadedFiles, file]);
    setShowFileUpload(false);
    
    // Add a system message about the uploaded file
    const fileMessage = {
      role: 'system',
      content: `File uploaded: ${file.filename}`,
      timestamp: new Date().toISOString()
    };
    
    setMessages([...messages, fileMessage]);
    
    if (isAuthenticated && currentConversationId) {
      addMessage(currentConversationId, token, fileMessage);
    }
  };

  // If not authenticated, show login/register
  if (!isAuthenticated) {
    return (
      <Router>
        <div className="auth-container">
          <Routes>
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="/register" element={<Register onRegister={handleLogin} />} />
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        </div>
      </Router>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Multi-LLM Chat Interface</h1>
        <div className="header-controls">
          <button onClick={createNewConversation} className="new-chat-btn">
            New Chat
          </button>
          <button onClick={toggleFileUpload} className="upload-btn">
            Upload File
          </button>
          <button onClick={toggleSettings}>
            {showSettings ? 'Close Settings' : 'Settings'}
          </button>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>
      
      <div className="app-container">
        <div className="sidebar">
          <ModelSelector 
            selectedModel={selectedModel} 
            onModelChange={handleModelChange} 
          />
          
          <SidebarConversations
            conversations={conversations}
            currentConversationId={currentConversationId}
            onSelectConversation={(id) => loadConversation(id, token)}
          />
          
          {showSettings && (
            <SettingsPanel 
              settings={settings} 
              selectedModel={selectedModel}
              onSettingsChange={handleSettingsChange}
              token={token}
            />
          )}
        </div>
        
        <div className="main-content">
          {showFileUpload && (
            <FileUpload 
              conversationId={currentConversationId}
              token={token}
              onFileUploaded={handleFileUpload}
              onCancel={() => setShowFileUpload(false)}
            />
          )}
          
          <ChatInterface 
            messages={messages} 
            isLoading={isLoading} 
            onSendMessage={sendMessage} 
            onClearChat={clearChat} 
            selectedModel={selectedModel}
            uploadedFiles={uploadedFiles}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
