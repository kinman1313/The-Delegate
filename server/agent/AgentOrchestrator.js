// agent/AgentOrchestrator.js
const { callLLMApi } = require('../services/apiService');

/**
 * Determines which tools and models are needed for a given request
 * @param {string} userRequest - The user's request
 * @param {array} context - Conversation context
 * @param {array} availableModels - Models that can be used
 * @returns {object} Analysis results to inform the execution plan
 */
async function determineToolsNeeded(userRequest, context, availableModels) {
  // Select a model for analysis (typically use the most capable model)
  const analysisModel = findBestModelForTask('analysis', availableModels);
  
  const analysisPrompt = `
    You are an AI assistant that determines which tools are needed to answer a user's request.
    Analyze the following request and determine:
    1. What specific tasks need to be performed
    2. Which tools would be helpful (code execution, data analysis, web search, etc.)
    3. What types of models would be best suited (reasoning-focused, code-focused, etc.)
    
    User's request: ${userRequest}
    
    Respond in JSON format:
    {
      "tasks": [
        {"description": "task description", "type": "reasoning|code|data|visual", "priority": 1-5}
      ],
      "suggestedTools": ["tool1", "tool2"],
      "modelTypes": ["model-type1", "model-type2"]
    }
  `;
  
  const analysisResponse = await callLLMApi(
    analysisModel.provider,
    [{ role: 'user', content: analysisPrompt }],
    { temperature: 0.2, model: analysisModel.model }
  );
  
  // Parse JSON response
  try {
    return JSON.parse(analysisResponse.content);
  } catch (error) {
    console.error('Failed to parse analysis response:', error);
    // Fall back to default analysis
    return {
      tasks: [{ description: userRequest, type: "reasoning", priority: 3 }],
      suggestedTools: [],
      modelTypes: ["general"]
    };
  }
}

/**
 * Creates a detailed execution plan for the agent
 * @param {string} userRequest - Original user request
 * @param {object} analysis - Analysis results
 * @param {array} availableModels - Available models
 * @param {array} availableTools - Available tools
 * @returns {object} Execution plan
 */
async function createAgentExecutionPlan(userRequest, analysis, availableModels, availableTools) {
  // Map the suggested tools to actual available tools
  const mappedTools = analysis.suggestedTools
    .map(tool => availableTools.find(t => t.name === tool || t.type === tool))
    .filter(Boolean);
  
  // Map model types to actual models
  const mappedModels = analysis.modelTypes
    .map(type => findBestModelForTask(type, availableModels))
    .filter(Boolean);
  
  // Create plan steps for each task
  const steps = analysis.tasks.map(task => {
    // Assign appropriate tools for this task
    const taskTools = mappedTools.filter(tool => 
      (tool.capabilities || []).includes(task.type)
    );
    
    // Assign appropriate model for this task
    const taskModel = findBestModelForTask(task.type, availableModels);
    
    return {
      task: task.description,
      type: task.type,
      priority: task.priority,
      tools: taskTools.map(t => t.name),
      model: taskModel ? {
        provider: taskModel.provider,
        model: taskModel.model
      } : null
    };
  });
  
  // Sort steps by priority
  const sortedSteps = steps.sort((a, b) => b.priority - a.priority);
  
  // Determine if steps can be executed in parallel or must be sequential
  const dependencyGraph = buildDependencyGraph(sortedSteps);
  
  return {
    request: userRequest,
    steps: sortedSteps,
    dependencies: dependencyGraph,
    primaryModel: mappedModels[0] || findBestModelForTask('general', availableModels)
  };
}

/**
 * Executes the agent plan
 * @param {object} plan - The execution plan
 * @param {array} context - Conversation context
 * @returns {object} Results from execution
 */
async function executeAgentPlan(plan, context) {
  const results = {
    stepResults: [],
    toolOutputs: [],
    reasoning: []
  };
  
  // Determine execution order from dependency graph
  const executionOrder = getExecutionOrder(plan.dependencies);
  
  // Execute each step
  for (const stepIndex of executionOrder) {
    const step = plan.steps[stepIndex];
    
    // Log reasoning step
    results.reasoning.push(`Executing task: ${step.task} using ${step.model?.model || 'default model'}`);
    
    // Construct the prompt for this step
    const stepPrompt = constructStepPrompt(
      step,
      context,
      results,
      plan.request
    );
    
    // Execute the model call
    const modelResponse = await callLLMApi(
      step.model.provider,
      [{ role: 'user', content: stepPrompt }],
      { model: step.model.model }
    );
    
    // Process the response
    const processedResponse = processStepResponse(modelResponse, step);
    
    // Run tools if needed
    if (step.tools && step.tools.length > 0) {
      for (const toolName of step.tools) {
        const toolOutput = await executeToolForStep(toolName, processedResponse, step);
        results.toolOutputs.push({
          tool: toolName,
          output: toolOutput,
          step: stepIndex
        });
      }
    }
    
    // Record step results
    results.stepResults.push({
      step: stepIndex,
      output: processedResponse,
      taskType: step.type
    });
  }
  
  return results;
}

