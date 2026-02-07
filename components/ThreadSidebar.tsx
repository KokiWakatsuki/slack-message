"use client";

import { Message } from '@/lib/types';
import { MessageItem } from './MessageItem';
import { X, ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ThreadSidebarProps {
    rootMessage: Message;
    channelId: string;
}

export function ThreadSidebar({ rootMessage, channelId }: ThreadSidebarProps) {
    const router = useRouter();

    const closeThread = () => {
        // Navigate to the current channel path without query params
        router.push(`/channels/${encodeURIComponent(channelId)}`);
    };

    return (
        <div className="w-full flex flex-col border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 h-full shadow-xl z-20">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex flex-col">
                    <h3 className="font-bold text-gray-900 dark:text-gray-100">Thread</h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">#{channelId}</span>
                </div>
                <button
                    onClick={closeThread}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
                >
                    <X className="w-5 h-5 hidden md:block" />
                    <div className="md:hidden flex items-center gap-1">
                        <ChevronLeft className="w-5 h-5" />
                        <span className="text-sm font-medium">Back</span>
                    </div>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {/* Root Message */}
                <div className="mb-4">
                    <MessageItem message={rootMessage} isThreadView={true} />
                </div>

                <div className="flex items-center gap-4 mb-4">
                    <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
                    <span className="text-sm text-gray-400 text-xs text-gray-500 dark:text-gray-400">
                        {rootMessage.replies?.length || 0} replies
                    </span>
                    <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
                </div>

                {/* Replies */}
                <div className="space-y-1">
                    {rootMessage.replies?.map(reply => (
                        <MessageItem key={reply.index} message={reply} isThreadView={true} />
                    ))}
                </div>
            </div>
        </div>
    );
}
