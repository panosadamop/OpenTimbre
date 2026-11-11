param([Parameter(Mandatory=$true,Position=0)][ValidateSet('setup','frontend','backend','test','build','admin')][string]$Command)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
if (Get-Command py -ErrorAction SilentlyContinue) { & py -3 scripts/dev.py $Command }
elseif (Get-Command python -ErrorAction SilentlyContinue) { & python scripts/dev.py $Command }
else { throw 'Install Python 3.10+ first.' }
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
