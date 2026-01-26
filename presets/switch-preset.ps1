# OpenCode Preset Switcher for Windows PowerShell
# Usage: .\switch-preset.ps1 <preset-name>
# Available presets: balanced, best, free, maintainer-default

param(
    [Parameter(Position=0)]
    [string]$PresetName
)

$PresetsDir = "$env:USERPROFILE\.config\opencode\presets"
$ConfigFile = "$env:USERPROFILE\.config\opencode\oh-my-opencode.json"
$BackupFile = "$env:USERPROFILE\.config\opencode\oh-my-opencode.json.backup"

# Fallback to APPDATA if .config doesn't exist
if (-not (Test-Path $PresetsDir)) {
    $PresetsDir = "$env:APPDATA\opencode\presets"
    $ConfigFile = "$env:APPDATA\opencode\oh-my-opencode.json"
    $BackupFile = "$env:APPDATA\opencode\oh-my-opencode.json.backup"
}

function Show-Help {
    Write-Host "OpenCode Preset Switcher" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Usage: .\switch-preset.ps1 <preset-name>"
    Write-Host ""
    Write-Host "Available presets:"
    Write-Host "  balanced           " -NoNewline -ForegroundColor Green
    Write-Host "- Quality/cost optimized for parallel agents"
    Write-Host "  best               " -NoNewline -ForegroundColor Green
    Write-Host "- Maximum quality (expensive)"
    Write-Host "  free               " -NoNewline -ForegroundColor Green
    Write-Host "- Zero cost (Antigravity + Copilot only)"
    Write-Host "  maintainer-default " -NoNewline -ForegroundColor Green
    Write-Host "- Official oh-my-opencode recommendations"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\switch-preset.ps1 balanced"
    Write-Host "  .\switch-preset.ps1 free"
}

function Switch-Preset {
    param([string]$Name)

    $PresetFile = Join-Path $PresetsDir "$Name.jsonc"

    if (-not (Test-Path $PresetFile)) {
        Write-Host "Error: Preset '$Name' not found" -ForegroundColor Red
        Write-Host "Available presets:" -ForegroundColor Yellow
        Get-ChildItem $PresetsDir -Filter "*.jsonc" | ForEach-Object {
            Write-Host "  - $($_.BaseName)"
        }
        return
    }

    # Backup current config
    if (Test-Path $ConfigFile) {
        Copy-Item $ConfigFile $BackupFile
        Write-Host "Backed up current config" -ForegroundColor Yellow
    }

    # Read JSONC and strip comments
    $content = Get-Content $PresetFile -Raw
    # Remove // comments
    $content = $content -replace '//.*', ''
    # Remove empty lines
    $content = ($content -split "`n" | Where-Object { $_.Trim() -ne '' }) -join "`n"

    # Ensure directory exists
    $configDir = Split-Path $ConfigFile -Parent
    if (-not (Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    }

    # Write config
    $content | Out-File -FilePath $ConfigFile -Encoding utf8 -NoNewline

    Write-Host "Switched to preset: $Name" -ForegroundColor Green
    Write-Host "Config written to: $ConfigFile"
    Write-Host "Restart opencode for changes to take effect."
}

# Main
if ([string]::IsNullOrEmpty($PresetName) -or $PresetName -eq "-h" -or $PresetName -eq "--help") {
    Show-Help
} else {
    Switch-Preset -Name $PresetName
}
