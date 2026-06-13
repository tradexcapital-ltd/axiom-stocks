// api/analyse.js — Vercel Serverless Function
// This runs on the server so your API key is NEVER exposed to the browser.

export default async function handler(req, res) {
  // Allow requests from your deployed frontend (update this to your actual domain)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ticker } = req.body;

  if (!ticker || typeof ticker !== 'string' || ticker.length > 10) {
    return res.status(400).json({ error: 'Invalid ticker' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const prompt = `You are a senior equity research analyst. Analyse the stock "${ticker.toUpperCase()}" and return ONLY a valid JSON object (no markdown, no backticks, no explanation — raw JSON only) with this exact structure:

{
  "ticker": "${ticker.toUpperCase()}",
  "company": "Full company name",
  "exchange": "NYSE or NASDAQ",
  "sector": "Sector name",
  "price": 123.45,
  "priceChange": 2.34,
  "priceChangePct": 1.23,
  "marketCap": "2.1T",
  "peRatio": "28.5x",
  "psRatio": "7.2x",
  "evEbitda": "18.4x",
  "dividendYield": "0.5%",
  "thesis": "2-sentence bull thesis for this stock",
  "metrics": [
    {"label": "Revenue (TTM)", "value": "$394B", "sub": "+6% YoY", "color": "accent"},
    {"label": "Net income", "value": "$97B", "sub": "24.6% margin", "color": "green"},
    {"label": "Free cash flow", "value": "$110B", "sub": "Record high", "color": "green"},
    {"label": "Gross margin", "value": "46.2%", "sub": "Expanding", "color": "accent"},
    {"label": "EV/EBITDA", "value": "18.4x", "sub": "vs sector 22x", "color": "text"},
    {"label": "Debt/equity", "value": "1.9x", "sub": "Manageable", "color": "text"}
  ],
  "revenueHistory": [
    {"year": "2021", "revenue": 0, "profit": 0},
    {"year": "2022", "revenue": 0, "profit": 0},
    {"year": "2023", "revenue": 0, "profit": 0},
    {"year": "2024", "revenue": 0, "profit": 0},
    {"year": "2025", "revenue": 0, "profit": 0}
  ],
  "segments": [
    {"name": "Segment 1", "revenue2025": 0, "revenue2024": 0, "margin": "0%", "color": "green", "description": "Brief description"},
    {"name": "Segment 2", "revenue2025": 0, "revenue2024": 0, "margin": "0%", "color": "accent", "description": "Brief description"},
    {"name": "Segment 3", "revenue2025": 0, "revenue2024": 0, "margin": "0%", "color": "purple", "description": "Brief description"}
  ],
  "projections": {
    "bull": {"years": ["2026E","2027E","2028E"], "revenue": [0,0,0], "ebitda": [0,0,0], "impliedPrice": [0,0,0]},
    "base": {"years": ["2026E","2027E","2028E"], "revenue": [0,0,0], "ebitda": [0,0,0], "impliedPrice": [0,0,0]},
    "bear": {"years": ["2026E","2027E","2028E"], "revenue": [0,0,0], "ebitda": [0,0,0], "impliedPrice": [0,0,0]}
  },
  "modelDefaults": {
    "revenueGrowth1": 15,
    "revenueGrowth2": 12,
    "ebitdaMargin": 28,
    "evMultiple": 18,
    "sharesOutstanding": 15.2,
    "currentEbitda": 110
  },
  "catalysts": [
    {"title": "Catalyst 1", "body": "2-3 sentence description", "icon": "🚀"},
    {"title": "Catalyst 2", "body": "2-3 sentence description", "icon": "📈"},
    {"title": "Catalyst 3", "body": "2-3 sentence description", "icon": "💡"},
    {"title": "Catalyst 4", "body": "2-3 sentence description", "icon": "🌍"}
  ],
  "risks": [
    {"title": "Risk 1", "probability": "High", "impact": "Critical", "body": "2-3 sentence description"},
    {"title": "Risk 2", "probability": "Medium", "impact": "High", "body": "2-3 sentence description"},
    {"title": "Risk 3", "probability": "Medium", "impact": "Medium", "body": "2-3 sentence description"},
    {"title": "Risk 4", "probability": "Low", "impact": "High", "body": "2-3 sentence description"},
    {"title": "Risk 5", "probability": "High", "impact": "Medium", "body": "2-3 sentence description"},
    {"title": "Risk 6", "probability": "Low", "impact": "Medium", "body": "2-3 sentence description"}
  ],
  "analystConsensus": {
    "buy": 28, "hold": 8, "sell": 3,
    "priceTargetHigh": 280,
    "priceTargetLow": 160,
    "priceTargetAvg": 230,
    "topFirmRating": "Goldman Sachs — Buy, $245 PT"
  },
  "competitivePosition": "2-3 sentences on moat, market share, and competitive dynamics",
  "managementQuality": "2-3 sentences on management track record and capital allocation",
  "verdict": "BUY"
}

Use real, accurate financial data for ${ticker.toUpperCase()}. All revenue/profit figures in billions (as numbers). Make all projections realistic based on the company's actual growth trajectory. Return ONLY the JSON object.`;

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return res.status(anthropicRes.status).json({ error: `Anthropic API error: ${errText}` });
    }

    const data = await anthropicRes.json();
    const textBlocks = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    const jsonMatch = textBlocks.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'No JSON found in AI response' });
    }

    const parsed = JSON.parse(jsonMatch[0].replace(/```json|```/g, '').trim());
    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
