"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Folder, FolderOpen, FileText, Plus, Upload, Download,
  Trash2, Edit2, Check, X, Loader2, Shield, ChevronRight,
  File, Save, AlertCircle, Eye, MoreHorizontal
} from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BUCKET = "admin-documents";
const TENANT = "default";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Folder {
  id:          string;
  tenant_id:   string;
  name:        string;
  description: string | null;
  color:       string | null;
  icon:        string | null;
  parent_id:   string | null;
  sort_order:  number;
  created_at:  string;
  updated_at:  string;
  children?:   Folder[];
  files?:      DocFile[];
}

interface DocFile {
  id:         string;
  folder_id:  string;
  tenant_id:  string;
  name:       string;
  file_url:   string | null;
  file_name:  string | null;
  file_size:  number | null;
  file_type:  string | null;
  version:    number;
  status:     "draft" | "active" | "archived";
  created_at: string;
  updated_at: string;
}

// ── Retry ─────────────────────────────────────────────────────────────────────
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 400 * Math.pow(2, i)));
    }
  }
  throw new Error("Max retries exceeded");
}

function formatSize(b: number | null) {
  if (!b) return "";
  return b > 1024*1024 ? `${(b/1024/1024).toFixed(1)}MB` : `${(b/1024).toFixed(0)}KB`;
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
}

const FOLDER_COLORS = ["#6366f1","#22c55e","#f59e0b","#ef4444","#ec4899","#14b8a6","#8b5cf6","#f97316"];

