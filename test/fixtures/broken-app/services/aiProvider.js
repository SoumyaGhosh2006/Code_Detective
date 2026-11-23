// test/fixtures/broken-app/services/aiProvider.js
import { parseTimeout } from '../utils/envParser.js';

export function initializeAiClient(rawTimeout) {
  const timeout = parseTimeout(rawTimeout);
  if (typeof timeout !== 'number') {
    // Fails to initialize client when timeout is not a number
    return null;
  }
  return {
    request: (payload) => ({ status: 'ok', payload })
  };
}
