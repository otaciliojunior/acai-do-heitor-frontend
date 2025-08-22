// script.js (Versão Final - Conectado ao Backend)

// A configuração do Firebase ainda é necessária para carregar o menu, etc.
const firebaseConfig = {
    apiKey: "AIzaSyALdTRDfbHFM4Geq5iIGaJ2tFrLi_pqWik",
    authDomain: "acai-do-heitor-b3054.firebaseapp.com",
    projectId: "acai-do-heitor-b3054",
    storageBucket: "acai-do-heitor-b3054.appspot.com",
    messagingSenderId: "1015413255115",
    appId: "1:1015413255115:web:0a6a6983e4f073e702e44e",
    measurementId: "G-1H5JT000KK"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURAÇÕES ---
    const BACKEND_URL = 'https://acai-do-heitor-backend.onrender.com';
    const PRODUCTS_LIMIT = 6;
    const ORDER_EXPIRATION_MINUTES = 20;

    // --- ESTADO DO APLICATIVO ---
    let cart = [];
    let currentCustomizingProduct = {};
    let currentLimits = { cremes: 0, acompanhamentos: 0 };
    
    // --- FUNÇÃO DE ENVIO DO PEDIDO PARA O BACKEND ---
    async function submitOrder() {
        try {
            let deliveryFee = 0;
            const deliveryMode = document.querySelector('input[name="delivery-type"]:checked').value;
            if (deliveryMode === 'delivery') {
                const locationInput = document.getElementById('customer-location');
                if (locationInput && locationInput.value) {
                    deliveryFee = parseFloat(locationInput.value);
                }
            }
            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const total = subtotal + deliveryFee;

            // Gera o texto para impressão antes de enviar
            const printerText = generatePrinterFriendlyTextForBackend();

            // Monta o objeto no formato que o backend espera
            const orderData = {
                customer: {
                    name: document.getElementById('customer-name').value,
                    phone: document.getElementById('customer-phone').value.replace(/\D/g, ''),
                },
                delivery: {
                    mode: deliveryMode,
                    address: deliveryMode === 'delivery' ? `${document.getElementById('street-name').value}, ${document.getElementById('house-number').value}` : 'Retirada no local',
                    location: deliveryMode === 'delivery' ? document.getElementById('selected-location-text').textContent : 'N/A',
                    fee: deliveryFee
                },
                items: cart,
                payment: {
                    method: document.querySelector('input[name="payment"]:checked').value,
                    changeFor: document.getElementById('change-amount').value || '0'
                },
                totals: {
                    subtotal: subtotal,
                    total: total
                },
                printerFriendlyText: printerText
            };

            const response = await fetch(`${BACKEND_URL}/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData),
            });

            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.error || 'Falha ao criar o pedido no servidor.');
            }

            const result = await response.json();
            console.log("Pedido criado com sucesso pelo backend:", result);
            return true;

        } catch (error) {
            console.error("Erro ao enviar pedido para o backend:", error);
            alert(`Não foi possível registrar seu pedido: ${error.message}`);
            return false;
        }
    }

    // --- FUNÇÃO PARA GERAR TEXTO DE IMPRESSÃO ---
    function generatePrinterFriendlyTextForBackend() {
        const name = document.getElementById('customer-name').value;
        const phone = document.getElementById('customer-phone').value;
        const deliveryMode = document.querySelector('input[name="delivery-type"]:checked').value;

        let addressInfo = '';
        if (deliveryMode === 'delivery') {
            const street = document.getElementById('street-name').value;
            const number = document.getElementById('house-number').value;
            const locationText = document.getElementById('selected-location-text').textContent.split('–')[0].trim();
            addressInfo += `Endereco de Entrega:\n${street}, ${number}\nLocalidade: ${locationText}\n`;
        } else {
            addressInfo = `Retirar no Local\n`;
        }

        const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
        let paymentInfo = paymentMethod;
        if (paymentMethod === 'Dinheiro') {
            const needsChange = document.querySelector('input[name="needs-change"]:checked').value;
            if (needsChange === 'sim') {
                const changeAmount = document.getElementById('change-amount').value;
                if (changeAmount) {
                    paymentInfo += ` (Troco para R$ ${parseFloat(changeAmount).toFixed(2)})`;
                }
            }
        }

        let text = `Cliente: ${name}\nWhatsApp: +${phone.replace(/\D/g, '')}\n\n${addressInfo}\n--------------------------------\nItens do pedido:\n`;
        cart.forEach(item => {
            text += `\n* ${item.quantity}x ${item.name} - R$${(item.price * item.quantity).toFixed(2)}\n`;
            if (item.customizations && item.customizations.length > 0) {
                text += `  Com: ${item.customizations.join(', ')}\n`;
            }
        });
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        let deliveryFee = 0;
        if (deliveryMode === 'delivery') {
            const locationInput = document.getElementById('customer-location');
            if (locationInput && locationInput.value) {
                deliveryFee = parseFloat(locationInput.value);
            }
        }
        const total = subtotal + deliveryFee;
        text += `\n--------------------------------\nPagamento:\nSubtotal: R$${subtotal.toFixed(2)}\n`;
        if (deliveryMode === 'delivery') {
            text += `Entrega: R$${deliveryFee.toFixed(2)}\n`;
        }
        text += `Total: R$${total.toFixed(2)}\n\nForma de Pagamento: ${paymentInfo}\n`;
        return text;
    }


    // --- EVENTO DE SUBMISSÃO FINAL DO PEDIDO ---
    document.getElementById('review-modal').addEventListener('click', async (e) => {
        if (e.target.id === 'back-to-address-btn') {
            closeModal('review-modal');
            openModal('address-modal');
        }
        if (e.target.id === 'submit-order-btn') {
            const btn = e.target;
            btn.disabled = true;
            btn.textContent = 'Enviando...';
            const success = await submitOrder();
            if (success) {
                cart = [];
                updateCart();
                localStorage.removeItem('orderState');
                closeModal('review-modal');
                openModal('submit-modal');
            }
            btn.disabled = false;
            btn.textContent = 'Enviar Pedido';
        }
    });

    // --- FUNÇÕES DE GERENCIAMENTO DE ESTADO DO PEDIDO ---
    function saveOrderState() {
        try {
            const addressForm = document.getElementById('address-form');
            const formData = new FormData(addressForm);
            const addressData = Object.fromEntries(formData.entries());
            const orderState = { cart: cart, address: addressData };
            const stateWithTimestamp = { data: orderState, timestamp: new Date().getTime() };
            localStorage.setItem('orderState', JSON.stringify(stateWithTimestamp));
        } catch (error) { console.error("Erro ao salvar o estado do pedido:", error); }
    }
    function loadOrderState() {
        const savedStateJSON = localStorage.getItem('orderState');
        if (!savedStateJSON) return;
        try {
            const savedStateWithTimestamp = JSON.parse(savedStateJSON);
            const now = new Date().getTime();
            const expirationTime = ORDER_EXPIRATION_MINUTES * 60 * 1000;
            if (now - savedStateWithTimestamp.timestamp < expirationTime) {
                const savedData = savedStateWithTimestamp.data;
                cart = savedData.cart || [];
                updateCart();
                if (savedData.address) {
                    const address = savedData.address;
                    const form = document.getElementById('address-form');
                    for (const key in address) {
                        const input = form.elements[key];
                        if (input) {
                            if (input.type === 'radio') {
                                if (input.value === address[key]) {
                                    input.checked = true;
                                    input.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                            } else { input.value = address[key]; }
                        }
                    }
                }
                showToastNotification('Sua sacola foi recuperada!', 'info');
            } else {
                localStorage.removeItem('orderState');
            }
        } catch (error) {
            console.error("Erro ao carregar o estado do pedido:", error);
            localStorage.removeItem('orderState');
        }
    }
    function saveUserInfo() {
        try {
            const form = document.getElementById('address-form');
            const userInfo = {
                name: form.elements['customer-name'].value,
                phone: form.elements['customer-phone'].value,
                street: form.elements['street-name'].value,
                number: form.elements['house-number'].value,
                location: form.elements['customer-location'].value
            };
            localStorage.setItem('userInfo', JSON.stringify(userInfo));
        } catch (error) { console.error("Erro ao salvar dados do usuário:", error); }
    }
    function loadUserInfo() {
        try {
            const savedUserJSON = localStorage.getItem('userInfo');
            if (savedUserJSON) {
                const userInfo = JSON.parse(savedUserJSON);
                const form = document.getElementById('address-form');
                if (form && userInfo) {
                    form.elements['customer-name'].value = userInfo.name || '';
                    form.elements['customer-phone'].value = userInfo.phone || '';
                    form.elements['street-name'].value = userInfo.street || '';
                    form.elements['house-number'].value = userInfo.number || '';
                    if (userInfo.location) {
                        const locationInput = document.getElementById('customer-location');
                        const locationTextSpan = document.getElementById('selected-location-text');
                        const locations = getLocationOptions();
                        const selectedLocation = locations.find(loc => loc.value === userInfo.location);
                        if (selectedLocation) {
                            locationInput.value = selectedLocation.value;
                            locationTextSpan.textContent = selectedLocation.text;
                            locationTextSpan.classList.remove('placeholder');
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Erro ao carregar dados do usuário:", error);
            localStorage.removeItem('userInfo');
        }
    }

    // --- FUNÇÕES DE CONTEÚDO DINÂMICO (sem alterações) ---
    function loadBranding() {
        db.collection('siteContent').doc('branding').get().then(doc => {
            if (doc.exists && doc.data().logoUrl) {
                document.getElementById('logo-img').src = doc.data().logoUrl;
            }
        });
    }
    function loadOperatingStatus() {
        db.collection('siteContent').doc('operatingHours').get().then(doc => {
            const container = document.getElementById('operating-hours-container');
            if (doc.exists) {
                const operatingHours = doc.data();
                const daysOrder = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
                const now = new Date();
                const todayName = daysOrder[now.getDay()];
                const todayHours = operatingHours[todayName];
                if (!todayHours) { container.innerHTML = `<span class="status-badge closed">Indisponível</span>`; return; }
                let statusHTML = '';
                const timeToMinutes = (timeStr) => {
                    if (!timeStr) return 0;
                    const [hours, minutes] = timeStr.split(':').map(Number);
                    return hours * 60 + minutes;
                };
                const currentMinutes = now.getHours() * 60 + now.getMinutes();
                if (!todayHours.isClosed && currentMinutes >= timeToMinutes(todayHours.open) && currentMinutes < timeToMinutes(todayHours.close)) {
                    statusHTML = `<span class="status-badge open">Aberto</span> <span>Fecha às ${todayHours.close}</span>`;
                } else {
                    statusHTML = `<span class="status-badge closed">Fechado</span>`;
                }
                statusHTML += ` • <a href="#" id="details-link" class="details-link">Detalhes</a>`;
                container.innerHTML = statusHTML;
                document.getElementById('details-link').addEventListener('click', e => { e.preventDefault(); openModal('hours-details-modal'); });
            }
        });
    }
    function loadProducts() {
        const productListContainer = document.querySelector('.product-list');
        if (!productListContainer) return;
        db.collection('products').orderBy('position').get().then(snapshot => {
            productListContainer.innerHTML = '';
            snapshot.forEach(doc => {
                const product = doc.data();
                const productEl = document.createElement('div');
                productEl.className = 'product-item animate-on-scroll';
                if (!product.isAvailable) productEl.classList.add('unavailable');
                productEl.dataset.category = product.category;
                productEl.dataset.name = product.name;
                productEl.dataset.price = product.price.toFixed(2);
                if (product.description) productEl.dataset.description = product.description;
                if (product.category === 'acai') {
                    productEl.dataset.creamLimit = product.creamLimit || 0;
                    productEl.dataset.accompanimentLimit = product.accompanimentLimit || 0;
                }
                const buttonText = product.category === 'acai' ? 'Personalizar' : 'Adicionar';
                const descriptionHTML = product.description ? `<p class="product-description">${product.description}</p>` : '';
                productEl.innerHTML = `<div class="product-info"><img src="${product.imageUrl}" alt="${product.name}"><div class="product-details"><h3>${product.name}</h3>${descriptionHTML}<p class="price">R$ ${product.price.toFixed(2)}</p></div></div><div class="product-actions"><button class="add-btn">${buttonText}</button></div>`;
                productListContainer.appendChild(productEl);
            });
            updateProductsView();
            setupScrollAnimations();
        });
    }
    function loadCustomizationOptions() {
        const containers = {
            cremes: document.getElementById('custom-cremes'),
            acompanhamentos: document.getElementById('custom-acompanhamentos'),
            adicionais: document.getElementById('custom-adicionais')
        };
        db.collection('customizationOptions').orderBy('position').get().then(snapshot => {
            Object.values(containers).forEach(c => { if (c) c.innerHTML = ''; });
            snapshot.forEach(doc => {
                const option = doc.data();
                if (containers[option.group]) {
                    const optionEl = document.createElement('div');
                    optionEl.className = 'option-item';
                    const priceText = option.price > 0 ? `<span>+ R$ ${option.price.toFixed(2)}</span>` : '';
                    const disabledAttr = !option.isAvailable ? 'disabled' : '';
                    const unavailableClass = !option.isAvailable ? 'class="unavailable"' : '';
                    optionEl.innerHTML = `<label ${unavailableClass}><input type="checkbox" name="${option.group}" value="${option.name}" data-price="${option.price}" ${disabledAttr}> ${option.name}</label>${priceText}`;
                    containers[option.group].appendChild(optionEl);
                }
            });
        });
    }

    // --- FUNÇÕES DE LÓGICA DO SITE (sem alterações) ---
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
        showMoreBtn.style.display = visibleProducts.length > PRODUCTS_LIMIT ? 'block' : 'none';
        showMoreBtn.innerHTML = isShowingAll ? `<i class="fas fa-chevron-up"></i> Ver menos` : `<i class="fas fa-chevron-down"></i> Ver mais`;
    }
    function openModal(modalId) { const modal = document.getElementById(modalId); if (modal) modal.classList.add('visible'); }
    function closeModal(modalId) { const modal = document.getElementById(modalId); if (modal) modal.classList.remove('visible'); }
    function openCustomizationModal(product, limits) {
        currentCustomizingProduct = { baseName: product.name, basePrice: product.price, quantity: 1, additionalPrice: 0 };
        currentLimits = limits;
        document.getElementById('cremes-badge').textContent = `Escolha até ${limits.cremes} opções.`;
        document.getElementById('acompanhamentos-badge').textContent = `Escolha até ${limits.acompanhamentos} opções.`;
        document.getElementById('custom-product-name').textContent = product.name;
        document.getElementById('customization-form').reset();
        document.getElementById('custom-quantity').textContent = '1';
        updateCustomPrice();
        openModal('customization-modal');
    }
    function updateCustomPrice() {
        let additionalPrice = 0;
        document.querySelectorAll('#customization-form input[name="adicionais"]:checked').forEach(addon => {
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
        const limit = currentLimits[groupName];
        if (limit === undefined) return;
        const form = checkbox.closest('form');
        const checkedboxes = form.querySelectorAll(`input[name="${groupName}"]:checked`);
        if (checkedboxes.length >= limit) {
            form.querySelectorAll(`input[name="${groupName}"]`).forEach(cb => { if (!cb.checked && !cb.disabled) cb.disabled = true; });
        } else {
            form.querySelectorAll(`input[name="${groupName}"]`).forEach(cb => { if (!cb.closest('label').classList.contains('unavailable')) cb.disabled = false; });
        }
    }
    function addCustomizedItemToCart() {
        const customizations = Array.from(document.querySelectorAll('#customization-form input[type="checkbox"]:checked')).map(cb => cb.value);
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
                const customizationsHTML = item.customizations.length > 0 ? `<div class="cart-item-customizations">${item.customizations.join(', ')}</div>` : '';
                cartItemsContainer.innerHTML += `<div class="cart-item" data-index="${index}"><div class="cart-item-details"><span class="cart-item-name">${item.name}</span>${customizationsHTML}</div><div class="quantity-controls"><button class="quantity-btn" data-action="decrease">-</button><span class="quantity-text">${item.quantity}</span><button class="quantity-btn" data-action="increase">+</button></div><div class="cart-item-actions"><span class="cart-item-price">R$ ${(item.price * item.quantity).toFixed(2)}</span><button class="remove-btn">&times;</button></div></div>`;
            });
        }
        let currentDeliveryFee = 0;
        const deliveryMode = document.querySelector('input[name="delivery-type"]:checked')?.value;
        if (deliveryMode === 'delivery') {
            const locationInput = document.getElementById('customer-location');
            if (locationInput && locationInput.value) {
                currentDeliveryFee = parseFloat(locationInput.value);
            }
        }
        const total = subtotal + currentDeliveryFee;
        document.getElementById('subtotal').innerText = `R$ ${subtotal.toFixed(2)}`;
        document.getElementById('delivery-fee').innerText = `R$ ${currentDeliveryFee.toFixed(2)}`;
        document.getElementById('total-price').innerText = `R$ ${total.toFixed(2)}`;
        document.getElementById('checkout-btn').disabled = cart.length === 0;
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        document.getElementById('floating-cart-count').innerText = totalItems;
        document.getElementById('floating-cart-btn').classList.toggle('visible', totalItems > 0);
        saveOrderState();
    }
    function showToastNotification(message, type = 'success') {
        const toast = document.getElementById('toast-notification');
        toast.textContent = message;
        toast.className = 'show ' + type;
        setTimeout(() => toast.classList.remove('show'), 3500);
    }
    function setupScrollAnimations() {
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
    }
    function handleDeliveryTypeChange() {
        const deliveryMode = document.querySelector('input[name="delivery-type"]:checked').value;
        const addressFields = document.getElementById('address-fields');
        addressFields.style.display = deliveryMode === 'delivery' ? 'block' : 'none';
        ['customer-location', 'street-name', 'house-number'].forEach(id => {
            document.getElementById(id).required = deliveryMode === 'delivery';
        });
        updateCart();
    }
    function initializeFeedbackSystem() {
        const stars = document.querySelectorAll('.star-rating .fa-star');
        let selectedRating = 0;
        stars.forEach(star => {
            star.addEventListener('click', () => {
                selectedRating = star.dataset.value;
                stars.forEach(s => s.classList.toggle('selected', s.dataset.value <= selectedRating));
            });
        });
        document.getElementById('submit-feedback-btn').addEventListener('click', () => {
            if (selectedRating > 0) {
                db.collection('avaliacoes').add({
                    rating: selectedRating,
                    comment: document.getElementById('feedback-comment').value,
                    timestamp: new Date()
                }).then(() => {
                    document.getElementById('feedback-section').style.display = 'none';
                    document.getElementById('feedback-thanks').style.display = 'block';
                });
            }
        });
    }
    function getLocationOptions() {
        return [
            { value: '0.00', text: 'Assentamento – Entrega grátis' }, { value: '3.00', text: 'Riacho do Sangue – R$ 3,00' },
            { value: '4.00', text: 'Riacho de Benção – R$ 4,00' }, { value: '4.00', text: 'Peri Peri – R$ 4,00' },
            { value: '3.00', text: 'Quilombo – R$ 3,00' }, { value: '3.00', text: 'Tabatinga – R$ 3,00' },
            { value: '4.00', text: 'Lagoa Seca – R$ 4,00' }, { value: '5.00', text: 'Barro Branco – R$ 5,00' },
            { value: '6.00', text: 'Lagoa do Boi – R$ 6,00' }, { value: '8.00', text: 'Cajarana – R$ 8,00' },
            { value: '10.00', text: 'Canabrava – R$ 10,00' }
        ];
    }
    function initializeCustomSelect() {
        const trigger = document.getElementById('custom-select-trigger');
        const locationOptionsList = document.getElementById('location-options-list');
        const locationInput = document.getElementById('customer-location');
        const locationTextSpan = document.getElementById('selected-location-text');
        getLocationOptions().forEach(location => {
            const optionEl = document.createElement('div');
            optionEl.className = 'location-option';
            optionEl.dataset.value = location.value;
            const [name, price] = location.text.split('–').map(s => s.trim());
            optionEl.innerHTML = `<span class="location-name">${name}</span><span class="location-price">${price}</span>`;
            optionEl.addEventListener('click', () => {
                locationInput.value = location.value;
                locationTextSpan.textContent = location.text;
                locationTextSpan.classList.remove('placeholder');
                updateCart();
                closeModal('location-modal');
            });
            locationOptionsList.appendChild(optionEl);
        });
        trigger.addEventListener('click', () => openModal('location-modal'));
    }

    // --- FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO ---
    function initialize() {
        loadBranding();
        loadOperatingStatus();
        loadProducts();
        loadCustomizationOptions();
        loadOrderState();
        loadUserInfo();
        initializeFeedbackSystem();
        initializeCustomSelect();
        setupScrollAnimations();
        handleDeliveryTypeChange();
        document.querySelectorAll('input[name="delivery-type"]').forEach(radio => radio.addEventListener('change', handleDeliveryTypeChange));
        document.querySelectorAll('input[name="payment"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                document.getElementById('change-section').style.display = e.target.value === 'Dinheiro' ? 'block' : 'none';
            });
        });
        document.querySelectorAll('input[name="needs-change"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                document.getElementById('change-amount-group').style.display = e.target.value === 'sim' ? 'block' : 'none';
            });
        });
        document.getElementById('show-more-btn').addEventListener('click', (e) => {
            e.target.dataset.state = (e.target.dataset.state || 'more') === 'more' ? 'less' : 'more';
            updateProductsView();
        });
        document.getElementById('cart-modal').addEventListener('click', (e) => {
            if (e.target.id === 'checkout-btn') { closeModal('cart-modal'); openModal('address-modal'); }
            const cartItemEl = e.target.closest('.cart-item');
            if (cartItemEl) {
                const index = parseInt(cartItemEl.dataset.index, 10);
                if (e.target.matches('.remove-btn')) cart.splice(index, 1);
                if (e.target.matches('.quantity-btn')) {
                    const action = e.target.dataset.action;
                    if (action === 'increase') cart[index].quantity++;
                    else if (action === 'decrease' && cart[index].quantity > 1) cart[index].quantity--;
                }
                updateCart();
            }
        });
        document.getElementById('address-modal').addEventListener('click', (e) => {
            if (e.target.id === 'back-to-cart-btn') { closeModal('address-modal'); openModal('cart-modal'); }
            if (e.target.id === 'review-order-btn') {
                const form = document.getElementById('address-form');
                if (form.checkValidity()) {
                    // Preenche o modal de revisão
                    document.getElementById('review-items').innerHTML = document.getElementById('cart-items').innerHTML;
                    const deliveryMode = document.querySelector('input[name="delivery-type"]:checked').value;
                    let addressDetails = 'Retirar no local';
                    if (deliveryMode === 'delivery') {
                        addressDetails = `${document.getElementById('street-name').value}, ${document.getElementById('house-number').value}\n${document.getElementById('selected-location-text').textContent}`;
                    }
                    document.getElementById('review-address-details').innerText = addressDetails;
                    document.getElementById('review-payment-method').innerText = document.querySelector('input[name="payment"]:checked').value;
                    document.getElementById('review-total-price').innerText = document.getElementById('total-price').innerText;
                    closeModal('address-modal');
                    openModal('review-modal');
                } else {
                    form.reportValidity();
                }
            }
        });
        document.getElementById('customization-modal').addEventListener('click', (e) => {
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
        document.body.addEventListener('click', (e) => {
            if (e.target.matches('.close-btn') || e.target.matches('.close-custom-modal-btn')) {
                const modal = e.target.closest('.modal');
                if (modal) closeModal(modal.id);
            }
            if(e.target.closest('#floating-cart-btn')) openModal('cart-modal');
        });
    }

    initialize();
});