import { Observable, PropertyChangeData } from "tns-core-modules/data/observable";
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from "@angular/router";
import { RouterExtensions } from "@nativescript/angular";
import * as timer from "tns-core-modules/timer";
import * as dialogs from "tns-core-modules/ui/dialogs";

import { SettingsService, DataService, ComputeService, MySideDrawer } from '../shared';
import { rider_name } from '../shared/common';

const moment = require('moment');

import * as srgb from '../shared/srgb';

function item_text(item) {
    let text = '';
    if (item.marks != null)
	text += item.marks;
    if (item.penalty_marks != null) {
	if (item.penalty_marks >= 0)
	    text += '+';
	text += item.penalty_marks;
    }
    return text;
}

@Component({
    moduleId: module.id,
    templateUrl: './marks.component.html',
    styleUrls: ['./marks.component.css'],
})
export class MarksComponent extends MySideDrawer implements OnDestroy {
    public event: any;
    public rider: any;
    public keypad: string;
    public timer: string;

    private timeout: number;
    private timerEnds: number;
    private timerId: number;
    private items: any = [];

    public zone: number;
    public number: number;
    public showPreviousMarks: boolean;
    public nextNumberDigits: any;
    public marks: number;
    public penalty_marks: number;

    public previousItem: any;
    public previousRound: number;

    constructor(
	private settingsService: SettingsService,
	private dataService: DataService,
	private computeService: ComputeService,
	private route: ActivatedRoute,
	private routerExtensions: RouterExtensions) {
	super();
	this.dataService.addEventListener(
	    Observable.propertyChangeEvent,
	    this.dataChangeListener, this);
	this.computeService.addEventListener(
	    Observable.propertyChangeEvent,
	    this.computeChangeListener, this);
	this.route.queryParams.subscribe(
	    (params) => this.openPage(params));
    }

    private openPage(params) {
	this.event = this.dataService.event;
	this.zone = this.settingsService.registeredZones[0];
	this.reset();
	if (params.device_tag && params.seq) {
	    let item = this.dataService.getItem(params.device_tag, +params.seq);
	    this.previousItem = item;
	    if (item) {
		this.previousRound = +params.round;
		this.zone = item.zone;
		this.number = item.number;
		this.marks = item.marks;
		if (item.penalty_marks != null)
		    this.penalty_marks = item.penalty_marks;
		/* FIXME: Make sure the previous item hasn't been canceled already! */
		this.numberChanged();
		this.keypad = 'confirm';
	    }
	}
    }

    dataChangeListener(args: PropertyChangeData): void {
	if (args.propertyName == 'data') {
	    this.event = this.dataService.event;
	    this.numberChanged();
	}
    }

    computeChangeListener(args: PropertyChangeData): void {
	if (args.propertyName == 'compute')
	    this.numberChanged();
    }

    ngOnDestroy() {
	this.reset();
    }

    reset(force?: boolean) {
	if (!this.showPreviousMarks || force)
	    this.number = null;
	this.numberChanged();
	/*
	for (;;) {
	    let digits = Object.keys(this.nextNumberDigits);
	    if (digits.length != 1)
		break;
	    this.enterDigit(+digits[0]);
	}
	*/
	this.previousItem = null;
	this.previousRound = null;
	this.marks = null;
	this.penalty_marks = null;
	this.keypad = 'number';
	if (this.timerId != null) {
	    timer.clearTimeout(this.timerId);
	    this.timerId = null;
	}
    }

    enterDigit(digit: number) {
	if (this.showPreviousMarks) {
	    this.showPreviousMarks = false;
	    this.number = null;
	}
	if (this.number == null)
	    this.number = 0;
	this.number *= 10;
	this.number += digit;
	this.numberChanged();
    }

    numberBack() {
	if (this.number >= 10)
	    this.number = Math.trunc(this.number / 10);
	else
	    this.number = null;
	this.numberChanged();
    }

