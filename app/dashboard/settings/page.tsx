"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/lib/hooks/useTenant";
import { Settings, Bell, Shield, Workflow, Brain, MapPin, Save, Loader2, CheckCircle2, Building2, Plug, Clock } from "lucide-react";

interface WorkspaceSettings {
  id:string; tenant_id:string;
  org_name:string|null; org_timezone:string|null; org_departments:string[]|null;
  notifications_enabled:boolean; ai_enabled:boolean; onboarding_automation:boolean;
  workflow_escalation:boolean; xavier_suggestions:boolean; xavier_auto_routing:boolean;
  xavier_memory:boolean; mfa_required:boolean; audit_logs_enabled:boolean;
  geo_tagging_enabled:boolean; paid_breaks:boolean; overtime_enabled:boolean;
}

const TIMEZONES=["Africa/Lagos","America/New_York","America/Chicago","America/Los_Angeles","Europe/London","Europe/Paris","Asia/Dubai","Asia/Kolkata","Australia/Sydney"];

function Toggle({value,onChange,disabled}:{value:boolean;onChange:(v:boolean)=>void;disabled?:boolean}){
  return(
    <button onClick={()=>!disabled&&onChange(!value)} disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 disabled:opacity-40 ${value?"bg-emerald-500":"bg-zinc-700"}`}>
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${value?"translate-x-6":"translate-x-1"}`}/>
    </button>
  );
}

