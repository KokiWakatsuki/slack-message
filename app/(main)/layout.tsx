import { Sidebar } from "@/components/Sidebar";
import { MainLayoutClient } from "@/components/MainLayoutClient";
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
        <MainLayoutClient
            sidebar={<Sidebar channels={channels} />}
        >
            {children}
        </MainLayoutClient>
    );
}
