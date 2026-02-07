import { getChannels, getMessages } from '@/lib/data';
import { NextRequest, NextResponse } from 'next/server';
import { Message } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q')?.toLowerCase();

    if (!query) return NextResponse.json([]);

    try {
        const channels = await getChannels();

        // Helper to chunk array
        const chunk = <T>(arr: T[], size: number): T[][] =>
            Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
                arr.slice(i * size, i * size + size)
            );

        const chunks = chunk(channels, 5); // Process 5 channels at a time to avoid rate limits

        type SearchMessage = Message & { channelId: string, channelName: string };
        let allChannelMessages: SearchMessage[] = [];

        for (const batch of chunks) {
            const batchResults = await Promise.all(
                batch.map(async (c) => {
                    try {
                        const msgs = await getMessages(c.id);
                        return msgs.map(m => ({
                            ...m,
                            channelId: c.id,
                            channelName: c.name
                        }));
                    } catch (err) {
                        console.error(`Failed to fetch messages for channel ${c.name} (${c.id}):`, err);
                        return [];
                    }
                })
            );
            allChannelMessages = allChannelMessages.concat(batchResults.flat());
        }

        const filtered = allChannelMessages.filter(m =>
            m.content.toLowerCase().includes(query) ||
            (m.user && m.user.name.toLowerCase().includes(query)) ||
            (m.files && m.files.some(f => f.name.toLowerCase().includes(query)))
        );

        // Sort by date DESC
        filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        return NextResponse.json(filtered.slice(0, 100)); // Limit to 100 results for performance
    } catch (e) {
        console.error("Search API Error:", e);
        // Client expects an array, so return empty array on error to prevent "map is not a function"
        return NextResponse.json([]);
    }
}
