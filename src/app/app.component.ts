import { Component, ElementRef, HostListener, ViewChild, OnInit, AfterViewInit, OnChanges, SimpleChanges, Input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { CollectionViewer, DataSource } from '@angular/cdk/collections';
import { GoogleMapsAPIWrapper, AgmMap, LatLngBounds, LatLngBoundsLiteral, MapsAPILoader } from '@agm/core';
import { animate, state, style, transition, trigger } from '@angular/animations';

declare var google: any;

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
        
  winLap: Window = new Window(this);
  winTrends: Window = new Window(this);

  @ViewChild('AgmMap') agmMap: AgmMap;
  @Input() toFit: number;

  constructor(private http: HttpClient, private eltRef: ElementRef, private mapsAPILoader: MapsAPILoader) {

    this.newInnerHeight = window.innerHeight;
    this.newInnerWidth = window.innerWidth;

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

  public w1: Workout = new Workout();

          
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
      this.w1.lap = new Array<Lap>();
      w['laps'].forEach(item => {
        let l1: Lap = new Lap();
        l1 = {
          lap_index: item.lap_index,
          lap_distance: item.lap_distance,
          lap_time: item.lap_time
        };
        this.w1.lap.push(l1);
      });
      this.w1.gpsCoord = new Array<Gps>();
        w['gps'].forEach(item => {
        let p1: Gps = new Gps();
        p1 = {
          gps_index: item.gps_index,
          gps_lat: item.gps_lat,
          gps_long: item.gps_long,
          speed: 10
        };
        this.w1.gpsCoord.push(p1);
      });
      console.log('w1=', this.w1);
      this.done = 1;
    });

  }

  updateView () {
    this.winLap.x = 50;
    this.winLap.y = 150;
    this.winLap.px = 0;
    this.winLap.py = 0;
    this.winLap.width = 300;
    this.winLap.height = 600;
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
  }

  ngAfterViewInit() {
    console.log("ngAfterViewInit");
    this.mapsAPILoader.load().then(() => {
      console.log("load Agm");
    });
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
  lap_distance: number;
  lap_time: DatePipe;
}

export class Gps {
  gps_index: number;
  gps_lat: number;
  gps_long: number;
  speed: number;
}

export class Workout {
  name: string;
  actId: number;
  lap: Lap[];
  gpsCoord: Gps[];
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