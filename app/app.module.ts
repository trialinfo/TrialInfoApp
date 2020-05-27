import { NgModule, NO_ERRORS_SCHEMA } from "@angular/core";
import { NativeScriptFormsModule } from "nativescript-angular/forms";
import { NativeScriptModule } from "nativescript-angular/nativescript.module";
import { NativeScriptHttpClientModule } from "nativescript-angular/http-client";
import { NativeScriptUISideDrawerModule } from "nativescript-ui-sidedrawer/angular";

import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AddHeaderInterceptor } from "./shared/http-add-header-interceptor";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { LoginComponent } from "./login/login.component";
import { RegisterComponent } from "./register/register.component";
import { ScoringComponent } from "./scoring/scoring.component";
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
        LoginComponent,
	RegisterComponent,
	ScoringComponent,
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
