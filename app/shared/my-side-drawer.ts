import * as application from "tns-core-modules/application";
import { RadSideDrawer } from "nativescript-ui-sidedrawer";

export class MySideDrawer {
    toggleSideDrawer() {
	let sideDrawer = <RadSideDrawer>application.getRootView();
	sideDrawer.toggleDrawerState();
    }
}
