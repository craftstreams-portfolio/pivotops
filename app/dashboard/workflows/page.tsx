"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/lib/hooks/useTenant";
import { FeatureGate } from "@/app/components/FeatureGate";
import { Workflow, Plus, Play, Pause, Trash2, CheckCircle2, XCircle, Clock, Loader2, RefreshCw, Zap, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

interface WorkflowRow { id:string; name:string; description:string|null; status:string; trigger:string|null; steps:any[]; run_count:number; last_run_at:string|null; created_at:string; created_by:string|null; }
interface WorkflowRun  { id:string; workflow_id:string; status:string; started_at:string|null; completed_at:string|null; error:string|null; triggered_by:string|null; }

const TRIGGERS = ["application_received","candidate_scored","offer_accepted","onboarding_triggered","compliance_submitted","incident_created","manual"];
const STATUS_CFG: Record<string,{cls:string;icon:any}> = {
  active:   {cls:"text-emerald-400 border-emerald-500/20 bg-emerald-500/10", icon:CheckCircle2},
  inactive: {cls:"text-zinc-500 border-zinc-700 bg-zinc-800",               icon:Pause},
  error:    {cls:"text-red-400 border-red-500/20 bg-red-500/10",            icon:XCircle},
  running:  {cls:"text-blue-400 border-blue-500/20 bg-blue-500/10",         icon:Loader2},
};
function fmt(iso:string|null){if(!iso)return"—";return new Date(iso).toLocaleString([],{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});}

function WorkflowsPageInner(){
  const {tenantId}=useTenant();
  const [workflows,setWorkflows]=useState<WorkflowRow[]>([]);
  const [runs,setRuns]=useState<WorkflowRun[]>([]);
  const [loading,setLoading]=useState(true);
  const [expanded,setExpanded]=useState<string|null>(null);
  const [showNew,setShowNew]=useState(false);
  const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({name:"",description:"",trigger:"manual",steps:"[\n  {\"action\":\"notify\",\"target\":\"recruiter\",\"message\":\"New event triggered\"}\n]"});
  const [formErr,setFormErr]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);
    const [{data:wf},{data:wr}]=await Promise.all([
      supabase.from("workflows").select("*").eq("tenant_id",tenantId).order("created_at",{ascending:false}),
      supabase.from("workflow_runs").select("*").eq("tenant_id",tenantId).order("started_at",{ascending:false}).limit(100),
    ]);
    setWorkflows((wf??[]) as WorkflowRow[]);
    setRuns((wr??[]) as WorkflowRun[]);
    setLoading(false);
  },[tenantId]);

  useEffect(()=>{load();},[load]);

  const toggleStatus=async(wf:WorkflowRow)=>{
    const next=wf.status==="active"?"inactive":"active";
    await supabase.from("workflows").update({status:next,updated_at:new Date().toISOString()}).eq("id",wf.id);
    setWorkflows(p=>p.map(w=>w.id===wf.id?{...w,status:next}:w));
  };

  const runNow=async(wf:WorkflowRow)=>{
    const now=new Date().toISOString();
    const {data}=await supabase.from("workflow_runs").insert({workflow_id:wf.id,tenant_id:tenantId,status:"running",started_at:now,triggered_by:"manual"}).select().single();
    if(data) setRuns(p=>[data as WorkflowRun,...p]);
    await supabase.from("workflows").update({run_count:(wf.run_count??0)+1,last_run_at:now,updated_at:now}).eq("id",wf.id);
    setWorkflows(p=>p.map(w=>w.id===wf.id?{...w,run_count:(w.run_count??0)+1,last_run_at:now}:w));
    setTimeout(async()=>{
      await supabase.from("workflow_runs").update({status:"completed",completed_at:new Date().toISOString()}).eq("id",data?.id);
      setRuns(p=>p.map(r=>r.id===data?.id?{...r,status:"completed",completed_at:new Date().toISOString()}:r));
    },2000);
  };

  const deleteWf=async(id:string)=>{
    await supabase.from("workflows").delete().eq("id",id);
    setWorkflows(p=>p.filter(w=>w.id!==id));
  };

  const createWf=async()=>{
    setFormErr("");
    if(!form.name.trim()){setFormErr("Name is required");return;}
    let steps:any[];
    try{steps=JSON.parse(form.steps);}catch{setFormErr("Steps must be valid JSON");return;}
    setSaving(true);
    const {data,error}=await supabase.from("workflows").insert({
      tenant_id:tenantId,name:form.name.trim(),description:form.description.trim()||null,
      status:"active",trigger:form.trigger,steps,run_count:0,
      created_at:new Date().toISOString(),updated_at:new Date().toISOString(),
    }).select().single();
    setSaving(false);
    if(error){setFormErr(error.message);return;}
    setWorkflows(p=>[data as WorkflowRow,...p]);
    setShowNew(false);
    setForm({name:"",description:"",trigger:"manual",steps:"[\n  {\"action\":\"notify\",\"target\":\"recruiter\",\"message\":\"New event triggered\"}\n]"});
  };

  const active=workflows.filter(w=>w.status==="active").length;
  const totalRuns=runs.length;
  const failed=runs.filter(r=>r.status==="error").length;

  return(
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-white">Workflows</h1><p className="text-zinc-500 text-sm mt-0.5">Automated workforce event pipelines</p></div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-800 text-xs text-zinc-400 hover:text-white transition"><RefreshCw size={12}/> Refresh</button>
          <button onClick={()=>setShowNew(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition"><Plus size={14}/> New Workflow</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[{label:"Total",value:workflows.length,color:"text-white"},{label:"Active",value:active,color:"text-emerald-400"},{label:"Total Runs",value:totalRuns,color:"text-indigo-400"},{label:"Failed Runs",value:failed,color:failed>0?"text-red-400":"text-zinc-500"}].map(({label,value,color})=>(
          <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {loading?<div className="flex items-center justify-center h-32 text-zinc-500 gap-2"><Loader2 size={16} className="animate-spin"/>Loading workflows...</div>:(
        <div className="space-y-3">
          {workflows.length===0&&<div className="border border-dashed border-zinc-800 rounded-xl p-10 text-center text-sm text-zinc-600"><Workflow size={28} className="mx-auto mb-3 opacity-30"/>No workflows yet. Create one above.</div>}
          {workflows.map(wf=>{
            const cfg=STATUS_CFG[wf.status]??STATUS_CFG.inactive;
            const Icon=cfg.icon;
            const wfRuns=runs.filter(r=>r.workflow_id===wf.id).slice(0,5);
            const isExp=expanded===wf.id;
            return(
              <div key={wf.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/[0.02] transition" onClick={()=>setExpanded(isExp?null:wf.id)}>
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0"><Workflow size={16} className="text-indigo-400"/></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{wf.name}</p>
                    <p className="text-xs text-zinc-500 truncate">{wf.description||"No description"}</p>
                  </div>
                  <div className="hidden md:flex items-center gap-4 text-xs text-zinc-600">
                    <span className="flex items-center gap-1"><Zap size={11}/>{wf.run_count??0} runs</span>
                    <span className="flex items-center gap-1"><Clock size={11}/>{fmt(wf.last_run_at)}</span>
                    <span className="text-zinc-700">Trigger: {wf.trigger??"manual"}</span>
                  </div>
                  <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium flex items-center gap-1 ${cfg.cls}`}><Icon size={10} className={wf.status==="running"?"animate-spin":""}/>{wf.status}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>runNow(wf)} className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-indigo-500/20 flex items-center justify-center transition" title="Run now"><Play size={13} className="text-zinc-400 hover:text-indigo-400"/></button>
                    <button onClick={()=>toggleStatus(wf)} className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-amber-500/20 flex items-center justify-center transition"><Pause size={13} className="text-zinc-400 hover:text-amber-400"/></button>
                    <button onClick={()=>deleteWf(wf.id)} className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-red-500/10 flex items-center justify-center transition"><Trash2 size={13} className="text-zinc-500 hover:text-red-400"/></button>
                  </div>
                  {isExp?<ChevronUp size={14} className="text-zinc-600 flex-shrink-0"/>:<ChevronDown size={14} className="text-zinc-600 flex-shrink-0"/>}
                </div>
                {isExp&&(
                  <div className="border-t border-zinc-800 px-5 py-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Steps ({wf.steps?.length??0})</p>
                        <div className="space-y-1.5">
                          {(wf.steps??[]).map((s:any,i:number)=>(
                            <div key={i} className="flex items-center gap-2 text-xs bg-zinc-800 rounded-lg px-3 py-2">
                              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{i+1}</span>
                              <span className="text-zinc-300">{s.action}</span>
                              {s.target&&<span className="text-zinc-600">→ {s.target}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div><p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Recent Runs</p>
                        <div className="space-y-1.5">
                          {wfRuns.length===0?<p className="text-xs text-zinc-700">No runs yet</p>:wfRuns.map(r=>(
                            <div key={r.id} className="flex items-center justify-between text-xs bg-zinc-800 rounded-lg px-3 py-2">
                              <span className={r.status==="completed"?"text-emerald-400":r.status==="error"?"text-red-400":"text-blue-400"}>{r.status}</span>
                              <span className="text-zinc-600">{fmt(r.started_at)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showNew&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-6">
          <div className="w-full max-w-lg mx-4 rounded-2xl border border-zinc-800 bg-[#0f0f1a] p-6 space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-white">New Workflow</h2><button onClick={()=>setShowNew(false)} className="text-zinc-500 hover:text-white"><XCircle size={18}/></button></div>
            {[{label:"Name *",key:"name",placeholder:"e.g. Auto-notify on high score"},{label:"Description",key:"description",placeholder:"What does this workflow do?"}].map(({label,key,placeholder})=>(
              <div key={key}><label className="text-xs text-zinc-500 mb-1.5 block">{label}</label>
                <input value={(form as any)[key]} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} placeholder={placeholder} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition"/>
              </div>
            ))}
            <div><label className="text-xs text-zinc-500 mb-1.5 block">Trigger Event</label>
              <select value={form.trigger} onChange={e=>setForm(p=>({...p,trigger:e.target.value}))} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none cursor-pointer">
                {TRIGGERS.map(t=><option key={t} value={t} className="bg-zinc-900">{t}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-zinc-500 mb-1.5 block">Steps (JSON)</label>
              <textarea value={form.steps} onChange={e=>setForm(p=>({...p,steps:e.target.value}))} rows={5} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition font-mono resize-none"/>
            </div>
            {formErr&&<p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{formErr}</p>}
            <div className="flex gap-3"><button onClick={()=>setShowNew(false)} className="flex-1 py-2.5 rounded-xl border border-zinc-800 text-sm text-zinc-400 hover:text-white transition">Cancel</button>
              <button onClick={createWf} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition disabled:opacity-50">{saving?<Loader2 size={14} className="animate-spin mx-auto"/>:"Create Workflow"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default function WorkflowsPage() {
  const { tenantId } = useTenant();
  return (
    <FeatureGate tenantId={tenantId} feature="workflows" title="Workflows">
      <WorkflowsPageInner />
    </FeatureGate>
  );
}