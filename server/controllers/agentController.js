// controllers/agentController.js
const AgentController = require('../agent/AgentController');
const { getAvailableModels } = require('../services/llmService');
const { getAvailableTools } = require('../services/toolService');

exports.executeRequest = async (req, res) => {
  // Handle agent execution
};

exports.getAgentHistory = async (req, res) => {
  // Get agent execution history
};