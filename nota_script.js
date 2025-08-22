// nota_script.js (Com fluxo de conclusão corrigido)

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DA UI E CONFIGURAções ---
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
    let knownOrderIds = new Set();
    let allOrdersCache = [];

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
                alert("Não foi possível ativar o som. Verifique as permissões do navegador.");
            });
        }
    });

    // --- FUNÇÃO PARA ATUALIZAR STATUS DE UM PEDIDO ---
    async function updateOrderStatus(orderId, newStatus, button) {
        try {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            
            const response = await fetch(`${BACKEND_URL}/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }) 
            });

            if (!response.ok) throw new Error('Falha ao atualizar o pedido.');

            // Recarrega a lista para refletir a mudança de status ou a remoção do item
            await fetchAndRenderOrders();

        } catch (error) {
            console.error("Erro ao atualizar status:", error);
            alert('Não foi possível atualizar o status do pedido.');
            button.disabled = false;
            button.innerHTML = button.dataset.originalHtml; 
        }
    }

    // --- FUNÇÃO PARA BUSCAR E RENDERIZAR PEDIDOS ATIVOS ---
    async function fetchAndRenderOrders() {
        try {
            const response = await fetch(`${BACKEND_URL}/orders`);
            if (!response.ok) throw new Error('Falha ao buscar pedidos.');
            
            allOrdersCache = await response.json();
            
            // ======================= INÍCIO DA CORREÇÃO =======================
            // A tela principal agora mostra pedidos 'novo', 'preparo' E 'entrega'
            const activeOrders = allOrdersCache.filter(order => ['novo', 'preparo', 'entrega'].includes(order.data.status));
            // ======================== FIM DA CORREÇÃO =========================
            
            const newOrderIds = new Set(activeOrders.filter(o => o.data.status === 'novo').map(o => o.id));
            if (knownOrderIds.size > 0 && newOrderIds.size > knownOrderIds.size && soundEnabled) {
                notificationSound.play().catch(e => console.error("Erro ao tocar notificação:", e));
            }
            knownOrderIds = newOrderIds;

            updateOrderListView(activeOrders);
        } catch (error) {
            console.error("Erro ao buscar pedidos:", error);
            newOrdersView.innerHTML = '<div class="message-box">Erro ao conectar com o servidor.</div>';
        }
    }
    
    // --- FUNÇÃO PARA ATUALIZAR A LISTA DE PEDIDOS NA TELA ---
    function updateOrderListView(activeOrders) {
        orderCountBadge.textContent = activeOrders.length;
        orderCountBadge.style.display = activeOrders.length > 0 ? 'block' : 'none';

        newOrdersView.innerHTML = '';
        if (activeOrders.length === 0) {
            newOrdersView.innerHTML = '<div class="message-box">Nenhum pedido ativo no momento.</div>';
            return;
        }

        // Ordena os pedidos por status e depois por tempo
        activeOrders.sort((a, b) => {
            const statusOrder = { 'novo': 1, 'preparo': 2, 'entrega': 3 };
            if (statusOrder[a.data.status] !== statusOrder[b.data.status]) {
                return statusOrder[a.data.status] - statusOrder[b.data.status];
            }
            return a.data.timestamp._seconds - b.data.timestamp._seconds;
        });

        activeOrders.forEach(order => {
            const card = createNewOrderCard(order.id, order.data);
            newOrdersView.appendChild(card);
        });
    }

    // --- EVENT LISTENERS GERAIS ---
    newOrdersView.addEventListener('click', async (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        
        const docId = button.closest('.order-card').dataset.id;

        if (button.classList.contains('status-btn')) {
            const nextStatus = button.dataset.nextStatus;
            await updateOrderStatus(docId, nextStatus, button);
        }

        if (button.classList.contains('copy-btn')) {
            const textToCopy = button.closest('.order-card').querySelector('pre').textContent;
            const success = await copyToClipboard(textToCopy);
            if (success) {
                button.innerHTML = '<i class="fas fa-paste"></i> Copiado!';
                setTimeout(() => { button.innerHTML = '<i class="fas fa-copy"></i> Copiar'; }, 2000);
            }
        }
    });

    // Função de busca (sem alterações)
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const searchTerm = searchInput.value.trim().toLowerCase();
        if (!searchTerm) return;
        const results = allOrdersCache.filter(order => {
            const orderId = order.data.orderId || '';
            const customerName = (order.data.customer && order.data.customer.name) ? order.data.customer.name : (order.data.customerName || '');
            const printerText = order.data.printerFriendlyText || '';
            return orderId.includes(searchTerm) || customerName.toLowerCase().includes(searchTerm) || printerText.toLowerCase().includes(searchTerm);
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
        const customerName = (orderData.customer && orderData.customer.name) ? orderData.customer.name : (orderData.customerName || 'Cliente não informado');
        const card = document.createElement('div');
        card.className = `order-card status-${orderData.status}`;
        card.dataset.id = orderId;

        // Lógica de botões para o fluxo completo de status
        let actionButtonHTML = '';
        if (orderData.status === 'novo') {
            const buttonText = `<i class="fas fa-fire-alt"></i> Em Preparo`;
            actionButtonHTML = `<button class="status-btn preparo" data-next-status="preparo" data-original-html='${buttonText}'>${buttonText}</button>`;
        } else if (orderData.status === 'preparo') {
            const buttonText = `<i class="fas fa-motorcycle"></i> Saiu p/ Entrega`;
            actionButtonHTML = `<button class="status-btn entrega" data-next-status="entrega" data-original-html='${buttonText}'>${buttonText}</button>`;
        } else if (orderData.status === 'entrega') {
            const buttonText = `<i class="fas fa-check-double"></i> Concluir`;
            actionButtonHTML = `<button class="status-btn concluido" data-next-status="concluido" data-original-html='${buttonText}'>${buttonText}</button>`;
        }
        
        card.innerHTML = `
            <div class="card-summary">
                <div class="card-info">
                    <h3>${customerName}</h3>
                    <span>#${orderData.orderId || ''} - ${date}</span>
                </div>
                <div class="card-status-indicator">${orderData.status.replace('_', ' ')}</div>
            </div>
            <div class="card-details">
                <pre>${orderData.printerFriendlyText || 'Texto não disponível.'}</pre>
                <div class="card-actions">
                    <button class="copy-btn"><i class="fas fa-copy"></i> Copiar</button>
                    ${actionButtonHTML}
                </div>
            </div>
        `;
        card.querySelector('.card-summary').addEventListener('click', () => card.classList.toggle('expanded'));
        return card;
    }
    
    function createSearchResultCard(orderId, orderData) {
        const date = new Date(orderData.timestamp._seconds * 1000).toLocaleDateString('pt-BR');
        const totalValue = (orderData.totals && typeof orderData.totals.total !== 'undefined') ? orderData.totals.total.toFixed(2) : '0.00';
        const customerName = (orderData.customer && orderData.customer.name) ? orderData.customer.name : (orderData.customerName || 'Cliente não informado');

        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `
            <h3>${customerName}</h3>
            <p>
                <strong>Pedido #${orderData.orderId || ''}</strong> | Data: ${date} | Total: R$ ${totalValue}
                <br>
                Status: <strong>${orderData.status || 'sem status'}</strong>
            </p>
        `;
        return card;
    }

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

    // Inicia a busca de pedidos ao carregar a página
    fetchAndRenderOrders(); 
    setInterval(fetchAndRenderOrders, 15000); // Verifica a cada 15 segundos
});