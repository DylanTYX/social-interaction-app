"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/password-input";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    setIsSubmitting(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";
      router.replace(redirectTo);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to sign in right now. Please try again.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    if (!email.trim()) {
      setErrorMessage("Enter your email first, then click forgot password.");
      return;
    }
    setIsSendingReset(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/login`
          : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo },
      );
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      setInfoMessage(
        "If an account exists for that email, a reset link is on its way.",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to send reset email right now.";
      setErrorMessage(message);
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">
        Sign in
      </h1>
      <p className="mt-2 text-base text-slate-600">
        Pick up where you left off.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button
              type="button"
              onClick={() => void handleForgotPassword()}
              disabled={isSendingReset}
              className="text-sm font-medium text-primary underline-offset-4 transition-colors duration-150 hover:underline disabled:opacity-50"
            >
              {isSendingReset ? "Sending…" : "Forgot password?"}
            </button>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            inputClassName="h-11 pr-10"
          />
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-lg border border-destructive-border bg-destructive-subtle px-3 py-2 text-sm text-destructive-emphasis"
          >
            {errorMessage}
          </div>
        )}
        {infoMessage && (
          <div
            role="status"
            className="rounded-lg border border-success-border bg-success-subtle px-3 py-2 text-sm text-success-emphasis"
          >
            {infoMessage}
          </div>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-11 w-full text-[15px]"
          size="lg"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {/* "Create account", the same words as the button on the landing
          page's header and the button on the page this links to. */}
      <p className="mt-8 text-center text-sm text-slate-600">
        Don&apos;t have an account?{" "}
        <Link
          href="/auth/register"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Create account
        </Link>
      </p>
    </div>
  );
}
