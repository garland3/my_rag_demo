/* eslint-disable no-restricted-globals */
import { generateEmbeddings } from './api';

const BATCH_SIZE = 10; // Adjust this value based on your needs

self.onmessage = function(e) {
  const { apiKey, chunks } = e.data;
  console.log("Worker received message, chunks length:", chunks.length);
  
  async function processChunks() {
    try {
      console.log("Worker starting generateEmbeddings");
      let allEmbeddings = [];
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batchChunks = chunks.slice(i, i + BATCH_SIZE);
        const batchEmbeddings = await generateEmbeddings(apiKey, batchChunks, (progress) => {
          const overallProgress = (i + progress * BATCH_SIZE / 100) / chunks.length * 100;
          console.log("Worker progress:", overallProgress);
          self.postMessage({ type: 'progress', progress: overallProgress });
        });
        allEmbeddings = allEmbeddings.concat(batchEmbeddings);
      }
      
      console.log("Worker finished generateEmbeddings, sending complete message");
      self.postMessage({ type: 'complete', embeddings: allEmbeddings });
    } catch (error) {
      console.error("Worker error:", error);
      self.postMessage({ type: 'error', error: error.message || 'Unknown error in worker' });
    }
  }

  processChunks().catch(error => {
    console.error("Unhandled error in processChunks:", error);
    self.postMessage({ type: 'error', error: error.message || 'Unhandled error in worker' });
  });
};