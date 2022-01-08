import { Injectable } from "@angular/core";
import { Observable } from '@nativescript/core';
import * as settings from '@nativescript/core/application-settings';
import { random_tag } from "./common";

@Injectable()
export class SettingsService extends Observable {
    private _registeredZones: Array<number>;
    seq: number = 0;
    useSQLite: boolean = true;

    constructor() {
	super();
    }

    get deviceTag(): string {
	let deviceTag = settings.getString("deviceTag")
	if (deviceTag == null) {
	    deviceTag = random_tag();
	    settings.setString("deviceTag", deviceTag);
	}
	return deviceTag;
    }

    nextSeq(): number {
	return ++this.seq;
    }

    get registeredZones() {
	if (this._registeredZones == null) {
	    let string = settings.getString("registeredZones");
	    this._registeredZones =
		string == null ? [] : JSON.parse(string);
	}
	return this._registeredZones;
    }
    set registeredZones(value: Array<number>) {
	settings.setString("registeredZones", JSON.stringify(value));
	this._registeredZones = value;
	this.notifyPropertyChange('registeredZones', value);
    }

    get accessToken() {
	return settings.getString("accessToken");
    }
    set accessToken(value: string) {
	settings.setString("accessToken", value);
    }

    get serverUrl() {
	return settings.getString("serverUrl");
    }
    set serverUrl(value: string) {
	if (value == null)
	    settings.remove("serverUrl");
	else
	    settings.setString("serverUrl", value);
    }

    get syncServerUrl() {
	return settings.getString("syncServerUrl");
    }
    set syncServerUrl(value: string) {
	if (value == null)
	    settings.remove("syncServerUrl");
	else
	    settings.setString("syncServerUrl", value);
    }
}
