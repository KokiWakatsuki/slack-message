export interface Channel {
    id: string;
    name: string;
}

export interface User {
    index: number;
    userId: string;
    name: string;
    email?: string;
}

export interface Message {
    index: number;
    createdAt: string; // yyyyMMddHHmmss
    userIndex: number;
    type: 'MESSAGE' | 'REPLY' | 'REACTION' | 'FILE' | 'EDITED' | 'THREAD_START';
    content: string;
    parentIndex: number | null;
    parentTs: string;
    slackTs: string;
    fileUrl: string;
    replies?: Message[]; // Enriched field
    reactions?: { name: string; count: number; users: string[] }[]; // Enriched field
    user?: User;         // Enriched field
}
