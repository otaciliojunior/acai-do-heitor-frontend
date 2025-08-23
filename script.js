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

    // --- 1. CONFIGURAÇÕES ---
    const BACKEND_URL = 'https://acai-do-heitor-backend.onrender.com';
    const WHATSAPP_NUMBER = "5584991393356";
    const PRODUCTS_LIMIT = 6;
    const ORDER_EXPIRATION_MINUTES = 20;

    // --- ESTADO DO APLICATIVO ---
    let cart = [];
    let currentCustomizingProduct = {};
    let currentLimits = { cremes: 0, acompanhamentos: 0 };
    let activeOrderId = null;
    let trackingInterval = null;


    // --- FUNÇÕES DE ACOMPANHAMENTO DE PEDIDO ---
    function startOrderTracking(orderId, orderNumber, deliveryMode) {
        activeOrderId = orderId;
        localStorage.setItem('activeOrderId', orderId);
        localStorage.setItem('activeOrderNumber', orderNumber);
        localStorage.setItem('activeOrderMode', deliveryMode);

        const trackingOrderIdElement = document.getElementById('tracking-order-id');
        if (trackingOrderIdElement) {
            trackingOrderIdElement.textContent = `Acompanhando Pedido #${orderNumber}`;
        }
        
        setupTrackingUI(deliveryMode);
        openModal('tracking-modal');
        
        if (trackingInterval) clearInterval(trackingInterval);
        trackingInterval = setInterval(() => checkOrderStatus(orderId), 20000);
        checkOrderStatus(orderId);
    }

    async function checkOrderStatus(orderId) {
        if (!orderId) return;
        try {
            const response = await fetch(`${BACKEND_URL}/orders/${orderId}`);
            if (!response.ok) {
                if (response.status === 404) {
                    stopOrderTracking();
                    closeModal('tracking-modal');
                    showToastNotification("Seu pedido foi finalizado! Obrigado!", 'info');
                }
                throw new Error('Status do pedido não pôde ser verificado.');
            }
            const data = await response.json();
            updateTrackingUI(data.status, data.deliveryMode);
        } catch (error) {
            console.error("Erro ao verificar status:", error);
            if (trackingInterval) clearInterval(trackingInterval);
        }
    }
    
    function setupTrackingUI(deliveryMode) {
        const deliveryStep = document.querySelector('.timeline-step[data-mode="delivery-only"]');
        const pickupStep = document.querySelector('.timeline-step[data-mode="pickup-only"]');

        if (deliveryStep && pickupStep) {
            if (deliveryMode === 'delivery') {
                deliveryStep.style.display = 'flex';
                pickupStep.style.display = 'none';
            } else { 
                deliveryStep.style.display = 'none';
                pickupStep.style.display = 'flex';
            }
        }
    }

    function updateTrackingUI(status, deliveryMode) {
        const timelineContainer = document.querySelector('.tracking-timeline');
        if (!timelineContainer) return;
        
        setupTrackingUI(deliveryMode);

        const statuses = deliveryMode === 'delivery'
            ? ['novo', 'preparo', 'entrega', 'concluido']
            : ['novo', 'preparo', 'pronto_retirada', 'concluido'];
        
        timelineContainer.className = 'tracking-timeline';
        const progressPercentage = {
            'novo': '0%',
            'preparo': '33%',
            'entrega': '66%',
            'pronto_retirada': '66%',
            'concluido': '100%'
        };
        timelineContainer.querySelector('.timeline-progress').style.height = progressPercentage[status] || '0%';

        let statusIndex = statuses.indexOf(status);

        document.querySelectorAll('.timeline-step').forEach(step => {
            const stepStatus = step.dataset.status;
            const stepIndex = statuses.indexOf(stepStatus);

            step.classList.remove('is-active', 'is-complete');
            if (stepIndex < statusIndex) {
                step.classList.add('is-complete');
            } else if (stepIndex === statusIndex) {
                step.classList.add('is-active');
            }
        });

        if (status === 'concluido') {
            stopOrderTracking();
        }
    }

    function stopOrderTracking() {
        if (trackingInterval) clearInterval(trackingInterval);
        trackingInterval = null;
        activeOrderId = null;
        localStorage.removeItem('activeOrderId');
        localStorage.removeItem('activeOrderNumber');
        localStorage.removeItem('activeOrderMode');
    }
    
    function checkForActiveOrder() {
        const savedOrderId = localStorage.getItem('activeOrderId');
        const savedOrderNumber = localStorage.getItem('activeOrderNumber');
        const savedOrderMode = localStorage.getItem('activeOrderMode');
        if (savedOrderId && savedOrderNumber && savedOrderMode) {
            startOrderTracking(savedOrderId, savedOrderNumber, savedOrderMode);
        }
    }
    
    // --- FUNÇÕES DE GERENCIAMENTO DE ESTADO ---
    function saveOrderState() { try { const addressForm=document.getElementById('address-form'); const formData=new FormData(addressForm); const addressData=Object.fromEntries(formData.entries()); const orderState={cart:cart,address:addressData}; const stateWithTimestamp={data:orderState,timestamp:new Date().getTime()}; localStorage.setItem('orderState',JSON.stringify(stateWithTimestamp)); } catch (error) { console.error("Erro ao salvar o estado do pedido:", error); } }
    function loadOrderState() { const savedStateJSON=localStorage.getItem('orderState'); if (!savedStateJSON) return; try { const savedStateWithTimestamp=JSON.parse(savedStateJSON); const now=new Date().getTime(); const expirationTime=ORDER_EXPIRATION_MINUTES*60*1000; if (now - savedStateWithTimestamp.timestamp < expirationTime) { const savedData=savedStateWithTimestamp.data; cart=savedData.cart || []; updateCart(); if (savedData.address) { const address=savedData.address; const form=document.getElementById('address-form'); for (const key in address) { const input=form.elements[key]; if (input) { if (input.type==='radio') { if (input.value===address[key]) { input.checked=true; input.dispatchEvent(new Event('change', { bubbles: true })); } } else { input.value=address[key]; } } } } } else { localStorage.removeItem('orderState'); } } catch (error) { console.error("Erro ao carregar o estado do pedido:", error); localStorage.removeItem('orderState'); } }
    function saveUserInfo() { try { const form=document.getElementById('address-form'); const userInfo={name:form.elements['customer-name'].value,phone:form.elements['customer-phone'].value,street:form.elements['street-name'].value,number:form.elements['house-number'].value,location:form.elements['customer-location'].value}; localStorage.setItem('userInfo',JSON.stringify(userInfo)); } catch (error) { console.error("Erro ao salvar dados do usuário:", error); } }
    function loadUserInfo() { try { const savedUserJSON=localStorage.getItem('userInfo'); if (savedUserJSON) { const userInfo=JSON.parse(savedUserJSON); const form=document.getElementById('address-form'); if (form && userInfo) { form.elements['customer-name'].value=userInfo.name || ''; form.elements['customer-phone'].value=userInfo.phone || ''; form.elements['street-name'].value=userInfo.street || ''; form.elements['house-number'].value=userInfo.number || ''; if (userInfo.location) { const locationInput=document.getElementById('customer-location'); const locationTextSpan=document.getElementById('selected-location-text'); const locations=getLocationOptions(); const selectedLocation=locations.find(loc => loc.value===userInfo.location); if (selectedLocation) { locationInput.value=selectedLocation.value; locationTextSpan.textContent=selectedLocation.text; locationTextSpan.classList.remove('placeholder'); } } } } } catch (error) { console.error("Erro ao carregar dados do usuário:", error); localStorage.removeItem('userInfo'); } }

    // --- FUNÇÕES DE CONTEÚDO DINÂMICO ---
    function loadBranding() { db.collection('siteContent').doc('branding').get().then(doc => { if (doc.exists && doc.data().logoUrl) { document.getElementById('logo-img').src=doc.data().logoUrl; } }); }
    function loadOperatingStatus() { db.collection('siteContent').doc('operatingHours').get().then(doc => { if (doc.exists) { try { const operatingHours=doc.data(); const daysOrder=['domingo','segunda','terca','quarta','quinta','sexta','sabado']; const now=new Date(); const todayIndex=now.getDay(); const todayName=daysOrder[todayIndex]; const todayHours=operatingHours[todayName]; if (!todayHours) { return; } let statusHTML=''; const timeToMinutes=(timeStr) => { if (!timeStr) return 0; const [hours, minutes]=timeStr.split(':').map(Number); return hours*60+minutes; }; const currentMinutes=now.getHours()*60+now.getMinutes(); if (todayHours.isClosed===false && currentMinutes >=timeToMinutes(todayHours.open) && currentMinutes < timeToMinutes(todayHours.close)) { statusHTML=`<span class="status-badge open">Aberto agora</span> <span class="status-text">Fecha às ${todayHours.close}</span>`; } else { let nextOpenDayIndex=-1; let nextOpenTime=''; let nextOpenDayText=''; for (let i=0; i < 7; i++) { const dayIndex=(todayIndex+i) % 7; const dayName=daysOrder[dayIndex]; const daySchedule=operatingHours[dayName]; if (daySchedule && !daySchedule.isClosed && (i > 0 || currentMinutes < timeToMinutes(daySchedule.open))) { nextOpenDayIndex=dayIndex; nextOpenTime=daySchedule.open; if (i===0) { nextOpenDayText="hoje"; } else if (i===1) { nextOpenDayText="amanhã"; } else { const dayDisplayNames=['domingo','segunda','terça','quarta','quinta','sexta','sábado']; nextOpenDayText=dayDisplayNames[nextOpenDayIndex]; } break; } } if (nextOpenDayIndex !==-1) { statusHTML=`<span class="status-badge closed">Fechado</span> <span class="status-text">Abre ${nextOpenDayText} às ${nextOpenTime}</span>`; } else { statusHTML=`<span class="status-badge closed">Fechado</span>`; } } statusHTML +=` • <a href="#" id="details-link" class="details-link">Detalhes</a>`; document.getElementById('operating-hours-container').innerHTML=statusHTML; const detailsContent=document.getElementById('hours-details-content'); let tableHTML='<table class="hours-table">'; const displayOrder=[{name:'Segunda',key:'segunda'},{name:'Terça',key:'terca'},{name:'Quarta',key:'quarta'},{name:'Quinta',key:'quinta'},{name:'Sexta',key:'sexta'},{name:'Sábado',key:'sabado'},{name:'Domingo',key:'domingo'}]; displayOrder.forEach(dayInfo => { const schedule=operatingHours[dayInfo.key]; if (schedule) { const timeRange=schedule.isClosed ? 'Fechado' : `${schedule.open} - ${schedule.close}`; tableHTML +=`<tr><td>${dayInfo.name}</td><td>${timeRange}</td></tr>`; } }); tableHTML +='</table>'; detailsContent.innerHTML=tableHTML; document.getElementById('details-link').addEventListener('click', (e) => { e.preventDefault(); openModal('hours-details-modal'); }); } catch (error) { console.error("Erro ao processar os horários de funcionamento:", error); } } }); }
    function loadServices() { for (let i=1; i <=3; i++) { const serviceId=`service${i}`; db.collection('siteContent').doc(serviceId).get().then(doc => { if (doc.exists) { const data=doc.data(); const container=document.getElementById(`service-item-${i}`); if(container) { container.querySelector('.service-title').textContent=data.title || ''; container.querySelector('.service-description').textContent=data.description || ''; } } }); } }
    function loadProducts() { const productListContainer=document.querySelector('.product-list'); if (!productListContainer) return; db.collection('products').orderBy('position').get().then(snapshot => { productListContainer.innerHTML=''; snapshot.forEach(doc => { const product=doc.data(); const productEl=document.createElement('div'); productEl.className='product-item animate-on-scroll'; if (!product.isAvailable) productEl.classList.add('unavailable'); productEl.dataset.category=product.category; productEl.dataset.name=product.name; productEl.dataset.price=product.price.toFixed(2); if (product.description) { productEl.dataset.description=product.description; } if (product.category==='acai') { productEl.dataset.creamLimit=product.creamLimit || 0; productEl.dataset.accompanimentLimit=product.accompanimentLimit || 0; } const buttonText=product.category==='acai' ? 'Personalizar' : 'Adicionar'; const descriptionHTML=product.description ? `<p class="product-description">${product.description}</p>` : ''; productEl.innerHTML=`<div class="product-info"><img src="${product.imageUrl}" alt="${product.name}"><div class="product-details"><h3>${product.name}</h3>${descriptionHTML}<p class="price">R$ ${product.price.toFixed(2)}</p></div></div><div class="product-actions"><button class="add-btn">${buttonText}</button></div>`; productListContainer.appendChild(productEl); }); updateProductsView(); setupScrollAnimations(); }); }
    function loadCustomizationOptions() { const containers={cremes:document.getElementById('custom-cremes'),acompanhamentos:document.getElementById('custom-acompanhamentos'),adicionais:document.getElementById('custom-adicionais')}; db.collection('customizationOptions').orderBy('position').get().then(snapshot => { Object.values(containers).forEach(c => { if(c) c.innerHTML=''; }); snapshot.forEach(doc => { const option=doc.data(); if (containers[option.group]) { const container=containers[option.group]; const optionEl=document.createElement('div'); optionEl.className='option-item'; const priceText=option.price > 0 ? `<span>+ R$ ${option.price.toFixed(2)}</span>` : ''; const disabledAttr=!option.isAvailable ? 'disabled' : ''; const unavailableClass=!option.isAvailable ? 'class="unavailable"' : ''; optionEl.innerHTML=`<label ${unavailableClass}><input type="checkbox" name="${option.group}" value="${option.name}" data-price="${option.price}" ${disabledAttr}> ${option.name}</label>${priceText}`; container.appendChild(optionEl); } }); }); }

    // --- FUNÇÕES DE LÓGICA DO SITE ---
    function updateProductsView() { const productList=document.querySelector('.product-list'); const showMoreBtn=document.getElementById('show-more-btn'); const activeFilter=document.querySelector('.filter-btn.active').dataset.category; const allProducts=Array.from(productList.querySelectorAll('.product-item')); allProducts.forEach(p => p.classList.add('hidden')); const visibleProducts=allProducts.filter(p => activeFilter==='all' || p.dataset.category===activeFilter); const isShowingAll=showMoreBtn.dataset.state==='less'; visibleProducts.forEach((product, index) => { if (isShowingAll || index < PRODUCTS_LIMIT) { product.classList.remove('hidden'); } }); if (visibleProducts.length > PRODUCTS_LIMIT) { showMoreBtn.style.display='block'; if (isShowingAll) { showMoreBtn.innerHTML=`<i class="fas fa-chevron-up"></i> Ver menos`; } else { showMoreBtn.innerHTML=`<i class="fas fa-chevron-down"></i> Ver mais`; } } else { showMoreBtn.style.display='none'; } }
    function openModal(modalId) { const modal=document.getElementById(modalId); if (modal) modal.classList.add('visible'); }
    function closeModal(modalId) { const modal=document.getElementById(modalId); if (modal) modal.classList.remove('visible'); }
    function openCustomizationModal(product, limits) { currentCustomizingProduct={baseName:product.name,basePrice:product.price,quantity:1,additionalPrice:0}; currentLimits=limits; document.getElementById('cremes-badge').textContent=`Escolha até ${limits.cremes} opções.`; document.getElementById('acompanhamentos-badge').textContent=`Escolha até ${limits.acompanhamentos} opções.`; document.getElementById('custom-product-name').textContent=product.name; document.getElementById('customization-form').reset(); document.querySelectorAll('#customization-form input[type="checkbox"]').forEach(cb => { if(!cb.disabled) cb.disabled=false; }); document.getElementById('custom-quantity').textContent='1'; updateCustomPrice(); openModal('customization-modal'); }
    function updateCustomPrice() { const form=document.getElementById('customization-form'); let additionalPrice=0; form.querySelectorAll('input[name="adicionais"]:checked').forEach(addon => { additionalPrice +=parseFloat(addon.dataset.price); }); currentCustomizingProduct.additionalPrice=additionalPrice; const finalPrice=(currentCustomizingProduct.basePrice+additionalPrice)*currentCustomizingProduct.quantity; document.getElementById('custom-product-price').textContent=`R$ ${finalPrice.toFixed(2)}`; }
    function enforceSelectionLimits(event) { const checkbox=event.target; if (checkbox.type !=='checkbox') return; const groupName=checkbox.name; const limit=currentLimits[groupName]; if (limit===undefined) return; const form=checkbox.closest('form'); const checkedboxes=form.querySelectorAll(`input[name="${groupName}"]:checked`); if (checkedboxes.length >=limit) { form.querySelectorAll(`input[name="${groupName}"]`).forEach(cb => { if(!cb.checked && !cb.disabled) cb.disabled=true; }); } else { form.querySelectorAll(`input[name="${groupName}"]`).forEach(cb => { if(!cb.closest('label').classList.contains('unavailable')) cb.disabled=false; }); } }
    function addCustomizedItemToCart() { const customizations=Array.from(document.getElementById('customization-form').querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value); const finalProduct={name:currentCustomizingProduct.baseName,price:currentCustomizingProduct.basePrice+currentCustomizingProduct.additionalPrice,quantity:currentCustomizingProduct.quantity,customizations:customizations,uniqueId:Date.now()}; cart.push(finalProduct); showToastNotification("Item adicionado ao carrinho!"); updateCart(); closeModal('customization-modal'); }
    function updateCart() { const cartItemsContainer=document.getElementById('cart-items'); cartItemsContainer.innerHTML=''; let subtotal=0; if (cart.length===0) { cartItemsContainer.innerHTML='<p class="empty-cart-message">Seu carrinho está vazio.</p>'; } else { cart.forEach((item, index) => { subtotal +=item.price*item.quantity; const descriptionHTML=item.description ? `<div class="cart-item-description">${item.description}</div>` : ''; const customizationsHTML=item.customizations.length > 0 ? `<div class="cart-item-customizations">${item.customizations.join(', ')}</div>` : ''; cartItemsContainer.innerHTML +=`<div class="cart-item" data-index="${index}"><div class="cart-item-details"><span class="cart-item-name">${item.name}</span>${descriptionHTML}${customizationsHTML}</div><div class="quantity-controls"><button class="quantity-btn" data-action="decrease">-</button><span class="quantity-text">${item.quantity}</span><button class="quantity-btn" data-action="increase">+</button></div><div class="cart-item-actions"><span class="cart-item-price">R$ ${(item.price*item.quantity).toFixed(2)}</span><button class="remove-btn">&times;</button></div></div>`; }); } const deliveryMode=document.querySelector('input[name="delivery-type"]:checked') ? document.querySelector('input[name="delivery-type"]:checked').value : 'delivery'; let currentDeliveryFee=0; if (deliveryMode==='delivery') { const locationInput=document.getElementById('customer-location'); if (locationInput && locationInput.value) { currentDeliveryFee=parseFloat(locationInput.value); } } const total=subtotal+currentDeliveryFee; document.getElementById('subtotal').innerText=`R$ ${subtotal.toFixed(2)}`; document.getElementById('delivery-fee').innerText=`R$ ${currentDeliveryFee.toFixed(2)}`; document.getElementById('total-price').innerText=`R$ ${total.toFixed(2)}`; document.getElementById('checkout-btn').disabled=cart.length===0; const totalItems=cart.reduce((sum, item) => sum+item.quantity, 0); document.getElementById('floating-cart-count').innerText=totalItems; document.getElementById('floating-cart-btn').classList.toggle('visible', totalItems > 0); saveOrderState(); }
    function showToastNotification(message, type='success') { const toast=document.getElementById('toast-notification'); toast.textContent=message; toast.className=''; toast.classList.add('show', type); setTimeout(() => toast.classList.remove('show'), 3500); }
    function setupScrollAnimations() { const observerOptions={root:null,rootMargin:'0px',threshold:0.1}; const observerCallback=(entries, observer) => { entries.forEach((entry, index) => { if (entry.isIntersecting) { entry.target.style.transitionDelay=`${index*100}ms`; entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }); }; const scrollObserver=new IntersectionObserver(observerCallback, observerOptions); document.querySelectorAll('.animate-on-scroll').forEach(el => scrollObserver.observe(el)); }
    function handleScrollEffects() { const heroTexts=document.querySelectorAll('.hero-text'); const scrollPosition=window.scrollY; const fadeOutDistance=400; if (scrollPosition < fadeOutDistance) { const opacity=1 - (scrollPosition/fadeOutDistance); const translateX=-scrollPosition/5; heroTexts.forEach(text => { text.style.opacity=opacity; text.style.transform=`translateX(${translateX}px)`; }); } else { heroTexts.forEach(text => { text.style.opacity=0; text.style.transform=`translateX(${-fadeOutDistance/5}px)`; }); } }
    
    // ======================= INÍCIO DA ALTERAÇÃO =======================
    function generateWhatsAppMessage() {
        const name = document.getElementById('customer-name').value;
        const phone = document.getElementById('customer-phone').value;
        const deliveryMode = document.querySelector('input[name="delivery-type"]:checked').value;
    
        let addressInfo = '';
        if (deliveryMode === 'delivery') {
            const street = document.getElementById('street-name').value;
            const number = document.getElementById('house-number').value;
            const locationText = document.getElementById('selected-location-text').textContent;
            addressInfo += `📍 *Endereço de Entrega:*\n`;
            addressInfo += `${street}, ${number}\n`;
            addressInfo += `*Localidade:* ${locationText}\n`;
        } else {
            addressInfo = `🛵 *Retirar no Local*\n`;
        }
    
        const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
        const orderId = Date.now().toString().slice(-6);
        const now = new Date();
        const timestamp = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}`;
        
        let message = `📦 *Pedido #${orderId}*\n\n`;
        message += `👤 *Cliente:*\n${name}\n\n`;
        message += `📞 *WhatsApp:*\n+${phone.replace(/\D/g, '')}\n\n`;
        message += addressInfo;
        message += `\n------------------------------------\n`;
        message += `🍨 *Itens do pedido:*\n`;
        cart.forEach(item => {
            message += `\n✅ *${item.quantity}x ${item.name}* – R$${(item.price*item.quantity).toFixed(2)}\n`;
            if (item.customizations.length > 0) {
                message += `  • _${item.customizations.join(', ')}_\n`;
            }
        });
    
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        let currentDeliveryFee = 0;
        if (deliveryMode === 'delivery') {
            const locationInput = document.getElementById('customer-location');
            if (locationInput && locationInput.value) {
                currentDeliveryFee = parseFloat(locationInput.value);
            }
        }
        const total = subtotal + currentDeliveryFee;
    
        message += `\n------------------------------------\n`;
        message += `💵 *Pagamento:*\n`;
        message += `Subtotal: R$${subtotal.toFixed(2)}\n`;
        if (deliveryMode === 'delivery') {
            message += `Entrega: R$${currentDeliveryFee.toFixed(2)}\n`;
        }
        message += `*Total: R$${total.toFixed(2)}*\n\n`;
    
        // Lógica de troco para o WhatsApp
        if (paymentMethod === 'Dinheiro') {
            const needsChange = document.querySelector('input[name="needs-change"]:checked').value;
            if (needsChange === 'sim') {
                const changeAmountInput = document.getElementById('change-amount');
                if (changeAmountInput && changeAmountInput.value) {
                    const changeAmount = parseFloat(changeAmountInput.value);
                    const troco = changeAmount - total;
                    if (troco >= 0) {
                        message += `*Forma de Pagamento:* Dinheiro\n`;
                        message += `(Pagar com: R$ ${changeAmount.toFixed(2)})\n`;
                        message += `*TROCO: R$ ${troco.toFixed(2)}*\n\n`;
                    } else {
                        message += `*Forma de Pagamento:* Dinheiro (Valor para troco inválido)\n\n`;
                    }
                } else {
                    message += `*Forma de Pagamento:* Dinheiro (Informar valor para troco)\n\n`;
                }
            } else {
                message += `*Forma de Pagamento:* Dinheiro (Não precisa de troco)\n\n`;
            }
        } else {
            message += `*Forma de Pagamento:* ${paymentMethod}\n\n`;
        }
    
        message += `${timestamp}`;
        return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    }
    
    function generatePrinterFriendlyText(orderId) {
        const name = document.getElementById('customer-name').value;
        const phone = document.getElementById('customer-phone').value;
        const deliveryMode = document.querySelector('input[name="delivery-type"]:checked').value;
    
        let text = `PEDIDO #${orderId}\n`;
        text += `Cliente: ${name}\n`;
        text += `WhatsApp: ${phone}\n\n`;
    
        if (deliveryMode === 'delivery') {
            const street = document.getElementById('street-name').value;
            const number = document.getElementById('house-number').value;
            const locationText = document.getElementById('selected-location-text').textContent.split('–')[0].trim();
            text += `*** ENTREGA ***\n`;
            text += `Local: ${locationText}\n`;
            text += `Rua: ${street}, N°: ${number}\n`;
        } else {
            text += `*** RETIRADA NO LOCAL ***\n`;
        }
        
        text += `--------------------------------\n`;
        
        cart.forEach(item => {
            text += `${item.quantity}x ${item.name}\n`;
            if (item.customizations.length > 0) {
                text += `  -> ${item.customizations.join(', ')}\n`;
            }
        });
    
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        let currentDeliveryFee = 0;
        if (deliveryMode === 'delivery') {
            const locationInput = document.getElementById('customer-location');
            if (locationInput && locationInput.value) {
                currentDeliveryFee = parseFloat(locationInput.value);
            }
        }
        const total = subtotal + currentDeliveryFee;
        const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
    
        text += `--------------------------------\n`;
        text += `TOTAL: R$ ${total.toFixed(2)}\n`;
        text += `PAGAMENTO: ${paymentMethod}\n`;
    
        // Lógica de troco para o Painel/Impressão
        if (paymentMethod === 'Dinheiro') {
            const needsChange = document.querySelector('input[name="needs-change"]:checked').value;
            if (needsChange === 'sim') {
                const changeAmountInput = document.getElementById('change-amount');
                if (changeAmountInput && changeAmountInput.value) {
                    const changeAmount = parseFloat(changeAmountInput.value);
                    const troco = changeAmount - total;
                    if (troco >= 0) {
                        text += `Pagar com: R$ ${changeAmount.toFixed(2)}\n`;
                        text += `TROCO: R$ ${troco.toFixed(2)}\n`;
                    }
                }
            }
        }
        
        const now = new Date();
        text += `\n${now.toLocaleDateString('pt-BR')} as ${now.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}`;
        
        return text;
    }
    // ======================== FIM DA ALTERAÇÃO =========================
    
    async function saveOrderToBackend() {
        const orderId = Date.now().toString().slice(-6);
        const printerText = generatePrinterFriendlyText(orderId);
        const deliveryMode = document.querySelector('input[name="delivery-type"]:checked').value;
        let deliveryFee = 0;
        if (deliveryMode === 'delivery') {
             const locationInput = document.getElementById('customer-location');
             if (locationInput && locationInput.value) {
                deliveryFee = parseFloat(locationInput.value);
             }
        }
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        const orderData = {
            orderId: orderId,
            customerName: document.getElementById('customer-name').value,
            customerPhone: document.getElementById('customer-phone').value,
            deliveryMode: deliveryMode,
            address: deliveryMode === 'delivery' ? { street: document.getElementById('street-name').value, number: document.getElementById('house-number').value, location: document.getElementById('selected-location-text').textContent } : null,
            paymentMethod: document.querySelector('input[name="payment"]:checked').value,
            items: cart,
            totals: { subtotal: subtotal, deliveryFee: deliveryFee, total: subtotal + deliveryFee },
            printerFriendlyText: printerText,
        };

        try {
            const response = await fetch(`${BACKEND_URL}/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData),
            });

            if (!response.ok) {
                throw new Error('Falha ao enviar o pedido para o servidor.');
            }

            const result = await response.json();
            return result; 
        } catch (error) {
            console.error("Erro ao salvar pedido via backend: ", error);
            alert("Ocorreu um erro ao registrar seu pedido. Você ainda será direcionado para o WhatsApp para garantir seu pedido.");
            return null;
        }
    }


    function handleDeliveryTypeChange() { const deliveryMode = document.querySelector('input[name="delivery-type"]:checked').value; const addressFieldsContainer = document.getElementById('address-fields'); const locationInput = document.getElementById('customer-location'); const streetInput = document.getElementById('street-name'); const numberInput = document.getElementById('house-number'); if (deliveryMode === 'delivery') { addressFieldsContainer.style.display = 'block'; locationInput.required = true; streetInput.required = true; numberInput.required = true; } else { addressFieldsContainer.style.display = 'none'; locationInput.required = false; streetInput.required = false; numberInput.required = false; locationInput.value = ''; } updateCart(); }
    function getLocationOptions() { return [ { value: '0.00', text: 'Assentamento – Entrega grátis' }, { value: '3.00', text: 'Riacho do Sangue – R$ 3,00' }, { value: '4.00', text: 'Riacho de Benção – R$ 4,00' }, { value: '4.00', text: 'Peri Peri – R$ 4,00' }, { value: '3.00', text: 'Quilombo – R$ 3,00' }, { value: '3.00', text: 'Tabatinga – R$ 3,00' }, { value: '4.00', text: 'Lagoa Seca – R$ 4,00' }, { value: '5.00', text: 'Barro Branco – R$ 5,00' }, { value: '6.00', text: 'Lagoa do Boi – R$ 6,00' }, { value: '8.00', text: 'Cajarana – R$ 8,00' }, { value: '10.00', text: 'Canabrava – R$ 10,00' } ]; }
    function initializeFeedbackSystem() { const feedbackSection = document.getElementById('feedback-section'); if (!feedbackSection) { return; } const stars = feedbackSection.querySelectorAll('.star-rating .fas.fa-star'); const submitBtn = feedbackSection.querySelector('#submit-feedback-btn'); const commentBox = feedbackSection.querySelector('#feedback-comment'); const thanksSection = document.getElementById('feedback-thanks'); if(!stars.length || !submitBtn || !commentBox || !thanksSection) return; let selectedRating = 0; function updateStars(rating, isPermanent = false) { stars.forEach(star => { const starValue = parseInt(star.dataset.value, 10); star.classList.toggle('selected', isPermanent && starValue <= rating); star.classList.toggle('hover', !isPermanent && starValue <= rating); }); } stars.forEach(star => { star.addEventListener('mouseover', () => updateStars(parseInt(star.dataset.value, 10))); star.addEventListener('click', () => { selectedRating = parseInt(star.dataset.value, 10); updateStars(selectedRating, true); }); }); const starRatingContainer = feedbackSection.querySelector('.star-rating'); if (starRatingContainer) { starRatingContainer.addEventListener('mouseout', () => updateStars(selectedRating, true)); } submitBtn.addEventListener('click', () => { if (selectedRating === 0) { alert('Por favor, selecione uma nota de 1 a 5 estrelas.'); return; } submitBtn.disabled = true; submitBtn.textContent = 'Enviando...'; db.collection('avaliacoes').add({ rating: selectedRating, comment: commentBox.value.trim(), timestamp: new Date() }).then(() => { feedbackSection.style.display = 'none'; if(thanksSection) thanksSection.style.display = 'block'; }).catch(error => { console.error("Erro ao salvar avaliação: ", error); alert('Ocorreu um erro ao enviar sua avaliação.'); submitBtn.disabled = false; submitBtn.textContent = 'Enviar Avaliação'; }); }); }
    function initializeCustomSelect() { const trigger = document.getElementById('custom-select-trigger'); const locationOptionsList = document.getElementById('location-options-list'); const locationInput = document.getElementById('customer-location'); const locationTextSpan = document.getElementById('selected-location-text'); const locations = getLocationOptions(); locations.forEach(location => { const optionEl = document.createElement('div'); optionEl.className = 'location-option'; optionEl.dataset.value = location.value; const [name, price] = location.text.split('–').map(s => s.trim()); const nameSpan = document.createElement('span'); nameSpan.className = 'location-name'; nameSpan.textContent = name; const priceSpan = document.createElement('span'); priceSpan.className = 'location-price'; priceSpan.textContent = price; optionEl.appendChild(nameSpan); optionEl.appendChild(priceSpan); optionEl.addEventListener('click', () => { locationInput.value = location.value; locationTextSpan.textContent = location.text; locationTextSpan.classList.remove('placeholder'); updateCart(); closeModal('location-modal'); }); locationOptionsList.appendChild(optionEl); }); trigger.addEventListener('click', () => openModal('location-modal')); }

    function initialize() {
        loadBranding();
        loadOperatingStatus();
        loadServices();
        loadProducts();
        loadCustomizationOptions();
        loadUserInfo(); 
        
        if (!localStorage.getItem('activeOrderId')) {
            loadOrderState();
        }

        initializeFeedbackSystem();
        initializeCustomSelect();

        window.addEventListener('scroll', handleScrollEffects);
        
        document.getElementById('address-form').addEventListener('input', () => { saveOrderState(); saveUserInfo(); });
        document.querySelectorAll('input[name="payment"]').forEach(radio => { radio.addEventListener('change', (e) => { document.getElementById('change-section').style.display = e.target.value === 'Dinheiro' ? 'block' : 'none'; }); });
        document.querySelectorAll('input[name="needs-change"]').forEach(radio => { radio.addEventListener('change', (e) => { document.getElementById('change-amount-group').style.display = e.target.value === 'sim' ? 'block' : 'none'; }); });
        document.querySelectorAll('input[name="delivery-type"]').forEach(radio => { radio.addEventListener('change', handleDeliveryTypeChange); });
        
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
                    const productData = { name: productItemForModal.dataset.name, price: parseFloat(productItemForModal.dataset.price), description: productItemForModal.dataset.description || '' };
                    if (productCategory === 'acai') {
                        const limits = { cremes: parseInt(productItemForModal.dataset.creamLimit, 10), acompanhamentos: parseInt(productItemForModal.dataset.accompanimentLimit, 10) };
                        openCustomizationModal(productData, limits);
                    } else {
                        cart.push({ ...productData, quantity: 1, customizations: [], uniqueId: Date.now() });
                        updateCart();
                        showToastNotification(`${productData.name} foi adicionado ao carrinho!`);
                    }
                }
            }
            if (e.target.matches('.filter-btn')) { document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active')); e.target.classList.add('active'); updateProductsView(); }
            if (e.target.closest('#floating-cart-btn')) openModal('cart-modal');
            if (e.target.matches('.close-btn')) { const modal = e.target.closest('.modal'); if (modal) closeModal(modal.id); }
        });

        document.getElementById('show-more-btn').addEventListener('click', (e) => { e.target.dataset.state = (e.target.dataset.state || 'more') === 'more' ? 'less' : 'more'; updateProductsView(); });
        document.getElementById('cart-modal').addEventListener('click', (e) => { if (e.target.id === 'checkout-btn' && cart.length > 0) { closeModal('cart-modal'); openModal('address-modal'); } const cartItemEl = e.target.closest('.cart-item'); if (cartItemEl) { const index = cartItemEl.dataset.index; if (e.target.matches('.remove-btn')) cart.splice(index, 1); if (e.target.matches('.quantity-btn')) { const action = e.target.dataset.action; if (action === 'increase') cart[index].quantity++; if (action === 'decrease' && cart[index].quantity > 1) cart[index].quantity--; } updateCart(); } });
        document.getElementById('address-modal').addEventListener('click', (e) => { if (e.target.id === 'back-to-cart-btn') { closeModal('address-modal'); openModal('cart-modal'); } if (e.target.id === 'review-order-btn') { const form = document.getElementById('address-form'); if (form.checkValidity()) { document.getElementById('review-items').innerHTML = document.getElementById('cart-items').innerHTML; let addressDetails = 'Retirar no local'; if (document.querySelector('input[name="delivery-type"]:checked').value === 'delivery') { addressDetails = `${document.getElementById('street-name').value}, ${document.getElementById('house-number').value}\n${document.getElementById('selected-location-text').textContent}`; } document.getElementById('review-address-details').innerText = addressDetails; document.getElementById('review-payment-method').innerText = document.querySelector('input[name="payment"]:checked').value; document.getElementById('review-total-price').innerText = document.getElementById('total-price').innerText; closeModal('address-modal'); openModal('review-modal'); } else { form.reportValidity(); } } });

        document.getElementById('review-modal').addEventListener('click', async (e) => {
             if (e.target.id === 'back-to-address-btn') { closeModal('review-modal'); openModal('address-modal'); }
             if (e.target.id === 'submit-order-btn') {
                const btn = e.target;
                btn.disabled = true;
                btn.textContent = 'Enviando...';
                
                const newOrder = await saveOrderToBackend();
                
                const whatsappUrl = generateWhatsAppMessage();
                window.open(whatsappUrl, '_blank');

                if (newOrder && newOrder.id && newOrder.data.orderId) {
                    cart = [];
                    localStorage.removeItem('orderState');
                    updateCart(); 
                    closeModal('review-modal');
                    startOrderTracking(newOrder.id, newOrder.data.orderId, newOrder.data.deliveryMode);
                } else {
                    closeModal('review-modal');
                    openModal('submit-modal');
                }
                
                btn.disabled = false;
                btn.textContent = 'Enviar Pedido';
            }
        });
        
        const customModal = document.getElementById('customization-modal');
        customModal.querySelector('#customization-form').addEventListener('change', enforceSelectionLimits);
        // ======================= INÍCIO DA CORREÇÃO =======================
        customModal.addEventListener('click', (e) => {
            // Lógica para fechar o modal, agora com a classe correta
            if (e.target.closest('.close-custom-modal-btn')) {
                closeModal('customization-modal');
            }
            // Lógica para adicionar item ao carrinho
            if (e.target.id === 'add-custom-to-cart-btn') {
                addCustomizedItemToCart();
            }
            // Lógica para os botões de quantidade
            if (e.target.matches('.quantity-btn')) {
                let qty = currentCustomizingProduct.quantity;
                if (e.target.dataset.action === 'decrease' && qty > 1) qty--;
                else if (e.target.dataset.action === 'increase') qty++;
                currentCustomizingProduct.quantity = qty;
                document.getElementById('custom-quantity').textContent = qty;
                updateCustomPrice();
            }
        });
        // ======================== FIM DA CORREÇÃO =========================

        document.getElementById('view-menu-btn').addEventListener('click', (e) => { e.preventDefault(); document.getElementById('menu').scrollIntoView({ behavior: 'smooth' }); });
        
        handleDeliveryTypeChange();
        checkForActiveOrder();

        document.getElementById('close-tracking-modal-btn').addEventListener('click', () => closeModal('tracking-modal'));
        document.getElementById('submit-modal').addEventListener('click', (e) => { if (e.target.matches('.close-btn')) { closeModal('submit-modal'); }});
    }

    initialize();
});