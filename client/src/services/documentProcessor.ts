// services/documentProcessor.ts
import pdf from 'pdf-parse';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import csvParser from 'csv-parser';
import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import Tesseract from 'node-tesseract-ocr';
import { callLLMApi } from './apiService';

// Define interfaces for better type safety
interface PdfTable {
  pageNumber: number;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  headers: string[];
  rows: string[][];
}

interface ExtractedTextResult {
  text: string;
  pages?: number;
  metadata?: any;
}

interface TableExtractionResult {
  tables: PdfTable[];
  metadata?: any;
}

interface DocumentSummary {
  title?: string;
  content: string;
  metadata?: any;
}

interface StructuredInfo {
  [key: string]: any;
}

// Configure OCR options
const ocrConfig = {
  lang: 'eng',
  oem: 1,
  psm: 3,
};

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
 * Extract text from document using OCR
 * @param filePath - Path to document
 * @returns Extracted text
 */
async function extractTextWithOCR(filePath: string): Promise<string> {
  try {
    // Check if file exists
    await fs.access(filePath);
    
    // Perform OCR
    const text = await Tesseract.recognize(filePath, ocrConfig);
    return text;
  } catch (error) {
    console.error('OCR extraction error:', error);
    return 'Error extracting text with OCR';
  }
}

/**
 * Extract tables from a PDF file
 * @param pdfPath - Path to PDF file
 * @returns Extracted tables
 */
export async function extractTablesFromPdf(pdfPath: string): Promise<PdfTable[]> {
  try {
    // For this implementation, we'll use a simplified approach
    // A real implementation would use a library like pdf-table-extractor
    // or a machine learning model to detect and extract tables
    
    // Get the total number of pages
    const dataBuffer = await fs.readFile(pdfPath);
    const data = await pdf(dataBuffer);
    const numPages = data.numpages;
    
    // For this example, we'll return a sample table as a placeholder
    const sampleTable: PdfTable = {
      pageNumber: 1,
      position: { x: 100, y: 200, width: 400, height: 300 },
      headers: ['Column 1', 'Column 2', 'Column 3'],
      rows: [
        ['Data 1', 'Data 2', 'Data 3'],
        ['Data 4', 'Data 5', 'Data 6']
      ]
    };
    
    return [sampleTable];
  } catch (error) {
    console.error('Error extracting tables from PDF:', error);
    return [];
  }
}

/**
 * Process CSV file and extract data
 * @param csvPath - Path to CSV file
 * @returns Processed CSV data
 */
export async function processCSV(csvPath: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    
    createReadStream(csvPath)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

/**
 * Process Excel file and extract data
 * @param excelPath - Path to Excel file
 * @returns Processed Excel data
 */
export async function processExcel(excelPath: string): Promise<any> {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    
    const result: any = {};
    
    workbook.eachSheet((worksheet, sheetId) => {
      const sheetData: any[] = [];
      
      // Get headers from first row
      const headers: string[] = [];
      if (worksheet.rowCount > 0) {
        worksheet.getRow(1).eachCell((cell) => {
          headers.push(cell.value?.toString() || '');
        });
      }
      
      // Get data rows
      for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        const rowData: any = {};
        
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber - 1] || `Column${colNumber}`;
          rowData[header] = cell.value;
        });
        
        sheetData.push(rowData);
      }
      
      result[worksheet.name] = {
        headers,
        data: sheetData
      };
    });
    
    return result;
  } catch (error) {
    console.error('Error processing Excel file:', error);
    throw error;
  }
}

/**
 * Generate a summary of a document
 * @param documentText - Text content of document
 * @returns Document summary
 */
export async function generateDocumentSummary(documentText: string): Promise<DocumentSummary> {
  try {
    // Truncate to a reasonable length for the model
    const truncatedText = documentText.substring(0, 10000);
    
    // For this implementation, we'll create a simple summary
    // In a real implementation, you would call an LLM API
    
    const words = truncatedText.split(/\s+/);
    const wordCount = words.length;
    const charCount = truncatedText.length;
    const sentenceCount = truncatedText.split(/[.!?]+/).length;
    
    // Simple extractive summary (first 200 words)
    const summaryContent = words.slice(0, 200).join(' ') + '...';
    
    // Extract a title (first line or first sentence)
    const titleMatch = truncatedText.match(/^(.+?)[\r\n]|^(.+?)[.!?]/);
    const title = titleMatch ? titleMatch[0].trim() : 'Document Summary';
    
    return {
      title,
      content: summaryContent,
      metadata: {
        wordCount,
        charCount,
        sentenceCount
      }
    };
  } catch (error) {
    console.error('Error generating document summary:', error);
    return {
      title: 'Document Summary',
      content: 'Error generating summary'
    };
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
    // For this implementation, we'll use regex patterns for common info types
    // In a real implementation, you would call an LLM API for more complex extraction
    
    switch (infoType.toLowerCase()) {
      case 'email':
        return extractEmails(documentText);
      case 'phone':
        return extractPhoneNumbers(documentText);
      case 'date':
        return extractDates(documentText);
      case 'url':
        return extractURLs(documentText);
      case 'person':
        return extractPersonNames(documentText);
      case 'organization':
        return extractOrganizations(documentText);
      default:
        return { error: `Unsupported information type: ${infoType}` };
    }
  } catch (error) {
    console.error('Error extracting structured info:', error);
    return { error: 'Failed to extract information' };
  }
}

// Helper functions for structured information extraction
function extractEmails(text: string): StructuredInfo {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = text.match(emailRegex) || [];
  return { emails };
}

function extractPhoneNumbers(text: string): StructuredInfo {
  const phoneRegex = /(\+\d{1,3}[ -]?)?\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4}/g;
  const phones = text.match(phoneRegex) || [];
  return { phones };
}

function extractDates(text: string): StructuredInfo {
  // Simple date patterns (MM/DD/YYYY, YYYY-MM-DD, etc.)
  const dateRegex = /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b|\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b/g;
  const dates = text.match(dateRegex) || [];
  return { dates };
}

function extractURLs(text: string): StructuredInfo {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = text.match(urlRegex) || [];
  return { urls };
}

function extractPersonNames(text: string): StructuredInfo {
  // This is a very simplified approach - in reality, named entity recognition
  // would require more sophisticated NLP
  const nameRegex = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g;
  const names = text.match(nameRegex) || [];
  return { names };
}

function extractOrganizations(text: string): StructuredInfo {
  // Simple approach - look for Inc., Corp., LLC, etc.
  const orgRegex = /\b[A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+)* (?:Inc|Corp|LLC|Ltd|Company|GmbH|Co)\b\.?/g;
  const organizations = text.match(orgRegex) || [];
  return { organizations };
}

export default {
  extractTextFromPdf,
  extractTablesFromPdf,
  processCSV,
  processExcel,
  generateDocumentSummary,
  extractStructuredInfo
};