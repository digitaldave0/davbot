const fetch = require('node-fetch');

exports.handler = async (event) => {
  const { prompt } = JSON.parse(event.body || '{}');

  const HF_API_KEY = process.env.HF_API_KEY;
  const model = "distilgpt2";  // Using DistilGPT-2, a more reliably hosted model

  // Format prompt for GPT-2
  const systemPrompt = `Human: ${prompt}\nAssistant:`;

  let reply = '🤖 No response.';
  try {
    console.log('Making request to Hugging Face API...');
    console.log('Model:', model);
    console.log('API Key present:', !!HF_API_KEY);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    
    // Using the model's full path in the API URL
    const response = await fetch(
      `https://api-inference.huggingface.co/models/distilgpt2`,
      {
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({ 
          inputs: systemPrompt,
          parameters: {
            max_new_tokens: 100,
            temperature: 0.7,
            return_full_text: false
          }
        }),
        signal: controller.signal
      }
    );

    clearTimeout(timeout);
    console.log('Response status:', response.status);
    console.log('Response headers:', [...response.headers.entries()]);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      let errorData = {};
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        console.error('Failed to parse error response as JSON');
      }
      console.error('API Error:', response.status, errorData);
      
      if (response.status === 401) {
        reply = '⚠️ Invalid API key. Please check your Hugging Face API key.';
      } else if (response.status === 404) {
        reply = '⚠️ Model not found. Please try again later.';
      } else {
        reply = `⚠️ API Error (${response.status}): ${errorData.error || errorText || 'Unknown error'}`;
      }
    } else {
      const data = await response.json();
      console.log("Raw Hugging Face response:", data);
      
      if (Array.isArray(data) && data[0]?.generated_text) {
        reply = data[0].generated_text;
      } else if (data.generated_text) {
        reply = data.generated_text;
      } else if (data.error) {
        reply = `⚠️ API Error: ${data.error}`;
      }
      
      if (reply) {
        reply = reply.replace(systemPrompt, '').trim();
        reply = reply.replace(/<\/s>$/, '').trim();
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      reply = '⚠️ Model is loading or slow. Please try again in a few seconds.';
    } else {
      reply = `⚠️ Error: ${err.message}`;
    }
    console.error('Error:', err);
  }

  // Estimate tokens (rough approximation - 4 chars per token)
  const inputTokens = Math.ceil(prompt.length / 4);
  const outputTokens = Math.ceil(reply.length / 4);
  const totalTokens = inputTokens + outputTokens;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reply,
      tokens: totalTokens,
      tokenInfo: {
        input: inputTokens,
        output: outputTokens,
        total: totalTokens
      }
    })
  };
};
