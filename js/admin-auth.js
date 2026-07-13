/* ==========================================
   ALBUKHR ADMIN AUTH ENGINE v3
   Supabase Powered
========================================== */

const ADMIN_TABLE = "admin_users";
const ADMIN_LOGS = "admin_activity_logs";

/* ==========================================
   LOGIN
========================================== */

async function adminLogin({

    username,
    role,
    accessKey

}){

    try{

        const { data: admin, error } = await supabaseClient

        .from(ADMIN_TABLE)

        .select("*")

        .eq("username", username)

        .eq("role", role)

        .eq("status", "active")

        .single();

        if(error || !admin){

            return {
                error:"Invalid administrator."
            };

        }

        /* Temporary access-key check.
           Za mu maye gurbinsa da hash verification daga baya. */

        if(admin.access_key !== accessKey){

            return{
                error:"Incorrect access key."
            };

        }

        /* Update last login */

        await supabaseClient

        .from(ADMIN_TABLE)

        .update({

            last_login:new Date().toISOString()

        })

        .eq("id",admin.id);

        /* Save session */

        sessionStorage.setItem(

            "albukhr_admin",

            JSON.stringify(admin)

        );

        await logAdminAction(

            admin,

            "login",

            "Administrator signed in."

        );

        return{

            success:true,

            admin

        };

    }catch(error){

        console.error(error);

        return{

            error:error.message

        };

    }

}

/* ==========================================
   GET CURRENT ADMIN
========================================== */
async function getCurrentAdmin(){

    try{

        const raw =

        sessionStorage.getItem(

            "albukhr_admin"

        );

        if(!raw){

            return null;

        }

        return JSON.parse(raw);

    }catch{

        return null;

    }

}

/* ==========================================
  ADMIN LONGOUT 
========================================== */
async function adminLogout(){

    const admin =

    await getCurrentAdmin();

    if(admin){

        await logAdminAction(

            admin,

            "logout",

            "Administrator signed out."

        );

    }

    sessionStorage.removeItem(

        "albukhr_admin"

    );

    location.replace(

        "admin-login.html"

    );

           }

/* ==========================================
   REQUIRE ADMIN
========================================== */
async function requireAdmin(){

    const admin =

    await getCurrentAdmin();

    if(!admin){

        location.replace(

            "admin-login.html"

        );

        return false;

    }

    return true;

}

/* ==========================================
   REQUIRE ROLE
========================================== */
async function requireRole(...roles){

    const admin =

    await getCurrentAdmin();

    if(!admin){

        location.replace(

            "admin-login.html"

        );

        return false;

    }

    if(!roles.includes(admin.role)){

        alert("Access denied.");

        location.replace(

            "unified-admin-buttons.html"

        );

        return false;

    }

    return true;

           }

/* ==========================================
   LOG ADMIN ACTION
========================================== */
async function logAdminAction(

    admin,

    action,

    details=""

){

    await supabaseClient

    .from(ADMIN_LOGS)

    .insert({

        admin_id:admin.id,

        username:admin.username,

        role:admin.role,

        action,

        details,

        created_at:new Date().toISOString()

    });

}
