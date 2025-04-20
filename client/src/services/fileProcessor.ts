// src/services/fileProcessor.ts
import fs from 'fs/promises';
import path from 'path';
import csv from 'csv-parser';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import pdfParse from 'pdf-parse';
import ExcelJS from 'exceljs';

interface FileData {
  type: string;
  content: any;
  summary?: string;
  metadata?: Record<string, any>;
}

/**
 * Process uploaded file based on its type
 * @param filePath Path to the uploaded file
 * @param mimetype MIME type of the file
 * @returns Processed file data
 */
export async function processFile(filePath: string, mimetype: string): Promise<FileData> {
  try {
    // Determine file type from mimetype
    if (mimetype.includes('text/csv')) {
      return await processCSV(filePath);
    } else if (mimetype.includes('application/json')) {
      return await processJSON(filePath);
    } else if (mimetype.includes('text/plain')) {
      return await processTextFile(filePath);
    } else if (mimetype.includes('application/pdf')) {
      return await processPDF(filePath);
    } else if (
      mimetype.includes('spreadsheet') ||
      mimetype.includes('excel') ||
      mimetype.endsWith('xlsx') ||
      mimetype.endsWith('xls')
    ) {
      return await processExcel(filePath);
    } else if (mimetype.startsWith('image/')) {
      return await processImage(filePath, mimetype);
    } else {
      // Default handling for unsupported file types
      return {
        type: 'unknown',
        content: null,
        summary: 'Unsupported file type',
        metadata: { mimetype }
      };
    }
  } catch (error) {
    console.error('Error processing file:', error);
    throw error;
  }
}

/**
 * Process CSV file
 * @param filePath Path to CSV file
 * @returns Processed CSV data
 */
async function processCSV(filePath: string): Promise<FileData> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    
    createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        // Extract headers and sample data for summary
        const headers = results.length > 0 ? Object.keys(results[0]) : [];
        const rowCount = results.length;
        const sampleData = results.slice(0, 5);
        
        resolve({
          type: 'csv',
          content: results,
          summary: `CSV file with ${rowCount} rows and ${headers.length} columns: ${headers.join(', ')}`,
          metadata: {
            headers,
            rowCount,
            sampleData
          }
        });
      })
      .on('error', reject);
  });
}

/**
 * Process JSON file
 * @param filePath Path to JSON file
 * @returns Processed JSON data
 */
async function processJSON(filePath: string): Promise<FileData> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const jsonData = JSON.parse(content);
    
    // Determine if it's an array or object
    const isArray = Array.isArray(jsonData);
    const itemCount = isArray ? jsonData.length : 1;
    const topLevelKeys = isArray 
      ? (jsonData.length > 0 ? Object.keys(jsonData[0]) : []) 
      : Object.keys(jsonData);
    
    return {
      type: 'json',
      content: jsonData,
      summary: `JSON ${isArray ? 'array' : 'object'} with ${itemCount} ${isArray ? 'items' : 'item'} and ${topLevelKeys.length} top-level ${isArray ? 'fields' : 'keys'}`,
      metadata: {
        isArray,
        itemCount,
        topLevelKeys,
        sampleData: isArray ? jsonData.slice(0, 5) : jsonData
      }
    };
  } catch (error) {
    console.error('Error processing JSON file:', error);
    throw error;
  }
}

/**
 * Process plain text file
 * @param filePath Path to text file
 * @returns Processed text data
 */
async function processTextFile(filePath: string): Promise<FileData> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    // Calculate basic stats
    const lineCount = content.split('\n').length;
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    const charCount = content.length;
    
    return {
      type: 'text',
      content,
      summary: `Text file with ${lineCount} lines, ${wordCount} words, and ${charCount} characters`,
      metadata: {
        lineCount,
        wordCount,
        charCount,
        preview: content.slice(0, 500) + (content.length > 500 ? '...' : '')
      }
    };
  } catch (error) {
    console.error('Error processing text file:', error);
    throw error;
  }
}

/**
 * Process PDF file
 * @param filePath Path to PDF file
 * @returns Processed PDF data
 */
async function processPDF(filePath: string): Promise<FileData> {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const pdfData = await pdfParse(dataBuffer);
    
    return {
      type: 'pdf',
      content: pdfData.text,
      summary: `PDF document with ${pdfData.numpages} pages and ${pdfData.info?.Title || 'unknown title'}`,
      metadata: {
        pageCount: pdfData.numpages,
        info: pdfData.info,
        version: pdfData.version,
        preview: pdfData.text.slice(0, 500) + (pdfData.text.length > 500 ? '...' : '')
      }
    };
  } catch (error) {
    console.error('Error processing PDF file:', error);
    throw error;
  }
}

/**
 * Process Excel file
 * @param filePath Path to Excel file
 * @returns Processed Excel data
 */
async function processExcel(filePath: string): Promise<FileData> {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const sheetNames = workbook.worksheets.map(sheet => sheet.name);
    const sheetData: Record<string, any[]> = {};
    
    // Process each sheet
    workbook.worksheets.forEach(sheet => {
      const data: any[] = [];
      
      // Get headers from first row
      const headers: string[] = [];
      if (sheet.rowCount > 0) {
        sheet.getRow(1).eachCell((cell) => {
          headers.push(cell.text);
        });
      }
      
      // Get data from remaining rows (up to 100 rows for preview)
      const maxRows = Math.min(sheet.rowCount, 100);
      for (let rowNumber = 2; rowNumber <= maxRows; rowNumber++) {
        const row = sheet.getRow(rowNumber);
        const rowData: Record<string, any> = {};
        
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber - 1] || `Column${colNumber}`;
          rowData[header] = cell.text;
        });
        
        data.push(rowData);
      }
      
      sheetData[sheet.name] = data;
    });
    
    return {
      type: 'excel',
      content: sheetData,
      summary: `Excel workbook with ${sheetNames.length} sheets: ${sheetNames.join(', ')}`,
      metadata: {
        sheetNames,
        sheetCount: sheetNames.length,
        sampleData: sheetData
      }
    };
  } catch (error) {
    console.error('Error processing Excel file:', error);
    throw error;
  }
}

/**
 * Process image file
 * @param filePath Path to image file
 * @param mimetype Image MIME type
 * @returns Processed image data
 */
async function processImage(filePath: string, mimetype: string): Promise<FileData> {
  try {
    // For now, we'll just return basic file info
    // In a full implementation, you might use libraries like sharp for more detailed analysis
    const stats = await fs.stat(filePath);
    
    return {
      type: 'image',
      content: null, // Don't load the full image into memory
      summary: `Image file (${mimetype.split('/')[1]}) of size ${formatFileSize(stats.size)}`,
      metadata: {
        mimetype,
        size: stats.size,
        path: filePath
      }
    };
  } catch (error) {
    console.error('Error processing image file:', error);
    throw error;
  }
}

/**
 * Format file size in bytes to human-readable format
 * @param bytes Size in bytes
 * @returns Formatted file size
 */
function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(2);
  return `${size} ${sizes[i]}`;
}

export default { processFile };