/* CutieCart - checkout page logic + EmailJS integration */
(function() {
  'use strict';

  const cartCountEl = document.getElementById('cart-count');
  const summaryWrap = document.getElementById('cartSummary');
  const summaryTotal = document.getElementById('summaryTotal');
  const form = document.getElementById('checkoutForm');
  const couponPrincess = document.getElementById('coupon_princess');
  const couponWifey = document.getElementById('coupon_dawifey');
  const couponStatus = document.getElementById('couponStatus');
  let statusEl;

  function setStatus(message, isError) {
    if (!form) return;
    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.id = 'emailStatus';
      statusEl.style.marginTop = '8px';
      statusEl.style.padding = '10px 12px';
      statusEl.style.borderRadius = '10px';
      statusEl.style.fontWeight = '700';
      form.appendChild(statusEl);
    }
    statusEl.textContent = message;
    statusEl.style.background = isError ? '#ffe0e6' : '#e8fff0';
    statusEl.style.border = `1px solid ${isError ? '#ffadc0' : '#9ae6b4'}`;
    statusEl.style.color = isError ? '#8f0f51' : '#166534';
  }

  function updateCartBadge() {
    if (cartCountEl) cartCountEl.textContent = String(window.CutieCart.getCartCount());
  }

  function getAppliedCoupons() {
    const list = [];
    if (couponPrincess && couponPrincess.checked) list.push('PRINCESS');
    if (couponWifey && couponWifey.checked) list.push('DaWifey');
    return list;
  }

  function updateCouponStatus() {
    if (!couponStatus) return;
    const applied = getAppliedCoupons();
    couponStatus.textContent = applied.length ? `Applied: ${applied.join(' · ')}` : 'No coupon applied';
  }

  function renderSummary() {
    if (!summaryWrap || !summaryTotal) return;
    const items = window.CutieCart.getItems();
    if (!items.length) {
      summaryWrap.innerHTML = '<p>Your cart is empty. Go add some cuteness! 💗</p>';
      summaryTotal.textContent = '❤ 0';
      return;
    }
    summaryWrap.innerHTML = items.map(i => `
      <div class="summary-item">
        <span>${i.title} × ${i.qty}</span>
      </div>
    `).join('');
    const base = window.CutieCart.getCartTotal();
    const applied = getAppliedCoupons();
    const label = applied.length ? ` (coupons: ${applied.join(', ')})` : '';
    summaryTotal.textContent = `${base} items${label}`;
  }

  function makeOrderId() {
    return 'CUTIE-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  async function sendEmail(order) {
    // Ensure EmailJS is available
    if (!window.emailjs) {
      setStatus('Email service not loaded. Trying to load and send again…', true);
      await new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
        s.async = true;
        s.onload = resolve;
        s.onerror = resolve;
        document.head.appendChild(s);
      });
    }

    if (!window.CutieConfig) {
      setStatus('Email config missing (CutieConfig).', true);
      return { skipped: true };
    }

    const { EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, NOTIFY_EMAIL } = window.CutieConfig;
    if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
      setStatus('Email not configured. Please set PUBLIC KEY, SERVICE ID, TEMPLATE ID.', true);
      return { skipped: true };
    }

    try {
      if (window.emailjs) {
        if (typeof window.emailjs.init === 'function') {
          window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
        }
      }
    } catch (_) {}

    const params = {
      to_email: NOTIFY_EMAIL || '',
      order_id: order.id,
      buyer_name: order.name,
      buyer_email: order.email,
      payment_method: order.paymentLabel,
      note: order.note || '',
      items: order.items.map(i => `${i.title} x ${i.qty}`).join('\n'),
      total: `${order.total} items`,
      coupons: (order.coupons || []).join(', '),
    };
    if (!window.emailjs) {
      setStatus('Email service failed to load. Check network/CORS.', true);
      return { skipped: true };
    }
    console.debug('[CutieCart] Sending email with params:', params);
    return window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params)
      .then((res) => { setStatus('Order email sent successfully ✓', false); console.debug('[CutieCart] EmailJS success:', res); return res; })
      .catch((err) => { setStatus('Email send failed. Check console and config.', true); console.warn('[CutieCart] EmailJS error', err); throw err; });
  }

  document.addEventListener('DOMContentLoaded', () => {
    updateCartBadge();
    renderSummary();
    if (couponPrincess) couponPrincess.addEventListener('change', () => { updateCouponStatus(); renderSummary(); });
    if (couponWifey) couponWifey.addEventListener('change', () => { updateCouponStatus(); renderSummary(); });
    updateCouponStatus();

    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const items = window.CutieCart.getItems();
      if (!items.length) {
        alert('Cart is empty, cutie! Add some love first 💗');
        return;
      }

      const data = new FormData(form);
      const name = '';
      const email = '';
      const payment = String(data.get('payment') || '').trim();
      const note = String(data.get('note') || '').trim();

      const paymentOptions = {
        'time-with-me': '⏰ Quality time together',
        'gaming-date': '🎮 Gaming date',
        'movie-night': '🎬 Movie night',
        'walk-and-talk': '🚶 Walk & talk',
        'surprise-date': '🎁 Surprise date',
      };

      const order = {
        id: makeOrderId(),
        name, email, payment, paymentLabel: paymentOptions[payment] || payment,
        note, items, total: window.CutieCart.getCartTotal(),
        createdAt: new Date().toISOString(),
        coupons: getAppliedCoupons(),
      };

      const btn = document.getElementById('placeOrderBtn');
      if (btn) { btn.disabled = true; btn.textContent = 'Placing order…'; }

      try {
        const result = await sendEmail(order);
        if (result && result.skipped) {
          alert('Email sending skipped due to configuration. Please check config.js.');
        }
      } catch (err) {
        console.warn('Email failed', err);
      }

      // Persist last order id for confirmation page
      sessionStorage.setItem('cutiecart.lastOrderId', order.id);
      window.CutieCart.clearCart();
      window.location.href = './confirm.html';
    });
  });
})();


