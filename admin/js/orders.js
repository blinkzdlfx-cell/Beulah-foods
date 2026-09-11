import { supabase } from "./lib/supabaseClient.js";
import { requireAdmin } from "./services/adminAuthService.js";
const rows=document.getElementById("rows"), status=document.getElementById("status");
const naira=new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN"});
async function init(){const access=await requireAdmin();if(!access){location.href="/admin/";return;}const {data,error}=await supabase.from("orders").select("id,customer_id,total,payment_status,status,created_at").order("created_at",{ascending:false});if(error)throw error;rows.innerHTML=(data||[]).map(o=>`<tr><td>${o.id.slice(0,8)}</td><td>${o.customer_id.slice(0,8)}</td><td>${naira.format(Number(o.total))}</td><td>${o.payment_status}</td><td>${o.status}</td><td>${new Date(o.created_at).toLocaleString("en-NG")}</td></tr>`).join("")||'<tr><td colspan="6">No orders yet.</td></tr>';}
init().catch(e=>{console.error(e);status.textContent="Could not load orders.";status.hidden=false;});
