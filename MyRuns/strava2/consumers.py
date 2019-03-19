import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer, WebsocketConsumer
from channels.auth import login
from strava2.models import StravaUser

log = logging.getLogger(__name__)

class Consumers(AsyncWebsocketConsumer):

    async def connect(self):
        # Accept the connection
        print ("Connect socket, self=",self.channel_name)
        print ("scope=",self.scope)
        print ("session=",self.scope["session"])
        print ("user=",self.scope["user"])
        StravaUser.objects.filter(firstname='Francois').update(channel_name=self.channel_name)
        await self.accept()
        await self.send(text_data=json.dumps(
            {
                "author": "fli",
                "message": "accept",
            },
        ))
        
    async def receive(self, text_data):
        # login the user to this session.
        print ("receive message: ",text_data)
        #await login(self.scope, "fli")
        
    async def send_message(self, event):
        # Send a message down to the client
        print ("Send message, event=",event)
        await self.send(text_data=json.dumps(
            {
                "author": "fli",
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


    async def start_sec3(data, reply_channel):
        log.debug("job Name=%s", data['job_name'])
        
        # Start long running task here (using Celery)
        sec3_task = sec3.delay(job.id, reply_channel)

        # Store the celery task id into the database if we wanted to
        # do things like cancel the task in the future
        

        # Tell client task has been started
        await Channel(reply_channel).send({
            "text": json.dumps({
                "action": "started",
                "job_id": job.id,
                "job_name": job.name,
                "job_status": job.status,
            })
        })
        
    async def disconnect(self, close_code):
        print ('Socket closed!')
