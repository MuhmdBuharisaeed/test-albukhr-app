/* ==========================================
   ALBUKHR BASE SERVICE
   Version 1.0
   Foundation for all Admin Services
========================================== */

(function(window){

"use strict";

/* ==========================================
   CLIENT
========================================== */

function client(){

    if(typeof window.getAlbukhrSupabaseClient === "function"){

        const supabase =
        window.getAlbukhrSupabaseClient();

        if(supabase){
            return supabase;
        }

    }

    throw new Error(
        "ALBUKHR Supabase Core not initialized."
    );

}

/* ==========================================
   LIST
========================================== */

async function list(

    table,

    options = {}

){

    try{

        let query =
        client()
        .from(table)
        .select(options.select || "*");

        if(options.orderBy){

            query =
            query.order(

                options.orderBy,

                {

                    ascending:
                    options.ascending ?? true

                }

            );

        }

        if(options.limit){

            query =
            query.limit(options.limit);

        }

        const {

            data,
            error

        } = await query;

        if(error){

            throw error;

        }

        return data || [];

    }catch(error){

        console.error(error);

        return [];

    }

}

/* ==========================================
   FIND
========================================== */

async function find(

    table,

    column,

    value

){

    try{

        const {

            data,
            error

        } = await client()

        .from(table)

        .select("*")

        .eq(column,value)

        .single();

        if(error){

            return null;

        }

        return data;

    }catch(error){

        console.error(error);

        return null;

    }

}

/* ==========================================
   COUNT
========================================== */

async function count(

    table,

    filter = null

){

    try{

        let query =
        client()

        .from(table)

        .select("*",{

            head:true,

            count:"exact"

        });

        if(filter){

            query =
            filter(query);

        }

        const {

            count,
            error

        } = await query;

        if(error){

            return 0;

        }

        return count || 0;

    }catch(error){

        console.error(error);

        return 0;

    }

}

/* ==========================================
   INSERT
========================================== */

async function insert(

    table,

    payload

){

    try{

        const {

            data,
            error

        } = await client()

        .from(table)

        .insert(payload)

        .select()

        .single();

        if(error){

            throw error;

        }

        return {

            success:true,

            data

        };

    }catch(error){

        return {

            success:false,

            error:error.message

        };

    }

}

/* ==========================================
   UPDATE
========================================== */

async function update(

    table,

    column,

    value,

    payload

){

    try{

        const {

            data,
            error

        } = await client()

        .from(table)

        .update(payload)

        .eq(column,value)

        .select()

        .single();

        if(error){

            throw error;

        }

        return {

            success:true,

            data

        };

    }catch(error){

        return {

            success:false,

            error:error.message

        };

    }

}

/* ==========================================
   REMOVE
========================================== */

async function remove(

    table,

    column,

    value

){

    try{

        const {

            error

        } = await client()

        .from(table)

        .delete()

        .eq(column,value);

        if(error){

            throw error;

        }

        return {

            success:true

        };

    }catch(error){

        return {

            success:false,

            error:error.message

        };

    }

}

/* ==========================================
   EXISTS
========================================== */

async function exists(

    table,

    column,

    value

){

    const result =
    await find(

        table,

        column,

        value

    );

    return !!result;

}

/* ==========================================
   EXPORT
========================================== */

window.BaseService = {

    list,

    find,

    count,

    insert,

    update,

    remove,

    exists

};

})(window);
