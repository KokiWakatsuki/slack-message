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

import { ChannelHeader } from '@/components/ChannelHeader';
import { ThreadSidebar } from '@/components/ThreadSidebar';
// import { ResizablePanel } from '@/components/ResizablePanel'; // Moved to ChannelLayoutClient
import { ChannelLayoutClient } from '@/components/ChannelLayoutClient';

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
        <ChannelLayoutClient
            header={<ChannelHeader title={decodedId} />}
            messageList={<MessageList initialMessages={messages} />}
            threadSidebar={rootMessage ? <ThreadSidebar rootMessage={rootMessage} channelId={decodedId} /> : null}
            hasThread={!!rootMessage}
        />
    );
}
