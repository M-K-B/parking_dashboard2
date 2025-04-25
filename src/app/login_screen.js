"use client";
import { supabase } from "./lib/db.js";

// Removed the onLogin prop as it wasn't used internally
export default function LoginScreen() {
  const handleGoogleLogin = async () => {
    const redirectTo =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) {
        console.error("Google login error:", error); // Add logging for errors
    }
    // Removed window.location.href = "/" here.
    // The onAuthStateChange listener in AdminMap should handle the state update after redirect.
  };

  return (
    <div className="login-wrapper">
      <h2>Admin Login</h2>
      <button onClick={handleGoogleLogin}>Login with Google</button>
    </div>
  );
}