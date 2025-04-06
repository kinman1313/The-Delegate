// routes/agentRoutes.js
const express = require('express');
const router = express.Router();
const AgentController = require('../agent/AgentController');
const { auth } = require('../middleware/auth');
const { getAvailableModels } = require('../services/llmService');
const { getAvailableTools } = require('../services/toolService');
const { saveAgentExecution, getAgentExecutions } = require('../services/databaseService');

// Initialize agent controller for each request
router.use(auth, async (req, res, next) => {
  try {
    // Get available models for this user
    const models = await getAvailableModels(req.user._id);
    
    // Get available tools
    const tools = await getAvailableTools();
    
    // Create agent controller
    req.agentController = new AgentController(models, tools, req.user._id);
    
    next();
  } catch (error) {
    console.error('Error initializing agent controller:', error);
    res.status(500).send({ error: 'Failed to initialize agent system' });
  }
});

// Execute agent request
router.post('/execute', async (req, res) => {
  try {
    const { request, conversationId } = req.body;
    
    if (!request) {
      return res.status(400).send({ error: 'Request is required' });
    }
    
    // Get conversation context if conversationId is provided
    let context = [];
    if (conversationId) {
      context = await getConversationContext(conversationId, req.user._id);
    }
    
    // Execute the request
    const result = await req.agentController.executeRequest(request, context);
    
    // Save the result to the conversation if conversationId is provided
    if (conversationId) {
      await saveAgentResponseToConversation(
        conversationId,
        request,
        result.response,
        result.executionPath,
        req.user._id
      );
    }
    
    // Save execution for future reference
    await saveAgentExecution(
      req.user._id,
      conversationId,
      request,
      result.executionPath,
      result.response
    );
    
    res.send(result);
  } catch (error) {
    console.error('Agent execution error:', error);
    res.status(500).send({ error: 'Failed to process agent request: ' + error.message });
  }
});

// Get agent execution history
router.get('/history', async (req, res) => {
  try {
    const { conversationId } = req.query;
    
    const executions = await getAgentExecutions(
      req.user._id,
      conversationId
    );
    
    res.send(executions);
  } catch (error) {
    console.error('Get agent history error:', error);
    res.status(500).send({ error: 'Failed to get agent history' });
  }
});

// Get available tools
router.get('/tools', async (req, res) => {
  try {
    const tools = await getAvailableTools();
    
    // Filter out sensitive information
    const toolsInfo = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      capabilities: tool.capabilities
    }));
    
    res.send(toolsInfo);
  } catch (error) {
    console.error('Get tools error:', error);
    res.status(500).send({ error: 'Failed to get available tools' });
  }
});

// Helper function to get conversation context
async function getConversationContext(conversationId, userId) {
  // This would fetch the conversation and format it as context
  // Implementation depends on your database structure
  return [];
}

// Helper function to save agent response to conversation
async function saveAgentResponseToConversation(
  conversationId,
  request,
  response,
  executionPath,
  userId
) {
  // This would save the agent's response to the conversation
  // Implementation depends on your database structure
}

module.exports = router;
