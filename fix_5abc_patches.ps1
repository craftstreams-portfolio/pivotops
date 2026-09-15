# ══════════════════════════════════════════════════════════════════
# Adds onTransferHost prop to all 3 VideoTile call sites (5a/5b/5c)
# Applied bottom-to-top so earlier anchors don't shift.
# ══════════════════════════════════════════════════════════════════

$path = "app\dashboard\meetings\page.tsx"
$lines = Get-Content $path
Copy-Item $path "$path.bak5" -Force

# ── 5c: grid tile (line 1158, 0-indexed 1157) — insert after this line ──
$insertAfter = 1158
$block5c = @('                  onTransferHost={() => transferHost(p.userId)}')
$lines = $lines[0..($insertAfter-1)] + $block5c + $lines[$insertAfter..($lines.Length-1)]
Write-Host "[OK] 5c: grid tile transfer wired" -ForegroundColor Green

# ── 5b: side-rail tile (line 1141, 0-indexed 1140) — insert after this line ──
$insertAfter = 1141
$block5b = @('                      onTransferHost={() => transferHost(p.userId)}')
$lines = $lines[0..($insertAfter-1)] + $block5b + $lines[$insertAfter..($lines.Length-1)]
Write-Host "[OK] 5b: side-rail tile transfer wired" -ForegroundColor Green

# ── 5a: spotlight tile (line 1131, 0-indexed 1130) — insert after this line ──
$insertAfter = 1131
$block5a = @('                  onTransferHost={() => transferHost(spotlightParticipant.userId)}')
$lines = $lines[0..($insertAfter-1)] + $block5a + $lines[$insertAfter..($lines.Length-1)]
Write-Host "[OK] 5a: spotlight tile transfer wired" -ForegroundColor Green

Set-Content -LiteralPath $path -Encoding UTF8 -Value $lines
Write-Host "`nAll 3 call sites patched." -ForegroundColor Cyan
Select-String -Path $path -Pattern "onTransferHost" | Measure-Object | Select-Object Count
