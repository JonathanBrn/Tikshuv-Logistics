// קובץ זה מכיל את כל הקריאות ל-SharePoint REST API
// הוא משתמש באובייקט הגלובלי _spPageContextInfo שזמין בכל דף SharePoint

// הגדרות כלליות שניתן לשנות בקלות
const SITE_URL = _spPageContextInfo.webAbsoluteUrl;
const REQUESTS_LIST_NAME = "EquipmentRequests";
const ITEMS_LIST_NAME = "RequestItems";
const ADMIN_GROUP_NAME = "Equipment Admins"; // שנה אם בחרת שם אחר לקבוצת המנהלים

// --- פונקציות עזר פנימיות ---

/**
 * פונקציה מרכזית לביצוע קריאות fetch ל-SharePoint. מטפלת בכותרות ובשגיאות.
 * @param {string} endpoint - כתובת ה-API היחסית (לדוגמה: '/_api/web/lists').
 * @param {object} options - אופציות של fetch (method, body, headers וכו').
 * @returns {Promise<any>} - מחזיר את הנתונים מהשרת.
 */
async function spFetch(endpoint, options = {}) {
    const headers = {
        'Accept': 'application/json;odata=verbose',
        'Content-Type': 'application/json;odata=verbose',
        ...options.headers,
    };

    const response = await fetch(`${SITE_URL}${endpoint}`, { ...options, headers });

    if (!response.ok) {
        const errorData = await response.json();
        // מנסה לחלץ את הודעת השגיאה הספציפית של SharePoint
        const errorMessage = errorData?.error?.message?.value || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
    }
    
    // קריאות מסוימות (כמו DELETE או עדכון מוצלח) לא מחזירות תוכן (status 204)
    if (response.status === 204) {
        return;
    }

    const data = await response.json();
    return data.d; // הנתונים ב-REST API של SP נמצאים תחת המפתח 'd'
}

/**
 * מחזיר את ה-Form Digest Value הנדרש עבור קריאות כתיבה (POST, MERGE, DELETE).
 * @returns {Promise<string>} - מחזיר את מפתח האבטחה.
 */
async function getFormDigest() {
    const data = await spFetch(`/_api/contextinfo`, { method: 'POST' });
    return data.GetContextWebInformation.FormDigestValue;
}

// --- פונקציות API ציבוריות (מיוצאות לשימוש בשאר האפליקציה) ---

/**
 * בודק אם המשתמש הנוכחי חבר בקבוצת המנהלים.
 * @returns {Promise<boolean>} - מחזיר true אם המשתמש הוא מנהל.
 */
export async function checkIsCurrentUserAdmin() {
    try {
        const endpoint = `/_api/web/sitegroups/getbyname('${ADMIN_GROUP_NAME}')/users?$filter=Id eq ${_spPageContextInfo.userId}`;
        const result = await spFetch(endpoint);
        // אם המערך מכיל תוצאות, המשתמש נמצא בקבוצה
        return result.results.length > 0;
    } catch (error) {
        console.warn(`Could not check admin status. The SharePoint group '${ADMIN_GROUP_NAME}' may not exist. Treating user as non-admin.`, error);
        return false;
    }
}

/**
 * מחזיר את פרטי המשתמש הנוכחי.
 * @returns {Promise<object>} - אובייקט עם פרטי המשתמש.
 */
export async function getCurrentUser() {
    return {
        id: _spPageContextInfo.userId,
        name: _spPageContextInfo.userDisplayName,
        isAdmin: await checkIsCurrentUserAdmin()
    };
}

/**
 * מחזיר את רשימת הבקשות מ-SharePoint.
 * @param {boolean} isAdmin - האם המשתמש הוא מנהל (כדי להחליט אם לסנן את הבקשות).
 * @returns {Promise<Array<object>>} - מערך של אובייקטי בקשה.
 */
export async function getRequests(isAdmin) {
    let endpoint = `/_api/web/lists/getbytitle('${REQUESTS_LIST_NAME}')/items?$select=Id,Title,Created,RequestStatus,Author/Id,Author/Title&$expand=Author&$orderby=Created desc`;
    
    // אם המשתמש אינו מנהל, סנן את התוצאות כך שיראה רק את הבקשות של עצמו
    if (!isAdmin) {
        endpoint += `&$filter=Author/Id eq ${_spPageContextInfo.userId}`;
    }
    
    const data = await spFetch(endpoint);
    // מיפוי השדות של SharePoint לאובייקט שהאפליקציה שלנו מבינה
    return data.results.map(item => ({
        id: item.Id,
        reason: item.Title, // השתמשנו בעמודת Title עבור סיבת הבקשה
        status: item.RequestStatus,
        author: item.Author.Title,
        created: new Date(item.Created).toLocaleDateString('he-IL')
    }));
}

