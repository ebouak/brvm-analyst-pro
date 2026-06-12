#!/usr/bin/env pwsh
<#
.SYNOPSIS
Fix broken Supabase migration state using Supabase CLI
.DESCRIPTION
This script:
1. Verifies Supabase CLI is installed
2. Links your Supabase project
3. Applies the fix migration
4. Verifies all migrations are applied
#>

$ErrorActionPreference = "Stop"

Write-Host "🔧 Supabase Migration Recovery" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

# Step 1: Check Supabase CLI
Write-Host "Step 1: Checking Supabase CLI..." -ForegroundColor Yellow
$supabase = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabase) {
    Write-Host "❌ Supabase CLI not found. Installing..." -ForegroundColor Red
    npm install -g @supabase/cli
    $supabase = Get-Command supabase -ErrorAction SilentlyContinue
}

if ($supabase) {
    Write-Host "✅ Supabase CLI found at: $($supabase.Source)" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to install Supabase CLI" -ForegroundColor Red
    Write-Host "   Try: npm install -g @supabase/cli" -ForegroundColor Red
    exit 1
}

# Step 2: Check if already authenticated
Write-Host "`nStep 2: Checking Supabase authentication..." -ForegroundColor Yellow
$projectInfo = & supabase projects list 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Not authenticated with Supabase" -ForegroundColor Red
    Write-Host "`n📝 MANUAL STEP REQUIRED:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Go to: https://app.supabase.com/account/tokens"
    Write-Host "2. Create a new 'Personal access token'"
    Write-Host "3. Copy the token"
    Write-Host "4. Run: supabase login"
    Write-Host "5. Paste the token"
    Write-Host ""
    Write-Host "Then run this script again."
    exit 1
}

Write-Host "✅ Authentication verified" -ForegroundColor Green

# Step 3: Link project
Write-Host "`nStep 3: Linking Supabase project..." -ForegroundColor Yellow
$projectRef = "vozwivhmjfmnnnjbbkpt"

# Check if already linked
$config = Get-Content .supabaserc -ErrorAction SilentlyContinue
if ($config -like "*$projectRef*") {
    Write-Host "✅ Project already linked" -ForegroundColor Green
} else {
    Write-Host "   Linking project: $projectRef" -ForegroundColor Gray
    & supabase link --project-ref $projectRef
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to link project" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Project linked" -ForegroundColor Green
}

# Step 4: Apply migrations
Write-Host "`nStep 4: Applying migrations..." -ForegroundColor Yellow
Write-Host "   This will apply all pending migrations (0001-0033)" -ForegroundColor Gray
Write-Host ""

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
& supabase db push

if ($LASTEXITCODE -eq 0) {
    $stopwatch.Stop()
    Write-Host ""
    Write-Host "✅ Migrations applied successfully! ($($stopwatch.Elapsed.TotalSeconds)s)" -ForegroundColor Green
    Write-Host ""
    Write-Host "=" * 60 -ForegroundColor Green
    Write-Host "🎉 Migration recovery complete!" -ForegroundColor Green
    Write-Host "=" * 60 -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. Your GitHub Actions workflows should now succeed"
    Write-Host "  2. Test manually: github.com/ebouak/brvm-analyst-pro/actions"
    Write-Host "  3. Click 'Daily BRVM Scrape' → 'Run workflow'"
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Migration failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "This could be due to:" -ForegroundColor Yellow
    Write-Host "  1. Network issues"
    Write-Host "  2. Remaining policy conflicts"
    Write-Host "  3. Partial previous migrations"
    Write-Host ""
    Write-Host "Try the manual SQL approach:" -ForegroundColor Yellow
    Write-Host "  1. Open Supabase SQL Editor:"
    Write-Host "     https://app.supabase.com/project/vozwivhmjfmnnnjbbkpt/sql/new"
    Write-Host "  2. Run: scripts/reset-migrations.sql"
    Write-Host "  3. Then retry: supabase db push"
    exit 1
}
