"use client";

import { useRouter } from 'next/navigation';
import { RotateCw } from 'lucide-react';
import { useState } from 'react';

export function RefreshButton() {
    const router = useRouter();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = () => {
        setIsRefreshing(true);
        router.refresh();
        setTimeout(() => setIsRefreshing(false), 1000);
    };

    return (
        <button
            onClick={handleRefresh}
            className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
            title="Refresh"
        >
            <RotateCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
    );
}
