import { useState, useCallback, useEffect } from 'react';
import { API_BASE_URL } from '../env';

interface StorageResult {
  success: boolean;
  error?: string;
  data?: {
    result: {
      operation: 'getUploadUrl' | 'getFile' | 'deleteFile' | 'updateFile';
      success: boolean;
      error?: string;
      uploadUrl?: string;
      downloadUrl?: string;
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
      contentType?: string;
      lastModified?: string;
      deleted?: boolean;
      updated?: boolean;
    };
  };
}

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  downloadUrl?: string;
}

export default function R2StorageDemo() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bucketName, setBucketName] = useState('bubble-lab-bucket');
  const [isUploading, setIsUploading] = useState(false);
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [uploadResult, setUploadResult] = useState<StorageResult | null>(null);
  const [retrieveResult, setRetrieveResult] = useState<StorageResult | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [fileNameToGet, setFileNameToGet] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<
    'image' | 'pdf' | 'text' | null
  >(null);

  const API_BASE_URL_LOCAL = API_BASE_URL;

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setError(null);
    setUploadResult(null);

    // Create preview for supported file types
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setPreviewType('image');
    } else if (file.type === 'application/pdf') {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setPreviewType('pdf');
    } else if (file.type.startsWith('text/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setPreviewType('text');
    } else {
      setPreviewUrl(null);
      setPreviewType(null);
    }
  }, []);

  const uploadToR2 = useCallback(async () => {
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadResult(null);

    try {
      // Step 1: Get upload URL from our StorageBubble
      const bubbleFlowCode = `
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';
import { BubbleFlow, StorageBubble } from '@bubblelab/bubble-core';

export interface Output {
  uploadUrl: string;
  fileName: string;
  message: string;
}

export class R2UploadFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('r2-upload-flow', 'Generate R2 upload URL for file storage');
  }

  async handle(
    payload: BubbleTriggerEventRegistry['webhook/http']
  ): Promise<Output> {
    const { fileName, bucketName, contentType } = payload.body as {
      fileName: string;
      bucketName: string;
      contentType: string;
    };

    const result = await new StorageBubble({
      operation: 'getUploadUrl',
      bucketName,
      fileName,
      contentType,
      expirationMinutes: 60,
    }).action();

    if (!result.success || !result.data?.uploadUrl) {
      throw new Error(result.data?.error || 'Failed to generate upload URL');
    }

    return {
      uploadUrl: result.data.uploadUrl,
      fileName: result.data.fileName || fileName,
      message: \`Upload URL generated for \${fileName}\`,
    };
  }
}`;

      // Create BubbleFlow
      const createResponse = await fetch(`${API_BASE_URL_LOCAL}/bubble-flow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `R2Upload_${Date.now()}`,
          description: 'R2 Storage Upload Demo',
          code: bubbleFlowCode,
          eventType: 'webhook/http',
          webhookActive: false,
        }),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create BubbleFlow');
      }

      const createResult = await createResponse.json();
      const bubbleFlowId = createResult.id;

      // Execute BubbleFlow to get upload URL
      const executeResponse = await fetch(
        `${API_BASE_URL_LOCAL}/bubble-flow/${bubbleFlowId}/execute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: selectedFile.name,
            bucketName: bucketName,
            contentType: selectedFile.type || 'application/octet-stream',
          }),
        }
      );

      if (!executeResponse.ok) {
        const error = await executeResponse.json();
        throw new Error(error.error || 'Failed to get upload URL');
      }

      const executeResult = await executeResponse.json();
      console.log('Execute result:', executeResult);

      // The result might be nested in different ways depending on BubbleFlow execution
      const uploadUrl =
        executeResult.uploadUrl ||
        executeResult.data?.uploadUrl ||
        executeResult.result?.uploadUrl;

      if (!uploadUrl) {
        console.error(
          'Full execute result:',
          JSON.stringify(executeResult, null, 2)
        );
        throw new Error(
          `No upload URL received. Got: ${JSON.stringify(executeResult)}`
        );
      }

      // Step 2: Upload file directly to R2 using the presigned URL
      // Note: This requires CORS to be configured on the R2 bucket
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': selectedFile.type || 'application/octet-stream',
        },
        mode: 'cors', // Explicitly set CORS mode
      });

      if (!uploadResponse.ok) {
        throw new Error(
          `Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`
        );
      }

      // Success!
      const newFile: UploadedFile = {
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type,
        uploadedAt: new Date().toISOString(),
      };

      setUploadedFiles((prev) => [newFile, ...prev]);
      setUploadResult({
        success: true,
        data: {
          result: {
            operation: 'getUploadUrl',
            success: true,
            uploadUrl,
            fileName: selectedFile.name,
            error: '',
          },
        },
      });

      // Auto-populate file name for retrieval demo
      setFileNameToGet(selectedFile.name);
    } catch (error) {
      let errorMessage =
        error instanceof Error ? error.message : 'Upload failed';

      // Provide helpful message for CORS issues
      if (
        errorMessage.includes('CORS') ||
        errorMessage.includes('Access-Control-Allow-Origin')
      ) {
        errorMessage = `CORS Error: The R2 bucket '${bucketName}' needs CORS configuration to allow uploads from http://localhost:3000. Please configure CORS in Cloudflare Dashboard → R2 → ${bucketName} → Settings → CORS Policy.`;
      }

      setError(errorMessage);
      setUploadResult({
        success: false,
        error: errorMessage,
      });
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, bucketName, API_BASE_URL_LOCAL]);

  const retrieveFromR2 = useCallback(async () => {
    if (!fileNameToGet.trim()) {
      setError('Please enter a file name to retrieve');
      return;
    }

    setIsRetrieving(true);
    setError(null);
    setRetrieveResult(null);

    try {
      // Create BubbleFlow to get file download URL
      const bubbleFlowCode = `
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';
import { BubbleFlow, StorageBubble } from '@bubblelab/bubble-core';

export interface Output {
  downloadUrl: string;
  fileName: string;
  fileSize?: number;
  contentType?: string;
  lastModified?: string;
  message: string;
}

export class R2RetrieveFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('r2-retrieve-flow', 'Generate R2 download URL for file retrieval');
  }

  async handle(
    payload: BubbleTriggerEventRegistry['webhook/http']
  ): Promise<Output> {
    const { fileName, bucketName } = payload.body as {
      fileName: string;
      bucketName: string;
    };

    const result = await new StorageBubble({
      operation: 'getFile',
      bucketName,
      fileName,
      expirationMinutes: 60,
    }).action();

    if (!result.success || !result.data?.downloadUrl) {
      throw new Error(result.data?.error || 'Failed to generate download URL');
    }

    return {
      downloadUrl: result.data.downloadUrl,
      fileName: result.data.fileName || fileName,
      fileSize: result.data.fileSize,
      contentType: result.data.contentType,
      lastModified: result.data.lastModified,
      message: \`Download URL generated for \${fileName}\`,
    };
  }
}`;

      // Create BubbleFlow
      const createResponse = await fetch(`${API_BASE_URL_LOCAL}/bubble-flow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `R2Retrieve_${Date.now()}`,
          description: 'R2 Storage Retrieve Demo',
          code: bubbleFlowCode,
          eventType: 'webhook/http',
          webhookActive: false,
        }),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create BubbleFlow');
      }

      const createResult = await createResponse.json();
      const bubbleFlowId = createResult.id;

      // Execute BubbleFlow to get download URL
      const executeResponse = await fetch(
        `${API_BASE_URL_LOCAL}/bubble-flow/${bubbleFlowId}/execute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: fileNameToGet,
            bucketName: bucketName,
          }),
        }
      );

      if (!executeResponse.ok) {
        const error = await executeResponse.json();
        throw new Error(error.error || 'Failed to get download URL');
      }

      const executeResult = await executeResponse.json();
      console.log('Retrieve execute result:', executeResult);

      // The result might be nested in different ways depending on BubbleFlow execution
      const downloadUrl =
        executeResult.downloadUrl ||
        executeResult.data?.downloadUrl ||
        executeResult.result?.downloadUrl;

      if (!downloadUrl) {
        console.error(
          'Full retrieve result:',
          JSON.stringify(executeResult, null, 2)
        );
        throw new Error(
          `No download URL received. Got: ${JSON.stringify(executeResult)}`
        );
      }

      setRetrieveResult({
        success: true,
        data: {
          result: {
            operation: 'getFile',
            success: true,
            downloadUrl: downloadUrl,
            fileUrl: downloadUrl,
            fileName:
              executeResult.fileName ||
              executeResult.data?.fileName ||
              executeResult.result?.fileName,
            fileSize:
              executeResult.fileSize ||
              executeResult.data?.fileSize ||
              executeResult.result?.fileSize,
            contentType:
              executeResult.contentType ||
              executeResult.data?.contentType ||
              executeResult.result?.contentType,
            lastModified:
              executeResult.lastModified ||
              executeResult.data?.lastModified ||
              executeResult.result?.lastModified,
            error: '',
          },
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Retrieval failed';
      setError(errorMessage);
      setRetrieveResult({
        success: false,
        error: errorMessage,
      });
    } finally {
      setIsRetrieving(false);
    }
  }, [fileNameToGet, bucketName, API_BASE_URL_LOCAL]);

  const downloadFile = useCallback((downloadUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d1117] to-[#161b22] p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-xl">☁️</span>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
              R2 Storage Demo
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Upload files to Cloudflare R2 using StorageBubble, then retrieve
            them with secure presigned URLs
          </p>
        </div>

        {/* Configuration */}
        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-6 h-6 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <span className="text-blue-400 text-sm">⚙️</span>
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              Configuration
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground-80 mb-2">
                Bucket Name
              </label>
              <input
                type="text"
                value={bucketName}
                onChange={(e) => setBucketName(e.target.value)}
                placeholder="bubble-lab-bucket"
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The R2 bucket name where files will be stored
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                <span className="text-green-400">📤</span>
              </div>
              <h2 className="text-xl font-semibold text-foreground">
                Upload to R2
              </h2>
            </div>

            {/* File Upload */}
            <div className="space-y-4">
              <div
                className="border-2 border-dashed border-border rounded-xl p-8 text-center transition-all duration-200 hover:border-green-500/50 hover:bg-green-500/5"
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileSelect(file);
                }}
                onDragOver={(e) => e.preventDefault()}
              >
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                  accept="image/*,.pdf,.txt,.doc,.docx"
                />
                <label htmlFor="file-upload" className="cursor-pointer block">
                  <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-green-400 text-2xl">📁</span>
                  </div>
                  <p className="text-foreground-80 mb-2">
                    {selectedFile
                      ? selectedFile.name
                      : 'Click to select or drag & drop'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Supports images, PDFs, documents, and text files
                  </p>
                  {selectedFile && (
                    <div className="mt-4 text-sm text-muted-foreground">
                      <p>Size: {formatFileSize(selectedFile.size)}</p>
                      <p>Type: {selectedFile.type || 'Unknown'}</p>
                    </div>
                  )}
                </label>
              </div>

              {/* File Preview */}
              {previewUrl && (
                <div className="bg-background border border-border rounded-lg p-4">
                  <h4 className="text-sm font-medium text-foreground-80 mb-3">
                    Preview
                  </h4>
                  {previewType === 'image' && (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="max-w-full max-h-48 rounded-lg object-contain mx-auto"
                    />
                  )}
                  {previewType === 'pdf' && (
                    <iframe
                      src={previewUrl}
                      className="w-full h-48 rounded-lg border border-border"
                      title="PDF Preview"
                    />
                  )}
                </div>
              )}

              <button
                onClick={uploadToR2}
                disabled={!selectedFile || isUploading}
                className={`w-full py-3 px-6 rounded-lg font-medium transition-all duration-200 ${
                  !selectedFile || isUploading
                    ? 'bg-gray-600/20 border border-gray-600/50 cursor-not-allowed text-muted-foreground'
                    : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg shadow-green-500/25 border border-green-400/30'
                }`}
              >
                {isUploading ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Uploading...
                  </>
                ) : (
                  <>
                    <span className="mr-2">☁️</span>
                    Upload to R2
                  </>
                )}
              </button>

              {/* Upload Result */}
              {uploadResult && (
                <div
                  className={`p-4 rounded-lg border ${
                    uploadResult.success
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`text-xl ${
                        uploadResult.success ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {uploadResult.success ? '✅' : '❌'}
                    </span>
                    <div className="flex-1">
                      <h4
                        className={`font-medium ${
                          uploadResult.success
                            ? 'text-green-300'
                            : 'text-red-300'
                        }`}
                      >
                        {uploadResult.success
                          ? 'Upload Successful!'
                          : 'Upload Failed'}
                      </h4>
                      {uploadResult.success && uploadResult.data?.result && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          <p>File: {uploadResult.data.result.fileName}</p>
                          <p>Uploaded to bucket: {bucketName}</p>
                        </div>
                      )}
                      {uploadResult.error && (
                        <p className="mt-1 text-sm text-red-400">
                          {uploadResult.error}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Retrieve Section */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <span className="text-blue-400">📥</span>
              </div>
              <h2 className="text-xl font-semibold text-foreground">
                Retrieve from R2
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-80 mb-2">
                  File Name
                </label>
                <input
                  type="text"
                  value={fileNameToGet}
                  onChange={(e) => setFileNameToGet(e.target.value)}
                  placeholder="example.pdf"
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the exact filename as stored in R2
                </p>
              </div>

              <button
                onClick={retrieveFromR2}
                disabled={!fileNameToGet.trim() || isRetrieving}
                className={`w-full py-3 px-6 rounded-lg font-medium transition-all duration-200 ${
                  !fileNameToGet.trim() || isRetrieving
                    ? 'bg-gray-600/20 border border-gray-600/50 cursor-not-allowed text-muted-foreground'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 border border-blue-400/30'
                }`}
              >
                {isRetrieving ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Retrieving...
                  </>
                ) : (
                  <>
                    <span className="mr-2">🔗</span>
                    Get Download URL
                  </>
                )}
              </button>

              {/* Retrieve Result */}
              {retrieveResult && (
                <div
                  className={`p-4 rounded-lg border ${
                    retrieveResult.success
                      ? 'bg-blue-500/10 border-blue-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`text-xl ${
                        retrieveResult.success
                          ? 'text-blue-400'
                          : 'text-red-400'
                      }`}
                    >
                      {retrieveResult.success ? '🔗' : '❌'}
                    </span>
                    <div className="flex-1">
                      <h4
                        className={`font-medium ${
                          retrieveResult.success
                            ? 'text-blue-300'
                            : 'text-red-300'
                        }`}
                      >
                        {retrieveResult.success
                          ? 'Download URL Generated!'
                          : 'Retrieval Failed'}
                      </h4>
                      {retrieveResult.success &&
                        retrieveResult.data?.result && (
                          <div className="mt-2 space-y-2">
                            <div className="text-sm text-muted-foreground">
                              <p>File: {retrieveResult.data.result.fileName}</p>
                              {retrieveResult.data.result.fileSize && (
                                <p>
                                  Size:{' '}
                                  {formatFileSize(
                                    retrieveResult.data.result.fileSize
                                  )}
                                </p>
                              )}
                              {retrieveResult.data.result.contentType && (
                                <p>
                                  Type: {retrieveResult.data.result.contentType}
                                </p>
                              )}
                              {retrieveResult.data.result.lastModified && (
                                <p>
                                  Modified:{' '}
                                  {new Date(
                                    retrieveResult.data.result.lastModified
                                  ).toLocaleString()}
                                </p>
                              )}
                            </div>
                            {retrieveResult.data.result.downloadUrl && (
                              <button
                                onClick={() =>
                                  downloadFile(
                                    retrieveResult.data!.result.downloadUrl!,
                                    retrieveResult.data!.result.fileName ||
                                      'download'
                                  )
                                }
                                className="bg-green-600/20 hover:bg-green-600/30 border border-green-600/50 text-green-300 hover:text-green-200 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                              >
                                📥 Download File
                              </button>
                            )}
                          </div>
                        )}
                      {retrieveResult.error && (
                        <p className="mt-1 text-sm text-red-400">
                          {retrieveResult.error}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Uploaded Files History */}
        {uploadedFiles.length > 0 && (
          <div className="mt-8 bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <span className="text-purple-400">📋</span>
              </div>
              <h2 className="text-xl font-semibold text-foreground">
                Recent Uploads
              </h2>
            </div>

            <div className="space-y-3">
              {uploadedFiles.map((file, index) => (
                <div
                  key={index}
                  className="bg-background border border-border rounded-lg p-4 hover:border-border-80 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                        <span className="text-blue-400">📁</span>
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">
                          {file.name}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(file.size)} • {file.type} •{' '}
                          {new Date(file.uploadedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setFileNameToGet(file.name)}
                      className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 text-blue-300 hover:text-blue-200 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                    >
                      Retrieve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-red-400 text-xl">⚠️</span>
              <div>
                <h4 className="font-medium text-red-300 mb-1">Error</h4>
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Technical Info */}
        <div className="mt-8 bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-6 h-6 bg-gray-500/20 rounded-lg flex items-center justify-center">
              <span className="text-muted-foreground text-sm">ℹ️</span>
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              How it Works
            </h3>
          </div>

          <div className="space-y-4 text-sm text-muted-foreground">
            <div>
              <h4 className="font-medium text-foreground-80 mb-2">
                Upload Process:
              </h4>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>StorageBubble generates a presigned upload URL for R2</li>
                <li>
                  File is uploaded directly to Cloudflare R2 using the presigned
                  URL
                </li>
                <li>No file data passes through our servers - direct to R2</li>
                <li>Upload URLs expire after 60 minutes for security</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium text-foreground-80 mb-2">
                Retrieval Process:
              </h4>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>
                  StorageBubble generates a presigned download URL for the
                  requested file
                </li>
                <li>URL includes file metadata (size, type, last modified)</li>
                <li>Download URLs expire after 60 minutes for security</li>
                <li>
                  Files can be downloaded directly from R2 using the secure URL
                </li>
              </ol>
            </div>

            <div className="bg-background border border-border rounded-lg p-4">
              <h4 className="font-medium text-foreground-80 mb-2">
                🔒 Security Features:
              </h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Time-limited presigned URLs (60 minutes)</li>
                <li>No permanent public access to files</li>
                <li>Credentials auto-injected from environment</li>
                <li>Direct R2 upload/download - no proxy servers</li>
              </ul>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <h4 className="font-medium text-yellow-300 mb-2">
                ⚠️ CORS Configuration Required:
              </h4>
              <p className="text-sm text-yellow-200 mb-2">
                For direct browser uploads to work, the R2 bucket must have CORS
                configured:
              </p>
              <ol className="list-decimal list-inside space-y-1 ml-4 text-sm text-yellow-200">
                <li>Go to Cloudflare Dashboard → R2 → {bucketName}</li>
                <li>Settings tab → CORS Policy</li>
                <li>Add localhost:3000 and *.bubblelab.ai to AllowedOrigins</li>
                <li>Include PUT, GET, POST, DELETE, HEAD in AllowedMethods</li>
              </ol>
              <div className="mt-3 bg-background border border-yellow-500/20 rounded-lg p-3">
                <h5 className="font-medium text-yellow-300 text-sm mb-2">
                  CORS Configuration JSON:
                </h5>
                <pre className="text-xs text-yellow-200 overflow-x-auto">
                  {`[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://*.bubblelab.ai"
    ],
    "AllowedMethods": [
      "GET", "PUT", "POST", "DELETE", "HEAD"
    ],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
