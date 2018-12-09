import { Component, ElementRef, HostListener, ViewChild, OnInit, AfterViewInit, 
  OnChanges, SimpleChanges, Input, Inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { CollectionViewer, DataSource } from '@angular/cdk/collections';
import { GoogleMapsAPIWrapper, AgmMap, LatLngBounds, LatLngBoundsLiteral, MapsAPILoader } from '@agm/core';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { Chart } from 'chart.js';
import { jqxChartComponent } from 'jqwidgets-scripts/jqwidgets-ts/angular_jqxchart';

declare var google: any;

export interface DialogData {
  showLap: boolean;
  showTrends: boolean;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({ height: '0px', minHeight: '0', visibility: 'hidden' })),
      state('expanded', style({ height: '*', visibility: 'visible' })),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)'))
    ]),
  ],
})

export class AppComponent implements AfterViewInit {
  title = 'MyStrava';
  /* url : string = 'http://fakarava94.no-ip.org:3000/workout/'; */
  url: string = '/strava2/workoutDetail/';
  wid: string;
  lat: number = 48.832929;
  lng: number = 2.473295;

  x: number;
  y: number;
  px: number;
  py: number;
  width: number;
  height: number;
  minArea: number;
  draggingCorner: boolean;
  draggingWindow: boolean;
  resizer: Function;
  done: number;
  selectedWindow: Window;
  newInnerHeight: number;
  newInnerWidth: number;
  clickLapDistance: number;
  clickLapTime: string;
  resolution: number=1000;  // to get from server
  workoutSize:number;
  ratio: number;
  lapSize: number = 0;
  lapInfos: infos = new infos();
  infosData: infoTable[] = [
    {title: 'Total time', value: ''},
    {title: 'Average time', value: ''},
    {title: 'Average Pace', value: ''},
    {title: 'Total dist. (km)', value: ''},
  ];
  displayedColumns: string[] = ['title', 'value'];
  showLaps: boolean = true;  
  showTrends: boolean = true;    
  showSettings: boolean = true;  
        
  winLap: Window = new Window(this);
  winTrends: Window = new Window(this);
  winInfos: Window = new Window(this);
  winSettings: Window = new Window(this);

  marker: any;
  map: any;

  hrData: Array<number> = new Array<number>();
  hrIdx:  Array<number> = new Array<number>();
  elevationData: Array<number> = new Array<number>();

  padding: any = { left: 5, top: 5, right: 15, bottom: 5 };
  titlePadding: any = { left: 0, top: 0, right: 0, bottom: 10 };
  xAxis: any =
  {
      valuesOnTicks: true,
      labels:
        {
            formatFunction: (value: any): string => {
                return value;
            },
            angle: 0,
            horizontalAlignment: 'right'
        },
      tickMarks: { visible: true }
  };

  seriesGroups: any[] =
  [
      {
          type: 'stepline',
          source: this.hrData,
          toolTipFormatFunction: (value: any, itemIndex: any, serie: any, group: any, categoryValue: any, categoryAxis: any) => {
              let dataItem = this.hrData[itemIndex];
              return '<DIV style="text-align:left"><b>Index:</b> ' +
                  itemIndex + '<br /><b>HR:</b> ' +
                  value + '<br /></DIV>';
          },
          valueAxis:
          {
              title: { text: 'HeartRate<br>' },
              flip: false,
              labels: { horizontalAlignment: 'right' }
          },
          series:
          [
              { displayText: 'HeartRate', lineWidth: 2, lineColor: '#ff1a1a' }
          ]
      },
      {
          type: 'area',
          source: this.elevationData,
          toolTipFormatFunction: (value: any, itemIndex: any, serie: any, 
            group: any, categoryValue: any, categoryAxis: any) => {
              let dataItem = this.elevationData[itemIndex];
              let pos = {
                      lat: this.w1.gpsCoord[itemIndex].gps_lat,
                      lng: this.w1.gpsCoord[itemIndex].gps_long
                    }
              console.log('marker: ', pos, this.marker);
              this.marker.setVisible(true);
              this.marker.setPosition(pos);
              return '<DIV style="text-align:left"><b>Index:</b> ' +
                  itemIndex + '<br /><b>HR:</b> ' +
                  value + '<br /></DIV>';
          },
          valueAxis:
          {
              title: { text: 'Altitude<br>' },
              flip: false,
              labels: { horizontalAlignment: 'right' }
          },
          series:
          [
              { displayText: 'Altitude', lineWidth: 1, lineColor: '#d7d5d5', 
              opacity: 0.3  }
          ]
      }
  ];
 
