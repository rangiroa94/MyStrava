import { Component, Input } from '@angular/core';
import { DataSource } from '@angular/cdk/collections';
import { Observable, of } from 'rxjs';
import { animate, state, style, transition, trigger } from '@angular/animations';
import {Workout, Lap} from '../app.component';

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
export class TableComponent {
  @Input() wkt: Workout;

  nameTab: String = 'Laps';
  displayedColumns = ['lap_index', 'lap_distance', 'lap_time'];
  dataSource = new lapDataSource(this.workout);
  constructor(private workout: Workout) { 
    this.workout = this.wkt;
    console.log('TableComponent',this.wkt);
  }

  isExpansionDetailRow = (i: number, row: Object) => row.hasOwnProperty('detailRow');
  expandedElement: any;
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
  }
  connect(): Observable<Lap[]> {
    const rows = [];
    this.workout.lap.forEach(element => rows.push(element, { detailRow: true, element }));
    console.log(rows);
    return of(rows);
  }

  disconnect() { }
}