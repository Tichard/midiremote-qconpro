import { RgbColor } from "./managers/ColorManager";
import { SegmentDisplayManager } from "./managers/SegmentDisplayManager";
import { sendChannelMeterMode, sendGlobalMeterModeOrientation, sendMeterLevel } from "./util";
import { config, deviceConfig } from "/config";
import { MidiOutputPort } from "/decorators/MidiOutputPort";
import { Device, MainDevice } from "/devices";
import { GlobalState } from "/state";
import { ContextVariable, LifecycleCallbacks } from "/util";

export function bindDevicesToMidi(
  devices: Device[],
  globalState: GlobalState,
  lifecycleCallbacks: LifecycleCallbacks,
) {
  const segmentDisplayManager = new SegmentDisplayManager(devices);

  lifecycleCallbacks.addDeactivationCallback((context) => {
    segmentDisplayManager.clearAssignment(context);
    segmentDisplayManager.clearTime(context);
  });

  for (const device of devices) {
    bindLifecycleEvents(device, lifecycleCallbacks);
    bindChannelElements(device, globalState);

    if (device instanceof MainDevice) {
      bindControlSectionElements(device, globalState);
    }
  }

  return { segmentDisplayManager };
}

function bindLifecycleEvents(device: Device, lifecycleCallbacks: LifecycleCallbacks) {
  const output = device.ports.output;

  const resetLeds = (context: MR_ActiveDevice) => {
    for (let note = 0; note < 0x76; note++) {
      output.sendNoteOn(context, note, 0);
    }
  };

  lifecycleCallbacks.addActivationCallback((context) => {
    resetLeds(context);

    // Send an initial (all-black by default) color message to the device. Otherwise, in projects
    // without enough channels for each device, devices without channels assigned to them would
    // not receive a color update at all, leaving their displays white although they should be
    // black.
    device.colorManager?.sendColors(context);
  });

  lifecycleCallbacks.addDeactivationCallback((context) => {
    device.colorManager?.resetColors(context);
    device.lcdManager.clearDisplays(context);

    // Reset faders
    for (let faderIndex = 0; faderIndex < 9; faderIndex++) {
      output.sendMidi(context, [0xe0 + faderIndex, 0, 0]);
    }

    resetLeds(context);

    // Reset encoder LED rings
    for (let encoderIndex = 0; encoderIndex < 8; encoderIndex++) {
      output.sendMidi(context, [0xb0, 0x30 + encoderIndex, 0]);
    }
  });
}

function bindVuMeter(
  vuMeter: MR_SurfaceCustomValueVariable,
  outputPort: MidiOutputPort,
  meterId: number,
) {
  const sendLevel = (context: MR_ActiveDevice, level: number) => {
    sendMeterLevel(context, outputPort, meterId, level);
  };

  let isMeterUnassigned = false;
  vuMeter.mOnProcessValueChange = (context, newValue) => {
    if (!isMeterUnassigned || newValue === 0) {
      // Cubase sends dB power value. Sqrt to convert to dB linear, then scale it to 0xe.
      const meterLevel = Math.ceil(Math.sqrt(newValue) * 0xe);

      sendLevel(context, meterLevel);
    }
  };

  const setIsMeterUnassigned = (context: MR_ActiveDevice, isUnassigned: boolean) => {
    isMeterUnassigned = isUnassigned;
    if (isUnassigned) {
      sendLevel(context, 0);
    }
  };

  return { setIsMeterUnassigned };
}

