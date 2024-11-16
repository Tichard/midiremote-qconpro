// Polyfills
// organize-imports-ignore
import "core-js/actual/array/iterator";
import "core-js/actual/array/at";
import "core-js/actual/array/from";
import "core-js/actual/array/includes";
import "core-js/actual/array/reverse";
import "core-js/actual/array/flat-map";
import "core-js/actual/string/pad-start";
import "core-js/actual/string/replace-all";
import "core-js/actual/object/entries";
import "core-js/actual/reflect/construct";

// @ts-ignore Workaround because the core-js polyfill doesn't play nice with SWC:
Reflect.get = undefined;

import midiremoteApi from "midiremote_api_v1";
import { createDevices } from "/devices";
import { makeHostMapping } from "/mapping";
import { bindDevicesToMidi } from "/midi";
import { LifecycleCallbacks, makeTimerUtils } from "/util";
import { createGlobalState } from "/state";
import { deviceConfig } from "./config";

const driver = midiremoteApi.makeDeviceDriver(VENDOR_NAME, DEVICE_NAME, "MidiRemote");

const surface = driver.mSurface;

const globalState = createGlobalState();
const page = driver.mMapping.makePage("map");
const timerUtils = makeTimerUtils(driver, page, surface);

// Create devices, i.e., midi ports, managers, and surface elements for each physical device
const devices = createDevices(driver, surface, globalState, timerUtils);

const lifecycleCallbacks = new LifecycleCallbacks(driver);

lifecycleCallbacks.addActivationCallback((context) => {
  console.log("Activating iCON QCONPRo MidiRemote v" + SCRIPT_VERSION);
});


lifecycleCallbacks.addDeactivationCallback((context) => {
  console.log("Deactivating iCON QCONPRo MidiRemote v" + SCRIPT_VERSION);
});


// Bind device elements to MIDI
const { segmentDisplayManager } = bindDevicesToMidi(devices, globalState, lifecycleCallbacks);

// Map device elements to host functions
makeHostMapping(page, devices, segmentDisplayManager, globalState, lifecycleCallbacks);

if (deviceConfig.enhanceMapping) {
  deviceConfig.enhanceMapping({
    driver,
    page,
    devices,
    segmentDisplayManager,
    globalState,
    lifecycleCallbacks,
  });
}
