import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Cache the doc instance
let cachedDoc: GoogleSpreadsheet | null = null;
let docLoadPromise: Promise<GoogleSpreadsheet> | null = null;

export const getDoc = async () => {
    if (cachedDoc) return cachedDoc;

    // Request coalescing: return existing promise if loading is in progress
    if (docLoadPromise) return docLoadPromise;

    console.log("Initializing Google Sheets...");

    docLoadPromise = (async () => {
        try {
            const serviceAccountAuth = new JWT({
                email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                scopes: [
                    'https://www.googleapis.com/auth/spreadsheets',
                ],
            });

            const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID as string, serviceAccountAuth);
            await doc.loadInfo();
            console.log(`Doc loaded: ${doc.title}`);
            cachedDoc = doc;
            return doc;
        } catch (e) {
            docLoadPromise = null; // Reset promise on error so retry is possible
            throw e;
        }
    })();

    return docLoadPromise;
};
