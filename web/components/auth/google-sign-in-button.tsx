"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.9 2.2 2.8 6.3 2.8 11.4S6.9 20.6 12 20.6c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"
      />
      <path
        fill="#34A853"
        d="M3.9 7.5l3.2 2.4C8 7.5 9.8 6.2 12 6.2c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 8.4 2.2 5.3 4.3 3.9 7.5z"
      />
      <path
        fill="#4A90E2"
        d="M12 20.6c2.5 0 4.6-.8 6.1-2.2l-3-2.5c-.8.6-1.9 1-3.1 1-3.1 0-5.7-2.1-6.6-4.9l-3.2 2.5c1.5 3 4.6 5.1 9.8 5.1z"
      />
      <path
        fill="#FBBC05"
        d="M5.4 12.1c0-.7.1-1.3.3-1.9L2.5 7.7C1.9 9 1.6 10.4 1.6 12.1c0 1.7.4 3.2 1 4.6l3.2-2.5c-.2-.6-.4-1.3-.4-2.1z"
      />
    </svg>
  );
}

interface GoogleSignInButtonProps {
  label?: string;
}

export function GoogleSignInButton({
  label = "Continue with Google",
}: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const origin = window.location.origin;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={isLoading}
        onClick={handleGoogleSignIn}
      >
        <GoogleIcon />
        {isLoading ? "Redirecting..." : label}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
