// AI customer support, grounded in the real catalogue + real policies.
// The model is told not to invent products, prices or policies.
// Requires env var: ANTHROPIC_API_KEY (console.anthropic.com). Usage-based cost.
const products = require('../../data/products.json');

const POLICIES = `
SHIPPING: Dispatched within 2-4 business days. Free UK delivery on orders over £50; standard charge below that.
RETURNS: Unworn, unwashed returns within 30 days of delivery, original condition with tags. Faulty/wrong item: contact within 14 days for replacement or refund including return postage.
SIZING: True to size for most. If between sizes or wanting a looser fit, size up. Full chest/length chart on the Size Guide page.
AUTHENTICITY: KitVLT sells unofficial replica football shirts. Not affiliated with, endorsed by, or licensed by any club, federation or player.
CONTACT: KitVaultCustomerService@gmail.com
`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!process.env.ANTHROPIC_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'The assistant isn\'t configured yet.' }) };
  }

  try {
    const { message, history } = JSON.parse(event.body || '{}');
    if (!message) return { statusCode: 400, body: JSON.stringify({ error: 'No message provided.' }) };

    const catalogue = products.map((p) => {
      const s = p.stock === 'in-stock' ? 'In stock' : p.stock === 'coming-soon' ? 'Coming soon (not yet purchasable)' : 'Out of stock';
      return `- ${p.name}: £${p.price.toFixed(2)}, ${s}, sizes ${p.sizes.join('/')}`;
    }).join('\n');

    const system = `You are the customer support assistant for KitVLT, an online store selling unofficial replica football shirts.

Answer ONLY using the catalogue and policies below. If something isn't covered here, say so honestly and point them to KitVaultCustomerService@gmail.com. Never invent a product, price, stock status or policy.

Keep answers short and friendly — usually one to three sentences.

CATALOGUE:
${catalogue}

POLICIES:
${POLICIES}`;

    const messages = (Array.isArray(history) ? history.slice(-8) : []).concat([{ role: 'user', content: message }]);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, system, messages })
    });

    if (!res.ok) {
      console.error('Anthropic error:', await res.text());
      return { statusCode: 502, body: JSON.stringify({ error: 'The assistant is having trouble right now.' }) };
    }
    const data = await res.json();
    const reply = data.content && data.content[0] ? data.content[0].text : "Sorry, could you rephrase that?";
    return { statusCode: 200, body: JSON.stringify({ reply }) };
  } catch (err) {
    console.error('Chat error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Something went wrong.' }) };
  }
};
