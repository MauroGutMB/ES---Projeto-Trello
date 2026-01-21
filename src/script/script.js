const currentUser = JSON.parse(localStorage.getItem('currentUser'));
const inspectingUserEmail = localStorage.getItem('inspectingUser');

if (!currentUser) {
    window.location.href = 'Login.html';
}

const dataOwnerEmail = (currentUser.role === 'professor' && inspectingUserEmail) 
    ? inspectingUserEmail 
    : currentUser.email;

const isReadOnly = currentUser.role === 'professor';

const STORAGE_KEY = `kanban_data_${dataOwnerEmail}`;

let cardDataStore = new Map();
let cardIdCounter = 1;

function loadData() {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (rawData) {
        const parsedData = JSON.parse(rawData);
        
        cardIdCounter = parsedData.counter;
        cardDataStore = new Map(parsedData.cards);
        
        document.querySelectorAll('.kanban-cards').forEach(col => col.innerHTML = '');
        
        cardDataStore.forEach((value, key) => {
            const column = document.querySelector(`.kanban-column[data-id="${value.columnId}"] .kanban-cards`);
            if (column) {
                createCardElement(column, key, value.title, value.priority, value.comments, value.attachments);
            }
        });
    }
}

function saveData() {
    const dataToSave = {
        counter: cardIdCounter,
        cards: Array.from(cardDataStore.entries())
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
}

// --- Elementos do Modal de Detalhes ---
const modal = document.getElementById('card-modal');
const modalTitle = document.getElementById('modal-card-title');
const commentsList = document.getElementById('comments-list');
const attachmentList = document.getElementById('attachment-list');
const commentInput = document.getElementById('new-comment-text');
const fileInput = document.getElementById('file-input');

// Modal Delete Elements
const deleteModal = document.getElementById('delete-modal');
const btnConfirmDelete = document.getElementById('btn-confirm-delete');
const btnCancelDelete = document.getElementById('btn-cancel-delete');

let currentOpenCardId = null;
let cardToDeleteId = null;

// --- Funções Auxiliares de Renderização de Card ---
function createCardElement(container, id, title, priority, comments = [], attachments = []) {
    const card = document.createElement('div');
    card.classList.add('kanban-card');
    
    // Se não for professor, permite arrastar
    if (!isReadOnly) {
        card.setAttribute('draggable', 'true');
    }
    
    card.id = id;

    let badgeText = '';
    let badgeClass = priority;

    switch(priority) {
        case 'high': badgeText = 'Alta prioridade'; break;
        case 'medium': badgeText = 'Média prioridade'; break;
        case 'low': badgeText = 'Baixa prioridade'; break;
    }

    // Botão de deletar só aparece se não for professor
    const deleteButtonHtml = isReadOnly ? '' : `<button class="btn-delete" title="Excluir card"><i class="fa-solid fa-trash"></i></button>`;

    card.innerHTML = `
        <div class="card-header">
            <div class="badge ${badgeClass}"><span>${badgeText}</span></div>
            ${deleteButtonHtml}
        </div>
        <p class="card-title">${title}</p>
        <div class="card-infos">
            <div class="card-icons">
                <p class="icon-comment"><i class="fa-regular fa-comment"></i> <span class="count-comments">${comments.length}</span></p>
                <p class="icon-attach"><i class="fa-solid fa-paperclip"></i> <span class="count-attachments">${attachments.length}</span></p>
            </div>
            <div class="user">
                <img src="src/imagens/avatar2.png" alt="Avatar">
            </div>
        </div>
    `;

    if (!isReadOnly) addDragEvents(card);
    addCardInteractions(card);
    container.appendChild(card);
}

// --- Funções Drag & Drop ---
function addDragEvents(card) {
    card.addEventListener('dragstart', e => {
        e.currentTarget.classList.add('dragging');
    });

    card.addEventListener('dragend', e => {
        e.currentTarget.classList.remove('dragging');
        // Salva a nova posição após mover
        updateCardColumn(card.id); 
    });
}

function updateCardColumn(cardId) {
    const card = document.getElementById(cardId);
    const column = card.closest('.kanban-column');
    if (column && cardDataStore.has(cardId)) {
        const data = cardDataStore.get(cardId);
        data.columnId = column.getAttribute('data-id');
        cardDataStore.set(cardId, data);
        saveData();
    }
}

// --- Interações do Card (Delete e Detalhes) ---
function addCardInteractions(card) {
    // Botão de Excluir
    const deleteBtn = card.querySelector('.btn-delete');
    if (deleteBtn && !isReadOnly) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openDeleteModal(card.id);
        });
    }

    // Clique no Card para Detalhes
    card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete')) return;
        
        // Busca título atual do dataStore em vez do HTML para garantir integridade
        const data = cardDataStore.get(card.id);
        openModal(card.id, data.title);
    });
}

