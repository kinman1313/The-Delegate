import mongoose from 'mongoose';

/**
 * Get available language models for a specific user
 * @param userId The user ID to get available models for
 * @returns Array of available language models for the user
 */
export async function getAvailableModels(userId: mongoose.Types.ObjectId) {
  // TODO: Implement actual model fetching logic based on user permissions
  // This could come from a database or environment configuration
  
  return [
    {
      id: 'gpt-4',
      name: 'GPT-4',
      provider: 'openai',
      capabilities: ['text-generation', 'reasoning']
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'openai',
      capabilities: ['text-generation', 'summarization']
    }
  ];
}