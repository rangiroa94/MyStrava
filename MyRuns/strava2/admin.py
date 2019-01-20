from django.contrib import admin

from .models import User, Login, Activity, Workout, Lap, StravaUser

class LoginAdmin(admin.ModelAdmin):
    list_display  = ('name','last_login')

admin.site.register(User)
admin.site.register(Login,LoginAdmin)
admin.site.register(Activity)
admin.site.register(Workout)
admin.site.register(Lap)
admin.site.register(StravaUser)

