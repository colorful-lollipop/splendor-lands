$ErrorActionPreference = 'Stop'
$root = 'C:\Users\user\Desktop\game\Splendor'
$targets = @(
  "$root\shared\rules.mjs",
  "$root\src\styles\extra.css"
)
$enc936 = [System.Text.Encoding]::GetEncoding(936)
$encUtf8 = New-Object System.Text.UTF8Encoding($false)
foreach ($p in $targets) {
  $text = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
  $bytes = $enc936.GetBytes($text)
  [System.IO.File]::WriteAllBytes($p, $bytes)
  Write-Output ("converted " + $p)
}
