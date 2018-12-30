import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatTabsModule, MatTableModule, MatButtonModule, MatSelectModule,
	MatIconModule, MatDialogModule, MatCheckboxModule } from '@angular/material';
import { AppComponent } from './app.component';
import { AgmCoreModule, GoogleMapsAPIWrapper } from '@agm/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { TableComponent } from './table/table.component';
import { jqxChartComponent } from 'jqwidgets-scripts/jqwidgets-ts/angular_jqxchart';
import { jqxTooltipComponent } from "jqwidgets-scripts/jqwidgets-ts/angular_jqxtooltip";

import { WorkoutService } from './workout.service';

@NgModule({
  declarations: [
    AppComponent, 
    TableComponent,
    jqxChartComponent,
    jqxTooltipComponent
  ],
  imports: [
    BrowserModule,
	AgmCoreModule.forRoot({
		apiKey: 'AIzaSyDx11Zx5Y73y-OyG5LmZWUg4_96nv5BtYA'
	}),
	MatTabsModule, 
	MatTableModule,
	MatButtonModule,
  MatSelectModule,
	MatDialogModule,
	MatCheckboxModule,
  MatIconModule, 
  FormsModule,      
	BrowserAnimationsModule,
	HttpClientModule
  ],
  providers: [GoogleMapsAPIWrapper,
              WorkoutService
              ],
  bootstrap: [AppComponent]
})
export class AppModule { }
