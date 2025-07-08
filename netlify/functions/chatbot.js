const fetch = require('node-fetch');

exports.handler = async (event) => {
  const { prompt } = JSON.parse(event.body || '{}');

  const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;
  const model = "deepseek-ai/DeepSeek-V3";

  let reply = '🤖 No response.';
  let lastError = null;

  try {
    console.log('Making request to Together API...');
    console.log('Using model:', model);
    console.log('API Key present:', !!TOGETHER_API_KEY);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const response = await fetch(
      'https://api.together.xyz/v1/chat/completions',
      {
        headers: {
          Authorization: `Bearer ${TOGETHER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "user", content: prompt }
          ],
          max_tokens: 150,
          temperature: 0.7,
          top_p: 0.9,
          stop: null
        }),
        signal: controller.signal
      }
    );

    clearTimeout(timeout);
    console.log(`Response status:`, response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error Response:`, errorText);

      if (response.status === 401) {
        reply = '⚠️ Invalid API key. Please check your Together API key.';
      } else if (response.status === 404) {
        lastError = `Model ${model} not found`;
      } else {
        throw new Error(errorText || 'Unknown error');
      }
    } else {
      const data = await response.json();
      console.log(`Raw response:`, data);

      // Together API response typically has choices array with message content
      if (data.choices && Array.isArray(data.choices) && data.choices[0]?.message?.content) {
        reply = data.choices[0].message.content.trim();
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        lastError = 'Unexpected response format from Together API';
      }
    }
  } catch (err) {
    console.error(`Error with model ${model}:`, err);
    lastError = err.message;
  }

  // If no valid reply and lastError exists, set reply accordingly
  if (reply === '🤖 No response.' && lastError) {
    reply = `⚠️ Model failed. Last error: ${lastError}`;
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
