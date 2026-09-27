require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// ДАННЫЕ (в памяти)
// ==========================================
let jewelry = require('./data/jewelry');
let orders = [];

// ==========================================
// INFO
// ==========================================
app.get('/api', (req, res) => {
  res.json({
    name: 'Jewelry Shop API',
    version: '1.0.0',
    endpoints: {
      products: {
        'GET /api/products': 'Все украшения',
        'GET /api/products/:id': 'Одно украшение',
        'GET /api/products?category=rings': 'Фильтр по категории',
        'GET /api/products?minPrice=1000&maxPrice=100000': 'Фильтр по цене',
        'GET /api/products?search=кольцо': 'Поиск',
        'POST /api/products': 'Создать украшение',
        'PUT /api/products/:id': 'Обновить',
        'PATCH /api/products/:id': 'Частично обновить',
        'DELETE /api/products/:id': 'Удалить'
      },
      orders: {
        'GET /api/orders': 'Все заказы',
        'POST /api/orders': 'Создать заказ',
        'GET /api/orders/:id': 'Один заказ'
      },
      stats: {
        'GET /api/stats': 'Статистика магазина'
      },
      ai: {
        'POST /api/ai/chat': 'Чат с AI-консультантом',
        'POST /api/ai/describe': 'Автогенерация описания товара'
      }
    }
  });
});

// ==========================================
// ПРОДУКТЫ
// ==========================================

// GET все с фильтрами
app.get('/api/products', (req, res) => {
  let result = [...jewelry];
  const { category, minPrice, maxPrice, search, material } = req.query;

  if (category) {
    result = result.filter(p => p.category === category);
  }
  if (minPrice) {
    result = result.filter(p => p.price >= +minPrice);
  }
  if (maxPrice) {
    result = result.filter(p => p.price <= +maxPrice);
  }
  if (material) {
    result = result.filter(p =>
      String(p.material || '').toLowerCase().includes(material.toLowerCase())
    );
  }
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(p =>
      String(p.name || '').toLowerCase().includes(q) ||
      String(p.description || '').toLowerCase().includes(q) ||
      String(p.gemstone || '').toLowerCase().includes(q)
    );
  }

  res.json({ success: true, count: result.length, data: result });
});

// GET один
app.get('/api/products/:id', (req, res) => {
  const product = jewelry.find(p => p.id === +req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Украшение не найдено' });
  }
  res.json({ success: true, data: product });
});

// POST создать
app.post('/api/products', (req, res) => {
  const { name, category, material, gemstone, price, stock, description } = req.body;

  if (!name || !category || price === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Поля name, category и price обязательны'
    });
  }

  const newProduct = {
    id: jewelry.length ? Math.max(...jewelry.map(p => p.id)) + 1 : 1,
    name,
    category,
    material: material || 'Не указан',
    gemstone: gemstone || 'Нет',
    price: +price,
    stock: stock || 0,
    image: req.body.image || 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400',
    description: description || '',
    rating: 0,
    createdAt: new Date().toISOString()
  };

  jewelry.push(newProduct);
  res.status(201).json({ success: true, data: newProduct });
});

// PUT обновить полностью
app.put('/api/products/:id', (req, res) => {
  const index = jewelry.findIndex(p => p.id === +req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Украшение не найдено' });
  }
  jewelry[index] = { ...jewelry[index], ...req.body, id: jewelry[index].id };
  res.json({ success: true, data: jewelry[index] });
});

// PATCH частично
app.patch('/api/products/:id', (req, res) => {
  const product = jewelry.find(p => p.id === +req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Не найдено' });
  }
  Object.assign(product, req.body);
  res.json({ success: true, data: product });
});

// DELETE
app.delete('/api/products/:id', (req, res) => {
  const index = jewelry.findIndex(p => p.id === +req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Не найдено' });
  }
  const deleted = jewelry.splice(index, 1)[0];
  res.json({ success: true, message: 'Удалено', data: deleted });
});

// ==========================================
// ЗАКАЗЫ
// ==========================================

app.get('/api/orders', (req, res) => {
  res.json({ success: true, count: orders.length, data: orders });
});

