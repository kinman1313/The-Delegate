// src/views/AgentView.tsx
import React, { useState, useEffect } from 'react';
import AgentInterface from '../components/AgentInterface';
import { executeAgentRequest, getAvailableTools } from '../services/agentService';

interface AgentViewProps {
  conversationId: string | null;
  token: string | null;
}

interface Tool {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
}

const AgentView: React.FC<AgentViewProps> = ({ conversationId, token }) => {
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [isLoadingTools, setIsLoadingTools] = useState<boolean>(false);

  // Load available tools when component mounts
  useEffect(() => {
    if (token) {
      loadAvailableTools(token);
    }
  }, [token]);

  const loadAvailableTools = async (authToken: string) => {
    setIsLoadingTools(true);
    try {
      const tools = await getAvailableTools(authToken);
      setAvailableTools(tools);
    } catch (error) {
      console.error('Error loading available tools:', error);
    } finally {
      setIsLoadingTools(false);
    }
  };

  const handleAgentRequest = async (request: string) => {
    if (!token) return { response: 'Authentication required', executionPath: { steps: [] } };
    
    try {
      return await executeAgentRequest(request, conversationId || undefined, token);
    } catch (error) {
      console.error('Error executing agent request:', error);
      return {
        response: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        executionPath: { steps: [] }
      };
    }
  };

  return (
    <div className="agent-view">
      <AgentInterface
        onSendRequest={handleAgentRequest}
        availableTools={availableTools}
        isLoadingTools={isLoadingTools}
        conversationId={conversationId}
      />
    </div>
  );
};

export default AgentView;