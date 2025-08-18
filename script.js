// ATENÇÃO: Cole aqui o mesmo objeto firebaseConfig que você usou no admin.js
const firebaseConfig = {
    apiKey: "AIzaSyALdTRDfbHFM4Geq5iIGaJ2tFrLi_pqWik",
    authDomain: "acai-do-heitor-b3054.firebaseapp.com",
    projectId: "acai-do-heitor-b3054",
    storageBucket: "acai-do-heitor-b3054.appspot.com",
    messagingSenderId: "1015413255115",
    appId: "1:1015413255115:web:0a6a6983e4f073e702e44e",
    measurementId: "G-1H5JT000KK"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();


document.addEventListener('DOMContentLoaded', () => {

    console.log("DOM carregado. Iniciando script...");

    // --- FUNÇÕES PARA CARREGAR CONTEÚDO DINÂMICO (MOVIDAS PARA CÁ) ---

    function loadBranding() {
        db.collection('siteContent').doc('branding').get().then(doc => {
            if (doc.exists && doc.data().logoUrl) {
                const logoElement = document.getElementById('logo-img');
                if (logoElement) {
                    logoElement.src = doc.data().logoUrl;
                }
            }
        });
    }

    function loadHeroContent() {
        db.collection('siteContent').doc('heroSection').get()
            .then(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    const heroTitleElement = document.getElementById('hero-title');
                    const heroSubtitleElement = document.getElementById('hero-subtitle');

                    if (heroTitleElement && data.title) {
                        heroTitleElement.innerHTML = data.title;
                    }
                    if (heroSubtitleElement && data.subtitle) {
                        heroSubtitleElement.textContent = data.subtitle;
                    }
                }
            });
    }

    function loadProducts() {
        const productListContainer = document.querySelector('.product-list');
        if (!productListContainer) return;

        db.collection('products').orderBy('name').get().then(snapshot => {
            productListContainer.innerHTML = ''; // Limpa a lista estática
            snapshot.forEach(doc => {
                const product = doc.data();
                const productEl = document.createElement('div');
                productEl.className = 'product-item animate-on-scroll';
                productEl.dataset.category = product.category;
                productEl.dataset.name = product.name;
                productEl.dataset.price = product.price.toFixed(2);

                const buttonText = product.category === 'acai' ? 'Personalizar' : 'Adicionar';

                productEl.innerHTML = `
                    <div class="product-info">
                        <img src="${product.imageUrl}" alt="${product.name}">
                        <div class="product-details">
                            <h3>${product.name}</h3>
                            <p class="price">R$ ${product.price.toFixed(2)}</p>
                        </div>
                    </div>
                    <div class="product-actions">
                        <button class="add-btn">${buttonText}</button>
                    </div>
                `;
                productListContainer.appendChild(productEl);
            });

            // Após carregar os produtos, reinicia as lógicas de visualização e animação
            updateProductsView();
            setupScrollAnimations();
        });
    }

    // --- 1. CONFIGURAÇÕES ---
    const API_URL = 'https://acai-do-heitor-backend.onrender.com';
    const WHATSAPP_NUMBER = "5584981475289";
    const DELIVERY_FEE = 2.00;
    const PRODUCTS_LIMIT = 6;

    // --- ESTADO DO APLICATIVO ---
    let cart = [];
    let currentCustomizingProduct = {};

    // --- FUNÇÃO PARA CONTROLAR A VISIBILIDADE DOS PRODUTOS ---
    function updateProductsView() {
        const productList = document.querySelector('.product-list');
        const showMoreBtn = document.getElementById('show-more-btn');
        const activeFilter = document.querySelector('.filter-btn.active').dataset.category;
        
        const allProducts = Array.from(productList.querySelectorAll('.product-item'));
        
        allProducts.forEach(p => p.classList.add('hidden'));

        const visibleProducts = allProducts.filter(p => activeFilter === 'all' || p.dataset.category === activeFilter);

        const isShowingAll = showMoreBtn.dataset.state === 'less';
        visibleProducts.forEach((product, index) => {
            if (isShowingAll || index < PRODUCTS_LIMIT) {
                product.classList.remove('hidden');
            }
        });

        if (visibleProducts.length > PRODUCTS_LIMIT) {
            showMoreBtn.style.display = 'block';
            if (isShowingAll) {
                showMoreBtn.innerHTML = `<i class="fas fa-chevron-up"></i> Ver menos`;
            } else {
                showMoreBtn.innerHTML = `<i class="fas fa-chevron-down"></i> Ver mais`;
            }
        } else {
            showMoreBtn.style.display = 'none';
        }
    }


    // --- FUNÇÕES DE LÓGICA ---

    function saveAddressData() {
        try {
            const addressData = {
                name: document.getElementById('customer-name').value,
                phone: document.getElementById('customer-phone').value,
                location: document.getElementById('delivery-location').value,
                reference: document.getElementById('reference-point').value
            };
            localStorage.setItem('userAddress', JSON.stringify(addressData));
            console.log("Endereço salvo no LocalStorage:", addressData);
        } catch (error) {
            console.error("Erro ao salvar endereço no LocalStorage:", error);
        }
    }

    function loadAddressData() {
        try {
            const savedData = localStorage.getItem('userAddress');
            if (savedData) {
                const addressData = JSON.parse(savedData);
                document.getElementById('customer-name').value = addressData.name || '';
                document.getElementById('customer-phone').value = addressData.phone || '';
                document.getElementById('delivery-location').value = addressData.location || '';
                document.getElementById('reference-point').value = addressData.reference || '';
                console.log("Endereço carregado do LocalStorage:", addressData);
            }
        } catch (error) {
            console.error("Erro ao carregar endereço do LocalStorage:", error);
        }
    }

    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('visible');
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('visible');
    }

    function openCustomizationModal(product) {
        currentCustomizingProduct = {
            baseName: product.name,
            basePrice: product.price,
            quantity: 1,
            additionalPrice: 0
        };
        document.getElementById('custom-product-name').textContent = product.name;
        document.getElementById('customization-form').reset();
        document.querySelectorAll('#customization-form input[type="checkbox"]').forEach(cb => cb.disabled = false);
        document.getElementById('custom-quantity').textContent = '1';
        updateCustomPrice();
        openModal('customization-modal');
    }
    
    function updateCustomPrice() {
        const form = document.getElementById('customization-form');
        let additionalPrice = 0;
        form.querySelectorAll('input[name="adicionais"]:checked').forEach(addon => {
            additionalPrice += parseFloat(addon.dataset.price);
        });
        currentCustomizingProduct.additionalPrice = additionalPrice;
        const finalPrice = (currentCustomizingProduct.basePrice + additionalPrice) * currentCustomizingProduct.quantity;
        document.getElementById('custom-product-price').textContent = `R$ ${finalPrice.toFixed(2)}`;
    }

    function enforceSelectionLimits(event) {
        const checkbox = event.target;
        if (checkbox.type !== 'checkbox') return;
        const groupName = checkbox.name;
        const form = checkbox.closest('form');
        const checkedboxes = form.querySelectorAll(`input[name="${groupName}"]:checked`);
        let limit = (groupName === 'cremes') ? 5 : (groupName === 'acompanhamentos') ? 10 : 0;
        if (limit > 0) {
            const allInGroup = form.querySelectorAll(`input[name="${groupName}"]`);
            allInGroup.forEach(cb => { cb.disabled = checkedboxes.length >= limit && !cb.checked; });
        }
    }

    function addCustomizedItemToCart() {
        const customizations = [];
        const form = document.getElementById('customization-form');
        form.querySelectorAll('input:checked').forEach(option => {
            if (option.type === 'checkbox') customizations.push(option.value);
            else if (option.type === 'radio' && option.value === 'Sim') customizations.push(`Com ${option.name}`);
        });
        const finalProduct = {
            name: currentCustomizingProduct.baseName,
            price: currentCustomizingProduct.basePrice + currentCustomizingProduct.additionalPrice,
            quantity: currentCustomizingProduct.quantity,
            customizations: customizations,
            uniqueId: Date.now() 
        };
        cart.push(finalProduct);
        showToastNotification("Item adicionado ao carrinho!");
        updateCart();
        closeModal('customization-modal');
    }
    
    function updateCart() {
        const cartItemsContainer = document.getElementById('cart-items');
        cartItemsContainer.innerHTML = '';
        let subtotal = 0;

        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p class="empty-cart-message">Seu carrinho está vazio.</p>';
        } else {
            cart.forEach((item, index) => {
                subtotal += item.price * item.quantity;
                const customizationsHTML = item.customizations.length > 0 
                    ? `<div class="cart-item-customizations">${item.customizations.join(', ')}</div>` 
                    : '';

                cartItemsContainer.innerHTML += `
                    <div class="cart-item" data-index="${index}">
                        <div class="cart-item-details">
                            <span class="cart-item-name">${item.name}</span>
                            ${customizationsHTML}
                        </div>
                        <div class="quantity-controls">
                            <button class="quantity-btn" data-action="decrease">-</button>
                            <span class="quantity-text">${item.quantity}</span>
                            <button class="quantity-btn" data-action="increase">+</button>
                        </div>
                        <div class="cart-item-actions">
                            <span class="cart-item-price">R$ ${(item.price * item.quantity).toFixed(2)}</span>
                            <button class="remove-btn">&times;</button>
                        </div>
                    </div>`;
            });
        }

        const total = subtotal + DELIVERY_FEE;
        document.getElementById('subtotal').innerText = `R$ ${subtotal.toFixed(2)}`;
        document.getElementById('delivery-fee').innerText = `R$ ${DELIVERY_FEE.toFixed(2)}`;
        document.getElementById('total-price').innerText = `R$ ${total.toFixed(2)}`;
        document.getElementById('checkout-btn').disabled = cart.length === 0;

        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        document.getElementById('floating-cart-count').innerText = totalItems;
        document.getElementById('floating-cart-btn').classList.toggle('visible', totalItems > 0);
    }
    
    function showToastNotification(message) {
        const toast = document.getElementById('toast-notification');
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
    }

    // --- LÓGICA DE ANIMAÇÕES DE SCROLL ---
    function setupScrollAnimations() {
        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1
        };

        const observerCallback = (entries, observer) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    // Adiciona um delay para criar o efeito cascata (staggering)
                    entry.target.style.transitionDelay = `${index * 100}ms`;
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        };

        const scrollObserver = new IntersectionObserver(observerCallback, observerOptions);
        const elementsToAnimate = document.querySelectorAll('.animate-on-scroll');
        elementsToAnimate.forEach(el => scrollObserver.observe(el));
    }

    function handleScrollEffects() {
        const heroTexts = document.querySelectorAll('.hero-text');
        const scrollPosition = window.scrollY;
        // Distância em pixels para o efeito de fade-out ser concluído
        const fadeOutDistance = 400;

        // Se a rolagem estiver dentro da área de efeito
        if (scrollPosition < fadeOutDistance) {
            // Calcula a opacidade: 1 (totalmente visível) no topo, 0 (invisível) no final da distância
            const opacity = 1 - (scrollPosition / fadeOutDistance);
            // Calcula o deslocamento para a esquerda
            const translateX = -scrollPosition / 5;

            heroTexts.forEach(text => {
                text.style.opacity = opacity;
                text.style.transform = `translateX(${translateX}px)`;
            });
        } else {
            // Garante que o texto permaneça oculto após a rolagem
            heroTexts.forEach(text => {
                text.style.opacity = 0;
                text.style.transform = `translateX(${-fadeOutDistance / 5}px)`;
            });
        }
    }

    async function submitOrderToBackend() {
        const customerData = {
            name: document.getElementById('customer-name').value,
            phone: document.getElementById('customer-phone').value.replace(/\D/g, ''),
            address: document.getElementById('delivery-location').value,
            reference: document.getElementById('reference-point').value
        };
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const orderData = {
            customer: customerData,
            items: cart.map(item => ({ name: item.name, quantity: item.quantity, price: item.price, customizations: item.customizations })),
            total: subtotal + DELIVERY_FEE,
            paymentMethod: document.querySelector('input[name="payment"]:checked').value
        };
        try {
            const response = await fetch(`${API_URL}/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });
            if (!response.ok) throw new Error('Falha ao registrar o pedido.');
            const result = await response.json();
            console.log('Pedido registrado com sucesso no backend!', result);
            return result;
        } catch (error) {
            console.error('Erro ao enviar pedido para o backend:', error);
            alert('Não foi possível registrar seu pedido. Tente novamente.');
            return null;
        }
    }

    function generateWhatsAppMessage(backendResponse) {
        const name = document.getElementById('customer-name').value;
        const location = document.getElementById('delivery-location').value;
        const reference = document.getElementById('reference-point').value;
        const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
        const orderId = backendResponse.data.orderId;
        let message = `*Olá, acabei de fazer o pedido #${orderId} pelo site.*\n\n*Cliente:* ${name}\n*Endereço:* ${location}\n`;
        if(reference) message += `*Referência:* ${reference}\n\n`;
        message += `*Resumo do Pedido:*\n`;
        cart.forEach(item => { message += `• ${item.quantity}x ${item.name}\n`; });
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + DELIVERY_FEE;
        message += `\n*Total:* R$ ${total.toFixed(2)}\n*Pagamento:* ${paymentMethod}\n\nAguardo a confirmação. Obrigado!`;
        return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    }
    
    function initialize() {
        // --- CONTEÚDO DINÂMICO CARREGADO PRIMEIRO ---
        loadBranding();
        loadHeroContent();
        loadProducts();
        
        loadAddressData();

        window.addEventListener('scroll', handleScrollEffects);
        
        document.body.addEventListener('click', (e) => {
            const productItem = e.target.closest('.product-item');
            
            if (productItem) {
                if (!e.target.closest('.add-btn')) {
                    document.querySelectorAll('.product-item.active').forEach(item => item.classList.remove('active'));
                    productItem.classList.add('active');
                }
            }

            if (e.target.matches('.add-btn')) {
                const productData = { name: productItem.dataset.name, price: parseFloat(productItem.dataset.price) };
                openCustomizationModal(productData);
            }
            
            if (e.target.matches('.filter-btn')) {
                document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                updateProductsView();
            }

            if (e.target.closest('#floating-cart-btn')) openModal('cart-modal');
            if (e.target.matches('.close-btn, .close-custom-modal-btn')) {
                const modal = e.target.closest('.modal');
                if (modal) closeModal(modal.id);
            }
        });

        document.getElementById('show-more-btn').addEventListener('click', (e) => {
            const currentState = e.target.dataset.state || 'more';
            e.target.dataset.state = currentState === 'more' ? 'less' : 'more';
            updateProductsView();
        });

        document.getElementById('cart-modal').addEventListener('click', (e) => {
            if (e.target.id === 'checkout-btn' && cart.length > 0) {
                closeModal('cart-modal'); openModal('address-modal');
            }
            const cartItem = e.target.closest('.cart-item');
            if (cartItem) {
                const index = cartItem.dataset.index;
                if (e.target.matches('.remove-btn')) cart.splice(index, 1);
                if (e.target.matches('.quantity-btn')) {
                    const action = e.target.dataset.action;
                    if (action === 'increase') cart[index].quantity++;
                    if (action === 'decrease' && cart[index].quantity > 1) cart[index].quantity--;
                }
                updateCart();
            }
        });

        document.getElementById('address-modal').addEventListener('click', (e) => {
            if (e.target.id === 'back-to-cart-btn') { closeModal('address-modal'); openModal('cart-modal'); }
            if (e.target.id === 'review-order-btn') {
                const form = document.getElementById('address-form');
                if (form.checkValidity()) {
                    saveAddressData();
                    
                    document.getElementById('review-items').innerHTML = document.getElementById('cart-items').innerHTML;
                    const location = document.getElementById('delivery-location').value;
                    const reference = document.getElementById('reference-point').value;
                    document.getElementById('review-address-details').innerText = `${location}${reference ? `, ${reference}` : ''}`;
                    const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
                    document.getElementById('review-payment-method').innerText = paymentMethod;
                    document.getElementById('review-total-price').innerText = document.getElementById('total-price').innerText;
                    closeModal('address-modal');
                    openModal('review-modal');
                } else { form.reportValidity(); }
            }
        });

        document.getElementById('review-modal').addEventListener('click', async (e) => {
             if (e.target.id === 'back-to-address-btn') { closeModal('review-modal'); openModal('address-modal'); }
             if (e.target.id === 'submit-order-btn') {
                const btn = e.target;
                btn.disabled = true; btn.textContent = 'Enviando...';
                const backendResponse = await submitOrderToBackend();
                if (backendResponse) {
                    document.getElementById('send-whatsapp-btn').href = generateWhatsAppMessage(backendResponse);
                    cart = [];
                    updateCart();
                    closeModal('review-modal');
                    openModal('submit-modal');
                }
                btn.disabled = false; btn.textContent = 'Enviar Pedido';
            }
        });

        const customModal = document.getElementById('customization-modal');
        customModal.querySelector('#customization-form').addEventListener('change', enforceSelectionLimits);
        customModal.addEventListener('click', (e) => {
            if (e.target.id === 'add-custom-to-cart-btn') addCustomizedItemToCart();
            if (e.target.matches('#decrease-custom-quantity, #increase-custom-quantity')) {
                let qty = currentCustomizingProduct.quantity;
                if (e.target.id === 'decrease-custom-quantity' && qty > 1) qty--;
                else if (e.target.id === 'increase-custom-quantity') qty++;
                currentCustomizingProduct.quantity = qty;
                document.getElementById('custom-quantity').textContent = qty;
                updateCustomPrice();
            }
        });

        document.getElementById('view-menu-btn').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('menu').scrollIntoView({ behavior: 'smooth' });
        });
        
        updateCart();
        
        console.log("Inicialização de eventos concluída.");
    }

    initialize();
});