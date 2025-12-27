import { BubbleFlow, type WebhookEvent } from '@bubblelab/bubble-core';

export interface Output {
  results: unknown[];
}

/**
 * Test fixture for Promise.all patterns
 * Contains multiple test cases in one file for testing array element extraction
 */

// TEST CASE 1: Direct Array Literal
export class PromiseAllDirectArrayFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: WebhookEvent): Promise<Output> {
    const results = await Promise.all([
      this.task1(),
      this.task2(),
      this.task3(),
    ]);
    return { results };
  }

  async task1() {
    return { task: 1 };
  }

  async task2() {
    return { task: 2 };
  }

  async task3() {
    return { task: 3 };
  }
}

// TEST CASE 2: Array with .push() calls
export class PromiseAllArrayPushFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: WebhookEvent): Promise<Output> {
    const tasks: Promise<unknown>[] = [];

    tasks.push(this.task1());
    tasks.push(this.task2());
    tasks.push(this.task3());

    const results = await Promise.all(tasks);
    return { results };
  }

  async task1() {
    return { task: 1 };
  }

  async task2() {
    return { task: 2 };
  }

  async task3() {
    return { task: 3 };
  }
}

// TEST CASE 3: Array with .map() - Expression Body
export class PromiseAllArrayMapFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: WebhookEvent): Promise<Output> {
    const items = ['item1', 'item2', 'item3'];

    const promises = items.map((item) => this.processItem(item));

    const results = await Promise.all(promises);
    return { results };
  }

  async processItem(item: string) {
    return { item, processed: true };
  }
}

// TEST CASE 4: Array with .map() - Block Body
export class PromiseAllArrayMapBlockFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: WebhookEvent): Promise<Output> {
    const numbers = [1, 2, 3];

    const promises = numbers.map((num) => {
      return this.doubleNumber(num);
    });

    const results = await Promise.all(promises);
    return { results };
  }

  async doubleNumber(num: number) {
    return num * 2;
  }
}

// TEST CASE 5: Array with .map() - Variable Array
export class PromiseAllMapVariableFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: WebhookEvent): Promise<Output> {
    const requiredUsers = ['user1@example.com', 'user2@example.com'];

    const userReportPromises = requiredUsers.map((email) =>
      this.analyzeUserExecutions(email)
    );

    const results = await Promise.all(userReportPromises);
    return { results };
  }

  async analyzeUserExecutions(email: string) {
    return { email, analyzed: true };
  }
}
