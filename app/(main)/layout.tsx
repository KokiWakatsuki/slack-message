import { ResizablePanel } from "@/components/ResizablePanel";
import { Sidebar } from "@/components/Sidebar";
import { getChannels } from "@/lib/data";
import { Channel } from "@/lib/types";

export default async function MainLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    let channels: Channel[] = [];
    try {
        channels = await getChannels();
    } catch (e) {
        console.error("Failed to load channels:", e);
    }

    return (
        <div className="flex h-full w-full overflow-hidden">
            <ResizablePanel defaultWidth={260} side="left" minWidth={50} maxWidth={2000} className="bg-[#3F0E40] dark:bg-[#1a061a]">
                <Sidebar channels={channels} />
            </ResizablePanel>

            <main className="flex-1 overflow-y-auto h-full min-w-0">
                {children}
            </main>
        </div>
    );
}
