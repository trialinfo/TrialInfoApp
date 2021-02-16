import { Component, OnInit } from "@angular/core";
import { RouterExtensions } from "nativescript-angular/router";
import * as dialogs from "tns-core-modules/ui/dialogs";
import { BarcodeScanner } from 'nativescript-barcodescanner';

import { SettingsService, DataService, SyncService, PollService, MySideDrawer } from "../shared";

function parseQuery(queryString): any {
    let args = {};
    for (let arg of queryString.split('&')) {
	if (arg == '')
	    continue;
	let match = arg.match(/^([^=]*)(?:=(.*))?/);
	args[decodeURIComponent(match[1])] =
	    match[2] == null ? true : decodeURIComponent(match[2]);
    }
    return args;
}

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
    busy: boolean;

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

    async scan() {
	let result = await new BarcodeScanner().scan({
	    message: 'QR-Code aus TrialInfo-Einstellungen',
	    resultDisplayDuration: 0
	});
	if (result.format == 'QR_CODE' && result.text && result.text.match(/^tr:/)) {
	    let args = parseQuery(result.text.substr(3));
	    this.serverUrl = (typeof args.url == 'string') ? args.url : null;
	    this.syncServerUrl = (typeof args.sync == 'string') ? args.sync : null;
	    this.accessToken = (typeof args.token == 'string') ? args.token : null;
	    this.connect();
	}
    }

    async connect() {
	try {
	    this.busy = true;
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
	} finally {
	    this.busy = false;
	}
	this.routerExtensions.navigate(['/register'], {clearHistory: true});
    }
}
