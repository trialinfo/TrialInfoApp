import { Component, OnInit } from "@angular/core";
import { RouterExtensions } from "nativescript-angular/router";
import * as dialogs from "tns-core-modules/ui/dialogs";

import { SettingsService, DataService, SyncService, PollService, MySideDrawer } from "../shared";

@Component({
    selector: "ns-login",
    moduleId: module.id,
    templateUrl: "./login.component.html",
    styleUrls: ["./login.component.css"],
})
export class LoginComponent extends MySideDrawer implements OnInit {
    serverUrl: string;
    syncServerUrl: string;
    accessToken: string;

    constructor(
	private settingsService: SettingsService,
	private dataService: DataService,
	private syncService: SyncService,
	private pollService: PollService,
	private routerExtensions: RouterExtensions) {
	super();
    }

    ngOnInit(): void {
	this.serverUrl = this.settingsService.serverUrl;
	this.syncServerUrl = this.settingsService.syncServerUrl;
	this.accessToken = this.settingsService.accessToken;
    }

    async connect() {
	try {
	    let connected = () => {
		this.settingsService.serverUrl = this.serverUrl;
		this.settingsService.syncServerUrl = this.syncServerUrl;
		this.settingsService.accessToken = this.accessToken;
	    };
	    await this.dataService.connect(this.serverUrl, this.accessToken, connected);
	    this.syncService.startSync();
	    this.pollService.startPoll(false);
	} catch (error) {
	    console.log(error);
	    await dialogs.alert({
		title: this.serverUrl,
		message: error.statusText || 'Unknown Error',
		okButtonText: 'OK'
	    });
	    return;
	}
	this.routerExtensions.navigate(['/register'], {clearHistory: true});
    }
}