function bindChannelElements(device: Device, globalState: GlobalState) {
  const ports = device.ports;

  for (const [channelIndex, channel] of device.channelElements.entries()) {
    // Push Encoder
    channel.encoder.bindToMidi(ports, channelIndex);

    // Display colors – only supported by the X-Touch
    if (deviceConfig.channelColorSupport === "behringer") {
      const encoderColor = new ContextVariable({ isAssigned: false, r: 0, g: 0, b: 0 });
      channel.encoder.mEncoderValue.mOnColorChange = (context, r, g, b, _a, isAssigned) => {
        encoderColor.set(context, { isAssigned, r, g, b });
        updateColor(context);
      };

      const channelColor = new ContextVariable({ isAssigned: false, r: 0, g: 0, b: 0 });
      channel.scribbleStrip.trackTitle.mOnColorChange = (context, r, g, b, _a, isAssigned) => {
        channelColor.set(context, { isAssigned, r, g, b });
        updateColor(context);
      };

      var updateColor = (context: MR_ActiveDevice) => {
        let color: RgbColor;
        const currentEncoderColor = encoderColor.get(context);
        const currentChannelColor = channelColor.get(context);

        if (config.displayColorMode === "encoders") {
          // Fall back to channel color if encoder is not assigned
          color = currentEncoderColor.isAssigned ? currentEncoderColor : currentChannelColor;
        } else if (config.displayColorMode === "channels") {
          color = currentChannelColor;

          // Use white if an encoder has a color but the channel has none. Otherwise, encoder titles
          // on unassigned channels would not be readable.
          if (!currentChannelColor.isAssigned && currentEncoderColor.isAssigned) {
            color = { r: 1, g: 1, b: 1 };
          }
        } else {
          color =
            currentChannelColor.isAssigned || currentEncoderColor.isAssigned
              ? { r: 1, g: 1, b: 1 }
              : { r: 0, g: 0, b: 0 };
        }

        device.colorManager?.setChannelColorRgb(context, channelIndex, color);
      };
    }

    // Scribble Strip
    const channelTextManager = device.lcdManager.channelTextManagers[channelIndex];

    channel.encoder.mOnEncoderValueTitleChange.addCallback((context, _title1, title2) => {
      channelTextManager.setParameterName(context, title2);
    });

    channel.encoder.mEncoderValue.mOnDisplayValueChange = (context, value) => {
      channelTextManager.setParameterValue(context, value);
    };

    channel.scribbleStrip.trackTitle.mOnTitleChange = (context, title, title2) => {
      channelTextManager.setChannelName(context, title);

      // Reset the VU meter when the channels becomes unassigned (there's no way to reliably detect
      // this just using `channel.vuMeter`).
      setIsMeterUnassigned(context, title2 === "");
    };

    /** Clears the channel meter's overload indicator */
    const clearOverload = (context: MR_ActiveDevice) => {
      sendMeterLevel(context, ports.output, channelIndex, 0xf);
    };

    // VU Meter
    const { setIsMeterUnassigned } = bindVuMeter(channel.vuMeter, ports.output, channelIndex);

    globalState.areChannelMetersEnabled.addOnChangeCallback(
      (context, areMetersEnabled) => {
        sendChannelMeterMode(context, ports.output, channelIndex, areMetersEnabled);
      },
      0, // priority = 0: Disable channel meters *before* updating the lower display row
    );

    globalState.shouldMeterOverloadsBeCleared.addOnChangeCallback(
      (context, shouldOverloadsBeCleared) => {
        if (shouldOverloadsBeCleared) {
          clearOverload(context);
        }
      },
    );

    // Channel Buttons
    const buttons = channel.buttons;
    for (const [row, button] of [
      buttons.record,
      buttons.solo,
      buttons.mute,
      buttons.select,
    ].entries()) {
      button.bindToNote(ports, row * 8 + channelIndex);
    }

    // Fader
    channel.fader.bindToMidi(ports, channelIndex, globalState);
  }

  // Handle metering mode changes (globally)
  globalState.isGlobalLcdMeterModeVertical.addOnChangeCallback((context, isMeterModeVertical) => {
    sendGlobalMeterModeOrientation(context, ports.output, isMeterModeVertical);
  });
}

function bindControlSectionElements(device: MainDevice, globalState: GlobalState) {
  const ports = device.ports;

  const elements = device.controlSectionElements;
  const buttons = elements.buttons;

  elements.mainFader.bindToMidi(ports, 8, globalState);

  for (const [index, button] of [
    buttons.encoderAssign.instrument, // 40
    buttons.automation.trim, // 41
    buttons.encoderAssign.track, // 42
    buttons.encoderAssign.eq, // 43
    buttons.encoderAssign.pan, // 44
    buttons.encoderAssign.plugin, // 45

    buttons.navigation.bank.left, // 46
    buttons.navigation.bank.right, // 47
    buttons.navigation.channel.left, // 48
    buttons.navigation.channel.right, // 49

    buttons.flip, // 50
    buttons.automation.read, // 51
    buttons.display, // 52
    buttons.timeMode, // 53
    ...buttons.function, // 54 - 61
    ...buttons.number, // 62 - 69

    buttons.automation.latch, // 70
    buttons.dummy, // 71
    buttons.utility.marker, // 72
    buttons.dummy, // 73
    buttons.utility.nudge, // 74
    buttons.utility.click, // 75

    buttons.dummy, // 76
    buttons.dummy, // 77

    buttons.automation.write, // 78
    buttons.automation.group, // 79
    buttons.automation.touch, // 80
    buttons.encoderAssign.send, // 81

    buttons.dummy, // 82
    buttons.utility.shift, // 83
    buttons.dummy, // 84
    buttons.dummy, // 85
    buttons.transport.cycle, // 86
    buttons.dummy, //87

    buttons.utility.drop, // 88
    buttons.utility.replace, // 89
    buttons.utility.solo, // 90

    buttons.transport.rewind, // 91
    buttons.transport.forward, // 92
    buttons.transport.stop, // 93
    buttons.transport.play, // 94
    buttons.transport.record, // 95

    buttons.navigation.directions.up, // 96
    buttons.navigation.directions.down, // 97
    buttons.navigation.directions.left, // 98
    buttons.navigation.directions.right, // 99
    buttons.navigation.directions.center, // 100

    buttons.scrub,
  ].entries()) {
    button.bindToNote(ports, 40 + index);
  }

  // Segment Display - handled by the SegmentDisplayManager, except for the individual LEDs:
  const { smpte, beats, solo } = elements.displayLeds;
  [smpte, beats, solo].forEach((lamp, index) => {
    lamp.bindToNote(ports.output, 0x71 + index);
  });

  // Jog wheel
  elements.jogWheel.bindToControlChange(ports.input, 0x3c);

  // Foot control
  elements.footSwitch1.mSurfaceValue.mMidiBinding.setInputPort(ports.input).bindToNote(0, 0x66);
  elements.footSwitch2.mSurfaceValue.mMidiBinding.setInputPort(ports.input).bindToNote(0, 0x67);
  elements.expressionPedal.mSurfaceValue.mMidiBinding
    .setInputPort(ports.input)
    .bindToControlChange(0, 0x2e)
    .setTypeAbsolute();
}
