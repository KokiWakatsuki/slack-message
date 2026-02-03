
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
        <div className="flex h-full">
            <Sidebar channels={channels} />
            <main className="flex-1 ml-64 overflow-y-auto h-full">
                {children}
            </main>
        </div>
    );
}
