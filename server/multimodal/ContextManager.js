// multimodal/ContextManager.js
const path = require('path');
const fs = require('fs/promises');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const pdf = require('pdf-parse');
const ExcelJS = require('exceljs');
const { extractTextFromPdf, extractTablesFromPdf } = require('./documentProcessor');
const { generateImageDescription } = require('./imageProcessor');
const { extractDataFromSpreadsheet } = require('./spreadsheetProcessor');
const { saveContextData } = require('../services/databaseService');

/**
 * Manages the multi-modal context for a conversation
 * Handles different document types and maintains context
 */
class MultiModalContextManager {
  constructor(userId, conversationId) {
    this.userId = userId;
    this.conversationId = conversationId;
    this.contextItems = [];
    this.contextMap = new Map(); // Maps context references to their data
    this.currentContextWindow = []; // Current items in context (for token limitations)
  }

  /**
   * Process a file and add it to the context
   * @param {object} file - File object with path, mimetype, etc.
   * @returns {object} Context reference for the file
   */
  async addFileToContext(file) {
    try {
      const contextId = uuidv4();
      const fileExtension = path.extname(file.originalName).toLowerCase();
      
      // Process different file types
      let contextData;
      let contentType;
      
      // Create thumbnails directory if it doesn't exist
      const thumbnailsDir = path.join(__dirname, '../uploads/thumbnails');
      await fs.mkdir(thumbnailsDir, { recursive: true });
      
      if (file.mimetype.includes('image')) {
        // Process image
        contentType = 'image';
        const thumbnailPath = path.join(thumbnailsDir, `${contextId}_thumb.jpg`);
        
        // Generate thumbnail
        await sharp(file.path)
          .resize(300, 300, { fit: 'inside' })
          .jpeg({ quality: 80 })
          .toFile(thumbnailPath);
          
        // Generate image description
        const description = await generateImageDescription(file.path);
        
        contextData = {
          type: 'image',
          path: file.path,
          thumbnailPath,
          originalName: file.originalName,
          description,
          dimensions: await this.getImageDimensions(file.path)
        };
      } else if (file.mimetype.includes('pdf')) {
        // Process PDF
        contentType = 'document';
        const textContent = await extractTextFromPdf(file.path);
        const tables = await extractTablesFromPdf(file.path);
        
        // Generate thumbnail of first page
        const thumbnailPath = path.join(thumbnailsDir, `${contextId}_thumb.jpg`);
        
        // This would use a PDF rendering library to generate a thumbnail
        // For now we'll just say it would be here
        
        contextData = {
          type: 'pdf',
          path: file.path,
          thumbnailPath,
          originalName: file.originalName,
          textContent,
          tables,
          pageCount: await this.getPdfPageCount(file.path)
        };
      } else if (file.mimetype.includes('spreadsheet') || 
                fileExtension === '.xlsx' || 
                fileExtension === '.csv') {
        // Process spreadsheet
        contentType = 'data';
        const extractedData = await extractDataFromSpreadsheet(file.path, fileExtension);
        
        contextData = {
          type: 'spreadsheet',
          path: file.path,
          originalName: file.originalName,
          data: extractedData,
          summary: extractedData.summary
        };
      } else if (file.mimetype.includes('text')) {
        // Process text file
        contentType = 'text';
        const fileContent = await fs.readFile(file.path, 'utf8');
        
        contextData = {
          type: 'text',
          path: file.path,
          originalName: file.originalName,
          content: fileContent
        };
      } else {
        // Generic file handling
        contentType = 'file';
        contextData = {
          type: 'generic',
          path: file.path,
          originalName: file.originalName,
          size: (await fs.stat(file.path)).size
        };
      }
      
      // Create context item
      const contextItem = {
        id: contextId,
        type: contentType,
        label: file.originalName,
        data: contextData,
        addedAt: new Date(),
        reference: `ctx_${contextId.substring(0, 8)}`
      };
      
      // Add to context
      this.contextItems.push(contextItem);
      this.contextMap.set(contextItem.reference, contextItem);
      
      // Update the current context window
      this.updateContextWindow();
      
      // Save to database
      await saveContextData(this.userId, this.conversationId, contextItem);
      
      return {
        reference: contextItem.reference,
        type: contentType,
        label: file.originalName
      };
    } catch (error) {
      console.error('Error adding file to context:', error);
      throw error;
    }
  }
  
