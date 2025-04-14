# Multi-LLM Frontend Application

This React application provides a unified interface for interacting with multiple Large Language Models (LLMs) including Claude (Anthropic), ChatGPT (OpenAI), Gemini (Google), DeepSeek, and Hugging Face models.

## Features

- **Multi-Model Support**: Switch between different LLM providers with a click
- **Customizable Settings**: Configure API keys, model selection, temperature, max tokens, and other parameters
- **Responsive Design**: Works on both desktop and mobile devices
- **Markdown Support**: Properly formats model responses with code blocks, lists, etc.
- **Local Storage**: Securely saves your API keys and preferences in your browser's local storage
- **Chat History**: View and clear your conversation history

## Setup Instructions

### Prerequisites

- Node.js 14.x or higher
- npm or yarn

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/multi-llm-frontend.git
   cd multi-llm-frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

4. Open your browser and navigate to `http://localhost:3000`

### Required Dependencies

This project requires the following packages:

```
react
react-dom
react-markdown
react-scripts
```

## Usage

1. **Select a Model**: Choose your preferred LLM provider from the sidebar.

2. **Configure Settings**: Click the "Settings" button to enter your API keys and configure model parameters.

3. **Start Chatting**: Type your message in the input box and press "Send" or hit Enter.

4. **Switch Models**: You can switch between different models mid-conversation.

5. **Clear Chat**: Click "Clear Chat" to reset the conversation.

## API Keys

You'll need to obtain API keys from the respective providers to use their models:

- **Anthropic (Claude)**: [https://console.anthropic.com/](https://console.anthropic.com/)
- **OpenAI (ChatGPT)**: [https://platform.openai.com/](https://platform.openai.com/)
- **Google (Gemini)**: [https://makersuite.google.com/](https://makersuite.google.com/)
- **DeepSeek**: [https://platform.deepseek.com/](https://platform.deepseek.com/)
- **Hugging Face**: [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)

## Customization

### Adding More Models

To add support for additional LLM providers:

1. Update the `ModelSelector.js` component to include the new provider
2. Add provider-specific settings in `SettingsPanel.js`
3. Implement the API call function in `apiService.js`

### Styling

The application uses CSS variables for theming. You can customize the appearance by modifying the variables in `App.css`.

## Security Note

API keys are stored in your browser's local storage. While this is convenient, be aware that:

- Local storage is not encrypted
- API keys stored this way are accessible to JavaScript running on the same domain
- For production use, consider implementing a backend service to handle API calls securely

## License

MIT

## Acknowledgments

This project is for educational purposes and is not affiliated with Anthropic, OpenAI, Google, DeepSeek, or Hugging Face.
