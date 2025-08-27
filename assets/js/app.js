/* CutieCart - homepage logic: carousel + products rendering */
(function() {
  'use strict';

  const productGrid = document.getElementById('productGrid');
  const cartCountEl = document.getElementById('cart-count');
  const bday = { month: 0, day: 15 }; // Jan = 0

  // Products
  const products = [
    {
      id: 'kiss-001',
      title: 'Fake Fight 😤',
      desc: 'You can get mad at me for no reason and I will be sowwwy.',
      price: 1,
      badges: ['Sweet', 'Instant Joy'],
      image: './assets/img/angry.gif'
    },
    {
      id: 'hug-001',
      title: 'Full Attention 🧐',
      desc: 'I will give you my full attention even if I am werking.',
      price: 1,
      badges: ['Comfort', 'Warmth'],
      image: './assets/img/attention.gif'
    },
    {
      id: 'attention-001',
      title: 'Complimentsss 🥰',
      desc: 'I will tell you how much I love you and why you are the bestesttt.',
      price: 1,
      badges: ['Focused', 'Cute'],
      image: './assets/img/compliment.gif'
    },
    {
      id: 'cuddle-001',
      title: 'Otpeeeeee 📲💵💳',
      desc: 'I will give you all OTPs without asking what they are for.',
      price: 2,
      badges: ['Cozy', 'Playlist'],
      image: './assets/img/otp.gif'
    },
    {
      id: 'movie-001',
      title: 'Vlog Time🍿',
      desc: 'I will watch whatever vlogs you want to watch with me.',
      price: 2,
      badges: ['Snacks', 'Cuddles'],
      image: './assets/img/watch.gif'
    },
    {
      id: 'game-001',
      title: 'Screen Share Shopping 🛒',
      desc: 'You show me dresses and I will do 👍👎',
      price: 2,
      badges: ['Fun', 'Competitive'],
      image: './assets/img/tonibear-bear.gif'
    }
  ];

  // Render products
  function renderProducts() {
    if (!productGrid) return;
    productGrid.innerHTML = products.map(p => {
      const initialQty = getQtyFor(p.id);
      return `
        <article class="product-card">
          <div class="product-media">
            <img src="${p.image}" alt="${p.title}">
          </div>
          <div class="product-info">
            <div class="product-title">${p.title}</div>
            <div class="product-desc">${p.desc}</div>
            <div class="product-meta">
              <button class="btn primary" data-add="${p.id}" ${initialQty > 0 ? 'hidden' : ''}>Add to Cart</button>
              <div class="qty-control" data-id="${p.id}" ${initialQty > 0 ? '' : 'hidden'}>
                <button class="qty-btn" data-minus="${p.id}" aria-label="Decrease quantity">−</button>
                <div class="qty-num" data-qty="${p.id}">${initialQty}</div>
                <button class="qty-btn" data-plus="${p.id}" aria-label="Increase quantity">+</button>
              </div>
            </div>
          </div>
        </article>
      `;
    }).join('');

    productGrid.addEventListener('click', (e) => {
      const addBtn = e.target.closest('[data-add]');
      if (addBtn) {
        const id = addBtn.getAttribute('data-add');
        const prod = products.find(p => p.id === id);
        if (!prod) return;
        window.CutieCart.addToCart({ id: prod.id, title: prod.title, price: prod.price, qty: 1 });
        updateCartBadge();
        updateQtyDisplay(id);
        updateControlsState(id);
        addBtn.classList.add('added');
        setTimeout(() => addBtn.classList.remove('added'), 700);
        return;
      }
      const plus = e.target.closest('[data-plus]');
      if (plus) {
        const id = plus.getAttribute('data-plus');
        const prod = products.find(p => p.id === id);
        if (!prod) return;
        window.CutieCart.addToCart({ id: prod.id, title: prod.title, price: prod.price, qty: 1 });
        updateCartBadge();
        updateQtyDisplay(id);
        updateControlsState(id);
        return;
      }
      const minus = e.target.closest('[data-minus]');
      if (minus) {
        const id = minus.getAttribute('data-minus');
        const items = window.CutieCart.getItems();
        const found = items.find(i => i.id === id);
        if (found) {
          const nextQty = (found.qty || 0) - 1;
          if (nextQty <= 0) {
            window.CutieCart.removeFromCart(id);
          } else {
            window.CutieCart.updateQty(id, nextQty);
          }
          updateCartBadge();
          updateQtyDisplay(id);
          updateControlsState(id);
        }
      }
    });
  }

  // Cart badge
  function updateCartBadge() {
    if (!cartCountEl) return;
    const count = window.CutieCart.getCartCount();
    cartCountEl.textContent = String(count);
  }

  function getQtyFor(productId) {
    const items = window.CutieCart.getItems();
    const found = items.find(i => i.id === productId);
    return found ? found.qty : 0;
  }

  function updateQtyDisplay(productId) {
    const qty = getQtyFor(productId);
    const numEl = productGrid && productGrid.querySelector(`[data-qty="${productId}"]`);
    if (numEl) numEl.textContent = String(qty);
  }

  function updateControlsState(productId) {
    const qty = getQtyFor(productId);
    const addBtn = productGrid && productGrid.querySelector(`[data-add="${productId}"]`);
    const qtyWrap = productGrid && productGrid.querySelector(`.qty-control[data-id="${productId}"]`);
    if (!addBtn || !qtyWrap) return;
    if (qty > 0) {
      addBtn.hidden = true; qtyWrap.hidden = false;
    } else {
      addBtn.hidden = false; qtyWrap.hidden = true;
    }
  }

  function syncAllQuantities() {
    if (!productGrid) return;
    const nums = productGrid.querySelectorAll('[data-qty]');
    nums.forEach((el) => {
      const id = el.getAttribute('data-qty');
      updateQtyDisplay(id);
      updateControlsState(id);
    });
  }

  // Carousel logic
  function initCarousel() {
    const carousel = document.getElementById('hero-carousel');
    if (!carousel) return;
    const slides = Array.from(carousel.querySelectorAll('.slide'));
    const dotsWrap = carousel.querySelector('.dots');
    const prev = carousel.querySelector('.prev');
    const next = carousel.querySelector('.next');
    let index = 0;
    let timer;

    function show(i) {
      index = (i + slides.length) % slides.length;
      slides.forEach((s, idx) => {
        const isActive = idx === index;
        s.classList.toggle('active', isActive);
        s.setAttribute('aria-hidden', String(!isActive));
      });
      const dots = dotsWrap.querySelectorAll('button');
      dots.forEach((d, di) => d.setAttribute('aria-selected', String(di === index)));
    }

    function startAuto() {
      stopAuto();
      timer = setInterval(() => show(index + 1), 4000);
    }
    function stopAuto() { if (timer) clearInterval(timer); }

    // Dots
    dotsWrap.innerHTML = slides.map((_, i) => `<button role="tab" aria-selected="${i===0}"></button>`).join('');
    dotsWrap.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const di = Array.from(dotsWrap.children).indexOf(btn);
      show(di);
      startAuto();
    });

    prev.addEventListener('click', () => { show(index - 1); startAuto(); });
    next.addEventListener('click', () => { show(index + 1); startAuto(); });

    carousel.addEventListener('mouseenter', stopAuto);
    carousel.addEventListener('mouseleave', startAuto);

    show(0);
    startAuto();
  }

  // Birthday countdown + reminder button
  function initBirthday() {
    const dEl = document.getElementById('bdayDays');
    const hEl = document.getElementById('bdayHours');
    const mEl = document.getElementById('bdayMins');
    const sEl = document.getElementById('bdaySecs');
    const btn = document.getElementById('bdayRemindBtn');
    if (!dEl || !hEl || !mEl || !sEl || !btn) return;

    function targetDate() {
      const now = new Date();
      const year = now.getMonth() > bday.month || (now.getMonth() === bday.month && now.getDate() > bday.day)
        ? now.getFullYear() + 1
        : now.getFullYear();
      return new Date(year, bday.month, bday.day, 0, 0, 0, 0);
    }

    function setNum(el, val) {
      if (el.textContent !== String(val)) {
        el.textContent = String(val);
        el.classList.remove('tick');
        void el.offsetWidth; // reflow to restart animation
        el.classList.add('tick');
      }
    }

    function tick() {
      const now = new Date();
      const t = targetDate();
      const diff = t.getTime() - now.getTime();
      const isBirthday = now.getMonth() === bday.month && now.getDate() === bday.day;
      if (diff <= 0 && isBirthday) {
        setNum(dEl, 0); setNum(hEl, 0); setNum(mEl, 0); setNum(sEl, 0);
        btn.hidden = false;
        btn.style.display = '';
        return;
      }
      // Not birthday today: ensure button stays hidden
      btn.hidden = true;
      btn.style.display = 'none';
      const sec = Math.floor(diff / 1000);
      const days = Math.floor(sec / 86400);
      const hours = Math.floor((sec % 86400) / 3600);
      const mins = Math.floor((sec % 3600) / 60);
      const secs = Math.floor(sec % 60);
      setNum(dEl, Math.max(0, days));
      setNum(hEl, Math.max(0, hours));
      setNum(mEl, Math.max(0, mins));
      setNum(sEl, Math.max(0, secs));
    }

    tick();
    const tmr = setInterval(tick, 1000);

    btn.addEventListener('click', async () => {
      try {
        if (!window.emailjs || !window.CutieConfig) return alert('Email service not ready');
        const { EMAILJS_PUBLIC_KEY, EMAILJS_SERVICE_ID, EMAILJS_BDAY_TEMPLATE_ID, NOTIFY_EMAIL } = window.CutieConfig;
        if (!EMAILJS_PUBLIC_KEY || !EMAILJS_SERVICE_ID || !EMAILJS_BDAY_TEMPLATE_ID) return alert('Birthday email not configured');
        window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
        const params = {
          to_email: NOTIFY_EMAIL || '',
          subject: 'It\'s her birthday today! 🎂',
          message: 'Reminder to buy a gift and plan something sweet today.',
          date: new Date().toDateString(),
        };
        await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_BDAY_TEMPLATE_ID, params);
        btn.textContent = 'Reminder Sent ✓';
        btn.disabled = true;
      } catch (e) {
        console.warn('Birthday email failed', e);
        alert('Could not send birthday reminder.');
      }
    });
  }

  // Init
  document.addEventListener('DOMContentLoaded', () => {
    renderProducts();
    updateCartBadge();
    initCarousel();
    initBirthday();
    syncAllQuantities();
  });
})();


