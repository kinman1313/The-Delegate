// multimodal/spreadsheetProcessor.js
const ExcelJS = require('exceljs');
const fs = require('fs/promises');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { callLLMApi } = require('../services/apiService');

/**
 * Extract data from a spreadsheet
 * @param {string} filePath - Path to spreadsheet file
 * @param {string} fileExtension - File extension (xlsx, csv, etc.)
 * @returns {object} Extracted data
 */
async function extractDataFromSpreadsheet(filePath, fileExtension) {
  try {
    if (fileExtension === '.csv') {
      return extractDataFromCsv(filePath);
    } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
      return extractDataFromExcel(filePath);
    } else {
      throw new Error(`Unsupported file extension: ${fileExtension}`);
    }
  } catch (error) {
    console.error('Error extracting data from spreadsheet:', error);
    return {
      error: 'Failed to extract data from spreadsheet',
      fileType: fileExtension
    };
  }
}

/**
 * Extract data from a CSV file
 * @param {string} filePath - Path to CSV file
 * @returns {object} Extracted data
 */
async function extractDataFromCsv(filePath) {
  try {
    const fileContent = await fs.readFile(filePath, 'utf8');
    const results = [];
    
    // Parse CSV
    await new Promise((resolve, reject) => {
      const stream = Readable.from(fileContent)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });
    
    // Get column headers
    const headers = results.length > 0 ? Object.keys(results[0]) : [];
    
    // Generate summary
    const summary = await generateDataSummary(results, headers);
    
    // Generate statistics
    const statistics = generateStatistics(results, headers);
    
    return {
      type: 'csv',
      headers,
      rowCount: results.length,
      data: results.slice(0, 50), // Limit to first 50 rows
      summary,
      statistics
    };
  } catch (error) {
    console.error('Error extracting data from CSV:', error);
    return { error: 'Failed to extract data from CSV' };
  }
}

/**
 * Extract data from an Excel file
 * @param {string} filePath - Path to Excel file
 * @returns {object} Extracted data
 */
async function extractDataFromExcel(filePath) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const result = {
      type: 'excel',
      sheets: []
    };
    
    // Process each worksheet
    for (const worksheet of workbook.worksheets) {
      const sheetData = [];
      const headers = [];
      
      // Get headers from the first row
      worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber - 1] = cell.value ? cell.value.toString() : `Column ${colNumber}`;
      });
      
      // Get data from each row
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row
        
        const rowData = {};
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber - 1];
          rowData[header] = cell.value;
        });
        
        sheetData.push(rowData);
      });
      
      // Generate summary for this sheet
      const sheetSummary = await generateDataSummary(sheetData, headers);
      
      // Generate statistics for this sheet
      const statistics = generateStatistics(sheetData, headers);
      
      result.sheets.push({
        name: worksheet.name,
        headers,
        rowCount: sheetData.length,
        data: sheetData.slice(0, 50), // Limit to first 50 rows
        summary: sheetSummary,
        statistics
      });
    }
    
    // Generate overall summary
    result.summary = await generateWorkbookSummary(result.sheets);
    
    return result;
  } catch (error) {
    console.error('Error extracting data from Excel:', error);
    return { error: 'Failed to extract data from Excel file' };
  }
}

/**
 * Generate a summary of tabular data
 * @param {array} data - Array of data objects
 * @param {array} headers - Column headers
 * @returns {string} Summary of the data
 */
async function generateDataSummary(data, headers) {
  try {
    // Take a sample of the data to summarize
    const sampleSize = Math.min(data.length, 20);
    const sample = data.slice(0, sampleSize);
    
    // Create a prompt for the LLM
    const dataString = JSON.stringify(sample, null, 2);
    const prompt = `
      You are an AI assistant that specializes in analyzing and summarizing tabular data.
      
      I have a dataset with the following columns: ${headers.join(', ')}
      
      Here is a sample of the data:
      ${dataString}
      
      Please provide a concise summary of this dataset including:
      1. The general content and purpose of the data
      2. Key patterns or trends visible in the sample
      3. Types of data in each column
      4. Any important observations
      
      Keep your summary focused and to-the-point, at most 200 words.
    `;
    
    // Call the LLM API
    const response = await callLLMApi(
      'claude',
      [{ role: 'user', content: prompt }],
      { temperature: 0.3, model: 'claude-3-opus-20240229' }
    );
    
    return response.content;
  } catch (error) {
    console.error('Error generating data summary:', error);
    return 'Error generating data summary. The data contains ' + data.length + 
           ' rows with the following columns: ' + headers.join(', ');
  }
}

