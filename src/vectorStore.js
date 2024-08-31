import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";

let vectorStore = null;

export const initializeVectorStore = async (apiKey) => {
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: apiKey,
    model: "text-embedding-3-small",
  });

  vectorStore = new MemoryVectorStore(embeddings);
  return vectorStore;
};

export const addDocumentsToVectorStore = async (documents) => {
  if (!vectorStore) {
    throw new Error("Vector store not initialized");
  }

  return await vectorStore.addDocuments(documents);
};

export const performSimilaritySearch = async (query, k = 2) => {
  if (!vectorStore) {
    throw new Error("Vector store not initialized");
  }

  return await vectorStore.similaritySearch(query, k);
};

export const deleteAllDocuments = async () => {
  if (!vectorStore) {
    throw new Error("Vector store not initialized");
  }

  // For MemoryVectorStore, we can just reinitialize it
  const embeddings = vectorStore.embeddings;
  vectorStore = new MemoryVectorStore(embeddings);
};

// Optional: Add a method for MMR search if needed
export const performMMRSearch = async (query, k = 2, fetchK = 10) => {
  if (!vectorStore) {
    throw new Error("Vector store not initialized");
  }

  return await vectorStore.maxMarginalRelevanceSearch(query, {
    k,
    fetchK,
  });
};