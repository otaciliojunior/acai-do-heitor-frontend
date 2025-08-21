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

    // --- 1. CONFIGURAÇÕES ---
    const API_URL = 'https://acai-do-heitor-backend.onrender.com';
    const WHATSAPP_NUMBER = "558491393356";
    const DELIVERY_FEE = 2.00;
    const PRODUCTS_LIMIT = 6;
    const ORDER_EXPIRATION_MINUTES = 20;

    // --- ESTADO DO APLICATIVO ---
    let cart = [];
    let currentCustomizingProduct = {};
    let currentLimits = { cremes: 0, acompanhamentos: 0 };


    // --- FUNÇÕES DE GERENCIAMENTO DE ESTADO DO PEDIDO ---

    function saveOrderState() {
        try {
            const addressForm = document.getElementById('address-form');
            const formData = new FormData(addressForm);
            const addressData = Object.fromEntries(formData.entries());

            const orderState = {
                cart: cart,
                address: addressData
            };

            const stateWithTimestamp = {
                data: orderState,
                timestamp: new Date().getTime()
            };

            localStorage.setItem('orderState', JSON.stringify(stateWithTimestamp));
            console.log("Estado do pedido salvo.");
        } catch (error) {
            console.error("Erro ao salvar o estado do pedido:", error);
        }
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
                            } else {
                                input.value = address[key];
                            }
                        }
                    }
                }
                showToastNotification('Sua sacola foi recuperada!', 'info');
            } else {
                localStorage.removeItem('orderState');
                showToastNotification('Sua sacola foi limpa devido ao tempo de expiração', 'info');
            }
        } catch (error) {
            console.error("Erro ao carregar o estado do pedido:", error);
            localStorage.removeItem('orderState');
        }
    }

    // --- INÍCIO DA NOVA IMPLEMENTAÇÃO: PERSISTÊNCIA DE DADOS DO USUÁRIO ---
    
    function saveUserInfo() {
        try {
            const form = document.getElementById('address-form');
            const userInfo = {
                name: form.elements['customer-name'].value,
                phone: form.elements['customer-phone'].value,
                street: form.elements['street-name'].value,
                number: form.elements['house-number'].value,
                reference: form.elements['reference-point'].value
            };
            localStorage.setItem('userInfo', JSON.stringify(userInfo));
        } catch (error) {
            console.error("Erro ao salvar dados do usuário:", error);
        }
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
                    form.elements['reference-point'].value = userInfo.reference || '';
                    console.log("Dados do usuário recuperados com sucesso.");
                }
            }
        } catch (error) {
            console.error("Erro ao carregar dados do usuário:", error);
            localStorage.removeItem('userInfo');
        }
    }

    // --- FIM DA NOVA IMPLEMENTAÇÃO ---


    // --- FUNÇÕES DE CONTEÚDO DINÂMICO ---

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
                try {
                    const operatingHours = doc.data();
                    
                    const daysOrder = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
                    
                    const now = new Date();
                    const todayIndex = now.getDay();
                    const todayName = daysOrder[todayIndex];
                    const todayHours = operatingHours[todayName];

                    if (!todayHours) {
                        console.error(`Horários para "${todayName}" não encontrados no Firebase.`);
                        container.innerHTML = `<span class="status-badge closed">Indisponível</span>`;
                        return;
                    }

                    let statusHTML = '';
                    
                    const timeToMinutes = (timeStr) => {
                        if (!timeStr) return 0;
                        const [hours, minutes] = timeStr.split(':').map(Number);
                        return hours * 60 + minutes;
                    };

                    const currentMinutes = now.getHours() * 60 + now.getMinutes();

                    if (todayHours.isClosed === false && currentMinutes >= timeToMinutes(todayHours.open) && currentMinutes < timeToMinutes(todayHours.close)) {
                        statusHTML = `<span class="status-badge open">Aberto agora</span> <span class="status-text">Fecha às ${todayHours.close}</span>`;
                    } else {
                        let nextOpenDayIndex = -1;
                        let nextOpenTime = '';
                        let nextOpenDayText = '';

                        for (let i = 0; i < 7; i++) {
                            const dayIndex = (todayIndex + i) % 7;
                            const dayName = daysOrder[dayIndex];
                            const daySchedule = operatingHours[dayName];
                            
                            if (daySchedule && !daySchedule.isClosed && (i > 0 || currentMinutes < timeToMinutes(daySchedule.open))) {
                                nextOpenDayIndex = dayIndex;
                                nextOpenTime = daySchedule.open;
                                
                                if (i === 0) {
                                    nextOpenDayText = "hoje";
                                } else if (i === 1) {
                                    nextOpenDayText = "amanhã";
                                } else {
                                    const dayDisplayNames = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
                                    nextOpenDayText = dayDisplayNames[nextOpenDayIndex];
                                }
                                break;
                            }
                        }
                        
                        if (nextOpenDayIndex !== -1) {
                            statusHTML = `<span class="status-badge closed">Fechado</span> <span class="status-text">Abre ${nextOpenDayText} às ${nextOpenTime}</span>`;
                        } else {
                            statusHTML = `<span class="status-badge closed">Fechado</span>`;
                        }
                    }

                    statusHTML += ` • <a href="#" id="details-link" class="details-link">Detalhes</a>`;
                    container.innerHTML = statusHTML;
                    
                    const detailsContent = document.getElementById('hours-details-content');
                    let tableHTML = '<table class="hours-table">';
                    const displayOrder = [
                        { name: 'Segunda', key: 'segunda' }, { name: 'Terça', key: 'terca' },
                        { name: 'Quarta', key: 'quarta' }, { name: 'Quinta', key: 'quinta' },
                        { name: 'Sexta', key: 'sexta' }, { name: 'Sábado', key: 'sabado' },
                        { name: 'Domingo', key: 'domingo' }
                    ];

                    displayOrder.forEach(dayInfo => {
                        const schedule = operatingHours[dayInfo.key];
                        if (schedule) {
                            const timeRange = schedule.isClosed ? 'Fechado' : `${schedule.open} - ${schedule.close}`;
                            tableHTML += `<tr><td>${dayInfo.name}</td><td>${timeRange}</td></tr>`;
                        }
                    });

                    tableHTML += '</table>';
                    detailsContent.innerHTML = tableHTML;
                    
                    document.getElementById('details-link').addEventListener('click', (e) => {
                        e.preventDefault();
                        openModal('hours-details-modal');
                    });

                } catch (error) {
                    console.error("Erro ao processar os horários de funcionamento:", error);
                    container.innerHTML = `<span class="status-badge closed">Erro ao carregar</span>`;
                }
            } else {
                console.warn("Documento 'operatingHours' não encontrado no Firebase.");
                container.innerHTML = `<span class="status-badge closed">Horário indisponível</span>`;
            }
        }).catch(error => {
            console.error("Erro ao buscar horários de funcionamento:", error);
            container.innerHTML = `<span class="status-badge closed">Erro de conexão</span>`;
        });
    }


    function loadServices() {
        for (let i = 1; i <= 3; i++) {
            const serviceId = `service${i}`;
            db.collection('siteContent').doc(serviceId).get().then(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    const container = document.getElementById(`service-item-${i}`);
                    if(container) {
                        container.querySelector('.service-title').textContent = data.title || '';
                        container.querySelector('.service-description').textContent = data.description || '';
                    }
                }
            });
        }
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
                
                if (product.description) {
                    productEl.dataset.description = product.description;
                }

                if (product.category === 'acai') {
                    productEl.dataset.creamLimit = product.creamLimit || 0;
                    productEl.dataset.accompanimentLimit = product.accompanimentLimit || 0;
                }

                const buttonText = product.category === 'acai' ? 'Personalizar' : 'Adicionar';
                const descriptionHTML = product.description ? `<p class="product-description">${product.description}</p>` : '';

                productEl.innerHTML = `
                    <div class="product-info">
                        <img src="${product.imageUrl}" alt="${product.name}">
                        <div class="product-details">
                            <h3>${product.name}</h3>
                            ${descriptionHTML} 
                            <p class="price">R$ ${product.price.toFixed(2)}</p>
                        </div>
                    </div>
                    <div class="product-actions">
                        <button class="add-btn">${buttonText}</button>
                    </div>`;
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
            Object.values(containers).forEach(c => { if(c) c.innerHTML = ''; });
            snapshot.forEach(doc => {
                const option = doc.data();
                if (containers[option.group]) {
                    const container = containers[option.group];
                    const optionEl = document.createElement('div');
                    optionEl.className = 'option-item';
                    const priceText = option.price > 0 ? `<span>+ R$ ${option.price.toFixed(2)}</span>` : '';
                    const disabledAttr = !option.isAvailable ? 'disabled' : '';
                    const unavailableClass = !option.isAvailable ? 'class="unavailable"' : '';
                    optionEl.innerHTML = `
                        <label ${unavailableClass}>
                            <input type="checkbox" name="${option.group}" value="${option.name}" data-price="${option.price}" ${disabledAttr}> ${option.name}
                        </label>
                        ${priceText}`;
                    container.appendChild(optionEl);
                }
            });
        });
    }

    // --- FUNÇÕES DE LÓGICA DO SITE ---

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

    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('visible');
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('visible');
    }

    function openCustomizationModal(product, limits) {
        currentCustomizingProduct = { baseName: product.name, basePrice: product.price, quantity: 1, additionalPrice: 0 };
        currentLimits = limits;
        document.getElementById('cremes-badge').textContent = `Escolha até ${limits.cremes} opções.`;
        document.getElementById('acompanhamentos-badge').textContent = `Escolha até ${limits.acompanhamentos} opções.`;
        document.getElementById('custom-product-name').textContent = product.name;
        document.getElementById('customization-form').reset();
        document.querySelectorAll('#customization-form input[type="checkbox"]').forEach(cb => { if(!cb.disabled) cb.disabled = false; });
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
        const limit = currentLimits[groupName];
        if (limit === undefined) return;
        const form = checkbox.closest('form');
        const checkedboxes = form.querySelectorAll(`input[name="${groupName}"]:checked`);
        if (checkedboxes.length >= limit) {
            form.querySelectorAll(`input[name="${groupName}"]`).forEach(cb => { if(!cb.checked && !cb.disabled) cb.disabled = true; });
        } else {
            form.querySelectorAll(`input[name="${groupName}"]`).forEach(cb => { if(!cb.closest('label').classList.contains('unavailable')) cb.disabled = false; });
        }
    }

    function addCustomizedItemToCart() {
        const customizations = Array.from(document.getElementById('customization-form').querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
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
                
                const descriptionHTML = item.description ? `<div class="cart-item-description">${item.description}</div>` : '';
                const customizationsHTML = item.customizations.length > 0 ? `<div class="cart-item-customizations">${item.customizations.join(', ')}</div>` : '';
                
                cartItemsContainer.innerHTML += `
                    <div class="cart-item" data-index="${index}">
                        <div class="cart-item-details">
                            <span class="cart-item-name">${item.name}</span>
                            ${descriptionHTML}
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
        
        const deliveryMode = document.querySelector('input[name="delivery-type"]:checked') ? document.querySelector('input[name="delivery-type"]:checked').value : 'delivery';
        const currentDeliveryFee = deliveryMode === 'delivery' ? DELIVERY_FEE : 0;
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
        toast.className = ''; 
        toast.classList.add('show', type);
        setTimeout(() => toast.classList.remove('show'), 3500);
    }

    function setupScrollAnimations() {
        const observerOptions = { root: null, rootMargin: '0px', threshold: 0.1 };
        const observerCallback = (entries, observer) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    entry.target.style.transitionDelay = `${index * 100}ms`;
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        };
        const scrollObserver = new IntersectionObserver(observerCallback, observerOptions);
        document.querySelectorAll('.animate-on-scroll').forEach(el => scrollObserver.observe(el));
    }

    function handleScrollEffects() {
        const heroTexts = document.querySelectorAll('.hero-text');
        const scrollPosition = window.scrollY;
        const fadeOutDistance = 400;
        if (scrollPosition < fadeOutDistance) {
            const opacity = 1 - (scrollPosition / fadeOutDistance);
            const translateX = -scrollPosition / 5;
            heroTexts.forEach(text => { text.style.opacity = opacity; text.style.transform = `translateX(${translateX}px)`; });
        } else {
            heroTexts.forEach(text => { text.style.opacity = 0; text.style.transform = `translateX(${-fadeOutDistance / 5}px)`; });
        }
    }

    function generateWhatsAppMessage() {
        const name = document.getElementById('customer-name').value;
        const phone = document.getElementById('customer-phone').value;
        const deliveryMode = document.querySelector('input[name="delivery-type"]:checked').value;
        
        let addressInfo = '';
        if (deliveryMode === 'delivery') {
            const street = document.getElementById('street-name').value;
            const number = document.getElementById('house-number').value;
            const reference = document.getElementById('reference-point').value;
            addressInfo += `📍 *Endereço de Entrega:*\n`;
            addressInfo += `${street}, ${number}\n`;
            if (reference) {
                addressInfo += `_${reference}_\n`;
            }
        } else {
            addressInfo = `🛵 *Retirar no Local*\n`;
        }

        const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
        let paymentInfo = paymentMethod;

        if (paymentMethod === 'Dinheiro') {
            const needsChange = document.querySelector('input[name="needs-change"]:checked').value;
            if (needsChange === 'sim') {
                const changeAmount = document.getElementById('change-amount').value;
                if (changeAmount) {
                    paymentInfo += ` (Levar troco para R$ ${parseFloat(changeAmount).toFixed(2)})`;
                }
            }
        }
        
        const orderId = Date.now().toString().slice(-6);
        const now = new Date();
        const timestamp = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;

        let message = `📦 *Novo Pedido #${orderId}*\n\n`;
        
        message += `👤 *Cliente:*\n${name}\n\n`;
        message += `📞 *WhatsApp:*\n+${phone.replace(/\D/g, '')}\n\n`;
        
        message += addressInfo;
        
        message += `\n------------------------------------\n`;
        message += `🍨 *Itens do pedido:*\n`;
        
        cart.forEach(item => {
            message += `\n✅ *${item.quantity}x ${item.name}* – R$${(item.price * item.quantity).toFixed(2)}\n`;
            
            if (item.description) {
                message += `  • _${item.description}_\n`;
            }

            if (item.customizations.length > 0) {
                item.customizations.forEach(custom => {
                    message += `  • _${custom}_\n`;
                });
            }
        });

        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const currentDeliveryFee = deliveryMode === 'delivery' ? DELIVERY_FEE : 0;
        const total = subtotal + currentDeliveryFee;

        message += `\n------------------------------------\n`;
        message += `💵 *Pagamento:*\n`;
        message += `Subtotal: R$${subtotal.toFixed(2)}\n`;
        if (deliveryMode === 'delivery') {
            message += `Entrega: R$${DELIVERY_FEE.toFixed(2)}\n`;
        }
        message += `*Total: R$${total.toFixed(2)}*\n\n`;
        
        message += `*Forma de Pagamento:* ${paymentInfo}\n\n`;
        
        if (paymentMethod === 'Pix') {
            message += `⚠️ *Atenção:* Você escolheu pagamento via PIX. Por favor, envie o comprovante para que possamos processar seu pedido.\n\n`;
        }

        message += `${timestamp}`;

        return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    }
    
    function handleDeliveryTypeChange() {
        const deliveryMode = document.querySelector('input[name="delivery-type"]:checked').value;
        const addressFieldsContainer = document.getElementById('address-fields');
        const addressInputs = addressFieldsContainer.querySelectorAll('input[required]');
        
        if (deliveryMode === 'delivery') {
            addressFieldsContainer.style.display = 'block';
            addressInputs.forEach(input => input.required = true);
        } else {
            addressFieldsContainer.style.display = 'none';
            addressInputs.forEach(input => input.required = false);
        }
        updateCart();
    }
    
    // --- INÍCIO DA NOVA SEÇÃO: LÓGICA DO SISTEMA DE AVALIAÇÃO ---
    function initializeFeedbackSystem() {
        const stars = document.querySelectorAll('.star-rating .fas.fa-star');
        const submitBtn = document.getElementById('submit-feedback-btn');
        const commentBox = document.getElementById('feedback-comment');
        const feedbackSection = document.getElementById('feedback-section');
        const thanksSection = document.getElementById('feedback-thanks');
        let selectedRating = 0;

        function updateStars(rating, isPermanent = false) {
            stars.forEach(star => {
                const starValue = parseInt(star.dataset.value, 10);
                if (starValue <= rating) {
                    star.classList.add(isPermanent ? 'selected' : 'hover');
                    if (!isPermanent) star.classList.remove('selected');
                } else {
                    star.classList.remove(isPermanent ? 'selected' : 'hover');
                    if (!isPermanent) {
                        // Se não for permanente, checa se a estrela deve continuar selecionada
                        if (starValue > selectedRating) {
                           star.classList.remove('selected');
                        }
                    }
                }
            });
        }

        stars.forEach(star => {
            star.addEventListener('mouseover', () => {
                updateStars(parseInt(star.dataset.value, 10));
            });

            star.addEventListener('click', () => {
                selectedRating = parseInt(star.dataset.value, 10);
                updateStars(selectedRating, true);
            });
        });

        document.querySelector('.star-rating').addEventListener('mouseout', () => {
            updateStars(selectedRating);
        });

        submitBtn.addEventListener('click', () => {
            if (selectedRating === 0) {
                alert('Por favor, selecione uma nota de 1 a 5 estrelas.');
                return;
            }

            const comment = commentBox.value.trim();
            const feedbackData = {
                rating: selectedRating,
                comment: comment,
                timestamp: new Date()
            };

            submitBtn.disabled = true;
            submitBtn.textContent = 'Enviando...';

            db.collection('avaliacoes').add(feedbackData)
                .then(() => {
                    console.log("Avaliação salva com sucesso!");
                    feedbackSection.style.display = 'none';
                    thanksSection.style.display = 'block';
                })
                .catch(error => {
                    console.error("Erro ao salvar avaliação: ", error);
                    alert('Ocorreu um erro ao enviar sua avaliação. Tente novamente.');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Enviar Avaliação';
                });
        });
    }
    // --- FIM DA NOVA SEÇÃO ---

    function initialize() {
        loadBranding();
        loadOperatingStatus();
        loadServices();
        loadProducts();
        loadCustomizationOptions();
        loadOrderState(); 
        loadUserInfo(); 
        initializeFeedbackSystem(); // Ativa o sistema de avaliação

        window.addEventListener('scroll', handleScrollEffects);
        
        document.getElementById('address-form').addEventListener('input', () => {
            saveOrderState(); 
            saveUserInfo();
        });

        document.querySelectorAll('input[name="payment"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const changeSection = document.getElementById('change-section');
                changeSection.style.display = e.target.value === 'Dinheiro' ? 'block' : 'none';
            });
        });

        document.querySelectorAll('input[name="needs-change"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const changeAmountGroup = document.getElementById('change-amount-group');
                changeAmountGroup.style.display = e.target.value === 'sim' ? 'block' : 'none';
            });
        });

        document.querySelectorAll('input[name="delivery-type"]').forEach(radio => {
            radio.addEventListener('change', handleDeliveryTypeChange);
        });

        document.body.addEventListener('click', (e) => {
            const productItem = e.target.closest('.product-item');
            if (productItem && !productItem.classList.contains('unavailable')) {
                if (!e.target.closest('.add-btn')) {
                    document.querySelectorAll('.product-item.active').forEach(item => item.classList.remove('active'));
                    productItem.classList.add('active');
                }
            }
            
            if (e.target.matches('.add-btn')) {
                const productItemForModal = e.target.closest('.product-item');
                if (productItemForModal && !productItemForModal.classList.contains('unavailable')) {
                    const productCategory = productItemForModal.dataset.category;
                    const name = productItemForModal.dataset.name;
                    const price = parseFloat(productItemForModal.dataset.price);
                    
                    const description = productItemForModal.dataset.description || '';

                    if (!name || isNaN(price)) {
                        console.error("Dados do produto inválidos:", productItemForModal.dataset);
                        return;
                    }

                    const productData = { name, price, description };

                    if (productCategory === 'acai') {
                        const limits = {
                            cremes: parseInt(productItemForModal.dataset.creamLimit, 10),
                            acompanhamentos: parseInt(productItemForModal.dataset.accompanimentLimit, 10)
                        };
                        openCustomizationModal(productData, limits);
                    } else {
                        const cartItem = {
                            ...productData,
                            quantity: 1,
                            customizations: [],
                            uniqueId: Date.now()
                        };
                        cart.push(cartItem);
                        updateCart();
                        showToastNotification(`${productData.name} foi adicionado ao carrinho!`);
                    }
                }
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
            e.target.dataset.state = (e.target.dataset.state || 'more') === 'more' ? 'less' : 'more';
            updateProductsView();
        });

        document.getElementById('cart-modal').addEventListener('click', (e) => {
            if (e.target.id === 'checkout-btn' && cart.length > 0) {
                closeModal('cart-modal');
                openModal('address-modal');
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
                    // Copia o conteúdo do carrinho para a revisão
                    document.getElementById('review-items').innerHTML = document.getElementById('cart-items').innerHTML;

                    // Lógica para detalhes de endereço e pagamento
                    const deliveryMode = document.querySelector('input[name="delivery-type"]:checked').value;
                    const addressLabel = document.getElementById('review-address-label');
                    let addressDetails = '';
                    if (deliveryMode === 'delivery') {
                        addressLabel.innerText = 'Endereço de Entrega:';
                        const street = document.getElementById('street-name').value;
                        const number = document.getElementById('house-number').value;
                        const reference = document.getElementById('reference-point').value;
                        addressDetails = `${street}, ${number}${reference ? ` (${reference})` : ''}`;
                    } else {
                        addressLabel.innerText = 'Modalidade:';
                        addressDetails = 'Retirar no local';
                    }
                    document.getElementById('review-address-details').innerText = addressDetails;

                    const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
                    let paymentInfo = paymentMethod;
                    if (paymentMethod === 'Dinheiro') {
                        const needsChange = document.querySelector('input[name="needs-change"]:checked').value;
                        if (needsChange === 'sim') {
                            const changeAmount = document.getElementById('change-amount').value;
                            if (changeAmount) paymentInfo += ` (Troco para R$ ${changeAmount})`;
                        }
                    }
                    document.getElementById('review-payment-method').innerText = paymentInfo;
                    
                    document.getElementById('review-total-price').innerText = document.getElementById('total-price').innerText;
                    
                    closeModal('address-modal');
                    openModal('review-modal');
                } else { 
                    form.reportValidity(); 
                }
            }
        });

        document.getElementById('review-modal').addEventListener('click', async (e) => {
             if (e.target.id === 'back-to-address-btn') { closeModal('review-modal'); openModal('address-modal'); }
             if (e.target.id === 'submit-order-btn') {
                const btn = e.target;
                btn.disabled = true;
                btn.textContent = 'Enviando...';
                
                const whatsappUrl = generateWhatsAppMessage();
                
                window.open(whatsappUrl, '_blank');
                
                cart = [];
                updateCart(); 
                closeModal('review-modal');
                
                openModal('submit-modal');
                
                btn.disabled = false;
                btn.textContent = 'Enviar Pedido';
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
        
        handleDeliveryTypeChange();
        
        console.log("Inicialização de eventos concluída.");
    }

    initialize();
});