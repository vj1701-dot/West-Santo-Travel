import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role?: "ADMIN" | "COORDINATOR" | "PASSENGER";
      isActive: boolean;
      firstName: string;
      lastName: string;
    };
  }

  interface User {
    id?: string;
    role?: "ADMIN" | "COORDINATOR" | "PASSENGER";
    isActive?: boolean;
    firstName?: string;
    lastName?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: "ADMIN" | "COORDINATOR" | "PASSENGER";
    isActive?: boolean;
    firstName?: string;
    lastName?: string;
  }
}
