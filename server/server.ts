// server.ts - Express backend for Multi-LLM Frontend
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { processFile } from './services/documentProcessor';

// Load environment variables
dotenv.config();

// Define interface for user document
interface UserDocument extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  email: string;
  password: string;
  createdAt: Date;
}

// Define interface for API key document
interface ApiKeyDocument extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  provider: string;
  apiKey: string;
  createdAt: Date;
}

// Define interface for message
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  timestamp: Date;
}

// Define interface for conversation document
interface ConversationDocument extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  messages: Message[];
  summary?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Define interface for file document
interface FileDocument extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  conversationId?: mongoose.Types.ObjectId;
  filename: string;
  originalName: string;
  mimetype: string;
  path: string;
  size: number;
  uploadedAt: Date;
}

// Define interfaces for different request body types
interface ConversationRequestBody {
  conversationId: any;
  // allow flexible request bodies
}

interface ChatRequestBody {
  messages: Message[];
  settings?: LLMSettings;
}

// Extend Express Request interface
interface AuthRequest extends Request {
  body: ConversationRequestBody | ChatRequestBody | any;
  user?: UserDocument;
  token?: string;
  file?: Express.Multer.File;
}

// Define interface for LLM settings
interface LLMSettings {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Configure file uploads
const storage = multer.diskStorage({
  destination: (req: AuthRequest, file: Express.Multer.File, cb: Function) => {
    const userId = req.user?.id;
    const userDir = path.join(__dirname, 'uploads', userId as string);
    
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    cb(null, userDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb: Function) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req: Request, file: Express.Multer.File, cb: Function) => {
    // Allow common document and text file types
    const allowedTypes = [
      'text/plain', 'text/csv', 'application/json',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only text, documents, and spreadsheets are allowed.'));
    }
  }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || '')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define Schemas
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const ApiKeySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  provider: { type: String, required: true },
  apiKey: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const ConversationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, default: 'New Conversation' },
  messages: [{
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    model: { type: String },
    timestamp: { type: Date, default: Date.now }
  }],
  summary: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const FileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimetype: { type: String, required: true },
  path: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now }
});

// Create models from schemas
const User = mongoose.model<UserDocument>('User', UserSchema);
const ApiKey = mongoose.model<ApiKeyDocument>('ApiKey', ApiKeySchema);
const Conversation = mongoose.model<ConversationDocument>('Conversation', ConversationSchema);
const File = mongoose.model<FileDocument>('File', FileSchema);

// Authentication middleware
const auth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const header = req.header('Authorization');
    if (!header) throw new Error('No authorization header');
    
    const token = header.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as { id: string };
    const user = await User.findById(decoded.id);
    
    if (!user) {
      throw new Error();
    }
    
    req.token = token;
    req.user = user;
    next();
  } catch (error) {
    res.status(401).send({ error: 'Please authenticate.' });
  }
};

// User Routes
app.post('/api/users/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).send({ error: 'User already exists' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new user
    const user = new User({
      username,
      email,
      password: hashedPassword
    });
    
    await user.save();
    
    // Generate JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || '', { expiresIn: '7d' });
    
    res.status(201).send({ token, user: { id: user._id, username: user.username, email: user.email } });
  } catch (error: any) {
    res.status(500).send({ error: error.message });
  }
});

app.post('/api/users/login', async (req: express.Request, res: express.Response) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).send({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).send({ error: 'Invalid credentials' });
    }
    
    // Generate JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || '', { expiresIn: '7d' });
    
    res.send({ token, user: { id: user._id, username: user.username, email: user.email } });
  } catch (error: any) {
    res.status(500).send({ error: error.message });
  }
});

// API Key Routes
app.post('/api/keys', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { provider, apiKey } = req.body;
    
    if (!req.user) {
      return res.status(401).send({ error: 'User not authenticated' });
    }
    
    // Check if key already exists for this provider
    const existingKey = await ApiKey.findOne({ userId: req.user._id, provider });
    
    if (existingKey) {
      // Update existing key
      existingKey.apiKey = apiKey;
      await existingKey.save();
      return res.send({ success: true, provider });
    }
    
    // Create new key
    const newKey = new ApiKey({
      userId: req.user._id,
      provider,
      apiKey
    });
    
    await newKey.save();
    
    res.status(201).send({ success: true, provider });
  } catch (error: any) {
    res.status(500).send({ error: error.message });
  }
});

