import { NgModule } from "@angular/core";
import { NativeScriptRouterModule } from "nativescript-angular/router";
import { Routes } from "@angular/router";

import { LoginComponent } from "./login/login.component";
import { RegisterComponent } from "./register/register.component";
import { ScoringComponent } from "./scoring/scoring.component";
import { TableComponent } from "./table/table.component";
import { ProtocolComponent } from "./protocol/protocol.component";

const routes: Routes = [
    { path: "login", component: LoginComponent },
    { path: "register", component: RegisterComponent },
    { path: "scoring", component: ScoringComponent },
    { path: "table", component: TableComponent },
    { path: "protocol", component: ProtocolComponent }
];

@NgModule({
    imports: [NativeScriptRouterModule.forRoot(routes)],
    exports: [NativeScriptRouterModule]
})
export class AppRoutingModule { }
