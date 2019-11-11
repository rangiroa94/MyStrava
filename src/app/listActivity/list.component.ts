import { Component, EventEmitter, OnChanges, SimpleChanges, Input, Output, 
  OnInit, ChangeDetectorRef, AfterContentInit  } from '@angular/core';
import { DataSource } from '@angular/cdk/collections';
import { Observable, of } from 'rxjs';
import { forkJoin } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute } from "@angular/router";
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatTabChangeEvent } from '@angular/material';
import { DatePipe } from '@angular/common';
import { WorkoutService, Workout, Lap, lapSelection, infos, ActivityItem, listAct } from '../workout.service';
import {CdkDragDrop} from '@angular/cdk/drag-drop';
import { UploadEvent, UploadFile, FileSystemFileEntry, 
  FileSystemDirectoryEntry } from 'ngx-file-drop';
import {TooltipPosition} from '@angular/material';
import { UploadService } from '../upload.service'; 
import { WebsocketService } from '../websocket.service';
import { StreamService } from "../stream.service";
import { FindValueOperator } from 'rxjs/internal/operators/find';

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
  @Input() lastname: string;
  @Input() firstname: string; 
  @Input() initDone: boolean;
  // @Input() listActivities: listAct;
  @Output() initPhase: EventEmitter<number>  = new EventEmitter<number>();
  @Output() activities: EventEmitter<any>  = new EventEmitter<any>();

  devMode : boolean;
  srv: WorkoutService;
  uploadSrv: UploadService;
  url: string;
  urlList: string;
  isMobile: boolean;
  listActivities: listAct;

  username: string = "YYYYY";
  
  progressTimer: any;
  nbAct : number = 0;
  currentAct: number = 0;
  progressValue: number= 0;
  file: File;
  files: UploadFile[] = [];
  fileToUpload: File[];
  nbFiles: number =0;
  progress;
  uploading = false;
  uploadSuccessful = false;

  constructor(  private http: HttpClient,
                private changeDetectorRefs: ChangeDetectorRef, 
                private router: Router,
                private route: ActivatedRoute,
                private wktService: WorkoutService,
                private upSrv : UploadService,
                private streamSrv : StreamService ) { 
    console.log('ListComponent, user=', this.firstname, this.lastname);

    this.srv = wktService;
    this.uploadSrv = upSrv;
    this.listActivities = wktService.listActivities;
    this.router = router;
    this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (this.isMobile) {
      console.log('Mobile detected !!');
    } 

    if (!this.mode) {
       streamSrv.messages.subscribe(msg => {
        console.log("Response from websocket: auth= ",msg.lastname," message=",msg.message);
        switch(msg.type) { 
            case 'accept': { 
              let message = {
                type: 'Authentication',
                firstname: this.firstname,
                lastname: this.lastname,
                message: ""
              };
              streamSrv.firstname = this.firstname;
              streamSrv.lastname = this.lastname;
              streamSrv.messages.next(message);
              break; 
            }
            case 'actList': { 
              this.srv.updateList(msg.message['activities'], this.mode);
              this.progressValue = 100*(this.currentAct/this.nbAct);
              this.currentAct = msg.message['currentAct'];
              this.nbAct = msg.message['nbAct'];
              if (this.currentAct >= this.nbAct) {
                  this.initDone = true;
              }
              this.listActivities.initDone = this.initDone;
              break; 
            }
          }
 
      });
    }
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
    console.log ('ngOnInit, listAct=',this.listActivities);
    if (this.mode) { 
        this.getdata();
        this.progressTimer = setInterval(() => {
          this.getdata();
      }, 2000);
    }
    console.log ('this.urlList=',this.urlList);

  }

  ngOnChanges(changes: SimpleChanges) {
    console.log ('>>> ngOnChanges');
   }

  getdata () {

    console.log ('Get list activities (devMode=',this.devMode,') ...');
            
    if (!this.mode) {
      this.url = '/strava2/getActivities';
      this.http.get(this.url).subscribe((act: any) => {
          console.log ('Receive activities =', act);
          this.listActivities.list = Object.assign([], act['activities']);
          this.progressValue = 100*(this.currentAct/this.nbAct);
          this.currentAct = act.currentAct;
          this.nbAct = act.nbAct;
         
          if (this.currentAct >= this.nbAct) {
            clearInterval(this.progressTimer);
            this.initDone = true;
          }
          this.listActivities.initDone = this.initDone ;
          console.log ('>>> this.activities.emit');
          // this.activities.emit (this.listActivities);
      });
    } else {

        this.url = 'assets/listAct.json';
        this.http.get(this.url).subscribe((act: any) => {
          console.log ('Receive activities, phase=', this.phase );
          // this.listActivities.list = [];
          let tmpList: Array<ActivityItem> = [];
          this.isMobile = act.isMobile;
          this.nbAct = act.nbAct;
          console.log ('nbAct =', this.nbAct);
          if (this.phase == 0) {
            for (let i=0; i<act['activities'].length;i++) {
              if (i < this.currentAct+1) {
                console.log ('act i=',act['activities'][i]);
                tmpList.push( Object.assign({}, act['activities'][i]) );
                console.log ('tmpList=',tmpList);
                this.srv.updateList(tmpList, this.mode);
                this.progressValue = 100*(this.currentAct/this.nbAct);
              }
            }
          } else {
            this.srv.updateList(act['activities'], this.mode);
            this.nbAct = act['activities'].length;
            this.currentAct = this.nbAct;
          }
          this.currentAct+=1;
          if (this.currentAct >= this.nbAct) {
            clearInterval(this.progressTimer);
            this.initDone = true;
          }
          this.listActivities.initDone = this.initDone ;
          console.log ('>>> this.activities.emit: ', this.listActivities);
          // this.activities.emit (this.listActivities);
        });
              
    }

  }

  onClickItem(item: ActivityItem) {
    console.log('item selected=',item);
    item.devMode = this.mode;
    if (item.progress==100) {
      this.router.navigate (['/workout',{ id: item.wid, devMode: this.mode, isMobile: this.isMobile }]);
    }
  }

  dropped(event: UploadEvent) {
    this.files = event.files;
    this.fileToUpload = new Array<File>();
    for (const droppedFile of event.files) {
 
      // Is it a file?
      if (droppedFile.fileEntry.isFile) {
        
        const fileEntry = droppedFile.fileEntry as FileSystemFileEntry;
        fileEntry.file((file: File) => {
 
          // Here you can access the real file
          console.log('droppedFile=',droppedFile.relativePath);
          console.log('file=', file);

          this.fileToUpload.push(file);
          this.nbFiles+=1;
          
          this.file = file;
          let fileReader = new FileReader();

          /*
          let easyFit = new EasyFit({
            force: true,
            speedUnit: 'km/h',
            lengthUnit: 'km',
            temperatureUnit: 'celsius',
            elapsedRecordField: true,
            mode: 'cascade',
          });1
          */

          fileReader.onload = (e) => {
            /*
            easyFit.parse(fileReader.result, function (error, data) {
  
              // Handle result of parse method
              if (error) {
                console.log(error);
              } else {
                console.log('Fit content: ',JSON.stringify(data));
              }
              
            });
            */
          }

          fileReader.readAsText(this.file);
          
          /**
          // You could upload it like this:
          const formData = new FormData()
          formData.append('logo', file, relativePath)
 
          // Headers
          const headers = new HttpHeaders({
            'security-token': 'mytoken'
          })
 
          this.http.post('https://mybackend.com/api/upload/sanitize-and-save-logo', formData, { headers: headers, responseType: 'blob' })
          .subscribe(data => {
            // Sanitized logo returned from backend
          })
          **/
 
        });
      } else {
        // It was a directory (empty directories are added, otherwise only files)
        const fileEntry = droppedFile.fileEntry as FileSystemDirectoryEntry;
        console.log(droppedFile.relativePath, fileEntry);
      }
    }
  }
 
  fileOver(evt: Event){
    console.log('fileOver:', evt);
  }
 
  fileLeave(evt: Event){
    console.log('fileLeave:', evt);
  }

  onClickImport () {

    console.log('clicked Import button');
  
    // set the component state to "uploading"
    this.uploading = true;
  
    // start the upload and save the progress map
    this.progress = this.uploadSrv.upload(this.fileToUpload);

    let allProgressObservables = [];
    for (let key in this.progress) {
      allProgressObservables.push(this.progress[key].progress);
      console.log('Progress: ', this.progress[key].progress);
    }

    // When all progress-observables are completed...
    forkJoin(allProgressObservables).subscribe(end => {
      // ... the upload was successful...
      this.uploadSuccessful = true;

      // ... and the component is no longer uploading
      this.uploading = false;

      console.log ('Upload successfull !!');
    });

  }
 

}



