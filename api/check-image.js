const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are a Halal food checker for North America (USA & Canada). An image of a product or its ingredient label has been provided.

1. Read all text and ingredients visible in the image carefully.
2. Search online for the product's halal status if a brand/product name is visible.
3. Evaluate each ingredient using North American halal defaults:
   - Sugar, flour, cocoa, milk, soy lecithin, vegetable oils, citric acid, natural/artificial flavors, monoglycerides, diglycerides, PGPR, caramel color, starches, gums, vanillin, salt, yeast → HALAL by default
   - Only flag UNCERTAIN for: gelatin (unknown source), carmine, L-cysteine
   - Only flag HARAM for: confirmed pork derivatives, alcohol as ingredient, blood

RESPONSE FORMAT — output ONLY this JSON:
{
  "status": "HALAL" | "HARAM" | "UNCERTAIN",
  "confidence": <0-100>,
  "productName": "string",
  "ingredients": [
    { "name": "string", "status": "HALAL" | "HARAM" | "UNCERTAIN", "confidence": <0-100>, "reason": "string" }
  ],
  "summary": "string",
  "sources": ["string"]
}
Output raw JSON only — no markdown, no text before or after.`;

async function runHalalCheck(messages) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const tools = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }];

  let response = await client.messages.create({
    model: MODEL, max_tokens: 4096, system: SYSTEM_PROMPT, tools, messages,
  });

  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
    const toolResults = toolUseBlocks.map(block => ({
      type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(block.input),
    }));
    messages = [
      ...messages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: toolResults },
    ];
    response = await client.messages.create({
      model: MODEL, max_tokens: 4096, system: SYSTEM_PROMPT, tools, messages,
    });
  }

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock?.text.includes('{')) {
    messages = [
      ...messages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: 'Output the JSON result now. Raw JSON only.' },
    ];
    response = await client.messages.create({
      model: MODEL, max_tokens: 4096, system: SYSTEM_PROMPT, messages,
    });
  }

  const finalText = response.content.find(b => b.type === 'text');
  if (!finalText) throw new Error('No text response');

  let jsonStr = finalText.text.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) jsonStr = fenceMatch[1];
  else {
    const s = jsonStr.indexOf('{'), e = jsonStr.lastIndexOf('}');
    if (s !== -1 && e !== -1) jsonStr = jsonStr.slice(s, e + 1);
  }
  return JSON.parse(jsonStr);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageBase64, mediaType } = req.body;
    if (!imageBase64 || !mediaType) return res.status(400).json({ error: 'Image data required' });

    const messages = [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        { type: 'text', text: 'Read the ingredients from this product image and check if it is halal for North America. Return JSON only.' },
      ],
    }];
    const result = await runHalalCheck(messages);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
