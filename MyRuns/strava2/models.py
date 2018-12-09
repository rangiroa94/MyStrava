from django.db import models
from django.utils import timezone
from datetime import date

class Login(models.Model):
    name = models.CharField(max_length=20,default='')
    url = models.CharField(max_length=200,default='')
    clientID = models.CharField(max_length=200,default='')
    clientSecret = models.CharField(max_length=200,default='')
    callbackURL = models.CharField(max_length=200,default='')
    dateLogin = models.DateField(timezone.now())
    userName = models.CharField(max_length=20,default='')
    lastUpdate = models.DateTimeField(default=date(2000,1,1))

    def __str__(self):              # __unicode__ on Python 2
        return self.name

    def last_login(self):
        return self.dateLogin

class Workout(models.Model):
    name = models.CharField(max_length=20,default='')
    actId = models.IntegerField(default=0)
    
    def __str__(self):              # __unicode__ on Python 2
        return str(self.id)
        
class Activity(models.Model):
    label = models.CharField(max_length=200,default='')
    start_date = models.DateTimeField(default=timezone.now)
    wid = models.IntegerField(default=0,unique=True)
    stravaId = models.IntegerField(default=0)
    distance = models.IntegerField(default=0)
    time = models.CharField(max_length=20,default='')
    strDist = models.CharField(max_length=10,default="")
    strTime = models.CharField(max_length=20,default="")
    workout = models.ForeignKey(Workout, related_name='act', on_delete=models.PROTECT)
    resolution = models.IntegerField(default=1000)
    
    def __str__(self):              # __unicode__ on Python 2
        return str(self.stravaId)
        
class Lap(models.Model):
    lap_index = models.IntegerField(default=0)
    lap_start_index = models.IntegerField(default=0)
    lap_end_index = models.IntegerField(default=0)
    lap_distance = models.IntegerField(default=0)
    lap_time = models.DurationField(default=0)
    lap_start_date = models.CharField(max_length=30,default='')
    lap_average_speed = models.FloatField(default=0)
    lap_average_cadence = models.IntegerField(default=0)
    lap_pace_zone = models.IntegerField(default=0)
    lap_total_elevation_gain = models.FloatField(default=0)
    workout = models.ForeignKey(Workout, related_name='laps', on_delete=models.PROTECT)
    def __str__(self):              # __unicode__ on Python 2
        return self.workout.name
        
class GpsCoord(models.Model):
    gps_index = models.IntegerField(default=0)
    gps_lat = models.FloatField(default=0)
    gps_long = models.FloatField(default=0)
    gps_time = models.IntegerField(default=0)
    workout = models.ForeignKey(Workout, related_name='gps', on_delete=models.PROTECT)
    def __str__(self):              # __unicode__ on Python 2
        return self.workout.name
        
class HeartRate(models.Model):
    hr_index = models.IntegerField(default=0)
    hr_value = models.FloatField(default=0)
    workout = models.ForeignKey(Workout, related_name='heartrate', on_delete=models.PROTECT)
    def __str__(self):              # __unicode__ on Python 2
        return self.workout.name
        
class Speed(models.Model):
    speed_index = models.IntegerField(default=0)
    speed_value = models.FloatField(default=0)
    workout = models.ForeignKey(Workout, related_name='speed', on_delete=models.PROTECT)
    def __str__(self):              # __unicode__ on Python 2
        return self.workout.name

class Elevation(models.Model):
    elevation_index = models.IntegerField(default=0)
    elevation_value = models.FloatField(default=0)
    workout = models.ForeignKey(Workout, related_name='elevation', on_delete=models.PROTECT)
    def __str__(self):              # __unicode__ on Python 2
        return self.workout.name
        
class User(models.Model):
    auth = models.BooleanField(default=False)
    workout = models.ForeignKey(Workout, on_delete=models.PROTECT)

