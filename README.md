# DaveBot - Netlify Chatbot

This is a simple chatbot implementation using Hugging Face's API, deployed on Netlify.

## Setup

1. Deploy this directory to Netlify
2. Set up your Hugging Face API key in Netlify's environment variables:
   - Key: `HF_API_KEY`
   - Value: Your Hugging Face API key
3. The chatbot will be available at your Netlify URL

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Use the Netlify CLI to test locally:
```bash
netlify dev
```

## Files

- `index.html` - The chat interface
- `netlify/functions/chatbot.js` - The serverless function that calls Hugging Face API
- `netlify.toml` - Netlify configuration
- `package.json` - Node.js dependencies
