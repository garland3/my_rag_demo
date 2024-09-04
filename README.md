# RAG App (Vue Version)

## Overview

This is a Vue-based Retrieval-Augmented Generation (RAG) application that allows users to upload PDF documents, index their content, and ask questions about the documents using OpenAI's language models.

## Features

- PDF document upload and text extraction
- Document indexing using OpenAI's embedding model
- Question answering using OpenAI's language model
- API key management with local storage option
- Debug mode for troubleshooting
- Responsive design using Tailwind CSS

## Prerequisites

- Node.js (v14 or later recommended)
- npm or yarn
- Personal OpenAI API key (to be entered in the application)

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/your-username/rag-app-vue.git
   cd rag-app-vue
   ```

2. Install dependencies:
   ```
   npm install
   ```

## Running the Application

To start the development server:
   ```
   npm run serve
   ```

This will start the Vue development server. Open your browser and navigate to `http://localhost:8080` (or the port specified in the console output) to view the application.

## Running the Application Directly in a Web Browser

To run the application without using a development server, follow these steps:

1. Create a production build of the application:
   ```
   npm run build
   ```

2. The `dist` folder will be created with optimized static files.

3. You can serve these static files using one of the following methods:

   a. Use a simple HTTP server:
      ```
      npm install -g http-server
      cd dist
      http-server
      ```
      Then open your browser and go to `http://localhost:8080`.

   b. Use Python's built-in HTTP server:
      ```
      cd dist
      python -m http.server 8000
      ```
      Then open your browser and go to `http://localhost:8000`.

   c. Use PHP's built-in server:
      ```
      cd dist
      php -S localhost:8000
      ```
      Then open your browser and go to `http://localhost:8000`.

4. Alternatively, you can open the `dist/index.html` file directly in your browser, but this method might have limitations due to CORS issues when loading assets and making API calls.

Note: Running the application as a static site has some limitations:
- Server-side features won't be available.
- API calls might be restricted due to CORS policies.
- Some features that rely on a development server might not work as expected.

For the best experience and full functionality, it's recommended to run the application using `npm run serve` during development and to deploy it to a proper hosting service for production use.
