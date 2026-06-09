const SUPABASE_URL =
"https://qexmnghilahsvethlxem.supabase.co";

const SUPABASE_KEY =
"sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2";

const supabaseClient =
window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

window.supabaseClient = supabaseClient;
