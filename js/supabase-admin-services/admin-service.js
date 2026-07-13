/* ==========================================
   ALBUKHR ADMIN SERVICE
   Version 1.0
========================================== */

(function(window){

"use strict";

/* ==========================================
   TABLE
========================================== */

const TABLE = "admin_users";

/* ==========================================
   LIST ADMINS
========================================== */

async function list(){

    return await BaseService.list(

        TABLE,

        {

            orderBy:"created_at",

            ascending:false

        }

    );

}

/* ==========================================
   COUNT ADMINS
========================================== */

async function count(){

    return await BaseService.count(TABLE);

}

/* ==========================================
   ACTIVE ADMINS
========================================== */

async function countActive(){

    return await BaseService.count(

        TABLE,

        query =>

        query.eq(

            "status",

            "active"

        )

    );

}

/* ==========================================
   FIND BY ID
========================================== */

async function findById(id){

    return await BaseService.find(

        TABLE,

        "id",

        id

    );

}

/* ==========================================
   FIND BY AUTH USER
========================================== */

async function findByAuthUser(authUserId){

    return await BaseService.find(

        TABLE,

        "auth_user_id",

        authUserId

    );

}

/* ==========================================
   FIND BY EMAIL
========================================== */

async function findByEmail(email){

    return await BaseService.find(

        TABLE,

        "email",

        email

    );

}

/* ==========================================
   FIND BY USERNAME
========================================== */

async function findByUsername(username){

    return await BaseService.find(

        TABLE,

        "username",

        username

    );

}

/* ==========================================
   CREATE ADMIN
========================================== */

async function create(data){

    return await BaseService.insert(

        TABLE,

        data

    );

}

/* ==========================================
   UPDATE ADMIN
========================================== */

async function update(id,data){

    return await BaseService.update(

        TABLE,

        "id",

        id,

        data

    );

}

/* ==========================================
   DELETE ADMIN
========================================== */

async function remove(id){

    return await BaseService.remove(

        TABLE,

        "id",

        id

    );

}

/* ==========================================
   SUMMARY
========================================== */

async function summary(){

    return{

        total:

        await count(),

        active:

        await countActive()

    };

}

/* ==========================================
   EXPORT
========================================== */

window.AdminService = {

    list,

    count,

    countActive,

    findById,

    findByAuthUser,

    findByEmail,

    findByUsername,

    create,

    update,

    remove,

    summary

};

})(window);
