document.addEventListener('DOMContentLoaded', () => {

    console.log("DOM carregado. Iniciando script...");

    // --- 1. CONFIGURAÇÕES ---
    const API_URL = 'https://acai-do-heitor-backend.onrender.com';
    const WHATSAPP_NUMBER = "5584981475289";
    const DELIVERY_FEE = 2.00;

    // --- ESTADO DO APLICATIVO ---
    let cart = [];
    let currentCustomizingProduct = {};

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
    
    // ATUALIZADO: A estrutura HTML do item do carrinho foi alterada para corresponder ao novo design.
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
        loadAddressData();

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
                const category = e.target.dataset.category;
                document.querySelectorAll('.product-item').forEach(card => {
                    card.style.display = (category === 'all' || card.dataset.category === category) ? 'flex' : 'none';
                });
            }

            if (e.target.closest('#floating-cart-btn')) openModal('cart-modal');
            if (e.target.matches('.close-btn, .close-custom-modal-btn')) {
                const modal = e.target.closest('.modal');
                if (modal) closeModal(modal.id);
            }
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