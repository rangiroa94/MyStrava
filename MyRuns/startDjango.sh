if ! ps -edf | grep celery | grep -v grep > /dev/null 2>&1
then
	echo "Starting celery ..."
	./startCelery.sh &
fi
python ~fli/dev/MyRuns/manage.py runserver 192.168.1.68:3000
