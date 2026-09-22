/* ALBUKHR TESTNET LIQUIDITY MODEL v1 */
(function(window){
  "use strict";

  var NETWORK = "testnet";
  var MIN_REQUIRED_LIQUIDITY = 100;

  function clean(value){
    return String(value == null ? "" : value).trim();
  }

  function number(value){
    var n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function validateEnvironment(){
    var env = window.ALBukhrEnvironment;

    if(!env || typeof env.isKnown !== "function" ||
       typeof env.isTestnet !== "function" ||
       typeof env.getNetwork !== "function"){
      throw new Error("TESTNET_ENVIRONMENT_UNAVAILABLE");
    }

    if(!env.isKnown() || !env.isTestnet() || env.getNetwork() !== NETWORK){
      throw new Error("INVALID_TESTNET_ENVIRONMENT");
    }

    return env;
  }

  function getSupabase(){
    validateEnvironment();
    var core = window.ALBUKHR_SUPABASE;

    if(!core || !core.client || core.network !== NETWORK){
      throw new Error("TESTNET_SUPABASE_CORE_UNAVAILABLE");
    }

    return core;
  }

  function getRequiredLiquidity(treasury){
    var configured = number(treasury && treasury.required_liquidity);
    return Math.max(MIN_REQUIRED_LIQUIDITY, configured);
  }

  function getVerifiedLiquidity(treasury){
    return Math.max(0, number(treasury && treasury.verified_liquidity));
  }

  function getCoverage(verified, required){
    if(required <= 0) return 0;
    return (verified / required) * 100;
  }

  function getReadiness(project, treasury){
    var status = clean(project && project.status).toLowerCase();
    var required = getRequiredLiquidity(treasury);
    var verified = getVerifiedLiquidity(treasury);

    if(status !== "approved"){
      return {
        code: "blocked",
        label: "NOT APPROVED",
        ready: false,
        required: required,
        verified: verified,
        coverage: getCoverage(verified, required)
      };
    }

    if(verified >= required){
      return {
        code: "ready",
        label: "TESTNET READY",
        ready: true,
        required: required,
        verified: verified,
        coverage: getCoverage(verified, required)
      };
    }

    if(verified > 0){
      return {
        code: "partial",
        label: "LIQUIDITY PARTIAL",
        ready: false,
        required: required,
        verified: verified,
        coverage: getCoverage(verified, required)
      };
    }

    return {
      code: "pending",
      label: "LIQUIDITY PENDING",
      ready: false,
      required: required,
      verified: verified,
      coverage: 0
    };
  }

  async function load(){
    var core = getSupabase();

    var projectsQuery = core.rpc("get_public_project_registry", {
      p_network: NETWORK
    });

    var treasuryQuery = core.from("project_treasury")
      .select("id,project_id,network,treasury_wallet,required_liquidity,verified_liquidity,status")
      .eq("network", NETWORK);

    var results = await Promise.all([projectsQuery, treasuryQuery]);

    if(results[0].error){
      throw new Error("TESTNET_PROJECT_REGISTRY_LOAD_FAILED:" + results[0].error.message);
    }

    if(results[1].error){
      throw new Error("TESTNET_TREASURY_READ_FAILED:" + results[1].error.message);
    }

    var projects = Array.isArray(results[0].data) ? results[0].data : [];
    var treasuries = Array.isArray(results[1].data) ? results[1].data : [];

    var treasuryMap = new Map();
    treasuries.forEach(function(row){
      if(row && row.project_id){
        treasuryMap.set(String(row.project_id), row);
      }
    });

    var rows = projects
      .filter(function(project){
        return project && clean(project.network).toLowerCase() === NETWORK &&
          clean(project.status).toLowerCase() === "approved";
      })
      .map(function(project){
        var treasury = treasuryMap.get(String(project.id)) || null;
        return {
          project: project,
          treasury: treasury,
          readiness: getReadiness(project, treasury)
        };
      });

    return rows;
  }

  window.AlbukhrTestnetLiquidity = Object.freeze({
    network: NETWORK,
    MIN_REQUIRED_LIQUIDITY: MIN_REQUIRED_LIQUIDITY,
    load: load,
    getRequiredLiquidity: getRequiredLiquidity,
    getVerifiedLiquidity: getVerifiedLiquidity,
    getCoverage: getCoverage,
    getReadiness: getReadiness
  });

})(window);
