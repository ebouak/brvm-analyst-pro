#!/usr/bin/env pwsh
<#
.SYNOPSIS
Automatically add DROP POLICY IF EXISTS before all CREATE POLICY statements
#>

$migrationsDir = "C:\Users\adego\OneDrive\Documents\brvm-analyst-pro\supabase\migrations"
$files = @(
    "0010_emetteurs.sql",
    "0012_publications.sql",
    "0013_fundamentals.sql",
    "0014_portfolio_dashboard.sql",
    "0027_investor_profile.sql",
    "0028_brvm_news.sql",
    "0029_paper_trading.sql",
    "0030_monthly_reports.sql"
)

foreach ($fileName in $files) {
    $path = Join-Path $migrationsDir $fileName
    if (-not (Test-Path $path)) {
        Write-Host "⚠️  $fileName not found" -ForegroundColor Yellow
        continue
    }

    $content = Get-Content $path -Raw
    $lines = $content -split "`n"
    $newLines = @()
    $modified = $false

    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]

        # Check if line starts with "create policy"
        if ($line -match "^\s*create policy\s+`"([^`"]+)`"") {
            $policyName = $matches[1]

            # Look back to see if DROP POLICY is already there
            $foundDrop = $false
            for ($j = [Math]::Max(0, $i - 2); $j -lt $i; $j++) {
                if ($lines[$j] -match "drop policy if exists") {
                    $foundDrop = $true
                    break
                }
            }

            # If no DROP found, add it
            if (-not $foundDrop) {
                # Extract table name from the line
                if ($lines[$i] -match "on public\.(\w+)" -or $lines[$i + 1] -match "on public\.(\w+)") {
                    if ($matches -and $matches[1]) {
                        $tableName = $matches[1]
                        $dropStatement = "drop policy if exists `"$policyName`" on public.$tableName;"
                        $newLines += $dropStatement
                        Write-Host "  ✓ $fileName: added DROP for policy '$policyName'" -ForegroundColor Green
                        $modified = $true
                    }
                }
            }
        }

        $newLines += $line
    }

    if ($modified) {
        $newContent = $newLines -join "`n"
        Set-Content $path -Value $newContent -NoNewline
        Write-Host "    → Modified $fileName" -ForegroundColor Gray
    }
}

Write-Host "`n✅ Auto-fix complete" -ForegroundColor Green
