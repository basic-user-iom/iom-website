param([Parameter(Mandatory=$true)][string]$PipeName,
      [Parameter(Mandatory=$true)][string]$Directory,
      [Parameter(Mandatory=$true)][int]$ParentPid,
      [switch]$InspectOnly)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
try {
  Add-Type -Path @((Join-Path $PSScriptRoot 'crm-needs-review-native.cs'),(Join-Path $PSScriptRoot 'crm-needs-review-broker.cs')) -ReferencedAssemblies @('System.dll','System.Core.dll','System.Web.Extensions.dll')
  [IomJournal.Broker]::Run($PipeName,$Directory,$ParentPid,$InspectOnly.IsPresent)
} catch {
  # No file contents, approval records, paths or credentials in diagnostics.
  [Console]::Error.WriteLine('journal_broker_failed_closed')
  exit 1
}
