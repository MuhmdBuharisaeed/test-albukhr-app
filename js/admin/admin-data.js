/* ==========================================
   ALBUKHR ADMIN DATA v2
   NETWORK-AWARE DATA ACCESS LAYER

   DEPENDS ON:
   - js/supabase-core.js

   PURPOSE:
   - Read admin dashboard metrics
   - Single Supabase client
   - Current-network isolation
   - No LocalStorage
   - No UI rendering

   NOTE:
   Table/column names are kept conservative.
   Missing optional tables return safe errors instead
   of inventing data.
========================================== */

(function(window){

  "use strict";

  function getContext(){

    if(
      typeof window.requireAlbukhrSupabaseClient !== "function" ||
      typeof window.requireAlbukhrNetwork !== "function"
    ){
      throw new Error(
        "ALBUKHR Supabase Core is not available."
      );
    }

    return {
      db:
        window.requireAlbukhrSupabaseClient(),
      network:
        window.requireAlbukhrNetwork()
    };
  }

  async function countTable(
    table,
    filterColumn = null,
    filterValue = null
  ){

    const {
      db,
      network
    } = getContext();

    let query =
      db
        .from(table)
        .select("id", {
          count: "exact",
          head: true
        })
        .eq("network", network);

    if(filterColumn){
      query =
        query.eq(
          filterColumn,
          filterValue
        );
    }

    const result =
      await query;

    if(result.error){
      throw new Error(
        `${table}: ${result.error.message}`
      );
    }

    return result.count ?? 0;
  }

  async function getDashboardCounts(){

    const output = {
      network:
        window.requireAlbukhrNetwork(),
      coreProjects: null,
      ecosystem: null,
      dapps: null,
      contributors: null,
      transactions: null,
      pendingWithdrawals: null,
      risk: null,
      internalProjects: null,
      externalProjects: null,
      escrow: null
    };

    /*
      Only query tables that are part of the
      current ALBUKHR architecture and are known
      from the supplied configuration/project context.
    */

    const jobs = [
      ["coreProjects", "projects"],
      ["transactions", "transactions"],
      ["contributors", "contributors"],
      ["pendingWithdrawals", "withdraw_requests"]
    ];

    for(const [key, table] of jobs){

      try{
        output[key] =
          await countTable(table);
      }catch(error){
        console.warn(
          `Admin metric unavailable: ${table}`,
          error
        );
      }
    }

    try{
      output.pendingWithdrawals =
        await countTable(
          "withdraw_requests",
          "status",
          "pending"
        );
    }catch(error){
      console.warn(
        "Pending withdrawal metric unavailable:",
        error
      );
    }

    return output;
  }

  async function getRecentTransactions(limit = 20){

    const {
      db,
      network
    } = getContext();

    const safeLimit =
      Math.min(
        Math.max(
          Number(limit) || 20,
          1
        ),
        100
      );

    const result =
      await db
        .from("transactions")
        .select("*")
        .eq("network", network)
        .order(
          "created_at",
          { ascending: false }
        )
        .limit(safeLimit);

    if(result.error){
      throw new Error(
        result.error.message ||
        "Unable to load transactions."
      );
    }

    return Array.isArray(result.data)
      ? result.data
      : [];
  }

  async function getPendingWithdrawals(limit = 20){

    const {
      db,
      network
    } = getContext();

    const safeLimit =
      Math.min(
        Math.max(
          Number(limit) || 20,
          1
        ),
        100
      );

    const result =
      await db
        .from("withdraw_requests")
        .select("*")
        .eq("network", network)
        .eq("status", "pending")
        .order(
          "created_at",
          { ascending: true }
        )
        .limit(safeLimit);

    if(result.error){
      throw new Error(
        result.error.message ||
        "Unable to load pending withdrawals."
      );
    }

    return Array.isArray(result.data)
      ? result.data
      : [];
  }

  window.AlbukhrAdminData = Object.freeze({
    getDashboardCounts,
    getRecentTransactions,
    getPendingWithdrawals
  });

})(window);
