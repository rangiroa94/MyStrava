ls frontend/dist/*main*.js
prodkey=`basename frontend/dist/*main*.js | sed -e "s/main\.//" -e "s/.bundle\.js//" -e "s/\.js//" `
echo "prodkey="$prodkey
target=strava2/templates/strava2
indexHtml=workout.html

cat $target/$indexHtml | sed -re "s/(main\.)([0-9a-z]*)(\.js)/\1${prodkey}\3/" > $target/$indexHtml.new
mv $target/$indexHtml.new $target/$indexHtml

python manage.py collectstatic << FF
yes
FF

