import { Observable, PropertyChangeData } from "tns-core-modules/data/observable";
import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterExtensions } from "nativescript-angular/router";
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
    selector: 'ns-scoring',
    moduleId: module.id,
    templateUrl: './scoring.component.html',
    styleUrls: ['./scoring.component.css'],
})
export class ScoringComponent extends MySideDrawer implements OnInit, OnDestroy {
    private event: any;
    private rider: any;
    private keypad: string;
    private timer: string;

    private timeout: number;
    private timerEnds: number;
    private timerId: number;

    private zone: number;
    private number: number;
    private enterNextNumber: boolean;
    private nextNumberDigits: any;
    private items: any = [];
    private marks: number;
    private penalty_marks: number;

    constructor(
	private settingsService: SettingsService,
	private dataService: DataService,
	private computeService: ComputeService,
	private routerExtensions: RouterExtensions) {
	super();
	this.dataService.addEventListener(
	    Observable.propertyChangeEvent,
	    this.dataChangeListener, this);
	this.computeService.addEventListener(
	    Observable.propertyChangeEvent,
	    this.computeChangeListener, this);
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

    ngOnInit(): void {
	this.event = this.dataService.event;
	this.zone = this.settingsService.registeredZones[0];
	this.reset();
    }

    ngOnDestroy() {
	if (this.timerId != null)
	    timer.clearTimeout(this.timerId);
    }

    reset() {
	if (!this.enterNextNumber)
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
	this.marks = null;
	this.penalty_marks = null;
	this.keypad = 'number';
    }

    enterDigit(digit: number) {
	if (this.enterNextNumber) {
	    this.enterNextNumber = false;
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

    riderChanged() {
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
	    this.enterNextNumber ? null : this.number);
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
	let format = m.hours() != 0 ? 'h:mm:ss' : 'm:ss';
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

    async confirmMarks() {
	await this.dataService.record({
	    zone: this.zone,
	    number: this.number,
	    marks: this.marks,
	    penalty_marks: this.penalty_marks
	});
	this.enterNextNumber = true;
	this.reset();
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
}
