"use client";

import { usePathname } from "next/navigation";
import { ResizablePanel } from "@/components/ResizablePanel";

interface MainLayoutClientProps {
    sidebar: React.ReactNode;
    children: React.ReactNode;
}

export function MainLayoutClient({ sidebar, children }: MainLayoutClientProps) {
    const pathname = usePathname();
    const isRoot = pathname === "/";

    return (
        <div className="flex h-full w-full overflow-hidden">
            {/* Sidebar: Show if desktop OR (mobile and at root) */}
            <div className={`${isRoot ? 'block' : 'hidden'} md:block h-full flex-shrink-0 w-full md:w-auto overflow-hidden`}>
                {/* Mobile: Full width, no resize */}
                <div className="md:hidden w-full h-full">
                    {sidebar}
                </div>
                {/* Desktop: Resizable */}
                <div className="hidden md:block h-full">
                    <ResizablePanel defaultWidth={260} side="left" minWidth={50} maxWidth={2000} className="bg-[#3F0E40] dark:bg-[#1a061a] h-full">
                        {sidebar}
                    </ResizablePanel>
                </div>
            </div>

            {/* Main Content: Show if desktop OR (mobile and NOT at root) */}
            <div className={`${!isRoot ? 'block' : 'hidden'} md:block flex-1 overflow-y-auto h-full min-w-0`}>
                {children}
            </div>
        </div>
    );
}
