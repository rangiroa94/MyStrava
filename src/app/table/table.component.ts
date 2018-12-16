import { Component, EventEmitter, Input, Output, OnInit, ChangeDetectorRef  } from '@angular/core';
import { DataSource } from '@angular/cdk/collections';
import { Observable, of } from 'rxjs';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { Workout, Lap} from '../app.component';
import { MatTabChangeEvent } from '@angular/material';
import { DatePipe } from '@angular/common';

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
export class TableComponent implements OnInit {
  @Input() wkt: Workout;
  @Output() lapSelected: EventEmitter<number>  = new EventEmitter<number>();
  @Output() lapInfos: EventEmitter<infos>  = new EventEmitter<infos>();
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
  selectedRows = new Array<boolean>();
  sumDist: number=0;
  infosLap: infos = new infos();

  constructor( private changeDetectorRefs: ChangeDetectorRef ) { 
    console.log('TableComponent');
  }
  ngOnInit() {
    console.log('wkt=',this.wkt);
    this.dataSource = new lapDataSource(this.wkt);
    for(let j:number = 0;j<this.wkt.lap.length;j++) {
      this.selectedRows[j] = false;
    }
  }

  isExpansionDetailRow = (i: number, row: Object) => row.hasOwnProperty('detailRow');
  expandedElement: any;
  expansionDetailRowCollection = new Array<any>();

  toggleRow(row: Lap) {
    console.log('toggleRow, row=',row.lap_index);
    this.preventSingleClick = false;
    const delay = 200;
    let sign:number;
    this.infosLap.total_dist = 0;
    this.infosLap.nbValues = 0;
    this.timer = setTimeout(() => {
        if (!this.preventSingleClick) {
            this.selectedRows[row.lap_index-1] = !this.selectedRows[row.lap_index-1];
            if (this.selectedRows[row.lap_index-1]) {
              sign = 1;
            } else {
              sign = -1;
            }
            this.lapSelected.emit(row.lap_index*sign);
            let sumTime: number=0;
            let averageTime: number=0;
            let averageSpeed: number=0;
            let averageDist: number=0;
            for (let i:number=0;i<this.wkt.lap.length;i++) {
              if (this.selectedRows[i]) {
                this.infosLap.nbValues++;
                let t = new Date('1970-01-01T' + this.wkt.lap[i].lap_time + 'Z');
                sumTime += t.getTime()/1000;
                averageTime = sumTime/this.infosLap.nbValues;
                this.infosLap.total_dist += this.wkt.lap[i].lap_distance;
                averageDist = this.infosLap.total_dist / this.infosLap.nbValues;
                averageSpeed = 1000*sumTime / this.infosLap.total_dist;
              }
            }
            this.infosLap.total_dist = Math.round (this.infosLap.total_dist) /1000;
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
            this.infosLap.average_time = String(hh).padStart(2, '0') + ':' +
              String(mm).padStart(2, '0') +':' + String(ss).padStart(2, '0');

            hh = Math.trunc(averageSpeed/3600);
            mm = Math.trunc(averageSpeed/60)-hh*60;
            ss = averageSpeed-hh*3600-mm*60;
            ss = Math.round(ss*10)/10;
            this.infosLap.average_speed = String(hh).padStart(2, '0') + ':' +
              String(mm).padStart(2, '0') +':' + String(ss).padStart(2, '0');

            this.infosLap.total_time = totaltime;
            this.lapInfos.emit(this.infosLap);
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
    this.lapSelected.emit(row.lap_index);
   } 

  mouseLeaveRow(row: Lap) {
    if ( !this.selectedRows[row.lap_index-1] ) {
      this.lapSelected.emit(row.lap_index*-1);
    }
  }

  refresh () {
    this.changeDetectorRefs.detectChanges();
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
  constructor(private workout: Workout) {
    super();
    console.log('lapDataSource constructor');
  }
  connect(): Observable<Lap[]> {
    const rows = [];
    this.workout.lap.forEach(element => {rows.push(element, { detailRow: true, element })});
    console.log('lapDataSource, rows=: ',rows);
    return of(rows);
  }

  disconnect() { }
}

export class infos {
  total_dist: number;
  total_time: string;
  average_time: string;
  average_speed: string;
  nbValues: number;
}
