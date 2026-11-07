$ErrorActionPreference = 'Stop'
$p = 'C:\Users\user\Desktop\game\Splendor\shared\rules.mjs'
$text = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
Write-Output ("first: " + $text.Substring(0, 80))
$enc936 = [System.Text.Encoding]::GetEncoding(936)
$bytes = $enc936.GetBytes($text)
$fixed = [System.Text.Encoding]::UTF8.GetString($bytes)
Write-Output ("fixed: " + $fixed.Substring(0, 80))
Write-Output ("has diamond: " + $fixed.Contains([char]0x94BB + [string][char]0x77F3))
