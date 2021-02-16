import { NgModule } from "@angular/core";
import { NativeScriptRouterModule } from "@nativescript/angular";
import { Routes } from "@angular/router";

import { ConnectComponent } from "./connect/connect.component";
import { RegisterComponent } from "./register/register.component";
import { MarksComponent } from "./marks/marks.component";
import { TableComponent } from "./table/table.component";
import { ProtocolComponent } from "./protocol/protocol.component";

const routes: Routes = [
    { path: "connect", component: ConnectComponent },
    { path: "register", component: RegisterComponent },
    { path: "marks", component: MarksComponent },
    { path: "table", component: TableComponent },
    { path: "protocol", component: ProtocolComponent }
];

@NgModule({
    imports: [NativeScriptRouterModule.forRoot(routes)],
    exports: [NativeScriptRouterModule]
})
export class AppRoutingModule { }
