/**
 * Template generator for Document Generation workflows
 *
 * This service generates TypeScript code for BubbleFlow classes that use
 * ParseDocumentWorkflow and GenerateDocumentWorkflow for parsing and generating documents.
 */

export interface DocumentGenerationTemplateInput {
  name: string;
  description: string;
  outputDescription: string;
  outputFormat?: 'html' | 'csv' | 'json';
  conversionOptions?: {
    preserveStructure?: boolean;
    includeVisualDescriptions?: boolean;
    extractNumericalData?: boolean;
    combinePages?: boolean;
  };
  imageOptions?: {
    format?: 'png' | 'jpg' | 'jpeg';
    quality?: number;
    dpi?: number;
  };
  aiOptions?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
  };
  storageOptions?: {
    bucketName?: string;
    enableFileManagement?: boolean;
    retentionDays?: number;
    pageImageUrls?: Array<{
      pageNumber: number;
      fileName: string;
      fileUrl?: string;
    }>;
  };
  fileOperations?: {
    allowUpload?: boolean;
    allowDownload?: boolean;
    allowDelete?: boolean;
    allowList?: boolean;
  };
}

/**
 * Generates TypeScript code for a document generation workflow template
 */
export function generateDocumentGenerationTemplate(
  input: DocumentGenerationTemplateInput
): string {
  // Generate a valid TypeScript class name from the input name
  const sanitizedName = input.name
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters except spaces
    .split(/\s+/) // Split by spaces
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize each word
    .join(''); // Join without spaces

  // Ensure the class name starts with a letter and is not empty
  const className =
    sanitizedName && /^[a-zA-Z]/.test(sanitizedName)
      ? sanitizedName
      : `Generated${sanitizedName || 'DocumentProcessor'}`;

  const {
    outputDescription,
    outputFormat = 'html',
    conversionOptions = {
      preserveStructure: true,
      includeVisualDescriptions: true,
      extractNumericalData: true,
      combinePages: true,
    },
    imageOptions = {
      format: 'jpeg',
      quality: 0.9,
      dpi: 200,
    },
    aiOptions = {
      model: 'google/gemini-2.5-flash',
      temperature: 0.2,
      maxTokens: 90000,
      jsonMode: false,
    },
    storageOptions = {
      bucketName: 'bubble-lab-bucket',
      enableFileManagement: true,
      retentionDays: 30,
    },
    fileOperations = {
      allowUpload: true,
      allowDownload: true,
      allowDelete: true,
      allowList: true,
    },
  } = input;

  return `import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';
import {
  BubbleFlow,
  ParseDocumentWorkflow,
  GenerateDocumentWorkflow,
  StorageBubble,
} from '@bubblelab/bubble-core';

export interface Output {
  success: boolean;
  // File storage operations
  uploadUrl?: string;
  downloadUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  contentType?: string;
  lastModified?: string;
  deleted?: boolean;
  // Multiple upload URL support
  pdfUploadUrl?: string;
  pdfFileName?: string;
  pageUploadUrls?: Array<{
    pageNumber: number;
    uploadUrl: string;
    fileName: string;
  }>;
  uploadedFiles?: Array<{
    fileName: string;
    fileSize?: number;
    contentType?: string;
    uploadedAt: string;
  }>;
  // Document processing operations
  parsedDocuments?: Array<{
    filename: string;
    markdown: string;
    fileUrl?: string;
    metadata?: {
      totalPages?: number;
      processedPages?: number;
      hasVisualElements?: boolean;
      processingTime?: number;
      imageFormat?: string;
      imageDpi?: number;
      uploadedImages?: Array<{
        pageNumber: number;
        fileName: string;
        fileUrl?: string;
        uploaded: boolean;
      }>;
    };
  }>;
  generatedResult?: {
    success: boolean;
    error: string;
    columns?: Array<{
      name: string;
      type: 'string' | 'number' | 'integer' | 'float' | 'boolean' | 'date';
      description: string;
    }>;
    rows?: Record<string, string | number | boolean | null>[];
    metadata?: {
      totalDocuments: number;
      totalRows: number;
      totalColumns: number;
      processingTime: number;
      extractedFrom: string[];
    };
    generatedFiles?: {
      html?: string;
      csv?: string;
      json?: string;
    };
    generatedFileUrls?: {
      htmlUrl?: string;
      csvUrl?: string;
      jsonUrl?: string;
    };
    aiAnalysis?: {
      model: string;
      iterations: number;
      processingTime?: number;
    };
  };
  error?: string;
}

export class ${className} extends BubbleFlow<'webhook/http'> {
  constructor() {
    super(
      'document-generation-flow',
      ${JSON.stringify(input.description)}
    );
  }

  async handle(
    payload: BubbleTriggerEventRegistry['webhook/http']
  ): Promise<Output> {
    try {
      console.log('[DEBUG] Full payload received:', JSON.stringify(payload, null, 2));
      const { 
        documents, 
        action = 'parse_and_generate', 
        documentData, 
        documentType, 
        outputDescription: payloadOutputDescription, 
        outputFormat: payloadOutputFormat,
        // File management operations
        fileName,
        fileUrl,
        contentType,
        fileContent,
        listFiles
      } = payload.body as {
        documents?: Array<{
          content: string;
          index: number;
          metadata?: {
            originalFilename?: string;
            pageCount?: number;
            uploadedImages?: Array<{
              pageNumber: number;
              fileName: string;
              fileUrl?: string;
            }>;
          };
        }>;
        action?: string;
        documentData?: string;
        documentType?: string;
        outputDescription?: string;
        outputFormat?: string;
        fileName?: string;
        fileUrl?: string;
        contentType?: string;
        fileContent?: string;
        listFiles?: boolean;
        storageOptions?: {
          uploadImages?: boolean;
          bucketName?: string;
          pageImageUrls?: Array<{
            pageNumber: number;
            uploadUrl: string;
            fileName: string;
          }>;
        };
      };
      
      // Extract userId from top-level payload (auto-injected by execution service)
      const userId = payload.userId;
      
      // Use payload description if provided, otherwise use template default
      const finalOutputDescription = (typeof payloadOutputDescription === 'string' && payloadOutputDescription) || ${JSON.stringify(outputDescription)};
      
      // Use payload output format if provided, otherwise use template default
      const finalOutputFormat = ((typeof payloadOutputFormat === 'string' && payloadOutputFormat) || '${outputFormat}') as 'html' | 'csv' | 'json';
      
      // File management operations
      ${
        fileOperations.allowUpload
          ? `
      if (action === 'get_upload_url' && fileName) {
        const uploadStorageBubble = new StorageBubble({
          operation: 'getUploadUrl',
          bucketName: '${storageOptions.bucketName}',
          fileName: fileName as string,
          contentType: contentType as string,
          expirationMinutes: 60,
          userId: userId as string, // Pass userId for secure file isolation
        });

        console.log('[DEBUG] storageBubble file upload starting!');
        
        const result = await uploadStorageBubble.action();

        console.log('[DEBUG] storageBubble file upload result:', JSON.stringify(result, null, 2));
        
        if (!result.success || !result.data?.uploadUrl) {
          return {
            success: false,
            error: result.error || result.data?.error || 'Failed to generate upload URL',
          };
        }
        
        return {
          success: true,
          uploadUrl: result.data.uploadUrl,
          fileName: result.data.fileName,
          contentType: result.data.contentType,
        };
      }
      
      if (action === 'get_multiple_upload_urls' && fileName) {
        const { pageCount } = (payload.body || {}) as { pageCount?: number };
        
        if (!pageCount || pageCount < 1) {
          return {
            success: false,
            error: 'Page count is required for multiple upload URLs',
          };
        }
        
        const multipleUploadStorageBubble = new StorageBubble({
          operation: 'getMultipleUploadUrls',
          bucketName: '${storageOptions.bucketName}',
          pdfFileName: fileName as string,
          pageCount: pageCount as number,
          expirationMinutes: 60,
          userId: userId as string,
        });
        
        console.log('[DEBUG] storageBubble multiple upload starting!');
        
        const result = await multipleUploadStorageBubble.action();
        
        console.log('[DEBUG] storageBubble multiple upload result:', JSON.stringify(result, null, 2));
        
        if (!result.success || !result.data?.pdfUploadUrl) {
          return {
            success: false,
            error: result.error || result.data?.error || 'Failed to generate multiple upload URLs',
          };
        }
        
        return {
          success: true,
          pdfUploadUrl: result.data.pdfUploadUrl,
          pdfFileName: result.data.pdfFileName,
          pageUploadUrls: result.data.pageUploadUrls,
        };
      }`
          : ''
      }
      
      ${
        fileOperations.allowDownload
          ? `
      if (action === 'get_file_url' && fileName) {
        const downloadStorageBubble = new StorageBubble({
          operation: 'getFile',
          bucketName: '${storageOptions.bucketName}',
          fileName: fileName as string,
          expirationMinutes: 60,
        });
        
        const result = await downloadStorageBubble.action();
        
        if (!result.success || !result.data?.downloadUrl) {
          return {
            success: false,
            error: result.error || result.data?.error || 'Failed to generate download URL',
          };
        }
        
        return {
          success: true,
          downloadUrl: result.data.downloadUrl,
          fileUrl: result.data.fileUrl,
          fileName: result.data.fileName,
          fileSize: result.data.fileSize,
          contentType: result.data.contentType,
          lastModified: result.data.lastModified,
        };
      }`
          : ''
      }
      
      ${
        fileOperations.allowDelete
          ? `
      if (action === 'delete_file' && fileName) {
        const deleteStorageBubble = new StorageBubble({
          operation: 'deleteFile',
          bucketName: '${storageOptions.bucketName}',
          fileName: fileName as string,
        });
        
        const result = await deleteStorageBubble.action();
        
        if (!result.success) {
          return {
            success: false,
            error: result.data?.error || 'Failed to delete file',
          };
        }
        
        return {
          success: true,
          deleted: result.data?.deleted || true,
          fileName: result.data?.fileName,
        };
      }`
          : ''
      }
      
      // Enhanced document parsing with R2 storage support
      if (action === 'parse_from_storage' && fileUrl) {
        // Parse document directly from R2 URL (no need to download)
        const inferredType = (contentType && contentType.includes('pdf')) ? 'pdf' : 'image';
        
        const storageParseWorkflow = new ParseDocumentWorkflow({
          documentData: fileUrl as string,
          isFileUrl: true,
          documentType: inferredType as 'pdf' | 'image',
          conversionOptions: {
            preserveStructure: ${conversionOptions.preserveStructure},
            includeVisualDescriptions: ${conversionOptions.includeVisualDescriptions},
            extractNumericalData: ${conversionOptions.extractNumericalData},
            combinePages: ${conversionOptions.combinePages},
          },
          imageOptions: {
            format: '${imageOptions.format}',
            quality: ${imageOptions.quality},
            dpi: ${imageOptions.dpi},
          },
          aiOptions: {
            model: '${aiOptions.model}',
            temperature: ${aiOptions.temperature},
            maxTokens: ${aiOptions.maxTokens},
            jsonMode: ${aiOptions.jsonMode},
          },
          storageOptions: (payload as any)?.storageOptions
        });
        
        const parseResult = await storageParseWorkflow.action();
        
        if (!parseResult.success) {
          return {
            success: false,
            error: parseResult.error || 'Failed to parse document from storage',
          };
        }
        return {
          success: true,
          parsedDocuments: [{
            filename: fileName || 'document',
            markdown: parseResult.data?.markdown || '',
            fileUrl: fileUrl as string,
            metadata: {
              ...parseResult.data?.metadata,
              uploadedImages: parseResult.data?.uploadedImages || 
              [{
                pageNumber: 0,
                fileName: fileName as string,
                fileUrl: fileUrl as string,
                uploaded: false,
              }], // Include the uploaded page images
            },
          }],
        };
      }
      
      if (action === 'parse_only' && documentData && documentType) {
        // Parse single document
        const directParseWorkflow = new ParseDocumentWorkflow({
          documentData: documentData as string,
          documentType: documentType as 'pdf' | 'image',
          conversionOptions: {
            preserveStructure: ${conversionOptions.preserveStructure},
            includeVisualDescriptions: ${conversionOptions.includeVisualDescriptions},
            extractNumericalData: ${conversionOptions.extractNumericalData},
            combinePages: ${conversionOptions.combinePages},
          },
          imageOptions: {
            format: '${imageOptions.format}',
            quality: ${imageOptions.quality},
            dpi: ${imageOptions.dpi},
          },
          aiOptions: {
            model: '${aiOptions.model}',
            temperature: ${aiOptions.temperature},
            maxTokens: ${aiOptions.maxTokens},
            jsonMode: ${aiOptions.jsonMode},
          },
        });
        
        const parseResult = await directParseWorkflow.action();
        
        if (!parseResult.success) {
          return {
            success: false,
            error: parseResult.error || 'Failed to parse document',
          };
        }
        
        return {
          success: true,
          parsedDocuments: [{
            filename: 'document',
            markdown: parseResult.data?.markdown || '',
            metadata: {
              ...parseResult.data?.metadata,
              uploadedImages: parseResult.data?.uploadedImages, // Include the uploaded page images
            },
          }],
        };
      }
      
      if (action === 'generate_only' && documents) {
        // Generate from pre-parsed documents
        const directGenerateWorkflow = new GenerateDocumentWorkflow({
          documents: documents as Array<{
            content: string;
            index: number;
            metadata?: {
              originalFilename?: string;
              pageCount?: number;
              uploadedImages?: Array<{
                pageNumber: number;
                fileName: string;
                fileUrl?: string;
              }>;
            };
          }>,
          outputDescription: finalOutputDescription,
          outputFormat: finalOutputFormat,
          aiOptions: {
            model: '${aiOptions.model}',
            temperature: ${aiOptions.temperature! + 0.1}, // Slightly higher for generation
            maxTokens: ${aiOptions.maxTokens},
            jsonMode: true, // Enable JSON mode for generation
          },
        });
        
        const generateResult = await directGenerateWorkflow.action();
        
        if (!generateResult.success) {
          return {
            success: false,
            error: generateResult.error || 'Failed to generate document',
          };
        }
        
        return {
          success: true,
          generatedResult: generateResult.data,
        };
      }
      
      // Default: parse and generate workflow
      if (!documents || !Array.isArray(documents)) {
        return {
          success: false,
          error: 'Documents array is required for parse_and_generate workflow',
        };
      }
      
      // For the default workflow, documents should already be markdown content
      const defaultGenerateWorkflow = new GenerateDocumentWorkflow({
        documents: documents as Array<{
          content: string;
          index: number;
          metadata?: {
            originalFilename?: string;
            pageCount?: number;
            uploadedImages?: Array<{
              pageNumber: number;
              fileName: string;
              fileUrl?: string;
            }>;
          };
        }>,
        outputDescription: finalOutputDescription,
        outputFormat: '${outputFormat}',
        aiOptions: {
          model: '${aiOptions.model}',
          temperature: ${aiOptions?.temperature ?? 0.2 + 0.1},
          maxTokens: ${aiOptions.maxTokens},
          jsonMode: true,
        },
      });
      
      const generateResult = await defaultGenerateWorkflow.action();
      
      if (!generateResult.success) {
        return {
          success: false,
          error: generateResult.error || 'Failed to generate document',
        };
      }
      
      // Enhanced: Save generated files to R2 storage if enabled
      let generatedFileUrls: {
        htmlUrl?: string;
        csvUrl?: string;
        jsonUrl?: string;
      } = {};
      ${
        storageOptions.enableFileManagement
          ? `
      if (generateResult.data?.generatedFiles) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const baseFileName = 'generated-document-' + timestamp;
        
        // Save HTML file if available
        if (generateResult.data.generatedFiles.html) {
          const htmlStorageBubble = new StorageBubble({
            operation: 'updateFile',
            bucketName: '${storageOptions.bucketName}',
            fileName: \`\${baseFileName}.html\`,
            contentType: 'text/html',
            fileContent: generateResult.data.generatedFiles.html,
          });
          
          const htmlResult = await htmlStorageBubble.action();
          if (htmlResult.success) {
            const htmlDownloadBubble = new StorageBubble({
              operation: 'getFile',
              bucketName: '${storageOptions.bucketName}',
              fileName: \`\${baseFileName}.html\`,
              expirationMinutes: 1440, // 24 hours for generated files
            });
            
            const htmlDownloadResult = await htmlDownloadBubble.action();
            if (htmlDownloadResult.success && htmlDownloadResult.data?.downloadUrl) {
              generatedFileUrls.htmlUrl = htmlDownloadResult.data.downloadUrl;
            }
          }
        }
        
        // Save CSV file if available  
        if (generateResult.data.generatedFiles.csv) {
          const csvStorageBubble = new StorageBubble({
            operation: 'updateFile',
            bucketName: '${storageOptions.bucketName}',
            fileName: \`\${baseFileName}.csv\`,
            contentType: 'text/csv',
            fileContent: generateResult.data.generatedFiles.csv,
          });
          
          const csvResult = await csvStorageBubble.action();
          if (csvResult.success) {
            const csvDownloadBubble = new StorageBubble({
              operation: 'getFile',
              bucketName: '${storageOptions.bucketName}',
              fileName: \`\${baseFileName}.csv\`,
              expirationMinutes: 1440, // 24 hours for generated files
            });
            
            const csvDownloadResult = await csvDownloadBubble.action();
            if (csvDownloadResult.success && csvDownloadResult.data?.downloadUrl) {
              generatedFileUrls.csvUrl = csvDownloadResult.data.downloadUrl;
            }
          }
        }
        
        // Save JSON file if available
        if (generateResult.data.generatedFiles.json) {
          const jsonStorageBubble = new StorageBubble({
            operation: 'updateFile',
            bucketName: '${storageOptions.bucketName}',
            fileName: \`\${baseFileName}.json\`,
            contentType: 'application/json',
            fileContent: generateResult.data.generatedFiles.json,
          });
          
          const jsonResult = await jsonStorageBubble.action();
          if (jsonResult.success) {
            const jsonDownloadBubble = new StorageBubble({
              operation: 'getFile',
              bucketName: '${storageOptions.bucketName}',
              fileName: \`\${baseFileName}.json\`,
              expirationMinutes: 1440, // 24 hours for generated files
            });
            
            const jsonDownloadResult = await jsonDownloadBubble.action();
            if (jsonDownloadResult.success && jsonDownloadResult.data?.downloadUrl) {
              generatedFileUrls.jsonUrl = jsonDownloadResult.data.downloadUrl;
            }
          }
        }
      }`
          : ''
      }
      
      return {
        success: true,
        generatedResult: {
          success: generateResult.data?.success || false,
          error: generateResult.data?.error || '',
          columns: generateResult.data?.columns || [],
          rows: generateResult.data?.rows || [],
          metadata: generateResult.data?.metadata,
          generatedFiles: generateResult.data?.generatedFiles,
          generatedFileUrls,
          aiAnalysis: generateResult.data?.aiAnalysis,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
`;
}
