import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { RouterModule } from "@angular/router";

import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatTabsModule, MatTableModule, MatButtonModule, MatSelectModule,
	MatIconModule, MatDialogModule, MatCheckboxModule, MatProgressSpinnerModule,
  MatProgressBarModule, MatListModule } from '@angular/material';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { AppComponent } from './app.component';
import { AgmCoreModule, GoogleMapsAPIWrapper } from '@agm/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { WorkoutComponent } from './workout/workout.component';
import { TableComponent } from './table/table.component';
import { ListComponent } from './listActivity/list.component';

import { jqxChartComponent } from 'jqwidgets-scripts/jqwidgets-ts/angular_jqxchart';
import { jqxTooltipComponent } from "jqwidgets-scripts/jqwidgets-ts/angular_jqxtooltip";
import { FileDropModule } from 'ngx-file-drop';

import { WorkoutService } from './workout.service';
import { UploadService } from './upload.service';
import { WebsocketService } from './websocket.service';
import { StreamService } from './stream.service';

@NgModule({
  declarations: [
    AppComponent, 
    TableComponent,
    WorkoutComponent,
    ListComponent,
    jqxChartComponent,
    jqxTooltipComponent
  ],
  imports: [
  BrowserModule,
  FileDropModule,
	AgmCoreModule.forRoot({
		apiKey: 'AIzaSyDx11Zx5Y73y-OyG5LmZWUg4_96nv5BtYA'
	}),
  RouterModule.forRoot(
      [
        {
          path: "list",
          component: ListComponent
        },
        {
          path: "workout",
          component: WorkoutComponent
        }
      ],
    ),
	MatTabsModule, 
	MatTableModule,
	MatButtonModule,
  MatSelectModule,
	MatDialogModule,
	MatCheckboxModule,
  MatIconModule, 
  MatProgressSpinnerModule,
  DragDropModule,
  FormsModule, 
  MatListModule,     
	BrowserAnimationsModule,
  MatProgressBarModule,
	HttpClientModule
  ],
  providers: [GoogleMapsAPIWrapper,
              WorkoutService,
              UploadService,
              WebsocketService,
              StreamService
              ],
  bootstrap: [AppComponent]
})
export class AppModule { }
