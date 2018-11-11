
class gpsCoord:
    def __init__(self):
        self.idx = 0
        self.lat = []
        self.lon = []

    def setCoord(self,lat,lon):
        self.lat.append(lat) 
        self.lon.append(lon) 
        
    def getCoord(self):
        return self.lat
        