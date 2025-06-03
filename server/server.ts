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

// Assuming these are correctly set up from previous steps
import { processFile } from './services/documentProcessor';
// import { AgentOrchestrator } from './src/agent/AgentOrchestrator';
// import { WebSearchTool } from './src/agent/tools/WebSearchTool';
// import { DocumentAnalysisTool } from './src/agent/tools/DocumentAnalysisTool';
// import { Task } from './src/agent/Task';

// Middleware and utilities
import errorHandler, { OperationalError } from './src/middleware/errorHandler';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { body, param, query, validationResult, matchedData } from 'express-validator';

// Load environment variables
dotenv.config();

// Validate essential environment variables
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) { // Ensure JWT_SECRET is set and reasonably long
  console.error('FATAL ERROR: JWT_SECRET is not defined or is too short (min 32 characters recommended). Please set it in your .env file.');
  process.exit(1); // Exit if secret is insecure
}

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
  metadata?: Record<string, any>; // For agent execution path, etc.
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
  // processedData?: any; // This was in the original, but not in schema. Re-evaluating.
}

// Define interfaces for different request body types
interface ConversationRequestBody {
  conversationId: any;
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

// Apply essential security headers with Helmet
app.use(helmet());

app.use(cors());
app.use(express.json());

// Async handler utility
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// Rate Limiting Configurations
const authRateLimitWindowMs = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`);
const resourceIntensiveRateLimitWindowMs = parseInt(process.env.LLM_API_RATE_LIMIT_WINDOW_MS || `${60 * 60 * 1000}`);
const generalApiRateLimitWindowMs = parseInt(process.env.GENERAL_API_RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`);

const createRateLimiter = (windowMs: number, max: number, message: string, keyGenerator?: (req: AuthRequest) => string) => {
  return rateLimit({
    windowMs,
    max,
    message: { status: 'fail', errorType: 'RateLimitExceeded', message },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: (req, res, next, options) => {
      // Explicitly pass the status code from options if available (it's set by express-rate-limit)
      throw new OperationalError(options.message.message, options.statusCode, options.message.errorType);
    }
  });
};

const authLimiter = createRateLimiter(authRateLimitWindowMs, parseInt(process.env.AUTH_RATE_LIMIT_MAX || "20"), 'Too many login or registration attempts from this IP, please try again after 15 minutes.');
const llmApiLimiter = createRateLimiter(resourceIntensiveRateLimitWindowMs, parseInt(process.env.LLM_API_RATE_LIMIT_MAX || "100"), 'Too many requests to LLM services from this account, please try again later.', (req: AuthRequest) => req.user?._id?.toString() || req.ip);
const agentExecuteLimiter = createRateLimiter(resourceIntensiveRateLimitWindowMs, parseInt(process.env.AGENT_RATE_LIMIT_MAX || "60"), 'Too many agent execution requests from this account, please try again later.', (req: AuthRequest) => req.user?._id?.toString() || req.ip);
const fileUploadLimiter = createRateLimiter(resourceIntensiveRateLimitWindowMs, parseInt(process.env.FILE_UPLOAD_RATE_LIMIT_MAX || "50"), 'Too many file uploads from this account, please try again later.', (req: AuthRequest) => req.user?._id?.toString() || req.ip);
const generalApiLimiter = createRateLimiter(generalApiRateLimitWindowMs, parseInt(process.env.GENERAL_API_RATE_LIMIT_MAX || "200"), 'Too many requests from this IP, please try again after 15 minutes.');

app.use('/api', generalApiLimiter); // Apply general limiter to all /api routes by default

