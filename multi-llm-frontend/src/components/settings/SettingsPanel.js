// SettingsPanel.js
import React from 'react';

const SettingsPanel = ({ settings, selectedModel, onSettingsChange }) => {
  const currentSettings = settings[selectedModel];
  
  // Define model-specific settings
  const modelOptions = {
    openai: [
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
    ],
    huggingface: [
      { id: 'meta-llama/Llama-2-70b-chat-hf', name: 'Llama 2 (70B)' },
      { id: 'meta-llama/Llama-2-13b-chat-hf', name: 'Llama 2 (13B)' },
      { id: 'meta-llama/Llama-2-7b-chat-hf', name: 'Llama 2 (7B)' },
      { id: 'mistralai/Mistral-7B-Instruct-v0.1', name: 'Mistral 7B' },
      { id: 'tiiuae/falcon-40b-instruct', name: 'Falcon 40B' }
    ],
    claude: [
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
      { id: 'claude-2.1', name: 'Claude 2.1' }
    ],
    gemini: [
      { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
    ],
    deepseek: [
      { id: 'deepseek-coder', name: 'DeepSeek Coder' },
      { id: 'deepseek-chat', name: 'DeepSeek Chat' }
    ]
  };

  const renderApiKeyInput = () => (
    <div className="settings-group">
      <label>API Key</label>
      <input
        type="password"
        value={currentSettings.apiKey}
        onChange={(e) => onSettingsChange(selectedModel, 'apiKey', e.target.value)}
        placeholder={`Enter your ${selectedModel} API Key`}
      />
      <p className="settings-help">
        This will be stored in your browser's local storage.
      </p>
    </div>
  );

  const renderModelSelection = () => {
    // Only show model selection for OpenAI, Hugging Face, Claude, Gemini, DeepSeek
    if (['openai', 'huggingface', 'claude', 'gemini', 'deepseek'].includes(selectedModel) && modelOptions[selectedModel]) {
      return (
        <div className="settings-group">
          <label>Model</label>
          <select
            value={currentSettings.model || modelOptions[selectedModel][0].id}
            onChange={(e) => onSettingsChange(selectedModel, 'model', e.target.value)}
          >
            {modelOptions[selectedModel].map(option => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="settings-panel">
      <h2>Settings for {selectedModel.charAt(0).toUpperCase() + selectedModel.slice(1)}</h2>
      
      {renderApiKeyInput()}
      {renderModelSelection()}
      
      <div className="settings-group">
        <label>Temperature</label>
        <div className="range-with-value">
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={currentSettings.temperature}
            onChange={(e) => onSettingsChange(selectedModel, 'temperature', parseFloat(e.target.value))}
          />
          <span>{currentSettings.temperature}</span>
        </div>
        <p className="settings-help">
          Controls randomness: 0 is deterministic, 1 is more creative.
        </p>
      </div>
      
      <div className="settings-group">
        <label>Max Tokens</label>
        <input
          type="number"
          min="1"
          max="8000"
          value={currentSettings.maxTokens}
          onChange={(e) => onSettingsChange(selectedModel, 'maxTokens', parseInt(e.target.value))}
        />
        <p className="settings-help">
          Maximum length of the model's response.
        </p>
      </div>
      
      {/* Model-specific advanced settings could go here */}
      
      <div className="settings-actions">
        <button
          onClick={() => {
            if (window.confirm('Are you sure you want to clear all settings including API keys?')) {
              localStorage.removeItem('llmSettings');
              window.location.reload();
            }
          }}
          className="danger-btn"
        >
          Reset All Settings
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;
