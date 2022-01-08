import { Injectable } from "@angular/core";
import * as timer from '@nativescript/core/timer';

import { SettingsService, DataService } from '.';

const minPollDelay: number = 60000;
const maxPollDelay: number = 300000;

class PollTarget {
    private pollDelay: number = minPollDelay;
    private pollActive: boolean = false;
    private pollTimeout: number;
    private seq: any;

    constructor(
	private parent: PollService,
	public serverUrl: string,
	private now: boolean) {
	this.nudge(now);
    }

    nudge(now: boolean) {
	this.pollActive = true;
	if (now)
	    this.poll();
	else
	    this.startTimeout();
    }

    startTimeout() {
	console.log(`Next poll from ${this.serverUrl} in ${Math.floor(this.pollDelay / 1000)} seconds`);
	this.pollTimeout = timer.setTimeout(() => {
	    this.pollTimeout = null;
	    this.poll();
	}, this.pollDelay);
    }

    stopPoll() {
	this.pollActive = false;
	if (this.pollTimeout) {
	    timer.clearTimeout(this.pollTimeout);
	    this.pollTimeout = null;
	}
    }

    private async poll() {
	try {
	    let accessToken = this.parent.settingsService.accessToken;

	    let dataService = this.parent.dataService;
	    let eventInfo = await dataService.pollEventInfo(this.serverUrl, accessToken);
	    if (!this.pollActive)
		return;
	    this.pollDelay =
		Math.max(this.pollDelay / 2, minPollDelay);
	} catch (error) {
	    if (!this.pollActive)
		return;
	    console.log(this.serverUrl + ':');
	    console.log(error);
	    this.pollDelay =
		Math.min(this.pollDelay * 2, maxPollDelay);
	}
	this.startTimeout();
    }
}

@Injectable()
export class PollService {
    private targets = [];

    constructor(
	public settingsService: SettingsService,
	public dataService: DataService) {
	this.startPoll(true);
    }

    startPoll(now: boolean) {
	this.removeAllTargets();
	let serverUrls = [
	    this.settingsService.serverUrl,
	    this.settingsService.syncServerUrl
	];
	for (let serverUrl of serverUrls) {
	    if (serverUrl)
		this.addNewTarget(serverUrl, now);
	}
    }

    private addNewTarget(serverUrl: string, now: boolean) {
	if (!this.targets.some((target) => target.serverUrl == serverUrl)) {
	    console.log('Enabling polling from ' + serverUrl);
	    this.targets.push(new PollTarget(this, serverUrl, now));
	}
    }

    private removeAllTargets() {
	for (let target of this.targets)
	    target.stopPoll();
	this.targets = [];
    }
}
