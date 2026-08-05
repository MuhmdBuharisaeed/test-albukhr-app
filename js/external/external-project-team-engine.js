/* =========================================
   ALBUKHR EXTERNAL PROJECT TEAM ENGINE
   v1 MAINNET READY
========================================= */

/*
TABLE:
external_project_team

DEPENDENCIES:
- supabase-core.js
- external-project-engine.js
*/

const EXTERNAL_TEAM_TABLE =
"external_project_team";

/* =========================================
SUPABASE
========================================= */

function getExternalTeamSupabase(){

    if(typeof
    getAlbukhrSupabaseClient
    ==="function"){

        return
        getAlbukhrSupabaseClient();

    }

    if(window.albukhrSupabase){

        return
        window.albukhrSupabase;

    }

    return null;

}

/* =========================================
ASSERT
========================================= */

function assertExternalTeamDependencies(){

    if(typeof
    getExternalProject
    !=="function"){

        throw new Error(

        "external-project-engine.js required"

        );

    }

}

/* =========================================
SAFE HELPERS
========================================= */

function teamSafeString(value){

    if(
    value===null||
    value===undefined
    ){

        return "";

    }

    return String(value).trim();

}

function teamSafeNumber(value){

    const n=
    Number(value);

    return
    Number.isFinite(n)
    ?n
    :0;

}

function teamNow(){

    return
    new Date()
    .toISOString();

}

/* =========================================
TEAM OBJECT
========================================= */

function createTeamMemberObject(data={}){

    return{

        project_code:

        teamSafeString(
        data.project_code
        ),

        member_id:

        teamSafeString(
        data.member_id
        ),

        full_name:

        teamSafeString(
        data.full_name
        ),

        username:

        teamSafeString(
        data.username
        ),

        email:

        teamSafeString(
        data.email
        ),

        phone:

        teamSafeString(
        data.phone
        ),

        wallet:

        teamSafeString(
        data.wallet
        ),

        role:

        teamSafeString(
        data.role
        )||

        "member",

        permission_level:

        teamSafeString(
        data.permission_level
        )||

        "basic",

        invitation_status:

        teamSafeString(
        data.invitation_status
        )||

        "pending",

        member_status:

        teamSafeString(
        data.member_status
        )||

        "active",

        joined_at:

        data.joined_at||

        teamNow(),

        created_at:

        teamNow(),

        updated_at:

        teamNow()

    };

}

/* =========================================
NORMALIZE MEMBER
========================================= */

function normalizeTeamMember(row={}){

    return{

        id:
        row.id,

        project_code:
        teamSafeString(
        row.project_code
        ),

        member_id:
        teamSafeString(
        row.member_id
        ),

        full_name:
        teamSafeString(
        row.full_name
        ),

        username:
        teamSafeString(
        row.username
        ),

        email:
        teamSafeString(
        row.email
        ),

        phone:
        teamSafeString(
        row.phone
        ),

        wallet:
        teamSafeString(
        row.wallet
        ),

        role:
        teamSafeString(
        row.role
        ),

        permission_level:
        teamSafeString(
        row.permission_level
        ),

        invitation_status:
        teamSafeString(
        row.invitation_status
        ),

        member_status:
        teamSafeString(
        row.member_status
        ),

        joined_at:
        row.joined_at,

        created_at:
        row.created_at,

        updated_at:
        row.updated_at

    };

}

/* =========================================
EXPORTS
========================================= */

window.getExternalTeamSupabase =
getExternalTeamSupabase;

window.createTeamMemberObject =
createTeamMemberObject;

window.normalizeTeamMember =
normalizeTeamMember;

/* =========================================
CREATE TEAM MEMBER
========================================= */

async function createTeamMember(data={}){

    assertExternalTeamDependencies();

    const supabase =
    getExternalTeamSupabase();

    if(!supabase){

        return{
            error:"Supabase unavailable"
        };

    }

    const member =
    createTeamMemberObject(data);

    const project =
    await getExternalProject(
        member.project_code
    );

    if(!project){

        return{
            error:"Project not found"
        };

    }

    try{

        const {data:row,error} =
        await supabase
        .from(EXTERNAL_TEAM_TABLE)
        .insert(member)
        .select()
        .single();

        if(error){

            return{
                error:error.message
            };

        }

        return{

            success:true,

            member:
            normalizeTeamMember(row)

        };

    }catch(e){

        return{

            error:e.message

        };

    }

}

