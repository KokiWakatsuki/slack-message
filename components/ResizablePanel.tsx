"use client";

import { useState, useCallback, useEffect, useRef } from 'react';

interface ResizablePanelProps {
    children: React.ReactNode;
    defaultWidth: number;
    minWidth?: number;
    maxWidth?: number;
    side: 'left' | 'right';
    className?: string;
}

export function ResizablePanel({
    children,
    defaultWidth,
    minWidth = 50, // Smaller min width
    maxWidth = 2000, // Huge max width (effectively unlimited)
    side,
    className = ""
}: ResizablePanelProps) {
    const [width, setWidth] = useState(defaultWidth);
    const [isDragging, setIsDragging] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    const startResizing = useCallback(() => {
        setIsDragging(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsDragging(false);
    }, []);

    const resize = useCallback(
        (mouseMoveEvent: MouseEvent) => {
            if (isDragging) {
                let newWidth;
                if (side === 'left') {
                    newWidth = mouseMoveEvent.clientX - (sidebarRef.current?.getBoundingClientRect().left || 0);
                } else {
                    // right side resizing
                    newWidth = (window.innerWidth - mouseMoveEvent.clientX);
                }

                if (newWidth >= minWidth && newWidth <= maxWidth) {
                    setWidth(newWidth);
                }
            }
        },
        [isDragging, minWidth, maxWidth, side]
    );

    useEffect(() => {
        window.addEventListener("mousemove", resize);
        window.addEventListener("mouseup", stopResizing);
        return () => {
            window.removeEventListener("mousemove", resize);
            window.removeEventListener("mouseup", stopResizing);
        };
    }, [resize, stopResizing]);

    return (
        <div
            ref={sidebarRef}
            className={`relative flex flex-col shrink-0 ${className} ${isDragging ? 'select-none' : ''}`}
            style={{ width: width }}
        >
            {children}

            {/* Handle */}
            <div
                className={`absolute top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors z-50
                    ${side === 'left' ? '-right-[2px]' : '-left-[2px]'}
                    ${isDragging ? 'bg-blue-600' : 'bg-transparent'}
                `}
                onMouseDown={startResizing}
            />
        </div>
    );
}
