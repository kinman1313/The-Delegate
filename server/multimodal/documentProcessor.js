// multimodal/documentProcessor.js
const pdf = require('pdf-parse');
const fs = require('fs/promises');
const pdfTable = require('pdftables');
const tesseract = require('node-tesseract-ocr');
const { callLLMApi } = require('../services/apiService');

/**
 * Extract text content from a PDF file
 * @param {string} pdfPath - Path to PDF file
 * @returns {string} Extracted text
 */
async function extractTextFromPdf(pdfPath) {
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
 * @param {string} pdfPath - Path to PDF file
 * @returns {array} Extracted tables
 */
async function extractTablesFromPdf(pdfPath) {
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
 * @param {string} filePath - Path to document
 * @returns {string} Extracted text
 */
async function extractTextWithOCR(filePath) {
  try {
    const config = {
      lang: 'eng',
      oem: 1,
      psm: 3,
    };

    // This would convert each page to an image then run OCR
    // Simplified for this example
    const text = await tesseract.recognize(filePath, config);
    return text;
  } catch (error) {
    console.error('OCR extraction error:', error);
    return 'Error extracting text with OCR';
  }
}

/**
 * Generate a summary of a document
 * @param {string} documentText - Text content of document
 * @returns {string} Document summary
 */
async function generateDocumentSummary(documentText) {
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
      { temperature: 0.3, model: 'claude-3-opus-20240229' }
    );
    
    return response.content;
  } catch (error) {
    console.error('Error generating document summary:', error);
    return 'Error generating summary';
  }
}

/**
 * Extract structured information from a document
 * @param {string} documentText - Text content of document
 * @param {string} infoType - Type of information to extract
 * @returns {object} Extracted information
 */
async function extractStructuredInfo(documentText, infoType) {
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
      { temperature: 0.2, model: 'claude-3-opus-20240229' }
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

module.exports = {
  extractTextFromPdf,
  extractTablesFromPdf,
  generateDocumentSummary,
  extractStructuredInfo
};
      