  /**
   * Generate a visual reference to a specific part of a document
   * @param {string} contextRef - Context reference
   * @param {object} selector - Information to select part of the document (page, region, etc)
   * @returns {object} Reference to the specific part
   */
  async generateVisualReference(contextRef, selector) {
    try {
      const contextItem = this.contextMap.get(contextRef);
      
      if (!contextItem) {
        throw new Error(`Context item ${contextRef} not found`);
      }
      
      const referenceId = uuidv4();
      const reference = `ref_${referenceId.substring(0, 8)}`;
      
      // Generate different references based on content type
      if (contextItem.type === 'image') {
        // Create reference to a region of the image
        const { x, y, width, height } = selector;
        
        // Generate cropped version
        const croppedPath = path.join(
          __dirname, 
          `../uploads/references/${reference}.jpg`
        );
        
        await sharp(contextItem.data.path)
          .extract({ left: x, top: y, width, height })
          .toFile(croppedPath);
          
        const referenceItem = {
          id: referenceId,
          parentContext: contextRef,
          type: 'image_region',
          path: croppedPath,
          region: { x, y, width, height },
          reference
        };
        
        this.contextMap.set(reference, referenceItem);
        return { reference, type: 'image_region' };
      } 
      else if (contextItem.type === 'document' && contextItem.data.type === 'pdf') {
        // Reference to a specific page or region in PDF
        const { page, region } = selector;
        
        // We would generate a thumbnail of that specific page/region
        // This is simplified for this example
        
        const referenceItem = {
          id: referenceId,
          parentContext: contextRef,
          type: 'pdf_region',
          page,
          region,
          reference
        };
        
        this.contextMap.set(reference, referenceItem);
        return { reference, type: 'pdf_region' };
      }
      
      throw new Error('Visual reference generation not supported for this content type');
    } catch (error) {
      console.error('Error generating visual reference:', error);
      throw error;
    }
  }
  
  /**
   * Get content from a specific context reference
   * @param {string} reference - Context reference
   * @returns {object} Content data
   */
  async getContentByReference(reference) {
    const contextItem = this.contextMap.get(reference);
    
    if (!contextItem) {
      throw new Error(`Context reference ${reference} not found`);
    }
    
    return contextItem.data;
  }
  
  /**
   * Updates the current context window based on importance and recency
   * This ensures we don't exceed token limits when sending context to models
   */
  updateContextWindow() {
    // This would implement token counting and prioritization
    // For now, we'll just use the 10 most recent items
    this.currentContextWindow = this.contextItems
      .sort((a, b) => b.addedAt - a.addedAt)
      .slice(0, 10);
  }
  
  /**
   * Get the context window for sending to models
   * @returns {array} Formatted context window
   */
  getFormattedContextWindow() {
    return this.currentContextWindow.map(item => {
      // Format differently based on type
      if (item.type === 'image') {
        return {
          reference: item.reference,
          type: 'image',
          description: item.data.description,
          dimensions: item.data.dimensions
        };
      } else if (item.type === 'document') {
        return {
          reference: item.reference,
          type: 'document',
          content: item.data.textContent.substring(0, 1000) + '...',
          pageCount: item.data.pageCount
        };
      } else if (item.type === 'data') {
        return {
          reference: item.reference,
          type: 'data',
          summary: item.data.summary
        };
      } else {
        return {
          reference: item.reference,
          type: item.type,
          label: item.label
        };
      }
    });
  }
  
  /**
   * Gets dimensions of an image
   * @param {string} imagePath - Path to image
   * @returns {object} Image dimensions
   */
  async getImageDimensions(imagePath) {
    const metadata = await sharp(imagePath).metadata();
    return {
      width: metadata.width,
      height: metadata.height
    };
  }
  
  /**
   * Gets page count from a PDF
   * @param {string} pdfPath - Path to PDF
   * @returns {number} Page count
   */
  async getPdfPageCount(pdfPath) {
    const dataBuffer = await fs.readFile(pdfPath);
    const data = await pdf(dataBuffer);
    return data.numpages;
  }
}

module.exports = MultiModalContextManager;
