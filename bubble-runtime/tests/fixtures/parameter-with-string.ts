import { BubbleFlow, PostgreSQLBubble } from '@bubblelab/bubble-core';
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

export interface Output {
  message: string;
  queryResult?: unknown;
}

export class PostgresTestBubbleFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super(
      'postgres-test-flow',
      'A flow that tests PostgreSQL bubble parameters'
    );
  }

  async handle(
    payload: BubbleTriggerEventRegistry['webhook/http']
  ): Promise<Output> {
    const postgres = new PostgreSQLBubble({
      query: "SELECT 'Hello World' as greeting",
      ignoreSSL: true,
    });

    try {
      const result = await postgres.action();
      return {
        message: 'PostgreSQL query executed successfully',
        queryResult: result,
      };
    } catch (error) {
      return {
        message: `PostgreSQL query failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
