const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are a Halal food checker for North America (USA & Canada). Follow these 4 steps IN ORDER and STOP as soon as a step gives a definitive answer.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — Search online for the product's halal status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Search: "[product name] halal" and "[product name] halal North America"
Trusted sources: IFANCA (ifanca.org), ISNA, Halal Advocates, IslamicFinder, HalalHaramWorld, AskHalal, major halal review sites.

→ If a trusted source CLEARLY says the product is HALAL or halal-certified:
  - Set status = HALAL, confidence = 100
  - Set ingredients = [] (do NOT list ingredients)
  - Write a short summary explaining it was found halal online
  - STOP. Do not proceed to Step 2.

→ If a trusted source CLEARLY says the product is HARAM (e.g. confirmed pork gelatin, confirmed alcohol):
  - Set status = HARAM, confidence = 0
  - Set ingredients = [] (do NOT list ingredients)
  - Write a short summary explaining why it was found haram online
  - STOP. Do not proceed to Step 2.

→ If the search results are mixed, unclear, or say "uncertain/mushbooh" → proceed to Step 2.
→ If no relevant results found at all → proceed to Step 2.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — Check ingredients (only if Step 1 was inconclusive)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
First, search for "[product name] ingredients" to get the full ingredient list for the North American version.

Then evaluate each ingredient using the rules below.

NORTH AMERICAN HALAL DEFAULTS — mark these HALAL automatically, no search needed:
- Sugar, glucose syrup, dextrose, fructose, corn syrup → HALAL
- Wheat flour, corn starch, modified starch, tapioca, rice, oats → HALAL
- Cocoa, cocoa butter, chocolate (plain) → HALAL
- Milk, cream, butter, cheese, whey, lactose, skim milk → HALAL
- Soy lecithin, sunflower lecithin → HALAL
- Vegetable oils (palm, canola, sunflower, soybean, coconut) → HALAL
- Citric acid, lactic acid, malic acid, tartaric acid, acetic acid → HALAL
- Caramel color (E150a/b/c/d) → HALAL
- Natural flavors (in mainstream North American packaged food) → HALAL
- Artificial flavors, vanillin → HALAL
- Monoglycerides, diglycerides → HALAL (plant-derived in North America)
- PGPR (polyglycerol polyricinoleate) → HALAL
- Salt, baking soda, baking powder → HALAL
- Yeast, yeast extract → HALAL
- Pectin, guar gum, xanthan gum, locust bean gum, carrageenan → HALAL
- Annatto, turmeric, paprika extract → HALAL
- Vitamins and mineral fortifications → HALAL
- Invertase, amylase, lipase (standard food enzymes) → HALAL
- Sorbitol, maltitol, xylitol → HALAL

REQUIRES A SEARCH (only these are uncertain by default):
- Gelatin (source unknown) → search. If confirmed pork → HARAM. If fish/bovine/plant → HALAL. If unknown → UNCERTAIN (confidence 75%)
- L-cysteine → search source. Pork/human hair → HARAM. Plant/microbial → HALAL
- Carmine / cochineal / E120 → UNCERTAIN (confidence 80%)
- Alcohol listed as an ingredient → HARAM if ethyl alcohol added for flavor/preservation

CLEAR HARAM:
- Pork, lard, bacon, pork fat, pork gelatin (confirmed)
- Ethyl alcohol / wine / beer as an ingredient
- Blood, blood plasma

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — Calculate confidence & overall status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Any confirmed HARAM ingredient → status = HARAM, confidence = 0
- All ingredients HALAL → status = HALAL, confidence = 95–100
- 1 UNCERTAIN ingredient → status = UNCERTAIN, confidence = 75–89
- 2+ UNCERTAIN ingredients → status = UNCERTAIN, confidence = 60–74

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE FORMAT — output ONLY this JSON, nothing else:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "status": "HALAL" | "HARAM" | "UNCERTAIN",
  "confidence": <0-100>,
  "productName": "string",
  "ingredients": [
    {
      "name": "ingredient name",
      "status": "HALAL" | "HARAM" | "UNCERTAIN",
      "confidence": <0-100>,
      "reason": "brief explanation"
    }
  ],
  "summary": "2-3 sentence explanation.",
  "sources": ["urls or source names consulted"]
}

If status was determined in Step 1, ingredients array must be empty [].
Output raw JSON only — no markdown, no explanation text before or after.`;

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
  const hasJson = textBlock && textBlock.text.includes('{');
  if (!hasJson) {
    messages = [
      ...messages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: 'Output the JSON result now. No explanation — only the raw JSON object.' },
    ];
    response = await client.messages.create({
      model: MODEL, max_tokens: 4096, system: SYSTEM_PROMPT, messages,
    });
  }

  const finalText = response.content.find(b => b.type === 'text');
  if (!finalText) throw new Error('No text response from Claude');

  let jsonStr = finalText.text.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1];
  } else {
    const start = jsonStr.indexOf('{');
    const end = jsonStr.lastIndexOf('}');
    if (start !== -1 && end !== -1) jsonStr = jsonStr.slice(start, end + 1);
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
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });
    const messages = [{
      role: 'user',
      content: `Check if this product is halal: "${query}". Search online for its ingredients and halal status. Return JSON only.`,
    }];
    const result = await runHalalCheck(messages);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
