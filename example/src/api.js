import axios from 'axios';

const API_ENDPOINT = process.env.REACT_APP_API_ENDPOINT || 'https://api.example.com';

export const validateApiKey = async (apiKey) => {
  try {
    const response = await axios.post(`${API_ENDPOINT}/validate-key`, { apiKey });
    return response.data.isValid;
  } catch (error) {
    console.error('Error validating API key:', error);
    throw new Error('Failed to validate API key');
  }
};

export const sendQuestion = async (apiKey, document, question) => {
  try {
    const response = await axios.post(`${API_ENDPOINT}/rag`, {
      apiKey,
      document,
      question
    });
    return {
      snippets: response.data.snippets,
      answer: response.data.answer
    };
  } catch (error) {
    console.error('Error sending question:', error);
    throw new Error('Failed to get response from AI');
  }
};