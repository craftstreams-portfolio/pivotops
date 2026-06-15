"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/lib/hooks/useTenant";
import { ShieldCheck, AlertTriangle, XCircle, CheckCircle2, Clock, Search, RefreshCw, Download, Loader2, X } from "lucide-react";

interface ComplianceDoc { id:string; candidate_id:string|null; employee_name:string; name:string; status:string; file_url:string|null; reviewed_by_name:string|null; reviewed_at:string|null; submitted_at:string|null; rejection_reason:string|null; updated_at:string; }

const STATUS_CFG: Record<string,{cls:string;icon:any;label:string}> = {
  approved: {cls:"text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon:CheckCircle2, label:"Approved"},
  pending:  {cls:"text-amber-400 bg-amber-500/10 border-amber-500/20",       icon:Clock,        label:"Pending"},
  uploaded: {cls:"text-blue-400 bg-blue-500/10 border-blue-500/20",          icon:Clock,        label:"Under Review"},
  rejected: {cls:"text-red-400 bg-red-500/10 border-red-500/20",             icon:XCircle,      label:"Rejected"},
  expired:  {cls:"text-orange-400 bg-orange-500/10 border-orange-500/20",    icon:AlertTriangle,label:"Expired"},
};

function fmt(iso:string|null){if(!iso)return"—";return new Date(iso).toLocaleDateString([],{month:"short",day:"numeric",year:"numeric"});}

export default function ComplianceStatusPage(){
  const {tenantId}=useTenant();
  const [docs,setDocs]=useState<ComplianceDoc[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("all");

  const load=useCallback(async()=>{
    setLoading(true);
    const {data}=await supabase.from("compliance_docs").select("*").eq("tenant_id",tenantId).order("updated_at",{ascending:false});
    setDocs((data??[]) as ComplianceDoc[]);
    setLoading(false);
  },[tenantId]);

  useEffect(()=>{load();},[load]);

  useEffect(()=>{
    const ch=supabase.channel("compliance-status-live")
      .on("postgres_changes",{event:"*",schema:"public",table:"compliance_docs"},()=>load()).subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[load]);

  const grouped=useCallback(()=>{
    const map: Record<string,ComplianceDoc[]>={};
    docs.forEach(d=>{
      const key=d.employee_name||d.candidate_id||"Unknown";
      if(!map[key]) map[key]=[];
      map[key].push(d);
    });
    return map;
  },[docs]);

  const exportCSV=()=>{
    const rows=[["Employee","Document","Status","Submitted","Reviewed By","Reviewed At"].join(","),
      ...docs.map(d=>[d.employee_name,d.name,d.status,fmt(d.submitted_at),d.reviewed_by_name??"",fmt(d.reviewed_at)].map(v=>`"${v}"`).join(","))
    ];
    const blob=new Blob([rows.join("\n")],{type:"text/csv"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`compliance-status-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  const total=docs.length;
  const approved=docs.filter(d=>d.status==="approved").length;
  const pending=docs.filter(d=>d.status==="pending"||d.status==="uploaded").length;
  const rejected=docs.filter(d=>d.status==="rejected"||d.status==="expired").length;
  const rate=total>0?Math.round((approved/total)*100):0;

  const groupedDocs=grouped();
  const employees=Object.keys(groupedDocs).filter(name=>{
    if(!search) return true;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return(
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-white">Compliance Status</h1><p className="text-zinc-500 text-sm mt-0.5">Document verification across all candidates and employees</p></div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-800 text-xs text-zinc-400 hover:text-white transition"><RefreshCw size={12}/> Refresh</button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-800 text-xs text-zinc-400 hover:text-white transition"><Download size={12}/> Export</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[{label:"Total Documents",value:total,color:"text-white"},{label:"Approved",value:approved,color:"text-emerald-400"},{label:"Pending Review",value:pending,color:"text-amber-400"},{label:"Rejected / Expired",value:rejected,color:"text-red-400"}].map(({label,value,color})=>(
          <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><ShieldCheck size={15} className="text-emerald-400"/><span className="text-sm font-semibold text-white">Overall Compliance Rate</span></div>
          <span className={`text-xl font-bold ${rate>=80?"text-emerald-400":rate>=60?"text-amber-400":"text-red-400"}`}>{rate}%</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-1000 ${rate>=80?"bg-emerald-500":rate>=60?"bg-amber-500":"bg-red-500"}`} style={{width:`${rate}%`}}/>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-48 flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5">
          <Search size={14} className="text-zinc-600 flex-shrink-0"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by employee name..." className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none"/>
          {search&&<button onClick={()=>setSearch("")} className="text-zinc-600 hover:text-white"><X size={14}/></button>}
        </div>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none cursor-pointer">
          <option value="all">All statuses</option>
          {Object.keys(STATUS_CFG).map(s=><option key={s} value={s} className="bg-zinc-900">{STATUS_CFG[s].label}</option>)}
        </select>
      </div>

      {loading?<div className="flex items-center justify-center h-32 text-zinc-500 gap-2"><Loader2 size={16} className="animate-spin"/>Loading compliance data...</div>:(
        <div className="space-y-3">
          {employees.length===0?<div className="border border-dashed border-zinc-800 rounded-xl p-10 text-center text-sm text-zinc-600">No compliance records found</div>:
          employees.map(name=>{
            const empDocs=groupedDocs[name].filter(d=>statusFilter==="all"||d.status===statusFilter);
            if(empDocs.length===0) return null;
            const empApproved=empDocs.filter(d=>d.status==="approved").length;
            const empPct=empDocs.length>0?Math.round((empApproved/empDocs.length)*100):0;
            return(
              <div key={name} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-sm flex-shrink-0">{name[0]?.toUpperCase()}</div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-white">{name}</p><p className="text-xs text-zinc-500">{empDocs.length} documents · {empApproved} approved</p></div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-lg font-bold ${empPct>=80?"text-emerald-400":empPct>=60?"text-amber-400":"text-red-400"}`}>{empPct}%</p>
                    <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-1"><div className={`h-full rounded-full ${empPct>=80?"bg-emerald-500":empPct>=60?"bg-amber-500":"bg-red-500"}`} style={{width:`${empPct}%`}}/></div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {empDocs.map(d=>{
                    const cfg=STATUS_CFG[d.status]??STATUS_CFG.pending;
                    const Icon=cfg.icon;
                    return(
                      <div key={d.id} className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border ${cfg.cls}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon size={12} className="flex-shrink-0"/>
                          <span className="text-xs font-medium truncate">{d.name}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-[10px] font-semibold">{cfg.label}</span>
                          {d.file_url&&<a href={d.file_url} target="_blank" rel="noreferrer" className="block text-[10px] text-zinc-500 hover:text-white underline mt-0.5">View</a>}
                          {d.rejection_reason&&<p className="text-[10px] text-red-400/70 mt-0.5 max-w-[120px] truncate">{d.rejection_reason}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}