/* =========================================
GET MEMBER
========================================= */

async function getTeamMember(id){

    const supabase =
    getExternalTeamSupabase();

    if(!supabase){

        return null;

    }

    try{

        const {data,error} =
        await supabase
        .from(EXTERNAL_TEAM_TABLE)
        .select("*")
        .eq("id",id)
        .maybeSingle();

        if(error){

            return null;

        }

        if(!data){

            return null;

        }

        return normalizeTeamMember(data);

    }catch(e){

        return null;

    }

}

/* =========================================
GET PROJECT TEAM
========================================= */

async function getProjectTeam(projectCode){

    const supabase =
    getExternalTeamSupabase();

    if(!supabase){

        return[];

    }

    try{

        const {data,error} =
        await supabase
        .from(EXTERNAL_TEAM_TABLE)
        .select("*")
        .eq(
            "project_code",
            projectCode
        )
        .order(
            "created_at",
            {
                ascending:true
            }
        );

        if(error){

            return[];

        }

        return (data||[])

        .map(

            normalizeTeamMember

        );

    }catch(e){

        return[];

    }

}

/* =========================================
GET MEMBER BY EMAIL
========================================= */

async function getMemberByEmail(email){

    const supabase =
    getExternalTeamSupabase();

    if(!supabase){

        return null;

    }

    email =
    teamSafeString(email)
    .toLowerCase();

    try{

        const {data,error} =
        await supabase
        .from(EXTERNAL_TEAM_TABLE)
        .select("*")
        .ilike(
            "email",
            email
        )
        .maybeSingle();

        if(error){

            return null;

        }

        if(!data){

            return null;

        }

        return normalizeTeamMember(data);

    }catch(e){

        return null;

    }

}

/* =========================================
GET MEMBER BY WALLET
========================================= */

async function getMemberByWallet(wallet){

    const supabase =
    getExternalTeamSupabase();

    if(!supabase){

        return null;

    }

    wallet =
    teamSafeString(wallet);

    try{

        const {data,error} =
        await supabase
        .from(EXTERNAL_TEAM_TABLE)
        .select("*")
        .eq(
            "wallet",
            wallet
        )
        .maybeSingle();

        if(error){

            return null;

        }

        if(!data){

            return null;

        }

        return normalizeTeamMember(data);

    }catch(e){

        return null;

    }

}

/* =========================================
EXPORTS
========================================= */

window.createTeamMember =
createTeamMember;

window.getTeamMember =
getTeamMember;

window.getProjectTeam =
getProjectTeam;

window.getMemberByEmail =
getMemberByEmail;

window.getMemberByWallet =
getMemberByWallet;

/* =========================================
UPDATE TEAM MEMBER
========================================= */

async function updateTeamMember(id, updates = {}){

    const supabase =
    getExternalTeamSupabase();

    if(!supabase){

        return{
            error:"Supabase unavailable"
        };

    }

    updates.updated_at =
    teamNow();

    try{

        const {data,error} =
        await supabase
        .from(EXTERNAL_TEAM_TABLE)
        .update(updates)
        .eq("id", id)
        .select()
        .single();

        if(error){

            return{
                error:error.message
            };

        }

        return{

            success:true,

            member:
            normalizeTeamMember(data)

        };

    }catch(e){

        return{

            error:e.message

        };

    }

}

/* =========================================
CHANGE ROLE
========================================= */

async function changeMemberRole(

id,

role

){

    return await updateTeamMember(

        id,

        {

            role:
            teamSafeString(role)

        }

    );

}

/* =========================================
CHANGE PERMISSION LEVEL
========================================= */

async function changePermissionLevel(

id,

permission

){

    return await updateTeamMember(

        id,

        {

            permission_level:
            teamSafeString(permission)

        }

    );

}

/* =========================================
ACCEPT INVITATION
========================================= */

async function acceptInvitation(id){

    return await updateTeamMember(

        id,

        {

            invitation_status:

            "accepted",

            member_status:

            "active",

            joined_at:

            teamNow()

        }

    );

}

/* =========================================
REJECT INVITATION
========================================= */

async function rejectInvitation(id){

    return await updateTeamMember(

        id,

        {

            invitation_status:

            "rejected"

        }

    );

}

/* =========================================
DEACTIVATE MEMBER
========================================= */

async function deactivateMember(id){

    return await updateTeamMember(

        id,

        {

            member_status:

            "inactive"

        }

    );

}

