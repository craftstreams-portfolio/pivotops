# ══════════════════════════════════════════════════════════════════
# Fixes the 6 remaining patches using line-number splicing.
# Applied in DESCENDING line-number order so earlier anchors don't shift.
# ══════════════════════════════════════════════════════════════════

$path = "app\dashboard\meetings\page.tsx"
$lines = Get-Content $path
Copy-Item $path "$path.bak4" -Force
Write-Host "Backup saved: $path.bak4" -ForegroundColor Cyan

# ── Patch 3: dead Users button -> wired (lines 1095-1098, 0-indexed 1094-1097) ──
$startIdx = 1094
$endIdx   = 1097
$block3 = @(
'          <button onClick={() => setShowParticipants(v => !v)}',
'            className={`w-8 h-8 rounded-lg flex items-center justify-center transition',
'              ${showParticipants ? "bg-indigo-500/20 text-indigo-400" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400"}`}>',
'            <Users size={14} />',
'          </button>'
)
$before = $lines[0..($startIdx-1)]
$after  = $lines[($endIdx+1)..($lines.Length-1)]
$lines = $before + $block3 + $after
Write-Host "[OK] Patch 3: Users button wired" -ForegroundColor Green

# ── Patch 2: transfer-host button inside VideoTile (lines 274-289, 0-indexed 273-288) ──
$startIdx = 273
$endIdx   = 288
$block2 = @(
'          {hostControls && !isLocal && (',
'            <>',
'              {onTransferHost && (',
'                <button onClick={(e) => { e.stopPropagation(); onTransferHost(); }}',
'                  className="w-7 h-7 rounded-lg bg-black/60 hover:bg-amber-500/80',
'                             flex items-center justify-center transition"',
'                  title="Make host">',
'                  <Crown size={12} className="text-white" />',
'                </button>',
'              )}',
'              <button onClick={(e) => { e.stopPropagation(); onMute(); }}',
'                className="w-7 h-7 rounded-lg bg-black/60 hover:bg-amber-500/80',
'                           flex items-center justify-center transition">',
'                <VolumeX size={12} className="text-white" />',
'              </button>',
'              <button onClick={(e) => { e.stopPropagation(); onKick(); }}',
'                className="w-7 h-7 rounded-lg bg-black/60 hover:bg-red-500/80',
'                           flex items-center justify-center transition">',
'                <UserX size={12} className="text-white" />',
'              </button>',
'            </>',
'          )}',
'        </div>',
'      )}'
)
$before = $lines[0..($startIdx-1)]
$after  = $lines[($endIdx+1)..($lines.Length-1)]
$lines = $before + $block2 + $after
Write-Host "[OK] Patch 2: transfer-host button added" -ForegroundColor Green

# ── Patch 1: VideoTile signature (lines 168-180, 0-indexed 167-179) ──
$startIdx = 167
$endIdx   = 179
$block1 = @(
'function VideoTile({',
'  participant, isSpotlight, isLocal, onSpotlight,',
'  hostControls, onMute, onKick, onReact, onTransferHost,',
'}: {',
'  participant:  ParticipantState;',
'  isSpotlight:  boolean;',
'  isLocal:      boolean;',
'  onSpotlight:  () => void;',
'  hostControls: boolean;',
'  onMute:       () => void;',
'  onKick:       () => void;',
'  onReact:      (emoji: string) => void;',
'  onTransferHost?: () => void;',
'}) {'
)
$before = $lines[0..($startIdx-1)]
$after  = $lines[($endIdx+1)..($lines.Length-1)]
$lines = $before + $block1 + $after
Write-Host "[OK] Patch 1: VideoTile signature updated" -ForegroundColor Green

Set-Content -LiteralPath $path -Encoding UTF8 -Value $lines
Write-Host "`n--- Patches 1, 2, 3 done via line-splicing ---" -ForegroundColor Cyan
Write-Host "Now finding fresh line numbers for 5a/5b/5c (VideoTile call sites)..." -ForegroundColor Yellow
Select-String -Path $path -Pattern "onReact=\{\(e\) => handleReact\(" -Context 0,1
