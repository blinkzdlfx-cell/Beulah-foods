import { supabase } from "./lib/supabaseClient.js";
import { requireAdmin } from "./services/adminAuthService.js";
const rows=document.getElementById("rows"), status=document.getElementById("status");
const naira=new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN"});
async function init(){const access=await requireAdmin();if(!access){location.href="/admin/";return;}const {data,error}=await supabase.from("payments").select("id,order_id,provider,provider_reference,amount,status,created_at").order("created_at",{ascending:false});if(error)throw error;rows.innerHTML=(data||[]).map(p=>`<tr><td>${p.id.slice(0,8)}</td><td>${p.order_id.slice(0,8)}</td><td>${p.provider||"—"}</td><td>${p.provider_reference||"—"}</td><td>${naira.format(Number(p.amount))}</td><td>${p.status}</td><td>${new Date(p.created_at).toLocaleString("en-NG")}</td></tr>`).join("")||'<tr><td colspan="7">No transactions yet.</td></tr>';}
init().catch(e=>{console.error(e);status.textContent="Could not load transactions.";status.hidden=false;});
