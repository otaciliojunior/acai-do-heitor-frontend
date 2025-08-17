document.addEventListener('DOMContentLoaded', () => {

    // --- 1. CONFIGURAÇÕES E SELETORES GLOBAIS ---
    const API_URL = 'https://cardapio-acai-do-heitor.onrender.com';
    // let ordersByStatusChart = null; // Gráfico desativado
    let currentOrdersData = [];

    // --- 2. SELEÇÃO DOS ELEMENTOS DO DOM ---
    const dashboard = document.getElementById('orders-dashboard');
    const navLinks = document.querySelectorAll('.nav-link');
    const views = document.querySelectorAll('.view');

    const newOrdersCol = document.querySelector('#new-orders-col .orders-list');
    const inProgressCol = document.querySelector('#in-progress-col .orders-list');
    const outForDeliveryCol = document.querySelector('#out-for-delivery-col .orders-list');
    const completedCol = document.querySelector('#completed-col .orders-list');

    const totalOrdersTodayEl = document.getElementById('total-orders-today');
    const totalRevenueTodayEl = document.getElementById('total-revenue-today');
    const averageTicketEl = document.getElementById('average-ticket');
    const newOrdersCountEl = document.getElementById('new-orders-count');

    // --- 3. LÓGICA DE NAVEGAÇÃO ---
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            navLinks.forEach(l => l.classList.remove('active'));
            e.currentTarget.classList.add('active');

            const targetViewId = e.currentTarget.dataset.view;
            
            views.forEach(view => {
                view.classList.remove('active-view');
                if (view.id === targetViewId) {
                    view.classList.add('active-view');
                }
            });
            
            // Lógica do gráfico desativada
            /*
            if (targetViewId === 'relatorios-view') {
                setTimeout(() => {
                    renderCharts(currentOrdersData);
                }, 50); 
            } else {
                if (ordersByStatusChart) {
                    ordersByStatusChart.destroy();
                    ordersByStatusChart = null;
                }
            }
            */
        });
    });

    // --- 4. FUNÇÕES DE RENDERIZAÇÃO E CÁLCULO ---

    function createOrderCardHTML(orderData, orderId) {
        const itemsList = orderData.items.map(item => `<p>• ${item.quantity}x ${item.name}</p>`).join('');
        let actionsHTML = '';
        if (orderData.status === 'novo') {
            actionsHTML = `<button class="move-btn" data-id="${orderId}" data-status="preparo">Iniciar Preparo</button>`;
        } else if (orderData.status === 'preparo') {
            actionsHTML = `<button class="move-btn" data-id="${orderId}" data-status="entrega">Saiu para Entrega</button>`;
        } else if (orderData.status === 'entrega') {
            actionsHTML = `<button class="move-btn" data-id="${orderId}" data-status="concluido">Concluir Pedido</button>`;
        }
        const formattedTotal = orderData.total.toFixed(2).replace('.', ',');
        return `
            <div class="order-card" data-id="${orderId}">
                <h3>Pedido de: ${orderData.customer.name} (#${orderData.orderId})</h3>
                <p><strong>Endereço:</strong> ${orderData.customer.address}${orderData.customer.reference ? `, ${orderData.customer.reference}` : ''}</p>
                <hr>
                <div><strong>Itens:</strong>${itemsList}</div>
                <hr>
                <p class="total">Total: R$ ${formattedTotal}</p>
                <p><strong>Pagamento:</strong> ${orderData.paymentMethod}</p>
                <div class="actions">${actionsHTML}</div>
            </div>`;
    }

    function renderOrders(orders) {
        newOrdersCol.innerHTML = '';
        inProgressCol.innerHTML = '';
        outForDeliveryCol.innerHTML = '';
        completedCol.innerHTML = '';

        orders.forEach(order => {
            const orderCardHTML = createOrderCardHTML(order.data, order.id);
            switch (order.data.status) {
                case 'novo': newOrdersCol.innerHTML += orderCardHTML; break;
                case 'preparo': inProgressCol.innerHTML += orderCardHTML; break;
                case 'entrega': outForDeliveryCol.innerHTML += orderCardHTML; break;
                case 'concluido': completedCol.innerHTML += orderCardHTML; break;
            }
        });
    }

    function updateStatsCards(orders) {
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, order) => sum + order.data.total, 0);
        const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        const newOrdersCount = orders.filter(order => order.data.status === 'novo').length;

        totalOrdersTodayEl.textContent = totalOrders;
        totalRevenueTodayEl.textContent = `R$ ${totalRevenue.toFixed(2).replace('.', ',')}`;
        averageTicketEl.textContent = `R$ ${averageTicket.toFixed(2).replace('.', ',')}`;
        newOrdersCountEl.textContent = newOrdersCount;
    }

    // Função de renderização de gráficos desativada
    /*
    function renderCharts(orders) {
        const statusCounts = { novo: 0, preparo: 0, entrega: 0, concluido: 0 };
        orders.forEach(order => {
            if (statusCounts.hasOwnProperty(order.data.status)) {
                statusCounts[order.data.status]++;
            }
        });

        const chartData = [statusCounts.novo, statusCounts.preparo, statusCounts.entrega, statusCounts.concluido];
        const ctx = document.getElementById('orders-by-status-chart');
        if (!ctx) return;

        if (ordersByStatusChart) {
            ordersByStatusChart.data.datasets[0].data = chartData;
            ordersByStatusChart.update();
        } else {
            ordersByStatusChart = new Chart(ctx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: ['Novos', 'Em Preparo', 'Em Entrega', 'Concluídos'],
                    datasets: [{
                        label: 'Pedidos por Status',
                        data: chartData,
                        backgroundColor: ['#3b82f6', '#f97316', '#eab308', '#22c55e'],
                        borderColor: '#ffffff',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 500
                    },
                    plugins: {
                        legend: { position: 'top' }
                    }
                }
            });
        }
    }
    */

    // --- 5. LÓGICA DE COMUNICAÇÃO COM A API ---
    async function fetchOrders() {
        try {
            const response = await fetch(`${API_URL}/orders`);
            if (!response.ok) throw new Error('Não foi possível buscar os pedidos.');
            
            const orders = await response.json();
            currentOrdersData = orders;
            
            renderOrders(orders);
            updateStatsCards(orders);

            // Chamada para renderizar gráficos desativada
            /*
            if (document.getElementById('relatorios-view').classList.contains('active-view')) {
                renderCharts(orders);
            }
            */

        } catch (error) {
            console.error("Erro ao buscar pedidos:", error);
        }
    }

    async function updateOrderStatus(orderId, newStatus) {
        try {
            const response = await fetch(`${API_URL}/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!response.ok) throw new Error('Não foi possível atualizar o status do pedido.');
        } catch (error) {
            console.error("Erro ao atualizar o status do pedido:", error);
        }
    }

    dashboard.addEventListener('click', (e) => {
        if (e.target.classList.contains('move-btn')) {
            const orderId = e.target.dataset.id;
            const newStatus = e.target.dataset.status;
            if (orderId && newStatus) {
                updateOrderStatus(orderId, newStatus);
            }
        }
    });

    // --- 6. INICIALIZAÇÃO ---
    fetchOrders(); 
    setInterval(fetchOrders, 10000); 
});