// --- Lógica Modal de Delete ---
function openDeleteModal(cardId) {
    if (isReadOnly) return;
    cardToDeleteId = cardId;
    deleteModal.classList.remove('hidden');
}

function closeDeleteModal() {
    cardToDeleteId = null;
    deleteModal.classList.add('hidden');
}

if (btnCancelDelete) btnCancelDelete.addEventListener('click', closeDeleteModal);

if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener('click', () => {
        if (cardToDeleteId && !isReadOnly) {
            const card = document.getElementById(cardToDeleteId);
            if (card) {
                card.remove(); 
                cardDataStore.delete(cardToDeleteId); 
                saveData();
            }
            closeDeleteModal();
        }
    });
}

deleteModal.addEventListener('click', (e) => {
    if(e.target === deleteModal) closeDeleteModal();
});

// --- Lógica Modal de Detalhes ---
function openModal(cardId, title) {
    currentOpenCardId = cardId;
    modalTitle.innerText = title;
    
    // Oculta inputs se for professor
    if (isReadOnly) {
        document.querySelector('.comment-input-area').style.display = 'none';
        document.getElementById('btn-add-attachment').style.display = 'none';
    } else {
        document.querySelector('.comment-input-area').style.display = 'flex';
        document.getElementById('btn-add-attachment').style.display = 'block';
    }

    renderModalContent();
    modal.classList.remove('hidden');
}

function closeModal() {
    modal.classList.add('hidden');
    currentOpenCardId = null;
}

function renderModalContent() {
    const data = cardDataStore.get(currentOpenCardId);
    if (!data) return;

    // Renderiza Comentários
    commentsList.innerHTML = '';
    if (data.comments.length === 0) {
        commentsList.innerHTML = '<p style="color: #ccc; font-style: italic; font-size: 13px;">Nenhum comentário ainda.</p>';
    } else {
        data.comments.forEach(comment => {
            const div = document.createElement('div');
            div.classList.add('comment-item');
            div.innerHTML = `
                <div class="comment-header"><span>Usuário</span> <span>${comment.date}</span></div>
                <div>${comment.text}</div>
            `;
            commentsList.appendChild(div);
        });
    }

    // Renderiza Anexos
    attachmentList.innerHTML = '';
    if (data.attachments.length === 0) {
        attachmentList.innerHTML = '<li style="background: transparent; border: none; padding: 0; color: #ccc;">Nenhum anexo.</li>';
    } else {
        data.attachments.forEach(file => {
            const li = document.createElement('li');
            li.innerHTML = `<i class="fa-solid fa-file-lines" style="color: #4f46e5;"></i> ${file}`;
            attachmentList.appendChild(li);
        });
    }
}

function updateCardCounters(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;

    const data = cardDataStore.get(cardId);
    
    const commentCount = card.querySelector('.count-comments');
    const attachCount = card.querySelector('.count-attachments');

    if (commentCount) commentCount.innerText = data.comments.length;
    if (attachCount) attachCount.innerText = data.attachments.length;
}