// Configure file uploads
const storage = multer.diskStorage({
  destination: (req: AuthRequest, file: Express.Multer.File, cb: Function) => {
    const userId = req.user?.id;
    if (!userId) { // Should be caught by auth middleware, but as a safeguard
        return cb(new OperationalError('User not authenticated for file upload destination', 401, 'AUTH_REQUIRED'));
    }
    const userDir = path.join(__dirname, 'uploads', userId.toString());
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb: Function) => {
    cb(null, Date.now() + '-' + path.parse(file.originalname).name.replace(/[^a-zA-Z0-9_.-]/g, '_') + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: parseInt(process.env.FILE_SIZE_LIMIT_BYTES || `${10 * 1024 * 1024}`) }, // e.g. 10MB limit
  fileFilter: (req: Request, file: Express.Multer.File, cb: Function) => {
    const allowedTypes = [
      'text/plain', 'text/csv', 'application/json',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg', 'image/png', 'image/gif'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      // Pass an OperationalError to be caught by the main error handler
      cb(new OperationalError('Invalid file type. Only text, documents, spreadsheets, and common image types are allowed.', 400, 'INVALID_FILE_TYPE'));
    }
  }
});


// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || '')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err)); // This initial connection error is logged, server might fail to start or operate correctly.

// Define Schemas
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const ApiKeySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  provider: { type: String, required: true, trim: true },
  apiKey: { type: String, required: true, trim: true }, // API keys themselves are not typically 'escaped'
  createdAt: { type: Date, default: Date.now }
});

const ConversationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, default: 'New Conversation', trim: true },
  messages: [{
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true, trim: true },
    model: { type: String, trim: true },
    timestamp: { type: Date, default: Date.now },
    metadata: { type: mongoose.Schema.Types.Mixed }
  }],
  summary: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const FileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
  filename: { type: String, required: true }, // Name on disk
  originalName: { type: String, required: true, trim: true }, // Original name from user
  mimetype: { type: String, required: true },
  path: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now }
});

// Create models
const User = mongoose.model<UserDocument>('User', UserSchema);
const ApiKey = mongoose.model<ApiKeyDocument>('ApiKey', ApiKeySchema);
const Conversation = mongoose.model<ConversationDocument>('Conversation', ConversationSchema);
const File = mongoose.model<FileDocument>('File', FileSchema);

// Authentication middleware
const auth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const header = req.header('Authorization');
    if (!header) {
      throw new OperationalError('No authorization header', 401, 'AUTH_HEADER_MISSING');
    }
    const token = header.replace('Bearer ', '');
    // JWT_SECRET is already validated at startup, so it should exist here.
    const decoded = jwt.verify(token, JWT_SECRET!) as { id: string }; // Use non-null assertion
    const user = await User.findById(decoded.id);
    if (!user) {
      throw new OperationalError('User not found or token invalid', 401, 'AUTH_USER_NOT_FOUND');
    }
    req.token = token;
    req.user = user;
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      next(new OperationalError(error.message, 401, error.name));
    } else if (!(error instanceof OperationalError)) {
      next(new OperationalError(error.message || 'Authentication failed', (error as any).statusCode || 401, 'AUTH_ERROR'));
    } else {
      next(error);
    }
  }
};

// Validation middleware helper
const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => ({ field: (err as any).path, message: err.msg }));
    throw new OperationalError('Input validation failed', 400, 'VALIDATION_ERROR_DETAILS', { errors: errorMessages });
  }
  next();
};


// === User Routes ===
app.post('/api/users/register',
  authLimiter,
  [
    body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters.').escape(),
    body('email').isEmail().withMessage('Please provide a valid email address.').normalizeEmail(),
    body('password').isLength({ min: 6, max: 100 }).withMessage('Password must be between 6 and 100 characters.')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    const { username, email, password } = req.body; // Already validated and potentially sanitized
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      throw new OperationalError('User with this email or username already exists', 409, 'USER_ALREADY_EXISTS');
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();
    const token = jwt.sign({ id: user._id }, JWT_SECRET!, { expiresIn: '7d' }); // Use validated JWT_SECRET
    res.status(201).send({ token, user: { id: user._id, username: user.username, email: user.email } });
  })
);

app.post('/api/users/login',
  authLimiter,
  [
    body('email').isEmail().withMessage('Please provide a valid email address.').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required.')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new OperationalError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }
    const token = jwt.sign({ id: user._id }, JWT_SECRET!, { expiresIn: '7d' }); // Use validated JWT_SECRET
    res.send({ token, user: { id: user._id, username: user.username, email: user.email } });
  })
);

