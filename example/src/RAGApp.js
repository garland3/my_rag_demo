import React, { useState } from 'react';
import { FileText, MessageSquare, ArrowRight, Key } from 'lucide-react';
import { validateApiKey, sendQuestion } from './api';

const RAGApp = () => {
  const [apiKey, setApiKey] = useState('');
  const [document, setDocument] = useState('');
  const [question, setQuestion] = useState('');
  const [snippets, setSnippets] = useState([]);
  const [aiResponse, setAiResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleApiKeySubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const isValid = await validateApiKey(apiKey);
      if (!isValid) {
        throw new Error('Invalid API key');
      }
      // If valid, you might want to save the API key in a more secure way
      setIsLoading(false);
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  const handleQuestionSubmit = async (e) => {
    e.preventDefault();
    if (!apiKey) {
      setError('Please enter a valid API key first');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const response = await sendQuestion(apiKey, document, question);
      setSnippets(response.snippets);
      setAiResponse(response.answer);
      setIsLoading(false);
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 p-4">
      {/* Left side - Document and Question input */}
      <div className="w-1/2 bg-white p-4 mr-4 rounded shadow">
        <form onSubmit={handleApiKeySubmit} className="mb-4">
          <div className="flex items-center">
            <Key className="mr-2" />
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              className="flex-grow p-2 border rounded-l"
            />
            <button type="submit" className="bg-blue-500 text-white p-2 rounded-r">
              Validate
            </button>
          </div>
        </form>
        <div className="flex items-center mb-4">
          <FileText className="mr-2" />
          <h2 className="text-lg font-semibold">Document</h2>
        </div>
        <textarea
          value={document}
          onChange={(e) => setDocument(e.target.value)}
          className="w-full h-[calc(100%-12rem)] p-2 border rounded mb-4"
          placeholder="Paste your document text here..."
        />
        <form onSubmit={handleQuestionSubmit}>
          <div className="flex">
            <input 
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about the document..."
              className="flex-grow p-2 border rounded-l"
            />
            <button type="submit" className="bg-blue-500 text-white p-2 rounded-r">
              <MessageSquare size={20} />
            </button>
          </div>
        </form>
      </div>
      
      {/* Right side - RAG output */}
      <div className="w-1/2 bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-4">RAG Response</h2>
        {isLoading ? (
          <p>Loading...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <div className="space-y-4">
            {snippets.map((snippet, index) => (
              <div key={index} className="bg-yellow-100 p-3 rounded relative">
                <ArrowRight className="absolute -left-8 top-1/2 transform -translate-y-1/2 text-yellow-500" />
                <p>{snippet}</p>
              </div>
            ))}
            {aiResponse && (
              <div className="bg-green-100 p-3 rounded mt-6">
                <p><strong>AI Response:</strong> {aiResponse}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RAGApp;