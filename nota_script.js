// nota_script.js (Com Histórico do Cliente COMPLETO)

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
    const dashboardView = document.getElementById('dashboard-view');
    const customerHistoryModal = document.getElementById('customer-history-modal');

    let soundEnabled = false;
    let knownOrderIds = new Set();
    // --- ALTERAÇÃO ESTRATÉGICA ---
    // A variável de cache agora guarda apenas os pedidos ativos, não mais todos.
    let activeOrdersCache = []; 
    let currentFilter = 'all';

    // --- LÓGICA DE MODAL ---
    function openModal(modalElement) {
        modalElement.classList.add('visible');
    }

    function closeModal(modalElement) {
        modalElement.classList.remove('visible');
    }

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
            if (button) {
                button.disabled = true;
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            }
            const response = await fetch(`${BACKEND_URL}/orders/${orderId}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }) 
            });
            if (!response.ok) throw new Error('Falha ao atualizar o pedido.');
            // --- ALTERAÇÃO ESTRATÉGICA ---
            // Apenas atualiza os dados, não busca mais tudo de novo.
            await fetchActiveOrders();
        } catch (error) {
            console.error("Erro ao atualizar status:", error);
            alert('Não foi possível atualizar o status do pedido.');
            if (button) {
                button.disabled = false;
                button.innerHTML = button.dataset.originalHtml;
            }
        }
    }
    
    // --- FUNÇÃO ESTRATÉGICA: Busca apenas os pedidos ATIVOS ---
    async function fetchActiveOrders() {
        try {
            // A requisição agora é para a nova rota otimizada.
            const response = await fetch(`${BACKEND_URL}/active-orders`);
            if (!response.ok) throw new Error('Falha ao buscar pedidos ativos.');
            
            activeOrdersCache = await response.json();
            
            const newOrderIds = new Set(activeOrdersCache.filter(o => o.data.status === 'novo').map(o => o.id));

            // Lógica de notificação sonora para novos pedidos
            if (newOrderIds.size > 0 && newOrderIds.size !== knownOrderIds.size && soundEnabled) {
                const isNewOrder = [...newOrderIds].some(id => !knownOrderIds.has(id));
                if (isNewOrder) {
                    notificationSound.play().catch(e => console.error("Erro ao tocar notificação:", e));
                }
            }
            knownOrderIds = newOrderIds;

            updateOrderListView(activeOrdersCache);

        } catch (error) {
            console.error("Erro ao buscar pedidos ativos:", error);
            newOrdersView.innerHTML = '<div class="message-box">Erro ao conectar com o servidor. Tente novamente.</div>';
        }
    }
    
    // --- FUNÇÃO ESTRATÉGICA: Busca os dados do DASHBOARD ---
    async function fetchDashboardData() {
        try {
            const response = await fetch(`${BACKEND_URL}/dashboard-stats`);
            if (!response.ok) throw new Error('Falha ao buscar dados do dashboard.');
            const stats = await response.json();
            renderDashboard(stats);
        } catch (error) {
            console.error("Erro ao buscar dados do dashboard:", error);
        }
    }

    // --- FUNÇÃO PARA ATUALIZAR A LISTA DE PEDIDOS ---
    function updateOrderListView(activeOrders) {
        orderCountBadge.textContent = activeOrders.length;
        orderCountBadge.style.display = activeOrders.length > 0 ? 'inline-block' : 'none';
        
        let filteredOrders;
        if (currentFilter === 'all') filteredOrders = activeOrders;
        else if (currentFilter === 'prontos') filteredOrders = activeOrders.filter(o => o.data.status === 'entrega' || o.data.status === 'pronto_retirada');
        else filteredOrders = activeOrders.filter(o => o.data.status === currentFilter);
        
        const expandedIds = new Set(Array.from(document.querySelectorAll('.order-card.expanded')).map(c => c.dataset.id));
        newOrdersView.innerHTML = '';
        
        const filterHTML = `
            <div class="filter-container">
                <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">Todos</button>
                <button class="filter-btn ${currentFilter === 'novo' ? 'active' : ''}" data-filter="novo">Novos</button>
                <button class="filter-btn ${currentFilter === 'preparo' ? 'active' : ''}" data-filter="preparo">Preparo</button>
                <button class="filter-btn ${currentFilter === 'prontos' ? 'active' : ''}" data-filter="prontos">Prontos</button>
            </div>`;
        newOrdersView.insertAdjacentHTML('beforeend', filterHTML);

        if (filteredOrders.length === 0) {
            newOrdersView.insertAdjacentHTML('beforeend', '<div class="message-box">Nenhum pedido encontrado para este filtro.</div>');
            return;
        }

        // Ordenação prioriza status e depois o tempo
        filteredOrders.sort((a, b) => {
            const statusOrder = { 'novo': 1, 'preparo': 2, 'entrega': 3, 'pronto_retirada': 3 };
            const statusA = statusOrder[a.data.status] || 99;
            const statusB = statusOrder[b.data.status] || 99;
            if (statusA !== statusB) return statusA - statusB;
            return a.data.timestamp._seconds - b.data.timestamp._seconds;
        });

        filteredOrders.forEach(order => {
            const card = createNewOrderCard(order.id, order.data);
            if (expandedIds.has(order.id)) card.classList.add('expanded');
            newOrdersView.appendChild(card);
        });
    }

    // --- FUNÇÃO PARA ATUALIZAR OS TIMERS NA TELA ---
    function updateTimersOnScreen() {
        document.querySelectorAll('.card-timer').forEach(timerEl => {
            const timestamp = parseInt(timerEl.dataset.timestamp, 10);
            if(isNaN(timestamp)) return;
            const elapsedSeconds = Math.floor(Date.now() / 1000) - timestamp;
            const warningTime = 300, dangerTime = 600;
            timerEl.classList.toggle('danger', elapsedSeconds >= dangerTime);
            timerEl.classList.toggle('warn', elapsedSeconds >= warningTime && elapsedSeconds < dangerTime);
            const minutes = Math.floor(elapsedSeconds / 60);
            const seconds = elapsedSeconds % 60;
            timerEl.innerHTML = `<i class="fas fa-clock"></i> ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        });
    }

    // --- FUNÇÃO PARA RENDERIZAR O DASHBOARD ---
    // Agora recebe os dados prontos do servidor
    function renderDashboard(stats) {
        if (!stats) {
            dashboardView.innerHTML = '<div class="message-box">Carregando dados...</div>';
            return;
        }
        
        const formatCurrency = (value) => `R$ ${value.toFixed(2).replace('.', ',')}`;

        dashboardView.innerHTML = `
            <div class="dashboard-grid">
                <div class="metric-card">
                    <div class="metric-card-title"><i class="fas fa-dollar-sign"></i> Faturamento</div>
                    <div class="metric-card-value">${formatCurrency(stats.totalRevenue)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-card-title"><i class="fas fa-check-double"></i> Pedidos Concluídos</div>
                    <div class="metric-card-value">${stats.totalOrdersConcluded}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-card-title"><i class="fas fa-receipt"></i> Ticket Médio</div>
                    <div class="metric-card-value">${formatCurrency(stats.averageTicket)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-card-title"><i class="fas fa-box"></i> Total de Pedidos (Hoje)</div>
                    <div class="metric-card-value">${stats.todaysOrdersCount}</div>
                </div>
            </div>`;
    }

    // --- LÓGICA DO HISTÓRICO DO CLIENTE ---
    // Permanece a mesma, pois o modal de busca já fornece os dados necessários
    function showCustomerHistory(customerPhone, customerName) {
        const modalTitle = document.getElementById('customer-history-title');
        const modalBody = document.getElementById('customer-history-body');

        modalTitle.textContent = `Histórico de ${customerName}`;
        modalBody.innerHTML = '<p>Buscando histórico...</p>';
        openModal(customerHistoryModal);

        if (!customerPhone) {
            modalBody.innerHTML = '<div class="message-box">Não foi possível identificar o cliente (sem telefone).</div>';
            return;
        }

        // A busca pelo histórico agora pode ser otimizada no futuro com uma rota própria
        // Por enquanto, usamos os resultados da busca que já fizemos
        // Esta função será chamada a partir dos resultados da busca
        const searchTerm = customerName; // Simplificação para o exemplo
        fetch(`${BACKEND_URL}/search?term=${encodeURIComponent(searchTerm)}`)
            .then(res => res.json())
            .then(customerOrders => {
                 if (customerOrders.length === 0) {
                    modalBody.innerHTML = '<div class="message-box">Nenhum pedido encontrado para este cliente.</div>';
                    return;
                }

                const totalOrders = customerOrders.length;
                const totalSpent = customerOrders.reduce((sum, order) => sum + (order.data.totals?.total || 0), 0);
                const formatCurrency = (value) => `R$ ${value.toFixed(2).replace('.', ',')}`;
                
                customerOrders.sort((a, b) => b.data.timestamp._seconds - a.data.timestamp._seconds);

                let historyHTML = `
                    <div class="history-metrics">
                        <div class="history-metric-item">
                            <span class="history-metric-label">Total de Pedidos</span>
                            <span class="history-metric-value">${totalOrders}</span>
                        </div>
                        <div class="history-metric-item">
                            <span class="history-metric-label">Gasto Total</span>
                            <span class="history-metric-value">${formatCurrency(totalSpent)}</span>
                        </div>
                    </div>
                    <h3 class="history-orders-title">Pedidos Recentes</h3>
                    <ul class="history-order-list">
                `;

                customerOrders.slice(0, 10).forEach(order => {
                    const date = new Date(order.data.timestamp._seconds * 1000).toLocaleDateString('pt-BR');
                    const total = order.data.totals?.total || 0;
                    historyHTML += `
                        <li class="history-order-item">
                            <div class="history-order-info">
                                <span class="history-order-id">Pedido #${order.data.orderId}</span>
                                <span class="history-order-date">${date}</span>
                            </div>
                            <span class="history-order-total">${formatCurrency(total)}</span>
                        </li>
                    `;
                });

                historyHTML += '</ul>';
                modalBody.innerHTML = historyHTML;
            });
    }


    // --- EVENT LISTENERS ---
    newOrdersView.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('filter-btn')) {
            currentFilter = target.dataset.filter;
            updateOrderListView(activeOrdersCache);
        } else {
            const button = target.closest('button');
            if (!button) return;
            const card = button.closest('.order-card');
            if (!card) return;
            if (button.classList.contains('status-btn')) {
                updateOrderStatus(card.dataset.id, button.dataset.nextStatus, button);
            } else if (button.classList.contains('copy-btn')) {
                const textToCopy = card.querySelector('pre').textContent;
                copyToClipboard(textToCopy).then(success => {
                    if (success) {
                        const originalHtml = button.innerHTML;
                        button.innerHTML = '<i class="fas fa-paste"></i> Copiado!';
                        setTimeout(() => { button.innerHTML = originalHtml; }, 2000);
                    }
                });
            }
        }
    });

    // --- LÓGICA DE GESTOS (SWIPE) ---
    let touchStartX = 0, currentX = 0, isSwiping = false, swipedCard = null;
    newOrdersView.addEventListener('touchstart', e => {
        const targetCard = e.target.closest('.order-card');
        if (targetCard && !e.target.closest('button') && targetCard.querySelector('.status-btn')) {
            isSwiping = true; swipedCard = targetCard;
            touchStartX = e.touches[0].clientX; swipedCard.classList.add('swiping');
        }
    }, { passive: true });
    newOrdersView.addEventListener('touchmove', e => {
        if (!isSwiping || !swipedCard) return;
        currentX = e.touches[0].clientX - touchStartX;
        if (currentX < 0) currentX = 0;
        const opacity = Math.min(currentX / 100, 1);
        swipedCard.querySelector('.swipe-action-background').style.opacity = opacity;
        swipedCard.querySelector('.card-content').style.transform = `translateX(${currentX}px)`;
    }, { passive: true });
    newOrdersView.addEventListener('touchend', () => {
        if (!isSwiping || !swipedCard) return;
        isSwiping = false; swipedCard.classList.remove('swiping');
        const swipeThreshold = 100;
        if (currentX > swipeThreshold) {
            const actionButton = swipedCard.querySelector('.status-btn');
            if (actionButton) {
                swipedCard.querySelector('.card-content').style.transform = `translateX(100%)`;
                setTimeout(() => actionButton.click(), 100);
            }
        } else {
            swipedCard.querySelector('.card-content').style.transform = 'translateX(0px)';
            swipedCard.querySelector('.swipe-action-background').style.opacity = 0;
        }
        touchStartX = 0; currentX = 0; swipedCard = null;
    });

    // --- FUNÇÕES DE BUSCA ---
    // --- ALTERAÇÃO ESTRATÉGICA ---
    // A busca agora chama a nova rota no backend
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const searchTerm = searchInput.value.trim();
        if (!searchTerm) return;

        searchResultsContainer.innerHTML = '<div class="message-box">Buscando...</div>';
        try {
            const response = await fetch(`${BACKEND_URL}/search?term=${encodeURIComponent(searchTerm)}`);
            if (!response.ok) throw new Error('Falha na busca.');
            const results = await response.json();
            renderSearchResults(results);
        } catch (error) {
            console.error("Erro na busca:", error);
            searchResultsContainer.innerHTML = '<div class="message-box">Erro ao buscar. Tente novamente.</div>';
        }
    });
    
    function renderSearchResults(results) {
        searchResultsContainer.innerHTML = results.length === 0 ? '<div class="message-box">Nenhum pedido encontrado.</div>' : '';
        results.sort((a, b) => b.data.timestamp._seconds - a.data.timestamp._seconds).forEach(order => {
            searchResultsContainer.appendChild(createSearchResultCard(order.id, order.data));
        });
    }

    searchResultsContainer.addEventListener('click', (e) => {
        const target = e.target.closest('.customer-name-link');
        if (target) {
            const customerName = target.dataset.customerName;
            const customerPhone = target.dataset.customerPhone;
            showCustomerHistory(customerPhone, customerName);
        }
    });


    // --- FUNÇÕES DE CRIAÇÃO DE HTML (sem grandes alterações) ---
    function createNewOrderCard(orderId, orderData) {
        const date = new Date(orderData.timestamp._seconds * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const customerName = orderData.customer?.name || orderData.customerName || 'Cliente não informado';
        const card = document.createElement('div');
        card.className = `order-card status-${orderData.status}`;
        card.dataset.id = orderId;
        
        let actionButtonHTML = '', swipeActionIcon = '';
        if (orderData.status === 'novo') {
            actionButtonHTML = `<button class="status-btn preparo" data-next-status="preparo"><i class="fas fa-fire-alt"></i> Mover para Preparo</button>`;
            swipeActionIcon = '<i class="fas fa-arrow-right"></i>';
        } else if (orderData.status === 'preparo') {
            const nextStatus = orderData.deliveryMode === 'delivery' ? 'entrega' : 'pronto_retirada';
            const buttonIcon = orderData.deliveryMode === 'delivery' ? 'fa-motorcycle' : 'fa-store-alt';
            const buttonText = orderData.deliveryMode === 'delivery' ? 'Saiu p/ Entrega' : 'Pronto p/ Retirada';
            const buttonClass = orderData.deliveryMode === 'delivery' ? 'entrega' : 'retirada';
            actionButtonHTML = `<button class="status-btn ${buttonClass}" data-next-status="${nextStatus}"><i class="fas ${buttonIcon}"></i> ${buttonText}</button>`;
            swipeActionIcon = '<i class="fas fa-arrow-right"></i>';
        } else if (orderData.status === 'entrega' || orderData.status === 'pronto_retirada') {
            actionButtonHTML = `<button class="status-btn concluido" data-next-status="concluido"><i class="fas fa-check-double"></i> Concluir Pedido</button>`;
            swipeActionIcon = '<i class="fas fa-check-double"></i>';
        }
        
        const deliveryIconHTML = orderData.deliveryMode === 'delivery' ? '<i class="fas fa-motorcycle delivery-icon"></i>' :
                                 orderData.deliveryMode === 'pickup' ? '<i class="fas fa-shopping-bag delivery-icon"></i>' : '';
        
        card.innerHTML = `
            <div class="swipe-action-background">${swipeActionIcon}</div>
            <div class="card-content">
                <div class="card-summary">
                    <div class="card-info">
                        <h3>${customerName} ${deliveryIconHTML}</h3>
                        <span>#${orderData.orderId || ''} &bull; ${date}
                            <span class="card-timer" data-timestamp="${orderData.timestamp._seconds}"><i class="fas fa-clock"></i> 00:00</span>
                        </span>
                    </div>
                    <div class="card-status-indicator">${orderData.status.replace('_', ' ')}</div>
                </div>
                <div class="card-details"><div class="details-content">
                    <pre>${orderData.printerFriendlyText || 'Texto do pedido não disponível.'}</pre>
                    <div class="card-actions">
                        ${actionButtonHTML}
                        <button class="copy-btn"><i class="fas fa-copy"></i> Copiar Pedido</button>
                    </div>
                </div></div>
            </div>`;
        card.querySelector('.card-summary').addEventListener('click', () => card.classList.toggle('expanded'));
        return card;
    }
    
    function createSearchResultCard(orderId, orderData) {
        const date = new Date(orderData.timestamp._seconds * 1000).toLocaleDateString('pt-BR');
        const total = (orderData.totals?.total || 0).toFixed(2).replace('.',',');
        const customerName = orderData.customer?.name || orderData.customerName || 'Cliente não informado';
        const customerPhone = orderData.customerPhone || '';
        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `
            <h3>
                <button class="customer-name-link" data-customer-name="${customerName}" data-customer-phone="${customerPhone}">
                    ${customerName}
                </button>
            </h3>
            <p>
                <strong>Pedido #${orderData.orderId || ''}</strong> <br>
                Data: ${date} | Total: R$ ${total} | Status: <strong>${orderData.status || 'sem status'}</strong>
            </p>`;
        return card;
    }

    // --- FUNÇÕES AUXILIARES ---
    async function copyToClipboard(text) {
        try {
            if (navigator.clipboard) await navigator.clipboard.writeText(text);
            else {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed'; textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.select(); document.execCommand('copy');
                document.body.removeChild(textArea);
            } return true;
        } catch (error) { console.error('Falha ao copiar texto:', error); return false; }
    }
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetViewId = item.dataset.view;
            views.forEach(view => view.classList.remove('active'));
            document.getElementById(targetViewId).classList.add('active');
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            if(targetViewId === 'dashboard-view') {
                fetchDashboardData();
            }
        });
    });

    // --- INICIALIZAÇÃO ---
    function initialize() {
        customerHistoryModal.addEventListener('click', (e) => {
            if (e.target.classList.contains('close-modal-btn') || e.target.classList.contains('modal-overlay')) {
                closeModal(customerHistoryModal);
            }
        });
    
        // Função unificada para atualizar os dados
        function updateAllData() {
            fetchActiveOrders();
            // Atualiza o dashboard apenas se ele estiver visível
            if (document.getElementById('dashboard-view').classList.contains('active')) {
                fetchDashboardData();
            }
        }

        updateAllData(); // Primeira chamada
        setInterval(updateAllData, 15000); // Polling para pedidos e dashboard
        setInterval(updateTimersOnScreen, 1000); // Atualiza os timers a cada segundo
    }

    initialize();
});