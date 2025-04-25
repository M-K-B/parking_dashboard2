// LoginScreen.jsx
"use client";

import { supabase } from "./page.js";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;


export default function LoginScreen({ onLogin }) {
  const handleGoogleLogin = async () => {
    const redirectTo = process.env.NEXT_PUBLIC_SITE_URL;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (!error) onLogin();
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "400px", margin: "10vh auto", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h2>Admin Login</h2>
      <button onClick={handleGoogleLogin} style={{ width: "100%", padding: "0.75rem" }}>
        Login with Google
      </button>
    </div>
  );
}