// ── File row ──────────────────────────────────────────────────────────────────
function FileRow({ file, folderId, onUpdate, onDelete }: {
  file:     DocFile;
  folderId: string;
  onUpdate: (f: DocFile) => void;
  onDelete: (id: string) => void;
}) {
  const [editing,   setEditing]   = useState(false);
  const [name,      setName]      = useState(file.name);
  const [uploading, setUploading] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [viewing,   setViewing]   = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const saveName = async () => {
    if (!name.trim() || name === file.name) { setEditing(false); return; }
    setSaving(true);
    await withRetry(async () => {
      const { data, error } = await supabase.from("admin_doc_files")
        .update({ name: name.trim(), updated_at: new Date().toISOString() })
        .eq("id", file.id).select().single();
      if (error) throw error;
      onUpdate(data as DocFile);
    });
    setSaving(false);
    setEditing(false);
  };

  const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const ext  = f.name.split(".").pop();
      const path = `${TENANT}/${folderId}/${file.id}_v${file.version+1}.${ext}`;
      await withRetry(async () => {
        const { error } = await supabase.storage.from(BUCKET).upload(path, f, { upsert: true });
        if (error) throw error;
      });
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const { data, error } = await supabase.from("admin_doc_files")
        .update({ file_url: urlData.publicUrl, file_name: f.name, file_size: f.size,
                  file_type: f.type, version: file.version+1, status: "active",
                  updated_at: new Date().toISOString() })
        .eq("id", file.id).select().single();
      if (error) throw error;
      onUpdate(data as DocFile);
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const deleteFile = async () => {
    await withRetry(async () => {
      const { error } = await supabase.from("admin_doc_files").delete().eq("id", file.id);
      if (error) throw error;
      onDelete(file.id);
    });
    setMenuOpen(false);
  };

  const statusColor = file.status === "active" ? "#22c55e" : file.status === "archived" ? "#94a3b8" : "#f59e0b";

  return (
    <>
      {viewing && file.file_url && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", zIndex:50, display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"12px 16px", background:"#0d1117", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", justifyContent:"space-between" }}>
            <span style={{ color:"#fff", fontSize:13 }}>{file.file_name ?? file.name}</span>
            <button onClick={() => setViewing(false)} style={{ color:"rgba(255,255,255,0.5)", background:"none", border:"none", cursor:"pointer", fontSize:20 }}>×</button>
          </div>
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
            {file.file_url.match(/\.(jpg|jpeg|png|webp)$/i)
              ? <img src={file.file_url} alt={file.name} style={{ maxWidth:"90%", maxHeight:"80vh", borderRadius:8 }} />
              : <iframe src={file.file_url} title={file.name} style={{ width:"90%", height:"80vh", borderRadius:8, border:"none", background:"#fff" }} />
            }
          </div>
        </div>
      )}

      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", background:"rgba(255,255,255,0.02)", borderRadius:6, border:"1px solid rgba(255,255,255,0.05)", marginBottom:4 }}>
        <File size={14} color="rgba(255,255,255,0.4)" style={{ flexShrink:0 }} />

        {editing ? (
          <div style={{ flex:1, display:"flex", gap:6 }}>
            <input value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => { if(e.key==="Enter") saveName(); if(e.key==="Escape") setEditing(false); }}
              autoFocus style={{ flex:1, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:6, padding:"4px 8px", color:"#fff", fontSize:13, outline:"none" }} />
            <button onClick={saveName} disabled={saving} style={{ color:"#22c55e", background:"none", border:"none", cursor:"pointer" }}>
              {saving ? <Loader2 size={13} style={{ animation:"spin 1s linear infinite" }} /> : <Check size={13} />}
            </button>
            <button onClick={() => setEditing(false)} style={{ color:"rgba(255,255,255,0.4)", background:"none", border:"none", cursor:"pointer" }}><X size={13} /></button>
          </div>
        ) : (
          <div style={{ flex:1, minWidth:0 }}>
            <span style={{ fontSize:13, color:"rgba(255,255,255,0.8)" }}>{file.name}</span>
            <span style={{ fontSize:10, marginLeft:8, color:statusColor }}>v{file.version} · {file.status}</span>
            {file.file_name && <span style={{ fontSize:11, color:"rgba(255,255,255,0.25)", marginLeft:8 }}>{file.file_name} {formatSize(file.file_size) && `· ${formatSize(file.file_size)}`}</span>}
          </div>
        )}

        <div style={{ display:"flex", gap:4, flexShrink:0 }}>
          {file.file_url && (
            <button onClick={() => setViewing(true)} title="Preview" style={{ padding:"4px 8px", borderRadius:5, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"rgba(255,255,255,0.4)", cursor:"pointer" }}>
              <Eye size={12} />
            </button>
          )}
          {file.file_url && (
            <a href={file.file_url} download target="_blank" rel="noreferrer" title="Download" style={{ padding:"4px 8px", borderRadius:5, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"rgba(255,255,255,0.4)", cursor:"pointer", display:"flex", alignItems:"center" }}>
              <Download size={12} />
            </a>
          )}
          <button onClick={() => fileRef.current?.click()} title={file.file_url ? "Replace file" : "Upload file"} disabled={uploading}
            style={{ padding:"4px 8px", borderRadius:5, border:"1px solid rgba(99,102,241,0.3)", background:"rgba(99,102,241,0.1)", color:"#818cf8", cursor:"pointer", display:"flex", alignItems:"center", gap:4, fontSize:11 }}>
            {uploading ? <Loader2 size={12} style={{ animation:"spin 1s linear infinite" }} /> : <Upload size={12} />}
            {file.file_url ? "Replace" : "Upload"}
          </button>
          <button onClick={() => setEditing(true)} title="Rename" style={{ padding:"4px 8px", borderRadius:5, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"rgba(255,255,255,0.4)", cursor:"pointer" }}>
            <Edit2 size={12} />
          </button>
          <button onClick={deleteFile} title="Delete" style={{ padding:"4px 8px", borderRadius:5, border:"1px solid rgba(239,68,68,0.2)", background:"transparent", color:"rgba(239,68,68,0.6)", cursor:"pointer" }}>
            <Trash2 size={12} />
          </button>
        </div>
        <input ref={fileRef} type="file" className="hidden" style={{ display:"none" }}
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls"
          onChange={uploadFile} />
      </div>
    </>
  );
}

