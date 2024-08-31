const dotenv = require('dotenv');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;

// Load environment variables
dotenv.config();

// Constants
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const DELAY_BETWEEN_BATCHES = 1000;
const API_TIMEOUT = 10000; // 10 seconds timeout for API calls
console.log('Constants initialized');

// Functions
function chunkText(text) {
  console.log(`Input text length: ${text.length}`);
  const chunks = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = Math.min(startIndex + CHUNK_SIZE, text.length);
    
    // Adjust end index to avoid cutting words
    if (endIndex < text.length) {
      while (endIndex > startIndex && !text[endIndex - 1].match(/\s/)) {
        endIndex--;
      }
    }

    // If we couldn't find a space, or if adjusting made the chunk too small, 
    // just use the original end index
    if (endIndex === startIndex || endIndex - startIndex < CHUNK_SIZE / 2) {
      endIndex = Math.min(startIndex + CHUNK_SIZE, text.length);
    }

    // Create the chunk
    const chunk = text.slice(startIndex, endIndex).trim();
    console.log(`Creating chunk: start=${startIndex}, end=${endIndex}, length=${chunk.length}`);
    
    if (chunk.length > 0) {
      chunks.push(chunk);
    } else {
      console.warn(`Empty chunk detected at index ${startIndex}`);
    }

    // Move to next chunk, ensure we're making progress
    startIndex = endIndex;

    // If we've reached the end, break the loop
    if (startIndex >= text.length) {
      console.log('Reached end of text');
      break;
    }

    // Move back by the overlap amount, but not before the previous start
    startIndex = Math.max(startIndex - CHUNK_OVERLAP, chunks.length > 0 ? endIndex - CHUNK_SIZE : 0);
  }

  console.log(`Text chunked into ${chunks.length} chunks`);
  return chunks;
}

async function getEmbedding(text, apiKey) {
  try {
    console.log(`Requesting embedding for text of length ${text.length}...`);
    const response = await axios.post(
      'https://api.openai.com/v1/embeddings',
      {
        input: text,
        model: 'text-embedding-ada-002',
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: API_TIMEOUT,
      }
    );
    console.log('Embedding received successfully');
    return response.data.data[0].embedding;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.error('API request timed out');
    } else {
      console.error('Error getting embedding:', error.response ? error.response.data : error.message);
    }
    throw error;
  }
}

async function delay(ms) {
  console.log(`Delaying for ${ms}ms...`);
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function indexDocument(pdfText, apiKey, outputFile) {
  console.log('Starting document indexing...');
  const chunks = chunkText(pdfText);
  console.log(`Opening output file: ${outputFile}`);
  const writeStream = await fs.open(outputFile, 'w');

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`Processing chunk ${i + 1} of ${chunks.length}`);
    
    try {
      console.log(`Getting embedding for chunk ${i + 1}`);
      const embedding = await getEmbedding(chunk, apiKey);
      const result = {
        id: uuidv4(),
        text: chunk,
        embedding: embedding,
        position: i,
      };
      
      console.log('Writing result to file...');
      await writeStream.writeFile(JSON.stringify(result) + '\n');
    } catch (error) {
      console.error(`Error processing chunk ${i + 1}:`, error.message);
    }

    if (i < chunks.length - 1) {
      console.log(`Delaying before next chunk...`);
      await delay(DELAY_BETWEEN_BATCHES);
    }
  }

  console.log('Closing output file...');
  await writeStream.close();
  console.log('Document indexing completed');
}

async function testIndexing() {
  console.log('Preparing test data...');
  const testPdfText = "This is a test PDF document. It contains multiple sentences to simulate a real PDF content. We will use this text to test our indexing functionality.".repeat(50);
  const testApiKey = process.env.OPENAI_API_KEY;
  if (!testApiKey) {
    console.error('Error: OPENAI_API_KEY is not set in the environment variables.');
    return;
  }

  try {
    console.log('Starting indexing test...');
    await indexDocument(testPdfText, testApiKey, 'indexed_document.jsonl');
    console.log('Indexing completed. Results written to indexed_document.jsonl');
  } catch (error) {
    console.error('Indexing test failed:', error);
  }
}

// Run the test
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '[REDACTED]' : 'Not set');
console.log('Starting test...');
testIndexing();