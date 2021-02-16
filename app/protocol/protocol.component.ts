import { Component, OnInit, OnDestroy } from "@angular/core";
import { Page } from "tns-core-modules/ui/page";
import { ScrollView } from "tns-core-modules/ui/scroll-view";
import { RouterExtensions } from "@nativescript/angular";
import { Observable, PropertyChangeData } from "tns-core-modules/data/observable";
import * as dialogs from "tns-core-modules/ui/dialogs";

import { SettingsService, DataService, ComputeService, MySideDrawer } from "../shared";
import { rider_name } from '../shared/common';

const moment = require('moment');

@Component({
    moduleId: module.id,
    templateUrl: "./protocol.component.html",
    styleUrls: ["./protocol.component.css"],
})
export class ProtocolComponent extends MySideDrawer implements OnInit, OnDestroy {
    registeredZones: Array<number>;
    zones: any;
    rounds: any;
    selected: any;
    scrolledToEnd: boolean;

    constructor(
	private routerExtensions: RouterExtensions,
	private page: Page,
	private settingsService: SettingsService,
	private dataService: DataService,
	private computeService: ComputeService) {
	super();
	page.on(Page.layoutChangedEvent, this.onLayoutChanged, this);
    }

    dataChangeListener(args: PropertyChangeData): void {
	if (args.propertyName == 'data' || args.propertyName == 'protocol')
	    this.load();
    }

    ngOnInit(): void {
	this.dataService.addEventListener(
	    Observable.propertyChangeEvent,
	    this.dataChangeListener, this);
	this.load();
    }

    public onLayoutChanged() {
	if (!this.scrolledToEnd) {
	    let verticalScroll : ScrollView = <ScrollView>this.page.getViewById('vertical-scroll');
	    verticalScroll.scrollToVerticalOffset(verticalScroll.scrollableHeight, false);
	    this.scrolledToEnd = true;
	}
    }

    ngOnDestroy(): void {
	this.dataService.removeEventListener(
	    Observable.propertyChangeEvent,
	    this.dataChangeListener, this);
    }

    load() {
	let registeredZones = this.settingsService.registeredZones;
	this.registeredZones = registeredZones;
	let zones = registeredZones.reduce((zones, zone) => {
	    zones[zone] = true;
	    return zones;
	}, {});

	let protocol = this.computeService.chronologicalProtocol()
	    .filter((item) => item.zone in zones);

	let rounds = [];
	let compute_round = {};
	for (let i = 0; i < protocol.length; i++) {
	    let item = protocol[i];
	    if (item.canceled)
		continue;
	    if (!compute_round[item.number])
		compute_round[item.number] =
		    this.computeService.computeRound();
	    rounds[i] = compute_round[item.number](item.zone);
	}

	this.zones = {};
	this.rounds = {};
	for (let zone of this.registeredZones) {
	    this.zones[zone] = [];
	    this.rounds[zone] = [];
	    for (let i = 0; i < protocol.length; i++) {
	        let item = protocol[i];
		if (item.zone == zone) {
		    this.zones[zone].push(item);
		    this.rounds[zone].push(rounds[i]);
		}
	    }
	}
    }

    item_time(item) {
	return moment(item.time).locale('de').format('HH:mm');
    }

    item_name(item) {
	let rider = this.dataService.riders[item.number];
	if (rider)
	    return rider_name(rider);
    }

    item_marks(item) {
	let marks = '' + item.marks;
	if (item.penalty_marks != null) {
	    if (item.penalty_marks >= 0)
		marks += '+';
	    marks += item.penalty_marks;
	}
	return marks;
    }

    tapItem(item, round) {
	if (this.selected &&
	    this.selected.item == item)
	    this.selected = null;
	else {
	    this.selected = null;
	    if (!item.canceled)
		this.selected = {
		    item: item,
		    round: round
		};
	}
    }

    itemHighlighted(item) {
	return this.selected &&
	       this.selected.item == item;
    }

    async changeItem() {
	let selected = this.selected;
        this.routerExtensions.navigate(['/marks'], {
	    queryParams: {
		device_tag: selected.item.device_tag,
		seq: selected.item.seq,
		round: selected.round
	    },
	    clearHistory: true});
    }
}
