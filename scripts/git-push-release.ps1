# Git 走 Windows OpenSSH + 英文路径密钥，避免 Git Bash SSH 在中文用户目录下乱码
$env:GIT_SSH_COMMAND = 'C:/Windows/System32/OpenSSH/ssh.exe -i D:/vibevideo/.ssh/id_ed25519 -o IdentitiesOnly=yes -o UserKnownHostsFile=D:/vibevideo/.ssh/known_hosts'

Set-Location $PSScriptRoot\..

Write-Host "Pushing branch..."
git push -u origin feat/hermes-p2-agent-experience
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Pushing tag v0.2.0..."
git push origin v0.2.0
exit $LASTEXITCODE
