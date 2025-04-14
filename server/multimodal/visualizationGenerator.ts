import { callLLMApi } from '../../client/src/services/apiService';
import fs from 'fs/promises';
import path from 'path';

interface VisualizationResult {
  code: string;
  type: string;
  language?: string;
  caption: string;
  dataSize?: number;
  options?: VisualizationOptions;
  error?: string;
  fallbackCode?: string;
}

interface CodeResult {
  code: string;
  language: string;
}

interface VisualizationOptions {
  title?: string;
  [key: string]: any;
}

/**
 * Generate visualization code based on data
 * @param data - Data to visualize
 * @param visualizationType - Type of visualization to generate
 * @param options - Additional options for the visualization
 * @returns Generated visualization code and metadata
 */
export async function generateVisualization(
  data: any[], 
  visualizationType: string, 
  options: VisualizationOptions = {}
): Promise<VisualizationResult> {
  try {
    // Limit data to a reasonable size for the LLM
    const limitedData = limitDataSize(data);
    
    // Create a prompt for the LLM to generate the visualization code
    const prompt = createVisualizationPrompt(limitedData, visualizationType, options);
    
    // Call the LLM API
    const response = await callLLMApi(
      'claude',
      [{ role: 'user', content: prompt }],
      { temperature: 0.2, model: 'claude-3-opus-20240229' }
    );
    
    // Extract code from the response
    const codeResult = extractCodeFromResponse(response.content);
    
    // Generate a description/caption for the visualization
    const caption = await generateVisualizationCaption(
      limitedData, 
      visualizationType, 
      options
    );
    
    return {
      code: codeResult.code,
      type: visualizationType,
      language: codeResult.language,
      caption,
      dataSize: data.length,
      options
    };
  } catch (error) {
    console.error('Error generating visualization:', error);
    return { 
      code: '',
      type: visualizationType,
      caption: `Error generating ${visualizationType} visualization.`,
      error: 'Failed to generate visualization',
      fallbackCode: generateFallbackVisualization(data, visualizationType)
    };
  }
}

/**
 * Generate a fallback visualization if the main generation fails
 * @param data - Data to visualize
 * @param visualizationType - Type of visualization
 * @returns Fallback visualization code
 */
function generateFallbackVisualization(data: any[], visualizationType: string): string {
  // Simple fallback visualization based on the type
  const fallbackCode = `
import React from 'react';
import { 
  ResponsiveContainer, 
  ${visualizationType === 'bar' ? 'BarChart, Bar, XAxis, YAxis, Tooltip, Legend' : 
    visualizationType === 'line' ? 'LineChart, Line, XAxis, YAxis, Tooltip, Legend' :
    visualizationType === 'pie' ? 'PieChart, Pie, Cell, Tooltip, Legend' : 
    'ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, Legend'}
} from 'recharts';

const FallbackVisualization = () => {
  // Simplified data for fallback
  const data = ${JSON.stringify(limitDataSize(data).slice(0, 10), null, 2)};

  return (
    <div className="w-full h-96 bg-white p-4 rounded shadow">
      <h3 className="text-lg font-semibold mb-4">Data Visualization (Fallback)</h3>
      <ResponsiveContainer width="100%" height="80%">
        ${generateChartByType(visualizationType)}
      </ResponsiveContainer>
    </div>
  );
};

export default FallbackVisualization;
  `;
  
  return fallbackCode;
}

/**
 * Generate chart code based on visualization type
 * @param type - Visualization type
 * @returns Chart JSX code
 */
function generateChartByType(type: string): string {
  switch (type) {
    case 'bar':
      return `
        <BarChart data={data}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="value" fill="#8884d8" />
        </BarChart>
      `;
    case 'line':
      return `
        <LineChart data={data}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="value" stroke="#8884d8" />
        </LineChart>
      `;
    case 'pie':
      return `
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" fill="#8884d8" label />
          <Tooltip />
          <Legend />
        </PieChart>
      `;
    default:
      return `
        <ComposedChart data={data}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="value" fill="#8884d8" />
        </ComposedChart>
      `;
  }
}

/**
 * Limit data size for processing by the LLM
 * @param data - Data to limit
 * @returns Limited data
 */
function limitDataSize(data: any): any {
  // If data is an array, limit to 100 items
  if (Array.isArray(data)) {
    const limitedData = data.slice(0, 100);
    
    // If array items are objects, limit keys to 20 per object
    if (limitedData.length > 0 && typeof limitedData[0] === 'object') {
      return limitedData.map(item => {
        const keys = Object.keys(item).slice(0, 20);
        const limitedItem: Record<string, any> = {};
        
        for (const key of keys) {
          limitedItem[key] = item[key];
        }
        
        return limitedItem;
      });
    }
    
    return limitedData;
  }
  
  // If data is an object (like data grouped by category)
  if (typeof data === 'object' && data !== null) {
    const keys = Object.keys(data).slice(0, 30);
    const limitedData: Record<string, any> = {};
    
    for (const key of keys) {
      if (Array.isArray(data[key])) {
        limitedData[key] = data[key].slice(0, 50);
      } else {
        limitedData[key] = data[key];
      }
    }
    
    return limitedData;
  }
  
  return data;
}

