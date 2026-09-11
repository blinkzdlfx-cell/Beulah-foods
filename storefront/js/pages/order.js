import { initHeader } from "../components/navbar.js";
import { getCurrentSession } from "../services/authService.js";
import { supabase } from "../lib/supabaseClient.js";
initHeader(document.getElementById("site-header-nav"));
const status = document.getElementById("order-status"), itemsEl = document.getElementById("order-items"), totalEl = document.getElementById("order-total"), title = document.getElementById("order-title"), meta = document.getElementById("order-meta");
const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" });
function show(message,error=false){status.textContent=message;status.className=`alert${error?" alert-error":""}`;status.hidden=false;}
async function init(){
  const session=await getCurrentSession(); if(!session?.user){window.location.href="/login.html?redirect=order.html";return;}
  const id=new URLSearchParams(location.search).get("id"); if(!id){show("No order was specified.",true);return;}
  const [{data:order,error:orderError},{data:items,error:itemError}]=await Promise.all([
    supabase.from("orders").select("id,status,payment_status,subtotal,fees,total,created_at,delivery_name,delivery_phone,delivery_address").eq("id",id).maybeSingle(),
    supabase.from("order_items").select("product_name,unit_price,quantity,line_total").eq("order_id",id).order("created_at")
  ]);
  if(orderError||itemError)throw orderError||itemError; if(!order){show("Order not found.",true);return;}
  title.textContent=`Order ${order.id.slice(0,8)}`;meta.textContent=`${new Date(order.created_at).toLocaleString("en-NG")} · ${order.status} · payment ${order.payment_status}`;
  itemsEl.innerHTML=items.map(item=>`<div style="display:flex;justify-content:space-between;gap:16px"><span>${escapeHtml(item.product_name)} × ${item.quantity}</span><strong>${naira.format(Number(item.line_total))}</strong></div>`).join("");
  totalEl.textContent=`Total: ${naira.format(Number(order.total))}`;
}
function escapeHtml(value){return String(value??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
init().catch(error=>{console.error(error);show("We could not load this order.",true);});