app.get('/api/keys', auth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).send({ error: 'User not authenticated' });
    }
    
    // Only return the providers for which keys exist (not the actual keys)
    const keys = await ApiKey.find({ userId: req.user._id });
    const providers = keys.map(key => key.provider);
    
    res.send({ providers });
  } catch (error: any) {
    res.status(500).send({ error: error.message });
  }
});

// LLM API proxy routes
app.post('/api/chat/:provider', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { provider } = req.params;
    const { messages, settings } = req.body;
    
    if (!req.user) {
      return res.status(401).send({ error: 'User not authenticated' });
    }
    
    // Get API key for the provider
    const apiKeyDoc = await ApiKey.findOne({ userId: req.user._id, provider });
    
    if (!apiKeyDoc) {
      return res.status(400).send({ error: `No API key found for ${provider}` });
    }
    
    // Call the appropriate LLM API based on the provider
    let response;
    
    switch (provider) {
      case 'claude':
        response = await callClaudeApi(messages, apiKeyDoc.apiKey, settings);
        break;
      case 'openai':
        response = await callOpenAIApi(messages, apiKeyDoc.apiKey, settings);
        break;
      case 'gemini':
        response = await callGeminiApi(messages, apiKeyDoc.apiKey, settings);
        break;
      case 'deepseek':
        response = await callDeepSeekApi(messages, apiKeyDoc.apiKey, settings);
        break;
      case 'huggingface':
        response = await callHuggingFaceApi(messages, apiKeyDoc.apiKey, settings);
        break;
      default:
        return res.status(400).send({ error: `Unknown provider: ${provider}` });
    }
    
    res.send(response);
  } catch (error: any) {
    res.status(500).send({ error: error.message });
  }
});

// File upload route - Updated version
app.post('/api/files/upload', auth, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId } = req.body;
    
    if (!req.user || !req.file) {
      return res.status(400).send({ error: 'User not authenticated or no file provided' });
    }

    // Process the file based on its type
    const processedData = await processFile(req.file.path, req.file.mimetype);
    
    // Save file metadata to database
    const file = new File({
      userId: req.user._id,
      conversationId: conversationId || null,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      path: req.file.path,
      size: req.file.size,
      processedData // Save the processed data
    });
    
    await file.save();
    
    // If part of a conversation, add a system message about the file
    if (conversationId) {
      const conversation = await Conversation.findById(conversationId);
      
      if (conversation && conversation.userId.toString() === req.user._id.toString()) {
        conversation.messages.push({
          role: 'system',
          content: `File uploaded: ${req.file.originalname} (${processedData.summary || 'file uploaded'})`,
          timestamp: new Date()
        });
        
        conversation.updatedAt = new Date();
        await conversation.save();
      }
    }
    
    res.status(201).send({
      fileId: file._id,
      filename: file.originalName,
      type: file.mimetype,
      summary: processedData.summary,
      reference: `file_${file._id}`
    });
  } catch (error: any) {
    console.error('File upload error:', error);
    res.status(500).send({ error: error.message || 'Error during file upload' });
  }
});

// Add a route to get file content or download a file
app.get('/api/files/:fileId/download', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { fileId } = req.params;
    
    if (!req.user) {
      return res.status(401).send({ error: 'Authentication required' });
    }
    
    // Find the file in the database
    const file = await File.findOne({ _id: fileId, userId: req.user._id });
    
    if (!file) {
      return res.status(404).send({ error: 'File not found' });
    }
    
    // Set Content-Disposition header to prompt download
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    
    // Send the file
    res.sendFile(file.path);
  } catch (error: any) {
    console.error('File download error:', error);
    res.status(500).send({ error: error.message || 'Error downloading file' });
  }
});

// Add a route to get files for a conversation
app.get('/api/files', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId } = req.query;
    
    if (!req.user) {
      return res.status(401).send({ error: 'Authentication required' });
    }
    
    const query: any = { userId: req.user._id };
    
    if (conversationId) {
      query.conversationId = conversationId;
    }
    
    // Find files based on the query
    const files = await File.find(query).sort({ uploadedAt: -1 });
    
    res.send(files.map(file => ({
      _id: file._id,
      originalName: file.originalName,
      mimetype: file.mimetype,
      size: file.size,
      uploadedAt: file.uploadedAt,
      summary: file.processedData?.summary || 'File uploaded'
    })));
  } catch (error: any) {
    console.error('Get files error:', error);
    res.status(500).send({ error: error.message || 'Error retrieving files' });
  }
});

