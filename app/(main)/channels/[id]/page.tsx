import { MessageList } from '@/components/MessageList';
import { getMessages } from '@/lib/data';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ thread_ts?: string }>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
    const { id } = await params;
    const decodedId = decodeURIComponent(id);
    return {
        title: `#${decodedId} | Slack Archive`,
    };
}

import { RefreshButton } from '@/components/RefreshButton';
import { ThreadSidebar } from '@/components/ThreadSidebar';

export default async function ChannelPage({ params, searchParams }: PageProps) {
    const { id } = await params;
    const { thread_ts } = await searchParams;
    const decodedId = decodeURIComponent(id);

    let messages = [];
    try {
        messages = await getMessages(decodedId);
    } catch (e) {
        console.error("Failed to load messages:", e);
        return (
            <div className="p-8 text-red-500">
                Failed to load messages. Please check your connection and credentials.
            </div>
        );
    }

    let rootMessage = null;
    if (thread_ts) {
        rootMessage = messages.find(m => m.slackTs === thread_ts);
    }

    return (
        <div className="flex h-full">
            <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-900">
                <header className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 sticky top-0 z-10 flex items-center justify-between">
                    <h1 className="font-bold text-lg text-gray-900 dark:text-white">#{decodedId}</h1>
                    <RefreshButton />
                </header>
                <div className="flex-1 overflow-y-auto">
                    <MessageList messages={messages} />
                </div>
            </div>

            {rootMessage && (
                <ThreadSidebar rootMessage={rootMessage} channelId={decodedId} />
            )}
        </div>
    );
}
