import { Component, ElementRef, HostListener, ViewChild, OnInit, AfterViewInit, 
  OnChanges, SimpleChanges, ChangeDetectorRef, Input, Output, Inject, EventEmitter } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { CollectionViewer, DataSource } from '@angular/cdk/collections';
import { GoogleMapsAPIWrapper, AgmMap, LatLngBounds, LatLngBoundsLiteral, MapsAPILoader } from '@agm/core';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { Chart } from 'chart.js';
import { jqxChartComponent  } from 'jqwidgets-scripts/jqwidgets-ts/angular_jqxchart';
import { jqxTooltipComponent  } from 'jqwidgets-scripts/jqwidgets-ts/angular_jqxtooltip';
import { WorkoutService, Gps, Heartrate, Activity, Lap, Workout, 
  lapSelection, Split, infos } from './workout.service';


declare var google: any;

export interface DialogData {
  showLap: boolean;
  showTrends: boolean;
}

export class myIcone {
  path: string;
  color: string;
  viewbox: string;
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
  @ViewChild('myChart') myChart: jqxChartComponent; 
  @ViewChild('myToolTip') myToolTip: jqxTooltipComponent ;
  title = 'MyStrava';
  /* url : string = 'http://fakarava94.no-ip.org:3000/workout/'; */
  urlbase: string = '/strava2/';
  urlworkout: string = 'workoutDetail/';
  urlprogress: string = 'getProgress/';
  wid: string;
  lat: number = 48.832929;
  lng: number = 2.473295;
  progressValue: number = 2;
  progressTimer: any;
  startupLoadTime: number = 0;

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

  // activity icons

  typeIcon: Array<myIcone> = new Array<myIcone>();
  
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

  @ViewChild('AgmMap') agmMap: AgmMap;

  constructor(private http: HttpClient, private eltRef: ElementRef, 
    private mapsAPILoader: MapsAPILoader, public dialog: MatDialog,
    private gmapsApi: GoogleMapsAPIWrapper, 
    private changeDetectorRefs: ChangeDetectorRef,
    private wktService: WorkoutService) {

    this.srv = wktService;
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

    this.showProgress();
    this.getWorkout();
  }

  public showProgress() {
        this.progressTimer = setInterval(() => {
          console.log ('Check progress ...');
          if ( this.startupLoadTime++ > 120) clearInterval(this.progressTimer);
          if (this.wid != "") {
            this.http.get(this.urlbase + this.urlprogress).subscribe((p: Progress) => {
              console.log ('Receive progress value=', p.value);
              if (p.value>=55){ this.progressValue += 5; } else {this.progressValue = p.value;}
              }
            );
          }

      }, 1000);
  }
          
