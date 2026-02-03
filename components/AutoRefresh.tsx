"use client";

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function AutoRefresh() {
    const router = useRouter();

    useEffect(() => {
        // Poll every 10 seconds
        const interval = setInterval(() => {
            router.refresh();
        }, 10000);

        return () => clearInterval(interval);
    }, [router]);

    return null;
}