  w1: Workout;

  @ViewChild('AgmMap') agmMap: AgmMap;

  constructor(private http: HttpClient, private eltRef: ElementRef, 
    private mapsAPILoader: MapsAPILoader, public dialog: MatDialog,
    private gmapsApi: GoogleMapsAPIWrapper) {

    this.newInnerHeight = window.innerHeight;
    this.newInnerWidth = window.innerWidth;

    this.lapInfos.show = false;
    this.showSettings = false;

    this.updateView();
      
    this.selectedWindow = this.winLap;

    console.log('innerWidth=', window.innerWidth);

    this.done = 0;
    this.wid = localStorage.getItem('wid');
    if (this.wid) {
      localStorage.removeItem('wid');
      console.log('wid=', this.wid);
    } else {
      this.wid = ""
    }

    this.getWorkout();
  }

  ngOnInit(){
      
    }
          
  public getWorkout() {
    
    if (this.wid != "") {
      this.url = this.url + this.wid;
      /*
      this.http.get(this.url).toPromise().then((res) => {
        console.log(res.json());
      });
      */
    } else {
      this.url = 'assets/mockup.json';
    }
      
    this.http.get(this.url).subscribe((w: Workout) => { 
      this.w1 = w;
      console.log('w=',w);

      this.w1.name = w.act[0]['label'];
      this.w1.dayTime = w.act[0]['strTime'];
      this.w1.act.distance = w.act[0]['distance']/1000;
      this.w1.act.time = w.act[0]['time'];
      this.resolution = w.act[0]['resolution'];

      let d: Date = new Date(w.act[0]['strTime']);
      console.log('start_date=',d, d.getTime()/1000);

      this.w1.gpsCoord = new Array<Gps>();
      w['gps'].forEach(item => {
        let p1: Gps = new Gps();
        // console.log('gps item=',item);
        p1 = {
          gps_index: item.gps_index,
          gps_lat: item.gps_lat,
          gps_long: item.gps_long,
          gps_time: item.gps_time,
          speed: 10
        };
        this.w1.gpsCoord.push(p1);
      });

      this.w1.lap = new Array<Lap>();

      w['laps'].forEach(item => {
        let l1: Lap = new Lap();
        // console.log('lap item=',item);
        l1 = {
          lap_index: item.lap_index,
          lap_start_index: item.lap_start_index,
          lap_end_index: item.lap_end_index,
          lap_distance: item.lap_distance,
          lap_time: item.lap_time,
          lap_start_date: item.lap_start_date,
          lap_cumulatedTime: "00:00:00",
          lap_average_speed: Math.round(item.lap_average_speed*36)/10,
          lap_average_cadence: item.lap_average_cadence,
          lap_pace_zone: item.lap_pace_zone,
          lap_total_elevation_gain: item.lap_total_elevation_gain,
          lap_start: 0,
          lap_end:0
        };
        this.w1.lap.push(l1);
      });
      this.lapSize = this.w1.lap.length;
      this.workoutSize = this.w1.lap[this.w1.lap.length-1].lap_end_index;
      this.ratio = this.resolution / this.workoutSize;
      console.log('ratio=', this.ratio);

      let k:number = 0;
      w['heartrate'].forEach(item => {
        let h1: Heartrate = new Heartrate();
        h1 = {
          hr_value: item.hr_value,
        };
        this.w1.heartrate.push(h1);
        this.hrData.push(item.hr_value);
        this.hrIdx.push(k++);       
      });
      k = 0;
      w['elevation'].forEach(item => {
        this.elevationData.push(Math.round(item.elevation_value*10)/10);
      });

      let j:number;
      let idx = 0;
      let t: Date = new Date(this.w1.lap[0].lap_start_date);
      let curTime:number=t.getTime()/1000;
      let splitTime=0;
      let computeLapTime=0;
      for(j = 0;j<this.w1.lap.length;j++) {
        // this.w1.lap[j].lap_start = Math.round(this.w1.lap[j].lap_start_index*this.ratio);
        // this.w1.lap[j].lap_end = Math.round(this.w1.lap[j].lap_end_index*this.ratio);
        this.w1.lap[j].lap_start = idx;
        // let t: Date = new Date('1970-01-01T' + this.w1.lap[j].lap_time + 'Z');
        if (j<this.w1.lap.length-1) {
            let t2: Date = new Date(this.w1.lap[j+1].lap_start_date);
            splitTime += t2.getTime()/1000 - curTime;
            computeLapTime = t2.getTime()/1000 - curTime;
            curTime = t2.getTime()/1000;
            let hh:number = Math.trunc(computeLapTime/3600);
            let mm:number = Math.trunc(computeLapTime/60)-hh*60;
            let ss:number = computeLapTime-hh*3600-mm*60;
            this.w1.lap[j].lap_time = String(hh).padStart(2, '0') + ':' +
              String(mm).padStart(2, '0') +':' + String(ss).padStart(2, '0');;
        } else {
            let t2: Date = new Date('1970-01-01T' + this.w1.lap[j].lap_time + 'Z');
            splitTime += t2.getTime()/1000
        }
        
        console.log('lap ',j+1,'lap_time=',this.w1.lap[j].lap_time, 
          'splitTime=',splitTime, 'idx=',this.binaryIndexOf(splitTime));
        let hh:number = Math.trunc(splitTime/3600);
        let mm:number = Math.trunc(splitTime/60)-hh*60;
        let ss:number = splitTime-hh*3600-mm*60;
        this.w1.lap[j].lap_cumulatedTime = String(hh).padStart(2, '0') + ':' +
          String(mm).padStart(2, '0') +':' + String(ss).padStart(2, '0');
        idx = this.binaryIndexOf(splitTime);
        this.w1.lap[j].lap_end = idx;
      }

      console.log('w1=', this.w1);
      console.log('lapSize=', this.lapSize);
      this.done = 1;
      this.w1.loaded = true;

    });

  }