// Add a route to process a file with specific operations
app.post('/api/files/:fileId/process', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { fileId } = req.params;
    const { processingType, options } = req.body;
    
    if (!req.user) {
      return res.status(401).send({ error: 'Authentication required' });
    }
    
    // Find the file in the database
    const file = await File.findOne({ _id: fileId, userId: req.user._id });
    
    if (!file) {
      return res.status(404).send({ error: 'File not found' });
    }
    
    // Process the file based on the requested operation
    let result;
    
    switch (processingType) {
      case 'summary':
        // Generate a summary of the document
        if (file.processedData?.content) {
          // Use existing processed content
          const content = typeof file.processedData.content === 'string' 
            ? file.processedData.content 
            : JSON.stringify(file.processedData.content);
          
          // For a real implementation, you'd call an LLM API here
          result = {
            summary: file.processedData.summary || 'Document summary not available'
          };
        } else {
          result = {
            summary: 'Cannot generate summary for this file type'
          };
        }
        break;
        
      case 'extract':
        // Extract specific information from the document
        if (file.mimetype.includes('text') || file.mimetype.includes('pdf')) {
          // For a real implementation, you'd call an information extraction service here
          result = {
            extracted: {
              // Placeholder for extracted information
              message: 'Information extraction would be performed here'
            }
          };
        } else {
          result = {
            error: 'Cannot extract information from this file type'
          };
        }
        break;
        
      default:
        return res.status(400).send({ error: 'Unsupported processing type' });
    }
    
    res.send(result);
  } catch (error: any) {
    console.error('File processing error:', error);
    res.status(500).send({ error: error.message || 'Error processing file' });
  }
});

// Agent-related routes

// Add a route to execute an agent request
app.post('/api/agent/execute', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { request, conversationId, showThinking = false } = req.body;
    
    if (!req.user) {
      return res.status(401).send({ error: 'Authentication required' });
    }
    
    // In a real implementation, you'd have a full agent system here
    // This is a simplified placeholder implementation
    
    // Simulate agent thinking steps
    const executionPath = {
      steps: [
        {
          task: 'Analyze user request',
          type: 'reasoning',
          model: {
            provider: 'claude',
            model: 'claude-3-opus-20240229'
          },
          reasoning: 'Breaking down user request to determine required actions'
        },
        {
          task: 'Search for relevant information',
          type: 'tool',
          tools: ['WebSearch'],
          reasoning: 'Gathering data needed to answer the query'
        },
        {
          task: 'Synthesize response',
          type: 'reasoning',
          model: {
            provider: 'claude',
            model: 'claude-3-opus-20240229'
          },
          reasoning: 'Combining search results with background knowledge'
        }
      ]
    };
    
    // Simulate agent response
    const response = `I've processed your request: "${request}"\n\nThis is a simulated agent response. In a full implementation, the agent would use multiple LLMs and tools to solve your task.`;
    
    // If part of a conversation, add the messages
    if (conversationId) {
      const conversation = await Conversation.findById(conversationId);
      
      if (conversation && conversation.userId.toString() === req.user._id.toString()) {
        // Add user message
        conversation.messages.push({
          role: 'user',
          content: request,
          timestamp: new Date()
        });
        
        // Add agent response
        conversation.messages.push({
          role: 'assistant',
          content: response,
          timestamp: new Date(),
          metadata: {
            executionPath
          }
        });
        
        conversation.updatedAt = new Date();
        await conversation.save();
      }
    }
    
    res.send({
      response,
      executionPath,
      modelUsed: 'claude-3-opus-20240229'
    });
  } catch (error: any) {
    console.error('Agent execution error:', error);
    res.status(500).send({ error: error.message || 'Error executing agent request' });
  }
});

// Add a route to get available agent tools
app.get('/api/agent/tools', auth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).send({ error: 'Authentication required' });
    }
    
    // In a real implementation, this would be fetched from a database
    // or a configuration file based on user permissions
    const tools = [
      {
        id: 'web-search',
        name: 'Web Search',
        description: 'Search the web for information',
        capabilities: ['information-retrieval', 'research']
      },
      {
        id: 'document-analysis',
        name: 'Document Analysis',
        description: 'Analyze and extract information from documents',
        capabilities: ['document-processing', 'information-extraction']
      },
      {
        id: 'calculator',
        name: 'Calculator',
        description: 'Perform mathematical calculations',
        capabilities: ['computation', 'mathematics']
      }
    ];
    
    res.send(tools);
  } catch (error: any) {
    console.error('Get agent tools error:', error);
    res.status(500).send({ error: error.message || 'Error retrieving agent tools' });
  }
});

