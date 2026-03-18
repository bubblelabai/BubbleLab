import {
  BubbleFlow,
  DocuSignBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  testResults: {
    operation: string;
    success: boolean;
    details?: string;
  }[];
}

export interface TestPayload extends WebhookEvent {
  testName?: string;
}

export class DocuSignIntegrationTest extends BubbleFlow<'webhook/http'> {
  async handle(payload: TestPayload): Promise<Output> {
    const results: Output['testResults'] = [];

    // 1. List templates
    const templatesResult = await new DocuSignBubble({
      operation: 'list_templates',
      count: '5',
    }).action();

    results.push({
      operation: 'list_templates',
      success: templatesResult.success,
      details: templatesResult.success
        ? `Found ${templatesResult.templates?.length || 0} templates`
        : templatesResult.error,
    });

    // 2. List envelopes
    const listResult = await new DocuSignBubble({
      operation: 'list_envelopes',
      count: '5',
      status: 'completed,sent',
    }).action();

    results.push({
      operation: 'list_envelopes',
      success: listResult.success,
      details: listResult.success
        ? `Found ${listResult.envelopes?.length || 0} envelopes`
        : listResult.error,
    });

    // 3. If we have an envelope, get its status and recipients
    if (
      listResult.success &&
      listResult.envelopes &&
      listResult.envelopes.length > 0
    ) {
      const envelopeId = listResult.envelopes[0].envelope_id;

      const getResult = await new DocuSignBubble({
        operation: 'get_envelope',
        envelope_id: envelopeId,
      }).action();

      results.push({
        operation: 'get_envelope',
        success: getResult.success,
        details: getResult.success
          ? `Envelope ${envelopeId}: status=${getResult.status}`
          : getResult.error,
      });

      const recipientsResult = await new DocuSignBubble({
        operation: 'get_recipients',
        envelope_id: envelopeId,
      }).action();

      results.push({
        operation: 'get_recipients',
        success: recipientsResult.success,
        details: recipientsResult.success
          ? `Found ${recipientsResult.signers?.length || 0} signers`
          : recipientsResult.error,
      });
    }

    return { testResults: results };
  }
}
