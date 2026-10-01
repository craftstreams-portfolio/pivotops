# ══════════════════════════════════════════════════════════════════
# Wires: dead Users button -> Participants panel, transfer-host,
# assign-speaker (invite-to-speak) into Conference (meetings/page.tsx)
# ══════════════════════════════════════════════════════════════════

$path = "app\dashboard\meetings\page.tsx"
$content = Get-Content $path -Raw
Copy-Item $path "$path.bak3" -Force
$fail = @()

# ── 1. VideoTile: add onTransferHost prop to signature ────────────
$old1 = 'function VideoTile({
  participant, isSpotlight, isLocal, onSpotlight,
  hostControls, onMute, onKick, onReact,
}: {
  participant:  ParticipantState;
  isSpotlight:  boolean;
  isLocal:      boolean;
  onSpotlight:  () => void;
  hostControls: boolean;
  onMute:       () => void;
  onKick:       () => void;
  onReact:      (emoji: string) => void;
}) {'
$new1 = 'function VideoTile({
  participant, isSpotlight, isLocal, onSpotlight,
  hostControls, onMute, onKick, onReact, onTransferHost,
}: {
  participant:  ParticipantState;
  isSpotlight:  boolean;
  isLocal:      boolean;
  onSpotlight:  () => void;
  hostControls: boolean;
  onMute:       () => void;
  onKick:       () => void;
  onReact:      (emoji: string) => void;
  onTransferHost?: () => void;
}) {'
if ($content.Contains($old1)) { $content = $content.Replace($old1, $new1); Write-Host "[OK] 1: VideoTile signature" -ForegroundColor Green }
else { $fail += "1: VideoTile signature" }

# ── 2. VideoTile: add transfer-host button next to mute/kick ──────
$old2 = '          {hostControls && !isLocal && (
            <>
              <button onClick={(e) => { e.stopPropagation(); onMute(); }}
                className="w-7 h-7 rounded-lg bg-black/60 hover:bg-amber-500/80
                           flex items-center justify-center transition">
                <VolumeX size={12} className="text-white" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onKick(); }}
                className="w-7 h-7 rounded-lg bg-black/60 hover:bg-red-500/80
                           flex items-center justify-center transition">
                <UserX size={12} className="text-white" />
              </button>
            </>
          )}'
$new2 = '          {hostControls && !isLocal && (
            <>
              {onTransferHost && (
                <button onClick={(e) => { e.stopPropagation(); onTransferHost(); }}
                  className="w-7 h-7 rounded-lg bg-black/60 hover:bg-amber-500/80
                             flex items-center justify-center transition"
                  title="Make host">
                  <Crown size={12} className="text-white" />
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); onMute(); }}
                className="w-7 h-7 rounded-lg bg-black/60 hover:bg-amber-500/80
                           flex items-center justify-center transition">
                <VolumeX size={12} className="text-white" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onKick(); }}
                className="w-7 h-7 rounded-lg bg-black/60 hover:bg-red-500/80
                           flex items-center justify-center transition">
                <UserX size={12} className="text-white" />
              </button>
            </>
          )}'
if ($content.Contains($old2)) { $content = $content.Replace($old2, $new2); Write-Host "[OK] 2: VideoTile transfer button" -ForegroundColor Green }
else { $fail += "2: VideoTile transfer button" }

# ── 3. Wire dead Users button -> Participants panel toggle ────────
$old3 = '          <button className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700
                             flex items-center justify-center transition text-zinc-400">
            <Users size={14} />
          </button>'
