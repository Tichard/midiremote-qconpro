import { Device, MainDevice } from "/devices";
import { ContextVariable, createElements } from "/util";

export class SegmentDisplayManager {
  private devices: MainDevice[];
  private segmentValues = createElements(12, () => new ContextVariable(0x00));

  private updateSegment(
    context: MR_ActiveDevice,
    segmentId: number,
    digit: number | null,
    hasDot = false,
  ) {
    let value = 0x30 + (digit ?? -0x10);
    if (hasDot) {
      value += 0x40;
    }

    if (value !== this.segmentValues[segmentId].get(context)) {
      this.segmentValues[segmentId].set(context, value);
      for (const device of this.devices) {
        device.ports.output.sendMidi(context, [0xbf, 0x40 + segmentId, value]);
      }
    }
  }

  private updateSegmentsByString(context: MR_ActiveDevice, lastSegmentId: number, string: string) {
    let currentSegmentId = lastSegmentId;
    let hasCurrentSegmentDot = false;
    for (const char of Array.from(string).reverse()) {
      if (char === "." || char === ":") {
        hasCurrentSegmentDot = true;
      } else {
        this.updateSegment(
          context,
          currentSegmentId,
          char === " " ? null : parseInt(char, 10),
          hasCurrentSegmentDot,
        );
        currentSegmentId++;
        hasCurrentSegmentDot = false;
      }
    }
  }

  constructor(devices: Device[]) {
    this.devices = devices.filter((device) => device instanceof MainDevice) as MainDevice[];
  }

  private lastTimeFormat = new ContextVariable("");

  /**
   * Update the 7-segment displays to show the provided `time` string – a string consisting of
   * numbers, spaces, dots, and colons.
   */
  updateTime(context: MR_ActiveDevice, time: string, timeFormat: string) {
    if (timeFormat !== this.lastTimeFormat.get(context)) {
      this.lastTimeFormat.set(context, timeFormat);

      for (const device of this.devices) {
        const { smpte: smpteLed, beats: beatsLed } = device.controlSectionElements.displayLeds;
        // displayLeds are mutually exclusive. Only last one set to 1 is lit.
        smpteLed.mSurfaceValue.setProcessValue(context, +(timeFormat === "Seconds")); // SMPTE LED
        beatsLed.mSurfaceValue.setProcessValue(context, +(timeFormat === "Bars+Beats")); // Beats LED
      }
    }

    // If `time` is separated three times by `.` or `:`, fill it with spaces to match the way digits
    // are grouped on the device
    const match = /^([\d ]+[\.\:])([\d ]+)([\.\:])([\d ]+)([\.\:])([\d ]+)$/.exec(time);
    if (match) {
      time =
        match[1] +
        match[2].padStart(2, " ") +
        match[3] +
        match[4].padStart(2, " ") +
        match[5] +
        match[6].padStart(3, " ");
    }

    this.updateSegmentsByString(
      context,
      0,
      time.padStart(10 + time.replaceAll(/[^\.\:]/g, "").length, " "),
    );
  }

  setAssignment(context: MR_ActiveDevice, assignment: string) {
    this.updateSegmentsByString(context, 10, assignment);
  }

  clearAssignment(context: MR_ActiveDevice) {
    for (let i = this.segmentValues.length - 2; i < this.segmentValues.length; i++) {
      this.updateSegment(context, i, null);
    }
  }

  initTime(context: MR_ActiveDevice, time: string, timeFormat: string) {
    for (const device of this.devices) {
      const output = device.ports.output;
      output.sendNoteOn(context, 0x71,  +(timeFormat === "Seconds")); // SMPTE LED
      output.sendNoteOn(context, 0x72,  +(timeFormat === "Bars+Beats")); // Beats LED
    }

    this.updateTime(context, time, timeFormat);
  }

  clearTime(context: MR_ActiveDevice) {
    for (let i = 0; i < this.segmentValues.length - 2; i++) {
      this.updateSegment(context, i, null);
    }
  }
}
