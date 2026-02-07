"use client";

import { useSearchParams } from "next/navigation";
import { ResizablePanel } from "@/components/ResizablePanel";

interface ChannelLayoutClientProps {
    header: React.ReactNode;
    messageList: React.ReactNode;
    threadSidebar: React.ReactNode;
    hasThread: boolean;
}

export function ChannelLayoutClient({ header, messageList, threadSidebar, hasThread }: ChannelLayoutClientProps) {
    const searchParams = useSearchParams();
    // Check if thread_ts is present in URL to determine if we are in thread view
    // Note: We also pass hasThread prop from server as a backup/optimization, 
    // but client-side check is crucial for instant navigation updates
    const isThreadOpen = hasThread || !!searchParams.get('thread_ts');

    return (
        <div className="flex h-full w-full overflow-hidden">
            {/* Message List Area: Show if desktop OR (mobile and thread is NOT open) */}
            <div className={`${isThreadOpen ? 'hidden' : 'flex'} md:flex flex-1 flex-col min-w-0 bg-white dark:bg-gray-900 h-full`}>
                {header}
                <div className="flex-1 min-h-0">
                    {messageList}
                </div>
            </div>

            {/* Thread Sidebar Area: Show if thread is open. 
                On mobile: takes full width (hidden message list). 
                On desktop: appears as side panel. 
            */}
            {isThreadOpen && (
                <div className="md:block w-full md:w-auto h-full absolute md:relative z-20 md:z-auto inset-0 md:inset-auto">
                    <ResizablePanel defaultWidth={400} side="right" minWidth={100} maxWidth={2000} className="w-full md:w-auto h-full border-l border-gray-200 dark:border-gray-700">
                        {threadSidebar}
                    </ResizablePanel>
                </div>
            )}
        </div>
    );
}
