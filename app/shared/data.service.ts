import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "tns-core-modules/data/observable";

const sqlite = require('nativescript-sqlite');

const moment = require('moment');
const deepEqual = require("deep-equal");

import { SettingsService } from '.';
import { merge_sorted } from '../shared/common';

@Injectable()
export class DataService extends Observable {
    private previousFetch: Promise<any>;
    private data: any = {};
    protocol: any = {};
    maxTime: Date;
    canceled: any = {};
    isConnected: boolean = false;
    private sqlitePromise: Promise<any>;
    sqlLoaded: Promise<any>;

    constructor(
	private httpClient: HttpClient,
	private settingsService: SettingsService) {
	super();
	this.sqlLoaded = this.sqlLoad();
    }

    get event() {
	return this.data.event;
    }
    get riders() {
	return this.data.riders;
    }
    get registeredZones() {
	return this.data.registered_zones;
    }

    async fetchDataFrom(serverUrl: string, accessToken: string, connected) {
	if (this.previousFetch) {
	    await this.previousFetch;
	    return;
	}
	let url = serverUrl + '/api/scoring/' + accessToken;
	this.previousFetch = this.httpClient.get(url).toPromise();
	let response;
	try {
	    response = <any> await this.previousFetch;
	} finally {
	    this.previousFetch = null;
	}
	connected();
	if (!deepEqual(this.data, response)) {
	    this.data = response;
	    await this.sqlUpdateEventData();
	    this.notifyPropertyChange('data', this.data);
	}
    }

    async fetchData() {
	await this.fetchDataFrom(
	    this.settingsService.serverUrl,
	    this.settingsService.accessToken,
	    () => {});
    }

    private setConnected(connected: boolean) {
	this.isConnected = connected;
	this.notifyPropertyChange('connected', connected);
    }

    async connect(serverUrl: string, accessToken: string, connected) {
	// FIXME: Cancel this.previousFetch.
	await this.fetchDataFrom(serverUrl, accessToken, connected);
	this.settingsService.registeredZones = (() => {
	    let registeredZones = this.data.registered_zones;
	    let deviceTag = this.settingsService.deviceTag;
	    let zones = [];
	    for (let zone in registeredZones) {
		if (registeredZones[zone] == deviceTag)
		    zones.push(+zone);
	    }
	    return zones;
	})();
	await this.sqlLoad();
	this.setConnected(true);
    }

    async register(zones: Array<number>) {
	let url = this.settingsService.serverUrl + '/api/scoring/' + this.settingsService.accessToken + '/register';
	let response = <any> await this.httpClient.put(url, {
	    zones: zones,
	    seq: Object.keys(this.protocol).reduce((seq, deviceTag) => {
		let deviceProtocol = this.protocol[deviceTag];
		if (deviceProtocol.length)
		    seq[deviceTag] = deviceProtocol[deviceProtocol.length - 1].seq;
		return seq;
	    }, {})
	}).toPromise();

	this.settingsService.registeredZones = zones;
	if (!deepEqual(this.data.registered_zones, response.registered_zones)) {
	    this.data.registered_zones = response.registered_zones;
	    this.notifyPropertyChange('data', this.data);
	}

	if (Object.keys(response.protocol).length != 0) {
	    for (let deviceTag in response.protocol) {
		let deviceProtocol = response.protocol[deviceTag];
		for (let item of deviceProtocol)
		    item.time = new Date(item.time);
	    }
	    let chronological = this.updateProtocol(response.protocol);
	    this.notifyPropertyChange('protocol', chronological ? response.protocol : null);
	    await this.sqlUpdate();
	}
    }

    isCancelItem(item) {
	return item.canceled_device != null && item.canceled_seq != null;
    }

    async record(item) {
	let deviceTag = this.settingsService.deviceTag;
	item = Object.assign({}, item, {
	    seq: this.settingsService.nextSeq(),
	});
	let time = new Date();
	time.setUTCMilliseconds(0);
	item.time = time;
	let update = {};
	update[deviceTag] = [item];
	let chronological = this.updateProtocol(update);
	this.notifyPropertyChange('protocol', chronological ? update : null);
	await this.sqlInsertItem(deviceTag, item);
    }

    async cancel_record(item) {
	let canceled_item = Object.assign({}, item, {
	    canceled_device: item.device_tag,
	    canceled_seq: item.seq
	});
	delete canceled_item.device_tag;
	delete canceled_item.seq;
	await this.record(canceled_item);
    }

