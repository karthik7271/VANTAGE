import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize(credentials) {
        if (
          credentials?.email === "demo@vantage.ai" &&
          credentials?.password === "demo1234"
        ) {
          return {
            id: "1",
            email: "demo@vantage.ai",
            name: "Alex Rivera",
          };
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
});