// === API Key Routes ===
app.post('/api/keys',
  auth,
  [
    body('provider').trim().notEmpty().withMessage('Provider is required.').isString().escape(),
    body('apiKey').trim().notEmpty().withMessage('API key is required.').isString() // API keys are sensitive, avoid excessive logging or escaping that might alter them
  ],
  validate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { provider, apiKey } = req.body; // Use validated and sanitized data
    if (!req.user) throw new OperationalError('User not authenticated', 401, 'AUTH_REQUIRED'); // Should be caught by auth
    
    const existingKey = await ApiKey.findOne({ userId: req.user._id, provider });
    if (existingKey) {
      existingKey.apiKey = apiKey;
      await existingKey.save();
    } else {
      const newKey = new ApiKey({ userId: req.user._id, provider, apiKey });
      await newKey.save();
    }
    res.status(existingKey ? 200 : 201).send({ success: true, provider });
  })
);

app.get('/api/keys', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new OperationalError('User not authenticated', 401, 'AUTH_REQUIRED');
  const keys = await ApiKey.find({ userId: req.user._id });
  res.send({ providers: keys.map(key => key.provider) });
}));


// === LLM API proxy routes ===
app.post('/api/chat/:provider',
  auth,
  llmApiLimiter,
  [
    param('provider').trim().notEmpty().escape().withMessage('Provider in URL path is required.'),
    body('messages').isArray({ min: 1 }).withMessage('Messages array must not be empty.'),
    body('messages.*.role').isIn(['user', 'assistant', 'system']).withMessage('Invalid message role.'),
    body('messages.*.content').trim().notEmpty().withMessage('Message content cannot be empty.'), // Avoid escaping potentially complex/code content
    body('settings.model').optional().trim().isString().escape(),
    body('settings.temperature').optional().isFloat({ min: 0, max: 2 }).withMessage('Temperature must be between 0 and 2.'),
    body('settings.maxTokens').optional().isInt({ min: 1, max: 8000 }).withMessage('Max tokens must be a positive integer (max 8000).')
  ],
  validate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { provider } = req.params as { provider: string }; // Validated
    const { messages, settings } = req.body as ChatRequestBody; // Validated

    if (!req.user) throw new OperationalError('User not authenticated', 401, 'AUTH_REQUIRED');
    const apiKeyDoc = await ApiKey.findOne({ userId: req.user._id, provider });
    if (!apiKeyDoc) {
      throw new OperationalError(`No API key found for ${provider}. Please add it in settings.`, 400, 'API_KEY_MISSING');
    }

    let llmResponse;
    switch (provider) {
      case 'claude': llmResponse = await callClaudeApi(messages, apiKeyDoc.apiKey, settings); break;
      case 'openai': llmResponse = await callOpenAIApi(messages, apiKeyDoc.apiKey, settings); break;
      case 'gemini': llmResponse = await callGeminiApi(messages, apiKeyDoc.apiKey, settings); break;
      case 'deepseek': llmResponse = await callDeepSeekApi(messages, apiKeyDoc.apiKey, settings); break;
      case 'huggingface': llmResponse = await callHuggingFaceApi(messages, apiKeyDoc.apiKey, settings); break;
      default: throw new OperationalError(`Unknown provider: ${provider}`, 400, 'UNKNOWN_PROVIDER');
    }
    res.send(llmResponse);
  })
);

// === File Routes ===
const handleMulterError = (err: any, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            throw new OperationalError('File too large. Max size is 10MB.', 400, 'FILE_SIZE_LIMIT_EXCEEDED');
        }
        throw new OperationalError(err.message, 400, 'MULTER_ERROR');
    } else if (err && err instanceof OperationalError && err.errorCode === 'INVALID_FILE_TYPE') {
        // This comes from our custom fileFilter
        throw err;
    } else if (err) {
        next(err); // Other unexpected errors
    }
    next(); // No error or error already handled by OperationalError
};

