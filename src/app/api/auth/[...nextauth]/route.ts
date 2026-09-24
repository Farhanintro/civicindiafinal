// NextAuth.js catch-all route — /api/auth/signin, /api/auth/signout, /api/auth/session,
// /api/auth/csrf, /api/auth/callback/credentials, ...
// Client sign-in/sign-out goes through next-auth/react helpers.
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
