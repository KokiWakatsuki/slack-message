"use client";

import { Message } from '@/lib/types';
import { MessageItem } from './MessageItem';
import { useRef, useEffect, useState } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import useSWR from 'swr';
import { useParams, useSearchParams } from 'next/navigation';

interface MessageListProps {
    initialMessages: Message[];
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function MessageList({ initialMessages }: MessageListProps) {
    const params = useParams();
    // decodeURIComponent is needed because params from next/navigation might be encoded
    const channelId = params?.id ? decodeURIComponent(Array.isArray(params.id) ? params.id[0] : params.id) : null;

    // Background polling every 5 seconds
    const { data: messages, mutate } = useSWR<Message[]>(
        channelId ? `/api/channels/${encodeURIComponent(channelId)}/messages` : null,
        fetcher,
        {
            fallbackData: initialMessages,
            refreshInterval: 5000, // Poll every 5 seconds
            revalidateOnFocus: true
        }
    );

    // Filter messages by search query
    const searchParams = useSearchParams();
    const query = searchParams.get('q')?.toLowerCase() || '';

    const displayMessages = messages?.filter(m =>
        !query ||
        m.content.toLowerCase().includes(query) ||
        m.user?.name.toLowerCase().includes(query) ||
        m.files?.some(f => f.name.toLowerCase().includes(query))
    ) || [];

    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const prevCountRef = useRef(displayMessages.length || 0);

    // Auto-scroll logic only if user was already at bottom or it's initial load
    useEffect(() => {
        if (!displayMessages) return;

        // If new messages arrived
        if (displayMessages.length > prevCountRef.current) {
            if (isAtBottom) {
                // Use setTimeout to ensure virtuoso has re-calculated sizes
                setTimeout(() => {
                    virtuosoRef.current?.scrollToIndex({
                        index: displayMessages.length - 1,
                        align: 'end',
                        behavior: 'smooth'
                    });
                }, 100);
            }
            prevCountRef.current = displayMessages.length;
        }
    }, [displayMessages, isAtBottom]);

    return (
        <div className="h-[calc(100vh-160px)] w-full">
            {/* Height needs to be fixed for Virtuoso.
                 160px is an approximation of header + padding, needs adjustment based on actual layout */}

            <Virtuoso
                ref={virtuosoRef}
                data={displayMessages}
                totalCount={displayMessages.length}
                atBottomStateChange={(bottom) => setIsAtBottom(bottom)}
                initialTopMostItemIndex={displayMessages.length - 1} // Start at bottom
                itemContent={(index, message) => (
                    <MessageItem message={message} />
                )}
                className="no-scrollbar"
                followOutput={isAtBottom ? 'smooth' : false}
            />
        </div>
    );
}