app.post('/api/files/upload',
  auth,
  fileUploadLimiter,
  upload.single('file'), // Multer middleware for file handling
  handleMulterError, // Custom multer error handler
  [
    body('conversationId').optional().isMongoId().withMessage('Invalid Conversation ID format.')
  ],
  validate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { conversationId } = req.body; // Validated
    if (!req.user || !req.file) {
      throw new OperationalError('User not authenticated or no file provided', 400, 'UPLOAD_PARAMS_MISSING');
    }
    const processedData = await processFile(req.file.path, req.file.mimetype);
    if ((processedData as any).error) {
        throw new OperationalError(`Failed to process file: ${(processedData as any).error}`, 500, 'FILE_PROCESSING_FAILED');
    }
    const file = new File({
      userId: req.user._id,
      conversationId: conversationId || null,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      path: req.file.path,
      size: req.file.size,
    });
    await file.save();
    if (conversationId) {
      const conversation = await Conversation.findById(conversationId);
      if (conversation && conversation.userId.toString() === req.user._id.toString()) {
        conversation.messages.push({
          role: 'system',
          content: `File uploaded: ${req.file.originalname} (${(processedData as any).summary || 'file uploaded'})`,
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
      summary: (processedData as any).summary,
      reference: `file_${file._id}`
    });
  })
);

app.get('/api/files/:fileId/download',
  auth,
  [ param('fileId').isMongoId().withMessage('Invalid File ID format.') ],
  validate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { fileId } = req.params as { fileId: string }; // Validated
    if (!req.user) throw new OperationalError('User not authenticated', 401, 'AUTH_REQUIRED');
    const file = await File.findOne({ _id: fileId, userId: req.user._id });
    if (!file) {
      throw new OperationalError('File not found or access denied', 404, 'FILE_NOT_FOUND');
    }
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.sendFile(file.path);
  })
);

app.get('/api/files',
  auth,
  [ query('conversationId').optional().isMongoId().withMessage('Invalid Conversation ID format.') ],
  validate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { conversationId } = req.query as { conversationId?: string }; // Validated
    if (!req.user) throw new OperationalError('User not authenticated', 401, 'AUTH_REQUIRED');
    const queryFilter: any = { userId: req.user._id };
    if (conversationId) {
      queryFilter.conversationId = conversationId;
    }
    const files = await File.find(queryFilter).sort({ uploadedAt: -1 }).limit(100); // Added limit
    res.send(files.map(f => ({
      _id: f._id, originalName: f.originalName, mimetype: f.mimetype,
      size: f.size, uploadedAt: f.uploadedAt,
      // summary: (f as any).processedData?.summary || 'File uploaded' // 'processedData' is not in FileSchema
    })));
  })
);

app.post('/api/files/:fileId/process',
  auth,
  [
    param('fileId').isMongoId().withMessage('Invalid File ID format.'),
    body('processingType').trim().notEmpty().isString().escape().withMessage('Processing type is required.'),
    body('options').optional().isObject().withMessage('Options must be an object if provided.')
  ],
  validate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { fileId } = req.params as { fileId: string }; // Validated
    const { processingType, options } = req.body; // Validated
    if (!req.user) throw new OperationalError('User not authenticated', 401, 'AUTH_REQUIRED');
    const file = await File.findOne({ _id: fileId, userId: req.user._id });
    if (!file) {
      throw new OperationalError('File not found or access denied', 404, 'FILE_NOT_FOUND');
    }
    // Placeholder for actual file processing logic based on 'processingType'
    const fileData = { content: "Simulated content from file " + file.originalName, summary: "Simulated summary for " + file.originalName }; // Placeholder
    let result;
    switch (processingType) {
      case 'summary':
        if (fileData?.content) result = { summary: fileData.summary || 'Document summary not available' };
        else throw new OperationalError('Cannot generate summary for this file type or content not available', 400, 'SUMMARY_UNAVAILABLE');
        break;
      case 'extract':
        if (file.mimetype.includes('text') || file.mimetype.includes('pdf')) result = { extracted: { message: 'Information extraction would be performed here (placeholder)' }};
        else throw new OperationalError('Cannot extract information from this file type', 400, 'EXTRACTION_UNSUPPORTED_TYPE');
        break;
      default:
        throw new OperationalError('Unsupported processing type requested', 400, 'UNSUPPORTED_PROCESSING_TYPE');
    }
    res.send(result);
  })
);

