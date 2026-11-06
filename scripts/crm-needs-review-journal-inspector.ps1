# Read-only Windows fact collector for the Needs-review journal privacy gate.
# Prints one JSON object. It does not create directories, change ACLs, take
# ownership, or accept a policy decision. Node decides from these facts.
[CmdletBinding(DefaultParameterSetName = 'Inspect')]
param(
  [Parameter(Mandatory = $true, ParameterSetName = 'Inspect')]
  [string] $Directory,
  [Parameter(Mandatory = $true, ParameterSetName = 'Drive')]
  [string] $VolumeRoot
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

function Stop-Inspection([int] $Code) {
  [Console]::Error.WriteLine('needs_review_journal_privacy_inspection_failed')
  exit $Code
}

function Test-DaclPresent($acl) {
  $raw = New-Object System.Security.AccessControl.RawSecurityDescriptor($acl.GetSecurityDescriptorBinaryForm(), 0)
  $flag = [System.Security.AccessControl.ControlFlags]::DiscretionaryAclPresent
  return (($raw.ControlFlags -band $flag) -ne 0) -and ($null -ne $raw.DiscretionaryAcl)
}

function Get-AceFacts($acl) {
  $aces = New-Object System.Collections.Generic.List[object]
  if (-not (Test-DaclPresent $acl)) { return $aces }
  foreach ($ace in $acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])) {
    $aces.Add([ordered]@{
      sid = [string]$ace.IdentityReference.Value
      type = [string]$ace.AccessControlType
      rights = [int64]$ace.FileSystemRights.value__
      inheritance = [int]$ace.InheritanceFlags.value__
      propagation = [int]$ace.PropagationFlags.value__
    })
  }
  return $aces
}

function Test-EvidenceName([string] $name) {
  return $name -eq 'source-binding.json' -or $name -eq 'approval.json' -or $name -eq 'consents.json' -or $name -eq 'state.json' -or
    $name -eq 'operation.lock' -or $name -eq 'state-wal.log' -or $name -like 'hosted-*.json' -or $name -like 'state-*.tmp'
}

if ($PSCmdlet.ParameterSetName -eq 'Drive') {
  if ($VolumeRoot -notmatch '^[A-Za-z]:\\$') { Stop-Inspection 3 }
  Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public class NeedsReviewDriveType {
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetDriveType(string root);
}
'@
  [Console]::Out.WriteLine([NeedsReviewDriveType]::GetDriveType($VolumeRoot))
  exit 0
}

if ([string]::IsNullOrWhiteSpace($Directory) -or $Directory.Contains([char]0)) { Stop-Inspection 3 }
if (-not (Test-Path -LiteralPath $Directory)) { exit 4 }

try {
  $rows = New-Object System.Collections.Generic.List[object]
  $files = New-Object System.Collections.Generic.List[object]
  $otherNames = New-Object System.Collections.Generic.List[string]
  $current = [System.IO.Path]::GetFullPath($Directory)
  $first = $true
  while ($true) {
    $item = Get-Item -LiteralPath $current -Force
    $reparse = [bool]($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)
    $acl = Get-Acl -LiteralPath $current
    $present = Test-DaclPresent $acl
    $rows.Add([ordered]@{
      path = [string]$item.FullName
      isDirectory = [bool]($item.Attributes -band [System.IO.FileAttributes]::Directory)
      reparse = $reparse
      createdTicks = [string]$item.CreationTimeUtc.Ticks
      ownerSid = [string]$acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value
      protected = [bool]$acl.AreAccessRulesProtected
      daclPresent = [bool]$present
      aces = @(Get-AceFacts $acl)
    })
    if ($first -and -not $reparse) {
      $children = @(Get-ChildItem -LiteralPath $current -Force)
      foreach ($child in $children) {
        if (-not (Test-EvidenceName $child.Name)) { $otherNames.Add([string]$child.Name); continue }
        $childReparse = [bool]($child.Attributes -band [System.IO.FileAttributes]::ReparsePoint)
        if ($childReparse) {
          $files.Add([ordered]@{
            name = [string]$child.Name
            isDirectory = [bool]($child.Attributes -band [System.IO.FileAttributes]::Directory)
            reparse = $true
            ownerSid = ''
            daclPresent = $false
            aces = @()
          })
          continue
        }
        $childAcl = Get-Acl -LiteralPath $child.FullName
        $files.Add([ordered]@{
          name = [string]$child.Name
          isDirectory = [bool]($child.Attributes -band [System.IO.FileAttributes]::Directory)
          reparse = $false
          ownerSid = [string]$childAcl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value
          daclPresent = [bool](Test-DaclPresent $childAcl)
          aces = @(Get-AceFacts $childAcl)
        })
      }
    }
    $first = $false
    $parent = [System.IO.Path]::GetDirectoryName($current)
    if ([string]::IsNullOrEmpty($parent) -or $parent -eq $current) { break }
    $current = $parent
  }
  $reportedOthers = @($otherNames.ToArray())
  $overflow = $false
  if ($reportedOthers.Count -gt 64) {
    $overflow = $true
    $reportedOthers = @($reportedOthers[0..63])
  }
  $result = [ordered]@{
    currentUserSid = [string][System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    fileCount = [int]$files.Count
    otherCount = [int]$otherNames.Count
    otherOverflow = [bool]$overflow
    files = @($files.ToArray())
    otherNames = @($reportedOthers)
    chain = $rows
  }
  [Console]::Out.WriteLine(($result | ConvertTo-Json -Compress -Depth 8))
  exit 0
} catch {
  Stop-Inspection 3
}
