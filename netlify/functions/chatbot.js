const fetch = require('node-fetch');

exports.handler = async (event) => {
  const { prompt } = JSON.parse(event.body || '{}');

  const HF_API_KEY = process.env.HF_API_KEY;
  const model = "google/flan-t5-small";  // Changed to a free-tier compatible model

  // Format prompt for T5 model (simpler format than Mixtral)
  const systemPrompt = prompt;  // T5 doesn't need special formatting

  let reply = '🤖 No response.';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000); // 9s timeout for Netlify free tier
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({ inputs: systemPrompt }),
        signal: controller.signal
      }
    );
    clearTimeout(timeout);
    if (response.status === 404) {
      reply = '⚠️ Model not available on free tier. Please check your Hugging Face API key permissions.';
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
      // Clean up the response - remove prompt and special tokens
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
