import React, { useState, useEffect, useCallback } from 'react';
import { FileText, MessageSquare, ArrowRight, Key, Upload, Check, Database, Loader, Trash2 } from 'lucide-react';
import { validateApiKey, sendQuestion } from './api';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';
import { initializeVectorStore, addDocumentsToVectorStore, performSimilaritySearch, deleteAllDocuments } from './vectorStore';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

function flushLogs() {
  console.log('%c', 'padding: 0; margin: 0; line-height: 0;');
}

// New ErrorBoundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("Caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Oops! Something went wrong.</strong>
          <span className="block sm:inline"> {this.state.error && this.state.error.toString()}</span>
          <pre className="mt-2 text-sm">{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const RAGApp = () => {
  const [apiKey, setApiKey] = useState('');
  const [maskedApiKey, setMaskedApiKey] = useState('');
  const [isApiKeyValid, setIsApiKeyValid] = useState(false);
  const [question, setQuestion] = useState('');
  const [snippets, setSnippets] = useState([]);
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [pdfText, setPdfText] = useState('');
  const [rememberApiKey, setRememberApiKey] = useState(false);
  const [isIndexed, setIsIndexed] = useState(false);
  const [indexingProgress, setIndexingProgress] = useState(0);
  const [isIndexing, setIsIndexing] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [vectorStore, setVectorStore] = useState(null);
  const [worker, setWorker] = useState(null);
  const [highlightedSnippets, setHighlightedSnippets] = useState([]);
  const pdfTextRef = useRef(null);

  useEffect(() => {
    const newWorker = new Worker(new URL('./indexWorker.js', import.meta.url));
    setWorker(newWorker);

    return () => {
      newWorker.terminate();
    };
  }, []);

  useEffect(() => {
    const storedApiKey = localStorage.getItem('ragAppApiKey');
    if (storedApiKey) {
      setApiKey(storedApiKey);
      setMaskedApiKey('*'.repeat(storedApiKey.length));
      setRememberApiKey(true);
      validateStoredApiKey(storedApiKey);
    }
  }, []);

  const validateStoredApiKey = useCallback(async (key) => {
    setIsLoading(true);
    try {
      const isValid = await validateApiKey(key);
      setIsApiKeyValid(isValid);
      if (isValid) {
        initializeVectorStoreWithKey(key);
      }
    } catch (err) {
      setError('Error validating API key: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const initializeVectorStoreWithKey = useCallback(async (key) => {
    try {
      const store = await initializeVectorStore(key);
      setVectorStore(store);
    } catch (error) {
      console.error("Error initializing vector store:", error);
      setError("Failed to initialize vector store");
    }
  }, []);

  const handleApiKeyChange = (e) => {
    const newApiKey = e.target.value;
    setApiKey(newApiKey);
    setMaskedApiKey(newApiKey);
    setIsApiKeyValid(false);
  };

  const handleApiKeySubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const isValid = await validateApiKey(apiKey);
      setIsApiKeyValid(isValid);
      if (isValid) {
        setMaskedApiKey('*'.repeat(apiKey.length));
        if (rememberApiKey) {
          localStorage.setItem('ragAppApiKey', apiKey);
        }
        initializeVectorStoreWithKey(apiKey);
      } else {
        setError('Invalid API key');
      }
    } catch (err) {
      setError('Error validating API key: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuestionChange = (e) => {
    setQuestion(e.target.value);
  };

  const handleSubmit = async () => {
    if (!apiKey) {
      setError('Please enter an OpenAI API key');
      return;
    }
    if (!question) {
      setError('Please enter a question');
      return;
    }
    if (!isIndexed) {
      setError('Please index the document first');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const relevantDocs = await performSimilaritySearch(question, 2);
      const context = relevantDocs.map(doc => doc.pageContent).join("\n\n");
      const response = await sendQuestion(apiKey, question, context);
      setSnippets(relevantDocs.map(doc => doc.pageContent));
      setAnswer(response.answer);
      
      // Highlight the relevant snippets in the PDF text
      setHighlightedSnippets(relevantDocs.map(doc => doc.pageContent));
    } catch (err) {
      setError(err.message || 'An error occurred while processing your request.');
    } finally {
      setIsLoading(false);
    }
  };

  const extractTextFromPDF = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n\n\n';
    }

    return fullText;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setIsLoading(true);
      try {
        const text = await extractTextFromPDF(file);
        setPdfText(text);
      } catch (err) {
        setError('Error processing PDF: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    } else {
      setError('Please upload a valid PDF file.');
    }
  };

  const handleRememberApiKeyChange = (e) => {
    setRememberApiKey(e.target.checked);
    if (e.target.checked) {
      localStorage.setItem('ragAppApiKey', apiKey);
    } else {
      localStorage.removeItem('ragAppApiKey');
    }
  };

  const chunkText = (text) => {
    const chunks = [];
    let startIndex = 0;
    while (startIndex < text.length) {
      const endIndex = Math.min(startIndex + CHUNK_SIZE, text.length);
      chunks.push(text.slice(startIndex, endIndex));
      startIndex = endIndex - CHUNK_OVERLAP;
    }
    return chunks;
  };

  const generateDocumentHash = (text) => {
    // Simple hash function, you might want to use a more robust one
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  };

  // Define the handleIndex function as a memoized callback
  // The 'async' keyword declares this function as asynchronous,
  // allowing the use of 'await' inside it for handling promises
  const handleIndex = useCallback(async () => {
    console.log("handleIndex called");
    flushLogs();
    // Update debug info
    setDebugInfo(prev => prev + "\nhandleIndex called");

    // Check if API key and PDF text are available
    if (!apiKey || !pdfText) {
      console.log("error on not api key or pdf text");
      // Detailed logging for missing API key
      if (!apiKey) {
        console.log("error on not api key");
      }
      // Detailed logging for missing PDF text
      if (!pdfText) {
        console.log("error on not pdf text");
      }
      setDebugInfo(prev => prev + "\nhandleIndex called");
      setError('Please enter an API key and upload a PDF first.');
      setDebugInfo(prev => prev + "\nError: API key or PDF text missing");
      return;
    }

    // Set indexing state and reset progress
    setIsIndexing(true);
    setError('');
    setIndexingProgress(0);
    console.log("Indexing started, isIndexing set to true");
    flushLogs();
    setDebugInfo(prev => prev + "\nIndexing started");

    try {
      // 'await' can be used here because the function is async
      // This allows us to wait for the asynchronous operation to complete
      // before moving on to the next line
      await deleteAllDocuments();

      // Split the PDF text into chunks
      const chunks = chunkText(pdfText);
      
      // Check if the web worker is available
      if (worker) {
        // Send the API key and text chunks to the worker for processing
        worker.postMessage({ apiKey, chunks });
        
        // Set up the message handler for the worker
        worker.onmessage = (e) => {
          if (e.data.type === 'progress') {
            // Update the indexing progress
            setIndexingProgress(e.data.progress);
          } else if (e.data.type === 'complete') {
            // When indexing is complete, create document objects
            const documents = chunks.map((chunk, index) => ({
              pageContent: chunk,
              metadata: { source: "pdf" },
              vector: e.data.embeddings[index]
            }));
            // Add the documents to the vector store
            addDocumentsToVectorStore(documents);
            // Update the indexing state
            setIsIndexed(true);
            setIndexingProgress(100);
            setIsIndexing(false);
            console.log("Indexing complete");
            setDebugInfo(prev => prev + "\nIndexing complete");
          } else if (e.data.type === 'error') {
            // Handle any errors from the worker
            throw new Error(e.data.error);
          }
        };
      } else {
        // Throw an error if the worker is not initialized
        throw new Error("Worker not initialized");
      }
    } catch (err) {
      // Error handling
      // The 'async' function automatically wraps the return value in a promise,
      // allowing us to use try-catch for error handling of asynchronous operations
      console.error("Error in handleIndex:", err);
      setDebugInfo(prev => prev + `\nError in handleIndex: ${err.message}`);
      flushLogs();
      setError('Error indexing document: ' + (err.message || 'Unknown error'));
      setIsIndexing(false);
    }
  }, [apiKey, pdfText, worker]); // Dependencies for useCallback

  // Function to highlight snippets in the PDF text
  const highlightSnippets = useCallback(() => {
    if (pdfTextRef.current && highlightedSnippets.length > 0) {
      let highlightedText = pdfText;
      highlightedSnippets.forEach((snippet, index) => {
        const escapedSnippet = snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedSnippet, 'g');
        highlightedText = highlightedText.replace(regex, `<span class="bg-yellow-200" data-snippet-index="${index}">${snippet}</span>`);
      });
      pdfTextRef.current.innerHTML = highlightedText;
    }
  }, [pdfText, highlightedSnippets]);

  useEffect(() => {
    highlightSnippets();
  }, [highlightSnippets]);

  // Add a new function to handle the reset action
  const handleReset = useCallback(() => {
    setPdfText('');
    setSnippets([]);
    setAnswer('');
    setIsIndexed(false);
    setIndexingProgress(0);
    setDebugInfo('');
    // Reset the file input
    const fileInput = document.getElementById('pdf-upload');
    if (fileInput) {
      fileInput.value = '';
    }
    console.log("Document and related data reset");
    setDebugInfo(prev => prev + "\nDocument and related data reset");
  }, []);

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen bg-gray-100 p-4">
        {/* API Key Input */}
        <form onSubmit={handleApiKeySubmit} className="mb-4 flex items-center">
          {isApiKeyValid ? (
            <Check className="mr-2 text-green-500" />
          ) : (
            <Key className="mr-2" />
          )}
          <input
            type="password"
            value={maskedApiKey}
            onChange={handleApiKeyChange}
            placeholder="Enter your OpenAI API key"
            className="flex-grow p-2 border rounded-l"
          />
          <button
            type="submit"
            className="bg-blue-500 text-white p-2 rounded-r"
            disabled={isLoading}
          >
            Enter
          </button>
          <label className="ml-2 flex items-center">
            <input
              type="checkbox"
              checked={rememberApiKey}
              onChange={handleRememberApiKeyChange}
              className="mr-1"
            />
            Remember API Key
          </label>
        </form>
        {error && <p className="text-red-500 mb-4">{error}</p>}

        <div className="flex items-center mb-4">
          <button
            className={`text-white p-2 rounded mr-2 flex items-center ${
              isIndexing ? 'bg-blue-300' : 'bg-blue-500 hover:bg-blue-600'
            }`}
            onClick={() => {
              console.log("Index Document button clicked");
              flushLogs();
              handleIndex();
            }}
            disabled={isIndexing || !pdfText || !apiKey}
          >
            {isIndexing ? (
              <Loader className="animate-spin mr-2" />
            ) : (
              <Database className="mr-2" />
            )}
            {isIndexing ? 'Indexing...' : 'Index Document'}
          </button>
          {isIndexed && <Check className="text-green-500" />}
          
          {/* Add the new Reset button */}
          <button
            className="ml-2 bg-red-500 text-white p-2 rounded flex items-center"
            onClick={handleReset}
          >
            <Trash2 className="mr-2" />
            Reset
          </button>
          
          <button
            className="ml-4 bg-gray-300 text-gray-700 p-2 rounded"
            onClick={() => setDebugMode(!debugMode)}
          >
            {debugMode ? 'Hide Debug Info' : 'Show Debug Info'}
          </button>
        </div>

        {(isIndexing || indexingProgress > 0) && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out" 
                style={{width: `${indexingProgress}%`}}
              ></div>
            </div>
            <p className="text-sm text-gray-600 mt-1">Indexing progress: {Math.round(indexingProgress)}%</p>
          </div>
        )}

        {debugMode && (
          <div className="mb-4 bg-gray-100 p-4 rounded">
            <h3 className="font-bold mb-2">Debug Information:</h3>
            <pre className="whitespace-pre-wrap">{debugInfo}</pre>
          </div>
        )}

        <div className="flex flex-grow">
          {/* Left side - PDF text */}
          <div className="w-1/3 bg-white p-4 mr-4 rounded shadow overflow-y-auto">
            <div className="flex items-center mb-4">
              <FileText className="mr-2" />
              <h2 className="text-lg font-semibold">PDF Document</h2>
            </div>
            <div className="mb-4">
              <label htmlFor="pdf-upload" className="cursor-pointer bg-blue-500 text-white p-2 rounded flex items-center justify-center">
                <Upload className="mr-2" />
                Upload PDF
              </label>
              <input
                id="pdf-upload"
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
            <div
              ref={pdfTextRef}
              className="bg-gray-50 p-4 rounded whitespace-pre-wrap"
            >
              {pdfText}
            </div>
          </div>
          
          {/* Middle - Question input */}
          <div className="w-1/3 flex flex-col">
            <div className="bg-white p-4 rounded shadow sticky top-4">
              <h2 className="text-lg font-semibold mb-4">Ask a Question</h2>
              <div className="flex flex-col">
                <input 
                  type="text" 
                  value={question}
                  onChange={handleQuestionChange}
                  placeholder="Ask a question about the document..."
                  className="p-2 border rounded mb-2"
                />
                <button 
                  className="bg-blue-500 text-white p-2 rounded flex items-center justify-center"
                  onClick={handleSubmit}
                  disabled={isLoading || !pdfText}
                >
                  <MessageSquare size={20} className="mr-2" />
                  Submit Question
                </button>
              </div>
              {error && <p className="text-red-500 mt-2">{error}</p>}
              {isLoading && <p className="mt-2">Loading...</p>}
            </div>
          </div>
          
          {/* Right side - RAG output */}
          <div className="w-1/3 bg-white p-4 rounded shadow overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">RAG Response</h2>
            <div className="space-y-4">
              {snippets.map((snippet, index) => (
                <div key={index} className="bg-yellow-100 p-3 rounded relative">
                  <ArrowRight className="absolute -left-8 top-1/2 transform -translate-y-1/2 text-yellow-500" />
                  <p>{snippet}</p>
                </div>
              ))}
              {answer && (
                <div className="bg-green-100 p-3 rounded mt-6">
                  <p><strong>AI Response:</strong> {answer}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default RAGApp;