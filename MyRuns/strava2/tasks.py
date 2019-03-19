from __future__ import absolute_import, unicode_literals
from celery import shared_task
from celery_progress.backend import ProgressRecorder

from django.utils import timezone
from django.shortcuts import get_object_or_404
from strava2.models import Login, Activity, Workout, Lap, GpsCoord, HeartRate, \
    Speed, Elevation, Distance, Split, StravaUser
import re
from datetime import datetime, date, timedelta
from stravalib import Client

import sys, os
from fitparse import FitFile

def getSpeed (speed):
    speed = 100/speed
    mm = int(speed/60)
    ss = int(speed-mm*60)
    ds = int((speed-mm*60-ss)*10)
    speed_100 = str(mm).zfill(2)+':'+str(ss).zfill(2)+'.'+str(ds).zfill(1)
    return speed_100

def getDate (time):
    hh = int(time/3600)
    mm = int((time-hh*3600)/60)
    ss = int(time-hh*3600-mm*60)
    date = str(hh).zfill(2)+':'+str(mm).zfill(2)+':'+str(ss).zfill(2)
    return date
    
def getTimeDelta (time):
    hh = int(time/3600)
    mm = int((time-hh*3600)/60)
    ss = int(time-hh*3600-mm*60)
    date = timedelta(hours=hh,minutes=mm,seconds=ss)
    return date

PROGRESS_STATE = 'PROGRESS'

@shared_task(bind=True)
def get_activities (self, loginId, token):

    client = Client(token)
    login = get_object_or_404(Login, pk=loginId)
    user = client.get_athlete()
    
    # Update StavaUser
    lastUpdate=datetime.now()
    strUser = StravaUser.objects.filter(uid=user.id)
    if not strUser.exists():
        print ('create user', )
        user2 = StravaUser(uid=user.id, lastname=user.lastname, firstname=user.firstname, \
            lastUpdate=datetime.now())
        user2.save()
    else:
        print ('strUser=',strUser)
        for u in strUser:
            lastUpdate = u.lastUpdate
        print ('lastUpdate=',lastUpdate)
        
    #d = datetime(2018, 5, 5)
    date_1_day_ago = lastUpdate - timedelta(days=1)
    
    activities = client.get_activities(after=date_1_day_ago,limit=20)
    #activities = client.get_activities(after=d,limit=15)
    act = None
    nbItem = 0
    nbAct = 0
    for activity in activities:
        nbAct +=1
        
    print ('NbAct=',nbAct)
    progress_recorder = ProgressRecorder(self)
    
    for activity in activities:
        StravaUser.objects.filter(uid=user.id).update(currentActIndex=nbItem, nbActToRetreive=nbAct)
        self.update_state(
            state=PROGRESS_STATE,
            meta={
                'current': nbItem,
                'total': nbAct
            }
        )
        progress_recorder.set_progress( nbItem, nbAct )
        act = client.get_activity(activity.id)
        strDate = act.start_date.strftime("%Y-%m-%d %H:%M:%S")
        print ('uid=',user.id)
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
                time=act.elapsed_time,label=act.name,stravaId=activity.id,wid=workout.id,workout_id=workout.id,uid=user.id,type=act.type)
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
        
        nbItem+=1
            
    if act is not None : 
        StravaUser.objects.filter(uid=user.id).update(lastUpdate=datetime.now())
        
    #return str(user.id)
    return {'current': nbItem, 'total': nbAct}

