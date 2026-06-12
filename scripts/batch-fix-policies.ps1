#!/usr/bin/env pwsh
<#
.SYNOPSIS
Batch fix non-idempotent policy creation in all migration files
#>

$migrationsDir = "C:\Users\adego\OneDrive\Documents\brvm-analyst-pro\supabase\migrations"
$count = 0

Get-ChildItem $migrationsDir -Filter "*.sql" | Where-Object { $_.Name -match "^\d{4}" } | ForEach-Object {
    $file = $_
    $path = $file.FullName
    $content = Get-Content $path -Raw

    # Check if file has "create policy" without a preceding "drop policy if exists"
    $lines = $content -split "`n"
    $modified = $false
    $newLines = @()

    $i = 0
    while ($i -lt $lines.Count) {
        $line = $lines[$i]

        # Check if this is a "create policy" line
        if ($line -match "^\s*create policy") {
            # Extract the policy name from the line
            if ($line -match 'create policy "([^"]+)"') {
                $policyName = $matches[1]

                # Look back to see if there's already a "drop policy" for this policy
                $foundDrop = $false
                for ($j = $i - 1; $j -ge [Math]::Max(0, $i - 5); $j--) {
                    if ($lines[$j] -match "drop policy if exists `"$([regex]::Escape($policyName))`"") {
                        $foundDrop = $true
                        break
                    }
                }

                # If no drop found, add it
                if (-not $foundDrop) {
                    # Try to extract table name
                    if ($line -match 'on public\.(\w+)') {
                        $tableName = $matches[1]
                        $dropStatement = "drop policy if exists `"$policyName`" on public.$tableName;"
                        Write-Host "  + Adding drop policy to: $file" -ForegroundColor Gray
                        Write-Host "    Policy: $policyName on $tableName" -ForegroundColor Gray
                        $newLines += $dropStatement
                        $modified = $true
                    }
                }
            }
        }

        $newLines += $line
        $i++
    }

    # Write back if modified
    if ($modified) {
        $newContent = $newLines -join "`n"
        Set-Content $path -Value $newContent -NoNewline
        $count++
    }
}

Write-Host "`n✅ Fixed $count migration files" -ForegroundColor Green
