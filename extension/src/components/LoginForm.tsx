import { useState } from "react";
import { Button } from "@/components/ui";
import { WEB_URL } from "@/lib/supabase";

export function LoginForm({
  onSubmit,
  error,
  loading,
}: {
  onSubmit: (email: string, password: string) => Promise<boolean>;
  error: string | null;
  loading: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const looksLikeBadCreds = Boolean(
    error && /invalid login credentials/i.test(error)
  );

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void (async () => {
          setPending(true);
          await onSubmit(email.trim(), password);
          setPending(false);
        })();
      }}
    >
      <div>
        <h1 className="font-semibold text-slate-50">Sign in to TeamSync</h1>
        <p className="mt-1 text-xs text-slate-400">
          Email + password only (same as web). Google sign-in is not available in
          the extension yet.
        </p>
      </div>
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
      />
      <input
        type="password"
        required
        autoComplete="current-password"
        placeholder="Password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
      />
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
      {looksLikeBadCreds ? (
        <p className="text-[11px] leading-relaxed text-slate-400">
          Agar web pe aap{" "}
          <span className="text-slate-200">Google</span> se login karte ho, is
          account pe password set nahi hota. Pehle web pe{" "}
          <button
            type="button"
            className="text-blue-400 underline"
            onClick={() =>
              void chrome.tabs.create({ url: `${WEB_URL}/forgot-password` })
            }
          >
            Forgot password
          </button>{" "}
          se password set karo, phir yahan try karo.
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending || loading}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
