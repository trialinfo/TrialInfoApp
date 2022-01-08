import * as application from '@nativescript/core/application';
import { RadSideDrawer } from "nativescript-ui-sidedrawer";

export class MySideDrawer {
    toggleSideDrawer() {
	let sideDrawer = <RadSideDrawer>application.getRootView();
	sideDrawer.toggleDrawerState();
    }
}
