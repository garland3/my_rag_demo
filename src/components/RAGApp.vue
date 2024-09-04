<template>
    <div class="rag-app min-h-screen bg-gray-100 p-6">
        <header class="mb-6 bg-white shadow rounded-lg p-4">
            <h1 class="text-3xl font-bold text-indigo-600">RAG Application</h1>
        </header>

        <!-- API Key Input (only shown if API key is not valid) -->
        <div v-if="!isApiKeyValid" class="mb-6 bg-white p-4 rounded-lg shadow">
            <label for="api-key" class="block text-sm font-medium text-gray-700 mb-2">OpenAI API Key</label>
            <div class="flex items-center">
                <input id="api-key" v-model="apiKey" type="password" placeholder="Enter your OpenAI API key"
                    class="flex-grow p-2 border border-gray-300 rounded-l-md focus:ring-indigo-500 focus:border-indigo-500" />
                <button @click="validateAndSaveApiKey"
                    class="bg-indigo-600 text-white px-4 py-2 rounded-r-md hover:bg-indigo-700 transition duration-150 ease-in-out">
                    Save API Key
                </button>
                <span v-if="isApiKeyValid" class="ml-2 text-green-500">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                </span>
            </div>
        </div>

        <!-- Progress Bar (only shown when indexing) -->
        <div v-if="isIndexing" class="mb-6 bg-white p-4 rounded-lg shadow">
            <h2 class="text-lg font-semibold mb-2 text-gray-800">Indexing Progress</h2>
            <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div class="bg-blue-600 h-2.5 rounded-full" :style="{ width: `${indexingProgress}%` }"></div>
            </div>
            <p class="mt-2 text-sm text-gray-600">{{ indexingProgressText }}</p>
        </div>

        <div class="flex flex-grow space-x-6">
            <!-- Left Column - PDF Upload and Display -->
            <div class="w-1/3 bg-white p-6 rounded-lg shadow overflow-y-auto">
                <h2 class="text-xl font-semibold mb-4 text-gray-800">PDF Document</h2>
                <label for="file-upload"
                    class="cursor-pointer bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition duration-150 ease-in-out inline-block mb-4">
                    Upload PDF
                    <input id="file-upload" type="file" @change="handleFileUpload" accept="application/pdf"
                        class="hidden" />
                </label>
                <button @click="clearEmbeddingsCache"
                    class="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition duration-150 ease-in-out ml-2">
                    Clear Embeddings Cache
                </button>
                <div v-if="pdfText" class="bg-gray-50 p-4 rounded-md mt-4">
                    <p class="whitespace-pre-wrap text-sm text-gray-600">{{ pdfText }}</p>
                </div>
                <p v-else class="text-gray-500">Upload a PDF to see its content here.</p>
            </div>

            <!-- Center Column - Question Input and AI Response -->
            <div class="w-1/3 flex flex-col">
                <div class="bg-white p-6 rounded-lg shadow sticky top-6">
                    <h2 class="text-lg font-semibold mb-4">Ask a Question</h2>
                    <textarea 
                        v-model="question" 
                        @keyup.enter="submitQuestion"
                        placeholder="Ask a question about the document..."
                        class="w-full p-2 border border-gray-300 rounded-md mb-4 focus:ring-indigo-500 focus:border-indigo-500"
                        rows="4"
                    ></textarea>
                    <button @click="submitQuestion"
                        class="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition duration-150 ease-in-out"
                        :disabled="!question || !isIndexed || isProcessing">
                        {{ isProcessing ? 'Processing...' : 'Submit Question' }}
                    </button>
                    <p v-if="error" class="mt-2 text-red-600">{{ error }}</p>
                    
                    <!-- AI Response (now in the same panel) -->
                    <div v-if="ragResponse" class="mt-4">
                        <h3 class="text-lg font-semibold mb-2">AI Response:</h3>
                        <p class="text-gray-600">{{ ragResponse }}</p>
                    </div>
                </div>
            </div>

            <!-- Right Column - RAG Output -->
            <div class="w-1/3 bg-white p-6 rounded-lg shadow overflow-y-auto">
                <h2 class="text-xl font-semibold mb-4 text-gray-800">RAG Details</h2>
                <div v-if="prompt" class="mb-4">
                    <h3 class="text-lg font-semibold mb-2">Generated Prompt:</h3>
                    <div class="bg-gray-100 p-2 rounded-md whitespace-pre-wrap text-sm" v-html="coloredPrompt"></div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import * as pdfjsLib from 'pdfjs-dist';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const CHUNK_SIZE = 5000; // DONOT CHANGE
