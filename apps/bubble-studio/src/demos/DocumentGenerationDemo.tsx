import { useState, useCallback, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import { API_BASE_URL } from '../env';

interface ParsedDocument {
  id: string;
  file: File;
  status: 'pending' | 'parsing' | 'completed' | 'error';
  previewUrl?: string;
  editableMarkdown?: string;
  compressedSize?: number; // Size after compression (for images)
  parsedResult?: {
    success: boolean;
    error?: string;
    data?: {
      markdown: string;
      pages: Array<{
        pageNumber: number;
        markdown: string;
        hasCharts: boolean;
        hasTables: boolean;
        hasImages: boolean;
        confidence: number;
      }>;
      metadata: {
        totalPages: number;
        processedPages: number;
        hasVisualElements: boolean;
        processingTime: number;
        imageFormat: string;
        imageDpi: number;
      };
    };
  };
}

interface GenerationResult {
  success: boolean;
  error?: string;
  generatedFiles?: {
    html?: string;
    csv?: string;
    json?: string;
  };
  data?: {
    output: string;
    format: string;
    generatedAt: string;
    sourceDocuments: number;
    summary: {
      totalCharacters: number;
      totalPages: number;
      processedDocuments: number;
    };
    generatedFiles?: {
      html?: string;
      csv?: string;
      json?: string;
    };
  };
}

export default function DocumentGenerationDemo() {
  const [documents, setDocuments] = useState<ParsedDocument[]>([]);
  const [outputSpec, setOutputSpec] = useState(
    `Extract expense tracking data with the following fields: vendor name, transaction date, amount, category (meals/travel/office/etc), description, and document source. Create a structured table format suitable for expense reporting and accounting purposes.`
  );
  const [outputFormat, setOutputFormat] = useState<'html' | 'csv'>('html');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] =
    useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL_LOCAL = API_BASE_URL;

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      documents.forEach((doc) => {
        if (doc.previewUrl) {
          URL.revokeObjectURL(doc.previewUrl);
        }
      });
    };
  }, [documents]);

  // Listen for Excel download messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'DOWNLOAD_EXCEL') {
        console.log('Received Excel download request from iframe');

        // Create download link in parent window
        const link = document.createElement('a');
        link.href = event.data.url;
        link.download = event.data.filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log('Excel download initiated from parent window');

        // Clean up the blob URL after a short delay
        setTimeout(() => {
          URL.revokeObjectURL(event.data.url);
        }, 1000);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newDocuments: ParsedDocument[] = Array.from(files)
        .filter(
          (file) =>
            file.type === 'application/pdf' || file.type.startsWith('image/')
        )
        .map((file) => ({
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          file,
          status: 'pending' as const,
          previewUrl: URL.createObjectURL(file),
        }));

      setDocuments((prev) => [...prev, ...newDocuments]);
      setError(null);

      // Start parsing immediately after parseDocument is defined
      newDocuments.forEach((doc) => parseDocument(doc));
    }
  };

  const compressImage = useCallback(async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 1.5, // Maximum file size in MB
      maxWidthOrHeight: 1920, // Max width or height
      useWebWorker: true, // Use web worker for better performance
      fileType: file.type, // Preserve original file type
      initialQuality: 0.8, // Initial quality setting
    };

    try {
      const compressedFile = await imageCompression(file, options);
      console.log(`[DocumentGenerationDemo] Image compressed: ${file.name}`);
      console.log(
        `[DocumentGenerationDemo] Original size: ${Math.round(file.size / 1024)}KB`
      );
      console.log(
        `[DocumentGenerationDemo] Compressed size: ${Math.round(compressedFile.size / 1024)}KB`
      );
      console.log(
        `[DocumentGenerationDemo] Compression ratio: ${Math.round((1 - compressedFile.size / file.size) * 100)}%`
      );

      return compressedFile;
    } catch (error) {
      console.error(
        '[DocumentGenerationDemo] Image compression failed:',
        error
      );
      throw new Error('Failed to compress image');
    }
  }, []);

  const convertFileToBase64 = useCallback(
    async (file: File): Promise<string> => {
      let processedFile = file;

      // Compress image files before converting to base64
      if (file.type.startsWith('image/')) {
        console.log(
          `[DocumentGenerationDemo] Compressing image: ${file.name} (${Math.round(file.size / 1024)}KB)`
        );
        processedFile = await compressImage(file);
        console.log(
          `[DocumentGenerationDemo] Compressed to: ${Math.round(processedFile.size / 1024)}KB`
        );
      }

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            const base64Data = reader.result.split(',')[1];
            resolve(base64Data);
          } else {
            reject(new Error('Failed to read file as base64'));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(processedFile);
      });
    },
    [compressImage]
  );

  const parseDocument = useCallback(
    async (document: ParsedDocument) => {
      // Update status to parsing
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === document.id ? { ...doc, status: 'parsing' as const } : doc
        )
      );

      try {
        // For images, compress first and store the compressed size
        let compressedSize: number | undefined;
        if (document.file.type.startsWith('image/')) {
          const compressedFile = await compressImage(document.file);
          compressedSize = compressedFile.size;

          // Update the document with compressed size info
          setDocuments((prev) =>
            prev.map((doc) =>
              doc.id === document.id ? { ...doc, compressedSize } : doc
            )
          );
        }

        const fileBase64 = await convertFileToBase64(document.file);
        const documentType =
          document.file.type === 'application/pdf' ? 'pdf' : 'image';

        const workflowParams = {
          documentData: fileBase64,
          documentType,
          conversionOptions: {
            preserveStructure: true,
            includeVisualDescriptions: true,
            extractNumericalData: true,
            combinePages: true,
          },
          imageOptions: {
            format: 'png' as const,
            quality: 0.9,
            dpi: 200,
          },
          aiOptions: {
            model: 'google/gemini-2.5-flash' as const,
            temperature: 0.2,
            maxTokens: 90000,
            jsonMode: false,
          },
        };

        const createFlowCode = `
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';
import { BubbleFlow, ParseDocumentWorkflow } from '@bubblelab/bubble-core';

export interface Output {
  result: unknown;
}

export class ParseDocDemoFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('parse-doc-demo', 'Parse Document Demo Flow');
  }
  
  async handle(payload: BubbleTriggerEventRegistry['webhook/http']): Promise<Output> {
    const documentData = payload.documentData as string;
    const documentType = payload.documentType as 'pdf' | 'image';
    
    const workflow = new ParseDocumentWorkflow({
      documentData,
      documentType,
      conversionOptions: {
        preserveStructure: ${workflowParams.conversionOptions.preserveStructure},
        includeVisualDescriptions: ${workflowParams.conversionOptions.includeVisualDescriptions},
        extractNumericalData: ${workflowParams.conversionOptions.extractNumericalData},
        combinePages: ${workflowParams.conversionOptions.combinePages},
      },
      imageOptions: {
        format: '${workflowParams.imageOptions.format}',
        quality: ${workflowParams.imageOptions.quality},
        dpi: ${workflowParams.imageOptions.dpi},
      },
      aiOptions: {
        model: '${workflowParams.aiOptions.model}',
        temperature: ${workflowParams.aiOptions.temperature},
        maxTokens: ${workflowParams.aiOptions.maxTokens},
        jsonMode: ${workflowParams.aiOptions.jsonMode},
      }
    });
    
    const result = await workflow.action();
    return { result };
  }
}`;

        // Create the BubbleFlow
        const createPayload = {
          name: `Parse_Document_Demo_${Date.now()}_${document.id}`,
          description: 'Parse Document Demo',
          code: createFlowCode,
          eventType: 'webhook/http',
          webhookActive: false,
        };

        const createResponse = await fetch(
          `${API_BASE_URL_LOCAL}/bubble-flow`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(createPayload),
          }
        );

        if (!createResponse.ok) {
          const error = await createResponse.json();
          throw new Error(error.error || 'Failed to create parse workflow');
        }

        const createResult = await createResponse.json();
        const bubbleFlowId = createResult.id;

        // Execute the workflow
        const executePayload = {
          documentData: fileBase64,
          documentType,
        };

        const executeResponse = await fetch(
          `${API_BASE_URL_LOCAL}/bubble-flow/${bubbleFlowId}/execute`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(executePayload),
          }
        );

        if (!executeResponse.ok) {
          const error = await executeResponse.json();
          throw new Error(error.error || 'Failed to execute parse workflow');
        }

        const executeResult = await executeResponse.json();

        // Update document with results
        const result = executeResult.data?.result || executeResult;
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === document.id
              ? {
                  ...doc,
                  status: 'completed' as const,
                  parsedResult: result,
                  editableMarkdown: result?.data?.markdown || '',
                }
              : doc
          )
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error occurred';

        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === document.id
              ? {
                  ...doc,
                  status: 'error' as const,
                  parsedResult: { success: false, error: errorMessage },
                }
              : doc
          )
        );
      }
    },
    [convertFileToBase64, compressImage, API_BASE_URL_LOCAL]
  );

  const generateDocument = async () => {
    const completedDocs = documents.filter(
      (doc) =>
        doc.status === 'completed' &&
        doc.parsedResult?.success &&
        doc.editableMarkdown
    );

    if (completedDocs.length === 0) {
      setError('No successfully parsed documents available for generation');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGenerationResult(null);

    try {
      // Prepare documents array (each document as separate string using editable markdown)
      const documentContents = completedDocs.map((doc) => {
        const filename = doc.file.name;
        const markdown = doc.editableMarkdown || '';
        return `# Document: ${filename}\n\n${markdown}`;
      });

      const workflowParams = {
        documents: documentContents,
        outputDescription: outputSpec,
        outputFormat,
        aiOptions: {
          model: 'google/gemini-2.5-flash' as const,
          temperature: 0.3,
          maxTokens: 90000,
          jsonMode: true,
        },
      };

      const createFlowCode = `
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';
import { BubbleFlow, GenerateDocumentWorkflow } from '@bubblelab/bubble-core';

export interface Output {
  result: unknown;
}

export class GenerateDocDemoFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('generate-doc-demo', 'Generate Document Demo Flow');
  }
  
  async handle(payload: BubbleTriggerEventRegistry['webhook/http']): Promise<Output> {
    const documents = payload.documents as string[];
    const outputDescription = payload.outputDescription as string;
    const outputFormat = payload.outputFormat as 'html' | 'csv' | 'json';
    
    const workflow = new GenerateDocumentWorkflow({
      documents,
      outputDescription,
      outputFormat,
      aiOptions: {
        model: '${workflowParams.aiOptions.model}',
        temperature: ${workflowParams.aiOptions.temperature},
        maxTokens: ${workflowParams.aiOptions.maxTokens},
        jsonMode: ${workflowParams.aiOptions.jsonMode},
      }
    });
    
    const result = await workflow.action();
    return { result };
  }
}`;

      // Create the BubbleFlow
      const createPayload = {
        name: `Generate_Document_Demo_${Date.now()}`,
        description: 'Generate Document Demo',
        code: createFlowCode,
        eventType: 'webhook/http',
        webhookActive: false,
      };

      const createResponse = await fetch(`${API_BASE_URL_LOCAL}/bubble-flow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createPayload),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(error.error || 'Failed to create generation workflow');
      }

      const createResult = await createResponse.json();
      const bubbleFlowId = createResult.id;

      // Execute the workflow
      const executePayload = {
        documents: documentContents,
        outputDescription: outputSpec,
        outputFormat,
      };

      const executeResponse = await fetch(
        `${API_BASE_URL_LOCAL}/bubble-flow/${bubbleFlowId}/execute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(executePayload),
        }
      );

      if (!executeResponse.ok) {
        const error = await executeResponse.json();
        throw new Error(error.error || 'Failed to execute generation workflow');
      }

      const executeResult = await executeResponse.json();

      // Debug the result structure
      console.log('=== GENERATION RESULT DEBUG ===');
      console.log('Full executeResult:', executeResult);
      console.log('executeResult.data:', executeResult.data);
      console.log('executeResult.data?.result:', executeResult.data?.result);
      console.log('=== END DEBUG ===');

      setGenerationResult(executeResult.data?.result || executeResult);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const removeDocument = (documentId: string) => {
    setDocuments((prev) => {
      const docToRemove = prev.find((doc) => doc.id === documentId);
      if (docToRemove?.previewUrl) {
        URL.revokeObjectURL(docToRemove.previewUrl);
      }
      return prev.filter((doc) => doc.id !== documentId);
    });
  };

  const updateEditableMarkdown = (documentId: string, markdown: string) => {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === documentId ? { ...doc, editableMarkdown: markdown } : doc
      )
    );
  };

  const clearAllDocuments = () => {
    // Clean up preview URLs
    documents.forEach((doc) => {
      if (doc.previewUrl) {
        URL.revokeObjectURL(doc.previewUrl);
      }
    });
    setDocuments([]);
    setGenerationResult(null);
    setError(null);
  };

  const allParsingComplete =
    documents.length > 0 &&
    documents.every(
      (doc) => doc.status === 'completed' || doc.status === 'error'
    );

  const hasSuccessfullyParsedDocs = documents.some(
    (doc) => doc.status === 'completed' && doc.parsedResult?.success
  );

  const downloadResult = () => {
    console.log('Download attempt - outputFormat:', outputFormat);

    if (outputFormat === 'html') {
      // For HTML, create the enhanced version with Excel export
      const rawHtml =
        generationResult?.generatedFiles?.html ||
        generationResult?.data?.generatedFiles?.html ||
        generationResult?.data?.output;

      if (rawHtml) {
        const enhancedHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated Document</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
  <style>
    body { 
      margin: 16px; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .export-controls {
      margin-bottom: 20px;
      padding: 12px;
      background-color: #f8f9fa;
      border-radius: 6px;
      border: 1px solid #e9ecef;
    }
    .export-btn {
      background-color: #28a745;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      margin-right: 8px;
    }
    .export-btn:hover {
      background-color: #218838;
    }
    table { 
      border-collapse: collapse; 
      width: 100%; 
      margin: 1rem 0;
    }
    th, td { 
      border: 1px solid #ddd; 
      padding: 12px; 
      text-align: left;
    }
    th { 
      background-color: #f5f5f5; 
      font-weight: 600;
    }
    tr:nth-child(even) { 
      background-color: #f9f9f9; 
    }
    h1, h2, h3 { 
      color: #2d3748; 
      margin: 1.5rem 0 0.5rem 0;
    }
    h1 { font-size: 1.5rem; }
    h2 { font-size: 1.25rem; }
    h3 { font-size: 1.1rem; }
  </style>
</head>
<body>
  <div class="export-controls">
    <button class="export-btn" onclick="exportToExcel()">📊 Export to Excel</button>
    <span style="color: #6c757d; font-size: 12px;">Click to download this table as an Excel file</span>
  </div>
  
  ${rawHtml}
  
  <script>
    function exportToExcel() {
      try {
        const table = document.querySelector('table');
        if (!table) {
          alert('No table found to export');
          return;
        }
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.table_to_sheet(table);
        XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = 'expense-report-' + timestamp + '.xlsx';
        
        XLSX.writeFile(wb, filename);
        console.log('Excel file exported successfully as: ' + filename);
      } catch (error) {
        console.error('Export failed:', error);
        alert('Export failed: ' + error.message);
      }
    }
  </script>
</body>
</html>`;

        const blob = new Blob([enhancedHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `expense-report-${Date.now()}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        console.log('Enhanced HTML downloaded with Excel export functionality');
      } else {
        console.error('No HTML content found for download');
      }
    } else {
      // For CSV, use the original logic
      const content =
        generationResult?.generatedFiles?.csv ||
        generationResult?.data?.generatedFiles?.csv ||
        generationResult?.data?.output;

      if (content) {
        const blob = new Blob([content], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `generated-document-${Date.now()}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        console.error('No CSV content found for download');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-blue-400 mb-2">
              📄 Document Generation Demo
            </h1>
            <p className="text-gray-400">
              Upload receipts, invoices, or documents (PDF/images) to parse and
              generate structured reports
            </p>
          </div>

          {/* Upload Section */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Upload Documents</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Documents (PDF, JPEG, PNG)
                </label>
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="documents-upload"
                  />
                  <label htmlFor="documents-upload" className="cursor-pointer">
                    <div className="text-gray-400 mb-2">
                      📁 Click to upload documents
                    </div>
                    <div className="text-xs text-gray-500">
                      Support for PDF, JPEG, PNG files (multiple selection)
                    </div>
                  </label>
                </div>

                {documents.length > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">
                        Uploaded Files ({documents.length})
                      </span>
                      <button
                        onClick={clearAllDocuments}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between bg-gray-700 rounded p-2"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="text-xs">
                              {doc.status === 'pending' && '⏳'}
                              {doc.status === 'parsing' && '🔄'}
                              {doc.status === 'completed' && '✅'}
                              {doc.status === 'error' && '❌'}
                            </span>
                            <span className="text-sm truncate">
                              {doc.file.name}
                            </span>
                            <span className="text-xs text-gray-400">
                              (
                              {Math.round(
                                (doc.compressedSize || doc.file.size) / 1024
                              )}
                              KB
                              {doc.compressedSize &&
                                doc.compressedSize !== doc.file.size && (
                                  <span className="text-green-400 ml-1">
                                    compressed from{' '}
                                    {Math.round(doc.file.size / 1024)}KB
                                  </span>
                                )}
                              )
                            </span>
                          </div>
                          <button
                            onClick={() => removeDocument(doc.id)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Output Configuration */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Output Format
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="html"
                        checked={outputFormat === 'html'}
                        onChange={(e) =>
                          setOutputFormat(e.target.value as 'html' | 'csv')
                        }
                        className="mr-2"
                      />
                      <span className="text-sm">HTML Report</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="csv"
                        checked={outputFormat === 'csv'}
                        onChange={(e) =>
                          setOutputFormat(e.target.value as 'html' | 'csv')
                        }
                        className="mr-2"
                      />
                      <span className="text-sm">CSV Export</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Output Description
                  </label>
                  <textarea
                    value={outputSpec}
                    onChange={(e) => setOutputSpec(e.target.value)}
                    placeholder="Describe what data to extract (e.g., 'expense tracking with vendor, amount, date, category')..."
                    className="w-full h-32 bg-gray-700 text-gray-100 px-3 py-2 rounded-lg text-sm placeholder-gray-400 resize-none border border-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Describe what information to extract from the documents
                    (e.g., "expense tracking with vendor, amount, date,
                    category")
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Processing Status */}
          {documents.length > 0 && (
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Processing Status</h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">
                    {documents.length}
                  </div>
                  <div className="text-sm text-gray-400">Total Files</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">
                    {documents.filter((d) => d.status === 'parsing').length}
                  </div>
                  <div className="text-sm text-gray-400">Parsing</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {
                      documents.filter(
                        (d) =>
                          d.status === 'completed' && d.parsedResult?.success
                      ).length
                    }
                  </div>
                  <div className="text-sm text-gray-400">Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">
                    {documents.filter((d) => d.status === 'error').length}
                  </div>
                  <div className="text-sm text-gray-400">Errors</div>
                </div>
              </div>

              <button
                type="button"
                onClick={generateDocument}
                disabled={
                  !allParsingComplete ||
                  !hasSuccessfullyParsedDocs ||
                  isGenerating
                }
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                  !allParsingComplete ||
                  !hasSuccessfullyParsedDocs ||
                  isGenerating
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isGenerating
                  ? '🔄 Generating Document...'
                  : !allParsingComplete
                    ? '⏳ Waiting for parsing to complete...'
                    : !hasSuccessfullyParsedDocs
                      ? '❌ No successfully parsed documents'
                      : `🚀 Generate ${outputFormat.toUpperCase()} Document`}
              </button>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <span className="text-red-400 mr-2">❌</span>
                <span className="text-red-200">{error}</span>
              </div>
            </div>
          )}

          {/* Generation Results */}
          {generationResult && (
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Generated Document</h2>

              {generationResult.success ? (
                <div className="space-y-4">
                  {/* Success Summary */}
                  <div className="bg-green-900 border border-green-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="text-green-400 mr-2">✅</span>
                        <span className="text-green-200 font-medium">
                          Document Generated Successfully
                        </span>
                      </div>
                      <button
                        onClick={downloadResult}
                        className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-sm font-medium transition-colors"
                      >
                        📥 Download {outputFormat.toUpperCase()}
                      </button>
                    </div>
                    {generationResult.data?.summary && (
                      <div className="text-sm text-green-100 mt-2 grid grid-cols-3 gap-4">
                        <div>
                          Format: {generationResult.data.format || outputFormat}
                        </div>
                        <div>
                          Documents:{' '}
                          {generationResult.data.summary.processedDocuments}
                        </div>
                        <div>
                          Pages: {generationResult.data.summary.totalPages}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Preview */}
                  <div>
                    <h3 className="text-lg font-medium mb-3">Preview</h3>

                    {/* Debug info */}
                    <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-2 mb-4 text-xs">
                      <details>
                        <summary className="cursor-pointer">
                          Debug Info (click to expand)
                        </summary>
                        <pre className="mt-2 text-yellow-100">
                          generationResult keys:{' '}
                          {Object.keys(generationResult).join(', ')}
                          {'\n'}
                          generationResult.data keys:{' '}
                          {generationResult.data
                            ? Object.keys(generationResult.data).join(', ')
                            : 'null'}
                          {'\n'}
                          generationResult.generatedFiles:{' '}
                          {JSON.stringify(
                            generationResult.generatedFiles,
                            null,
                            2
                          )}
                          {'\n'}
                          generationResult.data?.output:{' '}
                          {generationResult.data?.output ? 'exists' : 'null'}
                          {'\n'}
                          outputFormat: {outputFormat}
                        </pre>
                      </details>
                    </div>

                    <div className="bg-gray-900 rounded-lg p-4 h-96 lg:h-[600px] overflow-y-auto">
                      {outputFormat === 'html' ? (
                        <iframe
                          title="Generated HTML Preview"
                          className="w-full h-full border-0 bg-white rounded"
                          sandbox="allow-scripts allow-same-origin allow-downloads allow-downloads-without-user-activation"
                          srcDoc={`
                            <!DOCTYPE html>
                            <html>
                            <head>
                              <meta charset="UTF-8">
                              <meta name="viewport" content="width=device-width, initial-scale=1.0">
                              <title>Generated Document</title>
                              <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
                              <style>
                                body { 
                                  margin: 16px; 
                                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                                  line-height: 1.6;
                                  color: #333;
                                }
                                .export-controls {
                                  margin-bottom: 20px;
                                  padding: 12px;
                                  background-color: #f8f9fa;
                                  border-radius: 6px;
                                  border: 1px solid #e9ecef;
                                }
                                .export-btn {
                                  background-color: #28a745;
                                  color: white;
                                  border: none;
                                  padding: 8px 16px;
                                  border-radius: 4px;
                                  cursor: pointer;
                                  font-size: 14px;
                                  margin-right: 8px;
                                }
                                .export-btn:hover {
                                  background-color: #218838;
                                }
                                table { 
                                  border-collapse: collapse; 
                                  width: 100%; 
                                  margin: 1rem 0;
                                }
                                th, td { 
                                  border: 1px solid #ddd; 
                                  padding: 12px; 
                                  text-align: left;
                                }
                                th { 
                                  background-color: #f5f5f5; 
                                  font-weight: 600;
                                }
                                tr:nth-child(even) { 
                                  background-color: #f9f9f9; 
                                }
                                h1, h2, h3 { 
                                  color: #2d3748; 
                                  margin: 1.5rem 0 0.5rem 0;
                                }
                                h1 { font-size: 1.5rem; }
                                h2 { font-size: 1.25rem; }
                                h3 { font-size: 1.1rem; }
                              </style>
                            </head>
                            <body>
                              <div class="export-controls">
                                <button class="export-btn" onclick="exportToExcel()">📊 Export to Excel</button>
                                <span style="color: #6c757d; font-size: 12px;">Click to download this table as an Excel file</span>
                              </div>
                              
                              ${
                                generationResult.generatedFiles?.html ||
                                generationResult.data?.generatedFiles?.html ||
                                generationResult.data?.output ||
                                '<p>No HTML content found</p>'
                              }
                              
                              <script>
                                function exportToExcel() {
                                  try {
                                    // Find the first table in the document
                                    const table = document.querySelector('table');
                                    if (!table) {
                                      alert('No table found to export');
                                      return;
                                    }
                                    
                                    // Create workbook and worksheet
                                    const wb = XLSX.utils.book_new();
                                    const ws = XLSX.utils.table_to_sheet(table);
                                    
                                    // Add worksheet to workbook
                                    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
                                    
                                    // Generate filename with timestamp
                                    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                                    const filename = 'expense-report-' + timestamp + '.xlsx';
                                    
                                    try {
                                      // Try direct download first
                                      XLSX.writeFile(wb, filename);
                                      console.log('Excel file exported successfully as: ' + filename);
                                    } catch (downloadError) {
                                      console.warn('Direct download failed, trying alternative method:', downloadError);
                                      
                                      // Alternative: Generate data and send to parent
                                      const workbookData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                                      const blob = new Blob([workbookData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                                      
                                      // Create download URL
                                      const url = URL.createObjectURL(blob);
                                      
                                      // Send message to parent window to handle download
                                      parent.postMessage({
                                        type: 'DOWNLOAD_EXCEL',
                                        url: url,
                                        filename: filename
                                      }, '*');
                                      
                                      console.log('Sent download request to parent window');
                                    }
                                  } catch (error) {
                                    console.error('Export failed:', error);
                                    alert('Export failed: ' + error.message);
                                  }
                                }
                              </script>
                            </body>
                            </html>
                          `}
                        />
                      ) : (
                        <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                          {generationResult.generatedFiles?.csv ||
                            generationResult.data?.generatedFiles?.csv ||
                            generationResult.data?.output ||
                            'No content found'}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-red-900 border border-red-700 rounded-lg p-4">
                  <div className="flex items-center">
                    <span className="text-red-400 mr-2">❌</span>
                    <span className="text-red-200">
                      Generation Failed: {generationResult.error}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Document Previews and Parsed Content */}
          {documents.length > 0 && (
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h2 className="text-xl font-semibold mb-4">
                Document Previews & Parsed Content
              </h2>

              <div className="space-y-6">
                {documents.map((doc) => (
                  <div key={doc.id} className="bg-gray-900 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <span>
                          {doc.status === 'pending' && '⏳'}
                          {doc.status === 'parsing' && '🔄'}
                          {doc.status === 'completed' && '✅'}
                          {doc.status === 'error' && '❌'}
                        </span>
                        <span className="font-medium text-gray-300">
                          {doc.file.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          (
                          {Math.round(
                            (doc.compressedSize || doc.file.size) / 1024
                          )}
                          KB
                          {doc.compressedSize &&
                            doc.compressedSize !== doc.file.size && (
                              <span className="text-green-400 ml-1">
                                compressed from{' '}
                                {Math.round(doc.file.size / 1024)}KB
                              </span>
                            )}
                          )
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {doc.status === 'completed' &&
                          doc.parsedResult?.data?.metadata && (
                            <span className="text-sm text-gray-500">
                              {doc.parsedResult.data.metadata.totalPages} pages,{' '}
                              {Math.round(
                                doc.parsedResult.data.metadata.processingTime /
                                  1000
                              )}
                              s
                            </span>
                          )}
                        <button
                          type="button"
                          onClick={() => removeDocument(doc.id)}
                          className="text-red-400 hover:text-red-300 px-2 py-1 rounded text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* File Preview */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2">
                          File Preview
                        </h4>
                        <div
                          className="bg-gray-800 rounded border border-gray-600 overflow-hidden"
                          style={{ height: '300px' }}
                        >
                          {doc.previewUrl ? (
                            doc.file.type === 'application/pdf' ? (
                              <iframe
                                src={doc.previewUrl}
                                width="100%"
                                height="100%"
                                className="w-full h-full"
                                title={`Preview of ${doc.file.name}`}
                              />
                            ) : (
                              <img
                                src={doc.previewUrl}
                                alt={`Preview of ${doc.file.name}`}
                                className="w-full h-full object-contain"
                              />
                            )
                          ) : (
                            <div className="flex items-center justify-center h-full text-gray-500">
                              <div className="text-center">
                                <div className="text-2xl mb-2">📄</div>
                                <p>Loading preview...</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Parsed Content */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-400">
                            Parsed Content
                          </h4>
                          {doc.status === 'parsing' && (
                            <span className="text-xs text-yellow-400 animate-pulse">
                              Parsing...
                            </span>
                          )}
                        </div>

                        {doc.status === 'completed' &&
                        doc.parsedResult?.success ? (
                          <textarea
                            value={doc.editableMarkdown || ''}
                            onChange={(e) =>
                              updateEditableMarkdown(doc.id, e.target.value)
                            }
                            placeholder="Parsed markdown content will appear here..."
                            className="w-full h-72 bg-gray-800 text-gray-100 px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm resize-none font-mono"
                          />
                        ) : doc.status === 'error' ? (
                          <div className="h-72 bg-red-900 border border-red-700 rounded p-3 flex items-center justify-center">
                            <div className="text-red-200 text-center">
                              <div className="text-2xl mb-2">❌</div>
                              <p className="text-sm">Parsing failed</p>
                              <p className="text-xs mt-1">
                                {doc.parsedResult?.error}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="h-72 bg-gray-800 border border-gray-600 rounded p-3 flex items-center justify-center">
                            <div className="text-gray-500 text-center">
                              <div className="text-2xl mb-2">
                                {doc.status === 'parsing' ? '🔄' : '⏳'}
                              </div>
                              <p className="text-sm">
                                {doc.status === 'parsing'
                                  ? 'Extracting text...'
                                  : 'Waiting to process...'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {doc.status === 'completed' && doc.parsedResult?.data && (
                      <div className="mt-4 pt-4 border-t border-gray-700 text-xs text-gray-500">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            Pages:{' '}
                            {doc.parsedResult.data.metadata?.totalPages || 0}
                          </div>
                          <div>
                            Visual Elements:{' '}
                            {doc.parsedResult.data.metadata?.hasVisualElements
                              ? 'Yes'
                              : 'No'}
                          </div>
                          <div>
                            Format:{' '}
                            {doc.parsedResult.data.metadata?.imageFormat ||
                              'N/A'}
                          </div>
                          <div>
                            DPI:{' '}
                            {doc.parsedResult.data.metadata?.imageDpi || 'N/A'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
