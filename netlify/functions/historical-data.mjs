import { getStore } from '@netlify/blobs';
import seed from './lib/history-updated-seed.mjs';
import { createHistoryHandler } from './lib/history-handler.mjs';
export default createHistoryHandler({getStore,seed});
export const config={path:'/api/historical-data'};
