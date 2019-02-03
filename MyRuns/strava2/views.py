from django.shortcuts import get_object_or_404, render, redirect
from strava2.models import Login, Activity, Workout, Lap, GpsCoord, HeartRate, \
    Speed, Elevation, Distance, Split, StravaUser
from strava2.tasks import get_activities
from django.views import generic
from django.http import JsonResponse
from stravalib import Client
from datetime import datetime, timedelta
import re
from rest_framework import viewsets, serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from strava2.serializers import WorkoutSerializer, LapSerializer, ActivityItemSerializer
from strava2.stravaModel import gpsCoord
import sys
from celery.result import AsyncResult

_loginId = 0
_progress = {}

class IndexView(generic.ListView):
    template_name = 'strava2/index.html'
    context_object_name = 'listLogin'

    def get_queryset(self):
        return Login.objects.all()

def directLogin(request):
    print ('directLogin', request)
    return redirect('/strava2/1')
    
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
    #request.session['access_token'] = 'ff4f273a775a57ce1c7dcc837e18a059370d338c'
    return redirect('/strava2/activities')
    
def getProgress(request):
    global _progress
    if not request.session.get('access_token') in _progress:
        data = {'value': 0}
    else:
        data = {'value': _progress[request.session.get('access_token')]}
    #data = {'value': 70}
    # print ('Receive getProgress request ...')
    return JsonResponse(data)
    
def refresh(request):
    print ('refresh', request)
    return redirect('/strava2/updateActivities')
    
    
def getActivitiesView(request):
    global _loginId

    print (' >>>> getActivitiesView, get_queryset')
    client = Client(request.session.get('access_token'))
    print (' >>>> getActivitiesView, client=',client)
    act = Activity.objects.filter(uid=client.get_athlete().id).order_by('-strTime')
    print (' >>>> getActivitiesView, acts=',act)
    tid = request.session.get('task_id')
    result = AsyncResult(tid)
    print (' >>>> getActivitiesView, state=',result.state)
    print (' >>>> getActivitiesView, meta_data=',result.info)

    actList = []
    for actItem in act:
        #print (actItem)
        serializer = ActivityItemSerializer(actItem)
        #print ('serializer.data: ',serializer.data)
        actList.append(serializer.data)
        
    data = {
        'nbAct': result.info['total'],
        'currentAct': result.info['current'],
        'activities': actList
        }
        
    print ('data=',data)
    return JsonResponse(data)