/* =========================================
ACTIVATE MEMBER
========================================= */

async function activateMember(id){

    return await updateTeamMember(

        id,

        {

            member_status:

            "active"

        }

    );

}

/* =========================================
REMOVE MEMBER
========================================= */

async function removeTeamMember(id){

    const supabase =
    getExternalTeamSupabase();

    if(!supabase){

        return{

            error:"Supabase unavailable"

        };

    }

    try{

        const {error} =
        await supabase
        .from(EXTERNAL_TEAM_TABLE)
        .delete()
        .eq("id", id);

        if(error){

            return{

                error:error.message

            };

        }

        return{

            success:true

        };

    }catch(e){

        return{

            error:e.message

        };

    }

}

/* =========================================
EXPORTS
========================================= */

window.updateTeamMember =
updateTeamMember;

window.changeMemberRole =
changeMemberRole;

window.changePermissionLevel =
changePermissionLevel;

window.acceptInvitation =
acceptInvitation;

window.rejectInvitation =
rejectInvitation;

window.activateMember =
activateMember;

window.deactivateMember =
deactivateMember;

window.removeTeamMember =
removeTeamMember;

/* =========================================
SEARCH TEAM MEMBERS
========================================= */

async function searchProjectTeam(

projectCode,

keyword=""

){

    const members =
    await getProjectTeam(projectCode);

    keyword =
    teamSafeString(keyword)
    .toLowerCase();

    if(!keyword){

        return members;

    }

    return members.filter(member=>{

        return (

        member.full_name
        .toLowerCase()
        .includes(keyword)

        ||

        member.username
        .toLowerCase()
        .includes(keyword)

        ||

        member.email
        .toLowerCase()
        .includes(keyword)

        ||

        member.role
        .toLowerCase()
        .includes(keyword)

        );

    });

}

/* =========================================
FILTER BY ROLE
========================================= */

async function getMembersByRole(

projectCode,

role

){

    const members =
    await getProjectTeam(projectCode);

    role =
    teamSafeString(role)
    .toLowerCase();

    return members.filter(m=>

        m.role
        .toLowerCase()

        ===

        role

    );

}

/* =========================================
FILTER BY PERMISSION
========================================= */

async function getMembersByPermission(

projectCode,

permission

){

    const members =
    await getProjectTeam(projectCode);

    permission =
    teamSafeString(permission)
    .toLowerCase();

    return members.filter(m=>

        m.permission_level
        .toLowerCase()

        ===

        permission

    );

}

/* =========================================
FILTER BY STATUS
========================================= */

async function getActiveTeamMembers(

projectCode

){

    const members =
    await getProjectTeam(projectCode);

    return members.filter(m=>

        m.member_status
        ===

        "active"

    );

}

/* =========================================
TEAM STATISTICS
========================================= */

async function getProjectTeamStatistics(

projectCode

){

    const members =
    await getProjectTeam(projectCode);

    const stats={

        total:0,

        active:0,

        inactive:0,

        pending:0,

        accepted:0,

        rejected:0,

        admins:0,

        managers:0,

        members:0

    };

    members.forEach(m=>{

        stats.total++;

        if(m.member_status==="active")
        stats.active++;

        if(m.member_status==="inactive")
        stats.inactive++;

        if(m.invitation_status==="pending")
        stats.pending++;

        if(m.invitation_status==="accepted")
        stats.accepted++;

        if(m.invitation_status==="rejected")
        stats.rejected++;

        if(m.role==="admin")
        stats.admins++;

        if(m.role==="manager")
        stats.managers++;

        if(m.role==="member")
        stats.members++;

    });

    return stats;

}

/* =========================================
TEAM DASHBOARD SUMMARY
========================================= */

async function getProjectTeamDashboard(

projectCode

){

    const team =
    await getProjectTeam(projectCode);

    const stats =
    await getProjectTeamStatistics(

        projectCode

    );

    return{

        statistics:stats,

        members:team

    };

}

/* =========================================
EXPORTS
========================================= */

window.searchProjectTeam =
searchProjectTeam;

window.getMembersByRole =
getMembersByRole;

window.getMembersByPermission =
getMembersByPermission;

window.getActiveTeamMembers =
getActiveTeamMembers;

window.getProjectTeamStatistics =
getProjectTeamStatistics;

window.getProjectTeamDashboard =
getProjectTeamDashboard;
