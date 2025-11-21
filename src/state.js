// קובץ זה מרכז את כל המצב (state) של האפליקציה במקום אחד.

// הגדרות ומשתמשים
export const USERS = {
    USER: { name: 'ישראל ישראלי', role: 'user' },
    ADMIN: { name: 'מנהל המערכת', role: 'admin' },
};

// המצב ההתחלתי של האפליקציה
const appState = {
    currentUser: USERS.USER,
    filters: { searchTerm: '', status: 'all' },
};

// פונקציות לקבלת ועדכון המצב (Getters/Setters)
export function getCurrentUser() {
    return appState.currentUser;
}

export function setCurrentUser(user) {
    appState.currentUser = user;
}

export function getFilters() {
    return appState.filters;
}

export function setFilters(newFilters) {
    appState.filters = { ...appState.filters, ...newFilters };
}