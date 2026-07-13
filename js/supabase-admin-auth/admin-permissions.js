/* ==========================================
   ALBUKHR ADMIN PERMISSIONS ENGINE
   Version 3.0
========================================== */

(function(window){

"use strict";

const TABLE = "admin_roles";

/* ==========================================
   GET CLIENT
========================================== */

function getClient(){

    if(window.supabaseClient){
        return window.supabaseClient;
    }

    throw new Error(
        "Supabase client not initialized."
    );

}

/* ==========================================
   GET ROLE
========================================== */

async function getRolePermissions(roleCode){

    if(!roleCode){

        return null;

    }

    try{

        const supabase = getClient();

        const {

            data,
            error

        } = await supabase

        .from(TABLE)

        .select("*")

        .eq("role_code",roleCode)

        .single();

        if(error){

            console.error(error);

            return null;

        }

        return data;

    }catch(error){

        console.error(error);

        return null;

    }

}

/* ==========================================
   HAS ROLE
========================================== */

async function hasRole(roleCode){

    const admin =

    await getCurrentAdmin();

    if(!admin){

        return false;

    }

    return admin.role_code === roleCode;

}

/* ==========================================
   HAS ANY ROLE
========================================== */

async function hasAnyRole(roles=[]){

    const admin =

    await getCurrentAdmin();

    if(!admin){

        return false;

    }

    return roles.includes(

        admin.role_code

    );

}

/* ==========================================
   HAS PERMISSION
========================================== */

async function hasPermission(permission){

    const admin =

    await getCurrentAdmin();

    if(!admin){

        return false;

    }

    const role =

    await getRolePermissions(

        admin.role_code

    );

    if(!role){

        return false;

    }

    const permissions =

    Array.isArray(role.permissions)

    ? role.permissions

    : [];

    return permissions.includes(permission);

}

/* ==========================================
   FINANCE
========================================== */

async function canManageFinance(){

    return await hasPermission(

        "finance.manage"

    );

}

/* ==========================================
   PROJECTS
========================================== */

async function canManageProjects(){

    return await hasPermission(

        "projects.manage"

    );

}

/* ==========================================
   USERS
========================================== */

async function canManageUsers(){

    return await hasPermission(

        "users.manage"

    );

}

/* ==========================================
   APPROVALS
========================================== */

async function canApprove(){

    return await hasPermission(

        "approvals.manage"

    );

}

/* ==========================================
   SETTINGS
========================================== */

async function canManageSettings(){

    return await hasPermission(

        "settings.manage"

    );

}

/* ==========================================
   EXPORT
========================================== */

window.getRolePermissions =

getRolePermissions;

window.hasRole =

hasRole;

window.hasAnyRole =

hasAnyRole;

window.hasPermission =

hasPermission;

window.canManageFinance =

canManageFinance;

window.canManageProjects =

canManageProjects;

window.canManageUsers =

canManageUsers;

window.canApprove =

canApprove;

window.canManageSettings =

canManageSettings;

})(window);
