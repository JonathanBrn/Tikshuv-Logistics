// קובץ זה הוא נקודת הכניסה לאפליקציה.
// הוא אחראי על אתחול המערכת וחיבור בין כל המודולים.
import * as ui from './ui.js';
import * as api from './api.js';
import { showToast } from './utils.js';

/**
 * פונקציית האתחול הראשית של האפליקציה.
 */
async function init() {
    console.log("Initializing Equipment Requests Application...");
    
    // מציג ספינר טעינה כללי עד שפרטי המשתמש יגיעו
    const appRoot = document.getElementById('app-root');
    appRoot.innerHTML = `<div class="loader-container"><div class="loader-spinner"></div></div>`;

    try {
        // קודם כל, מבררים מי המשתמש ומה ההרשאות שלו
        const currentUser = await api.getCurrentUser();
        document.getElementById('user-display').textContent = `שלום, ${currentUser.name}`;
        
        // מעבירים את פרטי המשתמש למודול ה-UI שישתמש בהם
        ui.setCurrentUser(currentUser);
        
        // מפעילים את המאזינים לאירועים
        setupEventListeners();
        
        // לאחר שכל ההכנות בוצעו, מציגים את הדשבורד הראשי
        ui.renderDashboard();
    } catch (error) {
        // במקרה של שגיאה קריטית באתחול, הצג הודעה למשתמש
        appRoot.innerHTML = `<p style="color: red; text-align: center;">לא ניתן היה לטעון את האפליקציה. אנא ודא שהרשימות הוגדרו כראוי ורענן את הדף.</p>`;
        showToast(`שגיאה קריטית באתחול: ${error.message}`, "error");
        console.error("Initialization failed:", error);
    }
}

/**
 * פונקציה המגדירה את מאזיני האירועים הגלובליים של האפליקציה.
 */
function setupEventListeners() {
    const appRoot = document.getElementById('app-root');

    // במקום להוסיף 'listener' לכל כרטיס בנפרד, אנו מאזינים למיכל האב.
    // זה יעיל יותר ועובד גם על אלמנטים שנוצרים דינמית.
    appRoot.addEventListener('click', (event) => {
        // בדוק אם האלמנט שנלחץ (או אחד מאבותיו) הוא כרטיסיה לחיצה
        const card = event.target.closest('.request-card.clickable');
        if (card) {
            const requestId = parseInt(card.dataset.requestId);
            if (!isNaN(requestId)) {
                ui.renderModal(requestId);
            }
        }
    });
}

// התחלת האפליקציה רק לאחר שה-DOM כולו נטען ומוכן
document.addEventListener('DOMContentLoaded', init);