import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { validateUser } from "@/lib/auth-utils";

const handler = NextAuth({
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                try {
                    const user = await validateUser(credentials.email, credentials.password);
                    if (user) {
                        return {
                            id: user.userId,
                            name: user.name,
                            email: user.email
                        };
                    }
                } catch (e) {
                    console.error("Auth error details:", e);
                    if (e instanceof Error) {
                        console.error("Auth error message:", e.message);
                        console.error("Auth error stack:", e.stack);
                    }
                }
                return null;
            }
        })
    ],
    pages: {
        signIn: '/login',
    },
    callbacks: {
        async session({ session, token }) {
            return session;
        },
    },
    session: {
        strategy: "jwt",
    },
    secret: process.env.NEXTAUTH_SECRET || 'secret-key-fallback-for-dev' // Ideally add to .env.local
});

export { handler as GET, handler as POST };