  public getWorkout() {
    
    if (this.wid != "") {
      this.urlworkout = this.urlbase + this.urlworkout + this.wid;
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

      // icon for avtivity type
      let ic = new myIcone ();
      ic = {
          viewbox:"0 0 10 10",
          // path: "M283.733,85.333c23.467,0,42.667-19.2,42.667-42.667C326.4,19.2,307.2,0,283.733,0s-42.667,19.2-42.667,42.667 S260.267,85.333,283.733,85.333zM401.067,245.333v-42.667c-39.467,0-73.6-21.333-92.8-52.267L288,116.267C280.533,103.467,266.667,96,251.733,96 c-5.333,0-10.667,1.067-16,3.2l-112,45.867v100.267H166.4v-71.467l37.333-14.933l-33.067,171.733L66.133,310.4L57.6,352 c0,0,149.333,28.8,149.333,29.867L227.2,288l45.867,42.667v128h42.667V297.6L272,253.867l12.8-64 C312.533,224,354.133,245.333,401.067,245.333z",
          //path: "M 11.136719 3.347656 C 12.054688 3.347656 12.808594 2.59375 12.808594 1.675781 C 12.808594 0.753906 12.054688 0 11.136719 0 C 10.214844 0 9.460938 0.753906 9.460938 1.675781 C 9.460938 2.59375 10.214844 3.347656 11.136719 3.347656 Z M 11.136719 3.347656 M 15.738281 9.628906 L 15.738281 7.953125 C 14.191406 7.953125 12.851562 7.117188 12.097656 5.902344 L 11.300781 4.5625 C 11.007812 4.058594 10.464844 3.765625 9.878906 3.765625 C 9.667969 3.765625 9.460938 3.808594 9.25 3.894531 L 4.855469 5.691406 L 4.855469 9.628906 L 6.53125 9.628906 L 6.53125 6.824219 L 7.996094 6.238281 L 6.699219 12.976562 L 2.59375 12.179688 L 2.261719 13.8125 C 2.261719 13.8125 8.121094 14.945312 8.121094 14.984375 L 8.917969 11.300781 L 10.714844 12.976562 L 10.714844 18 L 12.390625 18 L 12.390625 11.679688 L 10.675781 9.960938 L 11.175781 7.449219 C 12.265625 8.789062 13.898438 9.628906 15.738281 9.628906 Z M 15.738281 9.628906",
          path : "M21.490669535757153,7.771587645052615 c2.009027999676253,0 3.6527548328370347,-1.572832122779785 3.6527548328370347,-3.4952098011794326 C25.143424368594186,2.354082083813263 23.49969753543339,0.781249961033478 21.490669535757153,0.781249961033478 s-3.6527548328370347,1.572832122779785 -3.6527548328370347,3.4952098011794326 S19.481727146853448,7.771587645052615 21.490669535757153,7.771587645052615 z M31.53572392336585,20.878522001550824 v-3.4952098011794326 c-3.378800360643573,0 -6.300952860449662,-1.7475639414198523 -7.944679693610444,-4.281625862569325 L21.855970702272618,10.305649566202087 C21.21671506356368,9.257094817682232 20.029636091240377,8.645410574932404 18.751124813822518,8.645410574932404 c-0.45656225006491896,0 -0.9132101109023988,0.08740686848989754 -1.369772360967318,0.2621386871299644 l-9.588406526771225,3.757348488309397 v8.213706169518789 H11.445700758921005 v-5.854457985349111 l3.1961069719995554,-1.2232865671599233 l-2.830891416256644,14.068082236528168 L2.8617654266016226,26.208702612640007 L2.131248704343239,29.61650554532954 c0,0 12.784513498770778,2.359248184169678 12.784513498770778,2.446655052659575 L16.650835730596803,24.37373180273026 l3.9267093050304984,3.4952098011794326 v10.485547485198568 h3.6527548328370347 V25.16014786412015 L20.4861983413053,21.577613112790548 l1.0958178887738548,-5.242773742599284 C23.956259785498315,19.130958060130972 27.517667924013338,20.878522001550824 31.53572392336585,20.878522001550824 z",
          color: "#FFDA44"
      }
      this.typeIcon['Run'] = ic;
      ic = {
        viewbox: "-200 -200 512 512",
          path: "M29.055181993305876,8.559142750817934 c1.8467602488471275,0.9570964281702284 4.225279671049894,0.41230081988367373 5.309050478412237,-1.2141735527411583 c1.086588541018145,-1.6269398109915876 0.4710898455791799,-3.7214900344495483 -1.375670403267948,-4.677965878130772 c-1.849930199209904,-0.9566309898034738 -4.225719941933613,-0.4124559660059253 -5.310899616123858,1.2140184066189073 C26.59248277813607,5.508737268167758 27.20657260674713,7.60251176101446 29.055181993305876,8.559142750817934 z M35.393673852029565,20.330311765231524 c-0.21256278265946543,0 -0.4226600483701055,0.015049173858406904 -0.6312603930761016,0.028081448127542784 l-1.270709824589372,-5.5546190419135355 l0.41403073904921556,-0.1362958683980461 c0.9391858491490719,-0.30928379470859996 1.4170558663375208,-1.2309293339443337 1.0652794302461523,-2.0587890422789643 c-0.35168838191462476,-0.8285578658847637 -1.4041119023561865,-1.2476851151475077 -2.3361653631890116,-0.9378583090110277 l-4.56323160139249,1.5033659246181734 l-0.20437374422229476,-1.4633382250772566 c0.5547413134857633,-1.0234213954327949 0.4879081933372402,-2.3101257603265846 -0.4197542605375609,-3.217885721620798 c-1.8688618472098146,-1.8688901886429838 -4.14911280816653,-0.970283848561616 -4.859798068665514,-0.4635766132878333 l-9.411582627081312,6.714336305744377 l0.0014088668279003515,0.0018617534670194117 c-0.2922518126125789,0.224418865836965 -0.536161882192827,0.5030613014008698 -0.6921058292060475,0.8410471287260188 c-0.1929267012456042,0.4185842378348641 -0.22858864282683194,0.8585010674793253 -0.13771673242725938,1.270957033485251 c-0.7487246648522925,0.05189637789316609 -1.34326646622624,0.5873056457834985 -1.34326646622624,1.2602519510498889 c0,0.7047512603279725 0.6468459823597487,1.275301124908296 1.4469062322536592,1.278404047353328 l-0.5985042393274175,1.2338771102671144 c-0.7590270035313139,-0.1912175956751187 -1.556269519769424,-0.29989745431237697 -2.3832743477469296,-0.29989745431237697 C4.679408407857741,20.330311765231524 0.7812500034109604,23.76307486617081 0.7812500034109604,27.98304939141482 c0,4.220207244427374 3.8981584044467823,7.653590929855668 8.688129510954482,7.653590929855668 c4.79041137739142,0 8.686720644126583,-3.433383685428294 8.686720644126583,-7.653590929855668 c0,-2.8103168584657996 -1.7331703608476625,-5.264650939425262 -4.302150967347205,-6.595571949160762 l0.9648096145815084,-1.9899041639992459 h1.5644585582065946 l5.307993828291312,1.897592221259534 l-2.835432545326198,4.093763154792305 c-0.730585504443076,1.0559245080445085 -0.35168838191462476,2.43439780425013 0.8466409093913669,3.07848693077772 c0.41306214310503403,0.22185895481981324 0.8697991578749784,0.3280564755010454 1.320812651156578,0.3280564755010454 c0.8566790855401569,0 1.693634035489709,-0.3823576182891113 2.1729129195060586,-1.0734560198589413 l2.5834214914855225,-3.730876374845771 l1.6793692588572169,0.8929435066191843 c-0.4796311007233253,0.9484858183852641 -0.7519826693918118,1.9956445705225556 -0.7519826693918118,3.09904379197606 c0,4.220207244427374 3.8967495376188803,7.653590929855668 8.686720644126583,7.653590929855668 c4.790323323214678,0 8.687072860833558,-3.433383685428294 8.687072860833558,-7.653590929855668 C44.0807467128631,23.76307486617081 40.18399717524422,20.330311765231524 35.393673852029565,20.330311765231524 zM9.469379514365443,33.71701735065122 c-3.5887360273691664,0 -6.509228907429849,-2.5724002799929435 -6.509228907429849,-5.733967959236405 c0,-3.1615676792434613 2.9204928800606815,-5.7333473747473995 6.509228907429849,-5.7333473747473995 c0.52339402656498,0 1.0257431048881984,0.06950546276872477 1.5134751898719512,0.17252248794379882 l-1.802997323005473,3.715206616498358 c-1.0353410101532698,0.1255907859626844 -1.8353132058704373,0.8996923629371303 -1.8353132058704373,1.845618270305242 c0,1.0335058933791499 0.9516895422466863,1.8719931110880172 2.1247472848272153,1.8719931110880172 c0.7719709675126487,0 1.4411827107653146,-0.3680841750419627 1.8129474449775196,-0.9122591988395113 h4.584540712164483 C15.344970565947111,31.647135360631264 12.685118049047993,33.71701735065122 9.469379514365443,33.71701735065122 zM15.866867671507444,27.02339305222743 h-4.584540712164483 c-0.03125923274403906,-0.045612959941975596 -0.06234235713459054,-0.09122591988395112 -0.09791624453907444,-0.13435654186990095 l1.802997323005473,-3.715827200987365 C14.489436184704624,24.028529881343335 15.556124481778674,25.41080425754412 15.866867671507444,27.02339305222743 zM26.914056631604325,22.352874187964737 l0.6750233189177558,-0.9746279399846611 c0.38884724450049685,-0.5610859511229747 0.47822223389542506,-1.2441167543357212 0.2442622862872234,-1.868269604153978 c-0.23431216431517723,-0.6241528498182572 -0.7676563128522034,-1.1259729822411138 -1.4583532752303499,-1.373353474171318 l-4.642656468815374,-1.6596756427866783 l2.8567416560981904,-2.038697619447379 l0.1588497348457647,1.1396258409992563 c0.06656895761829162,0.4861503740754436 0.3844445356633083,0.9185426167907015 0.8594968191959574,1.172904684222228 c0.2880252121288779,0.1536722340902273 0.6145300994947838,0.23178830664391667 0.9420035828048717,0.23178830664391667 c0.2144119203710846,0 0.42970438250960696,-0.03374428158972686 0.6355750477365456,-0.1013104178303063 l4.239808610212616,-1.3963926733256833 l1.1999142664873792,5.250998080667119 c-1.6085737007552245,0.4780052026572336 -3.0041443479672654,1.3583043003129112 -4.037107895348452,2.506695897219384 L26.914056631604325,22.352874187964737 zM33.83643573631595,26.03433652287337 l-3.3463228787935626,-1.7795260222260527 c0.6936027502106915,-0.7073111713451243 1.5662196417414707,-1.2659147845120728 2.5716222318018573,-1.608399849382519 L33.83643573631595,26.03433652287337 zM35.393673852029565,33.71701735065122 c-3.5888240815459103,0 -6.507820040601948,-2.5724002799929435 -6.507820040601948,-5.733967959236405 c0,-0.7403572953847194 0.17302645730151192,-1.442626217756665 0.4638694030861905,-2.0931539083576975 l3.9220210863443437,2.085784467550746 c0,0.0024823379560258824 -0.0014088668279003515,0.004964675912051766 -0.0014088668279003515,0.0073694408069518436 c0,1.0335058933791499 0.9516895422466863,1.8719931110880172 2.1233384179993147,1.8719931110880172 c1.1730577425805289,0 2.12369063470629,-0.8385647907699928 2.12369063470629,-1.8719931110880172 c0,-0.8128105344762244 -0.591812121894891,-1.4977030911559892 -1.4141500785049768,-1.75625410388831 l-0.9049327743957445,-3.9595617590446555 c0.06656895761829162,-0.0018617534670194117 0.12882326057613835,-0.017531511814432816 0.1954802723711737,-0.017531511814432816 c3.5888240815459103,0 6.508172257308923,2.571779695503937 6.508172257308923,5.7333473747473995 C41.90184610933848,31.144617070658278 38.98249793357546,33.71701735065122 35.393673852029565,33.71701735065122 z",
          color: "#006DF0"
      }
      this.typeIcon['Ride'] = ic;
      ic = {
        viewbox:"0 0 10 10",
          path: "M18.79091539280164,9.354143310977662 l-6.999359533063032,5.0498818469644 c0.6676007758519874,0.18645807232095635 1.2060829380165872,0.4117372979806115 1.6583514206745191,0.6059887350431086 c0.7968203423256821,0.3496088856017931 1.2813937166020375,0.5593742169628688 2.4766747064837147,0.5593742169628688 c1.1952809898816767,0 1.6798543641580321,-0.20976533136107586 2.4766747064837147,-0.5515808522213287 c0.9691467485527109,-0.4195306627221522 2.304449253042993,-1.0022121387251404 4.695011232806347,-1.0022121387251404 s3.7258644842536346,0.5748881112614485 4.695011232806347,1.0022121387251404 c0.7968203423256821,0.3496088856017931 1.2813937166020375,0.5515808522213287 2.4766747064837147,0.5515808522213287 c1.1952809898816767,0 1.6798543641580321,-0.20976533136107586 2.4766747064837147,-0.5515808522213287 c0.25843913294739024,-0.11653629520059801 0.5491831575132029,-0.23307259040119593 0.8722320736974398,-0.35740225034333334 L19.8246719245912,4.692691502953753 C16.475664191623736,2.27645709233836 13.406699487873484,1.5695187915777356 8.022584535731639,1.5850326858763153 v3.884518894958423 c3.919693833964178,-0.015513894298579623 6.213341138872258,0.6059887350431086 8.614604113984216,2.330725904011954 L18.79091539280164,9.354143310977662 z M42.13655008478707,18.902326152685138 c-0.9691467485527109,-0.4273240274636926 -2.304449253042993,-1.0022121387251404 -4.695011232806347,-1.0022121387251404 s-3.7258644842536346,0.5826814760029888 -4.695011232806347,1.0022121387251404 c-0.7968203423256821,0.34181552086025313 -1.2813937166020375,0.5515808522213287 -2.4766747064837147,0.5515808522213287 c-1.1952809898816767,0 -1.6798543641580321,-0.20197196661953642 -2.4766747064837147,-0.5515808522213287 c-0.9691467485527109,-0.4273240274636926 -2.304449253042993,-1.0022121387251404 -4.695011232806347,-1.0022121387251404 s-3.7258644842536346,0.5826814760029888 -4.695011232806347,1.0022121387251404 c-0.7968203423256821,0.34181552086025313 -1.2813937166020375,0.5515808522213287 -2.4766747064837147,0.5515808522213287 c-1.2060829380165872,0 -1.6906563122929426,-0.20976533136107586 -2.487476654618625,-0.5593742169628688 c-0.9691467485527109,-0.4195306627221522 -2.304449253042993,-0.9944187739836003 -4.695011232806347,-0.9944187739836003 s-3.7258644842536346,0.5748881112614485 -4.695011232806347,0.9944187739836003 c-0.8076222904605925,0.3496088856017931 -1.292195664736948,0.5593742169628688 -2.487476654618625,0.5593742169628688 v3.107658817077439 c2.3905619797633535,0 3.7258644842536346,-0.5748881112614485 4.695011232806347,-0.9944187739836003 c0.8076222904605925,-0.3496088856017931 1.2813937166020375,-0.5593742169628688 2.487476654618625,-0.5593742169628688 s1.6906563122929426,0.20976533136107586 2.487476654618625,0.5593742169628688 c0.9691467485527109,0.4195306627221522 2.304449253042993,0.9944187739836003 4.695011232806347,0.9944187739836003 s3.7258644842536346,-0.5748881112614485 4.716514176289861,-1.0022121387251404 c0.7968203423256821,-0.34181552086025313 1.2813937166020375,-0.5515808522213287 2.4766747064837147,-0.5515808522213287 c1.1952809898816767,0 1.6798543641580321,0.20197196661953642 2.4766747064837147,0.5515808522213287 c0.9691467485527109,0.4273240274636926 2.304449253042993,1.0022121387251404 4.695011232806347,1.0022121387251404 c2.3905619797633535,0 3.7258644842536346,-0.5826814760029888 4.695011232806347,-1.0022121387251404 c0.7968203423256821,-0.34181552086025313 1.2813937166020375,-0.5515808522213287 2.4766747064837147,-0.5515808522213287 c1.1952809898816767,0 1.6798543641580321,0.20976533136107586 2.4766747064837147,0.5515808522213287 c0.9691467485527109,0.4273240274636926 2.304449253042993,1.0022121387251404 4.695011232806347,1.0022121387251404 v-3.107658817077439 C43.439547697658924,19.453907004906462 42.95497432338256,19.244141673545386 42.13655008478707,18.902326152685138 z M37.44153885198072,24.89229172599585 c-2.3905619797633535,0 -3.7258644842536346,0.5826814760029888 -4.695011232806347,1.0022121387251404 c-0.7968203423256821,0.34181552086025313 -1.2813937166020375,0.5515808522213287 -2.4766747064837147,0.5515808522213287 c-1.1952809898816767,0 -1.6798543641580321,-0.20197196661953642 -2.4766747064837147,-0.5515808522213287 c-0.9691467485527109,-0.4273240274636926 -2.304449253042993,-1.0022121387251404 -4.695011232806347,-1.0022121387251404 s-3.7258644842536346,0.5826814760029888 -4.695011232806347,1.0022121387251404 c-0.7968203423256821,0.34181552086025313 -1.2813937166020375,0.5515808522213287 -2.4766747064837147,0.5515808522213287 c-1.2060829380165872,0 -1.6906563122929426,-0.20976533136107586 -2.487476654618625,-0.5593742169628688 c-0.9691467485527109,-0.4195306627221522 -2.304449253042993,-0.9944187739836003 -4.695011232806347,-0.9944187739836003 s-3.7258644842536346,0.5748881112614485 -4.695011232806347,0.9944187739836003 c-0.8076222904605925,0.3496088856017931 -1.292195664736948,0.5593742169628688 -2.487476654618625,0.5593742169628688 v3.107658817077439 c2.3905619797633535,0 3.7258644842536346,-0.5748881112614485 4.695011232806347,-0.9944187739836003 c0.8076222904605925,-0.3496088856017931 1.2813937166020375,-0.5593742169628688 2.487476654618625,-0.5593742169628688 s1.6906563122929426,0.20976533136107586 2.487476654618625,0.5593742169628688 c0.9691467485527109,0.4195306627221522 2.304449253042993,0.9944187739836003 4.695011232806347,0.9944187739836003 s3.7258644842536346,-0.5748881112614485 4.716514176289861,-1.0022121387251404 c0.7968203423256821,-0.34181552086025313 1.2813937166020375,-0.5515808522213287 2.4766747064837147,-0.5515808522213287 c1.1952809898816767,0 1.6798543641580321,0.20197196661953642 2.4766747064837147,0.5515808522213287 c0.9691467485527109,0.4273240274636926 2.304449253042993,1.0022121387251404 4.695011232806347,1.0022121387251404 c2.3905619797633535,0 3.7258644842536346,-0.5826814760029888 4.695011232806347,-1.0022121387251404 c0.7968203423256821,-0.34181552086025313 1.2813937166020375,-0.5515808522213287 2.4766747064837147,-0.5515808522213287 c1.1952809898816767,0 1.6798543641580321,0.20976533136107586 2.4766747064837147,0.5515808522213287 c0.9691467485527109,0.4273240274636926 2.304449253042993,1.0022121387251404 4.695011232806347,1.0022121387251404 v-3.107658817077439 c-1.1952809898816767,0 -1.6798543641580321,-0.20976533136107586 -2.498278602753535,-0.5515808522213287 C41.16740333623435,25.467179837257298 39.83210083174407,24.89229172599585 37.44153885198072,24.89229172599585 z M 30.19, 4.84 m -3.82, 0 a 3.82,3.82 0 1,0 7.64,0 a 3.82,3.82 0 1,0 -7.64,0",
          color: "#91DC5A"
      }
      this.typeIcon['Swimm'] = ic;
 
      if ( this.w1.act.type == "" ) {
        this.w1.act.type = 'Run';
      }

      this.done = 1;
      this.w1.loaded = true;
      clearInterval(this.progressTimer);

      this.displayTrends();

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
    this.winLap.x = 50;
    this.winLap.y = 130;
    this.winLap.px = 0;
    this.winLap.py = 0;
    this.winLap.width = 310;
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
    /* event.setZoom(event.zoom - 2); */
    event.fitBounds(bounds);
    console.log('this.lng=', this.lng);
    event.panBy(-(this.winLap.width/2), this.winTrends.height / 1.6)
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
                title: { text: 'Speed<br>' },
                flip: false,
                labels: { horizontalAlignment: 'right' },
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
                title: { text: 'HeartRate<br>' },
                flip: false,
                labels: { horizontalAlignment: 'right' },
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
                title: { text: 'Altitude<br>' },
                flip: false,
                position: 'right',
                labels: { horizontalAlignment: 'right' },
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
    this.myChart.refresh();
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
    this.myChart.refresh();
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
    this.showSettings = !this.showSettings;
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
  id: number;

  constructor(private father: AppComponent, id: number) {
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

