// utils/validators.js
/**
 * Validates an email address
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
exports.isValidEmail = (email) => {
  if (!email) return false;
  
  // RFC 5322 compliant regex for email validation
  const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return emailRegex.test(email);
};

/**
 * Validates a password
 * @param {string} password - Password to validate
 * @returns {object} Validation result with isValid and errors
 */
exports.validatePassword = (password) => {
  const errors = [];
  
  if (!password) {
    errors.push('Password is required');
    return { isValid: false, errors };
  }
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validates username
 * @param {string} username - Username to validate
 * @returns {object} Validation result with isValid and errors
 */
exports.validateUsername = (username) => {
  const errors = [];
  
  if (!username) {
    errors.push('Username is required');
    return { isValid: false, errors };
  }
  
  if (username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }
  
  if (username.length > 20) {
    errors.push('Username must be at most 20 characters long');
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, and underscores');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validates API key format
 * @param {string} apiKey - API key to validate
 * @param {string} provider - Provider name (claude, openai, etc.)
 * @returns {boolean} True if valid
 */
exports.isValidApiKey = (apiKey, provider) => {
  if (!apiKey) return false;
  
  switch (provider) {
    case 'claude':
      // Claude API keys typically start with 'sk-ant-'
      return apiKey.startsWith('sk-ant-') && apiKey.length > 20;
      
    case 'openai':
      // OpenAI API keys typically start with 'sk-'
      return apiKey.startsWith('sk-') && apiKey.length > 20;
      
    case 'gemini':
      // Google API keys typically are 39 characters
      return apiKey.length >= 20;
      
    case 'huggingface':
      // Hugging Face API keys typically start with 'hf_'
      return apiKey.startsWith('hf_') && apiKey.length > 10;
      
    default:
      // Generic validation - just check length
      return apiKey.length > 8;
  }
};

/**
 * Validates file before upload
 * @param {File} file - File object to validate
 * @param {object} options - Validation options
 * @returns {object} Validation result with isValid and error
 */
exports.validateFile = (file, options = {}) => {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = [
      'text/plain', 'text/csv', 'application/json',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg', 'image/png', 'image/gif'
    ]
  } = options;
  
  if (!file) {
    return { isValid: false, error: 'No file provided' };
  }
  
  if (file.size > maxSize) {
    return { 
      isValid: false, 
      error: `File is too large. Maximum size is ${Math.round(maxSize / (1024 * 1024))}MB` 
    };
  }
  
  if (!allowedTypes.includes(file.type)) {
    return { 
      isValid: false, 
      error: 'Invalid file type. Allowed types: plain text, CSV, JSON, PDF, Word documents, Excel spreadsheets, and images' 
    };
  }
  
  return { isValid: true };
};