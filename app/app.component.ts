import { Component, ViewChild, OnInit, AfterViewInit, ChangeDetectorRef } from "@angular/core";
import { isAndroid } from "tns-core-modules/platform";
import * as application from "tns-core-modules/application";
import { RouterExtensions } from "nativescript-angular/router";
import { RadSideDrawerComponent } from "nativescript-ui-sidedrawer/angular";
import { RadSideDrawer } from "nativescript-ui-sidedrawer";
import { Observable, PropertyChangeData } from "tns-core-modules/data/observable";

const moment = require('moment');

import { SettingsService, DataService, SyncService, PollService } from "./shared";

@Component({
    selector: "ns-app",
    templateUrl: "./app.component.html",
    styleUrls: ["./app.component.css"],
})
export class AppComponent implements OnInit, AfterViewInit {
    @ViewChild(RadSideDrawerComponent, { static: false }) public drawerComponent: RadSideDrawerComponent;
    private sideDrawer: RadSideDrawer;
    private haveEvent: boolean = false;
    private zonesSelected: boolean = false;

    public constructor(
	private routerExtensions: RouterExtensions,
	private changeDetectorRef: ChangeDetectorRef,
	private settingsService: SettingsService,
	private dataService: DataService,
	private syncService: SyncService,
	private pollService: PollService) {
	let registeredZones = this.settingsService.registeredZones;
	this.zonesSelected = registeredZones.length != 0;
	this.settingsService.addEventListener(
	    Observable.propertyChangeEvent,
	    this.settingsChangeListener, this);
	this.dataService.addEventListener(
	    Observable.propertyChangeEvent,
	    this.dataChangeListener, this);
	this.dataChangeListener(<PropertyChangeData>{
	    propertyName: 'connected'
	});

	this.dataService.sqlLoaded.then(() => {
	    let event = this.dataService.event;
	    if (event && event.date) {
		let now = moment();
		let date = moment(event.date, 'YYYY-MM-DD', true);
		if (date.isSame(now, 'day') &&
		    this.settingsService.registeredZones.length > 0) {
		    this.routerExtensions.navigate(['/scoring'], {clearHistory: true});
		    return;
		}
	    }
	    this.routerExtensions.navigate(['/login'], {clearHistory: true});
	});
    }

    settingsChangeListener(args: PropertyChangeData): void {
	if (args.propertyName == 'registeredZones')
	    this.zonesSelected = args.value.length != 0;
    }

    dataChangeListener(args: PropertyChangeData): void {
        if (args.propertyName == 'connected') {
	    this.haveEvent =
		this.settingsService.accessToken != null;
	}
    }

    public ngOnInit() {
	if (isAndroid) {
	    application.android.on(application.AndroidApplication.activityBackPressedEvent,
		(args: any) => {
		    args.cancel = true;
		});
	}
    }

    ngAfterViewInit() {
	this.sideDrawer = this.drawerComponent.sideDrawer;
	this.changeDetectorRef.detectChanges();
    }

    showLogin() {
	this.routerExtensions.navigate(['/login'], {clearHistory: true});
	this.sideDrawer.closeDrawer();
    }

    async showRegister() {
	await this.dataService.fetchData();
	this.routerExtensions.navigate(['/register'], {clearHistory: true});
	this.sideDrawer.closeDrawer();
    }

    showScoring() {
	this.routerExtensions.navigate(['/scoring'], {clearHistory: true});
	this.sideDrawer.closeDrawer();
    }

    showTable() {
	this.routerExtensions.navigate(['/table'], {clearHistory: true});
	this.sideDrawer.closeDrawer();
    }

    showProtocol() {
	this.routerExtensions.navigate(['/protocol'], {clearHistory: true});
	this.sideDrawer.closeDrawer();
    }
}
