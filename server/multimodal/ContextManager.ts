import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import pdf from 'pdf-parse';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import { extractTextFromPdf, extractTablesFromPdf } from './documentProcessor';
// Remove import from non-existent imageProcessor module
import { extractDataFromSpreadsheet } from './spreadsheetProcessor';
import { saveContextData } from '../routes/databaseService';

// Define interfaces
interface FileInfo {
  path: string;
  mimetype: string;
  originalName: string;
  size: number;
}

interface ContextItem {
  id: string;
  type: string;
  label: string;
  data: any;
  addedAt: Date;
  reference: string;
}

interface ReferenceItem {
  id: string;
  parentContext: string;
  type: string;
  path?: string;
  region?: any;
  page?: number;
  reference: string;
}

interface ContextReference {
  reference: string;
  type: string;
  label: string;
}

/**
 * Manages the multi-modal context for a conversation
 * Handles different document types and maintains context
 */
export class MultiModalContextManager {
  private userId: mongoose.Types.ObjectId;
  private conversationId?: string;
  private contextItems: ContextItem[];
  private contextMap: Map<string, ContextItem | ReferenceItem>;
  private currentContextWindow: ContextItem[];

  constructor(userId: mongoose.Types.ObjectId, conversationId?: string) {
    this.userId = userId;
    this.conversationId = conversationId;
    this.contextItems = [];
    this.contextMap = new Map(); // Maps context references to their data
    this.currentContextWindow = []; // Current items in context (for token limitations)
  }

  /**
   * Process a file and add it to the context
   * @param file - File object with path, mimetype, etc.
   * @returns Context reference for the file
   */
  async addFileToContext(file: FileInfo): Promise<ContextReference> {
    try {
      const contextId = uuidv4();
      const fileExtension = path.extname(file.originalName).toLowerCase();
      
      // Process different file types
      let contextData: any;
      let contentType: string;
      
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
      const contextItem: ContextItem = {
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
   * @param contextRef - Context reference
   * @param selector - Information to select part of the document (page, region, etc)
   * @returns Reference to the specific part
   */
  async generateVisualReference(contextRef: string, selector: any): Promise<{ reference: string; type: string }> {
    try {
      const contextItem = this.contextMap.get(contextRef) as ContextItem;
      
      if (!contextItem) {
        throw new Error(`Context item ${contextRef} not found`);
      }
      
      const referenceId = uuidv4();
      const reference = `ref_${referenceId.substring(0, 8)}`;
      
      // Generate different references based on content type
      if (contextItem.type === 'image') {
        // Create reference to a region of the image
        const { x, y, width, height } = selector;
        
        // Create references directory if it doesn't exist
        const referencesDir = path.join(__dirname, '../uploads/references');
        await fs.mkdir(referencesDir, { recursive: true });
        
        // Generate cropped version
        const croppedPath = path.join(
          referencesDir,
          `${reference}.jpg`
        );
        
        await sharp(contextItem.data.path)
          .extract({ left: x, top: y, width, height })
          .toFile(croppedPath);
          
        const referenceItem: ReferenceItem = {
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
        
        const referenceItem: ReferenceItem = {
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
   * @param reference - Context reference
   * @returns Content data
   */
  async getContentByReference(reference: string): Promise<any> {
    const contextItem = this.contextMap.get(reference) as ContextItem;
    
    if (!contextItem) {
      throw new Error(`Context reference ${reference} not found`);
    }
    
    return contextItem.data;
  }
  
  /**
   * Updates the current context window based on importance and recency
   * This ensures we don't exceed token limits when sending context to models
   */
  updateContextWindow(): void {
    // This would implement token counting and prioritization
    // For now, we'll just use the 10 most recent items
    this.currentContextWindow = this.contextItems
      .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
      .slice(0, 10);
  }
  
  /**
   * Get the context window for sending to models
   * @returns Formatted context window
   */
  getFormattedContextWindow(): any[] {
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
   * @param imagePath - Path to image
   * @returns Image dimensions
   */
  private async getImageDimensions(imagePath: string): Promise<{width: number, height: number}> {
    const metadata = await sharp(imagePath).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0
    };
  }

  /**
   * Gets page count from a PDF
   * @param pdfPath - Path to PDF
   * @returns Page count
   */
  private async getPdfPageCount(pdfPath: string): Promise<number> {
    const dataBuffer = await fs.readFile(pdfPath);
    const data = await pdf(dataBuffer);
    return data.numpages;
  }
}

/**
 * Extract color information from an image
 * @param {string} imagePath - Path to image file
 * @returns {object} Color information
 */
function getImageColors(imagePath: string): Promise<any> {
  // Implementation would go here
  return Promise.resolve({ dominant: "#336699", palette: ["#336699", "#CCDDEE", "#223344"] });
}

/**
 * Generate a description of the image content
 * @param imagePath - Path to image file
 * @returns Generated description of the image
 */
export function generateImageDescription(imagePath: string): Promise<string> {
  // Implementation would go here
  return Promise.resolve("Image description placeholder");
}

/**
 * Extract text content from an image using OCR
 * @param imagePath - Path to image file
 * @returns Extracted text content
 */
function extractTextFromImage(imagePath: string): Promise<string> {
  // Implementation would go here
  return Promise.resolve("Extracted text placeholder");
}

/**
 * Detect objects in an image
 * @param imagePath - Path to image file
 * @returns Detected objects with locations
 */
function detectObjectsInImage(imagePath: string): Promise<any[]> {
  // Implementation would go here
  return Promise.resolve([{ label: "object", confidence: 0.95, bbox: { x: 0, y: 0, width: 100, height: 100 } }]);
}

/**
 * Analyze image for content, objects, text, etc.
 * @param imagePath - Path to image file
 * @returns Analysis results
 */
function analyzeImage(imagePath: string): Promise<any> {
  // Implementation would go here
  return Promise.resolve({ objects: [], text: "", sentiment: "neutral" });
}

/**
 * Classify image content
 * @param imagePath - Path to image file
 * @returns Classification labels with confidence scores
 */
function classifyImage(imagePath: string): Promise<any[]> {
  // Implementation would go here
  return Promise.resolve([{ label: "category", confidence: 0.8 }]);
}

/**
 * Detect faces in an image
 * @param imagePath - Path to image file
 * @returns Detected faces with locations and attributes
 */
function detectFaces(imagePath: string): Promise<any[]> {
  // Implementation would go here
  return Promise.resolve([{ bbox: { x: 0, y: 0, width: 50, height: 50 }, attributes: { age: 30, gender: "unknown" } }]);
}

/**
 * Crop image to region of interest
 * @param imagePath - Path to image file
 * @param region - Region coordinates
 * @returns Path to cropped image
 */
function cropToRegionOfInterest(imagePath: string, region: any): Promise<string> {
  // Implementation would go here
  return Promise.resolve("/path/to/cropped/image.jpg");
}

/**
 * Enhance image quality
 * @param imagePath - Path to image file
 * @returns Path to enhanced image
 */
function enhanceImage(imagePath: string): Promise<string> {
  // Implementation would go here
  return Promise.resolve("/path/to/enhanced/image.jpg");
}

/**
 * Generate thumbnail for an image
 * @param imagePath - Path to image file
 * @returns Path to thumbnail
 */
function generateImageThumbnail(imagePath: string): Promise<string> {
  // Implementation would go here
  return Promise.resolve("/path/to/thumbnail.jpg");
}

export default MultiModalContextManager;