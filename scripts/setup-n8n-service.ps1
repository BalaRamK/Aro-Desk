# Setup n8n as Windows Service using NSSM
# Run this script as Administrator

param(
    [string]$Action = "install"
)

$serviceName = "n8n-automation"
$n8nPath = "n8n"  # Uses global npm installation

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   n8n Windows Service Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

function Test-Admin {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Admin)) {
    Write-Host "❌ ERROR: This script requires Administrator privileges" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

function Install-NSSM {
    Write-Host "Checking for NSSM..." -ForegroundColor Yellow
    
    $nssmPath = Get-Command nssm -ErrorAction SilentlyContinue
    
    if ($null -eq $nssmPath) {
        Write-Host "NSSM not found. Installing via Chocolatey..." -ForegroundColor Yellow
        
        # Check if Chocolatey is installed
        $chocoPath = Get-Command choco -ErrorAction SilentlyContinue
        
        if ($null -eq $chocoPath) {
            Write-Host "Installing Chocolatey first..." -ForegroundColor Yellow
            Set-ExecutionPolicy Bypass -Scope Process -Force
            [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
            Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        }
        
        choco install nssm -y
        Write-Host "✅ NSSM installed successfully" -ForegroundColor Green
    } else {
        Write-Host "✅ NSSM already installed" -ForegroundColor Green
    }
}

function Install-Service {
    Write-Host ""
    Write-Host "Installing n8n as Windows service..." -ForegroundColor Yellow
    
    # Check if service already exists
    $existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    
    if ($existingService) {
        Write-Host "⚠️  Service already exists. Removing old service first..." -ForegroundColor Yellow
        nssm stop $serviceName
        nssm remove $serviceName confirm
        Start-Sleep -Seconds 2
    }
    
    # Find n8n executable
    $n8nExe = (Get-Command n8n -ErrorAction SilentlyContinue).Source
    
    if (-not $n8nExe) {
        Write-Host "❌ n8n not found. Please install n8n first:" -ForegroundColor Red
        Write-Host "   npm install -g n8n" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "Installing service with executable: $n8nExe" -ForegroundColor Cyan
    
    # Install service
    nssm install $serviceName $n8nExe
    
    # Set environment variables
    nssm set $serviceName AppEnvironmentExtra N8N_PORT=5678
    nssm set $serviceName AppEnvironmentExtra N8N_BASIC_AUTH_ACTIVE=true
    nssm set $serviceName AppEnvironmentExtra N8N_BASIC_AUTH_USER=admin
    nssm set $serviceName AppEnvironmentExtra N8N_BASIC_AUTH_PASSWORD=changeme
    nssm set $serviceName AppEnvironmentExtra GENERIC_TIMEZONE=UTC
    
    # Set service to auto-start
    nssm set $serviceName Start SERVICE_AUTO_START
    
    # Set working directory
    $workDir = (Get-Location).Path
    nssm set $serviceName AppDirectory $workDir
    
    # Start service
    Write-Host "Starting service..." -ForegroundColor Yellow
    nssm start $serviceName
    
    Start-Sleep -Seconds 3
    
    $status = (Get-Service -Name $serviceName).Status
    
    if ($status -eq "Running") {
        Write-Host ""
        Write-Host "✅ SUCCESS! n8n is now running as a Windows service" -ForegroundColor Green
        Write-Host ""
        Write-Host "Service Details:" -ForegroundColor Cyan
        Write-Host "  Name:     $serviceName" -ForegroundColor White
        Write-Host "  Status:   $status" -ForegroundColor Green
        Write-Host "  URL:      http://localhost:5678" -ForegroundColor White
        Write-Host "  Username: admin" -ForegroundColor White
        Write-Host "  Password: changeme" -ForegroundColor White
        Write-Host ""
        Write-Host "The service will start automatically on system boot." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Management Commands:" -ForegroundColor Cyan
        Write-Host "  Stop:    nssm stop $serviceName" -ForegroundColor White
        Write-Host "  Start:   nssm start $serviceName" -ForegroundColor White
        Write-Host "  Restart: nssm restart $serviceName" -ForegroundColor White
        Write-Host "  Remove:  nssm remove $serviceName confirm" -ForegroundColor White
    } else {
        Write-Host "❌ Service failed to start. Status: $status" -ForegroundColor Red
        Write-Host "Check logs: nssm status $serviceName" -ForegroundColor Yellow
    }
}

function Remove-Service {
    Write-Host ""
    Write-Host "Removing n8n service..." -ForegroundColor Yellow
    
    $existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    
    if ($existingService) {
        nssm stop $serviceName
        nssm remove $serviceName confirm
        Write-Host "✅ Service removed successfully" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Service not found" -ForegroundColor Yellow
    }
}

function Get-ServiceStatus {
    Write-Host ""
    Write-Host "n8n Service Status:" -ForegroundColor Cyan
    Write-Host ""
    
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    
    if ($service) {
        Write-Host "  Name:   $($service.Name)" -ForegroundColor White
        Write-Host "  Status: $($service.Status)" -ForegroundColor $(if ($service.Status -eq "Running") { "Green" } else { "Red" })
        Write-Host "  Start:  $($service.StartType)" -ForegroundColor White
        Write-Host ""
        Write-Host "  URL:    http://localhost:5678" -ForegroundColor White
    } else {
        Write-Host "  ❌ Service not installed" -ForegroundColor Red
    }
    
    Write-Host ""
}

# Main execution
switch ($Action.ToLower()) {
    "install" {
        Install-NSSM
        Install-Service
    }
    "remove" {
        Remove-Service
    }
    "uninstall" {
        Remove-Service
    }
    "status" {
        Get-ServiceStatus
    }
    default {
        Write-Host "Usage: .\setup-n8n-service.ps1 [-Action <install|remove|status>]" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Actions:" -ForegroundColor Cyan
        Write-Host "  install   - Install n8n as Windows service (default)" -ForegroundColor White
        Write-Host "  remove    - Remove n8n service" -ForegroundColor White
        Write-Host "  status    - Show service status" -ForegroundColor White
    }
}
