param(
    [int]$Port = 8080,
    [string]$Root = $PSScriptRoot
)

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $Port)
$listener.Start()

$ipList = @()
try {
    $ipList = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notmatch '^169\.' } | ForEach-Object { $_.IPAddress }
} catch {}

if ($ipList.Count -eq 0) {
    $ipList = @("192.168.1.19")
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  TagX Calculator LAN Web Server Running" -ForegroundColor Cyan
Write-Host "  Local URL: http://localhost:$Port/" -ForegroundColor Yellow
foreach ($ip in $ipList) {
    Write-Host "  LAN URL:   http://${ip}:$Port/" -ForegroundColor Yellow
}
Write-Host "  Serving:   $Root" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Green

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".txt"  = "text/plain; charset=utf-8"
    ".woff" = "font/woff"
    ".woff2"= "font/woff2"
    ".ttf"  = "font/ttf"
}

function HandleRequest($tcpClient, $rootDir, $types) {
    try {
        $stream = $tcpClient.GetStream()
        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII)
        $firstLine = $reader.ReadLine()
        if (-not $firstLine) {
            $tcpClient.Close()
            return
        }

        $parts = $firstLine.Split(" ")
        if ($parts.Length -lt 2) {
            $tcpClient.Close()
            return
        }

        $rawUrl = $parts[1]
        $urlPath = $rawUrl.Split("?")[0]
        $urlPath = [System.Uri]::UnescapeDataString($urlPath)

        if ($urlPath -eq "/" -or $urlPath -eq "") {
            $urlPath = "/index.html"
        }

        $relPath = $urlPath.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
        $filePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($rootDir, $relPath))

        if (-not $filePath.StartsWith($rootDir, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $filePath -PathType Leaf)) {
            $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain`r`nContent-Length: $($notFound.Length)`r`nConnection: close`r`n`r`n"
            $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            $stream.Write($notFound, 0, $notFound.Length)
            $stream.Flush()
            $tcpClient.Close()
            return
        }

        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        $contentType = "application/octet-stream"
        if ($types.ContainsKey($ext)) {
            $contentType = $types[$ext]
        }

        $fileBytes = [System.IO.File]::ReadAllBytes($filePath)
        $header = "HTTP/1.1 200 OK`r`nContent-Type: $contentType`r`nContent-Length: $($fileBytes.Length)`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`n`r`n"
        $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)

        $stream.Write($headerBytes, 0, $headerBytes.Length)
        $stream.Write($fileBytes, 0, $fileBytes.Length)
        $stream.Flush()
    } catch {
    } finally {
        try { $tcpClient.Close() } catch {}
    }
}

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        HandleRequest $client $Root $mimeTypes
    }
} finally {
    $listener.Stop()
}
