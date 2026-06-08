[CmdletBinding(PositionalBinding = $false)]
param(
  [string]$ImageName = "oi-loftrop/bootstrap-tools:local",
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$BootstrapArgs
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

docker build `
  -f (Join-Path $repoRoot "infra\bootstrap-tools.Dockerfile") `
  -t $ImageName `
  $repoRoot

docker run --rm -it `
  -v "${repoRoot}:/work" `
  -w /work `
  $ImageName `
  @BootstrapArgs
