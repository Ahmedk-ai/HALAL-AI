const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are a Halal food checker for North America (USA & Canada).
You will be given a product name and its full ingredient list. Your job is to evaluate each ingredient.

NORTH AMERICAN HALAL DEFAULTS — mark these HALAL instantly, no search needed:
- Sugar, glucose syrup, dextrose, fructose, corn syrup, invert sugar → HALAL
- Wheat flour, enriched flour, corn starch, modified starch, tapioca, oats, rice → HALAL
- Cocoa, cocoa butter, chocolate, cocoa powder → HALAL
- Milk, cream, butter, cheese, whey, lactose, skim milk, nonfat milk, milk fat → HALAL
- Soy lecithin, sunflower lecithin → HALAL
- Vegetable oils (palm, canola, sunflower, soybean, coconut, cottonseed) → HALAL
- Citric acid, lactic acid, malic acid, tartaric acid, acetic acid, fumaric acid → HALAL
- Caramel color, caramel → HALAL
- Natural flavors, artificial flavors, vanillin, ethyl vanillin → HALAL (North American default)
- Monoglycerides, diglycerides, mono and diglycerides of fatty acids → HALAL (plant-derived in NA)
- PGPR (polyglycerol polyricinoleate) → HALAL
- Salt, baking soda, sodium bicarbonate, baking powder, cream of tartar → HALAL
- Yeast, yeast extract, autolyzed yeast → HALAL
- Pectin, guar gum, xanthan gum, locust bean gum, carrageenan, gellan gum, acacia gum → HALAL
- Sodium alginate, cellulose gum, methylcellulose → HALAL
- Annatto, turmeric, paprika extract, beta-carotene, lycopene (plant colors) → HALAL
- Vitamins and minerals (niacin, riboflavin, folic acid, iron, zinc, thiamine, B vitamins) → HALAL
- Invertase, amylase, lipase, protease, lactase (food-grade enzymes) → HALAL
- Sorbitol, maltitol, xylitol, erythritol, mannitol → HALAL
- Sodium benzoate, potassium sorbate, calcium propionate (preservatives) → HALAL
- BHA, BHT, TBHQ, tocopherols (antioxidants) → HALAL
- Ascorbic acid, sodium ascorbate → HALAL
- Calcium carbonate, sodium phosphate, dipotassium phosphate → HALAL
- Corn syrup solids, maltodextrin, dextrin → HALAL
- Hydrogenated vegetable oil, partially hydrogenated oil → HALAL

REQUIRES INVESTIGATION (search these):
- Gelatin: search "[product name] gelatin source". Pork confirmed → HARAM. Fish/bovine/veg → HALAL. Unknown → UNCERTAIN (75%)
- L-cysteine: pork/human hair source → HARAM. Microbial/plant → HALAL
- Carmine, cochineal, E120 → UNCERTAIN (80%)
- Rennet: microbial/vegetable (standard in NA) → HALAL. Animal pork → HARAM
- Alcohol explicitly as ingredient (not vanilla extract) → HARAM

CLEAR HARAM (immediately return HARAM):
- Pork, lard, bacon, ham, pork fat, pork gelatin confirmed, suet from pork
- Ethyl alcohol / wine / beer as a named ingredient
- Blood, blood plasma, blood albumin

OVERALL RULES:
- Found HARAM → status=HARAM, confidence=0
- All HALAL → status=HALAL, confidence=95-100
- 1 UNCERTAIN → status=UNCERTAIN, confidence=75-89
- 2+ UNCERTAIN → status=UNCERTAIN, confidence=60-74
- Be decisive. Do not default uncertain out of caution — only flag UNCERTAIN for REAL specific concerns.

OUTPUT: Raw JSON only, no markdown, no preamble:
{
  "status": "HALAL" | "HARAM" | "UNCERTAIN",
  "confidence": <0-100>,
  "productName": "string",
  "ingredients": [
    { "name": "string", "status": "HALAL"|"HARAM"|"UNCERTAIN", "confidence": <0-100>, "reason": "string" }
  ],
  "summary": "2-3 sentences. Name any specific concerns.",
  "sources": ["sources consulted if any"]
}`;

async function runCheck(messages) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const tools = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 }];

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
      { role: 'user', content: 'Output the JSON result now. Raw JSON only, no explanation.' },
    ];
    response = await client.messages.create({
      model: MODEL, max_tokens: 4096, system: SYSTEM_PROMPT, messages,
    });
  }

  const finalText = response.content.find(b => b.type === 'text');
  if (!finalText) throw new Error('No response from Claude');

  let jsonStr = finalText.text.trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) jsonStr = fence[1];
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
    const { productName, ingredients } = req.body;
    if (!ingredients) return res.status(400).json({ error: 'Ingredients are required' });

    const messages = [{
      role: 'user',
      content: `Product: "${productName || 'Unknown'}"\n\nIngredients: ${ingredients}\n\nCheck each ingredient for halal status (North America). Only search online for ingredients that are uncertain (gelatin source, carmine, L-cysteine). Return JSON only.`,
    }];

    const result = await runCheck(messages);
    if (!result.productName || result.productName === 'string') {
      result.productName = productName || 'Unknown Product';
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
