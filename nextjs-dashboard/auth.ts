import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { z } from "zod";
import { Pool } from "@neondatabase/serverless";
import bcrypt from "bcrypt";
import type { User } from "@/app/lib/definitions";

// 初始化 Neon 資源池
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 用於從數據庫獲取用戶的函數
async function getUser(email: string): Promise<User | null> {
  try {
    const result = await pool.query(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );
    return result.rows[0] as User | null;
  } catch (error) {
    console.error("Failed to fetch user:", error);
    throw new Error("Failed to fetch user.");
  }
}

// 配置 NextAuth
export const { auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        // 校驗輸入的憑據是否有效
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);

        if (!parsedCredentials.success) {
          console.log("Invalid credentials format.");
          return null;
        }

        const { email, password } = parsedCredentials.data;

        // 查詢用戶
        const user = await getUser(email);

        if (!user) {
          console.log(`User not found for email: ${email}`);
          return null;
        }

        // 驗證密碼
        const passwordsMatch = await bcrypt.compare(password, user.password);

        if (passwordsMatch) {
          console.log(`User authenticated: ${email}`);
          return {
            id: user.id,
            name: user.name,
            email: user.email,
          };
        }

        console.log("Invalid credentials");
        return null;
      },
    }),
  ],
});
