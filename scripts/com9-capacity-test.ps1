param([switch]$Boundary)
$ErrorActionPreference='Stop'
$port=[IO.Ports.SerialPort]::new('COM9',115200,[IO.Ports.Parity]::None,8,[IO.Ports.StopBits]::One)
$port.ReadTimeout=100;$port.WriteTimeout=10000
$results=[Collections.Generic.List[object]]::new()
$original=$null
$testError=$null
$restoreError=$null
function Send([int]$command,[byte[]]$payload=@()){
  Start-Sleep -Milliseconds 160
  $n=$payload.Length+1
  $bytes=[byte[]](@(253,($n -shr 8),($n -band 255),$command)+$payload)
  $port.Write($bytes,0,$bytes.Length)
}
function Response([int]$timeout=3000){
  $deadline=[DateTime]::UtcNow.AddMilliseconds($timeout)
  while([DateTime]::UtcNow -lt $deadline){try{
    $head=$port.ReadByte();$count=if($head -eq 95){18}elseif($head -eq 94){13}else{1};$data=[Collections.Generic.List[byte]]::new();$data.Add([byte]$head)
    while($data.Count -lt $count){try{$data.Add([byte]$port.ReadByte())}catch [TimeoutException]{if([DateTime]::UtcNow -gt $deadline){throw 'Partial reply'}}}
    return ,$data.ToArray()
  }catch [TimeoutException]{}}
  throw 'No reply'
}
function Until([int[]]$codes){for($i=0;$i -lt 30;$i++){$r=Response;if($codes -contains [int]$r[0]){return ,$r}};throw 'No matching reply'}
try{
  $port.Open();Start-Sleep -Milliseconds 700
  Send 5;$original=Until @(95)
  Send 6 ([byte[]](@(1)+[Text.Encoding]::ASCII.GetBytes('[v0]')));$null=Until @(79)
  [Text.Encoding]::RegisterProvider([Text.CodePagesEncodingProvider]::Instance)
  $encodingIds=if($Boundary){@(0,1,3,4,5)}else{@(5,1)}
  foreach($encoding in $encodingIds){
    $encoder=switch($encoding){3{[Text.Encoding]::Unicode}4{[Text.Encoding]::BigEndianUnicode}5{[Text.Encoding]::UTF8}default{[Text.Encoding]::GetEncoding(936)}}
    $unit=$encoder.GetBytes('知了测试。')
    $sizes=if($encoding -eq 5){@(60,300,399,400,600,1000,1500,1800,1998,2000)}else{@(100,300,399,400,600,1000,2000,3000,3998,4000)}
    if($Boundary){$sizes=if($encoding -in @(3,4)){@(400,402,500,512)}else{@(400,401,500,512)}}
    foreach($size in $sizes){
      $data=[Collections.Generic.List[byte]]::new()
      while($data.Count+$unit.Length -le $size){$data.AddRange([byte[]]$unit)}
      $padding=$encoder.GetBytes('.')
      while($data.Count -lt $size){$data.AddRange([byte[]]$padding)}
      $watch=[Diagnostics.Stopwatch]::StartNew()
      Send 1 ([byte[]](@($encoding)+$data.ToArray()))
      $reply=Until @(65,69)
      $result=@{encoding=$encoding;textBytes=$size;reply=('{0:X2}' -f $reply[0]);elapsedMs=$watch.ElapsedMilliseconds}
      $results.Add($result);$result|ConvertTo-Json -Compress
      Send 2;$null=Until @(65)
      Send 33;$null=Until @(79)
    }
  }
}catch{
  $testError=$_.Exception.Message
}finally{
  $restored=$false
  if($null -ne $original -and -not $port.IsOpen){$restoreError='Port closed before original volume could be restored'}
  if($port.IsOpen -and $null -ne $original){try{
    Send 2;$null=Until @(65)
    Send 6 ([byte[]](@(1)+[Text.Encoding]::ASCII.GetBytes('[v'+$original[4]+']')));$null=Until @(79)
    Send 5;$readback=Until @(95);$restored=$readback[4] -eq $original[4]
    if(-not $restored){$restoreError='Original volume restoration mismatch'}
  }catch{$restoreError=$_.Exception.Message}}
  if($port.IsOpen){$port.Close()};$port.Dispose()
  $reportName=if($Boundary){'com9-boundary-report.json'}else{'com9-capacity-report.json'}
  @{date=[DateTime]::UtcNow.ToString('o');port='COM9';baud=115200;results=$results;restored=$restored;error=$testError;restoreError=$restoreError}|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $PSScriptRoot "..\docs\$reportName") -Encoding utf8
  Write-Output "Original volume restored: $restored"
}
if($testError -or $restoreError -or -not $restored){throw "Capacity test failed. Test: $testError; Restore: $restoreError"}
