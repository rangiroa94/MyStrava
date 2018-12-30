import { Component, EventEmitter, OnChanges, SimpleChanges, Input, Output, 
  OnInit, ChangeDetectorRef, AfterContentInit  } from '@angular/core';
import { DataSource } from '@angular/cdk/collections';
import { Observable, of } from 'rxjs';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatTabChangeEvent } from '@angular/material';
import { DatePipe } from '@angular/common';
import { WorkoutService, Workout, Lap, lapSelection } from '../workout.service';

@Component({
  selector: 'app-table',
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.css'],
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({ height: '0px', minHeight: '0', visibility: 'hidden' })),
      state('expanded', style({ height: '*', visibility: 'visible' })),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ],
})
export class TableComponent implements OnInit, OnChanges, AfterContentInit  {
  @Input() wkt: Workout;
  @Output() lapSelected: EventEmitter<lapSelection>  = new EventEmitter<lapSelection>();
  @Output() lapInfos: EventEmitter<infos>  = new EventEmitter<infos>();
  @Output() initTable: EventEmitter<number>  = new EventEmitter<number>();
  nameTab: String = 'Laps';
  displayedColumns = ['lap_index', 'lap_distance', 'lap_time'];
  dataSource: lapDataSource;
  public currentExpandedRow: any;
  public expandRow: boolean = false;
  preventSingleClick = false;
  hooverOn: number = 0;
  timer: any;
  timer2: any;
  delay: Number;
  selectedRows: boolean[][];
  currentTable: number = 0;
  nbLaps:number = 0;
  initOK: boolean = false;
  sumDist: number=0;
  infosLap: infos[] = new Array<infos>();
  srv: WorkoutService;

  constructor( private changeDetectorRefs: ChangeDetectorRef, 
                private wktService: WorkoutService ) { 
    console.log('TableComponent');
    this.srv = wktService;
  }

  ngOnInit() {
    console.log('wkt.lap=',this.wkt.lap);
    this.srv.workout$.subscribe(
      w => {
        console.log('Subscribe, reception wkr:', w);
        // Restore current selected laps on map

        console.log('Rows.length=',this.srv.nbLaps);
        let lapSelect: lapSelection;
        for (let i=0; i < this.srv.nbLaps ; i++) {
          if (this.selectedRows[this.srv.selectTable][i]) {
            console.log('Restore color for lap: ',(i+1));
            lapSelect = { lap_idx: i+1, isCurrent: false};
            this.lapSelected.emit(lapSelect);
          }
          this.lapInfos.emit(this.infosLap[this.srv.selectTable]);
        }

        this.currentTable = this.srv.selectTable;
        this.nbLaps = this.srv.nbLaps;
        this.initOK = true;
      });
    // this.srv.lapsSource.next(this.wkt.lap);
    this.dataSource = new lapDataSource(this.wkt, this.srv);
    this.selectedRows = [];
    for (let i=0;i<3;i++) {
      this.selectedRows[i] = [];
      for(let j:number = 0;j<50;j++) {
        this.selectedRows[i][j] = false;
      }
      this.infosLap[i] = new infos();
      this.infosLap[i].nbValues = 0;
    }
    this.timer = setTimeout(() => {
      this.initTable.emit(1);
    }, 2000);
  }

  ngAfterContentInit() {
    console.log ('>>> ngAfterContentInit');
  }

  ngOnChanges(changes: SimpleChanges) {
    console.log ('>>> ngOnChanges');
    /*
    for (let propName in changes) {  
      let change = changes[propName];
      let curVal  = JSON.stringify(change.currentValue);
      let prevVal = JSON.stringify(change.previousValue);
      console.log('curVal=',curVal);
      console.log('prevVal=',prevVal);
      // this.srv.pushWorkout(curVal['laps']);
    }
    */

  }

  tabContentChanged () {
    console.log ('>>> tabContentChanged');
  }

  isExpansionDetailRow = (i: number, row: Object) => row.hasOwnProperty('detailRow');
  expandedElement: any;
  expansionDetailRowCollection = new Array<any>();

