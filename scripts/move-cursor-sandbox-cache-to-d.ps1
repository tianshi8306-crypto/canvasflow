# Move Cursor agent sandbox cache to D: and leave a junction at the original path.
# Close Cursor completely before running. Run PowerShell as Administrator if mklink fails.
#
# Usage:
#   .\scripts\move-cursor-sandbox-cache-to-d.ps1
#   .\scripts\move-cursor-sandbox-cache-to-d.ps1 -TargetRoot "D:\MyCursorCache"

param(
    [string]$TargetRoot = $(if ($env:CURSOR_SANDBOX_D_ROOT) { $env:CURSOR_SANDBOX_D_ROOT } else { "D:\cursor-cache" })
)

$ErrorActionPreference = "Stop"

$localAppData = [Environment]::GetFolderPath("LocalApplicationData")
$src = Join-Path $localAppData "Temp\cursor-sandbox-cache"
$dest = Join-Path $TargetRoot "cursor-sandbox-cache"

Write-Host "Junction path (old location): $src"
Write-Host "Data directory on D: $dest"
Write-Host ""

$drives = (Split-Path $TargetRoot -Qualifier) -replace ':', ''
if (-not (Test-Path "${drives}:\")) {
    throw "Drive not available: ${drives}:"
}

New-Item -ItemType Directory -Force -Path $TargetRoot | Out-Null

if (Test-Path $src) {
    $item = Get-Item $src -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        Write-Host "Source is already a reparse point. Nothing to do."
        exit 0
    }
    if (-not $item.PSIsContainer) {
        throw "Source exists but is not a directory: $src"
    }
    Write-Host "Moving cache to: $dest"
    if (Test-Path $dest) {
        throw "Destination already exists: $dest — remove or rename it first."
    }
    Move-Item -LiteralPath $src -Destination $dest
}
else {
    Write-Host "Source not found; creating empty dir on D: (cache will appear after Agent runs)."
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
}

if (Test-Path $src) {
    throw "Cannot create junction: source still exists: $src"
}

Write-Host "Creating junction: $src -> $dest"
cmd.exe /c "mklink /J `"$src`" `"$dest`""
if ($LASTEXITCODE -ne 0) {
    throw "mklink failed (exit $LASTEXITCODE). Try running PowerShell as Administrator."
}

Write-Host ""
Write-Host "Done. Restart Cursor."
Write-Host "Optional: set user TEMP/TMP to D:\Temp to reduce C: temp usage globally."
