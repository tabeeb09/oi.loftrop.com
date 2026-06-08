[CmdletBinding(PositionalBinding = $false)]
param(
  [string]$ImageName = "oi-loftrop/bootstrap-tools:local",
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$BootstrapArgs
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

function Convert-GoogleSecretArg {
  param(
    [string[]]$ArgsToConvert
  )

  $converted = New-Object System.Collections.Generic.List[string]
  $mount = $null
  $keys = @("--google-client-secrets-file", "--google-client-secret-file")

  for ($i = 0; $i -lt $ArgsToConvert.Count; $i++) {
    $arg = $ArgsToConvert[$i]
    $matchedInline = $false

    foreach ($key in $keys) {
      $prefix = "$key="
      if ($arg.StartsWith($prefix)) {
        $hostPath = $arg.Substring($prefix.Length)
        $resolved = Resolve-Path -LiteralPath $hostPath
        $file = Get-Item -LiteralPath $resolved
        $mount = $file.DirectoryName
        $converted.Add("$key=/google-oauth/$($file.Name)")
        $matchedInline = $true
        break
      }
    }

    if ($matchedInline) {
      continue
    }

    if ($keys -contains $arg) {
      if ($i + 1 -ge $ArgsToConvert.Count) {
        throw "$arg requires a file path argument."
      }

      $hostPath = $ArgsToConvert[$i + 1]
      $resolved = Resolve-Path -LiteralPath $hostPath
      $file = Get-Item -LiteralPath $resolved
      $mount = $file.DirectoryName
      $converted.Add($arg)
      $converted.Add("/google-oauth/$($file.Name)")
      $i++
      continue
    }

    $converted.Add($arg)
  }

  return @{
    Args = $converted.ToArray()
    Mount = $mount
  }
}

$googleSecretConversion = Convert-GoogleSecretArg -ArgsToConvert $BootstrapArgs
$dockerArgs = @(
  "run",
  "--rm",
  "-it",
  "-v",
  "${repoRoot}:/work"
)

if ($googleSecretConversion.Mount) {
  $dockerArgs += @("-v", "$($googleSecretConversion.Mount):/google-oauth:ro")
}

$dockerArgs += @(
  "-w",
  "/work",
  $ImageName
)
$dockerArgs += $googleSecretConversion.Args

docker build `
  -f (Join-Path $repoRoot "infra\bootstrap-tools.Dockerfile") `
  -t $ImageName `
  $repoRoot

& docker @dockerArgs
