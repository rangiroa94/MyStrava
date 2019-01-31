import { Component, EventEmitter, OnChanges, SimpleChanges, Input, Output, 
  OnInit, ChangeDetectorRef, AfterContentInit  } from '@angular/core';
import { DataSource } from '@angular/cdk/collections';
import { Observable, of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute } from "@angular/router";
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatTabChangeEvent } from '@angular/material';
import { DatePipe } from '@angular/common';
import { WorkoutService, Workout, Lap, lapSelection, infos, ActivityItem } from '../workout.service';
import {CdkDragDrop} from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-list',
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.css'],
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({ height: '0px', minHeight: '0', visibility: 'hidden' })),
      state('expanded', style({ height: '*', visibility: 'visible' })),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ],
})
export class ListComponent implements OnInit, OnChanges  {

  @Input() mode: boolean;
  @Input() phase: number;
  @Output() initPhase: EventEmitter<number>  = new EventEmitter<number>();

  devMode : boolean;
  srv: WorkoutService;
  url: string;
  urlList: string;
  listActivities: Array<ActivityItem> = new Array<ActivityItem>();  
  listActMockup: Array<ActivityItem> = new Array<ActivityItem>(); 
  listTmpAct: any = {
    activities: []
  };
  username: string = "YYYYY";
  firstname: string = "XXXXX";
  progressTimer: any;
  initDone: boolean = false;
  nbAct : number = 0;
  currentAct: number = 0;
  progressValue: number= 0;

  constructor(  private http: HttpClient,
                private changeDetectorRefs: ChangeDetectorRef, 
                private router: Router,
                private route: ActivatedRoute,
                private wktService: WorkoutService ) { 
    console.log('ListComponent');

    this.srv = wktService;
    this.router = router;

  }

  ngOnInit() {
    this.urlList = "NULL";
    this.route.paramMap.subscribe(params => {
        console.log ('listComponent ngOnInit params=',params);
        this.urlList = params.get('url');
        this.devMode = (params.get('devmode')=='true');
    });

    console.log ('mode=',this.mode);
    console.log ('phase=',this.phase);
    this.getdata();

    console.log ('this.urlList=',this.urlList);
    this.progressTimer = setInterval(() => {
        this.getdata();
    }, 1000);
 

  }

  ngOnChanges(changes: SimpleChanges) {
    console.log ('>>> ngOnChanges');
   }

  getdata () {

    console.log ('Get list activities (devMode=',this.devMode,') ...');
            
    if (!this.mode) {
      this.url = '/strava2/getActivities';
      this.listActMockup = [];
      this.listTmpAct = [];
      this.http.get(this.url).subscribe((act: any) => {
          console.log ('Receive activities =', act);
          /*
          for (let i=0; i<act['activities'].length;i++) {
            let a = new ActivityItem();
            a.label = act['activities'][i].label;
            a.strTime = act['activities'][i].strTime;
            a.wid = act['activities'][i].wid;
            a.distance = act['activities'][i].distance;
            a.type = act['activities'][i].type;
            this.listActivities.push(a);
          }
          */
          this.listActivities = Object.assign([], act['activities']);
          this.progressValue = 100*(this.currentAct/this.nbAct);
          this.currentAct = act.currentAct;
          this.nbAct = act.nbAct;
         
          if (this.currentAct >= this.nbAct) {
            clearInterval(this.progressTimer);
            this.initDone = true;
        }
      });
    } else {

        this.url = 'assets/listAct.json';
        this.http.get(this.url).subscribe((act: any) => {
          console.log ('Receive activities =', act);
          this.listActMockup = [];
          this.listTmpAct = [];
          this.listActivities =[];
          this.nbAct = act.nbAct;
          console.log ('nbAct =', this.nbAct);
          if (this.phase == 0) {
            for (let i=0; i<act['activities'].length;i++) {
              if (i < this.currentAct+1) {
                let a = new ActivityItem();
                a.label = act['activities'][i].label;
                a.strTime = act['activities'][i].strTime;
                a.wid = act['activities'][i].wid;
                a.distance = act['activities'][i].distance;
                a.type = act['activities'][i].type;
                this.listActivities.push(a);
                this.progressValue = 100*(this.currentAct/this.nbAct);
              }
            }
          } else {
            act['activities'].forEach(item => {
                let a = new ActivityItem();
                a = {
                  devMode: this.mode,
                  label: item.label,
                  strTime: item.strTime,
                  wid: item.wid,
                  distance: item.distance,
                  type: item.type
                };
                this.listActivities.push(a);
              });
            this.nbAct = act['activities'].length;
            this.currentAct = this.nbAct;
          }
          this.currentAct+=1;
          if (this.currentAct >= this.nbAct) {
            clearInterval(this.progressTimer);
            this.initDone = true;
          }
        });
        
        // console.log('listTmpAct=',this.listTmpAct);

    }

    // console.log ('>>> this.listTmpAct= ', this.listTmpAct);
    // console.log ('>>> this.listTmpAct length=', this.listTmpAct['activities'].length);

    if (typeof this.listTmpAct['activities'] !== "undefined") {
      console.log ('this.listTmpAct is defined, lg = ',this.listTmpAct['activities'].length);
      
    }
  }

  onClickItem(item: ActivityItem) {
    console.log('item selected=',item);
    item.devMode = this.mode;
    this.router.navigate (['/workout',{ id: item.wid, devMode: this.mode }]);
  }
 

}



