// routes/contextRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const { auth } = require('../middleware/auth');
const MultiModalContextManager = require('../multimodal/ContextManager');
const { saveContextData, getContextItems } = require('../services/databaseService');
const { generateVisualization } = require('../multimodal/visualizationGenerator');

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.user.id;
    const userDir = path.join(__dirname, '../uploads', userId);
    
    fs.mkdir(userDir, { recursive: true })
      .then(() => cb(null, userDir))
      .catch(err => cb(err));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // Allow most common file types
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/svg+xml',
      'application/pdf',
      'text/plain', 'text/csv', 'application/json',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Context managers for users (in-memory, would be more sophisticated in production)
const contextManagers = {};

// Initialize or get context manager
const getContextManager = (userId, conversationId) => {
  const key = `${userId}_${conversationId || 'default'}`;
  
  if (!contextManagers[key]) {
    contextManagers[key] = new MultiModalContextManager(userId, conversationId);
  }
  
  return contextManagers[key];
};

// Upload file and add to context
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    const { conversationId } = req.body;
    
    if (!req.file) {
      return res.status(400).send({ error: 'No file uploaded' });
    }
    
    // Get context manager
    const contextManager = getContextManager(req.user._id, conversationId);
    
    // Add file to context
    const contextRef = await contextManager.addFileToContext({
      path: req.file.path,
      mimetype: req.file.mimetype,
      originalName: req.file.originalname,
      size: req.file.size
    });
    
    // Return context reference
    res.status(201).send({
      fileId: req.file.filename,
      reference: contextRef.reference,
      filename: req.file.originalname,
      type: req.file.mimetype
    });
  } catch (error) {
    console.error('Error uploading file to context:', error);
    res.status(500).send({ error: 'Failed to upload file to context' });
  }
});

// Get context items for a conversation
router.get('/', auth, async (req, res) => {
  try {
    const { conversationId } = req.query;
    
    if (!conversationId) {
      return res.status(400).send({ error: 'Conversation ID is required' });
    }
    
    // Get context items from database
    const items = await getContextItems(req.user._id, conversationId);
    
    res.send(items);
  } catch (error) {
    console.error('Error getting context items:', error);
    res.status(500).send({ error: 'Failed to get context items' });
  }
});

// Create a reference to a specific part of a context item
router.post('/reference', auth, async (req, res) => {
  try {
    const { contextRef, selector, conversationId } = req.body;
    
    if (!contextRef || !selector) {
      return res.status(400).send({ error: 'Context reference and selector are required' });
    }
    
    // Get context manager
    const contextManager = getContextManager(req.user._id, conversationId);
    
    // Generate reference
    const reference = await contextManager.generateVisualReference(contextRef, selector);
    
    res.send(reference);
  } catch (error) {
    console.error('Error creating context reference:', error);
    res.status(500).send({ error: 'Failed to create context reference' });
  }
});

// Get context content
router.get('/:reference/content', auth, async (req, res) => {
  try {
    const { reference } = req.params;
    
    // Get context manager
    const contextManager = getContextManager(req.user._id);
    
    // Get content by reference
    const content = await contextManager.getContentByReference(reference);
    
    if (content.type === 'image') {
      // Send image file
      res.sendFile(content.path);
    } else if (content.type === 'pdf') {
      // Send PDF file
      res.sendFile(content.path);
    } else if (content.type === 'text') {
      // Send text content
      res.send(content.content);
    } else if (content.type === 'spreadsheet') {
      // Send spreadsheet data
      res.json(content.data);
    } else {
      // Send generic content
      res.sendFile(content.path);
    }
  } catch (error) {
    console.error('Error getting context content:', error);
    res.status(500).send({ error: 'Failed to get context content' });
  }
});

// Get thumbnail for context item
router.get('/:reference/thumbnail', auth, async (req, res) => {
  try {
    const { reference } = req.params;
    
    // Get context manager
    const contextManager = getContextManager(req.user._id);
    
    // Get content by reference
    const content = await contextManager.getContentByReference(reference);
    
    if (content.thumbnailPath) {
      // Send thumbnail
      res.sendFile(content.thumbnailPath);
    } else {
      // Generate and send placeholder thumbnail based on type
      res.sendFile(path.join(__dirname, `../public/thumbnails/${content.type}.png`));
    }
  } catch (error) {
    console.error('Error getting context thumbnail:', error);
    res.status(500).send({ error: 'Failed to get context thumbnail' });
  }
});

// Download context item
router.get('/:reference/download', auth, async (req, res) => {
  try {
    const { reference } = req.params;
    
    // Get context manager
    const contextManager = getContextManager(req.user._id);
    
    // Get content by reference
    const content = await contextManager.getContentByReference(reference);
    
    // Send file for download
    res.download(content.path, content.originalName);
  } catch (error) {
    console.error('Error downloading context item:', error);
    res.status(500).send({ error: 'Failed to download context item' });
  }
});

module.exports = router;
