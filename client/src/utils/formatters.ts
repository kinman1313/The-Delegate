// utils/formatters.ts
/**
 * Formats a date to a readable string based on how recent it is
 * @param dateInput - Date object or ISO string
 * @returns Formatted date string
 */
export const formatDate = (dateInput: Date | string): string => {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const now = new Date();
  
  // Check for invalid date
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }
  
  // If today, show time
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // If yesterday
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  
  // If this year, show month and day
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  
  // Otherwise show full date
  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
};

/**
 * Truncates text to a specified length with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text
 */
export const truncateText = (text: string, maxLength = 100): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Formats a file size in bytes to a human-readable string
 * @param bytes - File size in bytes
 * @returns Formatted file size
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Formats a model name for display
 * @param modelId - Model identifier (e.g., 'claude-3-opus-20240229')
 * @returns Formatted model name
 */
export const formatModelName = (modelId: string): string => {
  if (!modelId) return '';
  
  // Handle Claude models
  if (modelId.startsWith('claude-')) {
    // Remove date suffix if present (e.g., -20240229)
    const baseModel = modelId.replace(/-\d{8}$/, '');
    
    // Format model name
    return baseModel
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
  
  // Handle OpenAI models
  if (modelId.startsWith('gpt-')) {
    return modelId
      .replace('gpt-', 'GPT-')
      .replace('-turbo', ' Turbo');
  }
  
  // Handle other models
  return modelId
    .split(/[-\/]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

/**
 * Formats error messages for user display
 * @param error - Error object or message
 * @returns Formatted error message
 */
export const formatErrorMessage = (error: Error | string | unknown): string => {
  if (!error) return 'An unknown error occurred';
  
  if (typeof error === 'string') return error;
  
  // Extract message from Error object
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  
  // Clean up common API error formats
  return message
    .replace(/^Error:\s/, '')
    .replace(/^\d{3}\s?-\s?/, ''); // Remove HTTP status codes
};