import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageLoading } from "../components/ui/PageLoading";
import { supabase } from "../lib/supabase";
import { getShopMemberships } from "../lib/api";

export function AuthCallbackPage(){const navigate=useNavigate();const [params]=useSearchParams();const [message,setMessage]=useState("Confirming your secure link…");useEffect(()=>{void(async()=>{if(!supabase){navigate("/auth",{replace:true});return;}const {data:{session}}=await supabase.auth.getSession();if(!session){setMessage("This link is invalid or expired. Request a new one from the sign-in page.");return;}if(params.get("next")==="set-password"||session.user.recovery_sent_at||session.user.invited_at){navigate("/auth/set-password",{replace:true});return;}const {data,error}=await supabase.rpc("accept_shop_invitation");if(!error&&data){localStorage.setItem("akiba-active-shop",String(data));navigate("/auth/set-password",{replace:true});return;}const memberships=await getShopMemberships();navigate(memberships.some(m=>m.active&&m.shop_active)?"/dashboard":"/dashboard/shops/new",{replace:true});})()},[navigate,params]);return <PageLoading title="Finishing sign in" message={message}/>}