// === Agent-related routes ===
// Assuming AgentOrchestrator and Task are defined/imported from previous steps
// const agentOrchestrator = new AgentOrchestrator([new WebSearchTool(), new DocumentAnalysisTool()]); // Placeholder initialization

app.post('/api/agent/execute',
  auth,
  agentExecuteLimiter,
  [
    body('request').trim().notEmpty().isString().withMessage('Request content cannot be empty.'), // Avoid escaping complex agent requests
    body('conversationId').optional().isMongoId().withMessage('Invalid Conversation ID format.'),
    body('showThinking').optional().isBoolean().toBoolean() // Converts to boolean
  ],
  validate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { request: userInput, conversationId, showThinking } = req.body; // Validated
    if (!req.user) throw new OperationalError('User not authenticated', 401, 'AUTH_REQUIRED');

    // const task: Task = { // Assuming Task interface exists
    //   id: new mongoose.Types.ObjectId().toString(),
    //   userInput,
    //   status: 'pending',
    //   createdAt: new Date(),
    // };
    // const agentResponse = await agentOrchestrator.processTask(task); // Actual call

    // Mock response if AgentOrchestrator is not fully set up
    const agentResponse = {
        taskId: new mongoose.Types.ObjectId().toString(),
        response: `Mock agent response for: ${userInput}`,
        executionPath: [{ toolName: 'mockTool', input: {userInput}, output: 'mock output', status: 'success', timestamp: new Date() }],
        error: undefined
    };

    if (conversationId) {
      const conversation = await Conversation.findById(conversationId);
      if (conversation && conversation.userId.toString() === req.user._id.toString()) {
        conversation.messages.push({ role: 'user', content: userInput, timestamp: new Date() });
        conversation.messages.push({ role: 'assistant', content: agentResponse.response, timestamp: new Date(), metadata: { executionPath: agentResponse.executionPath, taskId: agentResponse.taskId } });
        conversation.updatedAt = new Date();
        await conversation.save();
      }
    }
    res.send(agentResponse);
  })
);

app.get('/api/agent/tools', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new OperationalError('User not authenticated', 401, 'AUTH_REQUIRED');
  // const tools = agentOrchestrator.getAvailableTools(); // Actual call
  const tools = [{name: 'web_search', description: 'Searches the web.'}, {name: 'document_analysis', description: 'Analyzes documents.'}]; // Mock
  res.send(tools.map(tool => ({
    id: tool.name,
    name: tool.name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
    description: tool.description,
    capabilities: []
  })));
}));

app.get('/api/agent/history',
  auth,
  [ query('conversationId').optional().isMongoId().withMessage('Invalid Conversation ID format.') ],
  validate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { conversationId } = req.query as { conversationId?: string }; // Validated
    if (!req.user) throw new OperationalError('User not authenticated', 401, 'AUTH_REQUIRED');
    if (conversationId) {
      const conversation = await Conversation.findOne({ _id: conversationId, userId: req.user._id });
      if (!conversation) {
        throw new OperationalError('Conversation not found or access denied', 404, 'CONVERSATION_NOT_FOUND');
      }
      const agentExecutions = conversation.messages
        .filter(msg => msg.role === 'assistant' && msg.metadata?.executionPath)
        .map(msg => ({
          id: (msg as any)._id, timestamp: msg.timestamp,
          request: conversation.messages.find(m => m.role === 'user' && m.timestamp < msg.timestamp)?.content || '',
          response: msg.content, executionPath: msg.metadata.executionPath
        }));
      res.send(agentExecutions);
    } else {
      res.send([]); // Or list all agent interactions for user if applicable
    }
  })
);


