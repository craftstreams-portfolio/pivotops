"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/lib/hooks/useTenant";
import { Shield, Search, RefreshCw, Download, Filter, AlertTriangle, Info, CheckCircle2, XCircle, Loader2, X, ChevronDown } from "lucide-react";

interface AuditLog { id:string; tenant_id:string; user_id:string|null; user_name:string|null; action:string; entity_type:string|null; entity_id:string|null; metadata:any; ip_address:string|null; severity:string; created_at:string; }

const SEVERITY_CFG: Record<string,{cls:string;icon:any;dot:string}> = {
  info:     {cls:"text-blue-400 bg-blue-500/10 border-blue-500/20",    icon:Info,         dot:"bg-blue-400"},
  warning:  {cls:"text-amber-400 bg-amber-500/10 border-amber-500/20", icon:AlertTriangle, dot:"bg-amber-400"},
  error:    {cls:"text-red-400 bg-red-500/10 border-red-500/20",       icon:XCircle,       dot:"bg-red-400"},
  critical: {cls:"text-red-500 bg-red-500/15 border-red-500/30",       icon:AlertTriangle, dot:"bg-red-500"},
  success:  {cls:"text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon:CheckCircle2, dot:"bg-emerald-400"},
};
const ACTIONS=["login","logout","create","update","delete","approve","reject","export","import","settings_change","role_change"];

function fmt(iso:string){return new Date(iso).toLocaleString([],{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"});}

export default function AuditLogsPage(){
  const {tenantId}=useTenant();
  const [logs,setLogs]=useState<AuditLog[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [severityFilter,setSeverityFilter]=useState("all");
  const [actionFilter,setActionFilter]=useState("all");
  const [expanded,setExpanded]=useState<string|null>(null);
  const [page,setPage]=useState(0);
  const PAGE_SIZE=50;

  const load=useCallback(async()=>{
    setLoading(true);
    let q=supabase.from("audit_logs").select("*").eq("tenant_id",tenantId).order("created_at",{ascending:false}).range(page*PAGE_SIZE,(page+1)*PAGE_SIZE-1);
    if(severityFilter!=="all") q=q.eq("severity",severityFilter);
    if(actionFilter!=="all")   q=q.eq("action",actionFilter);
    const {data}=await q;
    setLogs((data??[]) as AuditLog[]);
    setLoading(false);
  },[tenantId,page,severityFilter,actionFilter]);

  useEffect(()=>{load();},[load]);

  // Realtime
  useEffect(()=>{
    const ch=supabase.channel("audit-live")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"audit_logs"},payload=>{
        setLogs(p=>[payload.new as AuditLog,...p].slice(0,PAGE_SIZE));
      }).subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const exportCSV=()=>{
    const rows=[["Time","User","Action","Entity","Severity","IP"].join(","),
      ...logs.map(l=>[fmt(l.created_at),l.user_name??l.user_id??"system",l.action,l.entity_type??"",l.severity,l.ip_address??""].map(v=>`"${v}"`).join(","))
    ];
    const blob=new Blob([rows.join("\n")],{type:"text/csv"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`audit-log-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  const filtered=logs.filter(l=>{
    if(!search) return true;
    const s=search.toLowerCase();
    return (l.action??"").toLowerCase().includes(s)||(l.user_name??"").toLowerCase().includes(s)||(l.entity_type??"").toLowerCase().includes(s);
  });

  const counts=Object.fromEntries(Object.keys(SEVERITY_CFG).map(k=>[k,logs.filter(l=>l.severity===k).length]));

  return(
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-white">Audit Logs</h1><p className="text-zinc-500 text-sm mt-0.5">Complete activity trail across the platform</p></div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-800 text-xs text-zinc-400 hover:text-white transition"><RefreshCw size={12}/> Refresh</button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-800 text-xs text-zinc-400 hover:text-white transition"><Download size={12}/> Export CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(SEVERITY_CFG).map(([key,cfg])=>{
          const Icon=cfg.icon;
          return(<div key={key} className={`rounded-xl border p-3 cursor-pointer transition ${severityFilter===key?cfg.cls:"border-zinc-800 bg-zinc-900 hover:border-zinc-700"}`} onClick={()=>setSeverityFilter(severityFilter===key?"all":key)}>
            <div className="flex items-center gap-2 mb-1"><Icon size={13} className={severityFilter===key?"":"text-zinc-500"}/><span className="text-[10px] uppercase tracking-wider font-semibold">{key}</span></div>
            <p className="text-xl font-bold">{counts[key]??0}</p>
          </div>);
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5">
          <Search size={14} className="text-zinc-600 flex-shrink-0"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by user, action, entity..." className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none"/>
          {search&&<button onClick={()=>setSearch("")} className="text-zinc-600 hover:text-white"><X size={14}/></button>}
        </div>
        <select value={actionFilter} onChange={e=>setActionFilter(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none cursor-pointer">
          <option value="all">All actions</option>
          {ACTIONS.map(a=><option key={a} value={a} className="bg-zinc-900">{a}</option>)}
        </select>
      </div>

      {loading?<div className="flex items-center justify-center h-32 text-zinc-500 gap-2"><Loader2 size={16} className="animate-spin"/>Loading audit logs...</div>:(
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-4 py-2.5 border-b border-zinc-800 text-[10px] text-zinc-600 uppercase tracking-wider">
            <span className="col-span-2">Time</span><span className="col-span-2">User</span><span className="col-span-2">Action</span><span className="col-span-2">Entity</span><span className="col-span-1">Severity</span><span className="col-span-2">IP</span><span className="col-span-1"></span>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {filtered.length===0?<div className="text-center py-10 text-sm text-zinc-600">No audit logs found</div>:
            filtered.map(log=>{
              const cfg=SEVERITY_CFG[log.severity]??SEVERITY_CFG.info;
              const Icon=cfg.icon;
              const isExp=expanded===log.id;
              return(
                <div key={log.id} className="hover:bg-white/[0.02] transition">
                  <div className="grid grid-cols-12 gap-3 px-4 py-3 items-center cursor-pointer" onClick={()=>setExpanded(isExp?null:log.id)}>
                    <span className="col-span-2 text-[11px] text-zinc-500 font-mono">{fmt(log.created_at)}</span>
                    <span className="col-span-2 text-xs text-white truncate">{log.user_name??log.user_id??"system"}</span>
                    <span className="col-span-2 text-xs text-zinc-300 font-medium">{log.action}</span>
                    <span className="col-span-2 text-xs text-zinc-500 truncate">{log.entity_type??"-"}{log.entity_id?` #${log.entity_id.slice(0,8)}`:""}</span>
                    <span className="col-span-1">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${cfg.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}/>{log.severity}
                      </span>
                    </span>
                    <span className="col-span-2 text-[11px] text-zinc-600 font-mono truncate">{log.ip_address??"-"}</span>
                    <span className="col-span-1 flex justify-end">{isExp?<ChevronDown size={13} className="text-zinc-600 rotate-180"/>:<ChevronDown size={13} className="text-zinc-600"/>}</span>
                  </div>
                  {isExp&&log.metadata&&(
                    <div className="px-4 pb-4">
                      <pre className="bg-zinc-800 rounded-xl px-4 py-3 text-[11px] text-zinc-300 font-mono overflow-x-auto">{JSON.stringify(log.metadata,null,2)}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-zinc-600">
        <span>{filtered.length} entries shown</span>
        <div className="flex gap-2">
          <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} className="px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 disabled:opacity-40 transition">Previous</button>
          <span className="px-3 py-1.5">Page {page+1}</span>
          <button onClick={()=>setPage(p=>p+1)} disabled={logs.length<PAGE_SIZE} className="px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 disabled:opacity-40 transition">Next</button>
        </div>
      </div>
    </div>
  );
}