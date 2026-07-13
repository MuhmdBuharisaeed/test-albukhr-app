/* ==========================================
   ALBUKHR ADMIN PERMISSIONS ENGINE
   Version 3.1
========================================== */

(function(window){

"use strict";

const TABLE = "admin_permissions";

/* ==========================================
   GET CLIENT
========================================== */

function getClient(){

    if(typeof window.getAlbukhrSupabaseClient === "function"){

        const client =
        window.getAlbukhrSupabaseClient();

        if(client){
            return client;
        }

    }

    throw new Error(
        "ALBUKHR Supabase Core not initialized."
    );

}

/* ==========================================
   GET ROLE PERMISSIONS
========================================== */

async function getRolePermissions(roleCode){

    if(!roleCode){
        return [];
    }

    try{

        const supabase = getClient();

        const { data, error } = await supabase
        .from(TABLE)
        .select("permission")
        .eq("role_code", roleCode);

        if(error){
            console.error(error);
            return [];
        }

        return data || [];

    }catch(error){

        console.error(error);

        return [];

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

async function hasAnyRole(roles = []){

    const admin =
    await getCurrentAdmin();

    if(!admin){
        return false;
    }

    return roles.includes(admin.role_code);

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

    const permissions =
    await getRolePermissions(admin.role_code);

    if(!permissions.length){
        return false;
    }

    const list =
    permissions.map(item => item.permission);

    /* Super Admin */

    if(list.includes("*")){
        return true;
    }

    return list.includes(permission);

}

/* ==========================================
   COMMON HELPERS
========================================== */

async function canManageFinance(){
    return hasPermission("finance.manage");
}

async function canManageProjects(){
    return hasPermission("projects.manage");
}

async function canManageUsers(){
    return hasPermission("users.manage");
}

async function canApprove(){
    return hasPermission("approvals.manage");
}

async function canManageSettings(){
    return hasPermission("settings.manage");
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
