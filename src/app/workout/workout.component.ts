import { Component, ElementRef, HostListener, ViewChild, OnInit, AfterViewInit, 
  OnChanges, SimpleChanges, ChangeDetectorRef, Input, Output, Inject, EventEmitter } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Event as NavigationEvent } from "@angular/router";
import { NavigationStart, Router, ActivatedRoute } from "@angular/router";
import { Observable, of } from 'rxjs';
import { map, filter, switchMap } from 'rxjs/operators';
import { CollectionViewer, DataSource } from '@angular/cdk/collections';
import { GoogleMapsAPIWrapper, AgmMap, LatLngBounds, LatLngBoundsLiteral, MapsAPILoader } from '@agm/core';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { Chart } from 'chart.js';
import { jqxChartComponent  } from 'jqwidgets-scripts/jqwidgets-ts/angular_jqxchart';
import { jqxTooltipComponent  } from 'jqwidgets-scripts/jqwidgets-ts/angular_jqxtooltip';
import { WorkoutService, Gps, Heartrate, ActivityItem, Lap, Workout, 
  lapSelection, Split, infos, Login } from '../workout.service';


declare var google: any;

export interface DialogData {
  showLap: boolean;
  showTrends: boolean;
}


@Component({
  selector: 'app-workout',
  templateUrl: './workout.component.html',
  styleUrls: ['./workout.component.css'],
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({ height: '0px', minHeight: '0', visibility: 'hidden' })),
      state('expanded', style({ height: '*', visibility: 'visible' })),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)'))
    ]),
  ],
})

export class WorkoutComponent implements AfterViewInit, OnInit  {
  @ViewChild('myChart') myChart: jqxChartComponent; 
  @ViewChild('myToolTip') myToolTip: jqxTooltipComponent ;
  @Output() initPhase: EventEmitter<number>  = new EventEmitter<number>();

  title = 'MyStrava';
  /* url : string = 'http://fakarava94.no-ip.org:3000/workout/'; */

  urlbase: string = '/strava2/';
  urlworkout: string = 'workoutDetail/';
  urlprogress: string = 'getProgress/';
  wid: number = -1;
  lat: number = 48.832929;
  lng: number = 2.473295;
  progressValue: number = 2;
  progressTimer: any;
  startupLoadTime: number = 0;
  devMode: boolean = false;
  isMobile: boolean;

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
  startHour: number;
  selectedWindow: Window;
  newInnerHeight: number;
  newInnerWidth: number;
  clickLapDistance: number;
  clickLapTime: string;
  resolution: number=1000;  // to get from server
  workoutSize:number;
  ratio: number;
  lapSize: number = 0;
  lap_end_index: number = 0;
  lapInfos: infos = new infos();
  infosData: infoTable[] = [
    {title: 'Total time', value: ''},
    {title: 'Average time', value: ''},
    {title: 'Average Pace', value: ''},
    {title: 'Total dist. (km)', value: ''},
    {title: 'Slope', value: ''},
    {title: 'Elevation', value: ''},
  ];
  displayedColumns: string[] = ['title', 'value'];
  showLaps: boolean = true;  
  showTrends: boolean = true;    
  showSettings: boolean = true;  
        
  winLap: Window = new Window(this,1);
  winTrends: Window = new Window(this,2);
  winInfos: Window = new Window(this,3);
  winSettings: Window = new Window(this,4);

  tables: LapTable[] = [
    {value: 0, viewValue: 'Manual laps'},
    {value: 1, viewValue: 'Custom Laps'},
    {value: 2, viewValue: 'Split Laps'}
  ];
  selectedTable: number=0;  //0: WatchLap, 1: customLap, 2: splitLap
  currentTable: number=0;

  // pin icons
  // square-pin icon
  squarePin: any;
  squarePin2: any;
  currentIcon: any;

  // Charts
  marker: any;
  map: any;
  hrData: Array<number> = new Array<number>();
  hrIdx:  Array<number> = new Array<number>();
  elevationData: Array<number> = new Array<number>();
  speedData: Array<number> = new Array<number>();
  distanceData: Array<number> = new Array<number>();
  toolTipTrends: string;
  splitBegin: number = -1;
  splitBeginIndex: number;
  splitEnd: number;
  currentIndex: number;
  bands = [];
  recessions = [];
  redrawBands: boolean = false;
  currentRecession: number=-1;
  currentX: number=-1;
  saveCurrentX: number=-1;
  padding: any;
  titlePadding: any;
  xAxis: any;
  seriesGroups: any[];
  renderer: any;
  rect: any;
  currentRect: any;
  onChartArea: boolean = false;
  timer: any;
  Ymin:number = 0;
  Ymax:number = 0;
  xMin: number = 0;
  xWidth: number = 0;
  firstRefresh: boolean = true;

  w1: Workout;
  srv: WorkoutService;
  workout$: Observable<Workout[]>;

  @ViewChild('AgmMap') agmMap: AgmMap;

