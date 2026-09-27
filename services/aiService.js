require('dotenv').config();

const OpenAI = require('openai');

let client = null;
let model = process.env.AI_MODEL || 'gpt-4o-mini';

if (process.env.OPENAI_API_KEY) {
  client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

const SYSTEM_PROMPT = `Ты — вежливый AI-консультант ювелирного магазина "Luxe Jewelry".
Помогаешь клиентам подобрать украшения: кольца, серьги, колье, браслеты.
Отвечай кратко (2-4 предложения), дружелюбно, по-русски.
Если спрашивают про цену — уточняй бюджет.
Не выдумывай товары, которых нет в каталоге.`;

/**
 * Отправить запрос к OpenAI
 * @param {string} message - сообщение пользователя
 * @param {string} [systemPrompt] - переопределить системный промпт
 * @param {Array} [history] - массив { role, content } для контекста
 * @returns {Promise<string>}
 */
async function askAI(message, systemPrompt = null, history = []) {
  if (!client) {
    throw new Error('OPENAI_API_KEY не задан');
  }

  if (!message || typeof message !== 'string') {
    throw new Error('Пустое сообщение');
  }

  // Валидация истории
  const safeHistory = Array.isArray(history)
    ? history
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }))
    : [];

  const messages = [
    { role: 'system', content: systemPrompt || SYSTEM_PROMPT },
    ...safeHistory,
    { role: 'user', content: message }
  ];

  const response = await client.chat.completions.create({
    model,
    messages,
    max_tokens: 400,
    temperature: 0.7
  });

  const reply = response.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    throw new Error('Пустой ответ от AI');
  }

  return reply;
}

module.exports = { askAI };
