$path = 'services/relayer/package.json'
$raw = [System.IO.File]::ReadAllText($path)
try {
  $raw | ConvertFrom-Json | Out-Null
  Write-Host 'package.json OK'
} catch {
  Write-Host 'package.json INVALID'
  Write-Host $_.Exception.Message
}
