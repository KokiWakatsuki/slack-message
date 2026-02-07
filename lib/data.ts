import { channel } from 'diagnostics_channel';
import { getDoc } from './google-sheets';
import { Channel, Message, User } from './types';
import { format } from 'date-fns';

const USER_SHEET_NAME = '_user';

// Cache for users to avoid repeated fetching
let userCache: Map<number, User> | null = null;

const CHANNEL_MAP_SHEET_NAME = '_channels';

export async function getChannels(): Promise<Channel[]> {
    console.log("Fetching channels...");
    try {
        const doc = await getDoc();
        const sheets = doc.sheetsByIndex;

        // 1. Get the allowed channel names from _channels sheet
        let allowedSheetNames = new Set<string>();
        const mapSheet = doc.sheetsByTitle[CHANNEL_MAP_SHEET_NAME];

        if (mapSheet) {
            const rows = await mapSheet.getRows();
            // Assuming Structure: [Channel ID, Sheet Name]
            // We use the Sheet Name (col 2, index 1? No, google-spreadsheet rows object uses headers)
            // But wait, getRows uses headers. _channels header is ["channelId", "lastKnownName"]
            rows.forEach(row => {
                const name = row.get('lastKnownName');
                if (name) allowedSheetNames.add(name);
            });
        }

        const channels = sheets
            .filter(sheet => {
                const title = sheet.title.trim();
                const isIgnored =
                    title.startsWith('_') ||
                    title.startsWith('Template') ||
                    title === 'シート1' ||
                    title === 'Sheet1';

                if (isIgnored) return false;

                // If we have a whitelist, enforce it
                if (allowedSheetNames.size > 0) {
                    return allowedSheetNames.has(title);
                }

                return true;
            })
            .map(sheet => ({
                id: sheet.title, // ID is the Sheet Name for now
                name: sheet.title,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        console.log(`Returning ${channels.length} channels`);
        return channels;
    } catch (e) {
        console.error("Error in getChannels:", e);
        throw e;
    }
}

export async function getUsers(): Promise<Map<number, User>> {
    if (userCache) return userCache;

    console.log("Fetching users...");
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle[USER_SHEET_NAME];
        if (!sheet) {
            console.warn(`Sheet ${USER_SHEET_NAME} not found!`);
            return new Map();
        }

        const rows = await sheet.getRows();
        console.log(`User sheet loaded. Rows: ${rows.length}, Header: ${sheet.headerValues}`);
        const map = new Map<number, User>();

        rows.forEach((row, i) => {
            try {
                const index = parseInt(row.get('index'));
                if (!isNaN(index)) {
                    map.set(index, {
                        index,
                        userId: row.get('userId'),
                        name: row.get('name'),
                        email: row.get('email'),
                    });
                }
            } catch (err) {
                console.warn(`Failed to parse user row ${i}:`, err);
            }
        });

        console.log(`Parsed ${map.size} users`);
        userCache = map;
        return map;
    } catch (e) {
        console.error("Error in getUsers:", e);
        throw e;
    }
}

import { unstable_cache } from 'next/cache';

// Raw function that hits the API
async function getMessagesRaw(channelId: string): Promise<Message[]> {
    const doc = await getDoc();
    const sheet = doc.sheetsByTitle[channelId];
    if (!sheet) return [];

    const rows = await sheet.getRows();
    const users = await getUsers();
    const messages: Message[] = [];
    const messageMap = new Map<number, Message>();

    // First pass: Create message objects
    rows.forEach(row => {
        const index = parseInt(row.get('index'));
        const userIndex = parseInt(row.get('userIndex'));
        const type = row.get('type');
        const content = row.get('content') || '';
        const parentIndexStr = row.get('parentIndex');
        const parentIndex = parentIndexStr ? parseInt(parentIndexStr) : null;

        const msg: Message = {
            index,
            createdAt: row.get('createdAt'),
            userIndex,
            type: type as any,
            content: type === 'REACTION' ? content : replaceMentions(content, users),
            parentIndex,
            parentTs: (row.get('parentTs') || '').replace(/^'/, ''),
            slackTs: (row.get('slackTs') || '').replace(/^'/, ''),
            fileUrl: (row.get('fileUrl') || '').replace(/^'/, ''),
            files: (row.get('fileUrl') || '').split('\n').filter(Boolean).map((f: string) => {
                const parts = f.split('|');
                const url = parts[0];
                const name = parts.length > 1 ? parts.slice(1).join('|') : 'Attachment';
                return { url, name };
            }),
            user: users.get(userIndex),
            replies: [],
            reactions: [],
        };

        messageMap.set(index, msg);
    });

    const rootMessages: Message[] = [];

    // Second pass: Link everything using map values
    for (const msg of messageMap.values()) {
        if (msg.type === 'REACTION') {
            const parentIdx = msg.parentIndex;
            if (parentIdx !== null && messageMap.has(parentIdx)) {
                const parent = messageMap.get(parentIdx)!;
                const reactionName = msg.content;
                let reactionGroup = parent.reactions?.find(r => r.name === reactionName);
                if (!reactionGroup) {
                    reactionGroup = { name: reactionName, count: 0, users: [] };
                    parent.reactions?.push(reactionGroup);
                }
                reactionGroup.count++;
                if (msg.user) reactionGroup.users.push(msg.user.name);
            }
        } else if ((msg.type === 'REPLY' || msg.parentIndex) && msg.parentIndex !== null) {
            // It's a reply
            if (messageMap.has(msg.parentIndex)) {
                const parent = messageMap.get(msg.parentIndex)!;
                parent.replies?.push(msg);
            } else {
                rootMessages.push(msg);
            }
        } else {
            // Root message
            rootMessages.push(msg);
        }
    }

    // Sort by date ASC (Oldest first)
    rootMessages.forEach(msg => {
        msg.replies?.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });

    return rootMessages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// Cached version exported for use
export const getMessages = unstable_cache(
    async (channelId: string) => getMessagesRaw(channelId),
    ['messages-cache'],
    { revalidate: 5 } // Cache for 5 seconds
);

function replaceMentions(text: string, users: Map<number, User>): string {
    return text.replace(/<@(\d+)>/g, (match, indexStr) => {
        const index = parseInt(indexStr);
        const user = users.get(index);
        return user ? `@${user.name}` : match;
    });
}
