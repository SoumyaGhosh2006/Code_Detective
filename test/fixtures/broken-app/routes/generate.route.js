// test/fixtures/broken-app/routes/generate.route.js
import { initializeAiClient } from '../services/aiProvider.js';

export function handleGenerateRequest() {
  const client = initializeAiClient(process.env.PROVIDER_TIMEOUT);
  // Crash line: Attempts to call .request on null client
  return client.request({ prompt: 'Hello world' });
}
