// ModelSelector.js
import React from 'react';

const ModelSelector = ({ selectedModel, onModelChange }) => {
  const models = [
    { id: 'claude', name: 'Claude (Anthropic)' },
    { id: 'openai', name: 'ChatGPT (OpenAI)' },
    { id: 'gemini', name: 'Gemini (Google)' },
    { id: 'deepseek', name: 'DeepSeek' },
    { id: 'huggingface', name: 'Hugging Face Models' }
  ];

  return (
    <div className="model-selector">
      <h2>Select Model</h2>
      <div className="model-options">
        {models.map(model => (
          <div 
            key={model.id} 
            className={`model-option ${selectedModel === model.id ? 'selected' : ''}`}
            onClick={() => onModelChange(model.id)}
          >
            <div className="model-icon">{model.name.charAt(0)}</div>
            <div className="model-name">{model.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ModelSelector;
