import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { executeAgentRequest, getAvailableTools } from '../services/apiService';
import '../styles/AgentInterface.css';

interface AgentInterfaceProps {
  conversationId: string | null;
  token: string | null;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  executionPath?: {
    steps: AgentStep[];
  };
}

interface AgentStep {
  task: string;
  type: string;
  model?: {
    provider: string;
    model: string;
  };
  reasoning?: string;
  tools?: string[];
  result?: any;
}

interface Tool {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
}

const AgentInterface: React.FC<AgentInterfaceProps> = ({ conversationId, token }) => {
  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showThinking, setShowThinking] = useState<boolean>(false);
  const [currentSteps, setCurrentSteps] = useState<AgentStep[]>([]);
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [showExecutionDetails, setShowExecutionDetails] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load available tools on component mount
  useEffect(() => {
    if (token) {
      loadAvailableTools();
    }
  }, [token]);

  const loadAvailableTools = async () => {
    try {
      if (!token) return;
      const tools = await getAvailableTools(token);
      setAvailableTools(tools);
    } catch (error) {
      console.error('Error loading available tools:', error);
    }
  };

  // Auto scroll to bottom when new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, currentSteps]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!input.trim() || isLoading) return;
    if (!token) {
      setMessages(prev => [
        ...prev,
        {
          role: 'system',
          content: 'Authentication required. Please log in again.',
          timestamp: new Date().toISOString()
        }
      ]);
      return;
    }

    // Add user message
    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setShowThinking(true);
    setCurrentSteps([]);

    try {
      // Call the agent service
      const response = await executeAgentRequest(input, conversationId || undefined, token);
      
      // Add agent response to messages
      const agentMessage: Message = {
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toISOString(),
        executionPath: response.executionPath
      };

      setMessages(prev => [...prev, agentMessage]);
    } catch (error: any) {
      // Handle errors
      const errorMessage: Message = {
        role: 'system',
        content: `Error: ${error.message || 'Failed to process request'}`,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setShowThinking(false);
    }
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const toggleExecutionDetails = () => {
    setShowExecutionDetails(!showExecutionDetails);
  };

  const renderAgentThinking = (): JSX.Element | null => {
    if (!showThinking) return null;

    return (
      <div className="agent-thinking">
        <div className="agent-thinking-header">
          <span>Agent is processing your request...</span>
          <div className="thinking-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
        
        {currentSteps.length > 0 && (
          <div className="agent-steps">
            {currentSteps.map((step, index) => (
              <div key={index} className="agent-step">
                <div className="agent-step-number">{index + 1}</div>
                <div className="agent-step-content">
                  <div className="agent-step-task">{step.task}</div>
                  {step.model && (
                    <div className="agent-step-model">
                      Using: {step.model.model} ({step.model.provider})
                    </div>
                  )}
                  {step.tools && step.tools.length > 0 && (
                    <div className="agent-step-tools">
                      Tools: {step.tools.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderExecutionDetails = (executionPath?: { steps: AgentStep[] }): JSX.Element | null => {
    if (!executionPath || !executionPath.steps || executionPath.steps.length === 0) {
      return null;
    }

    return (
      <div className="execution-details">
        <h4>Execution Path</h4>
        <div className="execution-steps">
          {executionPath.steps.map((step, index) => (
            <div key={index} className="execution-step">
              <div className="step-header">
                <span className="step-number">{index + 1}</span>
                <span className="step-task">{step.task}</span>
              </div>
              <div className="step-details">
                <div><strong>Type:</strong> {step.type}</div>
                {step.model && (
                  <div><strong>Model:</strong> {step.model.provider} / {step.model.model}</div>
                )}
                {step.tools && step.tools.length > 0 && (
                  <div><strong>Tools used:</strong> {step.tools.join(', ')}</div>
                )}
                {step.reasoning && (
                  <div className="step-reasoning">
                    <strong>Reasoning:</strong>
                    <div className="reasoning-content">{step.reasoning}</div>
                  </div>
                )}
                {step.result && (
                  <div className="step-result">
                    <strong>Result:</strong>
                    <div className="result-content">
                      <ReactMarkdown>{typeof step.result === 'string' 
                        ? step.result 
                        : JSON.stringify(step.result, null, 2)}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="agent-interface">
      <div className="agent-header">
        <h2>AI Agent</h2>
        <div className="agent-controls">
          <button 
            onClick={() => setMessages([])}
            className="clear-chat-btn"
          >
            Clear Chat
          </button>
        </div>
      </div>

      <div className="agent-messages">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <p>No messages yet. Start a conversation with the AI Agent!</p>
            <p className="agent-tip">
              The agent can use multiple tools to solve complex tasks. Try asking for something that requires research, computation, or analysis.
            </p>
            {availableTools.length > 0 && (
              <div className="available-tools">
                <p><strong>Available tools:</strong></p>
                <ul>
                  {availableTools.map(tool => (
                    <li key={tool.id}>{tool.name} - {tool.description}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={index} className={`message ${message.role}`}>
              <div className="message-header">
                <span className="message-sender">
                  {message.role === 'user' ? 'You' :
                    message.role === 'system' ? 'System' : 'Agent'}
                </span>
                <span className="message-time">
                  {formatTime(message.timestamp)}
                </span>
              </div>

              <div className="message-content">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>

              {message.executionPath && (
                <div className="message-execution">
                  <button 
                    onClick={toggleExecutionDetails}
                    className="execution-toggle-btn"
                  >
                    {showExecutionDetails ? 'Hide execution details' : 'Show execution details'}
                  </button>
                  {showExecutionDetails && renderExecutionDetails(message.executionPath)}
                </div>
              )}
            </div>
          ))
        )}

        {renderAgentThinking()}
        
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="agent-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the agent to solve a complex task..."
          disabled={isLoading}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as React.FormEvent);
            }
          }}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>
          {isLoading ? 'Processing...' : 'Send'}
        </button>
      </form>
    </div>
  );
};

export default AgentInterface;