/**
 * Synthesizes the results into a final coherent response
 * @param {string} userRequest - Original request
 * @param {object} results - Execution results
 * @param {object} plan - Execution plan
 * @param {array} availableModels - Available models
 * @returns {string} Final synthesized response
 */
async function synthesizeResults(userRequest, results, plan, availableModels) {
  // Use the best model for synthesis
  const synthesisModel = findBestModelForTask('synthesis', availableModels) || 
                        plan.primaryModel;
  
  // Construct synthesis prompt
  const synthesisPrompt = `
    You are an AI assistant tasked with providing a helpful, coherent response to a user.
    
    Original request: ${userRequest}
    
    The following steps were taken to answer this request:
    ${results.reasoning.join('\n')}
    
    Step outputs:
    ${results.stepResults.map(r => `Task: ${plan.steps[r.step].task}\nOutput: ${r.output}`).join('\n\n')}
    
    Tool outputs:
    ${results.toolOutputs.map(t => `Tool: ${t.tool}\nOutput: ${t.output}`).join('\n\n')}
    
    Synthesize all this information into a coherent, helpful response that directly addresses the user's original request.
    Make sure your response is well-structured and easy to understand.
  `;
  
  const synthesisResponse = await callLLMApi(
    synthesisModel.provider,
    [{ role: 'user', content: synthesisPrompt }],
    { temperature: 0.7, model: synthesisModel.model }
  );
  
  return synthesisResponse.content;
}

/**
 * Helper function to find the best model for a specific task
 * @param {string} taskType - Type of task
 * @param {array} availableModels - Available models
 * @returns {object} Best model for the task
 */
function findBestModelForTask(taskType, availableModels) {
  // Define model strengths - this would be more sophisticated in practice
  const modelStrengths = {
    'analysis': ['claude', 'gpt-4', 'gemini'],
    'reasoning': ['claude', 'gpt-4', 'gemini'],
    'code': ['deepseek', 'gpt-4', 'claude'],
    'data': ['gpt-4', 'claude', 'gemini'],
    'visual': ['gemini', 'gpt-4', 'claude'],
    'synthesis': ['claude', 'gpt-4', 'gemini'],
    'general': ['claude', 'gpt-4', 'gemini']
  };
  
  // Get the preferred providers for this task
  const preferredProviders = modelStrengths[taskType] || modelStrengths.general;
  
  // Find the best available model based on preferred providers
  for (const provider of preferredProviders) {
    const model = availableModels.find(m => m.provider === provider);
    if (model) return model;
  }
  
  // Fallback to any available model
  return availableModels[0];
}

/**
 * Builds a dependency graph for steps - which steps depend on which
 * @param {array} steps - Plan steps
 * @returns {object} Dependency graph
 */
function buildDependencyGraph(steps) {
  // Simple implementation - more sophisticated in reality
  // For now, we'll make later steps depend on earlier ones for sequential execution
  const graph = {};
  
  for (let i = 0; i < steps.length; i++) {
    graph[i] = i === 0 ? [] : [i - 1];
  }
  
  return graph;
}

/**
 * Gets execution order from dependency graph
 * @param {object} graph - Dependency graph
 * @returns {array} Execution order of step indices
 */
function getExecutionOrder(graph) {
  // Simple implementation for now
  return Object.keys(graph).map(Number);
}

/**
 * Constructs a prompt for a specific step
 * @param {object} step - Step to execute
 * @param {array} context - Conversation context
 * @param {object} results - Results so far
 * @param {string} originalRequest - Original user request
 * @returns {string} Prompt for the step
 */
function constructStepPrompt(step, context, results, originalRequest) {
  // Include relevant results from previous steps
  const relevantResults = results.stepResults
    .map(r => `Previous task output: ${r.output}`)
    .join('\n\n');
  
  // Include relevant tool outputs
  const relevantTools = results.toolOutputs
    .map(t => `Tool ${t.tool} output: ${t.output}`)
    .join('\n\n');
  
  return `
    You are an AI assistant working on the following task: ${step.task}
    
    Original user request: ${originalRequest}
    
    ${relevantResults ? 'Information from previous steps:\n' + relevantResults : ''}
    
    ${relevantTools ? 'Tool outputs:\n' + relevantTools : ''}
    
    Please complete the following task: ${step.task}
    Be thorough and accurate. Your output will be used in subsequent steps.
  `;
}

/**
 * Processes the response from a step
 * @param {object} response - LLM response
 * @param {object} step - Step that was executed
 * @returns {string} Processed response
 */
function processStepResponse(response, step) {
  // Simple implementation for now
  return response.content;
}

/**
 * Executes a tool for a specific step
 * @param {string} toolName - Name of the tool to execute
 * @param {string} input - Input to the tool
 * @param {object} step - Step being executed
 * @returns {string} Tool output
 */
async function executeToolForStep(toolName, input, step) {
  // This would connect to the actual tool implementation
  return `Simulated output from ${toolName} for task: ${step.task}`;
}

module.exports = {
  determineToolsNeeded,
  createAgentExecutionPlan,
  executeAgentPlan,
  synthesizeResults
};
