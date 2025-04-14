import pdf from 'pdf-parse';
import fs from 'fs/promises';
// Note: pdftables requires a separate type definition or type declaration
import { callLLMApi } from '../../client/src/services/apiService';

// Define interfaces for better type safety
interface TablePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PdfTable {
  pageNumber: number;
  position: TablePosition;
  headers: string[];
  rows: string[][];
}

interface StructuredInfo {
  [key: string]: any;
  error?: string;
}

/**
 * Extract text content from a PDF file
 * @param pdfPath - Path to PDF file
 * @returns Extracted text
 */
export async function extractTextFromPdf(pdfPath: string): Promise<string> {
  try {
    const dataBuffer = await fs.readFile(pdfPath);
    const data = await pdf(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    
    // Fallback to OCR if text extraction fails
    return extractTextWithOCR(pdfPath);
  }
}

/**
 * Extract tables from a PDF file
 * @param pdfPath - Path to PDF file
 * @returns Extracted tables
 */
export async function extractTablesFromPdf(pdfPath: string): Promise<PdfTable[]> {
  try {
    // This would use a PDF table extraction library
    // For this example, we'll simulate the output
    
    return [
      {
        pageNumber: 1,
        position: { x: 100, y: 200, width: 400, height: 300 },
        headers: ['Column 1', 'Column 2', 'Column 3'],
        rows: [
          ['Data 1', 'Data 2', 'Data 3'],
          ['Data 4', 'Data 5', 'Data 6']
        ]
      }
    ];
  } catch (error) {
    console.error('Error extracting tables from PDF:', error);
    return [];
  }
}

/**
 * Extract text from a document using OCR
 * @param filePath - Path to document
 * @returns Extracted text
 */
async function extractTextWithOCR(filePath: string): Promise<string> {
  try {
    // Since we're removing the tesseract dependency, we'll mock the functionality
    console.log('OCR would process file:', filePath);
    return "This text would be extracted by OCR. The actual implementation requires node-tesseract-ocr.";
  } catch (error) {
    console.error('OCR extraction error:', error);
    return 'Error extracting text with OCR';
  }
}

/**
 * Generate a summary of a document
 * @param documentText - Text content of document
 * @returns Document summary
 */
export async function generateDocumentSummary(documentText: string): Promise<string> {
  try {
    // Truncate to a reasonable length for the model
    const truncatedText = documentText.substring(0, 10000);
    
    const summaryPrompt = `
      You are an AI assistant tasked with summarizing documents.
      Provide a concise summary of the following document text.
      Focus on the main points, key information, and overall structure.
      
      Document text:
      ${truncatedText}
      
      Summary:
    `;
    
    const response = await callLLMApi(
      'claude',
      [{ role: 'user', content: summaryPrompt }],
      { temperature: 0.3, model: 'claude-3-opus-20240229' },
      process.env.SERVICE_TOKEN || ''  // Add token parameter
    );
    
    return response.content;
  } catch (error) {
    console.error('Error generating document summary:', error);
    return 'Error generating summary';
  }
}

/**
 * Extract structured information from a document
 * @param documentText - Text content of document
 * @param infoType - Type of information to extract
 * @returns Extracted information
 */
export async function extractStructuredInfo(documentText: string, infoType: string): Promise<StructuredInfo> {
  try {
    const extractionPrompt = `
      You are an AI assistant skilled at extracting structured information from documents.
      Extract the following type of information from the document text: ${infoType}
      
      Document text:
      ${documentText.substring(0, 8000)}
      
      Respond in JSON format with the extracted information.
    `;
    
    const response = await callLLMApi(
      'claude',
      [{ role: 'user', content: extractionPrompt }],
      { temperature: 0.2, model: 'claude-3-opus-20240229' },
      process.env.SERVICE_TOKEN || ''  // Add token parameter
    );
    
    // Parse the JSON response
    try {
      return JSON.parse(response.content);
    } catch (parseError) {
      console.error('Error parsing extracted info:', parseError);
      // Extract JSON-like content from the response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Failed to parse response' };
    }
  } catch (error) {
    console.error('Error extracting structured info:', error);
    return { error: 'Failed to extract information' };
  }
}

// Export all functions
export default {
  extractTextFromPdf,
  extractTablesFromPdf,
  generateDocumentSummary,
  extractStructuredInfo
};