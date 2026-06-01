@echo off
set "GIT_SSH_COMMAND=C:\Windows\System32\OpenSSH\ssh.exe -i D:/vibevideo/.ssh/id_ed25519 -o IdentitiesOnly=yes -o UserKnownHostsFile=D:/vibevideo/.ssh/known_hosts"
git %*
