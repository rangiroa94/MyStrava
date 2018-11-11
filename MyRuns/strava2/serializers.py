from .models import Login, Activity, Workout, User, Lap, GpsCoord
from rest_framework import serializers
from strava2.stravaModel import gpsCoord

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = Login
        fields = ('name', 'url', 'clientID', 'clientSecret', 'callbackURL', 'dateLogin', 'userName')

class ActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Activity
        fields = ('label', 'start_date', 'wid', 'stravaId', 'distance', 'time', 'strDist', 'strTime', 'resolution')

class LapSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lap
        fields = ('lap_index', 'lap_distance', 'lap_time', 'lap_average_speed', 'lap_average_cadence','lap_pace_zone','lap_total_elevation_gain','lap_start_index','lap_end_index')
        
class gpsCoordSerializer(serializers.Serializer):
    gps_index = serializers.IntegerField()
    gps_lat = serializers.FloatField()
    gps_long = serializers.FloatField()
    gps_time = serializers.IntegerField()
        
class WorkoutSerializer(serializers.ModelSerializer):
    act = ActivitySerializer(many=True)
    laps = LapSerializer(many=True)
    gps = gpsCoordSerializer(many=True)
    class Meta:
        model = Workout
        fields = ('actId', 'act', 'name','laps', 'gps')
        