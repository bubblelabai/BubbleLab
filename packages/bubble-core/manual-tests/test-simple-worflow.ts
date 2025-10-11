import { TestBubbleFlow } from '../bubble-flow/sample/simple-webhook.js';
// Inject the environment variables
import 'dotenv/config';

async function main() {
  const testFlow = new TestBubbleFlow();
  const result = await testFlow.handle({
    path: '/test',
    body: { message: 'Hello, how are you?' },
    type: 'webhook/http',
    timestamp: new Date().toISOString(),
  });

  console.log(result);
}

main();
