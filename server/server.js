// server.js - Express backend for Multi-LLM Frontend
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Configure file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.user.id;
    const userDir = path.join(__dirname, 'uploads', userId);
    
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
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
mongoose.connect(process.env.MONGODB_URI)
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
const User = mongoose.model('User', UserSchema);
const ApiKey = mongoose.model('ApiKey', ApiKeySchema);
const Conversation = mongoose.model('Conversation', ConversationSchema);
const File = mongoose.model('File', FileSchema);

// Authentication middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
app.post('/api/users/register', async (req, res) => {
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
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).send({ token, user: { id: user._id, username: user.username, email: user.email } });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.post('/api/users/login', async (req, res) => {
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
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.send({ token, user: { id: user._id, username: user.username, email: user.email } });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// API Key Routes
app.post('/api/keys', auth, async (req, res) => {
  try {
    const { provider, apiKey } = req.body;
    
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
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.get('/api/keys', auth, async (req, res) => {
  try {
    // Only return the providers for which keys exist (not the actual keys)
    const keys = await ApiKey.find({ userId: req.user._id });
    const providers = keys.map(key => key.provider);
    
    res.send({ providers });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// LLM API proxy routes
app.post('/api/chat/:provider', auth, async (req, res) => {
  try {
    const { provider } = req.params;
    const { messages, settings } = req.body;
    
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
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// File upload route
app.post('/api/files/upload', auth, upload.single('file'), async (req, res) => {
  try {
    const { conversationId } = req.body;
    
    // Save file metadata to database
    const file = new File({
      userId: req.user._id,
      conversationId: conversationId || null,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      path: req.file.path,
      size: req.file.size
    });
    
    await file.save();
    
    // If part of a conversation, add a system message about the file
    if (conversationId) {
      const conversation = await Conversation.findById(conversationId);
      
      if (conversation && conversation.userId.toString() === req.user._id.toString()) {
        conversation.messages.push({
          role: 'system',
          content: `File uploaded: ${req.file.originalname}`,
          timestamp: new Date()
        });
        
        conversation.updatedAt = new Date();
        await conversation.save();
      }
    }
    
    res.status(201).send({
      fileId: file._id,
      filename: file.originalName,
      type: file.mimetype
    });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// File download route
app.get('/api/files/:id', auth, async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.id, userId: req.user._id });
    
    if (!file) {
      return res.status(404).send({ error: 'File not found' });
    }
    
    res.download(file.path, file.originalName);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Conversation routes
app.post('/api/conversations', auth, async (req, res) => {
  try {
    const { title, messages } = req.body;
    
    const conversation = new Conversation({
      userId: req.user._id,
      title: title || 'New Conversation',
      messages: messages || []
    });
    
    await conversation.save();
    
    res.status(201).send(conversation);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.get('/api/conversations', auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({ userId: req.user._id })
      .select('_id title summary createdAt updatedAt')
      .sort({ updatedAt: -1 });
    
    res.send(conversations);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.get('/api/conversations/:id', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });
    
    if (!conversation) {
      return res.status(404).send({ error: 'Conversation not found' });
    }
    
    // Get any files associated with this conversation
    const files = await File.find({ 
      conversationId: conversation._id,
      userId: req.user._id
    }).select('_id originalName mimetype uploadedAt');
    
    res.send({ conversation, files });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.put('/api/conversations/:id', auth, async (req, res) => {
  try {
    const { title, messages, summary } = req.body;
    
    const conversation = await Conversation.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });
    
    if (!conversation) {
      return res.status(404).send({ error: 'Conversation not found' });
    }
    
    if (title) conversation.title = title;
    if (messages) conversation.messages = messages;
    if (summary) conversation.summary = summary;
    
    conversation.updatedAt = new Date();
    await conversation.save();
    
    res.send(conversation);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.post('/api/conversations/:id/messages', auth, async (req, res) => {
  try {
    const { role, content, model } = req.body;
    
    const conversation = await Conversation.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });
    
    if (!conversation) {
      return res.status(404).send({ error: 'Conversation not found' });
    }
    
    // Add new message
    conversation.messages.push({
      role,
      content,
      model,
      timestamp: new Date()
    });
    
    conversation.updatedAt = new Date();
    
    // If conversation is getting long, generate a summary
    if (conversation.messages.length >= 10 && !conversation.summary) {
      try {
        // Get a summary of the conversation using one of the LLMs
        const apiKey = await ApiKey.findOne({ userId: req.user._id });
        
        if (apiKey) {
          const provider = apiKey.provider;
          const recentMessages = conversation.messages.slice(-10);
          
          const summaryPrompt = {
            role: 'user',
            content: `Please provide a brief 1-2 sentence summary of this conversation. The summary should capture the main topic and important points discussed.\n\nConversation:\n${recentMessages.map(m => `${m.role}: ${m.content}`).join('\n')}`
          };
          
          let summarizationResponse;
          
          switch (provider) {
            case 'claude':
              summarizationResponse = await callClaudeApi([summaryPrompt], apiKey.apiKey, { temperature: 0.3 });
              break;
            case 'openai':
              summarizationResponse = await callOpenAIApi([summaryPrompt], apiKey.apiKey, { temperature: 0.3 });
              break;
            default:
              // Skip summary if preferred provider not available
              break;
          }
          
          if (summarizationResponse && summarizationResponse.content) {
            conversation.summary = summarizationResponse.content;
          }
        }
      } catch (summaryError) {
        // Fail silently if summary generation fails
        console.error('Error generating summary:', summaryError);
      }
    }
    
    await conversation.save();
    
    res.status(201).send(conversation);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.delete('/api/conversations/:id', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user._id 
    });
    
    if (!conversation) {
      return res.status(404).send({ error: 'Conversation not found' });
    }
    
    // Delete any associated files
    const files = await File.find({ conversationId: req.params.id });
    
    for (const file of files) {
      // Delete the file from disk
      fs.unlinkSync(file.path);
      
      // Delete the file record
      await File.findByIdAndDelete(file._id);
    }
    
    res.send({ success: true });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Conversation summary route
app.post('/api/conversations/:id/summarize', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });
    
    if (!conversation) {
      return res.status(404).send({ error: 'Conversation not found' });
    }
    
    // Get the user's API keys
    const apiKey = await ApiKey.findOne({ userId: req.user._id });
    
    if (!apiKey) {
      return res.status(400).send({ error: 'No API key found' });
    }
    
    // Create a summary prompt
    const recentMessages = conversation.messages.slice(-20); // Use last 20 messages
    
    const summaryPrompt = {
      role: 'user',
      content: `Please provide a concise summary of this conversation. Capture the main topics and key points discussed.\n\nConversation:\n${recentMessages.map(m => `${m.role}: ${m.content}`).join('\n')}`
    };
    
    // Generate summary using one of the available LLMs
    let summarizationResponse;
    
    switch (apiKey.provider) {
      case 'claude':
        summarizationResponse = await callClaudeApi([summaryPrompt], apiKey.apiKey, { temperature: 0.3 });
        break;
      case 'openai':
        summarizationResponse = await callOpenAIApi([summaryPrompt], apiKey.apiKey, { temperature: 0.3 });
        break;
      case 'gemini':
        summarizationResponse = await callGeminiApi([summaryPrompt], apiKey.apiKey, { temperature: 0.3 });
        break;
      default:
        return res.status(400).send({ error: `Provider ${apiKey.provider} doesn't support summarization` });
    }
    
    if (summarizationResponse && summarizationResponse.content) {
      conversation.summary = summarizationResponse.content;
      await conversation.save();
      
      res.send({ summary: conversation.summary });
    } else {
      res.status(500).send({ error: 'Failed to generate summary' });
    }
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// LLM API implementation functions
async function callClaudeApi(messages, apiKey, settings = {}) {
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
  } catch (error) {
    console.error('Claude API Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || 'Error calling Claude API');
  }
}

async function callOpenAIApi(messages, apiKey, settings = {}) {
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
  } catch (error) {
    console.error('OpenAI API Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || 'Error calling OpenAI API');
  }
}

async function callGeminiApi(messages, apiKey, settings = {}) {
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
  } catch (error) {
    console.error('Gemini API Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || 'Error calling Gemini API');
  }
}

async function callDeepSeekApi(messages, apiKey, settings = {}) {
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
  } catch (error) {
    console.error('DeepSeek API Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || 'Error calling DeepSeek API');
  }
}

async function callHuggingFaceApi(messages, apiKey, settings = {}) {
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
  } catch (error) {
    console.error('Hugging Face API Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Error calling Hugging Face API');
  }
}

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
