# Run once from macOS Terminal: pwsh -NoProfile -File ./scripts/c02-authorize-mail.ps1
# Requires ExchangeOnlineManagement and an administrator for Evan's Exchange tenant.
$ErrorActionPreference = 'Stop'
$address = 'evan@thewowski.com'
$tenant = '63ffce29-0c92-4761-a1aa-b750f1e86faa'
$app = '05985af6-cf25-47c3-b126-b7f3d89e86d6'
$principal = '9bfa81ef-4c85-438f-9f7e-209a2ea8f30a'
$scopeName = 'C02 Evan mailbox only'
$roleName = 'C02 send as Evan'

Import-Module ExchangeOnlineManagement
Connect-ExchangeOnline -UserPrincipalName $address -ShowBanner:$false
try {
    $connections = @(Get-ConnectionInformation)
    if ($connections.Count -ne 1 -or $connections[0].TenantID -ne $tenant) {
        throw 'Expected one Exchange session in the configured tenant. Start from a fresh Terminal command.'
    }
    $mailbox = Get-Mailbox -Identity $address
    $mailboxId = [guid]$mailbox.ExternalDirectoryObjectId
    if ($mailboxId -eq [guid]::Empty -or [string]$mailbox.PrimarySmtpAddress -ne $address) {
        throw 'Exchange returned an unexpected mailbox. Check the primary address.'
    }
    $filter = "ExternalDirectoryObjectId -eq '$mailboxId'"
    $targets = @(Get-Recipient -Filter $filter)
    if ($targets.Count -ne 1 -or [string]$targets[0].PrimarySmtpAddress -ne $address) {
        throw 'The recipient scope must match only the intended mailbox.'
    }
    $existing = @(Get-ServicePrincipal | Where-Object { $_.ObjectId -eq $principal -or $_.AppId -eq $app })
    if ($existing.Count -eq 0) {
        New-ServicePrincipal -AppId $app -ObjectId $principal -DisplayName 'C02 appointment email' | Out-Null
    } elseif ($existing.Count -ne 1 -or $existing[0].ObjectId -ne $principal -or $existing[0].AppId -ne $app) {
        throw 'The existing Exchange app reference has different IDs.'
    }
    $scope = Get-ManagementScope | Where-Object Name -eq $scopeName
    if (!$scope) {
        New-ManagementScope -Name $scopeName -RecipientRestrictionFilter $filter | Out-Null
    } elseif (($scope.RecipientFilter -replace '[()\s]', '') -ne ($filter -replace '\s', '')) {
        throw 'An existing scope has a different filter. Review it before continuing.'
    }
    $existingGrant = @(Test-ServicePrincipalAuthorization -Identity $principal)
    if ($existingGrant | Where-Object { $_.RoleName -ne 'Application Mail.Send' -or [string]$_.AllowedResourceScope -ne $scopeName }) {
        throw 'This app already has a different Exchange grant. Review it before continuing.'
    }
    if (!$existingGrant.Count) {
        New-ManagementRoleAssignment -Name $roleName -App $principal -Role 'Application Mail.Send' -CustomResourceScope $scopeName | Out-Null
    }
    $result = @(Test-ServicePrincipalAuthorization -Identity $principal -Resource $address)
    $result | Format-Table RoleName, AllowedResourceScope, InScope
    if (!($result | Where-Object { $_.RoleName -eq 'Application Mail.Send' -and [string]$_.InScope -eq 'True' })) {
        throw 'Send permission is not yet confirmed for Evan. Check the assignment before proceeding.'
    }
    $other = Get-Mailbox -ResultSize 2 | Where-Object { [string]$_.PrimarySmtpAddress -ne $address } | Select-Object -First 1
    if ($other) {
        $outside = @(Test-ServicePrincipalAuthorization -Identity $principal -Resource $other.PrimarySmtpAddress.ToString())
        if (!($outside | Where-Object { $_.RoleName -eq 'Application Mail.Send' -and [string]$_.InScope -eq 'False' }) -or
            ($outside | Where-Object { [string]$_.InScope -eq 'True' })) {
            throw 'Could not verify the other mailbox is outside the app scope.'
        }
        Write-Output 'A second mailbox tested outside the scope.'
    }
    Write-Output 'Exchange verified the C02 send permission for evan@thewowski.com.'
} finally {
    Disconnect-ExchangeOnline -Confirm:$false
}
