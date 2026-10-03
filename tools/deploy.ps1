$ErrorActionPreference = 'Stop'
# 把本地源码部署到 DSH web profile 的静态插件目录，供 DSH 网页加载。
$src = 'D:\deepseek harness plugin\dsh-price-indicator\plugin'
$dst = 'C:\Users\Hanson Gao\.dsh\profiles\web\node_modules\dsh-price-indicator'

New-Item -ItemType Directory -Force -Path $dst | Out-Null

Copy-Item "$src\client.js" "$dst\client.js" -Force
Copy-Item "$src\host.js" "$dst\host.js" -Force
Copy-Item "$src\package.json" "$dst\package.json" -Force

$ok = $true
foreach ($f in @('client.js', 'host.js', 'package.json')) {
  $a = (Get-FileHash "$src\$f" -Algorithm SHA256).Hash
  $b = (Get-FileHash "$dst\$f" -Algorithm SHA256).Hash
  $match = $a -eq $b
  if (-not $match) { $ok = $false }
  Write-Host "$f deploy match: $match"
}

# 校验 client bundle（防锁死：语法 + 拦截 module/exports 引用）
if (Test-Path 'D:\deepseek harness plugin\dsh-price-indicator\tools\check-client-bundle.ps1') {
  & 'D:\deepseek harness plugin\dsh-price-indicator\tools\check-client-bundle.ps1'
  Write-Host "validator exit=$LASTEXITCODE"
}

if ($ok) { Write-Host "✅ dsh-price-indicator deployed to $dst" }
else { Write-Host "⚠️ 部分文件部署校验不通过" }

# 健康检查：确认 DSH 正在 serve 部署后的 client bundle
try {
  $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3083/plugins/dsh-price-indicator/client.js' -UseBasicParsing -TimeoutSec 10
  Write-Host "served len: $($r.Content.Length)"
  Write-Host "served has ds-price-indicator: $($r.Content.Contains('ds-price-indicator'))"
} catch {
  Write-Host "（DSH 尚未在 3083 服务，跳过 serve 检查）"
}