  updateView () {
    this.winLap.x = 50;
    this.winLap.y = 130;
    this.winLap.px = 0;
    this.winLap.py = 0;
    this.winLap.width = 300;
    this.winLap.height = 500;
    this.winLap.draggingCorner = false;
    this.winLap.draggingWindow = false;
    this.winTrends.minArea = 20000

    this.winTrends.x = window.innerWidth - 0.75 * window.innerWidth - 10;
    this.winTrends.y = window.innerHeight - 0.2 * window.innerHeight - 10;
    this.winTrends.px = 0;
    this.winTrends.py = 0;
    this.winTrends.width = 0.70 * window.innerWidth;
    this.winTrends.height = 0.2 * window.innerHeight;
    this.winTrends.draggingCorner = false;
    this.winTrends.draggingWindow = false;
    this.winTrends.minArea = 20000;

    this.winInfos.x = 50;
    this.winInfos.y = window.innerHeight - 0.2 * window.innerHeight - 10;
    this.winInfos.px = 0;
    this.winInfos.py = 0;
    this.winInfos.width = 300;
    this.winInfos.height = 102;
    this.winInfos.draggingCorner = false;
    this.winInfos.draggingWindow = false;
    this.winInfos.minArea = 20000;

    this.winSettings.x = window.innerWidth - 0.1 * window.innerWidth - 50;
    this.winSettings.y = 50;
    this.winSettings.px = 0;
    this.winSettings.py = 0;
    this.winSettings.width = 0.1 * window.innerWidth;
    this.winSettings.height = 0.2 * window.innerHeight;
    this.winSettings.draggingCorner = false;
    this.winSettings.draggingWindow = false;
    this.winSettings.minArea = 20000;

  }

  fitToScreen(event) {
    console.log('event=',event);
    const bounds: LatLngBounds = new google.maps.LatLngBounds();
    for (const mm of this.w1.gpsCoord) {
      bounds.extend(new google.maps.LatLng(mm.gps_lat, mm.gps_long));
    }
    console.log('bounds=', bounds);
    /* event.setZoom(event.zoom - 2); */
    event.fitBounds(bounds);
    console.log('this.lng=', this.lng);
    event.panBy(-(this.winLap.width/2), this.winTrends.height / 1.6)
    console.log('zoom=', event.zoom);

    this.map = event;
    // console.log ('map=',this.map);

    let pos = {
      lat: this.lat,
      lng: this.lng
    }
    let svgIcon = {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 4,
      strokeColor: '#393'
    };

    this.marker = new google.maps.Marker({
        map: this.map,
        position: pos,
        icon: svgIcon
    })
    this.marker.setVisible(false);

  }