/**
 * מחזיר את הפריטים המשויכים לבקשה ספציפית.
 * @param {number} requestId - מזהה הבקשה.
 * @returns {Promise<Array<object>>} - מערך של פריטים.
 */
export async function getRequestItems(requestId) {
    const endpoint = `/_api/web/lists/getbytitle('${ITEMS_LIST_NAME}')/items?$select=Id,Title,Quantity,ItemStatus,ParentRequestId&$filter=ParentRequestId eq ${requestId}`;
    const data = await spFetch(endpoint);
    return data.results.map(item => ({
        id: item.Id,
        title: item.Title,
        quantity: item.Quantity,
        status: item.ItemStatus
    }));
}

/**
 * שולח בקשה חדשה ל-SharePoint.
 * @param {string} reason - סיבת הבקשה.
 * @param {Array<object>} items - מערך של פריטים.
 * @returns {Promise<object>} - מחזיר את נתוני הבקשה החדשה שנוצרה.
 */
export async function submitNewRequest(reason, items) {
    const digest = await getFormDigest();
    
    // 1. צור את רשומת הבקשה הראשית
    const requestBody = { '__metadata': { 'type': `SP.Data.${REQUESTS_LIST_NAME}ListItem` }, 'Title': reason, 'RequestStatus': 'ממתין' };
    const newRequestData = await spFetch(`/_api/web/lists/getbytitle('${REQUESTS_LIST_NAME}')/items`, {
        method: 'POST',
        headers: { 'X-RequestDigest': digest },
        body: JSON.stringify(requestBody)
    });
    const newRequestId = newRequestData.Id;

    // 2. צור את כל רשומות הפריטים המקושרות אליה
    const itemPromises = items.map(item => {
        const itemBody = {
            '__metadata': { 'type': `SP.Data.${ITEMS_LIST_NAME}ListItem` },
            'Title': item.name, 'Quantity': item.quantity, 'ItemStatus': 'ממתין',
            'ParentRequestId': newRequestId // הקישור החשוב!
        };
        return spFetch(`/_api/web/lists/getbytitle('${ITEMS_LIST_NAME}')/items`, {
            method: 'POST',
            headers: { 'X-RequestDigest': digest },
            body: JSON.stringify(itemBody)
        });
    });

    // המתן לסיום כל יצירות הפריטים
    await Promise.all(itemPromises);
    return newRequestData;
}

/**
 * מעדכן סטטוס של פריט בודד.
 * @param {number} itemId - מזהה הפריט.
 * @param {string} newStatus - הסטטוס החדש.
 */
export async function updateItemStatus(itemId, newStatus) {
    const digest = await getFormDigest();
    const itemBody = { '__metadata': { 'type': `SP.Data.${ITEMS_LIST_NAME}ListItem` }, 'ItemStatus': newStatus };
    
    await spFetch(`/_api/web/lists/getbytitle('${ITEMS_LIST_NAME}')/items(${itemId})`, {
        method: 'POST',
        headers: {
            'X-RequestDigest': digest,
            'IF-MATCH': '*', // דרוס שינויים קודמים אם קיימים
            'X-HTTP-Method': 'MERGE' // פעולת עדכון
        },
        body: JSON.stringify(itemBody)
    });
}

/**
 * מעדכן את הסטטוס של הבקשה הראשית.
 * @param {number} requestId - מזהה הבקשה.
 * @param {string} newStatus - הסטטוס החדש.
 */
export async function updateRequestStatus(requestId, newStatus) {
    const digest = await getFormDigest();
    const requestBody = { '__metadata': { 'type': `SP.Data.${REQUESTS_-LIST_NAME}ListItem` }, 'RequestStatus': newStatus };

    await spFetch(`/_api/web/lists/getbytitle('${REQUESTS_LIST_NAME}')/items(${requestId})`, {
        method: 'POST',
        headers: { 'X-RequestDigest': digest, 'IF-MATCH': '*', 'X-HTTP-Method': 'MERGE' },
        body: JSON.stringify(requestBody)
    });
}