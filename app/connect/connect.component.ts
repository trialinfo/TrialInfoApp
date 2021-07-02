import { Component, OnInit } from "@angular/core";
import { RouterExtensions } from "@nativescript/angular";
import * as dialogs from "tns-core-modules/ui/dialogs";
import { BarcodeScanner } from 'nativescript-barcodescanner';

import { SettingsService, DataService, EventInfo, SyncService, PollService, MySideDrawer } from "../shared";

const moment = require('moment');

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
    moduleId: module.id,
    templateUrl: "./connect.component.html",
    styleUrls: ["./connect.component.css"],
})
export class ConnectComponent extends MySideDrawer implements OnInit {
    serverUrl: string = '';
    syncServerUrl: string = '';
    accessToken: string = '';
    busy: boolean = false;
    editing: boolean = false;

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

    filledOut() {
	for (let field of ['serverUrl', 'syncServerUrl', 'accessToken']) {
	    if (this[field] == '')
		this[field] = null;
	}
	return this.serverUrl != null && this.accessToken != null;
    }

    async scan() {
	this.editing = false;
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
	    let eventInfo: EventInfo;
	    try {
		eventInfo = await this.dataService.getEventInfo(this.serverUrl, this.accessToken);
	    } catch (error) {
		console.log(error);
		await dialogs.alert({
		    title: this.serverUrl,
		    message: error.statusText || 'Unknown Error',
		    okButtonText: 'OK'
		});
		return;
	    }
	    this.settingsService.serverUrl = this.serverUrl;
	    this.settingsService.syncServerUrl = this.syncServerUrl;
	    this.settingsService.accessToken = this.accessToken;
	    await this.dataService.connect(eventInfo);
	    this.syncService.startSync();
	    this.pollService.startPoll(false);
	    this.routerExtensions.navigate(['/register'], {clearHistory: true});
	} finally {
	    this.busy = false;
	}
    }

    async edit() {
	this.editing = !this.editing;
    }

    eventName() {
	let event = this.dataService.event;
	if (!event)
	    return;
	return event.location;
    }

    eventDate() {
	let event = this.dataService.event;
	if (!event)
	    return;
	let date = moment(event.date, 'YYYY-MM-DD', true);
	return date.locale('de').format('D. MMMM YYYY');
    }
}
