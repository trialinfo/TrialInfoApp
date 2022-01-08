import { NgModule, NO_ERRORS_SCHEMA } from "@angular/core";
import { NativeScriptFormsModule, NativeScriptModule, NativeScriptHttpClientModule } from "@nativescript/angular";
import { NativeScriptUISideDrawerModule } from "nativescript-ui-sidedrawer/angular";

import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AddHeaderInterceptor } from "./shared/http-add-header-interceptor";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { ConnectComponent } from "./connect/connect.component";
import { RegisterComponent } from "./register/register.component";
import { MarksComponent } from "./marks/marks.component";
import { TableComponent } from "./table/table.component";
import { ProtocolComponent } from "./protocol/protocol.component";
import {
    SettingsService,
    DataService,
    SyncService,
    PollService,
    ComputeService
} from "./shared";

@NgModule({
    bootstrap: [
        AppComponent
    ],
    imports: [
        NativeScriptModule,
	NativeScriptHttpClientModule,
        NativeScriptFormsModule,
	NativeScriptUISideDrawerModule,
        AppRoutingModule
    ],
    declarations: [
        AppComponent,
        ConnectComponent,
	RegisterComponent,
	MarksComponent,
	TableComponent,
	ProtocolComponent
    ],
    providers: [
	{
	    provide: HTTP_INTERCEPTORS,
	    useClass: AddHeaderInterceptor,
	    multi: true
        },
	SettingsService,
	DataService,
	SyncService,
	PollService,
	ComputeService
    ],
    schemas: [
        NO_ERRORS_SCHEMA
    ]
})
export class AppModule { }
