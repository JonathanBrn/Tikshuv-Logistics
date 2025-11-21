// קובץ זה מכיל פונקציות עזר כלליות שניתן להשתמש בהן בכל האפליקציה.

/**
 * מציג הודעת Toast למשתמש.
 * @param {string} message - ההודעה להצגה.
 * @param {'success' | 'error'} type - סוג ההודעה (משפיע על הצבע).
 */
export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.error('Toast container element with id "toast-container" was not found in the DOM!');
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // מפעיל את אנימציית הכניסה רגע לאחר הוספת האלמנט ל-DOM
    setTimeout(() => toast.classList.add('show'), 10);

    // מסתיר ומסיר את ההודעה לאחר 3 שניות
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        // מאזין לסוף אנימציית היציאה כדי להסיר את האלמנט מה-DOM بشكل נקי
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
}

/**
 * מחלקה לניהול תצוגת טעינה (ספינר).
 */
export class Loader {
    /**
     * @param {HTMLElement} container - האלמנט שבתוכו יוצג הספינר.
     */
    constructor(container) {
        if (!container || !(container instanceof HTMLElement)) {
            throw new Error("Loader class requires a valid HTML container element.");
        }
        this.container = container;
        this.loaderElement = document.createElement('div');
        this.loaderElement.className = 'loader-container';
        this.loaderElement.innerHTML = `<div class="loader-spinner"></div>`;
    }

    /**
     * מציג את ספינר הטעינה בתוך המיכל שהוגדר.
     */
    show() {
        // מנקה את התוכן הקיים לפני הצגת הספינר
        this.container.innerHTML = '';
        this.container.appendChild(this.loaderElement);
    }

    /**
     * מסתיר את ספינר הטעינה.
     */
    hide() {
        // בודק אם הספינר עדיין קיים בתוך המיכל לפני שמנסה להסיר אותו
        if (this.loaderElement.parentNode === this.container) {
            try {
                 this.container.removeChild(this.loaderElement);
            } catch (e) {
                // במקרה נדיר שהאלמנט כבר הוסר, נתעלם מהשגיאה
                console.warn("Loader element was already removed.", e);
            }
        }
    }
}