  constructor(private http: HttpClient, private eltRef: ElementRef, 
    private mapsAPILoader: MapsAPILoader, public dialog: MatDialog,
    private gmapsApi: GoogleMapsAPIWrapper, 
    private changeDetectorRefs: ChangeDetectorRef,
    private route: ActivatedRoute,
    private wktService: WorkoutService) {

    this.srv = wktService;
    this.newInnerHeight = window.innerHeight;
    this.newInnerWidth = window.innerWidth;

    this.initPhase.emit(1);

    this.lapInfos.show = false;
    this.showSettings = false;

  }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
        console.log ('Workout ngOnInit params=',params);
        this.wid =Number(params.get('id'));
        this.devMode = (params.get('devMode')=='true');
        if (this.devMode) {
          this.isMobile = (params.get('isMobile')=='true');
        } else {
          this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        }
    });
    if (this.isMobile) {
      console.log('Mobile detected !!');
      this.showLaps = false;
    }
    this.showProgress();
    this.getWorkout(this.wid, this.devMode);
    this.updateView();
      
    this.selectedWindow = this.winLap;

    console.log('innerWidth=', window.innerWidth);
    this.done = 0;
  }


  public showProgress() {
        this.progressTimer = setInterval(() => {
          console.log ('Check progress ...');
          if ( this.startupLoadTime++ > 120) clearInterval(this.progressTimer);
          if (!this.devMode) {
            this.http.get(this.urlbase + this.urlprogress).subscribe((p: Progress) => {
              console.log ('Receive progress value=', p.value);
              if (p.value>=55){ this.progressValue += 5; } else {this.progressValue = p.value;}
              }
            );
          }

      }, 1000);
  }
          
  public getWorkout(wid: number, devMode: boolean) {
    
    console.log ('devMode=',devMode);
    if (!devMode) {
      this.urlworkout = this.urlbase + this.urlworkout + String(this.wid);
      /*
      this.http.get(this.url).toPromise().then((res) => {
        console.log(res.json());
      });
      */
    } else {
      this.urlworkout = 'assets/mockup.json';
    }
      
    this.http.get(this.urlworkout).subscribe((w: Workout) => { 
      this.w1 = w;
      console.log('w=',w);

      this.w1.name = w.act[0]['label'];
      this.w1.dayTime = w.act[0]['strTime'];
      this.w1.act.distance = w.act[0]['distance']/1000;
      this.w1.act.type = w.act[0]['type'];
      this.w1.act.time = w.act[0]['time'];
      this.resolution = w.act[0]['resolution'];

      let d: Date = new Date(w.act[0]['strTime']);
      console.log('start_date=',d, d.getTime()/1000);
      this.startHour = d.getHours()*3600+d.getMinutes()*60+d.getSeconds();

      this.w1.gpsCoord = new Array<Gps>();
      w['gps'].forEach(item => {
        let p1: Gps = new Gps();
        // console.log('gps item=',item);
        p1 = {
          gps_index: item.gps_index,
          gps_lat: item.gps_lat,
          gps_long: item.gps_long,
          gps_time: item.gps_time,
          strokeWeight: 2,
          color: '#2196f3'
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
          lap_distance: Math.round(item.lap_distance),
          lap_time: item.lap_time,
          lap_start_date: item.lap_start_date,
          lap_cumulatedTime: "00:00:00",
          lap_average_speed: Math.round(item.lap_average_speed*36)/10,
          lap_average_HR: 0,
          lap_average_cadence: item.lap_average_cadence*2,
          lap_pace_zone: item.lap_pace_zone,
          lap_total_elevation_gain: item.lap_total_elevation_gain,
          lap_start: 0,
          lap_end:0,
          lap_slope: 0,
          band: {}
        };
        this.w1.lap.push(l1);
      });
      this.lapSize = this.w1.lap.length;
      this.lap_end_index = this.w1.lap[this.lapSize-1].lap_end_index;
      this.workoutSize = this.w1.lap[this.w1.lap.length-1].lap_end_index;
      if (this.workoutSize<this.resolution) this.resolution = this.workoutSize;
      this.ratio = this.resolution / this.workoutSize;

      console.log('ratio=', this.ratio);

      this.w1.splits = new Array<Split>();
      w['split'].forEach(item => {
        let s1: Split = new Split();
        // console.log('lap item=',item);
        s1 = {
          split_index: item.split_index,
          split_distance: Math.round(item.split_distance),
          split_time: item.split_time,
        };
        this.w1.splits.push(s1);
      });

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
      w['speed'].forEach(item => {
        this.speedData.push(Math.round(item.speed_value*360)/100);
      });
      w['distance'].forEach(item => {
        this.distanceData.push(Math.round(item.distance_value*10)/10);
      });

      if (this.w1.gpsCoord.length>0) {
        this.computeWatchLapIndex(0, 1);

        for (let i =0; i< this.w1.lap.length; i++) {
          let avgHR: number = 0;
          let deltaH: number = 0;
          let deltaD: number = 0;
          let elevationGain: number = 0;
          let slope: number = 0;
          for (let j=this.w1.lap[i].lap_start; j<=this.w1.lap[i].lap_end;j++) {
            avgHR+=this.hrData[j];
            if (j>this.w1.lap[i].lap_start) {
              deltaH += this.elevationData[j] - this.elevationData[j-1];
              deltaD += this.distanceData[j] - this.distanceData[j-1];
              elevationGain += this.elevationData[j] - this.elevationData[j-1];
            }
          }
          avgHR=avgHR/(this.w1.lap[i].lap_end-this.w1.lap[i].lap_start+1);
          avgHR = Math.trunc(avgHR);
          // console.log ('deltaH=',deltaH,'deltaD=',deltaD);
          slope = (deltaH) / (Math.sqrt(Math.pow(deltaD,2)-Math.pow(deltaH,2))) *100;
          this.w1.lap[i].lap_average_HR = Math.round(avgHR);
          this.w1.lap[i].lap_total_elevation_gain = Math.round(elevationGain);
          this.w1.lap[i].lap_slope = Math.round(slope*10)/10;
        }
      }
      console.log('w1=', this.w1);
      console.log('lapSize=', this.lapSize);

      if ( this.w1.act.type == "" ) {
        this.w1.act.type = 'Run';
      }

      this.done = 1;
      this.w1.loaded = true;
      clearInterval(this.progressTimer);

      if (this.w1.gpsCoord.length>0) this.displayTrends();

    });

  }

  computeWatchLapIndex ( startIdx: number, correction: number ) {
    let j:number;
    let idx = startIdx;
    let strdate: string;
    // strdate = this.w1.lap[0].lap_start_date.replace("(-[0-9][0-9]) ([0-9][0-9]:)","\\1T\\2");
    strdate = this.w1.lap[0].lap_start_date.replace("\+00:00",".000Z");
    console.log('strdate=', strdate);
    let t: Date = new Date(strdate);
    let curTime:number=t.getTime()/1000;
    let splitTime=this.w1.gpsCoord[startIdx].gps_time;
    console.log('splitTime=', splitTime);
    let computeLapTime=0;
    for(j = 0;j<this.w1.lap.length;j++) {
      // this.w1.lap[j].lap_start = Math.round(this.w1.lap[j].lap_start_index*this.ratio);
      // this.w1.lap[j].lap_end = Math.round(this.w1.lap[j].lap_end_index*this.ratio);
      this.w1.lap[j].lap_start = idx;
      // let t: Date = new Date('1970-01-01T' + this.w1.lap[j].lap_time + 'Z');
      if (j<this.w1.lap.length-1) {
          // strdate = this.w1.lap[j+1].lap_start_date.replace("(-[0-9][0-9]) ([0-9][0-9]:)","\\1T\\2");
          strdate = this.w1.lap[j+1].lap_start_date.replace("\+00:00",".000Z");
          // console.log('strdate=',strdate);
          let t2: Date = new Date(strdate);
          splitTime += t2.getTime()/1000 - curTime;
          computeLapTime = t2.getTime()/1000 - curTime;
          curTime = t2.getTime()/1000;
          // console.log('t2=',t2,'splitTime=',splitTime,'curtime=',curTime);
          let hh:number = Math.trunc(computeLapTime/3600);
          let mm:number = Math.trunc(computeLapTime/60)-hh*60;
          let ss:number = computeLapTime-hh*3600-mm*60;
          this.w1.lap[j].lap_time = String(hh).padStart(2, '0') + ':' +
            String(mm).padStart(2, '0') +':' + String(ss).padStart(2, '0');
      } else {
          let t2: Date = new Date('1970-01-01T' + this.w1.lap[j].lap_time + 'Z');
          console.log ('init, t2=',t2);
          splitTime += t2.getTime()/1000;
      }
      
      // console.log('lap ',j+1,'lap_time=',this.w1.lap[j].lap_time, 
      //  'splitTime=',splitTime, 'idx=',this.binaryIndexOf(splitTime, correction));
      let hh:number = Math.trunc(splitTime/3600);
      let mm:number = Math.trunc(splitTime/60)-hh*60;
      let ss:number = splitTime-hh*3600-mm*60;
      this.w1.lap[j].lap_cumulatedTime = String(hh).padStart(2, '0') + ':' +
        String(mm).padStart(2, '0') +':' + String(ss).padStart(2, '0');
      idx = this.binaryIndexOf(splitTime, correction);
      console.log('idx dichotomie=', idx);
      this.w1.lap[j].lap_end = idx;
      if (idx<0 && (j==this.w1.lap.length-1) ) {this.w1.lap[j].lap_end=this.resolution-1}
      // console.log('lap_end=', this.w1.lap[j].lap_end);
    }
  }

  updateView () {

    if (this.isMobile) {
      this.winLap.x = 0;
      this.winLap.y = window.innerHeight - 0.4 * window.innerHeight ;
      this.winLap.width = window.innerWidth;
      this.winLap.height = 0.4 * window.innerHeight;
    } else {
      this.winLap.x = 50;
      this.winLap.y = 130;
      this.winLap.width = 310;
      this.winLap.height = 500;
    }
    this.winLap.px = 0;
    this.winLap.py = 0;
    this.winLap.draggingCorner = false;
    this.winLap.draggingWindow = false;
    this.winTrends.minArea = 20000

    if (this.isMobile) {
      this.winTrends.x = 0;
      this.winTrends.y = window.innerHeight - 0.4 * window.innerHeight ;
      this.winTrends.width = window.innerWidth;
      this.winTrends.height = 0.4 * window.innerHeight;
    } else {
      this.winTrends.x = window.innerWidth - 0.75 * window.innerWidth - 10;
      this.winTrends.y = window.innerHeight - 0.2 * window.innerHeight - 10;
      this.winTrends.width = 0.70 * window.innerWidth;
      this.winTrends.height = 0.2 * window.innerHeight;
    }
    
    this.winTrends.px = 0;
    this.winTrends.py = 0;
    
    this.winTrends.draggingCorner = false;
    this.winTrends.draggingWindow = false;
    this.winTrends.minArea = 20000;

    this.winInfos.x = 50;
    this.winInfos.y = window.innerHeight - 0.2 * window.innerHeight - 10;
    this.winInfos.px = 0;
    this.winInfos.py = 0;
    this.winInfos.width = 300;
    this.winInfos.height = 150;
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
    if (this.isMobile) {
      event.setZoom(event.zoom+1); 
    }
    event.fitBounds(bounds);
    console.log('this.lng=', this.lng);
    if (this.isMobile) {
      event.panBy(0, this.winTrends.height / 1.6)
    } else {
      event.panBy(-(this.winLap.width/2), this.winTrends.height / 1.6)
    }
    console.log('zoom=', event.zoom);

    this.squarePin = {
      path: "M45 1H5v40h15.093l5.439 8.05 5.44-8.05H45z",
      fillColor: '#FFFF33',
      fillOpacity: 1,
      anchor: new google.maps.Point(22,55),
      labelOrigin: new google.maps.Point(24,22),
      strokeWeight: 0.5,
      strokeOpacity: 1,
      scale: 0.65
    };

    this.squarePin2 = {
      path: "M45 1H5v40h15.093l5.439 8.05 5.44-8.05H45z",
      fillColor: '#8A2BE2',
      fillOpacity: 0.5,
      anchor: new google.maps.Point(22,55),
      labelOrigin: new google.maps.Point(24,22),
      strokeWeight: 0.5,
      strokeOpacity: 1,
      scale: 0.65
    };

    // icon for markers
    this.currentIcon= "";

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

  displayTrends() {

    this.padding = { left: 2, top: 2, right: 15, bottom: 5 };
    this.titlePadding = { left: 0, top: 0, right: 0, bottom: 10 };
    console.log ('w1.act.time=', this.w1.act.time);
    let tmpTime = this.srv.getStandardDate(this.w1.act.time);
    let t = new Date('1970-01-01T' + tmpTime + 'Z');
    let workoutDuration = t.getTime()/1000;
    console.log ('workoutDuration=', t, workoutDuration);
    let step = workoutDuration / (this.resolution-1);
    console.log ('step=', step);
    this.xAxis =
    {
        valuesOnTicks: true,
        minValue: 0,
        maxValue: this.resolution-1,
        labels:
          {
              formatFunction: (value: any): string => {
                // console.log('formatFunction: ', value, value*step);
                value = this.w1.gpsCoord[value].gps_time;
                  let hh:number = Math.trunc(value/3600);
                  let mm:number = Math.trunc(value/60)-hh*60;
                  let ss:number = Math.trunc(value)-hh*3600-mm*60;
                  value = String(hh).padStart(2, '0') + ':' +
                    String(mm).padStart(2, '0') +':' + String(ss).padStart(2, '0');
                  return value;
              },
              angle: 0,
              horizontalAlignment: 'right'
          },
        tickMarks: { visible: true }
    };

    this.seriesGroups =
    [
      {
            type: 'stepline',
            source: this.speedData,
            showToolTips: true,
            toolTipFormatFunction: (value: any, itemIndex: any, serie: any, group: any, categoryValue: any, categoryAxis: any) => {
              console.log ('toolTipFormatFunction');
                let dataItem = this.hrData[itemIndex];
                let pos = {
                        lat: this.w1.gpsCoord[itemIndex].gps_lat,
                        lng: this.w1.gpsCoord[itemIndex].gps_long
                      }
                // console.log('marker: ', pos, this.marker);
                this.marker.setVisible(true);
                this.marker.setPosition(pos);
                this.toolTipTrends = this.getToolTip(itemIndex);
                return '';
             },
            valueAxis:
            {
                title: (this.isMobile) ? {text: ''} : {text: 'Speed<br>'},
                flip: false,
                labels: { visible: !this.isMobile , horizontalAlignment: 'right'},
                bands: [],
            },
            series:
            [
                { displayText: 'Speed', lineWidth: 2 }
            ]
        },
        {
            type: 'stepline',
            source: this.hrData,
            showToolTips: true,
            toolTipFormatFunction: (value: any, itemIndex: any, serie: any, group: any, categoryValue: any, categoryAxis: any) => {
                let dataItem = this.hrData[itemIndex];
                let pos = {
                        lat: this.w1.gpsCoord[itemIndex].gps_lat,
                        lng: this.w1.gpsCoord[itemIndex].gps_long
                      }
                // console.log('marker: ', pos, this.marker);
                this.marker.setVisible(true);
                this.marker.setPosition(pos);
                this.toolTipTrends = this.getToolTip(itemIndex);
                return '';
            },
            valueAxis:
            {
                title: (this.isMobile) ? {text: ''} : {text: 'HeartRate<br>'},
                flip: false,
                labels: { visible: !this.isMobile , horizontalAlignment: 'right'},
                bands: [],
            },
            series:
            [
                { displayText: 'HeartRate', lineWidth: 2 }
            ]
        },
        {
            type: 'area',
            source: this.elevationData,
            showToolTips: true,
            toolTipFormatFunction: (value: any, itemIndex: any, serie: any, 
              group: any, categoryValue: any, categoryAxis: any) => {
                let dataItem = this.elevationData[itemIndex];
                let pos = {
                        lat: this.w1.gpsCoord[itemIndex].gps_lat,
                        lng: this.w1.gpsCoord[itemIndex].gps_long
                      }
                // console.log('marker: ', pos, this.marker);
                this.marker.setVisible(true);
                this.marker.setPosition(pos);
                this.toolTipTrends = this.getToolTip(itemIndex);
                return '';

            },
            valueAxis:
            {
                title: (this.isMobile) ? {text: ''} : {text: 'Altitude<br>'},
                flip: false,
                position: 'right',
                labels: { visible: !this.isMobile , horizontalAlignment: 'right'},
                bands: [],
            },
            series:
            [
                { displayText: 'Altitude', lineWidth: 1, 
                opacity: 0.3  }
            ]
        }
    ];

  }

  getToolTip( index: number ) {
    this.onChartArea = true;
    this.currentIndex = index;
    let coord = this.myChart.getItemCoord(0,0,index);
    this.currentX = coord['x'];
    let averageBand: string='';
    // console.log ('getToolTip, coords=',coord);

    
    if (this.splitBegin >= 0 ) {
      let split: any;
      split = { from: this.splitBegin, to: this.currentX, idx1: this.splitBeginIndex , idx2: index , rect: this.currentRect}
      this.setCurrentBand();

      let lapData = this.getLapInfos(this.splitBeginIndex,  index);
      averageBand = '<b>Split: ' + lapData['strTime'] + '<br />Distance: ' + lapData['dist'] +
      '<br />Elevation Gain: ' + lapData['elevationGain'] +'<br />Slope: ' + lapData['slope'] +' %<br /></b>';
    }
    let hh = Math.trunc(this.w1.gpsCoord[index].gps_time/3600);
    let mm = Math.trunc(this.w1.gpsCoord[index].gps_time/60)-hh*60;
    let ss = this.w1.gpsCoord[index].gps_time-hh*3600-mm*60;
    ss = Math.round(ss*10)/10;
    return '<DIV style="text-align:left">'+averageBand+'<b>Index:</b> ' +
                  index + '<br /><b>Time:</b> ' +
                  String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') +':' + String(ss).padStart(2, '0') + '<br /><b>HR:</b> ' +
                  this.hrData[index] + '<br /><b>Speed:</b> ' +
                  this.speedData[index] + '<br /><b>Altitude:</b> ' +
                  this.elevationData[index] + '<br /></DIV>';
  }

  showBands () {
    this.bands = [];
    this.Ymin = 0;
    this.Ymax = 0;
    // this.removeBands ();

    if (this.Ymin == 0) {
      let idx:number = -1;
      for (let i=0; i<this.seriesGroups.length; i++) {
        if (typeof this.seriesGroups[i] !== 'undefined') {
          idx = i;
        }
      }
      if (idx>0) {
        this.Ymin = this.myChart.getValueAxisRect(idx)['y'];
        this.Ymax = <number>this.myChart.getValueAxisRect(idx)['height'];
        this.xWidth = <number>this.myChart.getXAxisRect(idx)['width'];
      }
    }
    if (!this.firstRefresh) {
      for (let i = 0; i < this.w1.lap.length; i++) {
          // console.log ('redraw band: ', i);
          let band = this.renderer.rect(this.w1.lap[i].band.from, 
            this.Ymin, 
            (this.w1.lap[i].band.to-this.w1.lap[i].band.from), 
            this.Ymax, 
            { fill: '#FFFF33',  opacity: 0.4});
          this.renderer.on(band, 'dblclick', () => { this.onDblClickBand(band) });
      }
    }
  }

  showCurrentBand (x1: number, x2: number, visibility: boolean, color: string, lap: number) {

    if (true) {
      let idx:number = -1;
      for (let i=0; i<this.seriesGroups.length; i++) {
        if (typeof this.seriesGroups[i] !== 'undefined') {
          idx = i;
        }
      }
      if (idx>0) {
        this.Ymin = this.myChart.getValueAxisRect(idx)['y'];
        this.Ymax = <number>this.myChart.getValueAxisRect(idx)['height'];
        this.xWidth = <number>this.myChart.getXAxisRect(idx)['width'];
      }
    }
    let opacity: number=0;

    // console.log ('showCurrentBand, visi=', visibility);
    if (visibility) {
      opacity=0.4;
      this.currentRect = this.renderer.rect(this.xMin+x1, 
            this.Ymin, 
            (x2-x1), 
            this.Ymax, 
            { fill: color,  opacity: opacity});
      // console.log ('showCurrentBand, myToolTip=',this.myToolTip);
      // this.myToolTip.open();
    } else {
      this.renderer.attr(this.currentRect, { width: 0 });
      // this.myToolTip.close();
    }
    

  }

  resizeBands( deltaX: number ) {
    if ( this.currentTable==1 ) {
      for (let i = 0; i < this.w1.lap.length; i++) {    
        let ratio = ( this.xWidth + deltaX) / (this.xWidth);
        console.log('ratio=',ratio);

        let idx1:number = this.w1.lap[i].band.idx1;
        let idx2:number = this.w1.lap[i].band.idx2;
        let t1 = this.w1.gpsCoord[idx1].gps_time*ratio;
        let t2 = this.w1.gpsCoord[idx2].gps_time*ratio;
        this.w1.lap[i].band.from =  this.myChart.getXAxisRect(0)['x']+this.convertIndexToAbs(idx1);
        this.w1.lap[i].band.to =  this.myChart.getXAxisRect(0)['x']+this.convertIndexToAbs(idx2);
      }
    }
  }

  removeBands () {
    /*
    for (let i = 0; i < this.recessions.length-1; i++) {
      this.renderer.attr(this.recessions[i].rect, { fill: 'red', opacity: 0});
      let fillColor = this.renderer.getAttr(this.recessions[i].rect, 'fill');
      console.log('Erase band: ', this.recessions[i].rect, 'fill=',fillColor);
    }
    */
  }

  setCurrentBand () {
    let startX: number; 
    console.log('setCurrentBand, currentX= ',this.currentX);
    if ( this.saveCurrentX < 0 && this.splitBegin>=0 )  {
      startX = this.splitBegin;
      console.log('setCurrentBand, first rect');
      this.currentRect = this.renderer.rect(startX, 
        this.myChart.getValueAxisRect(0)['y'], 
        (this.currentX-startX), 
        this.myChart.getValueAxisRect(0)['height'], 
        { fill: '#FFFF33',  opacity: 0.4});
    } else {
      startX = this.saveCurrentX;
      if (this.currentX > this.splitBegin ) {
        this.renderer.attr(this.currentRect, { width:  this.currentX-this.splitBegin});
      }
    }
    this.saveCurrentX = this.currentX;
  }

  updateWatchLapTable (update: number) {
    console.log('>>> updateWatchLapTable');
    this.resetLapsColor();
    this.removeBands ();
    this.currentTable = 0;

    if (typeof this.w1.watchLaps != "undefined") {
      this.w1.lap = Object.assign([], this.w1.watchLaps);
      this.lapSize = this.w1.lap.length;
      this.lap_end_index = this.w1.lap[this.lapSize-1].lap_end;
    }
    this.currentIcon = "";
    this.srv.pushWorkout(this.w1.lap, this.selectedTable);
    if (this.showTrends) {this.myChart.refresh();}
  }

  updateSplitLapTable() {
    console.log('>>> updateSplitLapTable, currentTable=',this.currentTable);
    this.resetLapsColor();
    if ( (this.currentTable==0) ) {
      this.w1.watchLaps = Object.assign([], this.w1.lap);
      console.log('copy watchLaps=',this.w1.watchLaps);
    }
    this.currentTable = 2;
    this.selectedTable = 2;
    if (this.showTrends) {this.myChart.refresh();}
    this.currentIcon = this.squarePin2;
    this.lap_end_index = 0;

    if ( typeof this.w1.splitLaps !== 'undefined') {
      console.log ('copy split Laps');
      this.w1.lap = Object.assign([], this.w1.splitLaps);
    } else {
      let k = 1;
      let currentTime = 0;
      let currentDate: Date;
      this.w1.lap = [];
      currentDate = new Date(this.w1.dayTime);
      currentTime = currentDate.getTime()/1000;
      this.done = 0;

      for (let i =0; i< this.w1.splits.length; i++) {
        let l1: Lap = new Lap();

        let distance: number;

        if (Math.trunc(this.w1.splits[i].split_distance/1000) <1) {  
          console.log ('dist < 1');
          distance = Math.round(this.w1.splits[i].split_distance/10)*10;
        } else {
          distance = Math.round(this.w1.splits[i].split_distance/1000)*1000;
        }

        l1 = {
          lap_index: k++,
          lap_start_index: 0,
          lap_end_index: 0,
          lap_distance: distance,
          lap_time: this.w1.splits[i].split_time,
          lap_start_date: currentDate.toString(),
          lap_cumulatedTime: "",
          lap_average_speed: 0,
          lap_average_HR: 0,
          lap_average_cadence: 0,
          lap_pace_zone: 0,
          lap_total_elevation_gain: 0,
          lap_start: 0,
          lap_end: 0,
          lap_slope: 0,
          band: {}
        };
        // console.log ('updateSplitLapTable, split_time=', this.w1.splits[i].split_time);
        let t = new Date('1970-01-01T' + this.w1.splits[i].split_time + 'Z');
        currentTime += t.getTime()/1000;
        currentDate = new Date(currentTime*1000);

        // console.log ('updateSplitLapTable, cumulatedTime=', cumulatedTime, currentDate.toString());
        this.w1.lap.push(l1);
      }

      if ( this.w1.splits.length && (this.w1.gpsCoord.length>0)  ) {

        this.computeWatchLapIndex(0,1);
        this.lapSize = this.w1.lap.length;
        this.lap_end_index = this.w1.lap[this.lapSize-1].lap_end;
        // this.w1.lap.sort(this.compare);
        
        console.log ('updateSplitLapTable, w1.lap=', this.w1.lap);

        for (let i =0; i< this.w1.lap.length; i++) {
          
          let avgSpeed: number = 0;
          let avgHR: number = 0;
          let elevationGain: number = 0;
          let deltaH: number = 0;
          let deltaD: number = 0;
          let slope : number = 0;
          for (let j=this.w1.lap[i].lap_start; j<=this.w1.lap[i].lap_end;j++) {
            avgSpeed+=this.speedData[j];
            avgHR+=this.hrData[j];
            if (j>this.w1.lap[i].lap_start) {
              elevationGain += this.elevationData[j] - this.elevationData[j-1];
              deltaH += this.elevationData[j] - this.elevationData[j-1];
              deltaD += this.distanceData[j] - this.distanceData[j-1];
            }
          }
          slope = (deltaH) / (Math.sqrt(Math.pow(deltaD,2)-Math.pow(deltaH,2))) *100;

          avgSpeed=avgSpeed/(this.w1.lap[i].lap_end-this.w1.lap[i].lap_start+1);
          avgSpeed = Math.trunc(avgSpeed*100)/100;
          avgHR=avgHR/(this.w1.lap[i].lap_end-this.w1.lap[i].lap_start+1);
          avgHR = Math.trunc(avgHR); 
          // console.log('avgSpeed1=',avgSpeed);
          this.w1.lap[i].lap_average_speed = avgSpeed;
          this.w1.lap[i].lap_average_HR = Math.round(avgHR);
          this.w1.lap[i].lap_total_elevation_gain= Math.round(elevationGain);
          this.w1.lap[i].lap_slope= Math.round(slope*10)/10;
         }
         this.w1.splitLaps = Object.assign([], this.w1.lap);
      }
    }
    console.log ('split Laps built');
    this.done = 1;
    this.srv.pushWorkout(this.w1.lap,this.selectedTable);
  }

  updateCustomLapTable () {
    console.log('>>> updateCustomLapTable, currentTable=',this.currentTable);
    this.resetLapsColor();

    if ( (this.currentTable==0) ) {
      this.w1.watchLaps = Object.assign([], this.w1.lap);
      console.log('copy watchLaps=',this.w1.watchLaps);
    }     

    this.w1.lap = [];
    
    if ( typeof this.w1.customlaps !== 'undefined') {
      console.log ('copy custom Laps');
      this.w1.lap = Object.assign([], this.w1.customlaps);
      if ( (this.currentTable!=1) ) {
        // this.myChart.refresh();
        console.log ('Refresh bands');
        this.showBands();
      }
      console.log ('updateCustomLapTable, w1.lap=', this.w1.lap);
     } 
     this.currentTable = 1;
     this.selectedTable = 1;
     this.firstRefresh = false;
     this.currentIcon = this.squarePin;
     this.lapSize = this.w1.lap.length;
     this.lap_end_index = 0;
     this.srv.pushWorkout(this.w1.lap,this.selectedTable);

   }

  addCustomLap (split: any) {

    if ( (this.currentTable==0) ) {
      this.w1.watchLaps = Object.assign([], this.w1.lap);
      console.log('copy watchLaps=',this.w1.watchLaps);
    }     

    this.currentTable = 1;
    this.selectedTable = 1;
    this.firstRefresh = false;
    this.currentIcon = this.squarePin;
    if ( typeof this.w1.customlaps === 'undefined' ) {
      this.w1.lap = [];
      this.w1.customlaps = [];
    }
    this.lap_end_index = 0;
    let cumulatedTime: number = 0;
    let elevationGain: number = 0;
    let k = 1;
    let beginTime: number = this.startHour;

    let lapData = this.getLapInfos (split.idx1, split.idx2);
    let avgSpeed: number = 0;
    let avgHR: number = 0;
    for (let i=lapData['idx1']; i<=lapData['idx2'];i++) {
      avgSpeed+=this.speedData[i];
      avgHR+=this.hrData[i];
    }
    avgSpeed=avgSpeed/(lapData['idx2']-lapData['idx1']+1);
    avgSpeed = Math.trunc(avgSpeed*100)/100;
    avgHR=Math.round(avgHR/(lapData['idx2']-lapData['idx1']+1));
    console.log('avgSpeed1=',avgSpeed);
  
    let l1: Lap = new Lap();
    l1 = {
      lap_index: k++,
      lap_start_index: split.idx1,
      lap_end_index: split.idx2,
      lap_distance: lapData['dist'],
      lap_time: lapData['strTime'],
      lap_start_date: (beginTime+lapData['startTime']).toString(),
      lap_cumulatedTime: "",
      lap_average_speed: avgSpeed,
      lap_average_HR: avgHR,
      lap_average_cadence: 0,
      lap_pace_zone: 0,
      lap_total_elevation_gain: lapData['elevationGain'],
      lap_start: split.idx1,
      lap_end: split.idx2,
      lap_slope: lapData['slope'],
      band: split
    };
    // console.log('splitLap=',l1, 'lap_start_date=',l1.lap_start_date,'cumulatedTime=',cumulatedTime);

    this.w1.lap.push(l1);
    this.w1.customlaps.push(l1);
    this.lapSize = this.w1.lap.length;
    this.lap_end_index = this.w1.lap[this.lapSize-1].lap_end_index;

     this.w1.lap.sort(this.compare);
     this.w1.customlaps.sort(this.compare);
     k = 1;
     this.w1.lap.forEach(element => {
        console.log('After sort, element=', element);
        let t = new Date('1970-01-01T' + element['lap_time'] + 'Z');
        cumulatedTime += t.getTime()/1000;
        let hh:number = Math.trunc(cumulatedTime/3600);
        let mm:number = Math.trunc(cumulatedTime/60)-hh*60;
        let ss:number = cumulatedTime-hh*3600-mm*60;
        let totaltime = String(hh).padStart(2, '0') + ':' +
                String(mm).padStart(2, '0') +':' + String(ss).padStart(2, '0');
        this.w1.customlaps[k-1].lap_cumulatedTime = totaltime;
        element['lap_cumulatedTime']=totaltime;
        this.w1.customlaps[k-1].lap_index = k;
        element['lap_index'] = k++;
     });

     console.log ('addCustomLap, w1.lap=', this.w1.lap);
     this.srv.pushWorkout(this.w1.lap,this.selectedTable);
  }

  compare (a: Lap, b: Lap) {
    let comparison = 0;
    let t1 = a.lap_start_date;
    let t2 = b.lap_start_date;

    if ( t1 > t2 ) comparison = 1;
    if ( t1 < t2 ) comparison = -1;

    return comparison;
  }

  convertIndexToAbs (idx:number) {
    let w:string|number = <number>this.myChart.getXAxisRect(0)['width'];
    let x:number = (idx*w)/this.w1.gpsCoord.length;
    // console.log('convertIndexToAbs, x0=',this.myChart.getXAxisRect(0)['x']);
    // console.log('convertIndexToAbs, idx=',idx, 'x=', x, 'w=', w);
    return ( x );
  }


  draw = (renderer: any, rect: any): void => {
    this.renderer = renderer;
    this.rect = rect;
  };

  getLapInfos (idx1: number, idx2:number) {

    console.log ('getLapInfos, idx1=', idx1, 'idx2=',idx2);
    let t = this.w1.gpsCoord[idx2].gps_time - this.w1.gpsCoord[idx1].gps_time;
    let hh:number = Math.trunc(t/3600);
    let mm:number = Math.trunc(t/60)-hh*60;
    let ss:number = t-hh*3600-mm*60;
    let averageTime = String(hh).padStart(2, '0') + ':' +
      String(mm).padStart(2, '0') +':' + String(ss).padStart(2, '0');
    let dist:number = Math.round(this.distanceData[idx2] - this.distanceData[idx1]);

    let elevationGain: number = 0;
    let altitude: number = this.elevationData[idx1];
    let avgSpeed: number = 0;
    let avgHR: number = 0;
    let slope : number = 0;
    let deltaH: number = 0;
    let deltaD: number = 0;
    let nbSteps = 1;
        
    for (let i=idx1; i<=idx2; i++) {
      if (i> idx1) {
        deltaH += this.elevationData[i] - this.elevationData[i-1];
        deltaD += this.distanceData[i] - this.distanceData[i-1];
        elevationGain += this.elevationData[i] - this.elevationData[i-1];
      }
      avgSpeed+=this.speedData[i];
      avgHR+=this.hrData[i];
    }
    // console.log ('deltaH=',deltaH);
    // console.log ('deltaD=',deltaD);
    slope = (deltaH) / (Math.sqrt(Math.pow(deltaD,2)-Math.pow(deltaH,2))) *100;
    slope = Math.round (slope*10)/10;
    elevationGain= Math.round(elevationGain);
    avgSpeed=avgSpeed/(idx2-idx1+1);
    avgSpeed = Math.trunc(avgSpeed*100)/100;
    avgHR=avgHR/(idx2-idx1+1);
    avgHR = Math.trunc(avgHR);
    return {
      idx1: idx1, idx2: idx2, dist: dist, strTime: averageTime, startTime: this.w1.gpsCoord[idx1].gps_time ,
      elevationGain: elevationGain, avgSpeed: avgSpeed, avgHR: avgHR, slope: slope};
  }

  ngAfterViewInit() {
    console.log("ngAfterViewInit");
    this.mapsAPILoader.load().then(() => {
      console.log("load Agm");
    });
  }

  binaryIndexOf(searchElement, correction) {
    'use strict';
 
    var minIndex = 0;
    var maxIndex = this.w1.gpsCoord.length - 1;
    var accuracy;
    if (correction) {
      accuracy = this.workoutSize/this.w1.gpsCoord.length;
    } else {
      accuracy = 1;
    }
    console.log('workoutSize=',this.workoutSize,'accuracy=',accuracy);
    var currentIndex;
    var currentElement;
    console.log ('binaryIndexOf, searchElement=', searchElement);
    while (minIndex <= maxIndex) {
        currentIndex = (minIndex + maxIndex) / 2 | 0;
        
        currentElement = this.w1.gpsCoord[currentIndex].gps_time;
        console.log ('binaryIndexOf, currentIndex=', currentIndex, 'val=',currentElement);
 
        if ( (currentElement < searchElement) && 
             (Math.abs(currentElement-searchElement)>accuracy) ) {
            minIndex = currentIndex + 1;
        }
        else if ( (currentElement > searchElement) && 
                  (Math.abs(currentElement-searchElement)>accuracy) ) {
            maxIndex = currentIndex - 1;
        }
        else {
            let delta=(currentElement-searchElement);
            let index: number = currentIndex;
            // console.log('delta=',delta);
            if ( delta>0 && Math.abs(delta)>(accuracy/2) ) {
              // console.log('correction -1');
              index =  currentIndex-1;
            }
            if ( delta<0 && Math.abs(delta)>(accuracy/2) ) {
              // console.log('correction +1');
              index = currentIndex+1;
            }
            // console.log('index=',index, 'res=', this.resolution);
            if ( index > (this.w1.gpsCoord.length - 1) ) {
              index = this.w1.gpsCoord.length - 1;
            }
            console.log('return index=',index);
            return index;
        }
    }

    return currentIndex;
  }

  resetLapsColor () {
    console.log ('resetLapsColor, resolution=',this.resolution);
    this.bands = [];
    for (let i=0;i<this.w1.gpsCoord.length;i++) {
      this.w1.gpsCoord[i].strokeWeight = 2;
      this.w1.gpsCoord[i].color = '#2196f3';
    }
  }


  onLapSelected (lap: lapSelection) {
    // console.log(">>>> onLapSelected, lap=", lap.lap_idx);
    let strokeWeight:number;
    let lineColor:string;
    let bandColor: string;
    let numLap=lap.lap_idx;
    let visibility: boolean = true;
    if (lap.lap_idx > 0) {
      strokeWeight = 4;
      if (lap.isCurrent) {
        lineColor = 'black';
        bandColor = 'gray ';
        this.onChartArea = true;
      } else {
        switch(this.selectedTable) { 
           case 0: { 
              lineColor = 'red';
              bandColor = lineColor;
              break; 
           } 
           case 1: { 
              lineColor = 'yellow';
              bandColor = lineColor;
              break; 
           }
           case 2: { 
              lineColor = '  #8A2BE2';
              bandColor = lineColor;
              break; 
           }  
           default: { 
              lineColor = 'red';
              break; 
           } 
         } 
      }
    } else {
      numLap= lap.lap_idx * (-1);
      strokeWeight = 2;
      lineColor = '#2196f3';
      visibility = false;
      this.onChartArea = false;
    }

    if (lap.toClear) visibility = false;

    numLap = numLap -1;
    let i:number=0;
    
    let start_idx = this.w1.lap[numLap].lap_start;
    let end_idx = this.w1.lap[numLap].lap_end;
    // console.log(">>>> onLapSelected, speed=",speed);
    for(i = start_idx;i<end_idx;i++) {
      this.w1.gpsCoord[i].strokeWeight = strokeWeight;
      this.w1.gpsCoord[i].color = lineColor;
      // console.log(">>>> onLapSelected, i=",i,"speed=",this.w1.gpsCoord[i].speed);
    }

    if (this.showTrends) {
      let x1 = this.convertIndexToAbs(start_idx);
      let x2 = this.convertIndexToAbs(end_idx);

      if (lap.isCurrent || lap.lap_idx< 0 || lap.toClear) this.showCurrentBand (x1, x2, visibility, bandColor, numLap);
      if (!lap.isCurrent && lap.lap_idx > 0) this.bands[numLap] = this.currentRect;

      if (lap.toRemove) {
        console.log("Lap toRemove: ", lap.lap_idx);
        this.w1.lap.splice(lap.lap_idx-1, 1);
        this.w1.customlaps.splice(lap.lap_idx-1, 1);
        this.lapSize = this.w1.lap.length;
        this.lap_end_index = 0;
        console.log ('w1.lap=',this.w1.lap);
        for (let i=0; i<this.lapSize;i++) {
          this.w1.lap[i].lap_index = i+1;
          this.w1.customlaps[i].lap_index = i+1;
        }
        this.updateCustomLapTable (); 
        this.myChart.refresh();
      }
    }

  }

  onTableSelect (event: any) {
    console.log('onTableSelect, selection: ',this.selectedTable);
    switch(this.selectedTable) { 
     case 0: { 
        this.updateWatchLapTable (1);
        break; 
     } 
     case 1: { 
        this.updateCustomLapTable (); 
        break; 
     }
     case 2: { 
        this.updateSplitLapTable (); 
        break; 
     }  
     default: { 
        break; 
     } 
   }

  }

  onLapInfos(data: infos) {
    // console.log(">>>> onLapInfos, total dist=",data.total_dist, 
    //  "average time=",data.average_time,
    //  "nbValues=",data.nbValues);

    if ( data.nbValues > 1) {
      this.lapInfos.show = true;
    }  else {
      this.lapInfos.show = false;
    }
    this.infosData[0]['value'] = data.total_time;
    this.infosData[1]['value'] = data.average_time;
    this.infosData[2]['value'] = data.average_speed;
    this.infosData[3]['value'] = String(data.total_dist);
    this.infosData[4]['value'] = String(data.slope);
    this.infosData[5]['value'] = String(data.elevation);
    // console.log(">>>> onLapInfos, infosData=",this.infosData);
  }

  clickedMarker(label: string, index: number) {
    console.log('clicked the marker:', index);
    let idx:number = index-1;
    if (idx>=0 || (this.selectedTable==1)) {
      if (this.selectedTable==1) {
        idx = idx + 1;
      }
      this.clickLapDistance = this.w1.lap[idx].lap_distance;
      this.clickLapTime = this.w1.lap[idx].lap_time.toString();
    } else {
      this.clickLapDistance = 0;
      this.clickLapTime = "00:00:00";  
    }
  }

  onClickSettings () {
    console.log('clicked Settings button');
    if (this.isMobile) {
      this.showLaps = !this.showLaps;
      this.showTrends = !this.showTrends;
    } else {
      this.showSettings = !this.showSettings;
    }
    
  }

  onDblClickBand (band : any) {

    console.log ('onDblClickBand: ', band);
    // this.renderer.attr(band { width:  10});

  }

  onChartEvent(event: any): any {
        let eventData;
        console.log('chartEvent: ',event.type);
        if (event) {
            if (event.args) {
                if (event.type == 'toggle') {
                  this.splitBegin = -1;
                  this.saveCurrentX = -1;
                  this.onChartArea = false;
                  this.timer = setTimeout(() => {
                    this.showBands();
                  }, 500);  
                }
            } else if (event.type == 'mouseleave') {
                  this.marker.setVisible(false);
                  this.splitBegin = -1;
                  this.saveCurrentX = -1;
                  this.onChartArea = false;
             } else if (event.type == 'mousedown') {
                  if (this.splitBegin <0 && this.currentTable==1) {
                    this.splitBegin = this.currentX;
                    this.splitBeginIndex = this.currentIndex;
                    console.log ('splitBegin=',this.splitBegin);
                  } 
            } else if (event.type == 'mouseup') {

                  if ( (this.splitBegin != this.currentX)  && (this.currentX - this.splitBegin)>0 &&
                        this.currentTable==1)  {
                    let split: any;
                    split = { from: this.splitBegin, to: this.currentX, idx1: this.splitBeginIndex, idx2: this.currentIndex, rect: this.currentRect }
                    console.log ('push split', split);
                    this.renderer.on(this.currentRect, 'dblclick', () => { this.onDblClickBand(this.currentRect) });
                    this.addCustomLap(split);
                    this.updateCustomLapTable();
                    this.splitBegin = -1;
                    this.saveCurrentX = -1;
                  } else {
                    this.splitBegin = -1;
                    this.saveCurrentX = -1;
                  }
            } 
            if (event.type == 'refreshBegin') {
                console.log ('>> refreshBegin => removeBands');
                this.removeBands();
            }
            if (event.type == 'refreshEnd') {
                console.log ('>> refreshEnd => showBands');

                if (typeof this.myChart !== 'undefined') {
                  this.xMin = this.myChart.getXAxisRect(0)['x'];
                  this.xWidth = <number>this.myChart.getXAxisRect(0)['width'];
                  console.log ('>> xWidth =', this.xWidth);
                }
                if (this.currentTable==1) this.showBands();
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
    this.resizeBands (offsetX);
  }

  @HostListener('document:mouseup', ['$event'])
  onCornerRelease(event: MouseEvent) {
    this.selectedWindow.draggingWindow = false;
    this.selectedWindow.draggingCorner = false;
    console.log('>>> onCornerRelease');
  }

  @HostListener('window:resize', ['$event'])
  onResize(event) {
    this.newInnerHeight = event.target.innerHeight;
    this.newInnerWidth = event.target.innerWidth;
    this.updateView();
    /* this.fitToScreen(this.agmMap); */
  }
}

export interface LapTable {
  value: number;
  viewValue: string;
}

export interface infoTable {
  title: string;
  value: string;
}

export class Progress {
    value: number;
}

export class Window {
  name: string;
  app: WorkoutComponent;
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
  id: number;

  constructor(private father: WorkoutComponent, id: number) {
    this.app = father;
    this.id = id;
  }

  area() {
    return this.width * this.height;
  }

  onWindowPress(event: MouseEvent, id: number) {
    console.log ('onWindowPress');
     if (!this.app.onChartArea) {
      this.app.selectedWindow = this;
      this.draggingWindow = true;
      this.px = event.clientX;
      this.py = event.clientY;
      console.log('Press winId=', id);
    }
  }

  onWindowDrag(event: MouseEvent, id: number) {
    // console.log ('onWindowDrag, draggingWindow=', this.draggingWindow);
    if (!this.draggingWindow) {
      return;
    }
    let offsetX = event.clientX - this.px;
    let offsetY = event.clientY - this.py;

    this.x += offsetX;
    this.y += offsetY;
    this.px = event.clientX;
    this.py = event.clientY;

    this.father.redrawBands = false;
  }

  onWindowEnter(event: MouseEvent, id: number) {
    console.log ('>>> onWindowEnter : ', id);
    this.app.selectedWindow = this;
  }

  topLeftResize(offsetX: number, offsetY: number) {
    this.x += offsetX;
    this.y += offsetY;
    this.width -= offsetX;
    this.height -= offsetY;
    // if (this.id==2) this.father.redrawBands = true;
  }

  topRightResize(offsetX: number, offsetY: number) {
    this.y += offsetY;
    this.width += offsetX;
    this.height -= offsetY;
    // if (this.id==2) this.father.redrawBands = true;
    console.log('topRightResize', this.id);
  }

  bottomLeftResize(offsetX: number, offsetY: number) {
    this.x += offsetX;
    this.width -= offsetX;
    this.height += offsetY;
    // if (this.id==2) this.father.redrawBands = true;
  }

  bottomRightResize(offsetX: number, offsetY: number) {
    this.width += offsetX;
    this.height += offsetY;
    // if (this.id==2) this.father.redrawBands = true;
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

