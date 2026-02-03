import { getDoc } from './google-sheets';
import { getUsers } from './data';
import { User } from './types';

export async function getSharedPassword(): Promise<string | null> {
    const doc = await getDoc();
    // Try both naming conventions just in case, prioritize user request
    let sheet = doc.sheetsByTitle['シート1'];
    if (!sheet) {
        sheet = doc.sheetsByTitle['Sheet1'];
    }

    if (!sheet) {
        console.warn("Password sheet 'シート1' or 'Sheet1' not found");
        return null;
    }

    // Load first 2 rows
    await sheet.loadCells('A1:A2');
    const passwordCell = sheet.getCell(1, 0); // A2 (0-indexed row 1, col 0)
    return passwordCell.value?.toString() || null;
}

export async function validateUser(email: string, passwordInput: string): Promise<User | null> {
    const sharedPassword = await getSharedPassword();
    if (!sharedPassword) {
        console.error("Shared password not configured");
        return null; // Fail safe
    }

    if (passwordInput !== sharedPassword) {
        return null; // Invalid password
    }

    const users = await getUsers();
    // Find user by email
    for (const user of users.values()) {
        if (user.email === email) {
            return user;
        }
    }

    return null; // Email not found
}