  ngAfterViewInit() {
    console.log("ngAfterViewInit");
    this.mapsAPILoader.load().then(() => {
      console.log("load Agm");
    });

  }

  binaryIndexOf(searchElement) {
    'use strict';
 
    var minIndex = 0;
    var maxIndex = this.resolution - 1;
    var accuracy = this.workoutSize/this.resolution;
    var currentIndex;
    var currentElement;
    // console.log ('binaryIndexOf, searchElement=', searchElement);
    while (minIndex <= maxIndex) {
        currentIndex = (minIndex + maxIndex) / 2 | 0;
        // console.log ('binaryIndexOf, currentIndex=', currentIndex);
        currentElement = this.w1.gpsCoord[currentIndex].gps_time;
 
        if ( (currentElement < searchElement) && 
             (Math.abs(currentElement-searchElement)>accuracy) ) {
            minIndex = currentIndex + 1;
        }
        else if ( (currentElement > searchElement) && 
                  (Math.abs(currentElement-searchElement)>accuracy) ) {
            maxIndex = currentIndex - 1;
        }
        else {
            return currentIndex;
        }
    }
 
    return -1;
  }


  onLapSelected (numLap: number) {
    // console.log(">>>> onLapSelected, lap=", numLap);
    let isSelected:boolean;
    let speed:number;
    if (numLap > 0) {
      isSelected = true;
      speed = 20;
    } else {
      isSelected = true;
      numLap= numLap * (-1);
      speed = 10;
    }
    numLap = numLap -1;
    let i:number=0;
    
    let start_idx = this.w1.lap[numLap].lap_start;
    let end_idx = this.w1.lap[numLap].lap_end;
    // console.log(">>>> onLapSelected, speed=",speed);
    for(i = start_idx;i<end_idx;i++) {
      this.w1.gpsCoord[i].speed = speed;
      // console.log(">>>> onLapSelected, i=",i,"speed=",this.w1.gpsCoord[i].speed);
    }
  }

  onLapInfos(data: infos) {
    console.log(">>>> onLapInfos, total dist=",data.total_dist, 
      "average time=",data.average_time,
      "nbValues=",data.nbValues);

    if ( data.nbValues > 1) {
      this.lapInfos.show = true;
    }  else {
      this.lapInfos.show = false;
    }
    this.infosData[0]['value'] = data.total_time;
    this.infosData[1]['value'] = data.average_time;
    this.infosData[2]['value'] = data.average_speed;
    this.infosData[3]['value'] = String(data.total_dist);
    console.log(">>>> onLapInfos, infosData=",this.infosData);
  }

  clickedMarker(label: string, index: number) {
    console.log('clicked the marker:', index);
    let idx:number = index-1;
    if (idx>=0) {
      this.clickLapDistance = this.w1.lap[idx].lap_distance;
      this.clickLapTime = this.w1.lap[idx].lap_time.toString();
    } else {
      this.clickLapDistance = 0;
      this.clickLapTime = "00:00:00";  
    }
  }

  onClickSettings () {
    console.log('clicked Settings button');
    this.showSettings = !this.showSettings;
  }

  chartEvent(event: any): any {
        let eventData;
        console.log('chartEvent: ',event.type, 'data=',event.elementIndex);
        if (event) {
            if (event.args) {
                if (event.type == 'toggle') {
                    return;
                } else if (event.type == 'click') {
                  console.log('chartEvent, data=',event.elementIndex);
                } else if (event.type == 'mouseleave') {
                  this.marker.setVisible(false);
                }
            } else if (event.type == 'mouseleave') {
                  this.marker.setVisible(false);
            }
        }
  }

