# Kill all Electron processes (Windows PowerShell)
Write-Host "🔍 Searching for Electron processes..." -ForegroundColor Yellow

$processes = Get-Process -Name "electron" -ErrorAction SilentlyContinue

if ($processes) {
    Write-Host "⚠️  Found $($processes.Count) Electron process(es)" -ForegroundColor Red
    
    foreach ($process in $processes) {
        Write-Host "   Killing PID: $($process.Id)" -ForegroundColor Gray
        Stop-Process -Id $process.Id -Force
    }
    
    Write-Host "✅ All Electron processes killed" -ForegroundColor Green
} else {
    Write-Host "✅ No Electron processes found" -ForegroundColor Green
}

Write-Host ""
Write-Host "Now you can run: npm run dev" -ForegroundColor Cyan
