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

document.body.insertAdjacentHTML(
  "beforeend",
  `<pre>${JSON.stringify(Object.keys(window.supabase || {}), null, 2)}</pre>`
);
