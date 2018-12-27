    import { Injectable } from '@angular/core';
    import {Workout, Lap} from './app.component';
    import { Subject } from 'rxjs';
      
    @Injectable({
      // we declare that this service should be created
      // by the root application injector.
     
      providedIn: 'root',
    })
    export class WorkoutService {

      public lapsSource = new Subject<Lap[]>();
      public selectTable:number;
      workout$ = this.lapsSource.asObservable();

      pushWorkout(laps: Lap[], selectTable:number) {
        const rows = [];
        this.selectTable = selectTable;
        laps.forEach(element => {rows.push(element, { detailRow: true, element })});
        this.lapsSource.next(rows);
      }
      
    }