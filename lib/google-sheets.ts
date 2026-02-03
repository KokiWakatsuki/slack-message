import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export const getDoc = async () => {
    console.log("Initializing Google Sheets...");
    console.log("Email present:", !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
    console.log("Key present:", !!process.env.GOOGLE_PRIVATE_KEY);
    console.log("Sheet ID present:", !!process.env.SPREADSHEET_ID);

    const serviceAccountAuth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
        ],
    });

    const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID as string, serviceAccountAuth);
    await doc.loadInfo();
    return doc;
};
