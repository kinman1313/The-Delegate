import express, { Request, Response, Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import mongoose from 'mongoose';
import { auth } from '../middleware/auth';
import { MultiModalContextManager } from '../multimodal/ContextManager';
import { saveContextData, getContextItems } from '../services/databaseService';
import { generateVisualization } from '../multimodal/visualizationGenerator';

// Define interfaces
interface AuthRequest extends Request {
  user?: {
    _id: mongoose.Types.ObjectId;
    id: string;
    [key: string]: any;
  };
  file?: Express.Multer.File;
}

interface ContextReference {
  reference: string;
  [key: string]: any;
}

interface ContextContent {
  type: string;
  path: string;
  thumbnailPath?: string;
  content?: string;
  data?: any;
  originalName: string;
  [key: string]: any;
}

const router: Router = express.Router();

// Configure storage
const storage = multer.diskStorage({
  destination: (req: AuthRequest, file: Express.Multer.File, cb: Function) => {
    const userId = req.user?.id;
    if (!userId) {
      return cb(new Error('User not authenticated'));
    }
    
    const userDir = path.join(__dirname, '../uploads', userId);
    
    fs.mkdir(userDir, { recursive: true })
      .then(() => cb(null, userDir))
      .catch(err => cb(err));
  },
  filename: (req: Request, file: Express.Multer.File, cb: Function) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req: Request, file: Express.Multer.File, cb: Function) => {
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
const contextManagers: Record<string, MultiModalContextManager> = {};

// Initialize or get context manager
const getContextManager = (userId: mongoose.Types.ObjectId, conversationId?: string): MultiModalContextManager => {
  const key = `${userId}_${conversationId || 'default'}`;
  
  if (!contextManagers[key]) {
    contextManagers[key] = new MultiModalContextManager(userId, conversationId);
  }
  
  return contextManagers[key];
};

// Upload file and add to context
router.post('/upload', auth as any, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId } = req.body;
    
    if (!req.file) {
      return res.status(400).send({ error: 'No file uploaded' });
    }
    
    if (!req.user?._id) {
      return res.status(401).send({ error: 'Authentication required' });
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
  } catch (error: any) {
    console.error('Error uploading file to context:', error);
    res.status(500).send({ error: 'Failed to upload file to context' });
  }
});

// Get context items for a conversation
router.get('/', auth as any, async (req: AuthRequest, res: Response) => {
  try {
    const conversationId = req.query.conversationId as string | undefined;
    
    if (!conversationId) {
      return res.status(400).send({ error: 'Conversation ID is required' });
    }
    
    if (!req.user?._id) {
      return res.status(401).send({ error: 'Authentication required' });
    }
    
    // Get context items from database
    const items = await getContextItems(req.user._id, conversationId);
    
    res.send(items);
  } catch (error: any) {
    console.error('Error getting context items:', error);
    res.status(500).send({ error: 'Failed to get context items' });
  }
});

// Create a reference to a specific part of a context item
router.post('/reference', auth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { contextRef, selector, conversationId } = req.body;
    
    if (!contextRef || !selector) {
      return res.status(400).send({ error: 'Context reference and selector are required' });
    }
    
    if (!req.user?._id) {
      return res.status(401).send({ error: 'Authentication required' });
    }
    
    // Get context manager
    const contextManager = getContextManager(req.user._id, conversationId);
    
    // Generate reference
    const reference = await contextManager.generateVisualReference(contextRef, selector);
    
    res.send(reference);
  } catch (error: any) {
    console.error('Error creating context reference:', error);
    res.status(500).send({ error: 'Failed to create context reference' });
  }
});

// Get context content
router.get('/:reference/content', auth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { reference } = req.params;
    
    if (!req.user?._id) {
      return res.status(401).send({ error: 'Authentication required' });
    }
    
    // Get context manager
    const contextManager = getContextManager(req.user._id);
    
    // Get content by reference
    const content: ContextContent = await contextManager.getContentByReference(reference);
    
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
  } catch (error: any) {
    console.error('Error getting context content:', error);
    res.status(500).send({ error: 'Failed to get context content' });
  }
});

// Get thumbnail for context item
router.get('/:reference/thumbnail', auth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { reference } = req.params;
    
    if (!req.user?._id) {
      return res.status(401).send({ error: 'Authentication required' });
    }
    
    // Get context manager
    const contextManager = getContextManager(req.user._id);
    
    // Get content by reference
    const content: ContextContent = await contextManager.getContentByReference(reference);
    
    if (content.thumbnailPath) {
      // Send thumbnail
      res.sendFile(content.thumbnailPath);
    } else {
      // Generate and send placeholder thumbnail based on type
      res.sendFile(path.join(__dirname, `../public/thumbnails/${content.type}.png`));
    }
  } catch (error: any) {
    console.error('Error getting context thumbnail:', error);
    res.status(500).send({ error: 'Failed to get context thumbnail' });
  }
});

// Download context item
router.get('/:reference/download', auth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { reference } = req.params;
    
    if (!req.user?._id) {
      return res.status(401).send({ error: 'Authentication required' });
    }
    
    // Get context manager
    const contextManager = getContextManager(req.user._id);
    
    // Get content by reference
    const content: ContextContent = await contextManager.getContentByReference(reference);
    
    // Send file for download
    res.download(content.path, content.originalName);
  } catch (error: any) {
    console.error('Error downloading context item:', error);
    res.status(500).send({ error: 'Failed to download context item' });
  }
});

export default router;