function Section({icon:Icon,title,children}:{icon:any;title:string;children:React.ReactNode}){
  return(
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center"><Icon size={15} className="text-indigo-400"/></div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function ToggleRow({label,sub,value,onChange,disabled}:{label:string;sub?:string;value:boolean;onChange:(v:boolean)=>void;disabled?:boolean}){
  return(
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0"><p className="text-sm text-white">{label}</p>{sub&&<p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}</div>
      <Toggle value={value} onChange={onChange} disabled={disabled}/>
    </div>
  );
}

export default function SettingsPage(){
  const {tenantId}=useTenant();
  const [settings,setSettings]=useState<WorkspaceSettings|null>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [depts,setDepts]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);
    const {data}=await supabase.from("workspace_settings").select("*").eq("tenant_id",tenantId).maybeSingle();
    if(data){
      setSettings(data as WorkspaceSettings);
      setDepts((data.org_departments??[]).join(", "));
    } else {
      // Create default row
      const defaults:Partial<WorkspaceSettings>={
        tenant_id:tenantId, org_name:"PivotOps", org_timezone:"Africa/Lagos",
        org_departments:["Recruitment","Operations","Compliance","HR","Finance"],
        notifications_enabled:true, ai_enabled:true, onboarding_automation:true,
        workflow_escalation:true, xavier_suggestions:true, xavier_auto_routing:true,
        xavier_memory:true, mfa_required:false, audit_logs_enabled:true, geo_tagging_enabled:false, paid_breaks:false, overtime_enabled:true,
      };
      const {data:created}=await supabase.from("workspace_settings").insert(defaults).select().single();
      if(created){ setSettings(created as WorkspaceSettings); setDepts((created.org_departments??[]).join(", ")); }
    }
    setLoading(false);
  },[tenantId]);

  useEffect(()=>{load();},[load]);

  const set=(key:keyof WorkspaceSettings,val:any)=>{
    setSettings(p=>p?{...p,[key]:val}:p);
  };

  const save=async()=>{
    if(!settings) return;
    setSaving(true);
    const payload={...settings, org_departments:depts.split(",").map(d=>d.trim()).filter(Boolean), updated_at:new Date().toISOString()};
    await supabase.from("workspace_settings").update(payload).eq("id",settings.id);
    setSaving(false); setSaved(true);
    setTimeout(()=>setSaved(false),3000);
  };

  if(loading) return <div className="flex items-center justify-center h-64 text-zinc-500 gap-2"><Loader2 size={16} className="animate-spin"/>Loading settings...</div>;
  if(!settings) return <div className="flex items-center justify-center h-64 text-red-400 text-sm">Failed to load settings</div>;

  return(
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white">Settings</h1><p className="text-zinc-500 text-sm mt-0.5">Configure your PivotOps workspace</p></div>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition disabled:opacity-50">
          {saving?<Loader2 size={14} className="animate-spin"/>:saved?<CheckCircle2 size={14}/>:<Save size={14}/>}
          {saving?"Saving...":saved?"Saved!":"Save Changes"}
        </button>
      </div>

      <Section icon={Building2} title="Organisation">
        <div><label className="text-xs text-zinc-500 mb-1.5 block">Organisation Name</label>
          <input value={settings.org_name??""} onChange={e=>set("org_name",e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-600 transition"/></div>
        <div><label className="text-xs text-zinc-500 mb-1.5 block">Timezone</label>
          <select value={settings.org_timezone??""} onChange={e=>set("org_timezone",e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none cursor-pointer">
            {TIMEZONES.map(tz=><option key={tz} value={tz} className="bg-zinc-900">{tz}</option>)}
          </select></div>
        <div><label className="text-xs text-zinc-500 mb-1.5 block">Departments (comma separated)</label>
          <input value={depts} onChange={e=>setDepts(e.target.value)} placeholder="e.g. HR, Finance, Operations" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-600 transition"/></div>
      </Section>

      <Section icon={Bell} title="Notifications">
        <ToggleRow label="Enable Notifications" sub="Push and in-app notifications for all events" value={settings.notifications_enabled} onChange={v=>set("notifications_enabled",v)}/>
        <ToggleRow label="Audit Logs" sub="Record all user actions to the audit log" value={settings.audit_logs_enabled} onChange={v=>set("audit_logs_enabled",v)}/>
        <ToggleRow label="Workflow Escalation Alerts" sub="Notify when workflows escalate or fail" value={settings.workflow_escalation} onChange={v=>set("workflow_escalation",v)}/>
      </Section>

      <Section icon={MapPin} title="Clocking & Geo Tagging">
        <ToggleRow
          label="Overtime Tracking"
          sub="Overtime starts the moment a scheduled shift ends, on any day of the week. Turn off if this organisation does not track overtime."
          value={settings.overtime_enabled}
          onChange={v=>set("overtime_enabled",v)}
        />
        {settings.overtime_enabled&&(
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-zinc-800/40 border border-zinc-700/50 text-xs text-zinc-400">
            <Clock size={12} className="flex-shrink-0 mt-0.5"/>
            <span>
              Measured against each employee&apos;s rostered window in Schedules, so a rostered
              weekend shift counts as regular hours. Time worked with no schedule is recorded as overtime.
            </span>
          </div>
        )}
        <ToggleRow
          label="Paid Breaks"
          sub="On: break time counts toward worked hours and payroll totals. Off: breaks are deducted from the shift. Breaks are recorded either way."
          value={settings.paid_breaks}
          onChange={v=>set("paid_breaks",v)}
        />
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-zinc-800/40 border border-zinc-700/50 text-xs text-zinc-400">
          <Clock size={12} className="flex-shrink-0 mt-0.5"/>
          <span>
            Hours are recalculated from clocking logs, so changing this updates historical
            timesheets and Xavier fatigue figures as well as future ones.
          </span>
        </div>
        <ToggleRow
          label="Enable Geo Tagging"
          sub="Capture GPS coordinates and reverse-geocoded address when employees clock in and out. Requires browser location permission."
          value={settings.geo_tagging_enabled}
          onChange={v=>set("geo_tagging_enabled",v)}
        />
        {settings.geo_tagging_enabled&&(
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400">
            <MapPin size={12} className="flex-shrink-0 mt-0.5"/>
            <span>Geo tagging is active. Employees will be prompted for location permission when clocking in or out. Location data is stored securely and only accessible to authorised managers.</span>
          </div>
        )}
      </Section>

      <Section icon={Shield} title="Security & Access">
        <ToggleRow label="Require MFA" sub="Enforce multi-factor authentication for all users" value={settings.mfa_required} onChange={v=>set("mfa_required",v)}/>
      </Section>

      <Section icon={Brain} title="Xavier AI">
        <ToggleRow label="Xavier AI Engine" sub="Enable the Xavier AI scoring and routing engine" value={settings.ai_enabled} onChange={v=>set("ai_enabled",v)}/>
        <ToggleRow label="Auto-Routing" sub="Automatically route candidates based on AI score" value={settings.xavier_auto_routing} onChange={v=>set("xavier_auto_routing",v)} disabled={!settings.ai_enabled}/>
        <ToggleRow label="Suggestions" sub="Surface Xavier insights across the dashboard" value={settings.xavier_suggestions} onChange={v=>set("xavier_suggestions",v)} disabled={!settings.ai_enabled}/>
        <ToggleRow label="Memory Mode" sub="Xavier learns from your hiring decisions over time" value={settings.xavier_memory} onChange={v=>set("xavier_memory",v)} disabled={!settings.ai_enabled}/>
      </Section>

      <Section icon={Plug} title="Integrations">
        <a href="/dashboard/settings/integrations"
           className="flex items-center justify-between px-4 py-3 rounded-xl border border-zinc-800
                      hover:border-zinc-700 transition group">
          <div>
            <p className="text-sm text-white font-medium">SHOPLINE</p>
            <p className="text-xs text-zinc-500 mt-0.5">Connect a SHOPLINE store to PivotOps</p>
          </div>
          <span className="text-xs text-indigo-400 group-hover:text-indigo-300">Manage &rarr;</span>
        </a>
      </Section>

      <Section icon={Workflow} title="Automation">
        <ToggleRow label="Onboarding Automation" sub="Trigger onboarding workflows on candidate acceptance" value={settings.onboarding_automation} onChange={v=>set("onboarding_automation",v)}/>
      </Section>
    </div>
  );
}