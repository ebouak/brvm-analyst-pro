#!/usr/bin/env pwsh
$migrationsDir = "C:\Users\adego\OneDrive\Documents\brvm-analyst-pro\supabase\migrations"

Get-ChildItem $migrationsDir -Filter "*.sql" | Where-Object { $_.Name -match "^\d{4}" } | ForEach-Object {
    $path = $_.FullName
    $content = Get-Content $path -Raw

    # Replace pattern: before any "create policy", add "drop policy if exists" if not already there
    # Match: \s*create policy\s+"([^"]+)"\s+on\s+public\.(\w+)
    # Replace: drop policy if exists "<policyname>" on public.<tablename>;\ncreate policy "<policyname>" on public.<tablename>

    $newContent = $content -replace `
        '(?<!\s)(\s*)create\s+policy\s+"([^"]+)"\s+on\s+public\.(\w+)',
        {
            param($m)
            $indent = $m.Groups[1].Value
            $policyName = $m.Groups[2].Value
            $tableName = $m.Groups[3].Value

            # Check if drop policy is already in the preceding 300 chars
            $beforeText = $content.Substring(0, $m.Index)
            if ($beforeText -match "drop policy if exists `"$([regex]::Escape($policyName))`"") {
                # Already have a DROP, don't add another
                $m.Value
            } else {
                # Add DROP before CREATE
                "$($indent)drop policy if exists `"$policyName`" on public.$tableName;`n$($m.Value)"
            }
        }

    if ($newContent -ne $content) {
        Set-Content $path -Value $newContent -NoNewline
        Write-Host "✓ Fixed $(Split-Path $path -Leaf)" -ForegroundColor Green
    }
}

Write-Host "`n✅ Complete" -ForegroundColor Green
