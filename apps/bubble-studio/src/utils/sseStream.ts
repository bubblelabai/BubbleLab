import { GenerationStreamingEvent } from '@/types/generation';

/**
 * Converts a Server-Sent Events (SSE) Response stream to an AsyncIterable.
 * Includes timeout handling and heartbeat monitoring for connection health.
 *
 * @param response - The Response object from the SSE endpoint
 * @returns AsyncGenerator that yields GenerationStreamingEvent objects
 * @throws Error if stream read times out or connection becomes unhealthy
 */
export async function* sseToAsyncIterable(
  response: Response
): AsyncGenerator<GenerationStreamingEvent> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Failed to get response reader');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let lastActivityTime = Date.now();

  const INACTIVITY_TIMEOUT = 120000; // 2 minutes without any data = dead connection
  const READ_TIMEOUT = 45000; // 45 seconds per read operation

  // Monitor connection health - cleanup if no activity for 2 minutes
  const healthChecker = setInterval(() => {
    const timeSinceActivity = Date.now() - lastActivityTime;
    if (timeSinceActivity > INACTIVITY_TIMEOUT) {
      console.error('⚠️ No activity for 2 minutes, connection appears dead');
      clearInterval(healthChecker);
      reader.cancel();
    }
  }, 10000); // Check every 10 seconds

  try {
    while (true) {
      // Wrap read with timeout to detect network hangs
      const readPromise = reader.read();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error('Network read timeout - connection may be unstable')
            ),
          READ_TIMEOUT
        );
      });

      const { done, value } = await Promise.race([readPromise, timeoutPromise]);

      if (done) break;

      // Data received - update activity timestamp
      lastActivityTime = Date.now();

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const eventData = JSON.parse(
              line.slice(6)
            ) as GenerationStreamingEvent;

            // Debug: Log all events
            console.log('SSE Event:', eventData.type, eventData);

            // Filter out heartbeat events - just update activity, don't yield
            if (eventData.type === 'heartbeat') {
              console.log('💓 Heartbeat received, connection healthy');
              continue;
            }

            // Yield the event to be processed
            yield eventData;
          } catch (parseError) {
            console.warn('Failed to parse SSE data:', line, parseError);
          }
        }
      }
    }
  } finally {
    // Always cleanup the health checker
    clearInterval(healthChecker);
  }
}
