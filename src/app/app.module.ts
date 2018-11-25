import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatTabsModule, MatTableModule, MatButtonModule, 
	MatIconModule, MatDialogModule, MatCheckboxModule } from '@angular/material';
import { AppComponent } from './app.component';
import { AgmCoreModule } from '@agm/core';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';

import { TableComponent } from './table/table.component';
import { Workout, Lap, settingsDialog } from './app.component';
import {WorkoutService} from './workout.service';

@NgModule({
  declarations: [
    AppComponent, 
    settingsDialog,
    TableComponent
  ],
  imports: [
    BrowserModule,
	AgmCoreModule.forRoot({
		apiKey: 'AIzaSyDx11Zx5Y73y-OyG5LmZWUg4_96nv5BtYA'
	}),
	MatTabsModule, 
	MatTableModule,
	MatButtonModule,
	MatDialogModule,
	MatCheckboxModule,
    MatIconModule, 
	BrowserAnimationsModule,
	HttpClientModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