    private riderChanged() {
	if (!this.rider) {
	    this.items = [];
	    return;
	}
	this.items = this.computeService.chronologicalProtocol()
	    .filter((item) =>
		!item.canceled &&
		item.number == this.number &&
		item.zone == this.zone);
    }

    numberChanged() {
	let riders = this.dataService.riders;
	this.rider = (() => {
	    let rider = riders[this.number];
	    if (!rider || !this.computeService.riderStarts(this.number, this.zone))
		return null;
	    return rider;
	})();
	this.riderChanged();
	this.nextNumberDigits = this.computeService.nextNumberDigits(this.zone,
	    this.showPreviousMarks ? null : this.number);
    }

    riderBackgroundColor() {
	let rider = this.rider;
	if (rider != null) {
	    let event = this.event;
	    let ranking_class = event.classes[rider.class - 1].ranking_class;
	    return event.classes[ranking_class - 1].color;
	}
    }

    riderColor() {
	let match = (this.riderBackgroundColor() || '')
	    .match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
	if (match) {
	    let luminance = srgb.luminance(
		parseInt(`0x${match[1]}`) / 0xff,
		parseInt(`0x${match[2]}`) / 0xff,
		parseInt(`0x${match[3]}`) / 0xff);
	    return luminance < 0.5 ? '#ffffff' : '#000000';
	}
    }

    showTimer() {
	this.timeout = this.riderTimeout();
	if (this.timeout != null) {
	    this.keypad = 'timer';
	    this.timer = 'stopped';
	    return true;
	}
    }

    rider_rounds() {
	let rider = this.rider;
	let event = this.event;
	let ranking_class = event.classes[rider.class - 1].ranking_class;
	return event.classes[ranking_class - 1].rounds;
    }

   async confirmNumber() {
	let warnings = [];

	if (this.rider.failed) {
	    warnings.push(`Dieser Fahrer ist ausgefallen.`);
	}

	let round = this.computeService.currentRound(this.number, this.zone);
	let rounds = this.rider_rounds();
	if (round > rounds) {
	    warnings.push(`Dieser Fahrer war schon ${round - 1} Mal hier.`);
	}

	let items = this.items;
	if (items.length) {
	    let last_time = items[items.length - 1].time;
	    let now = new Date();
	    if (last_time.getTime() > now.getTime() - 1000 * 60 * 20) {
		let minutes = Math.trunc((now.getTime() - last_time.getTime()) / (1000 * 60));
		let when = (minutes == 1) ?
		    `vor ${minutes} Minute` : `vor ${minutes} Minuten`;
		warnings.push(`Diesem Fahrer wurden zuletzt ${when} Punkte vergeben.`);
	    }
	}

	if (warnings.length) {
	    let options = {
		title: "Punkte vergeben",
		message: `${warnings.join(' ')} Trotzdem Punkte vergeben?`,
		okButtonText: 'Ja',
		cancelButtonText: 'Nein',
		// neutralButtonText: ''
	    };
	    let result: boolean = await dialogs.confirm(options);
	    if (!result) {
		this.reset();
		return;
	    }
	}

	if (!this.showTimer())
	    this.keypad = 'marks';
    }

    riderTimeout(): number {
	let rider = this.rider;
	if (!rider)
	    return null;
	let event = this.event;
	let ranking_class = event.classes[rider.class - 1].ranking_class;
	let time_limit = event.classes[ranking_class - 1].time_limit;
	if (time_limit == null)
	    return null;
	let m = moment(time_limit, 'HH:mm:ss', true);
	return (((m.hours() * 60) + m.minutes()) * 60 + m.seconds()) * 1000;
    }

    showTimeout() {
	let seconds = Math.ceil(this.timeout / 1000);
	let m = moment(new Date(0, 0, 0, 0, 0, seconds));
	let format = m.hours() != 0 ? 'H:mm:ss' : 'm:ss';
	return m.format(format);
    }

    updateTimeout() {
	let now = (new Date()).valueOf();
	this.timeout = Math.max(0, this.timerEnds - now);
    }