  @HostListener('document:mousemove', ['$event'])
  onCornerMove(event: MouseEvent) {
    if (!this.selectedWindow.draggingCorner) {
      return;
    }
    let offsetX = event.clientX - this.selectedWindow.px;
    let offsetY = event.clientY - this.selectedWindow.py;

    let lastX = this.selectedWindow.x;
    let lastY = this.selectedWindow.y;
    let pWidth = this.selectedWindow.width;
    let pHeight = this.selectedWindow.height;

    this.selectedWindow.resizer(offsetX, offsetY);
    if (this.selectedWindow.area() < this.selectedWindow.minArea) {
      this.selectedWindow.x = lastX;
      this.selectedWindow.y = lastY;
      this.selectedWindow.width = pWidth;
      this.selectedWindow.height = pHeight;
    }
    this.selectedWindow.px = event.clientX;
    this.selectedWindow.py = event.clientY;
    }

  @HostListener('document:mouseup', ['$event'])
  onCornerRelease(event: MouseEvent) {
    this.selectedWindow.draggingWindow = false;
    this.selectedWindow.draggingCorner = false;
  }

  @HostListener('window:resize', ['$event'])
  onResize(event) {
    this.newInnerHeight = event.target.innerHeight;
    this.newInnerWidth = event.target.innerWidth;
    this.updateView();
    /* this.fitToScreen(this.agmMap); */
  }
}

export class Lap {
  lap_index: number;
  lap_start_index: number;
  lap_end_index: number;
  lap_distance: number;
  lap_time: string;
  lap_start_date: string;
  lap_cumulatedTime: string;
  lap_average_speed: number;
  lap_average_cadence: number;
  lap_pace_zone: number;
  lap_total_elevation_gain: number;
  lap_start: number;
  lap_end:number;
}

export interface infoTable {
  title: string;
  value: string;
}

export class infos {
  total_dist: number;
  total_time: string;
  average_time: string;
  average_speed: string;
  nbValues: number;
  show: boolean;
}

export class Gps {
  gps_index: number;
  gps_lat: number;
  gps_long: number;
  gps_time: number;
  speed: number;
}

export class Heartrate {
  hr_value: number;
}

export class Activity {
  time: string;
  distance: number;
  resolution: number;
}

export class Workout {
  name: string="fli";
  dayTime: string;
  actId: number;
  act: Activity;
  loaded : boolean = false;
  lap: Lap[];
  gpsCoord: Gps[];
  heartrate: Heartrate[];
  constructor() {}
}

export class Window {
  name: string;
  app: AppComponent;
  x: number;
  y: number;
  px: number;
  py: number;
  width: number;
  height: number;
  draggingCorner: boolean;
  draggingWindow: boolean;
  minArea: number;
  resizer: Function;

  constructor(private father: AppComponent) {
    this.app = father;
  }

  area() {
    return this.width * this.height;
  }

  onWindowPress(event: MouseEvent, id: number) {
    this.app.selectedWindow = this;
    this.draggingWindow = true;
    this.px = event.clientX;
    this.py = event.clientY;
    console.log('Press winId=', id);
  }

  onWindowDrag(event: MouseEvent, id: number) {
    if (!this.draggingWindow) {
      return;
    }
    let offsetX = event.clientX - this.px;
    let offsetY = event.clientY - this.py;

    this.x += offsetX;
    this.y += offsetY;
    this.px = event.clientX;
    this.py = event.clientY;
  }

  topLeftResize(offsetX: number, offsetY: number) {
    this.x += offsetX;
    this.y += offsetY;
    this.width -= offsetX;
    this.height -= offsetY;
  }

  topRightResize(offsetX: number, offsetY: number) {
    this.y += offsetY;
    this.width += offsetX;
    this.height -= offsetY;
  }

  bottomLeftResize(offsetX: number, offsetY: number) {
    this.x += offsetX;
    this.width -= offsetX;
    this.height += offsetY;
  }

  bottomRightResize(offsetX: number, offsetY: number) {
    this.width += offsetX;
    this.height += offsetY;
  }

  onCornerClick(event: MouseEvent, resizer?: Function) {
    this.draggingCorner = true;
    this.px = event.clientX;
    this.py = event.clientY;
    this.resizer = resizer;
    event.preventDefault();
    event.stopPropagation();
  }
}

@Component({
  selector: 'settings-dialog',
  templateUrl: 'settings-dialog.html',
})
export class settingsDialog {

  constructor(
    public dialogRef: MatDialogRef<settingsDialog>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData) {}

  onNoClick(): void {
    this.dialogRef.close();
  }

}