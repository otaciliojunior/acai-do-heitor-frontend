// nota_script.js

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
    // --- ELEMENTOS DA UI ---
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

    // --- LÓGICA DO BOTÃO DE ATIVAÇÃO DE SOM (VERSÃO MAIS ROBUSTA) ---
    soundActivationButton.addEventListener('click', () => {
        // Mostra um feedback imediato ao usuário
        soundActivationButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ativando...';
        soundActivationButton.disabled = true;

        // Tenta carregar e tocar o áudio
        notificationSound.load(); // Força o carregamento do source
        const playPromise = notificationSound.play();

        if (playPromise !== undefined) {
            playPromise.then(() => {
                // Sucesso!
                notificationSound.pause();
                notificationSound.currentTime = 0;
                soundEnabled = true;
                
                soundActivationOverlay.style.opacity = '0';
                setTimeout(() => {
                    soundActivationOverlay.style.display = 'none';
                }, 300);
                
                console.log("Notificações sonoras ativadas pelo usuário.");

            }).catch(error => {
                // Falha!
                console.error("ERRO ao tentar ativar o som:", error);
                soundActivationButton.innerHTML = '<i class="fas fa-times"></i> Falha ao Ativar';
                soundActivationButton.style.backgroundColor = '#dc3545';
                soundActivationButton.style.color = 'white';

                // Informa o usuário sobre o erro mais provável
                alert("Não foi possível ativar o som. Verifique o console de erros (F12) para mais detalhes. O motivo mais comum é um erro no caminho do arquivo de áudio.");
            });
        }
    });


    // --- FUNÇÃO DE CÓPIA ROBUSTA (COM FALLBACK) ---
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

    // --- LÓGICA DE NAVEGAÇÃO ---
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetViewId = item.dataset.view;
            views.forEach(view => view.classList.remove('active'));
            document.getElementById(targetViewId).classList.add('active');
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // --- LÓGICA DE NOVOS PEDIDOS ---
    function createNewOrderCard(doc) {
        const order = doc.data();
        const orderId = doc.id;
        const date = order.timestamp ? order.timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
        const deliveryIcon = order.deliveryMode === 'delivery' ? 'fa-motorcycle' : 'fa-store';

        const card = document.createElement('div');
        card.className = 'order-card';
        card.dataset.id = orderId;
        card.innerHTML = `
            <div class="card-summary">
                <div class="card-info">
                    <h3>${order.customerName}</h3>
                    <span>#${order.orderId} - ${date}</span>
                </div>
                <div class="card-status">
                    <span class="total-badge">R$ ${order.totals.total.toFixed(2)}</span>
                    <span class="delivery-type"><i class="fas ${deliveryIcon}"></i> ${order.deliveryMode === 'delivery' ? 'Entrega' : 'Retirada'}</span>
                </div>
            </div>
            <div class="card-details">
                <pre>${order.printerFriendlyText}</pre>
                <div class="card-actions">
                    <button class="copy-btn"><i class="fas fa-copy"></i> Copiar</button>
                    <button class="move-btn"><i class="fas fa-check-circle"></i> Concluir</button>
                </div>
            </div>
        `;
        card.querySelector('.card-summary').addEventListener('click', () => card.classList.toggle('expanded'));
        return card;
    }

    db.collection('pedidos').where('status', '==', 'new').orderBy('timestamp', 'asc')
      .onSnapshot(snapshot => {
          const orderCount = snapshot.size;
          orderCountBadge.textContent = orderCount;
          orderCountBadge.style.display = orderCount > 0 ? 'block' : 'none';

          newOrdersView.innerHTML = '';
          if (snapshot.empty) {
              newOrdersView.innerHTML = '<div class="message-box">Nenhum pedido novo.</div>';
          } else {
              snapshot.forEach(doc => newOrdersView.appendChild(createNewOrderCard(doc)));
          }

          snapshot.docChanges().forEach(change => {
              if (change.type === 'added') {
                  if (soundEnabled) {
                      notificationSound.play().catch(e => console.error("Erro ao tocar notificação:", e));
                  } else {
                      console.log("Novo pedido recebido, mas o som está desativado. Aguardando interação do usuário.");
                  }
              }
          });
      });

    newOrdersView.addEventListener('click', async (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        const card = button.closest('.order-card');
        const docId = card.dataset.id;

        if (button.classList.contains('copy-btn')) {
            const textToCopy = card.querySelector('pre').textContent;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Copiando...';
            const success = await copyToClipboard(textToCopy);
            if (success) {
                button.innerHTML = '<i class="fas fa-paste"></i> Copiado!';
            } else {
                button.innerHTML = '<i class="fas fa-times"></i> Falhou!';
            }
            setTimeout(() => { button.innerHTML = '<i class="fas fa-copy"></i> Copiar'; }, 2500);
        }

        if (button.classList.contains('move-btn')) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Concluindo...';
            card.classList.add('removing');
            setTimeout(async () => {
                await db.collection('pedidos').doc(docId).update({ status: 'completed' });
            }, 300);
        }
    });

    // --- LÓGICA DA BUSCA ---
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const searchTerm = searchInput.value.trim();
        if (!searchTerm) return;
        searchResultsContainer.innerHTML = '<div class="message-box">Buscando...</div>';
        const queryById = db.collection('pedidos').where('status', '==', 'completed').where('orderId', '==', searchTerm).get();
        const queryByName = db.collection('pedidos').where('status', '==', 'completed').where('customerName', '>=', searchTerm).where('customerName', '<=', searchTerm + '\uf8ff').get();
        const [idSnapshot, nameSnapshot] = await Promise.all([queryById, queryByName]);
        const results = new Map();
        idSnapshot.forEach(doc => results.set(doc.id, doc));
        nameSnapshot.forEach(doc => results.set(doc.id, doc));

        if (results.size === 0) {
            searchResultsContainer.innerHTML = '<div class="message-box">Nenhum pedido encontrado.</div>';
            return;
        }

        searchResultsContainer.innerHTML = '';
        Array.from(results.values())
            .sort((a, b) => b.data().timestamp - a.data().timestamp)
            .forEach(doc => {
                const order = doc.data();
                const date = order.timestamp ? order.timestamp.toDate().toLocaleDateString('pt-BR') : 'N/A';
                const card = document.createElement('div');
                card.className = 'result-card';
                card.innerHTML = `
                    <h3>${order.customerName}</h3>
                    <p><strong>Pedido #${order.orderId}</strong> | Data: ${date} | Total: R$ ${order.totals.total.toFixed(2)}</p>
                `;
                searchResultsContainer.appendChild(card);
            });
    });
});