class ActivitiesView(generic.ListView):
    global _loginId
    print ('ActivitiesView')
    template_name = 'strava2/activity_list.html'
    context_object_name = 'activities_list'

    def get_queryset(self):
        self.client = Client(self.request.session.get('access_token'))
        self.result = get_activities.delay (_loginId, self.request.session.get('access_token'))
        print ('return do_work, tid=',self.result)
        self.request.session['task_id'] = self.result.task_id
        return Activity.objects.filter(uid=self.client.get_athlete().id).order_by('-strTime')
     
    def get_context_data(self, **kwargs):
        context = super(ActivitiesView, self).get_context_data(**kwargs)
        login = get_object_or_404(Login, pk=_loginId)
        user = self.client.get_athlete()
        print ("lastname=",user.lastname)
        print ('firstname=',user.firstname)
        print ('mail=',user.email)
        print ('id=',user.id)
        login.userName = user.lastname
        login.firstName = user.firstname
        context['login'] = login
        context['task_id'] = self.result.task_id
        print ('context=',context)
        print ('Request=',self.request)
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
        global _progress
        _progress[self.request.session.get('access_token')] = 5
        workout = self.get_object(pk)
        self.client = Client(self.request.session.get('access_token'))
        print('WorkoutDetail, client=',self.client)
        types = ['time', 'distance', 'latlng', 'altitude', 'heartrate', 'velocity_smooth']
        print('WorkoutDetail, workout.actId=',workout.actId)
        activity = get_object_or_404(Activity, id=workout.actId)
        print('WorkoutDetail, activity.stravaId=',activity.stravaId)
        streams = self.client.get_activity_streams(activity_id=activity.stravaId,resolution='medium',types=types)
        _progress[self.request.session.get('access_token')] = 10
        print ('streams=',streams)
        #print('time seq size=',len(streams['time'].data))
        #print('dist seq',streams['distance'].data)
        #print('speed seq',streams['velocity_smooth'].data)
        #print('elevation seq',streams['altitude'].data)
        #print('HR seq',streams['heartrate'].data)
        #print('gps seq',streams['latlng'].data)
        gps = GpsCoord.objects.filter(workout__id=workout.id)
        print ('gps first element=',gps.count())
        if not gps.count() and 'latlng' in streams:
            print ('empty query, create SQL record')
            objs = [
                GpsCoord(gps_index=i,gps_time=streams['time'].data[i],gps_lat=gps[0],gps_long=gps[1],workout=workout) for i, gps in enumerate(streams['latlng'].data)
            ]
            #print ('GPS seq')
            #for i, gps in enumerate(streams['latlng'].data):
            #    print ('gps_index:',i,'gps_lat:',gps[0],'gps_long:',gps[1],'gps_time:',streams['time'].data[i])
            coord = GpsCoord.objects.bulk_create(objs)

        _progress[self.request.session.get('access_token')] = 20
        hr = HeartRate.objects.filter(workout__id=workout.id)
        if not hr.count() and 'heartrate' in streams:
            objs = [
                HeartRate(hr_index=i,hr_value=hr,workout=workout) for i, hr in enumerate(streams['heartrate'].data)
            ]
            coord = HeartRate.objects.bulk_create(objs)
        
        _progress[self.request.session.get('access_token')] = 25
        distance = Distance.objects.filter(workout__id=workout.id)
        if not distance.count() and 'distance' in streams:
            objs = [
                Distance(distance_index=i,distance_value=dist,workout=workout) for i, dist in enumerate(streams['distance'].data)
            ]
            coord = Distance.objects.bulk_create(objs)
            
        speed = Speed.objects.filter(workout__id=workout.id)
        if not speed.count() and 'velocity_smooth' in streams:
            objs = [
                Speed(speed_index=i,speed_value=speed,workout=workout) for i, speed in enumerate(streams['velocity_smooth'].data)
            ]
            coord = Speed.objects.bulk_create(objs)
        
        _progress[self.request.session.get('access_token')] = 30
        elevation = Elevation.objects.filter(workout__id=workout.id)
        if not elevation.count() and 'altitude' in streams:
            objs = [
                Elevation(elevation_index=i,elevation_value=elevation,workout=workout) for i, elevation in enumerate(streams['altitude'].data)
            ]
            coord = Elevation.objects.bulk_create(objs)
        
        _progress[self.request.session.get('access_token')] = 35
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
            print ('lap_pace_zone=',strLap.pace_zone)
            if strLap.pace_zone is None:
                strLap.pace_zone = 0
            if strLap.average_cadence is None:
                strLap.average_cadence=0;
            lap = Lap.objects.filter(workout__id=workout.id, lap_index=i)
            if not lap.exists():
                lap = Lap.objects.create(lap_index=strLap.lap_index, lap_start_index=strLap.start_index, lap_end_index=strLap.end_index, lap_distance=strLap.distance, lap_time=strLap.elapsed_time, lap_start_date=strLap.start_date, lap_average_speed=strLap.average_speed, lap_average_cadence=strLap.average_cadence, lap_pace_zone=strLap.pace_zone, lap_total_elevation_gain=strLap.total_elevation_gain, workout=workout)
                print ('total_elevation_gain=',strLap.total_elevation_gain)
                print ('pace_zone=',strLap.pace_zone)
                
        _progress[self.request.session.get('access_token')] = 40      
        serializer = WorkoutSerializer(workout)
        print ('serializer.data size=',sys.getsizeof(serializer.data))
        _progress[self.request.session.get('access_token')] = 55
        return Response(serializer.data)
        
        