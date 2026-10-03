# tools/register.ps1
# 把 dsh-price-indicator 注册进 web profile 的 cordis.patch.yml（loader entry 树）。
# 幂等：如果已有 price-indicator 条目则跳过。
$ErrorActionPreference = 'Stop'
$patch = 'C:\Users\Hanson Gao\.dsh\profiles\web\cordis.patch.yml'

if (-not (Test-Path $patch)) { Write-Host "未找到 cordis.patch.yml: $patch"; exit 1 }

$text = Get-Content -Path $patch -Raw
if ($text -match '\bid:\s*price-indicator\b') {
  Write-Host "✅ price-indicator 已存在于 cordis.patch.yml"
  exit 0
}

$entry = "`r`n# -- dsh-price-indicator (梁文峰/梁文谷时间显示; static web plugin) --`r`n- insert:`r`n    - id: price-indicator`r`n      name: dsh-price-indicator`r`n"
Set-Content -Path $patch -Value ($text + $entry) -Encoding UTF8
Write-Host "✅ 已把 price-indicator 注册进 cordis.patch.yml。重启 DSH 生效。"