app.get('/api/orders/:id', (req, res) => {
  const order = orders.find(o => o.id === +req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Заказ не найден' });
  }
  res.json({ success: true, data: order });
});

app.post('/api/orders', (req, res) => {
  const { customerName, email, phone, items } = req.body;

  if (!customerName || !email || !Array.isArray(items) || !items.length) {
    return res.status(400).json({
      success: false,
      error: 'Поля customerName, email и items обязательны'
    });
  }

  let total = 0;
  const detailedItems = items
    .map(item => {
      const product = jewelry.find(p => p.id === +item.productId);
      if (!product) return null;
      const qty = item.quantity || 1;
      const subtotal = product.price * qty;
      total += subtotal;
      return {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: qty,
        subtotal
      };
    })
    .filter(Boolean);

  const newOrder = {
    id: orders.length + 1,
    customerName,
    email,
    phone: phone || '',
    items: detailedItems,
    total,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  orders.push(newOrder);
  res.status(201).json({ success: true, data: newOrder });
});

// ==========================================
// СТАТИСТИКА
// ==========================================
app.get('/api/stats', (req, res) => {
  const totalValue = jewelry.reduce((sum, p) => sum + p.price * p.stock, 0);
  const categories = {};

  jewelry.forEach(p => {
    if (!categories[p.category]) {
      categories[p.category] = { count: 0, totalValue: 0 };
    }
    categories[p.category].count++;
    categories[p.category].totalValue += p.price * p.stock;
  });

  const avgPrice = jewelry.length
    ? Math.round(jewelry.reduce((s, p) => s + p.price, 0) / jewelry.length)
    : 0;

  res.json({
    success: true,
    data: {
      totalProducts: jewelry.length,
      totalOrders: orders.length,
      totalInventoryValue: totalValue,
      averagePrice: avgPrice,
      categories,
      topRated: [...jewelry].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 3)
    }
  });
});

// ==========================================
// AI
// ==========================================
let askAI = null;
try {
  ({ askAI } = require('./services/aiService'));
} catch (e) {
  console.warn('⚠️  AI-сервис недоступен:', e.message);
}

app.post('/api/ai/chat', async (req, res) => {
  try {
    if (!askAI) {
      return res.status(503).json({
        success: false,
        error: 'AI-сервис не настроен. Проверьте OPENAI_API_KEY.'
      });
    }

    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || message.length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Сообщение обязательно и не должно превышать 2000 символов'
      });
    }

    const safeHistory = Array.isArray(history) ? history.slice(-6) : [];
    const reply = await askAI(message, null, safeHistory);

    res.json({ success: true, reply });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка AI-сервиса. Попробуйте позже.'
    });
  }
});

app.post('/api/ai/describe', async (req, res) => {
  try {
    if (!askAI) {
      return res.status(503).json({
        success: false,
        error: 'AI-сервис не настроен'
      });
    }

    const { productName, material, gemstone } = req.body;

    if (!productName) {
      return res.status(400).json({
        success: false,
        error: 'Поле productName обязательно'
      });
    }

    const prompt = `Напиши привлекательное описание для ювелирного украшения.
Название: ${productName}
Материал: ${material || 'не указан'}
Камень: ${gemstone || 'нет'}

Стиль: премиальный, эмоциональный, 2-3 предложения.`;

    const description = await askAI(
      prompt,
      'Ты — опытный копирайтер ювелирного магазина.'
    );

    res.json({ success: true, description });
  } catch (error) {
    console.error('AI describe error:', error);
    res.status(500).json({ success: false, error: 'Ошибка AI-сервиса' });
  }
});

// ==========================================
// 404 для API
// ==========================================
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint не найден' });
});

// ==========================================
// ЗАПУСК — В САМОМ КОНЦЕ
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n💎 Jewelry Shop запущен!`);
  console.log(`🌐 Сайт:  http://localhost:${PORT}`);
  console.log(`📮 API:   http://localhost:${PORT}/api`);
  console.log(`📊 Stats: http://localhost:${PORT}/api/stats`);
  console.log(`🤖 AI:    ${askAI ? 'включён' : 'выключен (нет OPENAI_API_KEY)'}\n`);
});
