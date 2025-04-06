// routes/visualizationRoutes.js
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const MultiModalContextManager = require('../multimodal/ContextManager');
const { generateVisualization } = require('../multimodal/visualizationGenerator');
const { saveVisualization, getVisualizations } = require('../services/databaseService');

// Context managers (shared with contextRoutes.js)
const contextManagers = {};

// Initialize or get context manager
const getContextManager = (userId, conversationId) => {
  const key = `${userId}_${conversationId || 'default'}`;
  
  if (!contextManagers[key]) {
    contextManagers[key] = new MultiModalContextManager(userId, conversationId);
  }
  
  return contextManagers[key];
};

// Generate visualization
router.post('/generate', auth, async (req, res) => {
  try {
    const { dataContextRef, visualizationType = 'auto', options = {}, conversationId } = req.body;
    
    if (!dataContextRef) {
      return res.status(400).send({ error: 'Data context reference is required' });
    }
    
    // Get context manager
    const contextManager = getContextManager(req.user._id, conversationId);
    
    // Get data from context
    const contextData = await contextManager.getContentByReference(dataContextRef);
    
    if (!contextData || !contextData.data) {
      return res.status(400).send({ error: 'Invalid data context reference or context does not contain data' });
    }
    
    // Generate visualization
    const visualization = await generateVisualization(
      contextData.data,
      visualizationType,
      options
    );
    
    // Save visualization
    const savedVisualization = await saveVisualization(
      req.user._id,
      conversationId,
      {
        dataContextRef,
        visualizationType,
        options,
        code: visualization.code,
        caption: visualization.caption,
        type: visualization.type
      }
    );
    
    // Return visualization
    res.send({
      id: savedVisualization.id,
      reference: savedVisualization.reference,
      type: visualization.type,
      html: visualization.code,
      caption: visualization.caption,
      title: options.title || `${visualization.type.charAt(0).toUpperCase() + visualization.type.slice(1)} Chart`
    });
  } catch (error) {
    console.error('Error generating visualization:', error);
    res.status(500).send({ error: 'Failed to generate visualization' });
  }
});

// Get visualizations for a conversation
router.get('/', auth, async (req, res) => {
  try {
    const { conversationId } = req.query;
    
    if (!conversationId) {
      return res.status(400).send({ error: 'Conversation ID is required' });
    }
    
    // Get visualizations from database
    const visualizations = await getVisualizations(req.user._id, conversationId);
    
    res.send(visualizations);
  } catch (error) {
    console.error('Error getting visualizations:', error);
    res.status(500).send({ error: 'Failed to get visualizations' });
  }
});

// Get specific visualization
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get visualization from database
    const visualization = await getVisualizationById(id, req.user._id);
    
    if (!visualization) {
      return res.status(404).send({ error: 'Visualization not found' });
    }
    
    res.send(visualization);
  } catch (error) {
    console.error('Error getting visualization:', error);
    res.status(500).send({ error: 'Failed to get visualization' });
  }
});

module.exports = router;
