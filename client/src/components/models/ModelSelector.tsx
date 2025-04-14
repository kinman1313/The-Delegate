// ModelSelector.tsx
import React from 'react';

interface ModelOption {
    id: string;
    name: string;
    provider: string;
    parametersCount?: string; // e.g., "70B" for 70 billion parameters
    contextWindow?: number;    // context window size
    capabilities?: string[];   // e.g., ["text", "vision", "code"]
    description?: string;      // brief description of model strengths
}

interface ModelSelectorProps {
    selectedModel: string;
    onModelChange: (modelId: string) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ selectedModel, onModelChange }) => {
    const models: ModelOption[] = [
        {
            id: 'claude',
            name: 'Claude (Anthropic)',
            provider: 'Anthropic',
            parametersCount: "200B+",
            contextWindow: 100000,
            capabilities: ["text", "vision", "reasoning"],
            description: "Claude excels at thoughtful, nuanced conversations and complex reasoning"
        },
        {
            id: 'openai',
            name: 'ChatGPT (OpenAI)',
            provider: 'OpenAI',
            parametersCount: "175B+",
            contextWindow: 16000,
            capabilities: ["text", "vision", "code"],
            description: "GPT-4 offers strong general capabilities across many domains"
        },
        // Add similar extended information for other models
        { id: 'gemini', name: 'Gemini (Google)', provider: 'Google' },
        { id: 'deepseek', name: 'DeepSeek', provider: 'DeepSeek AI' },
        { id: 'huggingface', name: 'Hugging Face Models', provider: 'Hugging Face' }
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
                        title={model.description || ''}
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
