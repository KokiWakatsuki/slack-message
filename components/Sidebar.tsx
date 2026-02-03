"use client";

import Link from 'next/link';
import { Channel } from '@/lib/types';
import { Hash } from 'lucide-react';
import { useParams } from 'next/navigation';

interface SidebarProps {
    channels: Channel[];
}

export function Sidebar({ channels }: SidebarProps) {
    const params = useParams();
    const currentId = params?.id ? decodeURIComponent(params.id as string) : null;

    return (
        <div className="w-full h-full bg-[#3F0E40] dark:bg-[#1a061a] text-white flex flex-col overflow-y-auto border-r border-transparent dark:border-gray-800">
            <div className="p-4 border-b border-[#5d2c5d] dark:border-[#350d36]">
                <h1 className="font-bold text-xl">Slack Archive</h1>
            </div>
            <div className="flex-1 py-4">
                <div className="px-4 mb-2">
                    <h2 className="text-[#cfc3cf] dark:text-gray-400 text-sm font-medium">Channels</h2>
                </div>
                <ul>
                    {channels.map((channel) => {
                        const isActive = currentId === channel.id;
                        return (
                            <li key={channel.id}>
                                <Link
                                    href={`/channels/${encodeURIComponent(channel.id)}`}
                                    className={`flex items-center px-4 py-1 hover:bg-[#350d36] dark:hover:bg-[#350d36] hover:text-white ${isActive
                                        ? 'bg-[#1164A3] text-white'
                                        : 'text-[#cfc3cf] dark:text-gray-300'
                                        }`}
                                >
                                    <Hash className="w-4 h-4 mr-2 opacity-70" />
                                    <span className="truncate">{channel.name}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