// Eventos Modal Detalhes
document.getElementById('close-modal').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

// Salvar Comentário
document.getElementById('btn-save-comment').addEventListener('click', () => {
    if (isReadOnly) return;

    const text = commentInput.value.trim();
    if (!text || !currentOpenCardId) return;

    const data = cardDataStore.get(currentOpenCardId);
    data.comments.push({
        text: text,
        date: new Date().toLocaleString()
    });
    
    // Atualiza Map e Storage
    cardDataStore.set(currentOpenCardId, data);
    saveData();

    commentInput.value = '';
    renderModalContent();
    updateCardCounters(currentOpenCardId);
});

// Adicionar Anexo
document.getElementById('btn-add-attachment').addEventListener('click', () => {
    if (!isReadOnly) fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (isReadOnly) return;

    if (e.target.files.length > 0 && currentOpenCardId) {
        const fileName = e.target.files[0].name;
        const data = cardDataStore.get(currentOpenCardId);
        
        data.attachments.push(fileName);
        
        cardDataStore.set(currentOpenCardId, data);
        saveData();
        
        renderModalContent();
        updateCardCounters(currentOpenCardId);
        
        fileInput.value = ''; 
    }
});


// --- Inicialização e Drag & Drop das Colunas ---
document.querySelectorAll('.kanban-cards').forEach(column => {
    if (isReadOnly) return; // Professor não pode mover cards

    column.addEventListener('dragover', e => {
        e.preventDefault();
        e.currentTarget.classList.add('cards-hover');
    });

    column.addEventListener('dragleave', e => {
        e.currentTarget.classList.remove('cards-hover');
    });

    column.addEventListener('drop', e => {
        e.currentTarget.classList.remove('cards-hover');
        const dragCard = document.querySelector('.kanban-card.dragging');
        if (dragCard) {
            e.currentTarget.appendChild(dragCard);
        }
    });
});

// Adicionar Novo Card (Formulário)
const addButtons = document.querySelectorAll('.add-card');

// Esconde botões de adicionar se for professor
if (isReadOnly) {
    addButtons.forEach(btn => btn.style.display = 'none');
} else {
    addButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const titleArea = e.target.closest('.kanban-title');
            const column = titleArea.parentElement;
            const columnId = column.getAttribute('data-id');
            const cardsContainer = column.querySelector('.kanban-cards');
            
            if (column.querySelector('.new-card-form')) return;

            const form = document.createElement('div');
            form.classList.add('new-card-form');
            form.innerHTML = `
                <textarea placeholder="Título da tarefa..." rows="2"></textarea>
                <select>
                    <option value="low">Baixa Prioridade</option>
                    <option value="medium">Média Prioridade</option>
                    <option value="high">Alta Prioridade</option>
                </select>
                <div class="form-actions">
                    <button class="form-btn btn-cancel">Cancelar</button>
                    <button class="form-btn btn-confirm">Adicionar</button>
                </div>
            `;

            cardsContainer.prepend(form);
            const textarea = form.querySelector('textarea');
            textarea.focus();

            form.querySelector('.btn-cancel').addEventListener('click', () => {
                form.remove();
            });

            form.querySelector('.btn-confirm').addEventListener('click', () => {
                const title = textarea.value.trim();
                const priority = form.querySelector('select').value;
                
                if (title === "") return;

                createNewCardLogic(cardsContainer, title, priority, columnId);
                form.remove();
            });
        });
    });
}

function createNewCardLogic(container, title, priority, columnId) {
    const cardId = `card-${Date.now()}`; 
    
    // Salva no estado global
    cardDataStore.set(cardId, { 
        title: title,
        priority: priority,
        columnId: columnId,
        comments: [], 
        attachments: [] 
    });
    
    saveData(); 

    // Cria visualmente
    createCardElement(container, cardId, title, priority);
}

document.addEventListener('DOMContentLoaded', loadData);