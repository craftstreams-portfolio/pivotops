# ══════════════════════════════════════════════════════════════════
# Round 3 v2 — corrected anchors (Select-String verified, 1-based)
# Restores from .bak6 first, then applies bottom-to-top.
# ══════════════════════════════════════════════════════════════════

$path = "app\dashboard\meetings\page.tsx"
$backup = "$path.bak6"
if (-not (Test-Path $backup)) { Write-Host "ERROR: $backup not found." -ForegroundColor Red; exit 1 }
Copy-Item $backup $path -Force
Write-Host "Restored from $backup" -ForegroundColor Cyan

$lines = Get-Content $path

# ── STEP 1 (bottom-most): Participants panel render, insert after line 1327 (")}") ──
$insertAfter = 1327
$panelBlock = @(
'',
'      {showParticipants && (',
'        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"',
'             onClick={() => setShowParticipants(false)}>',
'          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-5"',
'               onClick={(e) => e.stopPropagation()}>',
'            <div className="flex items-center justify-between mb-4">',
'              <h3 className="text-white font-semibold text-sm">Participants ({dbParticipants.length})</h3>',
'              <button onClick={() => setShowParticipants(false)}',
'                      className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition">',
'                <X size={14} />',
'              </button>',
'            </div>',
'            <div className="space-y-1.5 max-h-80 overflow-y-auto">',
'              {dbParticipants.map((p) => (',
'                <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-zinc-800/60 transition">',
'                  <div className="flex items-center gap-2.5 min-w-0">',
'                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0"',
'                         style={{ background: "linear-gradient(135deg, #6366f1, #4338ca)" }}>',
'                      {getInitials(p.display_name ?? "Member")}',
'                    </div>',
'                    <div className="min-w-0">',
'                      <p className="text-xs text-white truncate flex items-center gap-1">',
'                        {p.participant_role === "host" && <Crown size={11} className="text-amber-400" />}',
'                        {p.display_name ?? "Member"}',
'                        {p.participant_user_id === currentUser?.id ? " (You)" : ""}',
'                      </p>',
'                      {p.is_muted && <p className="text-[10px] text-zinc-500">Muted</p>}',
'                    </div>',
'                  </div>',
'                  {isHost && p.participant_user_id !== currentUser?.id && (',
'                    <div className="flex items-center gap-1 flex-shrink-0">',
'                      <button',
'                        onClick={() => assignSpeaker(p.participant_user_id)}',
'                        className="text-[10px] font-medium text-indigo-300 hover:text-indigo-200 px-2 py-1 rounded-lg hover:bg-indigo-500/10 transition"',
'                        title="Invite to speak"',
'                      >',
'                        Invite',
'                      </button>',
'                      <button',
'                        onClick={() => transferHost(p.participant_user_id)}',
'                        className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 transition"',
'                        title="Make host"',
'                      >',
'                        <Crown size={13} />',
'                      </button>',
'                      <button',
'                        onClick={() => handleKick(p)}',
'                        className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition"',
'                        title="Remove"',
'                      >',
'                        <UserX size={13} />',
'                      </button>',
'                    </div>',
'                  )}',
'                </div>',
'              ))}',
'            </div>',
'          </div>',
'        </div>',
'      )}'
)
$lines = $lines[0..($insertAfter-1)] + $panelBlock + $lines[$insertAfter..($lines.Length-1)]
Write-Host "[OK] Step 1: Participants panel render inserted after line 1327" -ForegroundColor Green

# ── STEP 2: transferHost + assignSpeaker functions, insert after line 778 (handleKick) ──
$insertAfter = 778
$funcBlock = @(
'  async function transferHost(newHostUserId: string) {',
'    if (!activeMeeting || !currentUser || newHostUserId === currentUser.id) return;',
'    try {',
'      await supabase.from("meetings").update({ host_user_id: newHostUserId }).eq("id", activeMeeting.id);',
'      await supabase.from("meeting_participants").update({ participant_role: "participant" })',
'        .eq("meeting_id", activeMeeting.id).eq("participant_role", "host");',
'      await supabase.from("meeting_participants").update({ participant_role: "host" })',
'        .eq("meeting_id", activeMeeting.id).eq("participant_user_id", newHostUserId);',
'      notifyChanRef.current?.send({',
'        type: "broadcast", event: "host-transferred",',
'        payload: { newHostId: newHostUserId },',
'      });',
'    } catch (e) {',
'      console.error("[transferHost] failed:", e);',
'    }',
'  }',
'',
'  function assignSpeaker(userId: string) {',
'    notifyChanRef.current?.send({',
'      type: "broadcast", event: "invite-to-speak",',
'      payload: { userId },',
'    });',
'  }'
)
$lines = $lines[0..($insertAfter-1)] + $funcBlock + $lines[$insertAfter..($lines.Length-1)]
Write-Host "[OK] Step 2: transferHost + assignSpeaker functions added" -ForegroundColor Green

# ── STEP 3: notify channel subscription, insert after line 671 ──
$insertAfter = 671
$notifyBlock = @(
'',
'      notifyChanRef.current = supabase',
'        .channel(`meeting-notify-${activeMeeting.id}`)',
'        .on("broadcast", { event: "host-transferred" }, ({ payload }: any) => {',
'          if (payload?.newHostId === currentUser.id) {',
'            window.alert("You are now the host of this meeting.");',
'          }',
'        })',
'        .on("broadcast", { event: "invite-to-speak" }, ({ payload }: any) => {',
'          if (payload?.userId === currentUser.id) {',
'            window.alert("The host invited you to speak - unmute when ready.");',
'          }',
'        })',
'        .subscribe();'
)
$lines = $lines[0..($insertAfter-1)] + $notifyBlock + $lines[$insertAfter..($lines.Length-1)]
Write-Host "[OK] Step 3: notify channel subscription added" -ForegroundColor Green

# ── STEP 4 (top-most): notifyChanRef declaration, insert after line 484 ──
$insertAfter = 484
$refBlock = @('  const notifyChanRef = useRef<any>(null);')
$lines = $lines[0..($insertAfter-1)] + $refBlock + $lines[$insertAfter..($lines.Length-1)]
Write-Host "[OK] Step 4: notifyChanRef declared" -ForegroundColor Green

Set-Content -LiteralPath $path -Encoding UTF8 -Value $lines
Write-Host "`nAll round-3 v2 patches written." -ForegroundColor Cyan
Select-String -Path $path -Pattern "transferHost|assignSpeaker|notifyChanRef|showParticipants" | Measure-Object | Select-Object Count
