import { useState, useCallback, useEffect } from 'react';
import { API_BASE_URL } from '../env';

interface PDFOcrResult {
  success: boolean;
  error?: string;
  data?: {
    result: {
      mode: 'identify' | 'autofill';
      success: boolean;
      error?: string;
      data?: {
        extractedFields: Array<{
          id: number;
          fieldName: string;
          value?: string;
          confidence: number;
        }>;
        filledPdfData?: string;
        discoveryData: {
          totalFields: number;
          fieldsWithCoordinates: number;
          pages: number[];
        };
        imageData: {
          totalPages: number;
          convertedPages: number;
          format: string;
          dpi: number;
        };
        aiAnalysis: {
          model: string;
          iterations: number;
          processingTime: number;
        };
        fillResults?: {
          filledFields: number;
          successfullyFilled: number;
        };
      };
    };
  };
}

export default function PDFOcrDemo() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [clientInfo, setClientInfo] = useState(`Taxpayer Information:
- Primary Taxpayer: John Andrew Doe
- Social Security Number: 123-45-6789
- Spouse: Jane Marie Doe
- Spouse SSN: 987-65-4321
- Filing Status: Married Filing Jointly
- Address: 1425 Maple Street, Springfield, IL 62701
- Phone: (217) 555-0123
- Occupation: Software Engineer
- Spouse Occupation: Teacher

Income Information:
- W-2 Wages (John): $85,000
- W-2 Wages (Jane): $45,000
- Federal Tax Withheld (John): $12,750
- Federal Tax Withheld (Jane): $6,750
- Interest Income: $125
- Dividend Income: $45

Dependents:
- Child 1: Emma Rose Doe, SSN: 111-22-3333, DOB: 03/15/2015
- Child 2: Michael James Doe, SSN: 444-55-6666, DOB: 08/22/2018

Deductions:
- Mortgage Interest: $8,500
- State and Local Taxes: $5,000
- Charitable Contributions: $2,500
- Medical Expenses: $3,200

Bank Account for Refund:
- Routing Number: 123456789
- Account Number: 987654321
- Account Type: Checking`);
  const [mode, setMode] = useState<'identify' | 'autofill'>('identify');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<PDFOcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalPdfUrl, setOriginalPdfUrl] = useState<string | null>(null);

  const API_BASE_URL_LOCAL = API_BASE_URL;

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      if (originalPdfUrl) {
        URL.revokeObjectURL(originalPdfUrl);
      }
    };
  }, [previewUrl, originalPdfUrl]);

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file && file.type === 'application/pdf') {
        setPdfFile(file);
        setError(null);

        // Clean up previous original PDF URL
        if (originalPdfUrl) {
          URL.revokeObjectURL(originalPdfUrl);
        }

        // Create preview URL for original PDF
        const url = URL.createObjectURL(file);
        setOriginalPdfUrl(url);
      } else {
        setError('Please select a valid PDF file');
      }
    },
    [originalPdfUrl]
  );

  const convertFileToBase64 = (file: File): Promise<string> => {
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
      reader.readAsDataURL(file);
    });
  };

  const processPDF = async () => {
    if (!pdfFile) {
      setError('Please select a PDF file');
      return;
    }

    if (mode === 'autofill' && !clientInfo.trim()) {
      setError('Please provide client information for autofill mode');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    // Clean up previous filled PDF preview
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    try {
      // Convert PDF to base64
      const pdfBase64 = await convertFileToBase64(pdfFile);

      // Prepare the workflow parameters based on mode
      const baseParams = {
        pdfData: pdfBase64,
        discoveryOptions: {
          targetPage: 1,
        },
        imageOptions: {
          format: 'png' as 'png' | 'jpeg',
          quality: 0.8,
          dpi: 150,
        },
        aiOptions: {
          model: 'google/gemini-2.5-pro' as const,
          temperature: 0.3,
          maxTokens: 50000,
          jsonMode: true,
        },
      };

      const workflowParams =
        mode === 'autofill'
          ? {
              mode: 'autofill' as const,
              ...baseParams,
              clientInformation: clientInfo,
            }
          : {
              mode: 'identify' as const,
              ...baseParams,
            };

      // Create and execute the workflow - using your working pattern
      const createFlowCode = `
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';
import { BubbleFlow, PDFOcrWorkflow } from '@bubblelab/bubble-core';

export interface Output {
  result: unknown;
}

export class PDFOcrDemoFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('pdf-ocr-demo', 'PDF OCR Demo Flow');
  }
  
  async handle(payload: BubbleTriggerEventRegistry['webhook/http']): Promise<Output> {
    const pdfData = (payload.pdfData as string);
    const clientInfo = payload.clientInformation as string;
    
    const workflow = new PDFOcrWorkflow({
      pdfData: pdfData,
      mode: '${workflowParams.mode}',
      ${workflowParams.mode === 'autofill' ? `clientInformation: clientInfo,` : ''}
      discoveryOptions: {
        targetPage: ${workflowParams.discoveryOptions.targetPage}
      },
      imageOptions: {
        format: '${workflowParams.imageOptions.format}' as const,
        quality: ${workflowParams.imageOptions.quality},
        dpi: ${workflowParams.imageOptions.dpi}
      },
      aiOptions: {
        model: '${workflowParams.aiOptions.model}' as const,
        temperature: ${workflowParams.aiOptions.temperature},
        maxTokens: ${workflowParams.aiOptions.maxTokens},
        jsonMode: ${workflowParams.aiOptions.jsonMode}
      }
    });
    const result = await workflow.action();
    return { result };
  }
}`;

      console.log('=== PRE-VALIDATION DEBUG ===');
      console.log('Raw workflow parameters object:');
      console.log(workflowParams);
      console.log('JSON stringified parameters:');
      console.log(JSON.stringify(workflowParams, null, 2));
      console.log('Generated workflow code BEFORE validation:');
      console.log(createFlowCode);
      console.log('Code length:', createFlowCode.length);
      console.log('=== END PRE-VALIDATION DEBUG ===');

      // Create the BubbleFlow
      const createPayload = {
        name: `PDF_OCR_Demo_${Date.now()}`,
        description: 'PDF OCR Demo',
        code: createFlowCode,
        eventType: 'webhook/http',
        webhookActive: false,
      };

      console.log('=== POST /bubble-flow payload ===');
      console.log('Name:', createPayload.name);
      console.log('Description:', createPayload.description);
      console.log('Event Type:', createPayload.eventType);
      console.log('Webhook Active:', createPayload.webhookActive);
      console.log('Generated Code:');
      console.log(createPayload.code);
      console.log('=== End payload ===');

      const createResponse = await fetch(`${API_BASE_URL_LOCAL}/bubble-flow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createPayload),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(error.error || 'Failed to create workflow');
      }

      const createResult = await createResponse.json();
      const bubbleFlowId = createResult.id;

      // Execute the workflow with PDF data in payload
      const executePayload = {
        pdfData: workflowParams.pdfData,
        ...(workflowParams.mode === 'autofill' && {
          clientInformation: workflowParams.clientInformation,
        }),
      };

      console.log('=== EXECUTE PAYLOAD ===');
      console.log('Execute payload keys:', Object.keys(executePayload));
      console.log('PDF data length:', executePayload.pdfData?.length || 0);
      if (executePayload.clientInformation) {
        console.log(
          'Client info length:',
          executePayload.clientInformation.length
        );
      }
      console.log('=== END EXECUTE PAYLOAD ===');

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
        throw new Error(error.error || 'Failed to execute workflow');
      }

      const executeResult = await executeResponse.json();

      // Debug the actual result structure
      console.log('=== EXECUTE RESULT ===');
      console.log('Full result:', executeResult);
      console.log('Result keys:', Object.keys(executeResult));
      if (executeResult.data) {
        console.log('Result.data keys:', Object.keys(executeResult.data));
        console.log('extractedFields:', executeResult.data.extractedFields);
      }
      console.log('=== END EXECUTE RESULT ===');

      setResult(executeResult);

      // Create preview URL for filled PDF if available
      if (executeResult?.data?.result?.data?.filledPdfData) {
        createPdfPreview(executeResult.data.result.data.filledPdfData);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const createPdfPreview = (base64Data: string) => {
    try {
      // Clean up previous preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      // Convert base64 to blob
      const pdfBytes = atob(base64Data);
      const uint8Array = new Uint8Array(pdfBytes.length);
      for (let i = 0; i < pdfBytes.length; i++) {
        uint8Array[i] = pdfBytes.charCodeAt(i);
      }

      const blob = new Blob([uint8Array], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err) {
      console.error('Failed to create PDF preview:', err);
    }
  };

  const downloadFilledPDF = () => {
    if (result?.data?.result?.data?.filledPdfData) {
      const pdfBytes = atob(result.data.result.data.filledPdfData);
      const uint8Array = new Uint8Array(pdfBytes.length);
      for (let i = 0; i < pdfBytes.length; i++) {
        uint8Array[i] = pdfBytes.charCodeAt(i);
      }

      const blob = new Blob([uint8Array], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `filled-form-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-blue-400 mb-2">
              📄 DocuBubble Demo
            </h1>
            <p className="text-muted-foreground">
              Upload a PDF form and extract fields or auto-fill with client
              information
            </p>
          </div>

          {/* Demo Controls */}
          <div className="bg-card rounded-lg border border-border p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Demo Configuration</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Configuration */}
              <div className="space-y-6">
                {/* Mode Selection */}
                <div>
                  <label className="block text-sm font-medium text-foreground-80 mb-2">
                    Processing Mode
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="identify"
                        checked={mode === 'identify'}
                        onChange={(e) =>
                          setMode(e.target.value as 'identify' | 'autofill')
                        }
                        className="mr-2"
                      />
                      <span className="text-sm">Identify Fields Only</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="autofill"
                        checked={mode === 'autofill'}
                        onChange={(e) =>
                          setMode(e.target.value as 'identify' | 'autofill')
                        }
                        className="mr-2"
                      />
                      <span className="text-sm">Auto-fill with Data</span>
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {mode === 'identify'
                      ? 'Discover and extract form field information only'
                      : 'Fill the form fields with provided client information'}
                  </p>
                </div>

                {/* PDF Upload */}
                <div>
                  <label className="block text-sm font-medium text-foreground-80 mb-2">
                    PDF Document
                  </label>
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="pdf-upload"
                    />
                    <label htmlFor="pdf-upload" className="cursor-pointer">
                      <div className="text-muted-foreground mb-2">
                        📁 Click to upload PDF document
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Support for fillable PDF forms
                      </div>
                    </label>
                    {pdfFile && (
                      <div className="mt-2 text-sm text-green-400">
                        ✓ {pdfFile.name} ({Math.round(pdfFile.size / 1024)}KB)
                      </div>
                    )}
                  </div>
                </div>

                {/* Process Button */}
                <button
                  type="button"
                  onClick={processPDF}
                  disabled={!pdfFile || isProcessing}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                    !pdfFile || isProcessing
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isProcessing
                    ? '🔄 Processing...'
                    : `🚀 ${mode === 'identify' ? 'Identify Fields' : 'Auto-fill Form'}`}
                </button>
              </div>

              {/* Right Column - Client Information */}
              {mode === 'autofill' && (
                <div>
                  <label className="block text-sm font-medium text-foreground-80 mb-2">
                    Client Information
                  </label>
                  <textarea
                    value={clientInfo}
                    onChange={(e) => setClientInfo(e.target.value)}
                    placeholder="Client information for auto-filling form fields (pre-filled with sample data)"
                    className="w-full h-64 bg-muted text-foreground px-3 py-2 rounded-lg text-sm placeholder-gray-400 resize-none border border-border focus:border-blue-500 focus:outline-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Provide relevant information that should be filled into the
                    form
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Two-Panel PDF Preview */}
          {(originalPdfUrl || previewUrl || pdfFile) && (
            <div className="bg-card rounded-lg border border-border p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">PDF Preview</h2>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Before Panel */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-foreground-80">
                      📄 Original PDF
                    </h3>
                    {originalPdfUrl && (
                      <button
                        type="button"
                        onClick={() => window.open(originalPdfUrl, '_blank')}
                        className="text-sm bg-muted hover:bg-gray-600 px-3 py-1 rounded transition-colors"
                      >
                        👁️ Open in Tab
                      </button>
                    )}
                  </div>

                  <div
                    className="border border-border rounded-lg overflow-hidden bg-background"
                    style={{ height: '600px' }}
                  >
                    {originalPdfUrl ? (
                      <iframe
                        src={originalPdfUrl}
                        width="100%"
                        height="100%"
                        className="w-full h-full"
                        title="Original PDF Preview"
                      >
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <div className="text-center">
                            <div className="text-4xl mb-2">📄</div>
                            <p>Your browser doesn't support PDF preview</p>
                            <a
                              href={originalPdfUrl}
                              className="text-blue-400 hover:underline text-sm"
                            >
                              Download to view
                            </a>
                          </div>
                        </div>
                      </iframe>
                    ) : pdfFile ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                          <div className="text-4xl mb-2">📄</div>
                          <p>PDF uploaded successfully</p>
                          <p className="text-sm">{pdfFile.name}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                          <div className="text-4xl mb-2">📄</div>
                          <p>Upload a PDF to preview</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* After Panel */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-foreground-80">
                      {mode === 'autofill'
                        ? '✏️ Filled PDF'
                        : '🔍 Analysis Results'}
                    </h3>
                    {previewUrl && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => window.open(previewUrl, '_blank')}
                          className="text-sm bg-muted hover:bg-gray-600 px-3 py-1 rounded transition-colors"
                        >
                          👁️ Open in Tab
                        </button>
                        {mode === 'autofill' && (
                          <button
                            type="button"
                            onClick={downloadFilledPDF}
                            className="text-sm bg-green-600 hover:bg-green-700 px-3 py-1 rounded transition-colors"
                          >
                            📥 Download
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div
                    className="border border-border rounded-lg overflow-hidden bg-background"
                    style={{ height: '600px' }}
                  >
                    {isProcessing ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                          <div className="text-4xl mb-4 animate-pulse">🔄</div>
                          <p className="text-lg mb-2">Processing PDF...</p>
                          <p className="text-sm">
                            {mode === 'autofill'
                              ? 'Analyzing fields and filling with client data...'
                              : 'Identifying form fields and extracting information...'}
                          </p>
                          <div className="mt-4">
                            <div className="flex items-center justify-center space-x-1">
                              <div
                                className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                                style={{ animationDelay: '0ms' }}
                              ></div>
                              <div
                                className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                                style={{ animationDelay: '150ms' }}
                              ></div>
                              <div
                                className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                                style={{ animationDelay: '300ms' }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : previewUrl ? (
                      <iframe
                        src={previewUrl}
                        width="100%"
                        height="100%"
                        className="w-full h-full"
                        title={
                          mode === 'autofill'
                            ? 'Filled PDF Preview'
                            : 'Processed PDF Preview'
                        }
                      >
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <div className="text-center">
                            <div className="text-4xl mb-2">📄</div>
                            <p>Your browser doesn't support PDF preview</p>
                            <a
                              href={previewUrl}
                              className="text-blue-400 hover:underline text-sm"
                            >
                              Download to view
                            </a>
                          </div>
                        </div>
                      </iframe>
                    ) : result && result.success ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                          <div className="text-4xl mb-2">✅</div>
                          <p className="text-lg mb-2">Analysis Complete!</p>
                          <p className="text-sm">
                            {mode === 'identify'
                              ? 'Field identification completed successfully'
                              : 'No filled PDF was generated'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                          <div className="text-4xl mb-2">⏳</div>
                          <p>
                            {mode === 'autofill'
                              ? 'Filled PDF will appear here after processing'
                              : 'Analysis results will appear here after processing'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
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

          {/* Results Display */}
          {result && (
            <div className="bg-card rounded-lg border border-border p-6">
              <h2 className="text-xl font-semibold mb-4">Results</h2>

              {result.success ? (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="bg-green-900 border border-green-700 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <span className="text-green-400 mr-2">✅</span>
                      <span className="text-green-200 font-medium">
                        Processing Successful
                      </span>
                    </div>
                    {result.data?.result?.data && (
                      <div className="text-sm text-green-100 space-y-1">
                        <div>Mode: {result.data.result.mode}</div>
                        <div>
                          Fields Found:{' '}
                          {result.data.result.data?.extractedFields?.length ||
                            0}
                        </div>
                        <div>
                          Pages Processed:{' '}
                          {result.data.result.data?.imageData?.convertedPages ||
                            0}
                        </div>
                        <div>
                          Processing Time:{' '}
                          {result.data.result.data?.aiAnalysis
                            ?.processingTime || 0}
                          ms
                        </div>
                        {result.data.result.data?.fillResults && (
                          <div>
                            Fields Filled:{' '}
                            {
                              result.data.result.data.fillResults
                                .successfullyFilled
                            }
                            /{result.data.result.data.fillResults.filledFields}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Extracted Fields */}
                  {result.data?.result?.data?.extractedFields &&
                    Array.isArray(result.data.result.data.extractedFields) &&
                    result.data.result.data.extractedFields.length > 0 && (
                      <div>
                        <h3 className="text-lg font-medium mb-3">
                          Extracted Fields
                        </h3>
                        <div className="bg-background rounded-lg p-4 max-h-96 overflow-y-auto">
                          <div className="space-y-2">
                            {result.data.result.data.extractedFields.map(
                              (field, index) => (
                                <div
                                  key={index}
                                  className="border border-border rounded p-3"
                                >
                                  <div className="flex justify-between items-start mb-1">
                                    <span className="font-medium text-blue-400">
                                      {field.fieldName}
                                    </span>
                                    <span className="text-xs bg-blue-900 px-2 py-1 rounded">
                                      {(field.confidence * 100).toFixed(1)}%
                                    </span>
                                  </div>
                                  {field.value && (
                                    <div className="text-sm text-foreground-80">
                                      Value: "{field.value}"
                                    </div>
                                  )}
                                  <div className="text-xs text-muted-foreground">
                                    ID: {field.id}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Technical Details */}
                  <details className="bg-background rounded-lg p-4">
                    <summary className="cursor-pointer text-sm font-medium text-muted-foreground mb-2">
                      Technical Details
                    </summary>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                      {JSON.stringify(result.data?.result, null, 2)}
                    </pre>
                  </details>
                </div>
              ) : (
                <div className="bg-red-900 border border-red-700 rounded-lg p-4">
                  <div className="flex items-center">
                    <span className="text-red-400 mr-2">❌</span>
                    <span className="text-red-200">
                      Processing Failed:{' '}
                      {result.data?.result?.error || result.error}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
