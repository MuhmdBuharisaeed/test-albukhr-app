/* ALBUKHR TESTNET PROJECT OWNER ADMIN v1 */
(function(window, document){
  "use strict";
  var ENDPOINT="https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-project-owner-admin";
  var initialized=false;
  var state={projects:[],profiles:[],history:[]};
  function el(id){return document.getElementById(id);}
  function clean(v){return String(v==null?"":v).trim();}
  function status(message,error){var n=el("pageStatus");if(!n)return;n.textContent=clean(message);n.className="page-status"+(error?" error":"");}
  function sessionToken(){if(!window.AlbukhrTestnetAdminAuth)throw new Error("TESTNET_ADMIN_AUTH_UNAVAILABLE");var token=window.AlbukhrTestnetAdminAuth.getSessionToken();if(!token)throw new Error("TESTNET_ADMIN_SESSION_REQUIRED");return token;}
  async function request(method,body){
    var options={method:method,headers:{"Authorization":"Bearer "+sessionToken(),"Accept":"application/json"}};
    if(body!==undefined){options.headers["Content-Type"]="application/json";options.body=JSON.stringify(body);}
    var response=await fetch(ENDPOINT,options),data=null;try{data=await response.json();}catch(_){ }
    if(!response.ok||!data||data.ok!==true)throw new Error(clean(data&&(data.error||data.message))||"OWNER_ADMIN_REQUEST_FAILED");
    return data;
  }
  function profileFor(projectId){return state.profiles.find(function(p){return String(p.project_id)===String(projectId);})||null;}
  function nameFromUser(userId){if(!userId)return "Unassigned";var p=state.profiles.find(function(item){return String(item.owner_user_id)===String(userId);});return p?clean(p.display_name||p.contact_email)||clean(userId):clean(userId);}
  function actionLabel(a){return {assign:"Assigned",change:"Changed",revoke:"Revoked",verify:"Verified",reject:"Rejected"}[a]||a;}
  function renderSummary(){var total=state.projects.length,assigned=state.projects.filter(function(p){return !!p.owner_user_id;}).length,verified=state.profiles.filter(function(p){return p.verification_status==="verified";}).length;el("approvedCount").textContent=String(total);el("assignedCount").textContent=String(assigned);el("unassignedCount").textContent=String(Math.max(0,total-assigned));el("verifiedCount").textContent=String(verified);}
  function makeField(label,key,value,type){var wrap=document.createElement("label");wrap.className="owner-field";var span=document.createElement("span");span.textContent=label;var input=document.createElement("input");input.type=type||"text";input.name=key;input.dataset.field=key;input.autocomplete="off";input.value=clean(value);wrap.appendChild(span);wrap.appendChild(input);return wrap;}
  function makeButton(text,action,kind,projectId){var b=document.createElement("button");b.type="button";b.className="owner-action-btn "+(kind||"");b.dataset.action=action;b.dataset.projectId=projectId;b.textContent=text;return b;}
  function inputCard(project){
    var p=profileFor(project.id),hasOwner=!!project.owner_user_id,verified=p&&p.verification_status==="verified";
    var card=document.createElement("article");card.className="owner-project-card";card.dataset.projectId=project.id;
    var header=document.createElement("div");header.className="owner-project-head";
    var title=document.createElement("div");title.className="owner-project-title";var h3=document.createElement("h3");h3.textContent=clean(project.name||project.project_code||"Project");var code=document.createElement("small");code.textContent=clean(project.project_code||"—");title.appendChild(h3);title.appendChild(code);
    var badge=document.createElement("span");badge.className="owner-status "+(hasOwner?(verified?"verified":"assigned"):"unassigned");badge.textContent=hasOwner?(verified?"OWNER VERIFIED":"OWNER ASSIGNED"):"NO OWNER";header.appendChild(title);header.appendChild(badge);card.appendChild(header);
    var ownerLine=document.createElement("div");ownerLine.className="owner-current";var currentLabel=document.createElement("span");currentLabel.textContent="Current owner";var currentValue=document.createElement("strong");currentValue.textContent=hasOwner?((p&&(p.display_name||p.contact_email))?(p.display_name||p.contact_email):project.owner_user_id):"Unassigned";ownerLine.appendChild(currentLabel);ownerLine.appendChild(currentValue);card.appendChild(ownerLine);
    var grid=document.createElement("div");grid.className="owner-form-grid";grid.appendChild(makeField("Owner Pi UID","owner_pi_uid",""));grid.appendChild(makeField("Username","owner_username",""));grid.appendChild(makeField("Wallet address","owner_wallet_address",""));grid.appendChild(makeField("Display name","display_name",p&&p.display_name));grid.appendChild(makeField("Role title","role_title",p&&p.role_title));grid.appendChild(makeField("Email","contact_email",p&&p.contact_email,"email"));grid.appendChild(makeField("Phone","contact_phone",p&&p.contact_phone,"tel"));grid.appendChild(makeField("Organization","organization_name",p&&p.organization_name));card.appendChild(grid);
    var actions=document.createElement("div");actions.className="owner-actions";actions.appendChild(makeButton(hasOwner?"Change Owner":"Assign Owner",hasOwner?"change_owner":"assign_owner","primary",project.id));
    if(hasOwner){actions.appendChild(makeButton("Revoke Owner","revoke_owner","danger",project.id));if(p&&p.verification_status==="pending"){actions.appendChild(makeButton("Verify Owner","verify_owner","success",project.id));actions.appendChild(makeButton("Reject Owner","reject_owner","muted",project.id));}}
    card.appendChild(actions);if(p){var meta=document.createElement("div");meta.className="owner-meta";meta.textContent="Profile: "+clean(p.verification_status||"pending")+" · "+clean(p.profile_status||"active");card.appendChild(meta);}return card;
  }
  function renderProjects(){var host=el("projectCards");host.replaceChildren();state.projects.forEach(function(p){host.appendChild(inputCard(p));});el("emptyState").hidden=state.projects.length>0;}
  function renderHistory(){var tbody=el("historyRows");tbody.replaceChildren();state.history.forEach(function(row){var tr=document.createElement("tr"),project=state.projects.find(function(p){return String(p.id)===String(row.project_id);});[new Date(row.created_at).toLocaleString(),clean(project&&(project.name||project.project_code))||clean(row.project_id),actionLabel(clean(row.action_type)),nameFromUser(row.previous_owner_user_id),nameFromUser(row.new_owner_user_id),clean(row.reason)].forEach(function(v){var td=document.createElement("td");td.textContent=v||"—";tr.appendChild(td);});tbody.appendChild(tr);});el("historyEmpty").hidden=state.history.length>0;}
  async function load(){status("Loading ownership state…");var data=await request("GET");state={projects:Array.isArray(data.projects)?data.projects:[],profiles:Array.isArray(data.profiles)?data.profiles:[],history:Array.isArray(data.history)?data.history:[]};renderSummary();renderProjects();renderHistory();status(state.projects.length+" approved Testnet project"+(state.projects.length===1?"":"s")+" loaded.");return state;}
  function fieldValue(card,key){var input=card.querySelector('[data-field="'+key+'"]');return clean(input&&input.value);}
  async function runAction(button){
    var projectId=clean(button.dataset.projectId),action=clean(button.dataset.action),card=button.closest(".owner-project-card");if(!projectId||!action||!card)throw new Error("OWNERSHIP_FORM_INVALID");var project=state.projects.find(function(p){return String(p.id)===projectId;});if(!project)throw new Error("PROJECT_NOT_FOUND");
    var actionName=action.replace("_owner","");var reason=clean(window.prompt("Enter the reason for this ownership action:",actionName==="assign"?"Initial Core Project owner assignment":""));if(!reason)return;
    if(actionName==="assign"||actionName==="change"){
      var ownerPiUid=fieldValue(card,"owner_pi_uid");if(!ownerPiUid)throw new Error("OWNER_PI_UID_REQUIRED");
      if(!window.confirm((actionName==="assign"?"Assign":"Change")+" ownership for "+clean(project.name||project.project_code)+"?\n\nOwner Pi UID: "+ownerPiUid+"\n\nThis action is server-authorized and will be written to the audit history."))return;
      await request("POST",{action:action,project_id:projectId,owner_pi_uid:ownerPiUid,owner_username:fieldValue(card,"owner_username"),owner_wallet_address:fieldValue(card,"owner_wallet_address"),display_name:fieldValue(card,"display_name"),role_title:fieldValue(card,"role_title"),contact_email:fieldValue(card,"contact_email"),contact_phone:fieldValue(card,"contact_phone"),organization_name:fieldValue(card,"organization_name"),reason:reason,profile_metadata:{}});
    }else{
      if(!window.confirm(actionName==="revoke"?"Revoke the current owner from "+clean(project.name||project.project_code)+"?":actionName==="verify"?"Verify the current owner profile for "+clean(project.name||project.project_code)+"?":"Reject the current owner profile for "+clean(project.name||project.project_code)+"?"))return;
      await request("POST",{action:action,project_id:projectId,reason:reason});
    }
    status("Ownership action completed. Reloading authoritative state…");await load();
  }
  function handleClick(event){var button=event.target.closest(".owner-action-btn");if(!button)return;button.disabled=true;runAction(button).catch(function(error){console.error("[ALBUKHR TESTNET PROJECT OWNER ADMIN]",error);status("Action failed: "+(error.message||error),true);}).finally(function(){button.disabled=false;});}
  async function init(){
    if(initialized)return;initialized=true;
    try{
      var env=window.ALBukhrEnvironment;if(!env||!env.isKnown||!env.isTestnet||!env.isKnown()||!env.isTestnet()||env.getNetwork()!=="testnet")throw new Error("TESTNET_ADMIN_ENVIRONMENT_REQUIRED");
      if(!window.AlbukhrTestnetAdminAuth)throw new Error("TESTNET_ADMIN_AUTH_UNAVAILABLE");window.AlbukhrTestnetAdminAuth.init();var session=await window.AlbukhrTestnetAdminAuth.requireAdmin({redirectOnFailure:true});if(!session)return;
      var roles=Array.isArray(session.admin&&session.admin.roles)?session.admin.roles.map(String):[];if(roles.indexOf("super_admin")===-1)throw new Error("TESTNET_SUPER_ADMIN_REQUIRED");
      el("adminEmail").textContent=clean(session.admin&&session.admin.email)||"Authenticated admin";el("adminRoles").textContent=roles.join(", ");
      el("refreshButton").addEventListener("click",function(){el("refreshButton").disabled=true;load().catch(function(error){status("Unable to load ownership state: "+(error.message||error),true);}).finally(function(){el("refreshButton").disabled=false;});});
      el("projectCards").addEventListener("click",handleClick);el("logoutButton").addEventListener("click",function(){window.AlbukhrTestnetAdminAuth.logout();window.location.replace("index.html");});await load();
    }catch(error){console.error("[ALBUKHR TESTNET PROJECT OWNER ADMIN]",error);status("Ownership administration error: "+(error.message||error),true);}
  }
  window.AlbukhrTestnetProjectOwnerAdmin=Object.freeze({init:init,load:load});if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})(window,document);
