"use client";

import { RefreshButton } from './RefreshButton';
import { Search } from 'lucide-react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export function ChannelHeader({ title }: { title: string }) {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { replace } = useRouter();
    const [term, setTerm] = useState(searchParams.get('q') || '');

    // Debounce updating the URL
    useEffect(() => {
        const handler = setTimeout(() => {
            const params = new URLSearchParams(searchParams);
            if (term) {
                params.set('q', term);
            } else {
                params.delete('q');
            }
            // Only replace if query actually changed to avoid redundant calls
            if (params.get('q') !== searchParams.get('q')) {
                replace(`${pathname}?${params.toString()}`);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(handler);
    }, [term, pathname, replace, searchParams]);

    return (
        <header className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 sticky top-0 z-10 flex items-center justify-between gap-4">
            <h1 className="font-bold text-lg text-gray-900 dark:text-white truncate min-w-0">#{title}</h1>

            <div className="flex items-center gap-2 flex-1 justify-end max-w-md">
                <div className="relative w-full max-w-xs hidden md:block">
                    <input
                        type="text"
                        placeholder="Search in channel..."
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                        className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded pl-8 pr-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 border border-transparent focus:border-blue-500 transition-colors"
                    />
                    <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
                </div>
                <RefreshButton />
            </div>
        </header>
    );
}
