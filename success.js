document.addEventListener('DOMContentLoaded', () => {
  const loading = document.getElementById('order-loading'); const details = document.getElementById('order-details');
  const error = document.getElementById('order-error'); const retry = document.getElementById('order-retry');
  async function check() {
    loading.hidden = false; error.hidden = true; retry.hidden = true;
    const id = new URLSearchParams(location.search).get('session_id');
    try {
      if (!id) throw new Error('No order reference was provided. No payment is confirmed on this page.');
      await window.KitVLTBasket.ready;
      const response = await fetch('/.netlify/functions/get-order?session_id=' + encodeURIComponent(id));
      const order = await response.json();
      if (!response.ok) throw new Error(order.error || 'Unable to verify your order right now.');
      if (!order.paid) throw new Error(order.message);
      document.getElementById('order-heading').textContent = 'Your shirts are coming.';
      document.getElementById('confirm-icon').hidden = false;
      document.getElementById('order-items').replaceChildren();
      for (const item of order.items) {
        const row = document.createElement('li');
        row.textContent = `${item.name} — Size ${item.size} × ${item.quantity} · ${window.KitVLTMoney(item.price * item.quantity)}`;
        document.getElementById('order-items').appendChild(row);
      }
      document.getElementById('order-total').textContent = window.KitVLTMoney(order.total);
      document.getElementById('order-ref').textContent = 'Order reference: ' + order.orderId;
      document.getElementById('order-email').textContent = 'Customer email: ' + order.email;
      const customer = order.customer;
      const actual = customer.shipping;
      document.getElementById('order-address').textContent = actual ? `Ship to: ${actual.name}, ${[actual.address.line1, actual.address.line2, actual.address.city, actual.address.postal_code, actual.address.country].filter(Boolean).join(', ')}` : `Ship to: ${[customer.name, customer.line1, customer.line2, customer.city, customer.postalCode, customer.country].filter(Boolean).join(', ')}`;
      document.getElementById('order-breakdown').textContent = `Shirts ${window.KitVLTMoney(order.subtotal)} · Discount −${window.KitVLTMoney(order.discount)} · Delivery ${window.KitVLTMoney(order.shipping)}`;
      details.hidden = false;
      await window.KitVLTBasket.refresh();
    } catch (problem) {
      document.getElementById('order-heading').textContent = 'Order status';
      error.textContent = problem.message; error.hidden = false; retry.hidden = false;
    } finally { loading.hidden = true; }
  }
  retry.addEventListener('click', check); check();
});
