// FileUpload.tsx - Improved Implementation
import React, { useState, useRef, ChangeEvent, FormEvent } from 'react';
import { uploadFile } from '../services/apiService';

interface FileUploadProps {
    conversationId: string | null;
    token: string | null;
    onFileUploaded: (fileData: FileUploadResult) => void;
    onCancel: () => void;
}

interface FileUploadResult {
    fileId: string;
    filename: string;
    reference: string;
    type: string;
    _id?: string;
    originalName?: string;
    mimetype?: string;
    uploadedAt?: string;
}

interface UploadProgressEvent {
    loaded: number;
    total: number;
}

const FileUpload: React.FC<FileUploadProps> = ({ conversationId, token, onFileUploaded, onCancel }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setError(null);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!file) {
            setError('Please select a file to upload');
            return;
        }

        // Check file size (limit to 10MB)
        if (file.size > 10 * 1024 * 1024) {
            setError('File is too large. Maximum allowed size is 10MB.');
            return;
        }

        // Check file type
        const allowedTypes = [
            'text/plain', 'text/csv', 'application/json',
            'application/pdf', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'image/jpeg', 'image/png', 'image/gif'
        ];

        if (!allowedTypes.includes(file.type)) {
            setError('Invalid file type. Only text, documents, spreadsheets, and images are allowed.');
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            // Create a FormData object to send the file
            const formData = new FormData();
            formData.append('file', file);

            if (conversationId) {
                formData.append('conversationId', conversationId);
            }

            if (!token) {
                throw new Error('Authentication token is missing');
            }

            // Create XMLHttpRequest for progress monitoring
            const xhr = new XMLHttpRequest();
            const promise = new Promise<FileUploadResult>((resolve, reject) => {
                xhr.open('POST', '/api/files/upload');
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                
                xhr.upload.addEventListener('progress', (event: ProgressEvent) => {
                    if (event.lengthComputable) {
                        const progress = Math.round((event.loaded / event.total) * 100);
                        setUploadProgress(progress);
                    }
                });
                
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const response = JSON.parse(xhr.responseText);
                            resolve(response);
                        } catch (e) {
                            reject(new Error('Invalid response format'));
                        }
                    } else {
                        try {
                            const errorData = JSON.parse(xhr.responseText);
                            reject(new Error(errorData.error || 'Upload failed'));
                        } catch (e) {
                            reject(new Error(`Upload failed with status ${xhr.status}`));
                        }
                    }
                };
                
                xhr.onerror = () => {
                    reject(new Error('Network error during file upload'));
                };
                
                xhr.send(formData);
            });

            const result = await promise;
            onFileUploaded(result);
        } catch (err: any) {
            console.error('File upload failed:', err);
            setError(err.message || 'File upload failed. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setFile(e.dataTransfer.files[0]);
            setError(null);
        }
    };

    return (
        <div className="file-upload-container">
            <div className="file-upload-header">
                <h2>Upload File</h2>
                <button onClick={onCancel} className="close-btn">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="file-upload-form">
                <div 
                    className="file-drop-area"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="file-input"
                        style={{ display: 'none' }}
                        disabled={isUploading}
                    />
                    
                    <div className="file-drop-content">
                        {file ? (
                            <div className="selected-file">
                                <div className="file-icon">{getFileIcon(file.type)}</div>
                                <div className="file-details">
                                    <p className="file-name">{file.name}</p>
                                    <p className="file-size">{formatFileSize(file.size)}</p>
                                    <p className="file-type">{file.type}</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="upload-icon">📁</div>
                                <p>Drag & drop a file here or click to select</p>
                                <p className="upload-note">Maximum file size: 10MB</p>
                            </>
                        )}
                    </div>
                </div>

                {error && <div className="upload-error">{error}</div>}

                {isUploading && (
                    <div className="upload-progress-container">
                        <div className="upload-progress-bar">
                            <div 
                                className="upload-progress-fill" 
                                style={{ width: `${uploadProgress}%` }}
                            ></div>
                        </div>
                        <span className="upload-progress-text">{uploadProgress}%</span>
                    </div>
                )}

                <div className="upload-actions">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="cancel-btn"
                        disabled={isUploading}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="upload-btn"
                        disabled={!file || isUploading}
                    >
                        {isUploading ? 'Uploading...' : 'Upload'}
                    </button>
                </div>
            </form>

            <div className="upload-info">
                <h3>Supported file types:</h3>
                <ul>
                    <li>Text files (.txt, .csv, .json)</li>
                    <li>Documents (.pdf, .doc, .docx)</li>
                    <li>Spreadsheets (.xls, .xlsx)</li>
                    <li>Images (.jpg, .png, .gif)</li>
                </ul>
            </div>
        </div>
    );
};

// Helper functions
function getFileIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return '📊';
    if (mimeType.includes('word')) return '📝';
    if (mimeType.includes('text')) return '📃';
    return '📁';
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default FileUpload;