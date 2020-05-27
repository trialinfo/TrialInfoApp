import { Component, OnInit, OnDestroy } from "@angular/core";
import { RouterExtensions } from "nativescript-angular/router";
import { Observable, PropertyChangeData } from "tns-core-modules/data/observable";
import * as dialogs from "tns-core-modules/ui/dialogs";

import { SettingsService, DataService, ComputeService, MySideDrawer } from "../shared";
import { rider_name, merge_sorted, range } from '../shared/common';

@Component({
    selector: "ns-table",
    moduleId: module.id,
    templateUrl: "./table.component.html",
    styleUrls: ["./table.component.css"],
})
export class TableComponent extends MySideDrawer implements OnInit, OnDestroy {
    registeredZones: Array<number>;
    max_rounds: number;
    zones: any;
    selected: any;

    constructor(
	private settingsService: SettingsService,
	private dataService: DataService,
	private computeService: ComputeService) {
	super();
    }

    settingsChangeListener(args: PropertyChangeData): void {
	if (args.propertyName == 'registeredZones')
	    this.load();
    }

    dataChangeListener(args: PropertyChangeData): void {
	if (args.propertyName == 'data' || args.propertyName == 'protocol')
	    this.load();
    }

    ngOnInit(): void {
	this.settingsService.addEventListener(
	    Observable.propertyChangeEvent,
	    this.settingsChangeListener, this);
	this.dataService.addEventListener(
	    Observable.propertyChangeEvent,
	    this.dataChangeListener, this);
	this.load();
    }

    ngOnDestroy(): void {
	this.settingsService.removeEventListener(
	    Observable.propertyChangeEvent,
	    this.settingsChangeListener, this);
	this.dataService.removeEventListener(
	    Observable.propertyChangeEvent,
	    this.dataChangeListener, this);
    }

    load() {
	this.registeredZones = this.settingsService.registeredZones;
	let zones = this.registeredZones.reduce((zones, zone) => {
	    zones[zone] = {};
	    for (let number_ in this.dataService.riders) {
		if (this.computeService.riderStarts(+number_, zone)) {
		    zones[zone][number_] = Object.assign({},
			this.dataService.riders[number_], {
			    number: +number_,
			    computeRound: this.computeService.computeRound(),
			    items: []
			});
		}
	    }
	    return zones;
	}, {});

        let protocol = this.computeService.chronologicalProtocol()
            .filter((item) =>
		!item.canceled && item.zone in zones);

	for (let item of protocol) {
	    let rider = zones[item.zone][item.number];
	    let round = rider.computeRound(item.zone);
	    rider.items[round - 1] = item;
	}

	let event = this.dataService.event;

	this.zones = {};
	for (let zone in zones) {
	    let riders = <any> Object.values(zones[zone]);
	    for (let rider of riders)
		delete rider.computeRound;
	    let rounds = riders.reduce((rounds, rider) => {
		let ranking_class = event.classes[rider.class - 1].ranking_class;
		return Math.max(rounds, event.classes[ranking_class - 1].rounds);
	    }, 0);
	    let actual_rounds = riders.reduce((rounds, rider) => {
		return Math.max(rounds, rider.items.length);
	    }, 0);
	    this.zones[zone] = {
		riders: riders.sort((a, b) => a.number - b.number),
		rounds: rounds,
		actual_rounds: actual_rounds
	    };
	}
    }

    range(start: number, count: number) {
	return range(start, count);
    }

    rounds(zone) {
	return Math.max(zone.rounds, zone.actual_rounds);
    }

    rider_number(rider) {
	if (rider.number >= 0)
	    return rider.number;
    }

    rider_name(rider) {
	return rider_name(rider);
    }

    rider_marks(rider, round, zone) {
	let item = rider.items[round - 1];
	let marks = '';
	if (item) {
	    if (item.marks != null)
		marks += item.marks;
	    if (item.penalty_marks != null) {
		if (item.penalty_marks >= 0)
		    marks += '+';
		marks += item.penalty_marks;
	    }
	} else if (rider.failed && round <= zone.rounds) {
	    marks = '−';
	}
	return marks;
    }

    tapRider(rider) {
	this.tapMarks(rider, rider.items.length);
    }

    tapMarks(rider, round) {
	if (this.selected &&
	    this.selected.number == rider.number &&
	    this.selected.round == round) {
	    this.selected = null;
	} else {
	    this.selected = null;
	    let item = rider.items[round - 1];
	    if (item) {
		this.selected = {
		    item: item,
		    number: rider.number,
		    round: round
		};
	    }
	}
    }

    marksHighlighted(rider, round) {
	return this.selected &&
	       this.selected.number == rider.number &&
	       this.selected.round == round;
    }

    async cancelMarks() {
	let options = {
	    title: 'Punke löschen',
	    message: 'Sind Sie sicher, dass Sie die markierten Punkte löschen wollen?',
	    okButtonText: 'Ja',
	    neutralButtonText: 'Nein'
	};
	let result: boolean = await dialogs.confirm(options);
	if (result) {
	    let item = this.selected.item;
	    this.selected = null;

	    /* FIXME: Suppress update via this.load() and remove
	       item manually instead? */

	    await this.dataService.cancel_record(item);
	}
    }
}
