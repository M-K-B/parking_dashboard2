"use client";
import { supabase } from "./page.js";



export default function LoginScreen({ onLogin }) {
  const handleGoogleLogin = async () => {
    const siteUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL; // fallback for safety

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: siteUrl,
      },
    });

    
  };
//code
  return (
    <div style={{ padding: "2rem", maxWidth: "400px", margin: "10vh auto", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h2>Admin Login</h2>
      <button onClick={handleGoogleLogin} style={{ width: "100%", padding: "0.75rem" }}>
        Login with Google
      </button>
    </div>
  );
}
