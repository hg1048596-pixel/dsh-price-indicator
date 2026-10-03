# tools/price-killswitch.ps1
# 一次急救开关：万一 dsh-price-indicator 又导致 DSH 启动红屏，
# 不用改任何配置，禁用它即可正常进入 DSH；恢复同理。
#
# 用法：
#   pwsh -NoProfile -ExecutionPolicy Bypass -File tools/price-killswitch.ps1          # 禁用
#   pwsh -NoProfile -ExecutionPolicy Bypass -File tools/price-killswitch.ps1 -Action enable   # 恢复
#
# 原理：在 ~/.dsh/profiles/web/cordis.patch.yml 的 price-indicator 条目上加/删
# `disabled: true`（loader 对 disabled 条目直接跳过，不导入该插件）。
param(
  [ValidateSet('disable','enable')]
  [string]$Action = 'disable'
)
$ErrorActionPreference = 'Stop'
$patch = 'C:\Users\Hanson Gao\.dsh\profiles\web\cordis.patch.yml'

if (-not (Test-Path $patch)) { Write-Host "未找到 cordis.patch.yml: $patch"; exit 1 }

$text = Get-Content -Path $patch -Raw
$entryId = 'price-indicator'

# 禁用：在含有 id: price-indicator 的 insert 块中的 id 行之后插入 disabled: true
if ($Action -eq 'disable') {
  if ($text -match "(?m)^(\s*- id: $entryId\r?\n)(\s*name: dsh-price-indicator\r?\n)") {
    $new = $Matches[0] + "        disabled: true`r`n"
    $text = $text.Substring(0, $text.IndexOf($Matches[0])) + $new + $text.Substring($text.IndexOf($Matches[0]) + $Matches[0].Length)
    Set-Content -Path $patch -Value $text -Encoding UTF8
    Write-Host "✅ 已禁用 $entryId（添加 disabled: true）。重启 DSH 生效。"
  } else {
    $idLine = Select-String -Path $patch -Pattern "\b$entryId\b" | Select-Object -First 1
    if (-not $idLine) { Write-Host "在 cordis.patch.yml 未找到 $entryId 条目"; exit 1 }
    Write-Host "提示：$entryId 条目格式可能与预期不同，请手动检查。临时应急：手动在该条目下加 disabled: true。"
  }
} else {
  # 启用：移除 disabled: true 行
  if ($text -match "(?m)^(\s+- disabled: true\r?\n)") {
    while ($text -match "(?m)^\s+disabled: true\r?\r?\n") {
      $text = $text -replace "(?m)^\s+disabled: true\r?\r?\n", ''
    }
    Set-Content -Path $patch -Value $text -Encoding UTF8
    Write-Host "✅ 已启用 $entryId（移除 disabled: true）。重启 DSH 生效。"
  } else {
    Write-Host "提示：未找到 disabled: true，可能本就处于启用状态。"
  }
}
