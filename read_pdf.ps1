# Read PDFs using .NET
Add-Type -AssemblyName System.IO

function Get-TextFromPDF {
    param([string]$path)

    try {
        $doc = [System.IO.File]::ReadAllBytes($path)
        # Try to extract text between BT and ET markers (PDF text objects)
        $content = [System.Text.Encoding]::ASCII.GetString($doc)

        # Find text between stream/endstream
        $matches = [regex]::Matches($content, '\(([^)]+)\)|\(([^)]+)\)\s* Tj')
        $texts = @()
        foreach ($m in $matches) {
            if ($m.Groups[1].Value) { $texts += $m.Groups[1].Value }
            if ($m.Groups[2].Value) { $texts += $m.Groups[2].Value }
        }

        # Simple extraction - look for readable text
        $result = ""
        $inText = $false
        foreach ($line in $content -split "`n") {
            if ($line -match '^\((.+)\)\s*$') {
                $text = $matches = $line -replace '^\((.+)\)\s*$', '$1'
                $text = $text -replace '\\[nrt]', ' '
                $text = $text -replace '\\([0-9]{3})', {[char]([int]"$($matches.Groups[1].Value)" - 48*16)}
                if ($text -match '[^\x00-\x1F\x7F]') {
                    $result += $text + " "
                }
            }
        }
        return $result.Substring(0, [Math]::Min(5000, $result.Length))
    }
    catch {
        return "Error: $_"
    }
}

Write-Host "=== 即梦 CLI 体验指南 ==="
Get-TextFromPDF "D:\vibevideo\即梦 CLI 体验指南.pdf"
