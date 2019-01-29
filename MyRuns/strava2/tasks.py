from __future__ import absolute_import, unicode_literals
from celery import shared_task
from celery_progress.backend import ProgressRecorder

from django.utils import timezone
from django.shortcuts import get_object_or_404
from strava2.models import Login, Activity, Workout, Lap, GpsCoord, HeartRate, \
    Speed, Elevation, Distance, Split, StravaUser
import re
from datetime import datetime, timedelta
from stravalib import Client

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
