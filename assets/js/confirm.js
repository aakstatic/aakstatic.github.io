/* CutieCart - confirmation confetti hearts and order id */
(function() {
  'use strict';

  function heartConfetti() {
    const confetti = document.getElementById('confetti');
    if (!confetti) return;
    const hearts = ['💗','💖','💕','💞','💓','💘'];
    const count = 40;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'heart-piece';
      el.textContent = hearts[Math.floor(Math.random() * hearts.length)];
      el.style.left = Math.random() * 100 + 'vw';
      el.style.animationDelay = (Math.random() * 2) + 's';
      el.style.opacity = String(0.6 + Math.random() * 0.4);
      confetti.appendChild(el);
      setTimeout(() => el.remove(), 8000);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const orderId = sessionStorage.getItem('cutiecart.lastOrderId') || 'CUTIE-LOVE';
    const orderEl = document.getElementById('orderId');
    if (orderEl) orderEl.textContent = orderId;
    heartConfetti();
  });
})();


