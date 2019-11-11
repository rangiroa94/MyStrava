import { Component, ElementRef, HostListener, ViewChild, OnInit, AfterViewInit, 
  OnChanges, SimpleChanges, ChangeDetectorRef, Input, Output, 
  Inject, EventEmitter } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Event as NavigationEvent } from "@angular/router";
import { NavigationStart } from "@angular/router";
import { Router, ActivatedRoute } from "@angular/router";
import { Observable, of } from 'rxjs';
import { map, filter } from 'rxjs/operators';

import { WorkoutService, Gps, Heartrate, ActivityItem, listAct, Lap, Workout, 
  lapSelection, Split, infos, Login } from './workout.service';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})

export class AppComponent implements AfterViewInit {

  title = 'MyStrava';
  /* url : string = 'http://fakarava94.no-ip.org:3000/workout/'; */

  devMode: boolean = true;
  initDone: boolean = false;
  username: string = "YYYYY";
  firstname: string = "XXXXX";
  login: Login;
  // listAct: Array<ActivityItem> = new Array<ActivityItem>();  
  list_Activities: listAct;
  urlbase: string = '/strava2/';
  urlworkout: string = 'workoutDetail/';
  urlprogress: string = 'getProgress/';
  wid: string;
  initOK: boolean=false;
  phase: number=0;

  srv: WorkoutService;

  constructor(private http: HttpClient, private eltRef: ElementRef, 
    private router: Router,
    public route: ActivatedRoute,
    private wktService: WorkoutService) {

    this.route = route;
    router.events
            .pipe(
                  filter(
                    ( event: NavigationEvent ) => {
                         return( event instanceof NavigationStart );
                     }
                )
            )
            .subscribe(
                ( event: NavigationStart ) => {
 
                    console.group( "NavigationStart Event" );
                    console.log( "navigation id:", event.id );
                    console.log( "route:", event.url );
                    console.log( "trigger:", event.navigationTrigger );
                    if ( event.restoredState ) {
                        console.warn(
                            "restoring navigation id:",
                            event.restoredState.navigationId
                        );
                    }
                    console.groupEnd();
                    if (event.id > 2) this.phase = 1;

                }
            )
        ;

    let lastname: string  ;
    lastname = localStorage.getItem('lastName');
    if (lastname) {
      this.username = lastname;
      this.firstname = localStorage.getItem('firstName');
      this.devMode = false;
      console.log('username=', this.username);
      localStorage.removeItem('lastName');
      localStorage.removeItem('firstName');
      this.login = { firstname: this.firstname, lastname: this.username};
    } else {
      this.login = { firstname: 'Francois', lastname: 'libespere'};
    }

    this.list_Activities = new listAct();
    this.list_Activities.initDone = false;
    this.list_Activities.list = [];
    this.initOK = true;
    this.srv = wktService;
    
    // this.router.navigate (['/list',{ devmode: this.devMode, url: '/' }]);

  }

  ngAfterViewInit() {
    console.log("AppComponent ngAfterViewInit");
  }

  onInitPhase (phase: number) {
    console.log ('>>>>>> AppComponent, receive phase=', phase);
    this.phase = phase;
  }

  onActivities (listAct: any) {
    console.log ('>>>>>> AppComponent, onActivities=', listAct);
    console.log ('>>>>>> AppComponent, onActivities, initDone=', listAct.initDone);
    this.list_Activities.list = Object.assign([], listAct.list);
    this.list_Activities.initDone = listAct.initDone;
    this.initDone = listAct.initDone;
  }

}