@shared_task(bind=True)
def processFit (self, loginId, token, file):

    client = Client(token)
    login = get_object_or_404(Login, pk=loginId)
    user = client.get_athlete()
    # Update StavaUser
    lastUpdate=datetime.now()
    strUser = StravaUser.objects.filter(uid=user.id)
    if not strUser.exists():
        print ('create user', )
        user2 = StravaUser(uid=user.id, lastname=user.lastname, firstname=user.firstname, \
            lastUpdate=datetime.now())
        user2.save()
    else:
        print ('strUser=',strUser)
        for u in strUser:
            lastUpdate = u.lastUpdate
        print ('lastUpdate=',lastUpdate)
        
    print ('processFit, file: ', file)
    fitfile = FitFile(file)

    act_startTime = ''
    act_totalTime = 0
    act_speed = 0
    act_distance = 0
    act_sport = ''
    for r in  fitfile.get_messages('session'):
        print (r.get_value('sport'))
        act_sport = r.get_value('sport')
        if act_sport == 'swimming':
            act_sport='Swim'
        act_startTime = r.get_value('start_time')
        print (str(r.get_value('pool_length'))+'m')
        print (str(getDate(r.get_value('total_timer_time'))))
        act_totalTime = str(getDate(r.get_value('total_timer_time')))
        print (str(getSpeed(r.get_value('avg_speed')))+'/100m')
        act_speed = getSpeed(r.get_value('avg_speed'))
        print (str(r.get_value('total_distance'))+'m')
        act_distance = r.get_value('total_distance')
        act_strDistance = format(r.get_value('total_distance')/1000,'.2f')
        print ('act_distance=',act_distance)

    numLap=0
    laps_ts = []
    laps = []
    length = []
    timeLap=0
    for record in fitfile.get_messages('lap'):
        #print ('Lap ',numLap+1)
        #print ('time:',record.get_value('start_time'))
        #print ('total_distance:',record.get_value('total_distance'))
        #print ('total_elapsed_time:',record.get_value('total_elapsed_time'))
        #print (int(record.get_value('start_time').timestamp()))
        speed = record.get_value('avg_speed')
        if (speed is None) or (speed==0):
            speed = float(0)
        else:
            speed = float (speed)
        if (record.get_value('total_strokes') is None):
            strokes = 0
        else:
            strokes = record.get_value('total_strokes')
        dict = {'start_time': record.get_value('start_time'), 'total_distance': record.get_value('total_distance'), 'total_elapsed_time': record.get_value('total_elapsed_time'), 'speed': speed, 'strokes': strokes}
        laps.append (dict)
        laps_ts.append(int(record.get_value('start_time').timestamp()))
        timeLap = record.get_value('total_elapsed_time')
        numLap+=1
    laps_ts.append(int(record.get_value('start_time').timestamp()+timeLap))
    
    curLap=0
    curTime=laps_ts[curLap+1]
    dictLength = []
    print ('>> lap ',curLap+1,laps_ts[curLap],laps[curLap]['total_distance'])
    for record in fitfile.get_messages('length'):
        ts=record.get_value('start_time').timestamp()
        #print ('ts=',ts,'curTime=',curTime)
        if ts<curTime:
            length.append(curLap)
            curTime=laps_ts[curLap+1]
        else:
            curLap+=1
            curTime=laps_ts[curLap+1]
            print ('>> lap ',curLap+1,laps_ts[curLap],laps[curLap]['total_distance'])
            length.append(curLap)

        if record.get_value('avg_speed') is None:
            speed = float(0)
        else:
            speed = float(record.get_value('avg_speed'))
        
        dictLength.append({'lap': curLap+1, 'strokes': record.get_value('total_strokes'), 'speed': speed, 'swim_stroke': record.get_value('swim_stroke')})
        laps[curLap]['length'] = dictLength

        #print (curLap+1, record.get_value('total_strokes'), speed_100, record.get_value('swim_stroke'))

    activity_id = int(act_startTime.timestamp())
    if not Activity.objects.filter(stravaId=activity_id).exists():
        workout=Workout.objects.create(name=act_sport+' workout')
        print ('wid=',workout.id)
        stravaAct = Activity(strTime=act_startTime,strDist=act_strDistance,distance=act_distance,\
            time=act_totalTime,label=act_sport+' workout',stravaId=activity_id,wid=workout.id,workout_id=workout.id,uid=user.id,type=act_sport)
        stravaAct.save()
        Workout.objects.filter(id=workout.id).update(actId=stravaAct.id)
    else:
        Activity.objects.filter(stravaId=activity_id).update(strTime=act_startTime,strDist=act_strDistance)
    
    i=0
    for strLap in laps:
        i+=1
        lap = Lap.objects.filter(workout__id=workout.id, lap_index=i)
        if not lap.exists():
            lap_time=getTimeDelta(strLap['total_elapsed_time'])
            print ('lap_time=',lap_time,'lap_average_speed=',strLap['speed'])
            lap = Lap.objects.create(lap_index=i, lap_start_index=0, lap_end_index=0, lap_distance=strLap['total_distance'], lap_time=lap_time, lap_start_date=laps_ts[i], lap_average_speed=strLap['speed'], lap_average_cadence=strLap['strokes'], lap_pace_zone=0, lap_total_elevation_gain=float(0), workout=workout)

