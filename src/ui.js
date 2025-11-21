// קובץ זה אחראי על כל מה שקשור ל-DOM: רינדור תצוגות, עדכון אלמנטים וטיפול באירועים.
import * as api from './api.js';
import { showToast, Loader } from './utils.js';

const appRoot = document.getElementById('app-root');
let currentUser = null;
let currentFilters = { searchTerm: '', status: 'all' };

// --- פונקציות ניהול מצב פנימי ---

export function setCurrentUser(user) {
    currentUser = user;
}

// --- פונקציות רינדור עיקריות ---

export async function renderDashboard() {
    appRoot.innerHTML = ''; // ניקוי המסך לפני הצגת תוכן חדש
    const template = document.getElementById('dashboard-template').content.cloneNode(true);
    appRoot.appendChild(template);
    
    // הגדרות כלליות לדשבורד
    appRoot.querySelector('#dashboard-title').textContent = currentUser.isAdmin ? 'כלל הבקשות במערכת' : 'הבקשות שלי';
    const newRequestBtn = appRoot.querySelector('#new-request-btn');
    if (currentUser.isAdmin) {
        newRequestBtn.style.display = 'none'; // מנהל לא מגיש בקשות
        setupAdminFilters();
    } else {
        newRequestBtn.addEventListener('click', renderNewRequestForm);
    }

    const gridContainer = appRoot.querySelector('#requests-grid-container');
    const loader = new Loader(gridContainer);
    loader.show();
    
    try {
        const requests = await api.getRequests(currentUser.isAdmin);
        const filteredRequests = applyFilters(requests);
        
        gridContainer.innerHTML = ''; // ניקוי הספינר לאחר שהמידע הגיע
        if (filteredRequests.length === 0) {
            gridContainer.innerHTML = `<p>לא נמצאו בקשות.</p>`;
        } else {
            filteredRequests.forEach((req, index) => {
                const card = renderRequestCard(req);
                card.style.animationDelay = `${index * 50}ms`; // אנימציה מדורגת
                gridContainer.appendChild(card);
            });
        }
    } catch (error) {
        gridContainer.innerHTML = `<p style="color: red;">אירעה שגיאה בטעינת המידע.</p>`;
        showToast(`שגיאה: ${error.message}`, 'error');
    }
}

