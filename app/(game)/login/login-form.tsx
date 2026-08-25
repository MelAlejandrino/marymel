"use client";

import { useActionState } from "react";

import { login, type LoginState } from "@/lib/auth/actions";

// text-base, not smaller: iOS zooms the page in on any input under 16px.
const field =
  "w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-base " +
  "outline-none focus-visible:ring-2 focus-visible:ring-rose-400";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm opacity-70">Email</span>
        <input
          className={field}
          type="email"
          name="email"
          autoComplete="email"
          required
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm opacity-70">Password</span>
        <input
          className={field}
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-rose-300">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-rose-500 px-4 py-2 font-medium text-white transition
                   hover:bg-rose-600 disabled:opacity-60"
      >
        {pending ? "Opening..." : "Enter"}
      </button>
    </form>
  );
}
