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
import { DummyComponent } from './dummy/dummy.component';

import { jqxChartComponent } from 'jqwidgets-scripts/jqwidgets-ts/angular_jqxchart';
import { jqxTooltipComponent } from "jqwidgets-scripts/jqwidgets-ts/angular_jqxtooltip";

import { WorkoutService } from './workout.service';


@NgModule({
  declarations: [
    AppComponent, 
    TableComponent,
    WorkoutComponent,
    ListComponent,
    DummyComponent,
    jqxChartComponent,
    jqxTooltipComponent
  ],
  imports: [
  BrowserModule,
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
        },
        {
          path: "strava2/activities",
          component: DummyComponent
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
              WorkoutService
              ],
  bootstrap: [AppComponent]
})
export class AppModule { }