/**
 * Create a prompt for generating visualization code
 * @param data - Data to visualize
 * @param visualizationType - Type of visualization
 * @param options - Additional options
 * @returns Prompt for the LLM
 */
function createVisualizationPrompt(
  data: any, 
  visualizationType: string, 
  options: VisualizationOptions
): string {
  const dataString = JSON.stringify(data, null, 2);
  
  // Create a base prompt
  let prompt = `
    You are an expert in data visualization. Generate JavaScript code for a ${visualizationType} 
    visualization using the provided data. Use the React charting library 'recharts' to 
    create the visualization.
    
    Data to visualize:
    ${dataString}
    
    Visualization type: ${visualizationType}
  `;
  
  // Add specific instructions based on visualization type
  switch (visualizationType) {
    case 'bar':
      prompt += `
        Create a bar chart that effectively represents this data.
        Use appropriate axes, labels, and colors.
        Make sure to include a title and legend if needed.
      `;
      break;
      
    case 'line':
      prompt += `
        Create a line chart that shows trends in this data.
        Use appropriate axes, labels, and consider adding points on the line.
        Include hover tooltips and a legend if multiple lines are present.
      `;
      break;
      
    case 'pie':
      prompt += `
        Create a pie chart that shows proportions in this data.
        Use distinct colors and include a legend.
        Add percentage labels if appropriate.
      `;
      break;
      
    case 'scatter':
      prompt += `
        Create a scatter plot to show the relationship between variables.
        Include appropriate axes and labels.
        Consider adding a trend line if relevant.
      `;
      break;
      
    case 'heatmap':
      prompt += `
        Create a heatmap that effectively shows intensity across categories.
        Use a color scale that clearly differentiates values.
        Include a legend that explains the color scale.
      `;
      break;
      
    default:
      prompt += `
        Create an appropriate visualization that best represents this data.
        Use your judgment to determine the most effective chart type.
      `;
  }
  
  // Add any additional options
  if (Object.keys(options).length > 0) {
    prompt += `
      Additional requirements:
      ${JSON.stringify(options, null, 2)}
    `;
  }
  
  // Add final instructions
  prompt += `
    Your response should be clean, production-ready React component code that uses recharts.
    The code should be wrapped in a React functional component that doesn't require any props.
    Use meaningful variable names and include helpful comments.
    Make the chart responsive by using ResponsiveContainer from recharts.
    Only use Tailwind's built-in utility classes for styling (no custom values with square brackets).
    
    Respond only with the code, no explanations or comments outside the code block.
    Format your response as a runnable React component.
  `;
  
  return prompt;
}

/**
 * Extract code from the LLM response
 * @param response - LLM response text
 * @returns Extracted code and language
 */
function extractCodeFromResponse(response: string): CodeResult {
  // Try to extract code from markdown code blocks
  const codeBlockRegex = /```(?:jsx?|tsx?|react)?\s*([\s\S]*?)```/;
  const match = response.match(codeBlockRegex);
  
  if (match && match[1]) {
    return {
      code: match[1].trim(),
      language: 'javascript'
    };
  }
  
  // If no code block found, try to extract what looks like a React component
  const componentRegex = /(?:const|function)\s+\w+\s*=\s*\(?.*?\)?\s*=>\s*{[\s\S]*?return\s*\([\s\S]*?\);?\s*}/;
  const componentMatch = response.match(componentRegex);
  
  if (componentMatch) {
    return {
      code: componentMatch[0],
      language: 'javascript'
    };
  }
  
  // If all else fails, return the whole response
  return {
    code: response,
    language: 'text'
  };
}

/**
 * Generate a caption/description for the visualization
 * @param data - Data being visualized
 * @param visualizationType - Type of visualization
 * @param options - Additional options
 * @returns Generated caption
 */
export async function generateVisualizationCaption(
  data: any, 
  visualizationType: string, 
  options: VisualizationOptions
): Promise<string> {
  try {
    const dataString = JSON.stringify(limitDataSize(data), null, 2);
    
    const prompt = `
      You are an expert in data visualization and communication.
      
      I've created a ${visualizationType} chart with the following data:
      ${dataString}
      
      ${options.title ? `The title of the chart is: "${options.title}"` : ''}
      
      Write a short, insightful caption that:
      1. Summarizes what the visualization shows
      2. Highlights the most important pattern or finding
      3. Provides context about why this is interesting or important
      
      Keep the caption concise but informative, around 2-3 sentences.
    `;
    
    const response = await callLLMApi(
      'claude',
      [{ role: 'user', content: prompt }],
      { temperature: 0.7, model: 'claude-3-opus-20240229' }
    );
    
    return response.content;
  } catch (error) {
    console.error('Error generating visualization caption:', error);
    return `This ${visualizationType} chart visualizes the provided data, showing the relationship between key variables.`;
  }
}

// Export both named and default exports
export default {
  generateVisualization,
  generateVisualizationCaption
};