/* CutieCart - simple cart via localStorage */
(function() {
  'use strict';

  const STORAGE_KEY = 'cutiecart.cart.v1';

  function readCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('Cart read failed', e);
      return [];
    }
  }

  function writeCart(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Cart write failed', e);
    }
  }

  function addToCart(item) {
    const items = readCart();
    const found = items.find(i => i.id === item.id);
    if (found) {
      found.qty += item.qty || 1;
    } else {
      items.push({ id: item.id, title: item.title, price: item.price, qty: item.qty || 1 });
    }
    writeCart(items);
  }

  function removeFromCart(id) {
    const items = readCart().filter(i => i.id !== id);
    writeCart(items);
  }

  function updateQty(id, qty) {
    const items = readCart();
    const found = items.find(i => i.id === id);
    if (found) {
      found.qty = Math.max(1, qty);
      writeCart(items);
    }
  }

  function clearCart() {
    writeCart([]);
  }

  function getCartCount() {
    return readCart().reduce((sum, i) => sum + (i.qty || 0), 0);
  }

  function getCartTotal() {
    return readCart().reduce((sum, i) => sum + (i.price * i.qty), 0);
  }

  function getItems() {
    return readCart();
  }

  window.CutieCart = {
    addToCart, removeFromCart, updateQty, clearCart, getCartCount, getCartTotal, getItems
  };
})();