/**
 * Generate a summary of an entire Excel workbook
 * @param {array} sheets - Array of sheet data
 * @returns {string} Summary of the workbook
 */
async function generateWorkbookSummary(sheets) {
  try {
    const sheetsInfo = sheets.map(sheet => 
      `${sheet.name}: ${sheet.rowCount} rows, columns: ${sheet.headers.join(', ')}`
    ).join('\n');
    
    const prompt = `
      You are an AI assistant that specializes in analyzing and summarizing Excel workbooks.
      
      This workbook contains ${sheets.length} sheets with the following information:
      ${sheetsInfo}
      
      Based on this information and the individual sheet summaries below, provide a brief 
      overall summary of what this workbook contains and its likely purpose.
      
      Sheet summaries:
      ${sheets.map(sheet => `${sheet.name}: ${sheet.summary}`).join('\n\n')}
      
      Keep your summary concise, at most 200 words.
    `;
    
    // Call the LLM API
    const response = await callLLMApi(
      'claude',
      [{ role: 'user', content: prompt }],
      { temperature: 0.3, model: 'claude-3-opus-20240229' }
    );
    
    return response.content;
  } catch (error) {
    console.error('Error generating workbook summary:', error);
    return `This workbook contains ${sheets.length} sheets: ${sheets.map(s => s.name).join(', ')}`;
  }
}

/**
 * Generate basic statistics for tabular data
 * @param {array} data - Array of data objects
 * @param {array} headers - Column headers
 * @returns {object} Statistics for each column
 */
function generateStatistics(data, headers) {
  try {
    const stats = {};
    
    for (const header of headers) {
      // Skip if the header is undefined or null
      if (!header) continue;
      
      // Get all values for this column
      const values = data.map(row => row[header]).filter(val => val !== undefined && val !== null);
      
      // Initialize stats for this column
      stats[header] = {
        count: values.length,
        missing: data.length - values.length,
        uniqueCount: new Set(values).size
      };
      
      // Analyze data type
      const types = values.map(val => typeof val);
      const dominantType = getMostFrequent(types) || 'unknown';
      
      stats[header].type = dominantType;
      
      // Calculate type-specific statistics
      if (dominantType === 'number') {
        const numericValues = values.filter(val => typeof val === 'number');
        if (numericValues.length > 0) {
          stats[header].min = Math.min(...numericValues);
          stats[header].max = Math.max(...numericValues);
          stats[header].sum = numericValues.reduce((a, b) => a + b, 0);
          stats[header].avg = stats[header].sum / numericValues.length;
        }
      } else if (dominantType === 'string') {
        const stringValues = values.filter(val => typeof val === 'string');
        if (stringValues.length > 0) {
          stats[header].minLength = Math.min(...stringValues.map(s => s.length));
          stats[header].maxLength = Math.max(...stringValues.map(s => s.length));
          stats[header].mostCommon = getMostFrequent(stringValues);
        }
      } else if (dominantType === 'object' && values[0] instanceof Date) {
        // Handle dates
        const dates = values.filter(val => val instanceof Date);
        if (dates.length > 0) {
          stats[header].earliest = new Date(Math.min(...dates.map(d => d.getTime())));
          stats[header].latest = new Date(Math.max(...dates.map(d => d.getTime())));
        }
      }
    }
    
    return stats;
  } catch (error) {
    console.error('Error generating statistics:', error);
    return { error: 'Failed to generate statistics' };
  }
}

/**
 * Get the most frequent value in an array
 * @param {array} arr - Array of values
 * @returns {*} Most frequent value
 */
function getMostFrequent(arr) {
  if (!arr.length) return null;
  
  const frequencyMap = {};
  let maxFreq = 0;
  let mostFrequent = null;
  
  for (const val of arr) {
    const value = String(val);
    frequencyMap[value] = (frequencyMap[value] || 0) + 1;
    
    if (frequencyMap[value] > maxFreq) {
      maxFreq = frequencyMap[value];
      mostFrequent = val;
    }
  }
  
  return mostFrequent;
}

module.exports = {
  extractDataFromSpreadsheet,
  generateDataSummary,
  generateStatistics
};
