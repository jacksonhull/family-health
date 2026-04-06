import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/src/lib/db";
import { verifyPassword } from "@/src/lib/password";
import type { Role } from "@prisma/client";

// Extend NextAuth types to include role
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email: string;
      role: Role;
    };
  }
  interface User {
    role: Role;
  }
}


export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        if (user.status === "DISABLED") return null;

        return {
          id: user.id,
          email: user.email!,
          name: user.name ?? user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.name = user.name;
        token.email = user.email;
        (token as unknown as { role: Role }).role = user.role;
      }
      if (trigger === "update" && session?.user?.name !== undefined) {
        token.name = session.user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.name = token.name;
        session.user.email = token.email!;
        session.user.role = (token as unknown as { role: Role }).role;
      }
      return session;
    },
  },
});