    private updateProtocol(update): boolean {
	let chronological = true;
	for (let deviceTag in update) {
	    let deviceUpdate = update[deviceTag];
	    if (deviceTag == this.settingsService.deviceTag) {
		let seq = deviceUpdate[deviceUpdate.length - 1].seq;
		if (this.settingsService.seq < seq)
		    this.settingsService.seq = seq;
	    }

	    if (this.maxTime != null && chronological) {
		for (let item of deviceUpdate) {
		    if (item.time == null ||
			item.time.getTime() <= this.maxTime.getTime()) {
			chronological = false;
			break;
		    }
		}
	    }

	    for (let item of deviceUpdate) {
		if (item.time != null &&
		    (this.maxTime == null ||
		     item.time.getTime() > this.maxTime.getTime()))
		    this.maxTime = item.time;
	        if (this.isCancelItem(item)) {
		    if (!this.canceled[item.canceled_device])
			this.canceled[item.canceled_device] = {};
		    this.canceled[item.canceled_device][item.canceled_seq] = true;
		}
	    }

	    let deviceProtocol = this.protocol[deviceTag] || [];
	    if (deviceProtocol.length == 0 ||
		deviceProtocol[deviceProtocol.length - 1].seq < deviceUpdate[0].seq) {
		this.protocol[deviceTag] = deviceProtocol.concat(deviceUpdate);
	    } else {
		deviceUpdate = merge_sorted(
		  deviceProtocol,
		  deviceUpdate,
		  (a, b) => a.seq < b.seq);
		let n = 0;
		while (n + 1 < deviceUpdate.length) {
		    if (deviceUpdate[n].seq == deviceUpdate[n + 1].seq) {
			deviceUpdate.splice(n + 1, 1);
		    } else {
			n++;
		    }
		}
		this.protocol[deviceTag] = deviceUpdate;
	    }
	}

	return chronological;
    }

    sqlite(): Promise<any> {
	if (this.sqlitePromise)
	    return this.sqlitePromise;

	if (!this.settingsService.useSQLite)
		return Promise.resolve(null);

	let dbName = 'scoring.sqlite';
	if (!sqlite.exists(dbName))
	    sqlite.copyDatabase(dbName);
	this.sqlitePromise = new sqlite(dbName)
	    .then((db) => {
		db.resultType(sqlite.RESULTSASOBJECT);
		return db;
	    });
	return this.sqlitePromise;
    }

    private async sqlInsertItem(deviceTag, item) {
	let db = await this.sqlite();
	if (!db)
		return;

	item = Object.assign({}, item, {
	    access_token: this.settingsService.accessToken,
	    device_tag: deviceTag
	});
	if (item.time != null)
	    item.time = new Date(item.time).toISOString();
	await db.execSQL(`
	    INSERT INTO marks (${Object.keys(item).join(', ')})
	    VALUES (${Object.keys(item).map((key) => '?').join(', ')})
	`, Object.values(item));
    }

    private async sqlUpdateEventData() {
	let db = await this.sqlite();
	if (!db)
		return;

	await db.execSQL(`
	    REPLACE INTO events (access_token, data)
	    VALUES (?, ?)
	`, [this.settingsService.accessToken,
	    JSON.stringify(this.data)]);
    }

    private async sqlLoad() {
	if (this.settingsService.accessToken == null)
	    return;

	let db = await this.sqlite();
	if (!db)
		return;

	if (deepEqual(this.data, {})) {
	    let rows = await db.all(`
		SELECT data
		FROM events
		WHERE access_token = ?
	    `, [this.settingsService.accessToken]);
	    if (rows.length != 0) {
		this.data = JSON.parse(rows[0].data)
		this.notifyPropertyChange('data', this.data);
	    }
	}

	let rows = await db.all(`
	    SELECT *
	    FROM marks
	    WHERE access_token = ?
	    ORDER BY device_tag, seq
	`, [this.settingsService.accessToken]);

	let update = {};
	for (let row of rows) {
	    delete row.access_token;
	    let deviceTag = row.device_tag;
	    delete row.device_tag;
	    if (row.time != null)
		row.time = new Date(row.time);
	    if (!this.isCancelItem(row)) {
		delete row.canceled_device;
		delete row.canceled_seq;
	    }
	    if (update[deviceTag] == null)
		update[deviceTag] = [];
	    update[deviceTag].push(row);
	}

	this.protocol = {};
	if (!deepEqual(update, {})) {
	    let chronological = this.updateProtocol(update);
	    this.notifyPropertyChange('protocol', chronological ? update : null);
	}
    }

    private async sqlUpdate() {
	let db = await this.sqlite();
	if (!db)
		return;

	let max = (await db.all(`
	    SELECT device_tag, MAX(seq) AS seq FROM marks
	    WHERE access_token = ?
	    GROUP BY device_tag
	    `, [this.settingsService.accessToken]))
	    .reduce((max, row) => {
		max[row.device_tag] = row.seq;
		return max;
	    }, {});

	for (let deviceTag in this.protocol) {
	    for (let item of this.protocol[deviceTag]) {
		if (max[deviceTag] != null && item.seq <= max[deviceTag])
		    continue;
		await this.sqlInsertItem(deviceTag, item);
	    }
	}
    }
}