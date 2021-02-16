import { Injectable } from "@angular/core";
import { Observable, PropertyChangeData } from "tns-core-modules/data/observable";

import { SettingsService, DataService } from '.';
import { merge_sorted } from '../shared/common';

@Injectable()
export class ComputeService extends Observable {
    private numberDigits: any = {};
    private currentRounds: any;

    constructor(
	private settingsService: SettingsService,
	private dataService: DataService) {
	super();
	this.numberDigits = {};
	this.dataService.addEventListener(
	    Observable.propertyChangeEvent,
	    this.dataChangeListener, this);
    }

    dataChangeListener(args: PropertyChangeData): void {
	let changed;

	if (args.propertyName == 'data') {
	    this.numberDigits = {};
	    changed = true;
	}
	if (args.propertyName == 'protocol') {
	    this.protocolUpdate(args.value);
	    changed = true;
	}
	if (changed)
	  this.notifyPropertyChange('compute', null);
    }

    riderStarts(number_: number, zone: number) {
	let event = this.dataService.event;
	let rider = this.dataService.riders[number_];
	if (rider) {
	    let ranking_class = event.classes[rider.class - 1].ranking_class;
	    return event.zones[ranking_class - 1].indexOf(zone) != -1;
	}
    }

    private startingClasses(zone: number) {
	let startingClasses = {};
	let event = this.dataService.event;
	for (let class_idx = 0; class_idx < event.classes.length; class_idx++) {
	    let class_ = event.classes[class_idx];
	    if (!class_)
		continue;
	    let ranking_class = class_.ranking_class;
	    if (event.zones[ranking_class - 1].indexOf(zone) != -1)
		startingClasses[class_idx + 1] = true;
	}
	return startingClasses;
    }

    private computeNumberDigits(zone: number) {
	let numberDigits = {};
	let startingClasses = this.startingClasses(zone);
	let riders = this.dataService.riders;
	for (let number_ in riders) {
	    if (+number_ < 0 || !startingClasses[riders[number_].class])
		continue;
	    let currentDigits = numberDigits;
	    for(;;) {
		let digit = number_[0];
		number_ = number_.substr(1);
		if (!currentDigits[digit]) {
		    currentDigits[digit] = {};
		}
		if (number_.length == 0)
		    break;
		currentDigits = currentDigits[digit];
	    }
	}
	this.numberDigits[zone] = numberDigits;
    }

    nextNumberDigits(zone: number, number_: number) {
	if (!this.numberDigits[zone])
	    this.computeNumberDigits(zone);

	let prefix = '';
	if (number_ != null)
	    prefix = number_.toString();

	let numberDigits = this.numberDigits[zone];
	while (prefix != '') {
	    numberDigits = numberDigits[prefix[0]];
	    prefix = prefix.substr(1);
	    if (!numberDigits)
		return {};
	}
	return Object.keys(numberDigits)
	    .reduce((digits, digit) => {
		digits[digit] = true;
		return digits;
	    }, {});
    }

    private chronologicalSort(protocol) {
	let items = [];

	let sort = (deviceTag, items) =>
	    items
	    .filter((item) => item.time != null)
	    .map((item) => Object.assign({ device_tag: deviceTag }, item))
	    .sort((a, b) => a.time.getTime() - b.time.getTime());

	for (let deviceTag in protocol) {
	    items = merge_sorted(
		items,
		sort(deviceTag, protocol[deviceTag]),
		(a, b) => a.time.getTime() < b.time.getTime());
	}
	return items;
    }

    chronologicalProtocol() {
	let canceled = this.dataService.canceled;
	let protocol = this.chronologicalSort(this.dataService.protocol)
	.filter((item) => !this.dataService.isNullItem(item))
	.map((item) => {
	    let canceled_device = canceled[item.device_tag];
	    if (canceled_device && canceled_device[item.seq])
		item.canceled = true;
	    return item;
	});
	return protocol;
    }

    computeRound() {
	let zones = [];
	return (zone, peek) => {
	    if (zones[zone - 1] == null)
		zones[zone - 1] = 1;
	    if (peek)
		return zones[zone - 1];
	    else
		return zones[zone - 1]++;
	}
    }

    _currentRound(number, zone, peek) {
	if (!this.currentRounds[number])
	    this.currentRounds[number] = this.computeRound();
	return this.currentRounds[number](zone, peek);
    }

    computeCurrentRounds() {
	let items = this.chronologicalProtocol();
	this.currentRounds = {};
	for (let item of items) {
	    if (!item.canceled)
		this._currentRound(item.number, item.zone, false);
	}
    }

    currentRound(number, zone) {
	if (!this.currentRounds)
		this.computeCurrentRounds();
	return this._currentRound(number, zone, true);
    }

    protocolUpdate(update) {
	if (!this.currentRounds)
	    return;
	if (update) {
	    check_for_canceled_item:
	    for (let deviceTag in update) {
		for (let item of update[deviceTag]) {
		    if (this.dataService.isCancelItem(item)) {
			update = null;
			break check_for_canceled_item;
		    }
		}
	    }
	}
	if (!update) {
	    this.currentRounds = null;
	    return;
	}
	for (let item of this.chronologicalSort(update))
	    this._currentRound(item.number, item.zone, false);
    }
}
