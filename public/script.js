'use strict';

const API = '/api';

// ---------- Состояние ----------
let allProducts = [];       // полный список (для поиска/сортировки)
let currentCategory = '';   // текущая категория
let cart = loadCart();

function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem('cart'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem('cart', JSON.stringify(cart));
  } catch (e) {
    console.warn('Не удалось сохранить корзину:', e);
  }
}

// ---------- Загрузка товаров ----------
async function loadProducts(category = '') {
  currentCategory = category;
  const container = document.getElementById('products');
  container.innerHTML = '<div class="empty">⏳ Загрузка...</div>';

  try {
    const url = category
      ? `${API}/products?category=${encodeURIComponent(category)}`
      : `${API}/products`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    allProducts = Array.isArray(json.data) ? json.data : [];
    applyFiltersAndRender();
  } catch (e) {
    console.error('Ошибка загрузки:', e);
    container.innerHTML = '<div class="empty">😔 Не удалось загрузить товары</div>';
  }
}

// ---------- Фильтр + сортировка ----------
function applyFiltersAndRender() {
  const q = (document.getElementById('search').value || '').trim().toLowerCase();
  const sort = document.getElementById('sort').value;

  let list = [...allProducts];

  if (q) {
    list = list.filter(p =>
      String(p.name || '').toLowerCase().includes(q) ||
      String(p.description || '').toLowerCase().includes(q) ||
      String(p.gemstone || '').toLowerCase().includes(q)
    );
  }

  switch (sort) {
    case 'price-asc':  list.sort((a, b) => a.price - b.price); break;
    case 'price-desc': list.sort((a, b) => b.price - a.price); break;
    case 'rating':     list.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
  }

  renderProducts(list);
}

// ---------- Отрисовка ----------
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPrice(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('ru-RU') : '—';
}

function renderProducts(products) {
  const container = document.getElementById('products');

  if (!products.length) {
    container.innerHTML = '<div class="empty">😔 Ничего не найдено</div>';
    return;
  }

  container.innerHTML = products.map(p => `
    <div class="product-card" data-id="${p.id}">
      <img
        src="${escapeHtml(p.image)}"
        alt="${escapeHtml(p.name)}"
        onerror="this.onerror=null;this.src='https://via.placeholder.com/400x250?text=Jewelry'"
      >
      <div class="product-info">
        <h3>${escapeHtml(p.name)}</h3>
        <div class="material">${escapeHtml(p.material)} • ${escapeHtml(p.gemstone)}</div>
        <div class="price">${formatPrice(p.price)} ₽</div>
        <div class="rating">⭐ ${escapeHtml(p.rating ?? 0)} • В наличии: ${escapeHtml(p.stock ?? 0)}</div>
      </div>
    </div>
  `).join('');
}

// ---------- Модальное окно ----------
let modalProduct = null;

async function openModal(id) {
  try {
    const res = await fetch(`${API}/products/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { data: p } = await res.json();
    modalProduct = p;

    document.getElementById('modalBody').innerHTML = `
      <div class="modal-product">
        <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}"
             onerror="this.onerror=null;this.src='https://via.placeholder.com/400x250?text=Jewelry'">
        <h2>${escapeHtml(p.name)}</h2>
        <p>${escapeHtml(p.description)}</p>
        <p><strong>Материал:</strong> ${escapeHtml(p.material)}</p>
        <p><strong>Камень:</strong> ${escapeHtml(p.gemstone)}</p>
        <p><strong>Рейтинг:</strong> ⭐ ${escapeHtml(p.rating ?? 0)}</p>
        <div class="modal-price">${formatPrice(p.price)} ₽</div>
        <button id="addToCartBtn" type="button">🛒 Добавить в корзину</button>
      </div>
    `;

    document.getElementById('addToCartBtn').onclick = () => {
      addToCart(p.id, p.name, p.price);
    };

    document.getElementById('modal').classList.add('active');
  } catch (e) {
    console.error('Ошибка открытия товара:', e);
  }
}

function closeModal() {
  document.getElementById('modal').classList.remove('active');
}

// ---------- Корзина ----------
function addToCart(id, name, price) {
  cart.push({ id, name, price });
  saveCart();
  updateCartCount();
  showToast(`✅ "${name}" добавлен в корзину`);
}

function updateCartCount() {
  const el = document.getElementById('cartCount');
  if (el) el.textContent = cart.length;
}

// ---------- Toast ----------
function showToast(text) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ---------- AI-чат ----------
const chatHistory = [];

function initAI() {
  const aiToggle = document.getElementById('aiToggle');
  const aiWidget = document.getElementById('aiWidget');
  const aiClose  = document.getElementById('aiClose');
  const aiForm   = document.getElementById('aiForm');
  const aiInput  = document.getElementById('aiInput');
  const aiSend   = document.getElementById('aiSend');
  const aiMessages = document.getElementById('aiMessages');

  if (!aiToggle || !aiWidget || !aiForm) {
    console.warn('AI-виджет не найден в DOM');
    return;
  }

  aiToggle.addEventListener('click', () => {
    aiWidget.classList.toggle('active');
    if (aiWidget.classList.contains('active')) aiInput?.focus();
  });

  aiClose?.addEventListener('click', () => aiWidget.classList.remove('active'));

  function addMessage(text, sender) {
    const div = document.createElement('div');
    div.className = `ai-message ai-${sender}`;
    div.textContent = text;
    aiMessages.appendChild(div);
    aiMessages.scrollTop = aiMessages.scrollHeight;
    return div;
  }

  function addTypingIndicator() {
    const div = document.createElement('div');
    div.className = 'ai-typing';
    div.innerHTML = '<span>●</span><span>●</span><span>●</span>';
    aiMessages.appendChild(div);
    aiMessages.scrollTop = aiMessages.scrollHeight;
    return div;
  }

  aiForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const message = aiInput.value.trim();
    if (!message) return;

    addMessage(message, 'user');
    aiInput.value = '';
    aiInput.disabled = true;
    aiSend.disabled = true;

    const typing = addTypingIndicator();

    try {
      const response = await fetch(`${API}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: chatHistory.slice(-6)
        })
      });

      const data = await response.json().catch(() => ({}));
      typing.remove();

      if (response.ok && data.success) {
        addMessage(data.reply, 'bot');
        chatHistory.push(
          { role: 'user', content: message },
          { role: 'assistant', content: data.reply }
        );
      } else {
        addMessage(data.error || 'Извините, произошла ошибка. Попробуйте позже.', 'bot');
      }
    } catch (error) {
      typing.remove();
      addMessage('Нет соединения с сервером. Проверьте интернет.', 'bot');
      console.error('AI Error:', error);
    } finally {
      aiInput.disabled = false;
      aiSend.disabled = false;
      aiInput.focus();
    }
  });
}

// ---------- Инициализация ----------
document.addEventListener('DOMContentLoaded', () => {
  // Категории
  document.querySelectorAll('nav a[data-cat]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('nav a[data-cat]').forEach(a => a.classList.remove('active-cat'));
      link.classList.add('active-cat');
      loadProducts(link.dataset.cat || '');
    });
  });

  // Поиск (с debounce)
  let searchTimer;
  document.getElementById('search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFiltersAndRender, 200);
  });

  // Сортировка
  document.getElementById('sort').addEventListener('change', applyFiltersAndRender);

  // Модалка
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Делегирование кликов по карточкам
  document.getElementById('products').addEventListener('click', (e) => {
    const card = e.target.closest('.product-card');
    if (card) openModal(Number(card.dataset.id));
  });

  // AI
  initAI();

  // Старт
  updateCartCount();
  loadProducts();
});
