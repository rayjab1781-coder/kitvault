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
        // Force reflow so the animation can replay on rapid consecutive adds
        void cartCount.offsetWidth;
        cartCount.classList.add('bump');
    }

    // Mobile menu toggle
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => {
            const isOpen = nav.classList.toggle('open');
            menuToggle.setAttribute('aria-expanded', String(isOpen));
        });

        // Close mobile menu after choosing a link
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
        toastTimer = setTimeout(() => toast.classList.remove('visible'), 2200);
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
                const cardLeague = card.getAttribute('data-league');
                const cardCategory = card.getAttribute('data-category');
                const matchesFilter = activeFilter === 'all' || cardLeague === activeFilter || cardCategory === activeFilter;
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
                filterButtons.forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
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

        // Scroll-reveal animation for cards (skipped gracefully if IntersectionObserver isn't available)
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

    // Quick-view modal: "View Kit" opens a popup with image, price, and sizing (shop page only)
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
            const img = card.querySelector('.card-image img');
            const tag = card.querySelector('.tag');
            const sizeSelect = card.querySelector('.size-select');
            const galleryAttr = card.getAttribute('data-gallery');
            const galleryImages = galleryAttr ? galleryAttr.split(',').map((s) => s.trim()).filter(Boolean) : [];

            activeProduct = product;

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

            // Mirror the card's size options (including which are out of stock)
            modalSize.innerHTML = sizeSelect ? sizeSelect.innerHTML : '';

            modalOverlay.classList.add('visible');
        }

        function closeModal() {
            modalOverlay.classList.remove('visible');
            activeProduct = null;
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
                img: modalImg.src
            });
            updateCartCount();
            showToast(size ? `${activeProduct} (Size ${size}) added to your cart` : `${activeProduct} added to your cart`);
            closeModal();
        });
    }

    // Cart drawer + checkout flow (shop page only)
    const cartOverlay = document.getElementById('cart-overlay');
    const cartClose = document.getElementById('cart-close');
    const cartItemsEl = document.getElementById('cart-items');
    const cartSubtotalEl = document.getElementById('cart-subtotal');
    const checkoutSubtotalEl = document.getElementById('checkout-subtotal');
    const checkoutTotalEl = document.getElementById('checkout-total');
    const cartCheckoutBtn = document.getElementById('cart-checkout-btn');
    const checkoutBack = document.getElementById('checkout-back');
    const checkoutForm = document.getElementById('checkout-form');
    const confirmNumber = document.getElementById('confirm-number');
    const confirmContinue = document.getElementById('confirm-continue');

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
            checkoutSubtotalEl.textContent = formatPrice(subtotal);
            checkoutTotalEl.textContent = formatPrice(subtotal);
        }

        function openCart() {
            renderCart();
            cartOverlay.classList.remove('show-checkout', 'show-confirm');
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

        cartCheckoutBtn.addEventListener('click', () => {
            if (cart.length === 0) return;
            cartOverlay.classList.add('show-checkout');
        });

        checkoutBack.addEventListener('click', () => {
            cartOverlay.classList.remove('show-checkout');
        });

        checkoutForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // Demo checkout only: no payment gateway is connected, nothing is charged
            // or transmitted anywhere. A real store would send this to a payment
            // processor (e.g. Stripe) from a secure backend at this point.
            const orderNumber = `KV-${Math.floor(100000 + Math.random() * 900000)}`;
            confirmNumber.textContent = orderNumber;
            cartOverlay.classList.add('show-confirm');
        });

        confirmContinue.addEventListener('click', () => {
            cart = [];
            updateCartCount();
            checkoutForm.reset();
            closeCart();
            cartOverlay.classList.remove('show-checkout', 'show-confirm');
        });
    } else if (cartButton) {
        // On pages without the cart drawer (legal pages, 404), send people back to the shop
        cartButton.addEventListener('click', () => {
            window.location.href = 'index.html#kits';
        });
    }
});
