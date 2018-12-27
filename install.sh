ssh -x fli@Diskstation rm -rf  dev/MyRuns/frontend/*
scp -r /drives/C/Users/Thomas/my-app/dist fli@Diskstation:dev/MyRuns/frontend/
ssh -x fli@Diskstation ". /etc/profile ; cd dev/MyRuns; ./uptadeBootstrap.sh"