$new3 = '          <button onClick={() => setShowParticipants(v => !v)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition
              ${showParticipants ? "bg-indigo-500/20 text-indigo-400" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400"}`}>
            <Users size={14} />
          </button>'
if ($content.Contains($old3)) { $content = $content.Replace($old3, $new3); Write-Host "[OK] 3: Users button wired" -ForegroundColor Green }
else { $fail += "3: Users button wired" }

# ── 4. Add showParticipants state ──────────────────────────────────
$old4 = '  const [showTimeIt,     setShowTimeIt]     = useState(false);'
$new4 = '  const [showTimeIt,     setShowTimeIt]     = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);'
if ($content.Contains($old4)) { $content = $content.Replace($old4, $new4); Write-Host "[OK] 4: showParticipants state" -ForegroundColor Green }
else { $fail += "4: showParticipants state" }

# ── 5. Add onTransferHost prop to all 3 VideoTile call sites ──────
$old5a = 'onSpotlight={() => {}} hostControls={isHost}
                  onMute={() => { const d = dbParticipants.find(p => p.participant_user_id === spotlightParticipant.userId); if (d) updateParticipantState(d.id, { is_muted: true }); }}
                  onKick={() => { const d = dbParticipants.find(p => p.participant_user_id === spotlightParticipant.userId); if (d) handleKick(d); }}
                  onReact={(e) => handleReact(spotlightParticipant.userId, e)}
                />'
$new5a = 'onSpotlight={() => {}} hostControls={isHost}
                  onMute={() => { const d = dbParticipants.find(p => p.participant_user_id === spotlightParticipant.userId); if (d) updateParticipantState(d.id, { is_muted: true }); }}
                  onKick={() => { const d = dbParticipants.find(p => p.participant_user_id === spotlightParticipant.userId); if (d) handleKick(d); }}
                  onReact={(e) => handleReact(spotlightParticipant.userId, e)}
                  onTransferHost={() => transferHost(spotlightParticipant.userId)}
                />'
if ($content.Contains($old5a)) { $content = $content.Replace($old5a, $new5a); Write-Host "[OK] 5a: spotlight tile transfer wired" -ForegroundColor Green }
else { $fail += "5a: spotlight tile transfer wired" }

$old5b = 'onSpotlight={() => setSpotlight(p.userId)} hostControls={isHost}
                      onMute={() => { const d = dbParticipants.find(dp => dp.participant_user_id === p.userId); if (d) updateParticipantState(d.id, { is_muted: true }); }}
                      onKick={() => { const d = dbParticipants.find(dp => dp.participant_user_id === p.userId); if (d) handleKick(d); }}
                      onReact={(e) => handleReact(p.userId, e)}
                    />'
$new5b = 'onSpotlight={() => setSpotlight(p.userId)} hostControls={isHost}
                      onMute={() => { const d = dbParticipants.find(dp => dp.participant_user_id === p.userId); if (d) updateParticipantState(d.id, { is_muted: true }); }}
                      onKick={() => { const d = dbParticipants.find(dp => dp.participant_user_id === p.userId); if (d) handleKick(d); }}
                      onReact={(e) => handleReact(p.userId, e)}
                      onTransferHost={() => transferHost(p.userId)}
                    />'
if ($content.Contains($old5b)) { $content = $content.Replace($old5b, $new5b); Write-Host "[OK] 5b: side-rail tile transfer wired" -ForegroundColor Green }
else { $fail += "5b: side-rail tile transfer wired" }

$old5c = 'hostControls={isHost}
                  onMute={() => { const d = dbParticipants.find(dp => dp.participant_user_id === p.userId); if (d) updateParticipantState(d.id, { is_muted: true }); }}
                  onKick={() => { const d = dbParticipants.find(dp => dp.participant_user_id === p.userId); if (d) handleKick(d); }}
                  onReact={(e) => handleReact(p.userId, e)}
                />
              ))}
            </div>
          )}
        </div>'
$new5c = 'hostControls={isHost}
                  onMute={() => { const d = dbParticipants.find(dp => dp.participant_user_id === p.userId); if (d) updateParticipantState(d.id, { is_muted: true }); }}
                  onKick={() => { const d = dbParticipants.find(dp => dp.participant_user_id === p.userId); if (d) handleKick(d); }}
                  onReact={(e) => handleReact(p.userId, e)}
                  onTransferHost={() => transferHost(p.userId)}
                />
              ))}
            </div>
          )}
        </div>'
if ($content.Contains($old5c)) { $content = $content.Replace($old5c, $new5c); Write-Host "[OK] 5c: grid tile transfer wired" -ForegroundColor Green }
else { $fail += "5c: grid tile transfer wired" }

# ── 6. isHost: derive live from dbParticipants instead of stale myParticipant ──
$old6 = '  const isHost = myParticipant?.participant_role === "host";'
$new6 = '  const isHost = dbParticipants.find(p => p.participant_user_id === currentUser?.id)?.participant_role === "host";'
if ($content.Contains($old6)) { $content = $content.Replace($old6, $new6); Write-Host "[OK] 6: isHost live derivation" -ForegroundColor Green }
else { $fail += "6: isHost live derivation" }

Set-Content -LiteralPath $path -Encoding UTF8 -Value $content
Write-Host "`n--- Round 1 done ---" -ForegroundColor Cyan
if ($fail.Count -gt 0) {
    Write-Host "FAILED:" -ForegroundColor Yellow
    $fail | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
} else {
    Write-Host "All round-1 patches applied." -ForegroundColor Green
}
