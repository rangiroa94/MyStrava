ssh -x fli@Diskstation rm -rf  dev/MyRuns/frontend/*
scp -r /drives/D/Perso/MyRuns/dist fli@Diskstation:dev/MyRuns/frontend/
ssh -x fli@Diskstation ". /etc/profile ; cd dev/MyRuns; ./uptadeBootstrap.sh"
