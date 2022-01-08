import { Component, OnInit, OnDestroy } from "@angular/core";
import { RouterExtensions } from "@nativescript/angular";
import { PropertyChangeData, Observable } from '@nativescript/core';
import * as dialogs from '@nativescript/core/ui/dialogs';

import { SettingsService, DataService, MySideDrawer } from "../shared";

const equal = require("fast-deep-equal");

@Component({
    moduleId: module.id,
    templateUrl: "./register.component.html",
    styleUrls: ["./register.component.css"],
})
export class RegisterComponent extends MySideDrawer implements OnInit, OnDestroy {
    oldZones: any;
    zones: any;

    constructor(
	private settingsService: SettingsService,
	private dataService: DataService,
	private routerExtensions: RouterExtensions) {
	super();
    }

    zonesToRegister() {
	return this.zones
	    .filter((zone) => zone.selected)
	    .map((zone) => zone.number);
    }

    dataChangeListener(args: PropertyChangeData): void {
	if (args.propertyName == 'data')
	    this.update();
    }

    ngOnInit(): void {
	this.dataService.addEventListener(
	    Observable.propertyChangeEvent,
	    this.dataChangeListener, this);
	this.load();
	/* FIXME: this.pollService.pollFrequently(); */
    }

    ngOnDestroy(): void {
	this.dataService.removeEventListener(
	    Observable.propertyChangeEvent,
	    this.dataChangeListener, this);
	/* FIXME: this.pollService.pollInfrequently(); */
    }

    private load(): void {
	let myDeviceTag = this.settingsService.deviceTag;
	let registeredZones = this.dataService.registeredZones;

	function notMyDeviceTag(deviceTag) {
	    if (deviceTag == myDeviceTag)
		return null;
	    return deviceTag;
	}

	this.zones = Object.keys(registeredZones)
	    .map((number) => +number)
	    .sort((a, b) => a - b)
	    .map((number) => ({
		number: number,
		deviceTag: notMyDeviceTag(registeredZones[number]),
		selected: registeredZones[number] == myDeviceTag
	    }));
	this.oldZones = this.zonesToRegister();
    }

    private update(): void {
	let zones = this.zonesToRegister();
	this.load();
	let myDeviceTag = this.settingsService.deviceTag;
	for (let zone of this.zones) {
	    if (zone.selected && zones.indexOf(zone.number) == -1)
		zone.selected = false;
	}
	for (let zone of zones) {
	    if (this.zones[zone - 1] &&
		this.zones[zone - 1].deviceTag == null)
		this.zones[zone - 1].selected = true;
	}
    }

    switchIsEnabled(zone): boolean {
	if (zone.deviceTag)
	    return false;
	let z = this.zonesToRegister();
	return zone.selected || z.length == 0;
    }

    modified(): boolean {
	return !equal(this.zonesToRegister(), this.oldZones);
    }

    canRegister(): boolean {
	let zones = this.zonesToRegister();
	return zones.length <= 1 &&
	       (this.modified() || zones.length >= 1);
    }

    async register() {
	let zones = this.zonesToRegister();
	try {
	    await this.dataService.register(zones);
	} catch (error) {
	    console.log(error);
	    await dialogs.alert({
		title: this.settingsService.serverUrl,
		message: error.statusText || 'Unknown Error',
		okButtonText: 'OK'
	    });
	    this.dataService.fetchData();
	    return;
	}
	this.oldZones = zones;
	if (zones.length != 0)
	    this.routerExtensions.navigate(["/marks"], {clearHistory: true});
    }
}
