// components/multimodal/DocumentViewer.tsx
import React, { useState, useEffect, useRef, CSSProperties, MouseEvent } from 'react';
import { Document, Page, pdfjs, DocumentProps, OnLoadSuccessProps } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set worker path for PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface Point {
    x: number;
    y: number;
}

interface Region {
    x: number;
    y: number;
    width: number;
    height: number;
    page: number;
}

interface TextDocument {
    type: string;
    name?: string;
    text?: string;
}

interface CsvDocument {
    type: string;
    name?: string;
    headers?: string[];
    data?: any[][];
}

interface ImageDocument {
    type: string;
    name?: string;
}

interface PdfDocument {
    type: string;
    name?: string;
}

type DocumentType = string | File | Blob | TextDocument | CsvDocument | ImageDocument | PdfDocument;

interface DocumentViewerProps {
    document: DocumentType | null;
    onSelectText?: (text: string, pageNumber: number) => void;
    onSelectRegion?: (region: Region) => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ document, onSelectText, onSelectRegion }) => {
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.0);
    const [isTextSelectionMode, setIsTextSelectionMode] = useState<boolean>(false);
    const [isRegionSelectionMode, setIsRegionSelectionMode] = useState<boolean>(false);
    const [selectionStart, setSelectionStart] = useState<Point | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<Point | null>(null);
    const [documentType, setDocumentType] = useState<string>('unknown');
    const documentRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        // Determine document type based on file extension or mime type
        if (document) {
            const doc = document as any;
            if (doc.type === 'application/pdf' || doc.name?.endsWith('.pdf')) {
                setDocumentType('pdf');
            } else if (doc.type?.startsWith('image/') ||
                ['jpg', 'jpeg', 'png', 'gif', 'webp'].some(ext => doc.name?.endsWith(`.${ext}`))) {
                setDocumentType('image');
            } else if (doc.type === 'text/plain' || doc.name?.endsWith('.txt')) {
                setDocumentType('text');
            } else if (doc.type === 'text/csv' || doc.name?.endsWith('.csv')) {
                setDocumentType('csv');
            } else {
                setDocumentType('unknown');
            }
        }
    }, [document]);

    const onDocumentLoadSuccess = ({ numPages }: OnLoadSuccessProps): void => {
        setNumPages(numPages);
        setPageNumber(1);
    };

    const changePage = (offset: number): void => {
        setPageNumber(prevPageNumber => {
            if (numPages === null) return prevPageNumber;
            const newPageNumber = prevPageNumber + offset;
            return Math.min(Math.max(1, newPageNumber), numPages);
        });
    };

    const previousPage = (): void => changePage(-1);
    const nextPage = (): void => changePage(1);

    const zoomIn = (): void => setScale(prevScale => Math.min(prevScale + 0.2, 3));
    const zoomOut = (): void => setScale(prevScale => Math.max(prevScale - 0.2, 0.5));
    const resetZoom = (): void => setScale(1);

    const handleMouseDown = (e: MouseEvent<HTMLDivElement>): void => {
        if (!isTextSelectionMode && !isRegionSelectionMode) return;
        if (!documentRef.current) return;

        const containerRect = documentRef.current.getBoundingClientRect();
        setSelectionStart({
            x: e.clientX - containerRect.left,
            y: e.clientY - containerRect.top
        });
        setSelectionEnd(null);
    };

    const handleMouseMove = (e: MouseEvent<HTMLDivElement>): void => {
        if (!selectionStart || (!isTextSelectionMode && !isRegionSelectionMode)) return;
        if (!documentRef.current) return;

        const containerRect = documentRef.current.getBoundingClientRect();
        setSelectionEnd({
            x: e.clientX - containerRect.left,
            y: e.clientY - containerRect.top
        });
    };

    const handleMouseUp = (e: MouseEvent<HTMLDivElement>): void => {
        if (!selectionStart || (!isTextSelectionMode && !isRegionSelectionMode)) return;
        if (!documentRef.current) return;

        const containerRect = documentRef.current.getBoundingClientRect();
        const endPoint: Point = {
            x: e.clientX - containerRect.left,
            y: e.clientY - containerRect.top
        };

        // Finalize selection
        if (isRegionSelectionMode && selectionStart) {
            const region: Region = {
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

    const toggleTextSelectionMode = (): void => {
        setIsTextSelectionMode(!isTextSelectionMode);
        setIsRegionSelectionMode(false);
    };

    const toggleRegionSelectionMode = (): void => {
        setIsRegionSelectionMode(!isRegionSelectionMode);
        setIsTextSelectionMode(false);
    };

    const renderSelectionOverlay = (): JSX.Element | null => {
        if (!selectionStart || !selectionEnd || !isRegionSelectionMode) return null;

        const style: CSSProperties = {
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

    const renderPdfViewer = (): JSX.Element => (
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
                    <button onClick={nextPage} disabled={pageNumber === numPages}>Next</button>
                </div>

                <div className="zoom-controls">
                    <button onClick={zoomOut}>−</button>
                    <button onClick={resetZoom}>Reset</button>
                    <button onClick={zoomIn}>+</button>
                </div>
            </div>
        </>
    );

    const renderImageViewer = (): JSX.Element => (
        <div className="document-image-container">
            <img
                src={typeof document === 'string' ? document : URL.createObjectURL(document as Blob)}
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

    const renderTextViewer = (): JSX.Element => (
        <div className="document-text-container">
            <pre className="document-text">{(document as TextDocument).text || 'Loading text content...'}</pre>
        </div>
    );

    const renderCsvViewer = (): JSX.Element => (
        <div className="document-csv-container">
            <table className="document-csv-table">
                <thead>
                    {(document as CsvDocument).headers && (
                        <tr>
                            {(document as CsvDocument).headers?.map((header, index) => (
                                <th key={index}>{header}</th>
                            ))}
                        </tr>
                    )}
                </thead>
                <tbody>
                    {(document as CsvDocument).data && (document as CsvDocument).data?.map((row, rowIndex) => (
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

    const renderUnknownFormatViewer = (): JSX.Element => (
        <div className="document-unknown-container">
            <div className="document-unknown-message">
                <p>Preview not available for this document type.</p>
                <p>File: {(document as any)?.name || 'Unknown document'}</p>
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

    const renderDocumentContent = (): JSX.Element => {
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
                    <h3>{(document as any).name || 'Document'}</h3>
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
