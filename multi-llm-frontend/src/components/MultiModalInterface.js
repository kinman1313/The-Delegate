// src/components/MultiModalInterface.js
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  uploadFile, 
  generateVisualization, 
  getContextItems,
  createContextReference
} from '../services/apiService';

const MultiModalInterface = ({ conversationId, onSendMessage }) => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [contextItems, setContextItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionType, setSelectionType] = useState(null);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [visualizations, setVisualizations] = useState([]);
  const [isGeneratingVisualization, setIsGeneratingVisualization] = useState(false);
  const fileInputRef = useRef(null);
  const documentViewerRef = useRef(null);

  // Load context items for the conversation
  useEffect(() => {
    if (conversationId) {
      loadContextItems();
    }
  }, [conversationId]);

  const loadContextItems = async () => {
    try {
      const items = await getContextItems(conversationId);
      setContextItems(items);
      
      // Set uploaded files based on context items
      const files = items
        .filter(item => ['image', 'document', 'data', 'text'].includes(item.type))
        .map(item => ({
          id: item.id,
          reference: item.reference,
          label: item.label,
          type: item.type
        }));
      
      setUploadedFiles(files);
    } catch (error) {
      console.error('Error loading context items:', error);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      
      if (conversationId) {
        formData.append('conversationId', conversationId);
      }
      
      // Upload the file
      const result = await uploadFile(formData);
      
      // Add to uploaded files
      setUploadedFiles(prev => [...prev, {
        id: result.fileId,
        reference: result.reference,
        label: result.filename,
        type: getFileType(result.type)
      }]);
      
      // Refresh context items
      await loadContextItems();
      
      // Send a message about the uploaded file
      if (onSendMessage) {
        onSendMessage(`I've uploaded a file: ${result.filename} (${result.reference})`);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  const getFileType = (mimeType) => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('application/pdf')) return 'document';
    if (mimeType.includes('spreadsheet') || mimeType.includes('csv')) return 'data';
    if (mimeType.startsWith('text/')) return 'text';
    return 'file';
  };

  const handleItemClick = (item) => {
    setSelectedItem(item);
    
    // Clear any ongoing selection
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const handleStartSelection = (type, e) => {
    if (!selectedItem) return;
    
    setIsSelecting(true);
    setSelectionType(type);
    
    if (type === 'image') {
      const { left, top } = documentViewerRef.current.getBoundingClientRect();
      setSelectionStart({
        x: e.clientX - left,
        y: e.clientY - top
      });
    } else if (type === 'text') {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        setSelectionStart(selection.getRangeAt(0));
      }
    }
  };

  const handleEndSelection = async (e) => {
    if (!isSelecting || !selectedItem) return;
    
    if (selectionType === 'image') {
      const { left, top } = documentViewerRef.current.getBoundingClientRect();
      const end = {
        x: e.clientX - left,
        y: e.clientY - top
      };
      
      setSelectionEnd(end);
      
      // Calculate region
      const region = {
        x: Math.min(selectionStart.x, end.x),
        y: Math.min(selectionStart.y, end.y),
        width: Math.abs(selectionStart.x - end.x),
        height: Math.abs(selectionStart.y - end.y)
      };
      
      // Create a context reference
      try {
        const reference = await createContextReference(
          selectedItem.reference,
          {
            type: 'region',
            ...region
          }
        );
        
        // Send a message about the selected region
        if (onSendMessage) {
          onSendMessage(`I'm referring to this specific part of the image: ${reference.reference}`);
        }
      } catch (error) {
        console.error('Error creating context reference:', error);
      }
    } else if (selectionType === 'text') {
      const selection = window.getSelection();
      if (selection.toString().length > 0) {
        // Create a context reference
        try {
          const reference = await createContextReference(
            selectedItem.reference,
            {
              type: 'text',
              content: selection.toString()
            }
          );
          
          // Send a message about the selected text
          if (onSendMessage) {
            onSendMessage(`I'm referring to this specific text: "${selection.toString()}" (${reference.reference})`);
          }
        } catch (error) {
          console.error('Error creating context reference:', error);
        }
      }
    }
    
    // Reset selection state
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const handleGenerateVisualization = async (dataItem) => {
    if (!dataItem) return;
    
    setIsGeneratingVisualization(true);
    
    try {
      const result = await generateVisualization(
        dataItem.reference,
        'auto', // Let the system decide the best visualization type
        { title: `Visualization for ${dataItem.label}` }
      );
      
      setVisualizations(prev => [...prev, result]);
      
      // Send a message about the generated visualization
      if (onSendMessage) {
        onSendMessage(`I've generated a visualization: ${result.caption} (${result.reference})`);
      }
    } catch (error) {
      console.error('Error generating visualization:', error);
    } finally {
      setIsGeneratingVisualization(false);
    }
  };

  const renderItemThumbnail = (item) => {
    switch (item.type) {
      case 'image':
        return (
          <div className="item-thumbnail image-thumbnail">
            <img src={`/api/context/${item.reference}/thumbnail`} alt={item.label} />
          </div>
        );
      case 'document':
        return (
          <div className="item-thumbnail document-thumbnail">
            <div className="document-icon">📄</div>
          </div>
        );
      case 'data':
        return (
          <div className="item-thumbnail data-thumbnail">
            <div className="data-icon">📊</div>
          </div>
        );
      case 'text':
        return (
          <div className="item-thumbnail text-thumbnail">
            <div className="text-icon">📝</div>
          </div>
        );
      default:
        return (
          <div className="item-thumbnail file-thumbnail">
            <div className="file-icon">📁</div>
          </div>
        );
    }
  };

  const renderFilesList = () => {
    if (uploadedFiles.length === 0) {
      return (
        <div className="empty-files">
          <p>No files uploaded yet</p>
          <button 
            onClick={() => fileInputRef.current.click()}
            className="upload-btn"
          >
            Upload a File
          </button>
        </div>
      );
    }
    
    return (
      <div className="files-list">
        {uploadedFiles.map(file => (
          <div 
            key={file.id} 
            className={`file-item ${selectedItem?.id === file.id ? 'selected' : ''}`}
            onClick={() => handleItemClick(file)}
          >
            {renderItemThumbnail(file)}
            <div className="file-details">
              <div className="file-name">{file.label}</div>
              <div className="file-type">{file.type}</div>
              <div className="file-reference">{file.reference}</div>
            </div>
          </div>
        ))}
        
        <button 
          onClick={() => fileInputRef.current.click()}
          className="upload-more-btn"
        >
          Upload Another File
        </button>
      </div>
    );
  };

  const renderDocumentViewer = () => {
    if (!selectedItem) {
      return (
        <div className="empty-viewer">
          <p>Select a file to view its contents</p>
        </div>
      );
    }
    
    switch (selectedItem.type) {
      case 'image':
        return (
          <div 
            className="image-viewer"
            ref={documentViewerRef}
            onMouseDown={(e) => handleStartSelection('image', e)}
            onMouseUp={handleEndSelection}
            onMouseMove={(e) => {
              if (isSelecting && selectionType === 'image') {
                const { left, top } = documentViewerRef.current.getBoundingClientRect();
                setSelectionEnd({
                  x: e.clientX - left,
                  y: e.clientY - top
                });
              }
            }}
          >
            <img 
              src={`/api/context/${selectedItem.reference}/content`} 
              alt={selectedItem.label} 
            />
            
            {isSelecting && selectionType === 'image' && selectionStart && selectionEnd && (
              <div 
                className="image-selection"
                style={{
                  left: Math.min(selectionStart.x, selectionEnd.x) + 'px',
                  top: Math.min(selectionStart.y, selectionEnd.y) + 'px',
                  width: Math.abs(selectionStart.x - selectionEnd.x) + 'px',
                  height: Math.abs(selectionStart.y - selectionEnd.y) + 'px'
                }}
              />
            )}
            
            <div className="image-viewer-controls">
              <button onClick={() => handleStartSelection('image')}>
                Select Region
              </button>
            </div>
          </div>
        );
      case 'document':
        return (
          <div className="document-viewer">
            <embed 
              src={`/api/context/${selectedItem.reference}/content`}
              type="application/pdf"
              width="100%"
              height="100%"
            />
          </div>
        );
      case 'data':
        return (
          <div className="data-viewer">
            <div className="data-summary">
              <h3>Data Summary</h3>
              <p className="data-summary-content">
                Loading data summary...
              </p>
            </div>
            
            <div className="data-viewer-controls">
              <button 
                onClick={() => handleGenerateVisualization(selectedItem)}
                disabled={isGeneratingVisualization}
              >
                {isGeneratingVisualization ? 'Generating...' : 'Generate Visualization'}
              </button>
            </div>
          </div>
        );
      case 'text':
        return (
          <div 
            className="text-viewer"
            onMouseUp={handleEndSelection}
            onMouseDown={(e) => handleStartSelection('text', e)}
          >
            <pre className="text-content">
              Loading text content...
            </pre>
          </div>
        );
      default:
        return (
          <div className="generic-viewer">
            <p>Preview not available for this file type.</p>
            <a 
              href={`/api/context/${selectedItem.reference}/download`}
              className="download-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download File
            </a>
          </div>
        );
    }
  };

  const renderVisualizations = () => {
    if (visualizations.length === 0) return null;
    
    return (
      <div className="visualizations-section">
        <h3>Visualizations</h3>
        <div className="visualizations-list">
          {visualizations.map((viz, index) => (
            <div key={index} className="visualization-item">
              <h4 className="visualization-title">
                {viz.title || `Visualization ${index + 1}`}
              </h4>
              <div className="visualization-content">
                <div 
                  className="visualization-render"
                  dangerouslySetInnerHTML={{ __html: viz.html }}
                />
              </div>
              <div className="visualization-caption">
                <ReactMarkdown>{viz.caption}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="multimodal-interface">
      <div className="multimodal-sidebar">
        <h3>Context Files</h3>
        {renderFilesList()}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
      </div>
      
      <div className="document-viewer-container">
        {renderDocumentViewer()}
      </div>
      
      {renderVisualizations()}
    </div>
  );
};

export default MultiModalInterface;
