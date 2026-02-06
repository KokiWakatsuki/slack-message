import { NextResponse } from 'next/server';
import { getChannels } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const channels = await getChannels();
        return NextResponse.json(channels);
    } catch (error) {
        console.error('Failed to fetch channels:', error);
        return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 });
    }
}
