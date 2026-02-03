"use client";

import { Message } from '@/lib/types';
import { MessageItem } from './MessageItem';
import { useEffect, useRef } from 'react';

interface MessageListProps {
    messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
    const bottomRef = useRef<HTMLDivElement>(null);
    const prevCountRef = useRef(0);

    useEffect(() => {
        // Only scroll if message count increased (new message arrived or initial load)
        // This prevents scrolling when just passing props with same data (e.g. url param change)
        if (messages.length > prevCountRef.current) {
            bottomRef.current?.scrollIntoView({ behavior: 'auto' });
            prevCountRef.current = messages.length;
        } else if (prevCountRef.current === 0 && messages.length > 0) {
            // Handle initial load case if length matches but ref was 0
            bottomRef.current?.scrollIntoView({ behavior: 'auto' });
            prevCountRef.current = messages.length;
        }
    }, [messages]);

    return (
        <div className="flex flex-col pb-10">
            {messages.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No messages found.</div>
            ) : (
                messages.map((msg) => (
                    <MessageItem key={msg.index} message={msg} />
                ))
            )}
            <div ref={bottomRef} />
        </div>
    );
}
