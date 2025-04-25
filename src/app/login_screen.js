"use client";
import { supabase } from "./lib/db.js";

export default function LoginScreen({ onLogin }) {
  const handleGoogleLogin = async () => {
    const redirectTo =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (!error && typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  return (
    <div className="login-wrapper">
      <h2>Admin Login</h2>
      <button onClick={handleGoogleLogin}>Login with Google</button>
    </div>
  );
}
