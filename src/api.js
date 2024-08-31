import axios from 'axios';

const OPENAI_API_URL = 'https://api.openai.com/v1';
const CHAT_MODEL = "gpt-4o-mini";
const EMBEDDING_MODEL = "text-embedding-3-small";

export const validateApiKey = async (apiKey) => {
  try {
    const response = await axios.get(`${OPENAI_API_URL}/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('Available models:', response.data.data);
    return response.status === 200;
  } catch (error) {
    console.error('Error validating API key:', error);
    return false;
  }
};

export const sendQuestion = async (apiKey, question, context) => {
  try {
    const response = await axios.post(
      `${OPENAI_API_URL}/chat/completions`,
      {
        model: CHAT_MODEL,
        messages: [
          { role: "system", content: "You are a helpful assistant. Use the following context to answer the user's question." },
          { role: "user", content: `Context: ${context}\n\nQuestion: ${question}` }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return {
      answer: response.data.choices[0].message.content,
    };
  } catch (error) {
    console.error('Error sending question:', error);
    throw error;
  }
};

// export const generateEmbeddings = async (apiKey, chunks, progressCallback) => {
//   const embeddings = [];
//   for (let i = 0; i < chunks.length; i++) {
//     try {
//       const response = await axios.post(
//         `${OPENAI_API_URL}/embeddings`,
//         {
//           input: chunks[i],
//           model: EMBEDDING_MODEL
//         },
//         {
//           headers: {
//             'Authorization': `Bearer ${apiKey}`,
//             'Content-Type': 'application/json'
//           }
//         }
//       );
//       embeddings.push(response.data.data[0].embedding);
      
//       // Call the progress callback
//       if (progressCallback) {
//         progressCallback((i + 1) / chunks.length * 100);
//       }
//     } catch (error) {
//       console.error('Error generating embedding:', error);
//       throw error;
//     }
//   }
//   return embeddings;
// };
export const generateEmbeddings = async (apiKey, chunks, progressCallback, batchSize = 10) => {
    const embeddings = [];
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      try {
        const response = await axios.post(
          `${OPENAI_API_URL}/embeddings`,
          {
            input: batch,
            model: EMBEDDING_MODEL
          },
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        response.data.data.forEach(embedding => {
          embeddings.push(embedding.embedding);
        });
        
        // Call the progress callback
        if (progressCallback) {
          progressCallback(Math.min((i + batchSize) / chunks.length * 100, 100));
        }
      } catch (error) {
        console.error('Error generating embedding:', error);
        throw error;
      }
    }
    
    return embeddings;
  };
  