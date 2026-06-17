Add-Type -AssemblyName System.IO.Compression.FileSystem

$homeDir = $env:USERPROFILE
$srcPath = Join-Path $homeDir ".qclaw\workspace\CanvasFlow_AI_Studio_软件操作说明书.docx"
$tempPath = "D:\vibevideo\temp_doc.docx"

Copy-Item $srcPath $tempPath -ErrorAction Stop

$zip = [System.IO.Compression.ZipFile]::OpenRead($tempPath)
$entry = $zip.Entries | Where-Object { $_.FullName -eq 'word/document.xml' }
$stream = $entry.Open()
$reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
$xmlContent = $reader.ReadToEnd()
$reader.Close()
$stream.Close()
$zip.Dispose()

[xml]$xml = $xmlContent
$ns = @{ w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main' }
$texts = $xml.SelectNodes('//w:t', $ns)
$sb = New-Object System.Text.StringBuilder
foreach ($t in $texts) {
    if ($t.InnerText.Trim()) {
        [void]$sb.AppendLine($t.InnerText)
    }
}

$output = $sb.ToString()
[System.IO.File]::WriteAllText("D:\vibevideo\docx_content.txt", $output, [System.Text.Encoding]::UTF8)
Write-Host "Extracted $($texts.Count) text nodes"
Remove-Item $tempPath -ErrorAction SilentlyContinue
