"use client";

import Link from 'next/link';
import { Channel } from '@/lib/types';
import { Hash, Search } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

interface SidebarProps {
    channels: Channel[];
}

export function Sidebar({ channels: initialChannels }: SidebarProps) {
    const params = useParams();
    const currentId = params?.id ? decodeURIComponent(params.id as string) : null;
    const [channels, setChannels] = useState<Channel[]>(initialChannels);
    const [searchQuery, setSearchQuery] = useState("");
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Auto-refresh channels every 10 seconds
    useEffect(() => {
        const fetchChannels = async () => {
            try {
                const res = await fetch('/api/channels');
                if (res.ok) {
                    const data = await res.json();
                    setChannels(data);
                }
            } catch (error) {
                console.error('Auto-refresh failed:', error);
            }
        };

        // Initial fetch to make sure we are up to date
        fetchChannels();

        const interval = setInterval(fetchChannels, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        try {
            const res = await fetch('/api/channels');
            if (res.ok) {
                const data = await res.json();
                setChannels(data);
            }
        } catch (error) {
            console.error('Manual refresh failed:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const filteredChannels = channels.filter(channel =>
        channel.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="w-full h-full bg-[#3F0E40] dark:bg-[#1a061a] text-white flex flex-col overflow-y-auto border-r border-transparent dark:border-gray-800">
            <div className="p-4 border-b border-[#5d2c5d] dark:border-[#350d36]">
                <div className="mb-4 flex items-center justify-between">
                    <h1 className="font-bold text-xl">Slack Archive</h1>
                    <div className="flex gap-1">
                        <button
                            onClick={handleManualRefresh}
                            className={`p-2 hover:bg-[#350d36] rounded-full transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
                            title="Refresh Channels"
                        >
                            <svg className="w-5 h-5 text-[#cfc3cf]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                        <Link href="/search" className="p-2 hover:bg-[#350d36] rounded-full transition-colors" title="Global Search">
                            <Search className="w-5 h-5 text-[#cfc3cf]" />
                        </Link>
                    </div>
                </div>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search channels..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#5d2c5d] dark:bg-[#350d36] text-white placeholder-gray-400 rounded px-3 py-1 pl-8 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 border border-transparent focus:border-gray-400 transition-colors"
                    />
                    <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
            </div>
            <div className="flex-1 py-4">
                <div className="px-4 mb-2 flex justify-between items-center">
                    <h2 className="text-[#cfc3cf] dark:text-gray-400 text-sm font-medium">Channels ({channels.length})</h2>
                </div>
                <ul>
                    {filteredChannels.length === 0 ? (
                        <li className="px-4 py-2 text-sm text-gray-400">No channels found</li>
                    ) : (
                        filteredChannels.map((channel) => {
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
                                        <Hash className="w-4 h-4 mr-2 opacity-70 flex-shrink-0" />
                                        <span className="truncate">{channel.name}</span>
                                    </Link>
                                </li>
                            );
                        })
                    )}
                </ul>
            </div>
        </div>
    );
}
