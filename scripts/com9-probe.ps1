$ErrorActionPreference = 'Stop'
$port = [System.IO.Ports.SerialPort]::new('COM9', 115200, [System.IO.Ports.Parity]::None, 8, [System.IO.Ports.StopBits]::One)
$port.ReadTimeout = 100
$port.WriteTimeout = 5000
try {
    $port.Open()
    Start-Sleep -Milliseconds 700
    foreach ($command in @(0x21, 0x05, 0x0B)) {
        $frame = [byte[]]@(0xFD, 0x00, 0x01, $command)
        $port.Write($frame, 0, $frame.Length)
        $received = [System.Collections.Generic.List[byte]]::new()
        $deadline = [DateTime]::UtcNow.AddSeconds(2)
        while ([DateTime]::UtcNow -lt $deadline) {
            try { $received.Add([byte]$port.ReadByte()) } catch [System.TimeoutException] { if ($received.Count -gt 0) { break } }
        }
        [pscustomobject]@{ Command = ('{0:X2}' -f $command); Response = (($received | ForEach-Object { '{0:X2}' -f $_ }) -join ' ') } | ConvertTo-Json -Compress
        Start-Sleep -Milliseconds 150
    }
} finally { if ($port.IsOpen) { $port.Close() }; $port.Dispose() }
