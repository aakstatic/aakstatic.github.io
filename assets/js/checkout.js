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

  // Persist dry-run across navigation if provided via URL
  (function syncDryRunFromUrlParam() {
    try {
      const q = new URLSearchParams(location.search);
      const v = q.get('dry');
      if (v === '1') localStorage.setItem('cutie.dry_run', '1');
      if (v === '0') localStorage.setItem('cutie.dry_run', '0');
    } catch (_) {}
  })();

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

  // Determine if we should simulate (no EmailJS calls)
  function isDryRun() {
    try {
      const cfg = window.CutieConfig || {};
      const params = new URLSearchParams(location.search);
      if (params.get('dry') === '1') return true;
      if (params.get('dry') === '0') return false;
      if (localStorage.getItem('cutie.dry_run') === '1') return true;
      if (cfg && cfg.EMAILJS_DRY_RUN === true) return true;
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return true;
    } catch (_) {}
    return false;
  }

  function updateCartBadge() {
    if (cartCountEl) cartCountEl.textContent = String(window.CutieCart.getCartCount());
  }

  function getAppliedCoupons() { return Array.from(appliedCoupons); }

  function updateCouponStatus() {
    if (!couponStatus) return;
    const applied = getAppliedCoupons();
    // Update primary button label
    if (applyCouponBtn) applyCouponBtn.textContent = applied.length ? `Applied: ${applied.join(', ')}` : 'Apply Coupon';
    // Grey out payment options when any coupon is applied
    if (paymentOptions) {
      if (applied.length > 0) paymentOptions.classList.add('greyed-out');
      else paymentOptions.classList.remove('greyed-out');
    }
    // Reflect state inside popup buttons
    const princessBtn = document.querySelector('.apply-btn[data-coupon="princess"]');
    if (princessBtn) {
      const isApplied = applied.includes('PRINCESS');
      princessBtn.textContent = isApplied ? 'Remove' : 'Apply';
      princessBtn.classList.toggle('applied-coupon', isApplied);
    }
    const wifeyBtn = document.querySelector('.apply-btn[data-coupon="wifey"]');
    if (wifeyBtn) {
      wifeyBtn.textContent = 'Locked';
      wifeyBtn.disabled = true;
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
    showLoading(true, 'Sending order…');
    // Simulate when dry-run is enabled
    if (isDryRun()) {
      console.debug('[CutieCart] DRY RUN: order payload', order);
      setStatus('Simulated send (dry-run). No EmailJS credits used.', false);
      await new Promise(r => setTimeout(r, 7000));
      showLoading(false);
      return { dryRun: true };
    }
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
      .catch((err) => { setStatus('Email send failed. Check console and config.', true); console.warn('[CutieCart] EmailJS error', err); throw err; })
      .finally(() => { showLoading(false); });
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
      // Keep popup open so user can remove/undo immediately
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
        const proceed = () => {
          sessionStorage.setItem('cutiecart.lastOrderId', order.id);
          window.CutieCart.clearCart();
          window.location.href = './confirm.html';
        };
        if (result && result.skipped) {
          showLoadingDone('Email skipped (config). Close to continue.', proceed);
          return;
        }
        showLoadingDone('Order placed! Sit back and watch the peasant(me) work for you.', proceed);
        return;
      } catch (err) {
        console.warn('Email failed', err);
        const btnReset = () => { const b = document.getElementById('placeOrderBtn'); if (b) { b.disabled = false; b.textContent = 'Place Order 💝'; } };
        showLoadingDone('Email failed. Close to continue.', btnReset);
        return;
      }
    });
  });

  // Loading overlay helpers
  let loadingCloseCb = null;
  function ensureOverlay() {
    let el = document.getElementById('cutie-loading');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cutie-loading';
      el.className = 'loading-overlay';
      el.hidden = true;
      el.innerHTML = '<div><img class="loading-gif" src="./assets/img/drive.gif" alt="Loading"/><div class="loading-text">Please wait…</div><div class="loading-actions" style="margin-top:10px;"><button id="cutie-loading-close" class="btn" style="display:none;">Close</button></div></div>';
      document.body.appendChild(el);
      const closeBtn = el.querySelector('#cutie-loading-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          el.hidden = true;
          if (typeof loadingCloseCb === 'function') { const cb = loadingCloseCb; loadingCloseCb = null; cb(); }
        });
      }
    }
    return el;
  }
  function showLoading(show, text) {
    const el = ensureOverlay();
    if (typeof text === 'string') {
      const t = el.querySelector('.loading-text');
      if (t) t.textContent = text;
    }
    const img = el.querySelector('.loading-gif');
    if (img && show) { img.src = './assets/img/drive.gif'; }
    const spinner = img || el.querySelector('.spinner');
    const closeBtn = el.querySelector('#cutie-loading-close');
    if (spinner) spinner.style.display = show ? 'block' : 'none';
    if (closeBtn) closeBtn.style.display = 'none';
    el.hidden = !show;
  }
  function showLoadingDone(text, onClose) {
    const el = ensureOverlay();
    const t = el.querySelector('.loading-text');
    const img = el.querySelector('.loading-gif');
    const closeBtn = el.querySelector('#cutie-loading-close');
    if (t) t.textContent = text || 'Done.';
    if (img) { img.src = './assets/img/sent.gif'; img.style.display = 'block'; }
    if (closeBtn) closeBtn.style.display = 'inline-flex';
    el.hidden = false;
    loadingCloseCb = typeof onClose === 'function' ? onClose : null;
  }
})();


