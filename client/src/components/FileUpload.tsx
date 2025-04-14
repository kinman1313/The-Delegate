// FileUpload.tsx
import React, { useState, ChangeEvent, FormEvent } from 'react';
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
}

interface ProgressEvent {
    lengthComputable: boolean;
    loaded: number;
    total: number;
}

const FileUpload: React.FC<FileUploadProps> = ({ conversationId, token, onFileUploaded, onCancel }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number>(0);

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
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];

        if (!allowedTypes.includes(file.type)) {
            setError('Invalid file type. Only text, documents, and spreadsheets are allowed.');
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

            // Monitor upload progress
            const progressCallback = (event: ProgressEvent) => {
                if (event.lengthComputable) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    setUploadProgress(percentComplete);
                }
            };

            if (!token) {
                throw new Error('Authentication token is missing');
            }

            const result = await uploadFile(token, formData, progressCallback);

            // Call the parent component's callback with file info
            onFileUploaded(result);
        } catch (err: any) {
            console.error('File upload failed:', err);
            setError(err.message || 'File upload failed. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="file-upload-container">
            <div className="file-upload-header">
                <h2>Upload File</h2>
                <button onClick={onCancel} className="close-btn">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="file-upload-form">
                <div className="file-input-group">
                    <label htmlFor="file-upload" className="file-input-label">
                        {file ? file.name : 'Choose a file'}
                    </label>
                    <input
                        type="file"
                        id="file-upload"
                        onChange={handleFileChange}
                        className="file-input"
                        disabled={isUploading}
                    />
                </div>

                {file && (
                    <div className="file-details">
                        <p className="file-name">{file.name}</p>
                        <p className="file-size">{(file.size / 1024).toFixed(2)} KB</p>
                        <p className="file-type">{file.type}</p>
                    </div>
                )}

                {error && <div className="upload-error">{error}</div>}

                {isUploading && (
                    <div className="upload-progress-container">
                        <div
                            className="upload-progress-bar"
                            style={{ width: `${uploadProgress}%` }}
                        ></div>
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
                </ul>
                <p className="upload-note">Maximum file size: 10MB</p>
            </div>
        </div>
    );
};

export default FileUpload;
