import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/dal";

import LoginForm from "./login-form";

export const metadata = { title: "Come in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <main className="absolute inset-0 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-medium tracking-tight">Hi, you.</h1>
        <p className="mt-1 mb-6 text-sm opacity-60">
          Sign in to open the door.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
