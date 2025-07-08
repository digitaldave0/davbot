const fetch = require('node-fetch');

exports.handler = async (event) => {
  const { prompt } = JSON.parse(event.body || '{}');

  const HF_API_KEY = process.env.HF_API_KEY;
  const models = [
    {
      name: "togethercomputer/RedPajama-INCITE-7B-Chat",
      provider: "togetherai"
    },
    {
      name: "togethercomputer/RedPajama-INCITE-3B-Chat",
      provider: "togetherai"
    },
    {
      name: "facebook/opt-350m",
      provider: "default"
    }
  ];

  let reply = '🤖 No response.';
  let lastError = null;

  for (const model of models) {
    try {
      console.log('Making request to API...');
      console.log('Trying model:', model.name);
      console.log('Using provider:', model.provider);
      console.log('API Key present:', !!HF_API_KEY);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      
      // Build the API URL based on the provider
      const baseUrl = model.provider === 'togetherai' 
        ? `https://api-inference.huggingface.co/providers/togetherai/models/${model.name}`
        : `https://api-inference.huggingface.co/models/${model.name}`;

      const response = await fetch(
        baseUrl,
        {
          headers: {
            Authorization: `Bearer ${HF_API_KEY}`,
            'Content-Type': 'application/json'
          },
          method: 'POST',
          body: JSON.stringify({ 
            inputs: `Human: ${prompt}\nAssistant:`,
            parameters: {
              max_new_tokens: 150,
              temperature: 0.7,
              top_p: 0.9,
              return_full_text: false
            },
            options: {
              wait_for_model: true,
              use_cache: true
            }
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timeout);
      console.log(`Response status for ${model.name}:`, response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error Response for ${model.name}:`, errorText);
        
        if (response.status === 401) {
          reply = '⚠️ Invalid API key. Please check your Hugging Face API key.';
          break;  // Don't try other models if the key is invalid
        } else if (response.status === 404) {
          lastError = `Model ${model.name} not found`;
          continue;  // Try next model
        } else {
          throw new Error(errorText || 'Unknown error');
        }
      }

      const data = await response.json();
      console.log(`Raw response from ${model.name}:`, data);
      
      if (Array.isArray(data) && data[0]?.generated_text) {
        reply = data[0].generated_text;
      } else if (data.generated_text) {
        reply = data.generated_text;
      } else if (data.error) {
        throw new Error(data.error);
      }
      
      // If we got a valid response, clean it up and break the loop
      if (reply && reply !== '🤖 No response.') {
        reply = reply.replace(`Human: ${prompt}\nAssistant:`, '').trim();
        reply = reply.replace(/<\/s>$/, '').trim();
        console.log(`Successfully used model: ${model.name} with provider: ${model.provider}`);
        break;
      }
    } catch (err) {
      console.error(`Error with ${model.name}:`, err);
      lastError = err.message;
      if (err.name === 'AbortError' || err.message.includes('404')) {
        continue;  // Try next model on timeout or 404
      }
      // For other errors, try next model but keep the error message
    }
  }

  // If no models worked, use the last error
  if (reply === '🤖 No response.' && lastError) {
    reply = `⚠️ All models failed. Last error: ${lastError}`;
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