  toggleRow(row: Lap) {
    console.log('toggleRow, row=',row.lap_index, 'selectTable=',this.srv.selectTable);
    this.preventSingleClick = false;
    const delay = 200;
    let sign:number;
    let lapSelect: lapSelection;
    this.infosLap[this.currentTable].total_dist = 0;
    this.infosLap[this.currentTable].nbValues = 0;
    this.timer = setTimeout(() => {
        if (!this.preventSingleClick) {
            this.selectedRows[this.srv.selectTable][row.lap_index-1] = !this.selectedRows[this.srv.selectTable][row.lap_index-1];
            if (this.selectedRows[this.srv.selectTable][row.lap_index-1]) {
              sign = 1;
            } else {
              sign = -1;
            }
            lapSelect = { lap_idx: row.lap_index*sign, isCurrent: false};
            this.lapSelected.emit(lapSelect);
            let sumTime: number=0;
            let averageTime: number=0;
            let averageSpeed: number=0;
            let averageDist: number=0;
            let averageHR: number=0;
            for (let i:number=0;i<this.wkt.lap.length;i++) {
              if (this.selectedRows[this.srv.selectTable][i]) {
                this.infosLap[this.currentTable].nbValues++;
                let t = new Date('1970-01-01T' + this.wkt.lap[i].lap_time + 'Z');
                sumTime += t.getTime()/1000;
                averageTime = sumTime/this.infosLap[this.currentTable].nbValues;
                this.infosLap[this.currentTable].total_dist += this.wkt.lap[i].lap_distance;
                averageDist = this.infosLap[this.currentTable].total_dist / this.infosLap[this.currentTable].nbValues;
                averageSpeed = 1000*sumTime / this.infosLap[this.currentTable].total_dist;
                averageHR += this.wkt.lap[i].lap_average_HR / this.wkt.lap.length;
                //console.log('sumTime=',sumTime,'total_dist=',this.infosLap[this.currentTable].total_dist,
                //  'averageSpeed=',averageSpeed);
              }
            }
            averageSpeed = Math.trunc(averageSpeed*100)/100;
            averageHR = Math.round(averageHR);

            this.infosLap[this.currentTable].total_dist = Math.round (this.infosLap[this.currentTable].total_dist) /1000;
            console.log('toggleRow, row selected=',row.lap_index, 'sumTime=', sumTime);
            let hh:number = Math.trunc(sumTime/3600);
            let mm:number = Math.trunc(sumTime/60)-hh*60;
            let ss:number = sumTime-hh*3600-mm*60;
            let totaltime:string;
            totaltime = String(hh).padStart(2, '0') + ':' +
              String(mm).padStart(2, '0') +':' + String(ss).padStart(2, '0');
            console.log('toggleRow, row selected=',row.lap_index, 'totaltime=', totaltime);

            hh = Math.trunc(averageTime/3600);
            mm = Math.trunc(averageTime/60)-hh*60;
            ss = averageTime-hh*3600-mm*60;
            ss = Math.round(ss*10)/10;
            this.infosLap[this.currentTable].average_time = String(hh).padStart(2, '0') + ':' +
              String(mm).padStart(2, '0') +':' + String(ss).padStart(2, '0');

            hh = Math.trunc(averageSpeed/3600);
            mm = Math.trunc(averageSpeed/60)-hh*60;
            ss = averageSpeed-hh*3600-mm*60;
            ss = Math.round(ss*10)/10;
            this.infosLap[this.currentTable].average_speed = String(hh).padStart(2, '0') + ':' +
              String(mm).padStart(2, '0') +':' + String(ss).padStart(2, '0');

            this.infosLap[this.currentTable].total_time = totaltime;
            this.infosLap[this.currentTable].average_HR = averageHR;
            this.lapInfos.emit(this.infosLap[this.currentTable]);
            // console.log('toggleRow, selectedRows=',this.selectedRows);
        }
      }, delay);
  }

  dbleClickRow (row: Lap) {
    this.preventSingleClick = true;
    clearTimeout(this.timer);
    this.expandRow = this.expansionDetailRowCollection.includes(row);  
    if(this.expandRow != true) {
      const index = this.expansionDetailRowCollection.indexOf(this.expandedElement, 0);
      if (index>-1) {
        this.expansionDetailRowCollection.splice(index, 1);
      }   
      this.expansionDetailRowCollection.push(row);
      this.expandedElement = row;
      
    } else {
      let test = this.expansionDetailRowCollection[0].name;
      const index = this.expansionDetailRowCollection.indexOf(row, 0);
      if (index>-1) {
        this.expansionDetailRowCollection.splice(index, 1);
      }   
    }
    console.log('dbleClickRow, expansionCollection=',this.expansionDetailRowCollection);
  }

  mouseEnterRow(row: Lap) {
    let lapSelect: lapSelection;
    lapSelect = { lap_idx: row.lap_index, isCurrent: true};
    this.lapSelected.emit(lapSelect);
   } 

  mouseLeaveRow(row: Lap) {
    let lapSelect: lapSelection;
    if ( !this.selectedRows[this.srv.selectTable][row.lap_index-1] ) {
      lapSelect = { lap_idx: row.lap_index*-1, isCurrent: false};
    } else {
      lapSelect = { lap_idx: row.lap_index, isCurrent: false};
    }
    this.lapSelected.emit(lapSelect);
  }

  refresh () {
     // this.changeDetectorRefs.detectChanges();
  }

  onLinkClick(event: MatTabChangeEvent) {
     console.log('tab => ', event.tab);
     this.refresh();
    // this.router.navigate(['contacts']); 
  }

}


/**
 * Data source to provide what data should be rendered in the table. The observable provided
 * in connect should emit exactly the data that should be rendered by the table. If the data is
 * altered, the observable should emit that new set of data on the stream. In our case here,
 * we return a stream that contains only one set of data that doesn't change.
 */
export class lapDataSource extends DataSource<Lap> {
  /** Connect function called by the table to retrieve one stream containing the data to render. */
  srv: WorkoutService;
  constructor(private workout: Workout, srv: WorkoutService) {
    super();
    this.srv = srv;
    console.log('lapDataSource constructor');
  }
  connect(): Observable<Lap[]> {
    return this.srv.lapsSource;
  }

  disconnect() { }
}

export class infos {
  total_dist: number;
  total_time: string;
  average_time: string;
  average_speed: string;
  average_HR: number;
  nbValues: number;
}