// ── Folder panel ──────────────────────────────────────────────────────────────
function FolderPanel({ folder, allFolders, depth, onUpdate, onDelete, onAddFile, onAddFolder, onFileUpdate, onFileDelete }: {
  folder:      Folder;
  allFolders:  Folder[];
  depth:       number;
  onUpdate:    (f: Folder) => void;
  onDelete:    (id: string) => void;
  onAddFile:   (folderId: string, file: DocFile) => void;
  onAddFolder: (f: Folder) => void;
  onFileUpdate:(folderId: string, file: DocFile) => void;
  onFileDelete:(folderId: string, fileId: string) => void;
}) {
  const [open,      setOpen]      = useState(depth === 0);
  const [editing,   setEditing]   = useState(false);
  const [name,      setName]      = useState(folder.name);
  const [saving,    setSaving]    = useState(false);
  const [addingFile,setAddingFile]= useState(false);
  const [newFileName,setNewFileName]= useState("");
  const [savingFile, setSavingFile]= useState(false);
  const [addingFolder,setAddingFolder]= useState(false);
  const [newFolderName,setNewFolderName]= useState("");
  const [savingFolder,setSavingFolder]= useState(false);
  const [colorPicker,setColorPicker]= useState(false);

  const color = folder.color ?? "#6366f1";
  const children = allFolders.filter(f => f.parent_id === folder.id);

  const saveName = async () => {
    if (!name.trim() || name === folder.name) { setEditing(false); return; }
    setSaving(true);
    await withRetry(async () => {
      const { data, error } = await supabase.from("admin_doc_folders")
        .update({ name: name.trim(), updated_at: new Date().toISOString() })
        .eq("id", folder.id).select().single();
      if (error) throw error;
      onUpdate(data as Folder);
    });
    setSaving(false);
    setEditing(false);
  };

  const addFile = async () => {
    if (!newFileName.trim()) return;
    setSavingFile(true);
    await withRetry(async () => {
      const { data, error } = await supabase.from("admin_doc_files")
        .insert({ folder_id: folder.id, tenant_id: TENANT, name: newFileName.trim(), status: "draft", version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .select().single();
      if (error) throw error;
      onAddFile(folder.id, data as DocFile);
    });
    setSavingFile(false);
    setNewFileName("");
    setAddingFile(false);
  };

  const addSubFolder = async () => {
    if (!newFolderName.trim()) return;
    setSavingFolder(true);
    await withRetry(async () => {
      const { data, error } = await supabase.from("admin_doc_folders")
        .insert({ tenant_id: TENANT, name: newFolderName.trim(), parent_id: folder.id, color, sort_order: children.length, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .select().single();
      if (error) throw error;
      onAddFolder(data as Folder);
    });
    setSavingFolder(false);
    setNewFolderName("");
    setAddingFolder(false);
  };

  const deleteFolder = async () => {
    if (!confirm(`Delete "${folder.name}" and all its contents?`)) return;
    await withRetry(async () => {
      const { error } = await supabase.from("admin_doc_folders").delete().eq("id", folder.id);
      if (error) throw error;
      onDelete(folder.id);
    });
  };

  const pl = depth * 20;

  return (
    <div style={{ marginBottom: depth === 0 ? 8 : 4 }}>
      {/* Folder header */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:`10px 12px 10px ${pl+12}px`, background: open ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)", borderRadius:8, border:"1px solid rgba(255,255,255,0.07)", cursor:"pointer", marginBottom: open ? 8 : 0 }}
        onClick={() => setOpen(o => !o)}>
        <ChevronRight size={14} color="rgba(255,255,255,0.3)" style={{ transform: open ? "rotate(90deg)" : "none", transition:"transform 0.2s", flexShrink:0 }} />
        {open ? <FolderOpen size={16} color={color} style={{ flexShrink:0 }} /> : <Folder size={16} color={color} style={{ flexShrink:0 }} />}

        {editing ? (
          <div style={{ flex:1, display:"flex", gap:6 }} onClick={e => e.stopPropagation()}>
            <input value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => { if(e.key==="Enter") saveName(); if(e.key==="Escape") setEditing(false); }}
              autoFocus style={{ flex:1, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:6, padding:"4px 8px", color:"#fff", fontSize:13, outline:"none" }} />
            <button onClick={saveName} disabled={saving} style={{ color:"#22c55e", background:"none", border:"none", cursor:"pointer" }}>
              {saving ? <Loader2 size={13} style={{ animation:"spin 1s linear infinite" }} /> : <Check size={13} />}
            </button>
            <button onClick={() => setEditing(false)} style={{ color:"rgba(255,255,255,0.4)", background:"none", border:"none", cursor:"pointer" }}><X size={13} /></button>
          </div>
        ) : (
          <span style={{ flex:1, fontSize:13, fontWeight:500, color:"rgba(255,255,255,0.85)" }}>{folder.name}</span>
        )}

        <div style={{ display:"flex", gap:4, flexShrink:0 }} onClick={e => e.stopPropagation()}>
          <span style={{ fontSize:10, color:"rgba(255,255,255,0.25)", marginRight:4 }}>
            {(folder.files?.length ?? 0)} file{(folder.files?.length ?? 0) !== 1 ? "s" : ""} · {children.length} folder{children.length !== 1 ? "s" : ""}
          </span>

          {/* Color picker */}
          <div style={{ position:"relative" }}>
            <button onClick={() => setColorPicker(c => !c)} title="Change color"
              style={{ width:16, height:16, borderRadius:"50%", background:color, border:"1px solid rgba(255,255,255,0.2)", cursor:"pointer" }} />
            {colorPicker && (
              <div style={{ position:"absolute", top:24, right:0, background:"#0d1117", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:8, display:"flex", gap:4, flexWrap:"wrap", width:100, zIndex:20 }}>
                {FOLDER_COLORS.map(c => (
                  <button key={c} onClick={async () => {
                    await supabase.from("admin_doc_folders").update({ color:c }).eq("id", folder.id);
                    onUpdate({ ...folder, color:c });
                    setColorPicker(false);
                  }} style={{ width:20, height:20, borderRadius:"50%", background:c, border: c===color ? "2px solid #fff" : "1px solid transparent", cursor:"pointer" }} />
                ))}
              </div>
            )}
          </div>

          <button onClick={() => { setEditing(true); setOpen(true); }} title="Rename"
            style={{ padding:"3px 6px", borderRadius:4, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"rgba(255,255,255,0.35)", cursor:"pointer" }}>
            <Edit2 size={11} />
          </button>
          <button onClick={() => { setAddingFile(true); setOpen(true); }} title="Add file"
            style={{ padding:"3px 6px", borderRadius:4, border:"1px solid rgba(99,102,241,0.3)", background:"rgba(99,102,241,0.1)", color:"#818cf8", cursor:"pointer" }}>
            <Plus size={11} />
          </button>
          <button onClick={() => { setAddingFolder(true); setOpen(true); }} title="Add subfolder"
            style={{ padding:"3px 6px", borderRadius:4, border:"1px solid rgba(99,102,241,0.3)", background:"rgba(99,102,241,0.08)", color:"#818cf8", cursor:"pointer" }}>
            <Folder size={11} />
          </button>
          <button onClick={deleteFolder} title="Delete folder"
            style={{ padding:"3px 6px", borderRadius:4, border:"1px solid rgba(239,68,68,0.2)", background:"transparent", color:"rgba(239,68,68,0.5)", cursor:"pointer" }}>
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {open && (
        <div style={{ paddingLeft: pl+28, marginTop:4 }}>

          {/* Files */}
          {(folder.files ?? []).map(f => (
            <FileRow key={f.id} file={f} folderId={folder.id}
              onUpdate={updated => onFileUpdate(folder.id, updated)}
              onDelete={fid => onFileDelete(folder.id, fid)} />
          ))}

          {/* Add file input */}
          {addingFile && (
            <div style={{ display:"flex", gap:6, marginBottom:6 }}>
              <input value={newFileName} onChange={e => setNewFileName(e.target.value)}
                onKeyDown={e => { if(e.key==="Enter") addFile(); if(e.key==="Escape") setAddingFile(false); }}
                placeholder="File name (e.g. Employment Contract)" autoFocus
                style={{ flex:1, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(99,102,241,0.4)", borderRadius:6, padding:"7px 10px", color:"#fff", fontSize:13, outline:"none" }} />
              <button onClick={addFile} disabled={!newFileName.trim() || savingFile}
                style={{ padding:"7px 12px", borderRadius:6, border:"none", background:"#6366f1", color:"#fff", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
                {savingFile ? <Loader2 size={12} style={{ animation:"spin 1s linear infinite" }} /> : <Save size={12} />}
                Save
              </button>
              <button onClick={() => setAddingFile(false)} style={{ padding:"7px 10px", borderRadius:6, border:"1px solid rgba(255,255,255,0.1)", background:"transparent", color:"rgba(255,255,255,0.4)", cursor:"pointer" }}><X size={13} /></button>
            </div>
          )}

          {/* Sub-folders */}
          {children.map(child => (
            <FolderPanel key={child.id} folder={{ ...child, files: child.files ?? [] }} allFolders={allFolders}
              depth={depth+1} onUpdate={onUpdate} onDelete={onDelete}
              onAddFile={onAddFile} onAddFolder={onAddFolder}
              onFileUpdate={onFileUpdate} onFileDelete={onFileDelete} />
          ))}

          {/* Add subfolder input */}
          {addingFolder && (
            <div style={{ display:"flex", gap:6, marginTop:4, paddingLeft:0 }}>
              <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if(e.key==="Enter") addSubFolder(); if(e.key==="Escape") setAddingFolder(false); }}
                placeholder="Subfolder name..." autoFocus
                style={{ flex:1, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(99,102,241,0.4)", borderRadius:6, padding:"7px 10px", color:"#fff", fontSize:13, outline:"none" }} />
              <button onClick={addSubFolder} disabled={!newFolderName.trim() || savingFolder}
                style={{ padding:"7px 12px", borderRadius:6, border:"none", background:"#6366f1", color:"#fff", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
                {savingFolder ? <Loader2 size={12} style={{ animation:"spin 1s linear infinite" }} /> : <Save size={12} />}
                Save
              </button>
              <button onClick={() => setAddingFolder(false)} style={{ padding:"7px 10px", borderRadius:6, border:"1px solid rgba(255,255,255,0.1)", background:"transparent", color:"rgba(255,255,255,0.4)", cursor:"pointer" }}><X size={13} /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main outgoing page ────────────────────────────────────────────────────────
export default function ComplianceOutgoingPage() {
  const [folders,     setFolders]     = useState<Folder[]>([]);
  const [fileMap,     setFileMap]     = useState<Record<string, DocFile[]>>({});
  const [loading,     setLoading]     = useState(true);
  const [addingRoot,  setAddingRoot]  = useState(false);
  const [newRootName, setNewRootName] = useState("");
  const [savingRoot,  setSavingRoot]  = useState(false);
  const [toast,       setToast]       = useState<string|null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // ── Load ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: foldersData }, { data: filesData }] = await Promise.all([
        supabase.from("admin_doc_folders").select("*").eq("tenant_id", TENANT).order("sort_order"),
        supabase.from("admin_doc_files").select("*").eq("tenant_id", TENANT).order("created_at"),
      ]);
      setFolders((foldersData ?? []) as Folder[]);
      const fm: Record<string, DocFile[]> = {};
      for (const f of (filesData ?? []) as DocFile[]) {
        if (!fm[f.folder_id]) fm[f.folder_id] = [];
        fm[f.folder_id].push(f);
      }
      setFileMap(fm);
    } catch (err) {
      console.error("Load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel("admin-docs-realtime")
      .on("postgres_changes", { event:"*", schema:"public", table:"admin_doc_folders" }, () => load())
      .on("postgres_changes", { event:"*", schema:"public", table:"admin_doc_files" },   () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  // ── Root folder operations ────────────────────────────────────────────────
  const addRootFolder = async () => {
    if (!newRootName.trim()) return;
    setSavingRoot(true);
    await withRetry(async () => {
      const { data, error } = await supabase.from("admin_doc_folders")
        .insert({ tenant_id:TENANT, name:newRootName.trim(), parent_id:null, sort_order:folders.filter(f=>!f.parent_id).length, color:"#6366f1", created_at:new Date().toISOString(), updated_at:new Date().toISOString() })
        .select().single();
      if (error) throw error;
      setFolders(prev => [...prev, data as Folder]);
      showToast(`Folder "${newRootName.trim()}" created`);
    });
    setSavingRoot(false);
    setNewRootName("");
    setAddingRoot(false);
  };

  const handleFolderUpdate  = (f: Folder)                    => setFolders(prev => prev.map(x => x.id===f.id ? f : x));
  const handleFolderDelete  = (id: string)                   => setFolders(prev => prev.filter(x => x.id!==id));
  const handleAddFolder     = (f: Folder)                    => setFolders(prev => [...prev, f]);
  const handleAddFile       = (fid: string, file: DocFile)   => setFileMap(prev => ({ ...prev, [fid]: [...(prev[fid]??[]), file] }));
  const handleFileUpdate    = (fid: string, file: DocFile)   => setFileMap(prev => ({ ...prev, [fid]: (prev[fid]??[]).map(f => f.id===file.id ? file : f) }));
  const handleFileDelete    = (fid: string, fileId: string)  => setFileMap(prev => ({ ...prev, [fid]: (prev[fid]??[]).filter(f => f.id!==fileId) }));

  const rootFolders = folders.filter(f => !f.parent_id);
  const totalFiles  = Object.values(fileMap).reduce((a,b) => a+b.length, 0);
  const activeFiles = Object.values(fileMap).flat().filter(f => f.status==="active").length;

  return (
    <div style={{ minHeight:"100vh", background:"#080810", color:"#fff", fontFamily:"system-ui,sans-serif" }}>
      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", top:20, right:20, background:"rgba(34,197,94,0.15)", border:"1px solid rgba(34,197,94,0.3)", borderRadius:8, padding:"10px 16px", color:"#4ade80", fontSize:13, zIndex:100, display:"flex", alignItems:"center", gap:6 }}>
          <Check size={13} /> {toast}
        </div>
      )}

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"32px 24px" }}>

        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
            <Shield size={18} color="#818cf8" />
            <span style={{ fontSize:12, color:"#818cf8", letterSpacing:"0.15em", textTransform:"uppercase", fontWeight:500 }}>Compliance · Admin Docs Console</span>
          </div>
          <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between" }}>
            <div>
              <h1 style={{ fontSize:24, fontWeight:600, margin:0 }}>Admin Docs Console</h1>
              <p style={{ color:"rgba(255,255,255,0.35)", fontSize:13, margin:"4px 0 0" }}>Outgoing documents · Manage folders and files · Auto-saves on every action</p>
            </div>
            <button onClick={() => setAddingRoot(true)}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 16px", borderRadius:8, border:"none", background:"#6366f1", color:"#fff", fontSize:13, fontWeight:500, cursor:"pointer" }}>
              <Plus size={15} /> New Folder
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:24 }}>
          {[
            { label:"Total Folders", val:folders.length,    color:"#818cf8" },
            { label:"Root Folders",  val:rootFolders.length, color:"#818cf8" },
            { label:"Total Files",   val:totalFiles,          color:"#f59e0b" },
            { label:"Active Files",  val:activeFiles,         color:"#22c55e" },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8, padding:"14px 16px" }}>
              <p style={{ fontSize:22, fontWeight:300, color, margin:0 }}>{val}</p>
              <p style={{ fontSize:10, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:"0.1em", margin:"2px 0 0" }}>{label}</p>
            </div>
          ))}
        </div>

        {/* New root folder input */}
        {addingRoot && (
          <div style={{ display:"flex", gap:8, marginBottom:16, padding:16, background:"rgba(99,102,241,0.06)", border:"1px solid rgba(99,102,241,0.2)", borderRadius:8 }}>
            <Folder size={16} color="#818cf8" style={{ marginTop:9, flexShrink:0 }} />
            <input value={newRootName} onChange={e => setNewRootName(e.target.value)}
              onKeyDown={e => { if(e.key==="Enter") addRootFolder(); if(e.key==="Escape") setAddingRoot(false); }}
              placeholder="New folder name (e.g. New Hire Packets, Compliance Records...)" autoFocus
              style={{ flex:1, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:6, padding:"9px 12px", color:"#fff", fontSize:14, outline:"none" }} />
            <button onClick={addRootFolder} disabled={!newRootName.trim() || savingRoot}
              style={{ padding:"9px 16px", borderRadius:6, border:"none", background:"#6366f1", color:"#fff", fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:6, opacity:newRootName.trim()?1:0.5 }}>
              {savingRoot ? <Loader2 size={13} style={{ animation:"spin 1s linear infinite" }} /> : <Save size={13} />}
              Create Folder
            </button>
            <button onClick={() => setAddingRoot(false)} style={{ padding:"9px 12px", borderRadius:6, border:"1px solid rgba(255,255,255,0.1)", background:"transparent", color:"rgba(255,255,255,0.4)", cursor:"pointer" }}><X size={14} /></button>
          </div>
        )}

        {/* Folder tree */}
        {loading ? (
          <div style={{ textAlign:"center", padding:"60px 0" }}>
            <Loader2 size={24} color="#818cf8" style={{ animation:"spin 1s linear infinite" }} />
          </div>
        ) : rootFolders.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:"rgba(255,255,255,0.3)" }}>
            <Folder size={36} style={{ marginBottom:12, opacity:0.3 }} />
            <p style={{ fontSize:14 }}>No folders yet. Create one above.</p>
          </div>
        ) : (
          rootFolders.map(f => (
            <FolderPanel key={f.id}
              folder={{ ...f, files: fileMap[f.id] ?? [] }}
              allFolders={folders.map(x => ({ ...x, files: fileMap[x.id] ?? [] }))}
              depth={0}
              onUpdate={handleFolderUpdate}
              onDelete={handleFolderDelete}
              onAddFile={handleAddFile}
              onAddFolder={handleAddFolder}
              onFileUpdate={handleFileUpdate}
              onFileDelete={handleFileDelete} />
          ))
        )}

        <p style={{ fontSize:11, color:"rgba(255,255,255,0.15)", textAlign:"center", marginTop:40 }}>
          All changes save automatically · Powered by PivotOps
        </p>
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} } .hidden{display:none}`}</style>
    </div>
  );
}