// Add a route to get agent execution history
app.get('/api/agent/history', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId } = req.query;
    
    if (!req.user) {
      return res.status(401).send({ error: 'Authentication required' });
    }
    
    // In a real implementation, you'd have a dedicated collection for agent executions
    // This is a simplified implementation using the conversation messages
    
    if (conversationId) {
      const conversation = await Conversation.findOne({ 
        _id: conversationId, 
        userId: req.user._id 
      });
      
      if (!conversation) {
        return res.status(404).send({ error: 'Conversation not found' });
      }
      
      // Extract agent executions from conversation messages
      const agentExecutions = conversation.messages
        .filter(msg => 
          msg.role === 'assistant' && 
          msg.metadata?.executionPath
        )
        .map(msg => ({
          id: msg._id,
          timestamp: msg.timestamp,
          request: conversation.messages.find(m => 
            m.role === 'user' && 
            m.timestamp < msg.timestamp
          )?.content || '',
          response: msg.content,
          executionPath: msg.metadata.executionPath
        }));
      
      res.send(agentExecutions);
    } else {
      // In a real implementation, you'd query a dedicated collection
      // This is a placeholder that returns an empty array
      res.send([]);
    }
  } catch (error: any) {
    console.error('Get agent history error:', error);
    res.status(500).send({ error: error.message || 'Error retrieving agent history' });
  }
});

// LLM API implementation functions
async function callClaudeApi(messages: Message[], apiKey: string, settings: LLMSettings = {}): Promise<{ content: string }> {
  try {
    // Format messages for Claude API
    const formattedMessages = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));
    
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: settings.model || 'claude-3-opus-20240229',
      messages: formattedMessages,
      max_tokens: settings.maxTokens || 1000,
      temperature: settings.temperature || 0.7
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    });
    
    return { content: response.data.content[0].text };
  } catch (error: any) {
    console.error('Claude API Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || 'Error calling Claude API');
  }
}

async function callOpenAIApi(messages: Message[], apiKey: string, settings: LLMSettings = {}): Promise<{ content: string }> {
  try {
    // Format messages for OpenAI API
    const formattedMessages = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 
            msg.role === 'system' ? 'system' : 'assistant',
      content: msg.content
    }));
    
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: settings.model || 'gpt-4',
      messages: formattedMessages,
      max_tokens: settings.maxTokens || 1000,
      temperature: settings.temperature || 0.7
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    return { content: response.data.choices[0].message.content };
  } catch (error: any) {
    console.error('OpenAI API Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || 'Error calling OpenAI API');
  }
}

async function callGeminiApi(messages: Message[], apiKey: string, settings: LLMSettings = {}): Promise<{ content: string }> {
  try {
    // Format messages for Gemini API
    const formattedMessages = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));
    
    const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${settings.model || 'gemini-pro'}:generateContent`, {
      contents: formattedMessages,
      generationConfig: {
        temperature: settings.temperature || 0.7,
        maxOutputTokens: settings.maxTokens || 1000,
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      }
    });
    
    return { content: response.data.candidates[0].content.parts[0].text };
  } catch (error: any) {
    console.error('Gemini API Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || 'Error calling Gemini API');
  }
}

async function callDeepSeekApi(messages: Message[], apiKey: string, settings: LLMSettings = {}): Promise<{ content: string }> {
  try {
    // Format messages for DeepSeek API (assuming similar to OpenAI format)
    const formattedMessages = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));
    
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: settings.model || 'deepseek-chat',
      messages: formattedMessages,
      max_tokens: settings.maxTokens || 1000,
      temperature: settings.temperature || 0.7
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    return { content: response.data.choices[0].message.content };
  } catch (error: any) {
    console.error('DeepSeek API Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || 'Error calling DeepSeek API');
  }
}

async function callHuggingFaceApi(messages: Message[], apiKey: string, settings: LLMSettings = {}): Promise<{ content: string }> {
  try {
    // Consolidate messages for Hugging Face
    const prompt = messages.map(msg => 
      `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
    ).join('\n');
    
    const response = await axios.post(`https://api-inference.huggingface.co/models/${settings.model || 'meta-llama/Llama-2-70b-chat-hf'}`, {
      inputs: prompt,
      parameters: {
        max_new_tokens: settings.maxTokens || 1000,
        temperature: settings.temperature || 0.7,
        return_full_text: false
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    return { content: response.data[0].generated_text };
  } catch (error: any) {
    console.error('Hugging Face API Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Error calling Hugging Face API');
  }
}

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));