export async function renderModal(requestId) {
    try {
        const items = await api.getRequestItems(requestId);
        // בשביל לקבל את שאר הפרטים, נצטרך לקרוא שוב ל-API הראשי ולמצוא את הבקשה
        const allRequests = await api.getRequests(currentUser.isAdmin);
        const requestData = allRequests.find(r => r.id === requestId);
        
        if (!requestData) throw new Error("לא ניתן למצוא את פרטי הבקשה.");

        const template = document.getElementById('request-modal-template').content.cloneNode(true);
        const modalOverlay = template.querySelector('.modal-overlay');

        modalOverlay.querySelector('.modal-title').textContent = `פרטי בקשה #${requestData.id}`;
        modalOverlay.querySelector('.modal-author').textContent = requestData.author;
        modalOverlay.querySelector('.modal-date').textContent = requestData.created;
        modalOverlay.querySelector('.modal-reason').textContent = requestData.reason;

        const tableBody = modalOverlay.querySelector('.items-table tbody');
        tableBody.innerHTML = '';
        if (items.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="3">לא נמצאו פריטים עבור בקשה זו.</td></tr>`;
        } else {
            items.forEach(item => tableBody.appendChild(createItemRow(item, currentUser.isAdmin)));
        }

        if (currentUser.isAdmin) {
            setupAdminModalActions(modalOverlay, requestId, items);
        }

        const closeModal = () => {
            modalOverlay.remove();
            renderDashboard(); // רענון הדשבורד להצגת שינויים אפשריים
        };
        setupModalCloseHandlers(modalOverlay, closeModal);

        document.body.appendChild(modalOverlay);
    } catch (error) {
        showToast(`שגיאה בטעינת פרטי הבקשה: ${error.message}`, 'error');
    }
}

export function renderNewRequestForm() {
    appRoot.innerHTML = '';
    const template = document.getElementById('new-request-form-template').content.cloneNode(true);
    appRoot.appendChild(template);
    
    document.getElementById('add-item-btn').addEventListener('click', addFormItemRow);
    document.getElementById('cancel-btn').addEventListener('click', renderDashboard);
    document.getElementById('new-request-form').addEventListener('submit', handleFormSubmit);
    
    addFormItemRow(); // הוספת שורת פריט ראשונה
}

// --- פונקציות עזר לרינדור ---

function renderRequestCard(req) {
    const template = document.getElementById('request-card-template').content.cloneNode(true);
    const card = template.querySelector('.request-card');
    
    card.querySelector('.request-id').textContent = `בקשה #${req.id}`;
    card.querySelector('.request-reason').textContent = req.reason;
    card.querySelector('.request-author').textContent = `מאת: ${req.author}`;
    card.querySelector('.request-date').textContent = req.created;
    
    const statusEl = card.querySelector('.request-status');
    statusEl.textContent = req.status;
    statusEl.dataset.status = req.status;
    
    if (currentUser.isAdmin) {
        card.classList.add('clickable');
        card.dataset.requestId = req.id;
    }
    return card;
}

function createItemRow(item, isAdmin) {
    const row = document.createElement('tr');
    row.dataset.itemId = item.id;
    
    const statusCellContent = isAdmin
        ? `<select class="item-status-select" data-item-id="${item.id}">
                <option value="ממתין" ${item.status === 'ממתין' ? 'selected' : ''}>ממתין</option>
                <option value="מאושר" ${item.status === 'מאושר' ? 'selected' : ''}>מאושר</option>
                <option value="נדחה" ${item.status === 'נדחה' ? 'selected' : ''}>נדחה</option>
           </select>`
        : `<span class="request-status" data-status="${item.status}">${item.status}</span>`;

    row.innerHTML = `<td>${item.title}</td><td>${item.quantity}</td><td>${statusCellContent}</td>`;
    return row;
}

function addFormItemRow() {
    const list = document.getElementById('items-list');
    const itemRow = document.createElement('div');
    itemRow.className = 'item-row';
    itemRow.innerHTML = `
        <input type="text" placeholder="שם הפריט (חובה)" class="item-name" required>
        <input type="number" value="1" min="1" class="item-quantity" required>
        <button type="button" class="remove-item-btn" title="הסר פריט">&times;</button>`;
    list.appendChild(itemRow);
    itemRow.querySelector('.remove-item-btn').addEventListener('click', () => itemRow.remove());
}

// --- לוגיקת אירועים וסינון ---

function setupAdminFilters() {
    const filtersContainer = appRoot.querySelector('#dashboard-filters-container');
    filtersContainer.style.display = 'flex';
    const searchInput = appRoot.querySelector('#search-input');
    const statusFilter = appRoot.querySelector('#status-filter');
    
    searchInput.value = currentFilters.searchTerm;
    statusFilter.value = currentFilters.status;

    const applyFiltersAndRerender = () => {
        currentFilters.searchTerm = searchInput.value;
        currentFilters.status = statusFilter.value;
        renderDashboard();
    };

    searchInput.addEventListener('input', applyFiltersAndRerender);
    statusFilter.addEventListener('change', applyFiltersAndRerender);
}

function applyFilters(requests) {
    if (!currentUser.isAdmin) return requests;

    const { searchTerm, status } = currentFilters;
    let filtered = requests;

    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(r => 
            r.id.toString().includes(term) ||
            r.reason.toLowerCase().includes(term) ||
            r.author.toLowerCase().includes(term)
        );
    }
    if (status !== 'all') {
        filtered = filtered.filter(r => r.status === status);
    }
    return filtered;
}

function setupAdminModalActions(modalOverlay, requestId, items) {
    modalOverlay.querySelector('.modal-actions').style.display = 'flex';
    
    // מאזין לשינויים בכל הטבלה
    modalOverlay.querySelector('.items-table').addEventListener('change', async (e) => {
        if (e.target.classList.contains('item-status-select')) {
            const itemId = parseInt(e.target.dataset.itemId);
            const newStatus = e.target.value;
            try {
                await api.updateItemStatus(itemId, newStatus);
                showToast('סטטוס פריט עודכן');
                // לאחר עדכון פריט, נעדכן גם את סטטוס הבקשה הראשית
                await updateParentRequestStatus(requestId);
            } catch (error) {
                showToast(`שגיאה בעדכון: ${error.message}`, 'error');
            }
        }
    });

    modalOverlay.querySelector('#approve-all-btn').addEventListener('click', () => updateAllItemsStatus(requestId, items, 'מאושר'));
    modalOverlay.querySelector('#reject-all-btn').addEventListener('click', () => updateAllItemsStatus(requestId, items, 'נדחה'));
}

async function updateAllItemsStatus(requestId, items, status) {
    showToast('מעדכן סטטוסים...');
    try {
        const updates = items.map(item => api.updateItemStatus(item.id, status));
        await Promise.all(updates);
        
        // עדכון סטטוס הבקשה הראשית
        const newRequestStatus = status === 'מאושר' ? 'מאושר' : 'נדחה';
        await api.updateRequestStatus(requestId, newRequestStatus);
        
        showToast(`כל הפריטים סומנו כסטטוס '${status}'`);
        document.querySelector('.modal-overlay')?.remove();
        renderDashboard();
    } catch (error) {
        showToast(`שגיאה בעדכון כללי: ${error.message}`, 'error');
    }
}

async function updateParentRequestStatus(requestId) {
    const items = await api.getRequestItems(requestId);
    let newStatus;
    if (items.every(i => i.status === 'מאושר')) newStatus = 'מאושר';
    else if (items.every(i => i.status === 'נדחה')) newStatus = 'נדחה';
    else newStatus = 'מאושר חלקית';

    await api.updateRequestStatus(requestId, newStatus);
}

function setupModalCloseHandlers(modalOverlay, closeModalCallback) {
    modalOverlay.querySelector('.modal-close-btn').addEventListener('click', closeModalCallback);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModalCallback();
    });
    document.addEventListener('keydown', function onEsc(e) {
        if (e.key === 'Escape') {
            closeModalCallback();
            document.removeEventListener('keydown', onEsc);
        }
    });
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const reason = document.getElementById('request-reason-input').value.trim();
    const items = [];
    document.querySelectorAll('.item-row').forEach(row => {
        const name = row.querySelector('.item-name').value.trim();
        const quantity = parseInt(row.querySelector('.item-quantity').value);
        if (name && quantity > 0) items.push({ name, quantity });
    });

    if (!reason || items.length === 0) {
        showToast("יש למלא סיבה ולפחות פריט אחד.", "error");
        return;
    }
    
    // השבתת כפתור השליחה למניעת לחיצות כפולות
    event.target.querySelector('button[type="submit"]').disabled = true;
    showToast('שולח בקשה...');

    try {
        await api.submitNewRequest(reason, items);
        showToast('הבקשה נשלחה בהצלחה!', 'success');
        renderDashboard();
    } catch (error) {
        showToast(`שגיאה בשליחת הבקשה: ${error.message}`, 'error');
        event.target.querySelector('button[type="submit"]').disabled = false;
    }
}