document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('review-form');
  const list = document.getElementById('review-list');
  if (!form || !list) return;
  const loadReviews = async () => {
    list.textContent = 'Loading approved reviews…';
    try {
      const response = await fetch('/.netlify/functions/reviews');
      const result = await response.json();
      if (!response.ok) throw new Error('Reviews are temporarily unavailable. Please try again.');
      list.replaceChildren();
      if (!result.reviews.length) { list.textContent = 'No published reviews yet. Share your experience with KitVLT.'; return; }
      result.reviews.forEach((review) => {
        const entry = document.createElement('article'); entry.className = 'customer-review';
        const name = document.createElement('h3'); name.textContent = review.displayName;
        const rating = document.createElement('p'); rating.className = 'review-stars'; rating.setAttribute('aria-label', `${review.rating} out of 5 stars`); rating.textContent = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
        const text = document.createElement('p'); text.className = 'review-text'; text.textContent = review.review;
        entry.append(name, rating, text); list.append(entry);
      });
    } catch (error) {
      list.textContent = error.message;
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'text-button'; retry.textContent = 'Try again'; retry.addEventListener('click', loadReviews); list.append(retry);
    }
  };
  loadReviews();
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]'); const status = document.getElementById('review-status');
    button.disabled = true; status.textContent = 'Submitting your review…';
    try {
      const response = await fetch('/.netlify/functions/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: form.elements.displayName.value, rating: Number(form.elements.rating.value), review: form.elements.review.value, website: form.elements.website.value }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Your review could not be saved. Please try again.');
      status.textContent = result.message; form.reset();
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });
});
