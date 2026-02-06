import { getMessages } from '@/lib/data';
import { NextResponse } from 'next/server';

interface Context {
    params: Promise<{
        channelId: string;
    }>;
}

export async function GET(request: Request, { params }: Context) {
    try {
        const { channelId } = await params;
        const messages = await getMessages(decodeURIComponent(channelId));
        return NextResponse.json(messages);
    } catch (e) {
        console.error('API Error:', e);
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }
}
