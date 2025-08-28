/* CutieCart - checkout page logic + EmailJS integration */
(function() {
  'use strict';

  const cartCountEl = document.getElementById('cart-count');
  const summaryWrap = document.getElementById('cartSummary');
  const summaryTotal = null;
  const form = document.getElementById('checkoutForm');
  const couponStatus = document.getElementById('couponStatus');
  const applyCouponBtn = document.getElementById('applyCouponBtn');
  const couponPopup = document.getElementById('couponPopup');
  const closeCouponPopup = document.getElementById('closeCouponPopup');
  const paymentOptions = document.getElementById('paymentOptions');
  const appliedCoupons = new Set();
  const customerNameEl = document.getElementById('customerName');
  const nameEditMsg = document.getElementById('nameEditMsg');
  const deliveryDateEl = document.getElementById('deliveryDate');
  const deliveryTimeEl = document.getElementById('deliveryTime');
  let statusEl;

  function pad2(n) { return String(n).padStart(2, '0'); }
  function setDefaultDeliveryIfEmpty() {
    // Set today's date (local) and next full hour as defaults if empty
    if (deliveryDateEl && !deliveryDateEl.value) {
      const now = new Date();
      const tzOffsetMs = now.getTimezoneOffset() * 60000;
      const localISO = new Date(now.getTime() - tzOffsetMs).toISOString();
      deliveryDateEl.value = localISO.slice(0, 10);
    }
    if (deliveryTimeEl && !deliveryTimeEl.value) {
      const now = new Date();
      let hh = now.getHours() + 1;
      if (hh > 23) hh = 23;
      deliveryTimeEl.value = `${pad2(hh)}:00`;
    }
  }

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

  function getAppliedCoupons() { return Array.from(appliedCoupons); }

  function updateCouponStatus() {
    if (!couponStatus) return;
    const applied = getAppliedCoupons();
    // couponStatus.textContent = applied.length ? `Applied: ${applied.join(' · ')}` : 'No coupon applied';
    if (applyCouponBtn) applyCouponBtn.textContent = applied.length ? `Applied: ${applied.join(', ')}` : 'Apply Coupon';
    if (paymentOptions) {
      if (applied.length > 0) paymentOptions.classList.add('greyed-out');
      else paymentOptions.classList.remove('greyed-out');
    }
  }

  function renderSummary() {
    if (!summaryWrap) return;
    const items = window.CutieCart.getItems();
    if (!items.length) {
      summaryWrap.innerHTML = '<p>Your cart is empty. Go add some cuteness! 💗</p>';
      return;
    }
    summaryWrap.innerHTML = items.map(i => `
      <div class="summary-item">
        <span class="summary-title">${i.title}</span>
        <span class="summary-qty">× ${i.qty}</span>
      </div>
    `).join('');
    // Total removed since there is no currency; count remains visible per item lines
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
      delivery_date: order.deliveryDate || '',
      delivery_time: order.deliveryTime || '',
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
    // Popup controls
    if (applyCouponBtn) applyCouponBtn.addEventListener('click', () => { if (couponPopup) couponPopup.hidden = false; });
    if (closeCouponPopup) closeCouponPopup.addEventListener('click', () => { if (couponPopup) couponPopup.hidden = true; });
    if (couponPopup) couponPopup.addEventListener('click', (e) => { if (e.target === couponPopup) couponPopup.hidden = true; });

    // Apply/remove inside popup
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.apply-btn');
      if (!btn) return;
      const which = btn.getAttribute('data-coupon');
      if (which === 'princess') { appliedCoupons.has('PRINCESS') ? appliedCoupons.delete('PRINCESS') : appliedCoupons.add('PRINCESS'); }
      if (which === 'wifey') { /* locked */ }
      updateCouponStatus();
      renderSummary();
      if (couponPopup) couponPopup.hidden = true;
    });
    updateCartBadge();
    renderSummary();
    updateCouponStatus();
    setDefaultDeliveryIfEmpty();

    // Lock name to Pratibha and show message when changed
    if (customerNameEl) {
      const resetName = () => { if (customerNameEl.value !== 'Pratibha') customerNameEl.value = 'Pratibha'; };
      customerNameEl.addEventListener('input', () => { resetName(); if (nameEditMsg) nameEditMsg.hidden = false; });
      customerNameEl.addEventListener('keydown', () => { if (nameEditMsg) nameEditMsg.hidden = false; });
      customerNameEl.addEventListener('focus', () => { if (nameEditMsg) nameEditMsg.hidden = true; });
      customerNameEl.addEventListener('blur', () => { if (nameEditMsg) nameEditMsg.hidden = true; });
    }

    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const items = window.CutieCart.getItems();
      if (!items.length) {
        alert('Cart is empty, cutie! Add some love first 💗');
        return;
      }

      const data = new FormData(form);
      const name = 'Pratibha';
      const email = '';
      const payment = String(data.get('payment') || '').trim();
      const note = String(data.get('note') || '').trim();
      // Ensure defaults if user cleared inputs
      setDefaultDeliveryIfEmpty();
      const deliveryDate = deliveryDateEl && deliveryDateEl.value ? deliveryDateEl.value : '';
      const deliveryTime = deliveryTimeEl && deliveryTimeEl.value ? deliveryTimeEl.value : '';

      const paymentOptions = {
        'time-with-me': '🤤 Seggsy time',
        'gaming-date': '🎮 Play games',
        'movie-night': '🎬 Watch movie',
      };

      const appliedCouponsList = getAppliedCoupons();
      const basePaymentLabel = paymentOptions[payment] || payment;
      const paymentLabelFinal = appliedCouponsList.length
        ? `Not applicable (Free via ${appliedCouponsList.join(', ')})`
        : basePaymentLabel;

      const order = {
        id: makeOrderId(),
        name, email, payment, paymentLabel: paymentLabelFinal,
        note, items, total: window.CutieCart.getCartTotal(),
        createdAt: new Date().toISOString(),
        coupons: appliedCouponsList,
        deliveryDate, deliveryTime,
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


