// test/fixtures/broken-app/server.js
import { handleGenerateRequest } from './routes/generate.route.js';

console.log('[Server] Starting broken app fixture...');
handleGenerateRequest();