// === LLM API implementation functions (placeholders, assuming they throw OperationalError on failure) ===
async function callClaudeApi(messages: Message[], apiKey: string, settings: LLMSettings = {}): Promise<{ content: string }> {
  try {
    const formattedMessages = messages.map(msg => ({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content }));
    const response = await axios.post('https://api.anthropic.com/v1/messages',
      { model: settings.model || 'claude-3-opus-20240229', messages: formattedMessages, max_tokens: settings.maxTokens || 1000, temperature: settings.temperature || 0.7 },
      { headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } }
    );
    return { content: response.data.content[0].text };
  } catch (error: any) {
    console.error('Claude API Error:', error.response?.data || error.message);
    throw new OperationalError(error.response?.data?.error?.message || 'Error calling Claude API', error.response?.status || 500, 'CLAUDE_API_ERROR');
  }
}
async function callOpenAIApi(messages: Message[], apiKey: string, settings: LLMSettings = {}): Promise<{ content: string }> {
  try {
    const formattedMessages = messages.map(msg => ({ role: msg.role === 'user' ? 'user' : (msg.role === 'system' ? 'system' : 'assistant'), content: msg.content }));
    const response = await axios.post('https://api.openai.com/v1/chat/completions',
      { model: settings.model || 'gpt-4', messages: formattedMessages, max_tokens: settings.maxTokens || 1000, temperature: settings.temperature || 0.7 },
      { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` } }
    );
    return { content: response.data.choices[0].message.content };
  } catch (error: any) {
    console.error('OpenAI API Error:', error.response?.data || error.message);
    throw new OperationalError(error.response?.data?.error?.message || 'Error calling OpenAI API', error.response?.status || 500, 'OPENAI_API_ERROR');
  }
}
async function callGeminiApi(messages: Message[], apiKey: string, settings: LLMSettings = {}): Promise<{ content: string }> {
  try {
    const formattedMessages = messages.map(msg => ({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] }));
    const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${settings.model || 'gemini-pro'}:generateContent`,
      { contents: formattedMessages, generationConfig: { temperature: settings.temperature || 0.7, maxOutputTokens: settings.maxTokens || 1000 } },
      { headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey } }
    );
    return { content: response.data.candidates[0].content.parts[0].text };
  } catch (error: any) {
    console.error('Gemini API Error:', error.response?.data || error.message);
    throw new OperationalError(error.response?.data?.error?.message || 'Error calling Gemini API', error.response?.status || 500, 'GEMINI_API_ERROR');
  }
}
async function callDeepSeekApi(messages: Message[], apiKey: string, settings: LLMSettings = {}): Promise<{ content: string }> {
  try {
    const formattedMessages = messages.map(msg => ({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content }));
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions',
      { model: settings.model || 'deepseek-chat', messages: formattedMessages, max_tokens: settings.maxTokens || 1000, temperature: settings.temperature || 0.7 },
      { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` } }
    );
    return { content: response.data.choices[0].message.content };
  } catch (error: any) {
    console.error('DeepSeek API Error:', error.response?.data || error.message);
    throw new OperationalError(error.response?.data?.error?.message || 'Error calling DeepSeek API', error.response?.status || 500, 'DEEPSEEK_API_ERROR');
  }
}
async function callHuggingFaceApi(messages: Message[], apiKey: string, settings: LLMSettings = {}): Promise<{ content: string }> {
  try {
    const prompt = messages.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n');
    const response = await axios.post(`https://api-inference.huggingface.co/models/${settings.model || 'meta-llama/Llama-2-70b-chat-hf'}`,
      { inputs: prompt, parameters: { max_new_tokens: settings.maxTokens || 1000, temperature: settings.temperature || 0.7, return_full_text: false } },
      { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` } }
    );
    return { content: response.data[0].generated_text };
  } catch (error: any) {
    console.error('Hugging Face API Error:', error.response?.data || error.message);
    throw new OperationalError(error.response?.data?.error?.message || 'Error calling Hugging Face API', error.response?.status || 500, 'HUGGINGFACE_API_ERROR');
  }
}

// Register the centralized error handler - THIS MUST BE THE LAST MIDDLEWARE
app.use(errorHandler);

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));