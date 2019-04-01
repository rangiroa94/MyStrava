import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer, WebsocketConsumer
from channels.auth import login
from strava2.models import StravaUser
from strava2.tasks import get_activities, get_workout

log = logging.getLogger(__name__)

class Consumers(AsyncWebsocketConsumer):

    async def connect(self):
        # Accept the connection
        print ("Connect socket, self=",self.channel_name)
        print ("scope=",self.scope)
        print ("session=",self.scope["session"])
        print ("user=",self.scope["user"])
        
        await self.accept()
        await self.send(text_data=json.dumps(
            {
                "firstname": "xxx",
                "lastname": "yyy",
                "message": "accept",
            },
        ))
        
    async def receive(self, text_data):
        # login the user to this session.
        print ("receive message: ",text_data)
        data = json.loads(text_data)
        strUser = StravaUser.objects.filter(firstname=data['firstname'],lastname=data['lastname'])
        strUser.update(channel_name=self.channel_name)
        token = ''
        for u in strUser:
            token = u.token
        print ('receive, token=',token)
        if data['message'] == 'Authentication':
            self.result = get_activities.delay (token)
        else :
            print ('get Workout message')
            self.result = get_workout.delay (token, data['message'])
        print ('return do_work, tid=',self.result)
        
    async def send_message(self, event):
        # Send a message down to the client
        #print ("Send message, event=",event)
        await self.send(text_data=json.dumps(
            {
                "firstname": "xxx",
                "lastname": "yyy",
                "message": event["message"],
            },
        ))
        print ("Send message OK")
        
    async def receive_json(self, content):
        print ("receive_json")
        command = content.get("command", None)
        try:
            print (command)
        except ClientError as e:
            log.debug("ws message isn't json text")
            return
        
    async def disconnect(self, close_code):
        print ('Socket closed!')
