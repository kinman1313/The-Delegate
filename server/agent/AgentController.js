// agent/AgentController.js
const { 
  determineToolsNeeded, 
  createAgentExecutionPlan, 
  executeAgentPlan, 
  synthesizeResults 
} = require('./AgentOrchestrator');
const { saveAgentExecution } = require('../services/databaseService');

/**
 * Main controller for the agent system
 * This coordinates the execution of multi-step reasoning tasks
 * using different LLMs and tools
 */
class AgentController {
  constructor(models, tools, userId) {
    this.availableModels = models; // List of LLMs available
    this.availableTools = tools;   // List of tools available
    this.userId = userId;
    this.executionHistory = [];
  }

  /**
   * Execute a user request using the agent system
   * @param {string} userRequest - The user's original request
   * @param {array} context - Previous conversation and files
   */
  async executeRequest(userRequest, context) {
    try {
      // Step 1: Analyze the request to determine what tools and models to use
      const analysisResult = await determineToolsNeeded(userRequest, context, this.availableModels);
      
      // Step 2: Create an execution plan
      const executionPlan = await createAgentExecutionPlan(
        userRequest, 
        analysisResult, 
        this.availableModels, 
        this.availableTools
      );
      
      // Step 3: Execute the plan
      const executionResults = await executeAgentPlan(executionPlan, context);
      
      // Step 4: Synthesize results into a coherent response
      const finalResponse = await synthesizeResults(
        userRequest, 
        executionResults, 
        executionPlan,
        this.availableModels
      );
      
      // Log execution for learning
      this.executionHistory.push({
        request: userRequest,
        plan: executionPlan,
        results: executionResults,
        response: finalResponse
      });
      
      // Save to database for future improvement
      await saveAgentExecution(this.userId, {
        request: userRequest,
        plan: executionPlan,
        response: finalResponse
      });
      
      return {
        response: finalResponse,
        executionPath: executionPlan,
        reasoning: executionResults.reasoning || []
      };
    } catch (error) {
      console.error('Agent execution error:', error);
      return {
        response: "I encountered an error while processing your request. Here's what happened: " + error.message,
        error: true
      };
    }
  }

  /**
   * Add a new tool to the agent's toolkit
   */
  registerTool(tool) {
    this.availableTools.push(tool);
  }

  /**
   * Add a new model to the agent's available models
   */
  registerModel(model) {
    this.availableModels.push(model);
  }
}

module.exports = AgentController;
