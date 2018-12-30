from django.shortcuts import get_object_or_404, render, redirect
from .models import Login, Activity, Workout, Lap, GpsCoord, HeartRate, Speed, Elevation, Distance, Split
from django.views import generic
from stravalib import Client
from datetime import datetime, timedelta
import re
from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from strava2.serializers import WorkoutSerializer, LapSerializer
from strava2.stravaModel import gpsCoord

_loginId = 0

class IndexView(generic.ListView):
    template_name = 'strava2/index.html'
    context_object_name = 'listLogin'

    def get_queryset(self):
        return Login.objects.all()

def login(request,loginId):
    global _loginId
    login = get_object_or_404(Login, pk=loginId)
    login.userName = 'In Progress...'
    request.session['loginID'] = loginId
    _loginId=loginId
    client = Client()
    url = client.authorization_url(client_id=login.clientID,
                                   scope='write',
                                   redirect_uri=login.callbackURL)
    return redirect(login.url+'/?client_id='+login.clientID+'&redirect_uri='+login.callbackURL+'&response_type=code')

def auth(request):
    global _loginId
    print ("Auth")
    code = request.GET.get('code')
    print ("code=",code)
    login = get_object_or_404(Login, pk=_loginId)
    client = Client()
    access_token = client.exchange_code_for_token(client_id=login.clientID,
                                                  client_secret=login.clientSecret,
                                                  code=code)
    print ("access_token=",access_token)
    request.session['access_token'] = access_token
    return redirect('/strava2/activities')

class ActivitiesView(generic.ListView):
    global _loginId
    print ('ActivitiesView')
    template_name = 'strava2/activity_list.html'
    context_object_name = 'activities_list'

    def get_queryset(self):
        self.client = Client(self.request.session.get('access_token'))
        login = get_object_or_404(Login, pk=_loginId)
        #d = datetime(2018, 5, 5)
        date_1_day_ago = login.lastUpdate - timedelta(days=1)
        activities = self.client.get_activities(after=date_1_day_ago,limit=45)
        #activities = self.client.get_activities(after=d,limit=15)
        act = None
        for activity in activities:
            act = self.client.get_activity(activity.id)
            strDate = act.start_date.strftime("%Y-%m-%d %H:%M:%S")
            print ('start_date=',strDate)
            print ('act.distance=',act.distance)
            print ('act.type=',act.type)
            dist = re.sub(' .*$','',str(act.distance))
            print ('dist=',dist)
            strDistance = format(float(dist)/1000,'.2f')
            print ('distance=',strDistance)
            print ('stravaId=',act.upload_id)
            print ('name=',act.name)
            print ('time=',act.elapsed_time)
            print ('splits_metric=',act.splits_metric)
            if not Activity.objects.filter(stravaId=activity.id).exists():
                workout=Workout.objects.create(name=act.name)
                print ('wid=',workout.id)
                activity.wid=workout.id
                stravaAct = Activity(strTime=strDate,strDist=strDistance,distance=act.distance,\
                    time=act.elapsed_time,label=act.name,stravaId=activity.id,wid=workout.id,workout_id=workout.id)
                stravaAct.save()
                Workout.objects.filter(id=workout.id).update(actId=stravaAct.id)
                split = Split.objects.filter(workout__id=workout.id)
                print ('Split first element=',split.count())
                if not split.count():
                    objs = [
                        Split(split_index=i,split_distance=split.distance,split_time=split.elapsed_time,workout=workout) for i, split in enumerate(act.splits_metric)
                    ]
                    split = Split.objects.bulk_create(objs)
            else:
                Activity.objects.filter(stravaId=activity.id).update(strTime=strDate,strDist=strDistance)
                
        if act is not None : 
            login.lastUpdate = datetime.now()
            login.save()
        return Activity.objects.all().order_by('-strTime')
     
    def get_context_data(self, **kwargs):
        context = super(ActivitiesView, self).get_context_data(**kwargs)
        login = get_object_or_404(Login, pk=_loginId)
        user = self.client.get_athlete()
        print ("lastname=",user.lastname)
        print ('mail=',user.email)
        login.userName = user.lastname
        context['login'] = login
        return context

class WorkoutView(generic.DetailView):
    global _loginId
    print ('WorkoutView')

    model = Workout
    template_name = 'strava2/workout.html'

    def get_context_data(self, **kwargs):
        context = super(WorkoutView, self).get_context_data(**kwargs)
        login = get_object_or_404(Login, pk=_loginId)
        print ("Session", self.request.session)
        print ('Token=',self.request.session.get('access_token'))
        user = Client(self.request.session.get('access_token')).get_athlete()
        print ("Workout lastname=",user.lastname)
        login.userName = user.lastname
        context['login'] = login
        return context
      
