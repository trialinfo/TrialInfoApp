import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, PropertyChangeData } from '@nativescript/core';
import * as timer from '@nativescript/core/timer';

import { SettingsService, DataService } from '.';

const minSyncDelay: number = 1000;
const maxSyncDelay: number = 64000;

class SyncTarget {
    private syncDelay: number = minSyncDelay / 2;
    private syncActive: boolean = false;
    private syncTimeout: number;
    private seq: any;

    constructor(
	private parent: SyncService,
	public serverUrl: string) {
	this.nudge();
    }

    nudge() {
	if (this.syncActive)
	    return;
	this.syncActive = true;
	this.sync();
    }

    stopSync() {
	this.syncActive = false;
	if (this.syncTimeout) {
	    timer.clearTimeout(this.syncTimeout);
	    this.syncTimeout = null;
	}
    }

    private async sync() {
	/*
	 * If we don't know which updates the sync target knows about, send an
	 * empty request first.  The sync target will tell us about its state
	 * in the response.
	 */
	let changes = {};
	if (this.seq) {
	    changes = this.detectChanges();

	    if (Object.keys(changes).length == 0) {
		this.syncActive = false;
		return;
	    }
	}

	let url = this.serverUrl + '/api/scoring/' + this.parent.settingsService.accessToken;
	try {
	    let response = <any> await this.parent.httpClient.post(url, {
		protocol: changes
	    }).toPromise();
	    if (!this.syncActive)
		return;
	    if (!this.seq)
		this.seq = {};
	    for (let deviceTag in response.seq || {})
		this.seq[deviceTag] = response.seq[deviceTag];
	    this.syncDelay =
		Math.max(this.syncDelay / 2, minSyncDelay);
	    this.sync();
	} catch (error) {
	    if (!this.syncActive)
		return;
	    console.log(this.serverUrl + ':');
	    console.log(error);
	    this.syncDelay =
		Math.min(this.syncDelay * 2, maxSyncDelay);
	    console.log(`Next sync to ${this.serverUrl} in ${Math.floor(this.syncDelay / 1000)} seconds`);
	    this.syncTimeout = timer.setTimeout(() => {
		this.syncTimeout = null;
		this.sync();
	    }, this.syncDelay);
	}
    }

    detectChanges() {
	let changes = {};

	for (let deviceTag in this.parent.dataService.protocol) {
	    if (deviceTag != this.parent.settingsService.deviceTag) {
		/* Currently, we only sync our own changes. */
		continue;
	    }

	    let deviceProtocol = this.parent.dataService.protocol[deviceTag];
	    let first = 0;

	    let seq = this.seq[deviceTag];
	    if (seq != null) {
		first = deviceProtocol.length;
		while (first > 0 && deviceProtocol[first - 1].seq > seq)
		    first--;
	    }

	    if (first == deviceProtocol.length)
		continue;
	    changes[deviceTag] = [];
	    for (let n = first; n < deviceProtocol.length; n++)
		changes[deviceTag].push(deviceProtocol[n]);
	}
	return changes;
    }
}

@Injectable()
export class SyncService {
    private targets = [];

    constructor(
	public settingsService: SettingsService,
	public dataService: DataService,
	public httpClient: HttpClient) {
	this.dataService.addEventListener(
	    Observable.propertyChangeEvent,
	    this.dataChangeListener, this);
	this.startSync();
    }

    startSync() {
	this.removeAllTargets();
	let serverUrls = [
	    this.settingsService.serverUrl,
	    this.settingsService.syncServerUrl
	];
	for (let serverUrl of serverUrls) {
	    if (serverUrl)
		this.addNewTarget(serverUrl);
	}
    }

    dataChangeListener(args: PropertyChangeData): void {
	if (args.propertyName == 'protocol') {
	    for (let target of this.targets)
		target.nudge();
	}
    }

    private addNewTarget(serverUrl: string) {
	if (!this.targets.some((target) => target.serverUrl == serverUrl)) {
	    console.log('Enabling sync to ' + serverUrl);
	    this.targets.push(new SyncTarget(this, serverUrl));
	}
    }

    private removeAllTargets() {
	for (let target of this.targets)
	    target.stopSync();
	this.targets = [];
    }
}