    timerTick() {
	this.updateTimeout();
	if (this.timeout <= 0) {
	    this.timerId = null;
	    this.timer = 'expired';
	} else {
	    this.timerId = timer.setTimeout(() => {
		this.timerTick()
	    }, (this.timeout + 999) % 1000 + 1);
	}
    }

    timerStart() {
	let now = (new Date()).valueOf();
	this.timerEnds = now + this.timeout;
	this.timerTick();
	this.timer = 'running';
    }

    timerPause() {
	if (this.timerId) {
	    timer.clearTimeout(this.timerId);
	    this.timerId = null;
	}
	this.updateTimeout();
	this.timer = 'paused';
    }

    timerReset() {
	this.timerPause();
	this.timeout = this.riderTimeout();
	this.timer = 'stopped';
    }

    timerNext() {
	this.timerPause();
	this.keypad = 'marks';
    }

    timerBack() {
	this.keypad = 'number';
    }

    enterMarks(marks: number) {
	this.marks = marks;
	this.keypad = 'confirm';
    }

    marksBack() {
	if (!this.showTimer())
	    this.reset();
    }

    enterPenaltyMarks(marks) {
	this.penalty_marks = marks;
    }

    currentItem() {
	return {
	    zone: this.zone,
	    number: this.number,
	    marks: this.marks,
	    penalty_marks: this.penalty_marks
	};
    }

    async confirmMarks() {
	if (!this.rider) {
	    console.log("Something's wrong");
	    this.reset(true);
	    return;
	}

	await this.dataService.record(this.currentItem());
	this.showPreviousMarks = true;
	this.reset();
    }

    async updateMarks() {
	let options = {
	    title: 'Punkte korrigieren',
	    message: 'Sind Sie sicher, dass Sie die Punkte korrigieren wollen?',
	    okButtonText: 'Ja',
	    neutralButtonText: 'Nein'
	};
	let result: boolean = await dialogs.confirm(options);
	if (result) {
	    if (!this.rider) {
		console.log("Something's wrong");
		this.reset(true);
		return;
	    }

	    await this.dataService.updateRecord(this.previousItem, this.currentItem());
	    this.showPreviousMarks = true;
	    this.reset();
	}
    }

    async deleteMarks() {
	let options = {
	    title: 'Punkte löschen',
	    message: 'Sind Sie sicher, dass Sie die Punkte löschen wollen?',
	    okButtonText: 'Ja',
	    neutralButtonText: 'Nein'
	};
	let result: boolean = await dialogs.confirm(options);
	if (result) {
	    await this.dataService.updateRecord(this.previousItem, null);
	    this.showPreviousMarks = true;
	    this.reset();
	}
    }

    confirmBack() {
	if (this.penalty_marks != null)
	    this.penalty_marks = null;
	else {
	    this.marks = null;
	    this.keypad = 'marks';
	}
    }

    previousMarksText() {
	let rider = this.rider;
	if (rider) {
	    let x = this.items.map((item) => item_text(item));
	    if (rider.failed) {
		let rounds = this.rider_rounds();
		while (x.length < rounds)
		    x.push('−');
	    }
	    return x.join(' ');
	}
    }

    marksText() {
	return item_text(this);
    }

    rider_name(rider) {
	if (rider)
	    return rider_name(rider);
    }

    previousRoundText() {
	return `Runde ${this.previousRound}`;
    }

    previousTime() {
	let time = moment(this.previousItem.time);
	let date = moment(this.event.date, 'YYYY-MM-DD', true);
	if (!date.isAfter(time) && date.add(1, 'day').isAfter(time))
	    return time.locale('de').format('HH:mm');
	else
	    return time.locale('de').format('D. MMMM YYYY, HH:mm');
    }

    modified() {
	let item = this.previousItem;
	return item &&
	       (item.marks != this.marks ||
	        item.penalty_marks != this.penalty_marks);
    }
}
