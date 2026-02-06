"use client";

import { Message } from '@/lib/types';
import { MessageItem } from '@/components/MessageItem';
import { Search } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';

interface SearchResult extends Message {
    channelId: string;
    channelName: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function SearchPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialQuery = searchParams.get('q') || '';
    const [term, setTerm] = useState(initialQuery);
    const [query, setQuery] = useState(initialQuery);

    useEffect(() => {
        // Debounce update to URL and Query
        const handler = setTimeout(() => {
            if (term !== query) {
                setQuery(term);
                if (term) {
                    router.replace(`/search?q=${encodeURIComponent(term)}`);
                } else {
                    router.replace('/search');
                }
            }
        }, 500);
        return () => clearTimeout(handler);
    }, [term, router, query]);

    const { data: results, error, isLoading } = useSWR<SearchResult[]>(
        query ? `/api/search?q=${encodeURIComponent(query)}` : null,
        fetcher,
        {
            revalidateOnFocus: false, // Don't auto-revalidate search to save API calls
        }
    );

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 overflow-hidden">
            <header className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 sticky top-0 z-10">
                <h1 className="font-bold text-lg text-gray-900 dark:text-white mb-4">Global Search</h1>
                <div className="relative max-w-2xl">
                    <input
                        type="text"
                        placeholder="Search across all channels..."
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                        className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg pl-10 pr-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                        autoFocus
                    />
                    <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
                {!query && (
                    <div className="text-center text-gray-500 mt-20">
                        <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>Type to search across all archived messages</p>
                    </div>
                )}

                {isLoading && (
                    <div className="text-center text-gray-500 mt-20">
                        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p>Searching...</p>
                    </div>
                )}

                {results && results.length === 0 && query && (
                    <div className="text-center text-gray-500 mt-20">
                        <p>No results found for "{query}"</p>
                    </div>
                )}

                <div className="space-y-6 max-w-4xl mx-auto">
                    {results?.map((msg) => (
                        <div key={`${msg.channelId}-${msg.index}`} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-[#1a1d21]">
                            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-1 text-xs text-gray-500 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                <Link href={`/channels/${encodeURIComponent(msg.channelId)}?ts=${msg.slackTs}`} className="hover:underline font-bold text-blue-600 dark:text-blue-400">
                                    #{msg.channelName}
                                </Link>
                                <span>{msg.index}</span>
                            </div>
                            <MessageItem message={msg} />
                            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 text-right">
                                <Link href={`/channels/${encodeURIComponent(msg.channelId)}?thread_ts=${msg.slackTs}`} className="text-xs text-blue-500 hover:underline">
                                    Jump to conversation &rarr;
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
