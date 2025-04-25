import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
);


async function handleNewUser(user) {
    const { error } = await supabase.from('users').insert([
      { id: user.id, role: 'admin' } // or 'user' based on your logic
    ]);
  
    if (error) {
      console.error('Error inserting user role:', error);
    }
  }