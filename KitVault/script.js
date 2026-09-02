document.addEventListener('DOMContentLoaded', () => {
    const nav = document.getElementById('site-nav');
    const menuToggle = document.getElementById('menu-toggle');
    const cartButton = document.getElementById('cart-button');
    const cartCount = document.getElementById('cart-count');
    const toast = document.getElementById('toast');

    let cart = [];
    let toastTimer = null;

    function updateCartCount() {
        if (!cartCount) return;
        cartCount.textContent = String(cart.length);
        cartCount.classList.remove('bump');
        void cartCount.offsetWidth;
        cartCount.classList.add('bump');
    }

    // Mobile menu toggle
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => {
            const isOpen = nav.classList.toggle('open');
            menuToggle.setAttribute('aria-expanded', String(isOpen));
        });

        nav.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => {
                nav.classList.remove('open');
                menuToggle.setAttribute('aria-expanded', 'false');
            });
        });
    }

    // Smooth-scroll buttons that target a section
    document.querySelectorAll('[data-scroll]').forEach((button) => {
        button.addEventListener('click', () => {
            const target = document.querySelector(button.getAttribute('data-scroll'));
            if (target) target.scrollIntoView({ behavior: 'smooth' });
        });
    });

    function showToast(message) {
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
    }

    // Category filter bar, search and sort (shop page only)
    const filterButtons = document.querySelectorAll('.filter-btn');
    const cards = document.querySelectorAll('#card-grid .card');
    const searchInput = document.getElementById('shirt-search');
    const sortSelect = document.getElementById('sort-select');
    const cardGrid = document.getElementById('card-grid');
    const noResults = document.getElementById('no-results');

    if (cardGrid && cards.length) {
        let activeFilter = 'all';

        function applyFilters() {
            const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
            let visibleCount = 0;

            cards.forEach((card) => {
                const matchesFilter = activeFilter === 'all'
                    || card.getAttribute('data-league') === activeFilter
                    || card.getAttribute('data-category') === activeFilter;
                const name = card.querySelector('h3').textContent.toLowerCase();
                const matchesSearch = !query || name.includes(query);
                const show = matchesFilter && matchesSearch;
                card.classList.toggle('is-hidden', !show);
                if (show) visibleCount += 1;
            });

            if (noResults) noResults.classList.toggle('visible', visibleCount === 0);
        }

        filterButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                filterButtons.forEach((b) => {
                    b.classList.remove('active');
                    b.setAttribute('aria-pressed', 'false');
                });
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
                activeFilter = btn.getAttribute('data-filter');
                applyFilters();
            });
        });

        if (searchInput) searchInput.addEventListener('input', applyFilters);

        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                const mode = sortSelect.value;
                const sorted = Array.from(cards);

                if (mode === 'price-asc') {
                    sorted.sort((a, b) => parseFloat(a.getAttribute('data-price')) - parseFloat(b.getAttribute('data-price')));
                } else if (mode === 'price-desc') {
                    sorted.sort((a, b) => parseFloat(b.getAttribute('data-price')) - parseFloat(a.getAttribute('data-price')));
                } else if (mode === 'name-asc') {
                    sorted.sort((a, b) => a.querySelector('h3').textContent.localeCompare(b.querySelector('h3').textContent));
                } else {
                    sorted.sort((a, b) => a.dataset.originalOrder - b.dataset.originalOrder);
                }

                sorted.forEach((card) => cardGrid.appendChild(card));
            });
        }

        cards.forEach((card, i) => { card.dataset.originalOrder = i; });

        // Scroll-reveal animation for cards
        if ('IntersectionObserver' in window) {
            cards.forEach((card, i) => {
                card.classList.add('reveal');
                card.style.transitionDelay = `${Math.min(i % 6, 5) * 0.06}s`;
            });

            const revealObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('in-view');
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.15 });

            cards.forEach((card) => revealObserver.observe(card));
        }
    }

    // Quick-view modal: opens on click, shows image/price/size, buys via Stripe when available
    const modalOverlay = document.getElementById('modal-overlay');
    const modalClose = document.getElementById('modal-close');
    const modalImg = document.getElementById('modal-img');
    const modalThumbs = document.getElementById('modal-thumbs');
    const modalTag = document.getElementById('modal-tag');
    const modalTitle = document.getElementById('modal-title');
    const modalPrice = document.getElementById('modal-price');
    const modalSize = document.getElementById('modal-size');
    const modalAdd = document.getElementById('modal-add');

    let activeProduct = null;
    let activeStripeLink = null;

    if (modalOverlay && modalAdd) {
        function setModalImage(src, alt) {
            modalImg.src = src;
            modalImg.alt = alt;
            if (modalThumbs) {
                modalThumbs.querySelectorAll('button').forEach((btn) => {
                    btn.classList.toggle('active', btn.getAttribute('data-src') === src);
                });
            }
        }

        function openModal(card, button) {
            const product = button.getAttribute('data-product');
            const price = button.getAttribute('data-price');
            const stripeLink = button.getAttribute('data-stripe-link');
            const img = card.querySelector('.card-image img');
            const tag = card.querySelector('.tag');
            const sizeSelect = card.querySelector('.size-select');
            const galleryAttr = card.getAttribute('data-gallery');
            const galleryImages = galleryAttr ? galleryAttr.split(',').map((s) => s.trim()).filter(Boolean) : [];

            activeProduct = product;
            activeStripeLink = stripeLink || null;

            const firstSrc = galleryImages[0] || (img ? img.src : '');
            setModalImage(firstSrc, img ? img.alt : product);

            if (modalThumbs) {
                modalThumbs.innerHTML = '';
                if (galleryImages.length > 1) {
                    galleryImages.forEach((src) => {
                        const thumbBtn = document.createElement('button');
                        thumbBtn.type = 'button';
                        thumbBtn.setAttribute('data-src', src);
                        thumbBtn.setAttribute('aria-label', `Show ${product} photo`);
                        thumbBtn.innerHTML = `<img src="${src}" alt="">`;
                        thumbBtn.addEventListener('click', () => setModalImage(src, product));
                        modalThumbs.appendChild(thumbBtn);
                    });
                    modalThumbs.classList.add('visible');
                } else {
                    modalThumbs.classList.remove('visible');
                }
            }

            modalTag.textContent = tag ? tag.textContent : '';
            modalTag.className = tag ? `tag ${tag.classList[1] || ''}` : 'tag';
            modalTitle.textContent = product;
            modalPrice.textContent = `£${price}`;
            modalSize.innerHTML = sizeSelect ? sizeSelect.innerHTML : '';
            modalAdd.textContent = activeStripeLink ? 'Buy Now' : 'Add to Cart';

            modalOverlay.classList.add('visible');
        }

        function closeModal() {
            modalOverlay.classList.remove('visible');
            activeProduct = null;
            activeStripeLink = null;
        }

        modalClose.addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modalOverlay.classList.contains('visible')) closeModal();
        });

        document.querySelectorAll('.btn-card:not(:disabled)').forEach((button) => {
            button.addEventListener('click', () => {
                const card = button.closest('.card');
                if (card) openModal(card, button);
            });
        });

        modalAdd.addEventListener('click', () => {
            if (!activeProduct) return;
            const size = modalSize.value;
            const price = modalPrice.textContent.replace('£', '');

            cart.push({
                id: `${activeProduct}-${size}-${Date.now()}`,
                product: activeProduct,
                price: parseFloat(price) || 0,
                size,
                img: modalImg.src,
                stripeLink: activeStripeLink
            });
            updateCartCount();

            if (activeStripeLink) {
                showToast(`Redirecting to secure payment for ${activeProduct}…`);
                window.open(activeStripeLink, '_blank', 'noopener');
            } else {
                showToast(size ? `${activeProduct} (Size ${size}) added to your cart` : `${activeProduct} added to your cart`);
            }

            closeModal();
        });
    }

    // Cart drawer: lists picked items, each with its own real Stripe Buy Now link
    const cartOverlay = document.getElementById('cart-overlay');
    const cartClose = document.getElementById('cart-close');
    const cartItemsEl = document.getElementById('cart-items');
    const cartSubtotalEl = document.getElementById('cart-subtotal');

    if (cartOverlay) {
        function formatPrice(n) {
            return `£${n.toFixed(2)}`;
        }

        function renderCart() {
            cartItemsEl.innerHTML = '';
            const subtotal = cart.reduce((sum, item) => sum + item.price, 0);

            cartOverlay.classList.toggle('is-empty', cart.length === 0);

            cart.forEach((item) => {
                const row = document.createElement('div');
                row.className = 'cart-item';
                row.innerHTML = `
                    <div class="cart-item-img"><img src="${item.img}" alt="${item.product}"></div>
                    <div class="cart-item-info">
                        <h4>${item.product}</h4>
                        <div class="cart-item-meta">Size ${item.size} &middot; ${formatPrice(item.price)}</div>
                        ${item.stripeLink ? `<a class="cart-item-buy" href="${item.stripeLink}" target="_blank" rel="noopener">Buy Now &rarr;</a>` : ''}
                    </div>
                    <button class="cart-item-remove" type="button" aria-label="Remove ${item.product}">&times;</button>
                `;
                row.querySelector('.cart-item-remove').addEventListener('click', () => {
                    cart = cart.filter((c) => c.id !== item.id);
                    updateCartCount();
                    renderCart();
                });
                cartItemsEl.appendChild(row);
            });

            cartSubtotalEl.textContent = formatPrice(subtotal);
        }

        function openCart() {
            renderCart();
            cartOverlay.classList.add('visible');
        }

        function closeCart() {
            cartOverlay.classList.remove('visible');
        }

        cartClose.addEventListener('click', closeCart);
        cartOverlay.addEventListener('click', (e) => {
            if (e.target === cartOverlay) closeCart();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && cartOverlay.classList.contains('visible')) closeCart();
        });

        if (cartButton) cartButton.addEventListener('click', openCart);
    } else if (cartButton) {
        // On pages without the cart drawer (legal pages, 404), send people back to the shop
        cartButton.addEventListener('click', () => {
            window.location.href = 'index.html#kits';
        });
    }
});
