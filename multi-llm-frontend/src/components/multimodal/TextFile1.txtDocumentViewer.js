// components/multimodal/DocumentViewer.js
import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set worker path for PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const DocumentViewer = ({ document, onSelectText, onSelectRegion }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [isTextSelectionMode, setIsTextSelectionMode] = useState(false);
  const [isRegionSelectionMode, setIsRegionSelectionMode] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [documentType, setDocumentType] = useState('unknown');
  const documentRef = useRef(null);

  useEffect(() => {
    // Determine document type based on file extension or mime type
    if (document) {
      if (document.type === 'application/pdf' || document.name?.endsWith('.pdf')) {
        setDocumentType('pdf');
      } else if (document.type?.startsWith('image/') || 
                ['jpg', 'jpeg', 'png', 'gif', 'webp'].some(ext => document.name?.endsWith(`.${ext}`))) {
        setDocumentType('image');
      } else if (document.type === 'text/plain' || document.name?.endsWith('.txt')) {
        setDocumentType('text');
      } else if (document.type === 'text/csv' || document.name?.endsWith('.csv')) {
        setDocumentType('csv');
      } else {
        setDocumentType('unknown');
      }
    }
  }, [document]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  const changePage = (offset) => {
    setPageNumber(prevPageNumber => {
      const newPageNumber = prevPageNumber + offset;
      return Math.min(Math.max(1, newPageNumber), numPages);
    });
  };

  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);

  const zoomIn = () => setScale(prevScale => Math.min(prevScale + 0.2, 3));
  const zoomOut = () => setScale(prevScale => Math.max(prevScale - 0.2, 0.5));
  const resetZoom = () => setScale(1);

  const handleMouseDown = (e) => {
    if (!isTextSelectionMode && !isRegionSelectionMode) return;

    const containerRect = documentRef.current.getBoundingClientRect();
    setSelectionStart({
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top
    });
    setSelectionEnd(null);
  };

  const handleMouseMove = (e) => {
    if (!selectionStart || (!isTextSelectionMode && !isRegionSelectionMode)) return;

    const containerRect = documentRef.current.getBoundingClientRect();
    setSelectionEnd({
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top
    });
  };

  const handleMouseUp = (e) => {
    if (!selectionStart || (!isTextSelectionMode && !isRegionSelectionMode)) return;

    const containerRect = documentRef.current.getBoundingClientRect();
    const endPoint = {
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top
    };
    
    // Finalize selection
    if (isRegionSelectionMode && selectionStart) {
      const region = {
        x: Math.min(selectionStart.x, endPoint.x),
        y: Math.min(selectionStart.y, endPoint.y),
        width: Math.abs(selectionStart.x - endPoint.x),
        height: Math.abs(selectionStart.y - endPoint.y),
        page: pageNumber
      };
      
      if (region.width > 10 && region.height > 10) {
        if (onSelectRegion) {
          onSelectRegion(region);
        }
      }
    }
    
    // Get selected text
    if (isTextSelectionMode) {
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) {
        if (onSelectText) {
          onSelectText(selection.toString(), pageNumber);
        }
      }
    }
    
    // Reset selection
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const toggleTextSelectionMode = () => {
    setIsTextSelectionMode(!isTextSelectionMode);
    setIsRegionSelectionMode(false);
  };

  const toggleRegionSelectionMode = () => {
    setIsRegionSelectionMode(!isRegionSelectionMode);
    setIsTextSelectionMode(false);
  };

  const renderSelectionOverlay = () => {
    if (!selectionStart || !selectionEnd || !isRegionSelectionMode) return null;

    const style = {
      position: 'absolute',
      left: `${Math.min(selectionStart.x, selectionEnd.x)}px`,
      top: `${Math.min(selectionStart.y, selectionEnd.y)}px`,
      width: `${Math.abs(selectionEnd.x - selectionStart.x)}px`,
      height: `${Math.abs(selectionEnd.y - selectionStart.y)}px`,
      backgroundColor: 'rgba(59, 130, 246, 0.3)',
      border: '2px dashed rgba(59, 130, 246, 0.8)',
      pointerEvents: 'none'
    };

    return <div style={style}></div>;
  };

  const renderPdfViewer = () => (
    <>
      <Document
        file={document}
        onLoadSuccess={onDocumentLoadSuccess}
        className="document-pdf"
      >
        <Page 
          pageNumber={pageNumber} 
          scale={scale} 
          className="document-page"
        />
      </Document>
      
      <div className="document-navigation">
        <div className="page-navigation">
          <button onClick={previousPage} disabled={pageNumber <= 1}>Previous</button>
          <span>Page {pageNumber} of {numPages}</span>
          <button onClick={nextPage} disabled={pageNumber >= numPages}>Next</button>
        </div>
        
        <div className="zoom-controls">
          <button onClick={zoomOut}>−</button>
          <button onClick={resetZoom}>Reset</button>
          <button onClick={zoomIn}>+</button>
        </div>
      </div>
    </>
  );

  const renderImageViewer = () => (
    <div className="document-image-container">
      <img 
        src={typeof document === 'string' ? document : URL.createObjectURL(document)} 
        alt="Document Preview" 
        style={{ transform: `scale(${scale})` }}
        className="document-image"
      />
      
      <div className="zoom-controls">
        <button onClick={zoomOut}>−</button>
        <button onClick={resetZoom}>Reset</button>
        <button onClick={zoomIn}>+</button>
      </div>
    </div>
  );

  const renderTextViewer = () => (
    <div className="document-text-container">
      <pre className="document-text">{document.text || 'Loading text content...'}</pre>
    </div>
  );

  const renderCsvViewer = () => (
    <div className="document-csv-container">
      <table className="document-csv-table">
        <thead>
          {document.headers && (
            <tr>
              {document.headers.map((header, index) => (
                <th key={index}>{header}</th>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {document.data && document.data.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderUnknownFormatViewer = () => (
    <div className="document-unknown-container">
      <div className="document-unknown-message">
        <p>Preview not available for this document type.</p>
        <p>File: {document?.name || 'Unknown document'}</p>
        <a 
          href={typeof document === 'string' ? document : '#'} 
          download
          className="document-download-link"
        >
          Download File
        </a>
      </div>
    </div>
  );

  const renderDocumentContent = () => {
    switch (documentType) {
      case 'pdf':
        return renderPdfViewer();
      case 'image':
        return renderImageViewer();
      case 'text':
        return renderTextViewer();
      case 'csv':
        return renderCsvViewer();
      default:
        return renderUnknownFormatViewer();
    }
  };

  // If no document is provided
  if (!document) {
    return (
      <div className="document-viewer empty-viewer">
        <p>No document selected</p>
      </div>
    );
  }

  return (
    <div 
      className="document-viewer"
      ref={documentRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="document-toolbar">
        <div className="document-info">
          <h3>{document.name || 'Document'}</h3>
        </div>
        <div className="document-actions">
          <button 
            className={`text-selection-btn ${isTextSelectionMode ? 'active' : ''}`}
            onClick={toggleTextSelectionMode}
          >
            {isTextSelectionMode ? 'Cancel Text Selection' : 'Select Text'}
          </button>
          <button 
            className={`region-selection-btn ${isRegionSelectionMode ? 'active' : ''}`}
            onClick={toggleRegionSelectionMode}
          >
            {isRegionSelectionMode ? 'Cancel Region Selection' : 'Select Region'}
          </button>
        </div>
      </div>
      
      <div className="document-content">
        {renderDocumentContent()}
        {renderSelectionOverlay()}
      </div>
    </div>
  );
};

export default DocumentViewer;