const CHUNK_OVERLAP = 500; // DONOT CHANGE
const DELAY_BETWEEN_BATCHES = 100; // DONOT CHANGE
const API_TIMEOUT = 10000; // 10 seconds timeout for API calls
const EMBEDDING_MODEL = 'text-embedding-3-small'; // DONOT CHANGE
const CHAT_MODEL = 'gpt-4o-mini'; // DONOT CHANGE
const TOP_K_SIMILAR_CHUNKS = 8; // DONOT CHANGE

export default {
    name: 'RAGApp',
    data() {
        return {
            apiKey: '',
            pdfText: '',
            question: '',
            isIndexing: false,
            documentEmbeddings: [],
            embeddingCache: new Map(),
            isApiKeyValid: false,
            indexingProgress: 0,
            indexingProgressText: '',
            questionEmbedding: null,
            embeddingModel: EMBEDDING_MODEL,
            isProcessing: false,
            prompt: '',
            ragResponse: '',
            error: '',
            isIndexed: false,
        };
    },
    computed: {
        coloredPrompt() {
            if (!this.prompt) return '';

            const parts = this.prompt.split(/(<.*?>)/g);
            return parts.map(part => {
                if (part.startsWith('<relevant data') || part.startsWith('</relevant data')) {
                    return `<span style="color: blue; font-weight: bold;">${this.escapeHtml(part)}</span>`;
                } else if (part.startsWith('<instructions') || part.startsWith('</instructions')) {
                    return `<span style="color: green; font-weight: bold;">${this.escapeHtml(part)}</span>`;
                } else if (part.startsWith('<user') || part.startsWith('</user')) {
                    return `<span style="color: red; font-weight: bold;">${this.escapeHtml(part)}</span>`;
                }
                return this.escapeHtml(part);
            }).join('');
        }
    },
    methods: {
        async validateAndSaveApiKey() {
            try {
                const response = await axios.get('https://api.openai.com/v1/models', {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                    },
                });

                if (response.status === 200) {
                    this.isApiKeyValid = true;
                    localStorage.setItem('openaiApiKey', this.apiKey);

                    // Print out the valid models to the console
                    console.log('Valid OpenAI models:');
                    response.data.data.forEach(model => {
                        console.log(`- ${model.id}`);
                    });
                }
            } catch (error) {
                console.error('Error validating API key:', error);
                this.isApiKeyValid = false;
            }
        },

        async handleFileUpload(event) {
            const file = event.target.files[0];
            if (file && file.type === 'application/pdf') {
                try {
                    const text = await this.extractTextFromPDF(file);
                    this.pdfText = text;
                    // Automatically start indexing after text extraction
                    await this.indexDocument();
                } catch (error) {
                    console.error('Error processing PDF:', error);
                    alert('Error processing PDF. Please try again.');
                }
            } else {
                alert('Please upload a valid PDF file.');
            }
        },
        async extractTextFromPDF(file) {
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            let fullText = '';

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n\n';
            }

            return fullText;
        },
        async submitQuestion() {
            if (!this.question || !this.apiKey) {
                this.error = 'Please enter a question and ensure you have a valid API key.';
                return;
            }

            if (!this.isIndexed) {
                this.error = 'Please index the document first.';
                return;
            }

            this.isProcessing = true;
            this.error = '';
            this.prompt = '';
            this.ragResponse = '';

            try {
                console.log('Processing question:', this.question);

                // 1. Get question embedding
                console.log('Calculating question embedding...');
                const questionEmbedding = await this.getEmbedding(this.question);
                console.log('Question embedding calculated successfully');

                // 2. Find similar chunks
                console.log('Finding similar chunks...');
                const similarChunks = this.findSimilarChunks(questionEmbedding, TOP_K_SIMILAR_CHUNKS);
                console.log('Similar chunks found:', similarChunks.length);

                // 3. Generate prompt
                console.log('Generating prompt...');
                this.prompt = this.generatePrompt(similarChunks, this.question);
                console.log('Prompt generated');

                // 4. Call OpenAI chat model
                console.log('Calling OpenAI chat model...');
                this.ragResponse = await this.callChatModel(this.prompt);
                console.log('RAG response received');

            } catch (error) {
                console.error('Error processing question:', error);
                this.error = 'Error processing question. Please try again.';
            } finally {
                this.isProcessing = false;
            }
        },

        findSimilarChunks(questionEmbedding, topK) {
            return this.documentEmbeddings
                .map(chunk => ({
                    ...chunk,
                    similarity: this.cosineSimilarity(questionEmbedding, chunk.embedding)
                }))
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, topK);
        },

        cosineSimilarity(vecA, vecB) {
            const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
            const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
            const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
            return dotProduct / (magnitudeA * magnitudeB);
        },

        generatePrompt(similarChunks, question) {
            const contextText = similarChunks.map((chunk, index) =>
                `${index + 1}. ${chunk.text}`
            ).join('\n\n');

            return `<relevant data from embeddings>
${contextText}
</relevant data from embeddings>

<instructions>
Please answer the user's question based on the text above
</instructions>

<user's question>
${question}
</user's question>`;
        },

        async callChatModel(prompt) {
            try {
                const response = await axios.post(
                    'https://api.openai.com/v1/chat/completions',
                    {
                        model: CHAT_MODEL,
                        messages: [{ role: 'user', content: prompt }],
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${this.apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        timeout: API_TIMEOUT,
                    }
                );
                return response.data.choices[0].message.content;
            } catch (error) {
                console.error('Error calling chat model:', error);
                throw error;
            }
        },

        chunkText(text) {
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
        },

        async getEmbedding(texts) {
            // Ensure texts is always an array
            const textArray = Array.isArray(texts) ? texts : [texts];

            const embeddings = [];
            const batchSize = 10; // Adjust this value based on API limits and performance

            for (let i = 0; i < textArray.length; i += batchSize) {
                const batch = textArray.slice(i, i + batchSize);

                const cacheKeys = batch.map(text => this.hashText(text));
                const uncachedTexts = [];
                const uncachedIndices = [];

                // Check cache for each text in the batch
                for (let j = 0; j < batch.length; j++) {
                    if (this.embeddingCache.has(cacheKeys[j])) {
                        embeddings[i + j] = this.embeddingCache.get(cacheKeys[j]);
                    } else {
                        uncachedTexts.push(batch[j]);
                        uncachedIndices.push(i + j);
                    }
                }

                // If there are uncached texts, get their embeddings
                if (uncachedTexts.length > 0) {
                    try {
                        console.log(`Requesting embeddings for ${uncachedTexts.length} texts...`);

                        const response = await axios.post(
                            'https://api.openai.com/v1/embeddings',
                            {
                                input: uncachedTexts,
                                model: this.embeddingModel,
                            },
                            {
                                headers: {
                                    'Authorization': `Bearer ${this.apiKey}`,
                                    'Content-Type': 'application/json',
                                },
                                timeout: API_TIMEOUT,
                            }
                        );
                        console.log('Embeddings received successfully');

                        // Store received embeddings in cache and result list
                        response.data.data.forEach((embeddingData, index) => {
                            const embedding = embeddingData.embedding;
                            const originalIndex = uncachedIndices[index];
                            this.embeddingCache.set(cacheKeys[originalIndex - i], embedding);
                            embeddings[originalIndex] = embedding;
                        });
                    } catch (error) {
                        if (error.code === 'ECONNABORTED') {
                            console.error('API request timed out');
                        } else {
                            console.error('Error getting embeddings:', error.response ? error.response.data : error.message);
                        }
                        throw error;
                    }
                }
            }

            return Array.isArray(texts) ? embeddings : embeddings[0];
        },

        // Add this method to hash the text for caching
        hashText(text) {
            let hash = 0;
            for (let i = 0; i < text.length; i++) {
                const char = text.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32-bit integer
            }
            return hash.toString();
        },

        async delay(ms) {
            console.log(`Delaying for ${ms}ms...`);
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        async indexDocument() {
            if (!this.pdfText || !this.apiKey) {
                this.indexingProgressText = 'Please upload a PDF and provide an API key first.';
                return;
            }

            this.isIndexing = true;
            this.indexingProgress = 0;
            this.indexingProgressText = 'Starting indexing...';

            if (this.documentEmbeddings.length > 0) {
                console.log('Document already indexed. Using cached embeddings.');
                // Simulate fast progress
                for (let i = 0; i <= 100; i += 10) {
                    this.indexingProgress = i;
                    this.indexingProgressText = `Using cached embeddings... ${i}%`;
                    await this.delay(50); // Short delay for visual feedback
                }
                this.isIndexed = true;
                this.indexingProgressText = 'Using cached embeddings. Indexing completed!';
                this.isIndexing = false;
                return;
            }

            console.log('Starting document indexing...');
            const chunks = this.chunkText(this.pdfText);
            this.documentEmbeddings = [];

            try {
                const embeddings = await this.getEmbedding(chunks);
                for (let i = 0; i < chunks.length; i++) {
                    this.documentEmbeddings.push({
                        id: uuidv4(),
                        text: chunks[i],
                        embedding: embeddings[i],
                        position: i,
                    });

                    this.indexingProgress = ((i + 1) / chunks.length) * 100;

                    if (i < chunks.length - 1 && i % 10 === 9) {
                        console.log(`Delaying before next batch...`);
                        await this.delay(DELAY_BETWEEN_BATCHES);
                    }
                }

                // Save embeddings to disk
                this.saveEmbeddingsToDisk();

                console.log('Document indexing completed');
                this.indexingProgressText = 'Indexing completed successfully!';
                this.isIndexed = true;
            } catch (error) {
                console.error('Error indexing document:', error);
                this.indexingProgressText = 'Error indexing document. Please try again.';
            } finally {
                this.isIndexing = false;
            }
        },

        saveEmbeddingsToDisk() {
            const embeddingsJson = JSON.stringify(this.documentEmbeddings);
            localStorage.setItem('documentEmbeddings', embeddingsJson);
            console.log('Embeddings saved to localStorage');
        },

        loadEmbeddingsFromDisk() {
            const embeddingsJson = localStorage.getItem('documentEmbeddings');
            if (embeddingsJson) {
                this.documentEmbeddings = JSON.parse(embeddingsJson);
                this.isIndexed = this.documentEmbeddings.length > 0;
                console.log(`Loaded ${this.documentEmbeddings.length} embeddings from localStorage`);
            } else {
                console.log('No embeddings found in localStorage');
            }
        },

        clearEmbeddingsCache() {
            localStorage.removeItem('documentEmbeddings');
            this.documentEmbeddings = [];
            this.isIndexed = false;
            console.log('Embeddings cache cleared');
        },

        escapeHtml(unsafe) {
            return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        },
    },
    mounted() {
        // Load saved API key if it exists
        const savedApiKey = localStorage.getItem('openaiApiKey');
        if (savedApiKey) {
            this.apiKey = savedApiKey;
            this.validateAndSaveApiKey(); // Validate the loaded API key
        }

        // Set up PDF.js worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.BASE_URL}pdf.worker.min.js`;

        // Load embeddings from disk
        this.loadEmbeddingsFromDisk();
    },
};
</script>

<style scoped>
/* Add any component-specific styles here */
</style>