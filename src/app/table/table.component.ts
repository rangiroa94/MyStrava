import { Component, EventEmitter, Input, Output, OnInit, ChangeDetectorRef  } from '@angular/core';
import { DataSource } from '@angular/cdk/collections';
import { Observable, of } from 'rxjs';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { Workout, Lap} from '../app.component';
import { MatTabChangeEvent } from '@angular/material';

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
  nameTab: String = 'Laps';
  displayedColumns = ['lap_index', 'lap_distance', 'lap_time'];
  dataSource: lapDataSource;
  public currentExpandedRow: any;
  public expandRow: boolean = false;
  constructor( private changeDetectorRefs: ChangeDetectorRef ) { 
    console.log('TableComponent');
  }
  ngOnInit() {
    console.log('wkt=',this.wkt);
    this.dataSource = new lapDataSource(this.wkt);
  }

  isExpansionDetailRow = (i: number, row: Object) => row.hasOwnProperty('detailRow');
  expandedElement: any;
  expansionDetailRowCollection = new Array<any>();

  toggleRow(row: Lap) {
    console.log('toggleRow, row=',row.lap_index);
    this.expandRow = this.expansionDetailRowCollection.includes(row);  
    if(this.expandRow !== true) {
      this.expansionDetailRowCollection.push(row);
      this.lapSelected.emit(row.lap_index);
    } else {
      // let index = this.explansionDetialRowCollection.findIndex(idRow => idRow.name === row.element.name);
      let test = this.expansionDetailRowCollection[0].name;
      // this.expansionDetailRowCollection.forEach( (item, index) => {
      //  if(item.index === (row.lap_index-1)) this.expansionDetailRowCollection.splice(index, 1);
      // });
      const index = this.expansionDetailRowCollection.indexOf(row, 0);
      if (index>-1) {
        this.expansionDetailRowCollection.splice(index, 1);
        this.lapSelected.emit(row.lap_index*-1);
      }   
    }
    console.log('toggleRow, expansionCollection=',this.expansionDetailRowCollection);
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