class WorkoutDetail(APIView):
    
    def get_object(self, pk):
        try:
            print('WorkoutDetail, get_object, pk=',pk)
            w =Workout.objects.get(pk=pk)
            print('WorkoutDetail, w=',w)
            return w
        except workout.DoesNotExist:
            raise Http404

    def get(self, request, pk, format=None):
        workout = self.get_object(pk)
        self.client = Client(self.request.session.get('access_token'))
        print('WorkoutDetail, client=',self.client)
        types = ['time', 'distance', 'latlng', 'altitude', 'heartrate', 'velocity_smooth']
        print('WorkoutDetail, workout.actId=',workout.actId)
        activity = get_object_or_404(Activity, id=workout.actId)
        print('WorkoutDetail, activity.stravaId=',activity.stravaId)
        streams = self.client.get_activity_streams(activity_id=activity.stravaId,resolution='medium',types=types)
        print ('streams=',streams)
        #print('time seq size=',len(streams['time'].data))
        #print('dist seq',streams['distance'].data)
        #print('speed seq',streams['velocity_smooth'].data)
        #print('elevation seq',streams['altitude'].data)
        #print('HR seq',streams['heartrate'].data)
        #print('gps seq',streams['latlng'].data)
        gps = GpsCoord.objects.filter(workout__id=workout.id)
        print ('gps first element=',gps.count())
        if not gps.count():
            print ('empty query, create SQL record')
            objs = [
                GpsCoord(gps_index=i,gps_time=streams['time'].data[i],gps_lat=gps[0],gps_long=gps[1],workout=workout) for i, gps in enumerate(streams['latlng'].data)
            ]
            #print ('GPS seq')
            #for i, gps in enumerate(streams['latlng'].data):
            #    print ('gps_index:',i,'gps_lat:',gps[0],'gps_long:',gps[1],'gps_time:',streams['time'].data[i])
            coord = GpsCoord.objects.bulk_create(objs)
        
        hr = HeartRate.objects.filter(workout__id=workout.id)
        if not hr.count():
            objs = [
                HeartRate(hr_index=i,hr_value=hr,workout=workout) for i, hr in enumerate(streams['heartrate'].data)
            ]
            coord = HeartRate.objects.bulk_create(objs)
            
        distance = Distance.objects.filter(workout__id=workout.id)
        if not distance.count():
            objs = [
                Distance(distance_index=i,distance_value=dist,workout=workout) for i, dist in enumerate(streams['distance'].data)
            ]
            coord = Distance.objects.bulk_create(objs)
            
        speed = Speed.objects.filter(workout__id=workout.id)
        if not speed.count():
            objs = [
                Speed(speed_index=i,speed_value=speed,workout=workout) for i, speed in enumerate(streams['velocity_smooth'].data)
            ]
            coord = Speed.objects.bulk_create(objs)
            
        elevation = Elevation.objects.filter(workout__id=workout.id)
        if not elevation.count():
            objs = [
                Elevation(elevation_index=i,elevation_value=elevation,workout=workout) for i, elevation in enumerate(streams['altitude'].data)
            ]
            coord = Elevation.objects.bulk_create(objs)
            
        laps = self.client.get_activity_laps(activity.stravaId)
        i=0
        for strLap in laps:
            i+=1
            print ('lap=',strLap)
            print ('strLap,start_index=',strLap.start_index)
            print ('strLap,end_index=',strLap.end_index)
            print ('strLap,lap_average_cadence=',strLap.average_cadence)
            print ('start_date=',strLap.start_date)
            print ('lap_time=',strLap.elapsed_time)
            print ('lap_distance=',strLap.distance)
            if strLap.average_cadence is None:
                strLap.average_cadence=0;
            lap = Lap.objects.filter(workout__id=workout.id, lap_index=i)
            if not lap.exists():
                lap = Lap.objects.create(lap_index=strLap.lap_index, lap_start_index=strLap.start_index, lap_end_index=strLap.end_index, lap_distance=strLap.distance, lap_time=strLap.elapsed_time, lap_start_date=strLap.start_date, lap_average_speed=strLap.average_speed, lap_average_cadence=strLap.average_cadence, lap_pace_zone=strLap.pace_zone, lap_total_elevation_gain=strLap.total_elevation_gain, workout=workout)
                print ('total_elevation_gain=',strLap.total_elevation_gain)
                print ('pace_zone=',strLap.pace_zone)
                
        serializer = WorkoutSerializer(workout)
        #print (serializer.data)
        return Response(serializer.data)
        
        