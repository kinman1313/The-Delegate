// src/components/agent/AgentInterface.tsx
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useParams } from 'react-router-dom';
import { sendAgentRequest, getConversationById } from '../../services/apiService';

interface AgentStep {
    task: string;
    type?: string;
    model?: {
        model?: string;
    };
    reasoning?: string;
    tools?: string[];
}

interface ExecutionPath {
    steps: AgentStep[];
}

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    executionPath?: ExecutionPath;
}

interface AgentResponse {
    response: string;
    executionPath?: ExecutionPath;
    reasoning?: string[];
}

interface ConversationParams {
    conversationId?: string;
}

const AgentInterface: React.FC = () => {
    const { conversationId } = useParams<ConversationParams>();
    const [input, setInput] = useState<string>('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [showThinking, setShowThinking] = useState<boolean>(false);
    const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
    const [showReasoningTrace, setShowReasoningTrace] = useState<boolean>(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load conversation if conversationId is provided
    useEffect(() => {
        if (conversationId) {
            const loadConversation = async (): Promise<void> => {
                try {
                    const { conversation } = await getConversationById(conversationId);
                    setMessages(conversation.messages || []);
                } catch (error) {
                    console.error('Error loading conversation:', error);
                }
            };

            loadConversation();
        }
    }, [conversationId]);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, agentSteps]);

    const handleSendMessage = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();

        if (!input.trim() || isLoading) return;

        // Add user message to the UI
        const userMessage: Message = {
            role: 'user',
            content: input,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setShowThinking(true);
        setAgentSteps([]);

        try {
            // Make the API call to the agent system
            const response: AgentResponse = await sendAgentRequest(input, conversationId);

            if (response.executionPath && response.executionPath.steps) {
                setAgentSteps(response.executionPath.steps);
            }

            if (response.reasoning) {
                setAgentSteps(prev => {
                    return prev.map((step, index) => ({
                        ...step,
                        reasoning: response.reasoning?.[index] || ''
                    }));
                });
            }

            // Add the agent's response to the UI
            const agentResponse: Message = {
                role: 'assistant',
                content: response.response,
                timestamp: new Date().toISOString(),
                executionPath: response.executionPath
            };

            setMessages(prev => [...prev, agentResponse]);
        } catch (error: any) {
            console.error('Error sending message to agent:', error);

            // Add error message
            const errorMessage: Message = {
                role: 'system',
                content: `Error: ${error.message || 'Something went wrong'}`,
                timestamp: new Date().toISOString()
            };

            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            setShowThinking(false);
        }
    };

    const renderAgentThinking = (): JSX.Element | null => {
        if (!showThinking) return null;

        return (
            <div className="agent-thinking">
                <div className="agent-thinking-header">
                    <span>Agent is thinking...</span>
                    <div className="agent-thinking-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>

                {agentSteps.length > 0 && (
                    <div className="agent-steps">
                        {agentSteps.map((step, index) => (
                            <div key={index} className="agent-step">
                                <div className="agent-step-number">{index + 1}</div>
                                <div className="agent-step-content">
                                    <div className="agent-step-task">{step.task}</div>
                                    <div className="agent-step-model">Using: {step.model?.model || 'Unknown model'}</div>
                                    {step.reasoning && (
                                        <div className="agent-step-reasoning">{step.reasoning}</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const toggleReasoningTrace = (): void => {
        setShowReasoningTrace(!showReasoningTrace);
    };

    const renderMessage = (message: Message, index: number): JSX.Element => {
        return (
            <div key={index} className={`message ${message.role}`}>
                <div className="message-header">
                    <span className="message-sender">
                        {message.role === 'user' ? 'You' :
                            message.role === 'system' ? 'System' : 'Agent'}
                    </span>
                    <span className="message-time">
                        {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                </div>

                <div className="message-content">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>

                {message.executionPath && (
                    <div className="message-metadata">
                        <button
                            onClick={toggleReasoningTrace}
                            className="reasoning-trace-toggle"
                        >
                            {showReasoningTrace ? 'Hide execution details' : 'Show execution details'}
                        </button>

                        {showReasoningTrace && (
                            <div className="reasoning-trace">
                                <h4>Execution Path</h4>
                                <div className="execution-steps">
                                    {message.executionPath.steps.map((step, stepIndex) => (
                                        <div key={stepIndex} className="execution-step">
                                            <div className="step-header">
                                                <strong>Step {stepIndex + 1}:</strong> {step.task}
                                            </div>
                                            <div className="step-details">
                                                <div><strong>Type:</strong> {step.type}</div>
                                                <div><strong>Model:</strong> {step.model?.model || 'Not specified'}</div>
                                                {step.tools && step.tools.length > 0 && (
                                                    <div>
                                                        <strong>Tools:</strong> {step.tools.join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="agent-interface">
            <div className="agent-header">
                <h2>AI Agent Interface</h2>
                <div className="agent-header-controls">
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
                            The agent can use multiple LLMs and tools to solve complex tasks.
                            Try asking something that requires multiple steps or different types of reasoning.
                        </p>
                    </div>
                ) : (
                    messages.map(renderMessage)
                )}

                {renderAgentThinking()}

                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="agent-input">
                <textarea
                    value={input}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
                    placeholder="Ask the agent something complex..."
                    disabled={isLoading}
                    onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage(e as unknown as React.FormEvent);
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
