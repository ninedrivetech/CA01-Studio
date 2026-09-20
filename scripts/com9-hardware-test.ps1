$ErrorActionPreference = 'Stop'
$port = [System.IO.Ports.SerialPort]::new('COM9',115200,[System.IO.Ports.Parity]::None,8,[System.IO.Ports.StopBits]::One)
$port.ReadTimeout=100
$port.WriteTimeout=10000
$events=[System.Collections.Generic.List[object]]::new()
$checks=[System.Collections.Generic.List[object]]::new()
$original=$null
$testError=$null
$restoreError=$null
function Send-Frame([byte]$command,[byte[]]$payload=@()) {
    Start-Sleep -Milliseconds 160
    $length=$payload.Length+1
    $bytes=[byte[]](@(0xFD,($length -shr 8),($length -band 255),$command)+$payload)
    $port.Write($bytes,0,$bytes.Length)
    $events.Add(@{direction='TX';time=[DateTime]::UtcNow.ToString('o');hex=([BitConverter]::ToString($bytes)).Replace('-',' ')})
}
function Read-Reply([int]$timeout=5000) {
    $deadline=[DateTime]::UtcNow.AddMilliseconds($timeout)
    while([DateTime]::UtcNow -lt $deadline) {
        try {
            $head=$port.ReadByte()
            $length=if($head -eq 0x5F){18}elseif($head -eq 0x5E){13}else{1}
            $bytes=[System.Collections.Generic.List[byte]]::new();$bytes.Add([byte]$head)
            while($bytes.Count -lt $length) { if([DateTime]::UtcNow -gt $deadline){throw 'Partial reply timeout'};try{$bytes.Add([byte]$port.ReadByte())}catch [System.TimeoutException]{} }
            $events.Add(@{direction='RX';time=[DateTime]::UtcNow.ToString('o');hex=([BitConverter]::ToString($bytes.ToArray())).Replace('-',' ')})
            return ,$bytes.ToArray()
        } catch [System.TimeoutException] {}
    }
    throw 'Device response timeout'
}
function Wait-Code([int]$code,[int]$timeout=20000) {
    $deadline=[DateTime]::UtcNow.AddMilliseconds($timeout)
    while([DateTime]::UtcNow -lt $deadline) {
        $reply=Read-Reply ([int]($deadline-[DateTime]::UtcNow).TotalMilliseconds)
        if($reply[0] -eq 0x45){throw 'Device rejected command (45)'}
        if($reply[0] -eq $code){return ,$reply}
    }
    throw "Expected response $code"
}
function Configure([string]$marks) { Send-Frame 6 ([byte[]](@(1)+[Text.Encoding]::ASCII.GetBytes($marks)));$null=Wait-Code 0x4F }
try {
    $port.Open();Start-Sleep -Milliseconds 700
    Send-Frame 0x21;$null=Wait-Code 0x4F
    Send-Frame 5;$original=Wait-Code 0x5F
    Send-Frame 0x0B;$special=Wait-Code 0x5E
    $checks.Add(@{name='initial configuration';parameters=@($original);special=@($special);passed=$true})
    Configure '[m3][v3][s10][t5]'
    Send-Frame 5;$configured=Wait-Code 0x5F
    if($configured[3] -ne 10 -or $configured[4] -ne 3 -or $configured[5] -ne 5 -or $configured[6] -ne 3){throw 'Parameter readback mismatch'}
    $checks.Add(@{name='parameter save/readback';passed=$true})
    [Text.Encoding]::RegisterProvider([Text.CodePagesEncodingProvider]::Instance)
    foreach($id in @(0,1,3,4,5)) {
        $encoder=switch($id){0{[Text.Encoding]::GetEncoding(936)}1{[Text.Encoding]::GetEncoding(936)}3{[Text.Encoding]::Unicode}4{[Text.Encoding]::BigEndianUnicode}5{[Text.Encoding]::UTF8}}
        Send-Frame 1 ([byte[]](@($id)+$encoder.GetBytes('知了模块编码测试。')))
        $null=Wait-Code 0x41;$null=Wait-Code 0x4F
        $checks.Add(@{name="encoding $id synthesis acknowledged/completed";passed=$true})
    }
    foreach($voice in @(3,51,52,53,54,55,56,57)) {
        Configure "[m$voice]"
        Send-Frame 1 ([byte[]](@(5)+[Text.Encoding]::UTF8.GetBytes('知了语音测试。')))
        $null=Wait-Code 0x41;$null=Wait-Code 0x4F
        $checks.Add(@{name="voice $voice synthesis acknowledged/completed";passed=$true})
    }
    Send-Frame 1 ([byte[]](@(5)+[Text.Encoding]::UTF8.GetBytes('现在测试暂停和继续。这是一段稍长的语音，用于验证播放过程中控制命令是否有效。')))
    $null=Wait-Code 0x41
    Send-Frame 3;$null=Wait-Code 0x41
    Send-Frame 4;$null=Wait-Code 0x41
    Send-Frame 2;$null=Wait-Code 0x41
    Send-Frame 0x21;$null=Wait-Code 0x4F
    $checks.Add(@{name='pause/resume/stop and idle query';passed=$true})
} catch {
    $testError=$_.Exception.Message
} finally {
    if($null -ne $original -and -not $port.IsOpen){$restoreError='Port closed before original parameters could be restored'}
    if($port.IsOpen -and $null -ne $original) {
        try {
            Send-Frame 2;$null=Wait-Code 0x41
            $names=@('s','v','t','m','x','f','n','y','b','z','i','r')
            $marks=''
            for($i=0;$i -lt $names.Length;$i++){$marks+='['+$names[$i]+$original[$i+3]+']'}
            Configure $marks
            Send-Frame 5;$restored=Wait-Code 0x5F
            $same=$true
            for($i=3;$i -lt 15;$i++){if($original[$i] -ne $restored[$i]){$same=$false}}
            $checks.Add(@{name='restore original voice parameters';passed=$same;readback=@($restored)})
            if(-not $same){$restoreError='Original parameter restoration mismatch'}
        } catch { $restoreError=$_.Exception.Message;$checks.Add(@{name='restore original parameters';passed=$false;error=$restoreError}) }
    }
    if($port.IsOpen){$port.Close()};$port.Dispose()
    $report=@{date=[DateTime]::UtcNow.ToString('o');port='COM9';baud=115200;checks=$checks;events=$events;audioQualityAssessed=$false;error=$testError;restoreError=$restoreError}
    $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $PSScriptRoot '..\docs\com9-hardware-report.json') -Encoding utf8
    $checks | ConvertTo-Json -Depth 5
}
if($testError -or $restoreError){throw "Hardware test failed. Test: $testError; Restore: $restoreError"}
