import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "tns-core-modules/data/observable";

const sqlite = require('nativescript-sqlite');

const moment = require('moment');
const deepEqual = require("deep-equal");

import { SettingsService } from '.';
import { merge_sorted } from '../shared/common';

export class EventInfo {
    private static requests = [];
    public data;
    private canceled: boolean = false;
    private promise: Promise<EventInfo>;

    constructor(
	public serverUrl: string,
	public accessToken: string) {
    }

    static fetch(
	httpClient: HttpClient,
	serverUrl: string,
	accessToken: string): Promise<EventInfo> {
	let url = serverUrl + '/api/scoring/' + accessToken;

	let request = EventInfo.requests[url];
	if (request && !request.canceled)
	    return request.promise;

	request = new EventInfo(serverUrl, accessToken);
	EventInfo.requests[url] = request;

	request.promise = new Promise<EventInfo>(async (resolve, reject) => {
	    try {
		let response = <any> await httpClient.get(url).toPromise();
		if (request.canceled)
		  reject(undefined);
		// FIXME: Check HTTP error code and general validity
		request.data = response;
		resolve(request);
	    } catch (error) {
		reject(error);
	    } finally {
		if (EventInfo.requests[url] == request)
		  delete EventInfo.requests[url];
	    }
	});

	return request.promise;
    }

    static cancelAll() {
	for (let request of EventInfo.requests)
	    request.canceled = true;
	EventInfo.requests = [];
    }
}

@Injectable()
export class DataService extends Observable {
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

    getEventInfo(serverUrl: string, accessToken: string): Promise<EventInfo> {
	return EventInfo.fetch(this.httpClient, serverUrl, accessToken);
    }

    async processEventInfo(eventInfo: EventInfo) {
	let data = eventInfo.data;

	if (eventInfo.accessToken != this.settingsService.accessToken)
	    return;

	if (!data.ctime || this.data.ctime >= data.ctime)
	    return;

	function no_ctime(obj) {
	    obj = Object.assign({}, obj);
	    delete obj.ctime;
	    return obj;
	};

	if (deepEqual(no_ctime(this.data), no_ctime(data))) {
	    this.data.ctime = data.ctime;
	    return;
	}

	this.data = data;
	await this.sqlUpdateEventData();
	this.notifyPropertyChange('data', this.data);
    }

    async pollEventInfo(serverUrl?: string, accessToken?: string) {
	if (serverUrl == null)
	    serverUrl = this.settingsService.serverUrl;
	if (accessToken == null)
	    accessToken = this.settingsService.accessToken;
	let eventInfo = await this.getEventInfo(serverUrl, accessToken);
	await this.processEventInfo(eventInfo);
    }

    async fetchData() {
	// XXX Only auto-start fetching, polling, and syncing within a
	// reasonable amount of time of registering (not on the next day!)

	await this.pollEventInfo();
    }

    private setConnected(connected: boolean) {
	this.isConnected = connected;
	this.notifyPropertyChange('connected', connected);
    }

    async connect(eventInfo: EventInfo) {
	// FIXME: Cancel this.previousFetch once we know we have a reasonable response ...
	await this.processEventInfo(eventInfo);
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

    isNullItem(item) {
	return item.marks == null && item.penalty_marks == null;
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

    getItem(deviceTag, seq) {
	function binarySearch(array, compare) {
	    var m = 0, n = array.length - 1;
	    while (m <= n) {
		var k = (m + n) >> 1;
		var cmp = compare(array[k]);
		if (cmp > 0) {
		    m = k + 1;
		} else if (cmp < 0) {
		    n = k - 1;
		} else {
		    return array[k];
		}
	    }
	}

	let items = this.protocol[deviceTag];
	let item = binarySearch(items, (item) => seq - item.seq);
	if (item)
	    return Object.assign({device_tag: deviceTag}, item);
    }

    async updateRecord(oldItem, newItem) {
	let updateItem = {
	    canceled_device: oldItem.device_tag,
	    canceled_seq: oldItem.seq
	};
	for (let field of ['number', 'zone'])
	    updateItem[field] = oldItem[field];
	if (newItem) {
	    Object.assign(updateItem, {
		marks: newItem.marks,
		penalty_marks: newItem.penalty_marks
	    });
	}
	await this.record(updateItem);
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
