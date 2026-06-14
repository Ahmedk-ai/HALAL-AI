import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors());
app.use(express.json());

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
- Natural flavors (in mainstream North American packaged food) → HALAL — default assumption is plant/fruit-derived unless a source specifically says otherwise for THIS product
- Artificial flavors, vanillin → HALAL
- Monoglycerides, diglycerides, mono and diglycerides of fatty acids → HALAL — in North America these are predominantly from plant/vegetable oils; do NOT flag unless a source specifically identifies animal-derived mono/diglycerides in THIS exact product
- PGPR (polyglycerol polyricinoleate) → HALAL — derived from castor oil in North American formulations
- Salt, baking soda, baking powder → HALAL
- Yeast, yeast extract → HALAL
- Pectin, guar gum, xanthan gum, locust bean gum, carrageenan → HALAL
- Sodium bicarbonate, potassium carbonate, ammonium bicarbonate → HALAL
- Annatto, turmeric, paprika extract (natural colors from plants) → HALAL
- Vitamins and mineral fortifications (niacin, riboflavin, folic acid, iron, zinc) → HALAL
- Invertase, amylase, lipase (enzymes in standard food) → HALAL
- Sorbitol, maltitol, xylitol (sugar alcohols) → HALAL

REQUIRES A SEARCH (only these are uncertain by default):
- Gelatin (source unknown) → search "[product name] gelatin source". If confirmed pork → HARAM. If fish/bovine/plant → HALAL. If unknown → UNCERTAIN (confidence 75%)
- L-cysteine → search source. If from pork/human hair → HARAM. If from plant/microbial → HALAL
- Carmine / cochineal / E120 → UNCERTAIN (confidence 80%) — some scholars allow it; note it in summary
- Lipase from animal sources → search. If pork-derived → HARAM
- Rennet in cheese → HALAL unless specifically confirmed as non-microbial pork rennet
- Alcohol listed as an ingredient (not processing aid) → HARAM if it is ethyl alcohol added for flavor/preservation

CLEAR HARAM — immediately set status HARAM if found:
- Pork, lard, bacon, ham, pork fat, pork gelatin (confirmed)
- Ethyl alcohol / wine / beer as an ingredient
- Blood, blood plasma
- L-cysteine from pork or human hair (confirmed)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — Calculate confidence & overall status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
After checking all ingredients:
- Any confirmed HARAM ingredient → status = HARAM, confidence = 0
- All ingredients HALAL → status = HALAL, confidence = 95–100
- 1 UNCERTAIN ingredient → status = UNCERTAIN, confidence = 75–89
- 2+ UNCERTAIN ingredients → status = UNCERTAIN, confidence = 60–74
- Only flag as UNCERTAIN if there is a REAL and SPECIFIC concern, not a theoretical one

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
  "summary": "2-3 sentence explanation. If halal/haram found online, say so. If uncertain, name the specific ingredients causing concern.",
  "sources": ["urls or source names consulted"]
}

If status was determined in Step 1, ingredients array must be empty [].
Output raw JSON only — no markdown, no explanation text before or after.`;

async function runHalalCheck(messages) {
  const tools = [
    {
      type: 'web_search_20260209',
      name: 'web_search',
      max_uses: 5,
    },
  ];

  let response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools,
    messages,
  });

  // Agentic loop to handle tool use
  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
    const toolResults = toolUseBlocks.map((block) => ({
      type: 'tool_result',
      tool_use_id: block.id,
      content: block.type === 'tool_use' ? JSON.stringify(block.input) : '',
    }));

    messages = [
      ...messages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: toolResults },
    ];

    response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });
  }

  // If Claude narrated instead of outputting JSON, nudge it to produce the JSON
  const textBlock = response.content.find((b) => b.type === 'text');
  const hasJson = textBlock && textBlock.text.includes('{');
  if (!hasJson) {
    messages = [
      ...messages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: 'Output the JSON result now. No explanation — only the raw JSON object.' },
    ];
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages,
    });
  }

  const finalText = response.content.find((b) => b.type === 'text');
  if (!finalText) throw new Error('No text response from Claude');

  // Extract JSON — handle markdown code blocks or preamble text
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

// Text search endpoint
app.post('/api/check-text', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    const messages = [
      {
        role: 'user',
        content: `Check if this product is halal: "${query}". Search online for its ingredients and halal status. Return JSON only.`,
      },
    ];

    const result = await runHalalCheck(messages);
    res.json(result);
  } catch (err) {
    console.error('Text check error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Image scan endpoint
app.post('/api/check-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Image is required' });

    const imageBase64 = req.file.buffer.toString('base64');
    const mediaType = req.file.mimetype;

    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: 'This is a product image (packaging or ingredients label). Please read all the ingredients from the image, then search online to verify the halal status of each ingredient. Return JSON only.',
          },
        ],
      },
    ];

    const result = await runHalalCheck(messages);
    res.json(result);
  } catch (err) {
    console.error('Image check error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Barcode / ingredient check endpoint
app.post('/api/check-ingredients', async (req, res) => {
  try {
    const { productName, ingredients } = req.body;
    if (!ingredients) return res.status(400).json({ error: 'Ingredients are required' });

    const messages = [
      {
        role: 'user',
        content: `Product: "${productName || 'Unknown'}"\n\nIngredients: ${ingredients}\n\nCheck each ingredient for halal status (North America). Only search online for uncertain ingredients (gelatin source, carmine, L-cysteine). Return JSON only.`,
      },
    ];

    const result = await runHalalCheck(messages);
    if (!result.productName || result.productName === 'string') {
      result.productName = productName || 'Unknown Product';
    }
    res.json(result);
  } catch (err) {
    console.error('Ingredients check error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Halal Checker API running on port ${PORT}`));
