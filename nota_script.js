// nota_script.js (Versão Final Completa - Conectado ao Backend)

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DA UI E CONFIGURAÇÕES ---
    const BACKEND_URL = 'https://acai-do-heitor-backend.onrender.com';
    const views = document.querySelectorAll('.view');
    const navItems = document.querySelectorAll('.nav-item');
    const newOrdersView = document.getElementById('new-orders-view');
    const orderCountBadge = document.getElementById('order-count-badge');
    const notificationSound = document.getElementById('notification-sound');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const searchResultsContainer = document.getElementById('search-results');
    const soundActivationOverlay = document.getElementById('sound-activation-overlay');
    const soundActivationButton = document.getElementById('sound-activation-button');

    let soundEnabled = false;
    let knownOrderIds = new Set(); // Para controlar notificações sonoras
    let allOrdersCache = []; // Cache de todos os pedidos para a busca

    // --- LÓGICA DE ATIVAÇÃO DE SOM ---
    soundActivationButton.addEventListener('click', () => {
        soundActivationButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ativando...';
        soundActivationButton.disabled = true;

        const playPromise = notificationSound.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                notificationSound.pause();
                notificationSound.currentTime = 0;
                soundEnabled = true;
                soundActivationOverlay.style.opacity = '0';
                setTimeout(() => { soundActivationOverlay.style.display = 'none'; }, 300);
                console.log("Notificações sonoras ativadas pelo usuário.");
            }).catch(error => {
                console.error("ERRO ao tentar ativar o som:", error);
                soundActivationButton.innerHTML = '<i class="fas fa-times"></i> Falha ao Ativar';
                alert("Não foi possível ativar o som. Verifique as permissões e o caminho do arquivo de áudio.");
            });
        }
    });

    // --- FUNÇÃO PARA BUSCAR E RENDERIZAR PEDIDOS ---
    async function fetchAndRenderOrders() {
        try {
            const response = await fetch(`${BACKEND_URL}/orders`);
            if (!response.ok) throw new Error('Falha ao buscar pedidos do servidor.');
            
            allOrdersCache = await response.json(); // Armazena todos os pedidos para a busca
            
            const newOrders = allOrdersCache.filter(order => order.data.status === 'novo');
            
            // Lógica de notificação sonora para novos pedidos
            const currentOrderIds = new Set(newOrders.map(o => o.id));
            if (knownOrderIds.size > 0) {
                let hasNewOrder = false;
                currentOrderIds.forEach(id => {
                    if (!knownOrderIds.has(id)) {
                        hasNewOrder = true;
                    }
                });
                if (hasNewOrder && soundEnabled) {
                    notificationSound.play().catch(e => console.error("Erro ao tocar notificação:", e));
                }
            }
            knownOrderIds = currentOrderIds;

            updateOrderListView(newOrders);
            
        } catch (error) {
            console.error("Erro ao buscar pedidos:", error);
            newOrdersView.innerHTML = '<div class="message-box">Erro ao conectar com o servidor.</div>';
        }
    }
    
    // --- FUNÇÃO PARA ATUALIZAR A LISTA DE PEDIDOS NA TELA ---
    function updateOrderListView(newOrders) {
        orderCountBadge.textContent = newOrders.length;
        orderCountBadge.style.display = newOrders.length > 0 ? 'block' : 'none';

        newOrdersView.innerHTML = '';
        if (newOrders.length === 0) {
            newOrdersView.innerHTML = '<div class="message-box">Nenhum pedido novo.</div>';
            return;
        }

        // Ordena os pedidos pelo mais antigo primeiro
        newOrders.sort((a, b) => a.data.timestamp._seconds - b.data.timestamp._seconds);

        newOrders.forEach(order => {
            const card = createNewOrderCard(order.id, order.data);
            newOrdersView.appendChild(card);
        });
    }

    // --- FUNÇÃO PARA CONCLUIR (MOVER PARA 'PREPARO') UM PEDIDO ---
    async function handleConcludeOrder(orderId, button) {
        try {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
            
            const response = await fetch(`${BACKEND_URL}/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'preparo' }) 
            });

            if (!response.ok) throw new Error('Falha ao atualizar o pedido.');

            const cardToRemove = newOrdersView.querySelector(`.order-card[data-id="${orderId}"]`);
            if (cardToRemove) {
                 cardToRemove.classList.add('removing');
                 setTimeout(() => cardToRemove.remove(), 300);
            }
            // Atualiza o contador e a lista sem precisar de uma nova busca
            const currentCount = parseInt(orderCountBadge.textContent, 10);
            const newCount = currentCount - 1;
            orderCountBadge.textContent = newCount;
            orderCountBadge.style.display = newCount > 0 ? 'block' : 'none';
            if(newCount === 0) newOrdersView.innerHTML = '<div class="message-box">Nenhum pedido novo.</div>';

        } catch (error) {
            console.error("Erro ao concluir pedido:", error);
            alert('Não foi possível atualizar o status do pedido.');
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-check-circle"></i> Em Preparo';
        }
    }

    // --- RODA A CADA 10 SEGUNDOS PARA BUSCAR NOVOS PEDIDOS ---
    fetchAndRenderOrders(); // Carga inicial
    setInterval(fetchAndRenderOrders, 10000); // 10 segundos

    // --- EVENT LISTENERS GERAIS ---
    newOrdersView.addEventListener('click', async (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        const card = button.closest('.order-card');
        const docId = card.dataset.id;
        if (button.classList.contains('move-btn')) {
            await handleConcludeOrder(docId, button);
        }
        if (button.classList.contains('copy-btn')) {
            const textToCopy = card.querySelector('pre').textContent;
            const success = await copyToClipboard(textToCopy);
            if (success) {
                button.innerHTML = '<i class="fas fa-paste"></i> Copiado!';
            } else {
                button.innerHTML = '<i class="fas fa-times"></i> Falhou!';
            }
            setTimeout(() => { button.innerHTML = '<i class="fas fa-copy"></i> Copiar'; }, 2500);
        }
    });

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const searchTerm = searchInput.value.trim().toLowerCase();
        if (!searchTerm) {
            searchResultsContainer.innerHTML = '<div class="message-box">Busque por pedidos já finalizados.</div>';
            return;
        }
        
        const finishedOrders = allOrdersCache.filter(order => order.data.status !== 'novo');
        const results = finishedOrders.filter(order => {
            const orderIdMatch = order.data.orderId.includes(searchTerm);
            const customerNameMatch = order.data.customer.name.toLowerCase().includes(searchTerm);
            return orderIdMatch || customerNameMatch;
        });

        renderSearchResults(results);
    });
    
    function renderSearchResults(results) {
        if (results.length === 0) {
            searchResultsContainer.innerHTML = '<div class="message-box">Nenhum pedido encontrado.</div>';
            return;
        }
        searchResultsContainer.innerHTML = '';
        results
            .sort((a, b) => b.data.timestamp._seconds - a.data.timestamp._seconds)
            .forEach(order => {
                const card = createSearchResultCard(order.id, order.data);
                searchResultsContainer.appendChild(card);
            });
    }

    // --- FUNÇÕES DE CRIAÇÃO DE HTML ---
    function createNewOrderCard(orderId, orderData) {
        const date = new Date(orderData.timestamp._seconds * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const deliveryIcon = orderData.delivery.mode === 'delivery' ? 'fa-motorcycle' : 'fa-store';
        const card = document.createElement('div');
        card.className = 'order-card';
        card.dataset.id = orderId;
        card.innerHTML = `
            <div class="card-summary">
                <div class="card-info">
                    <h3>${orderData.customer.name}</h3>
                    <span>#${orderData.orderId} - ${date}</span>
                </div>
                <div class="card-status">
                    <span class="total-badge">R$ ${orderData.totals.total.toFixed(2)}</span>
                    <span class="delivery-type"><i class="fas ${deliveryIcon}"></i> ${orderData.delivery.mode === 'delivery' ? 'Entrega' : 'Retirada'}</span>
                </div>
            </div>
            <div class="card-details">
                <pre>${orderData.printerFriendlyText || 'Texto para impressão não disponível.'}</pre>
                <div class="card-actions">
                    <button class="copy-btn"><i class="fas fa-copy"></i> Copiar</button>
                    <button class="move-btn"><i class="fas fa-check-circle"></i> Em Preparo</button>
                </div>
            </div>
        `;
        card.querySelector('.card-summary').addEventListener('click', () => card.classList.toggle('expanded'));
        return card;
    }
    
    function createSearchResultCard(orderId, orderData) {
        const date = new Date(orderData.timestamp._seconds * 1000).toLocaleDateString('pt-BR');
        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `
            <h3>${orderData.customer.name}</h3>
            <p>
                <strong>Pedido #${orderData.orderId}</strong> | Data: ${date} | Total: R$ ${orderData.totals.total.toFixed(2)}
                <br>
                Status: <strong>${orderData.status}</strong>
            </p>
        `;
        return card;
    }

    // --- FUNÇÕES UTILITÁRIAS ---
    async function copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                return true;
            }
        } catch (error) {
            console.error('Falha ao copiar texto:', error);
            return false;
        }
    }
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetViewId = item.dataset.view;
            views.forEach(view => view.classList.remove('active'));
            document.getElementById(targetViewId).classList.add('active');
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
        });
    });
});