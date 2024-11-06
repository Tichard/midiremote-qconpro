import {
  ControlSectionSurfaceElements,
  ControlSectionSurfaceElementsDefaultsFactory,
  PartialControlSectionSurfaceElements,
} from "../device-configs";
import { Device } from "./Device";
import { deviceConfig } from "/config";
import { Lamp } from "/decorators/surface-elements/Lamp";
import { LedButton } from "/decorators/surface-elements/LedButton";
import { GlobalState } from "/state";
import { TimerUtils, applyDefaultsFactory, createElements } from "/util";

export class MainDevice extends Device {
  controlSectionElements: ControlSectionSurfaceElements;

  constructor(
    driver: MR_DeviceDriver,
    surface: MR_DeviceSurface,
    globalState: GlobalState,
    timerUtils: TimerUtils,
    firstChannelIndex: number,
    surfaceXPosition: number,
  ) {
    const deviceSurface = deviceConfig.createMainSurface(surface, surfaceXPosition);
    super(driver, firstChannelIndex, deviceSurface, globalState, timerUtils, false);

    this.controlSectionElements = this.applyControlSectionElementDefaults(
      surface,
      deviceSurface.controlSectionElements,
    );
  }

  /**
   * Adds hidden surface elements for all optional control section elements that have been left
   * undefined
   */
  private applyControlSectionElementDefaults(
    surface: MR_DeviceSurface,
    elements: PartialControlSectionSurfaceElements,
  ): ControlSectionSurfaceElements {
    const makeButton = () => new LedButton(surface);
    const defaultsFactory: ControlSectionSurfaceElementsDefaultsFactory = {
      buttons: {
        display: makeButton,
        timeMode: makeButton,
        edit: makeButton,
        flip: makeButton,
        scrub: makeButton,

        encoderAssign: {
          track: makeButton,
          pan: makeButton,
          eq: makeButton,
          send: makeButton,
          plugin: makeButton,
          instrument: makeButton,
        },

        number: () => createElements(8, () => new LedButton(surface)),
        function: () => createElements(8, () => new LedButton(surface)),

        project: {
          left: makeButton,
          right: makeButton,
          mode: makeButton,
          revert: makeButton,
        },
        automation: {
          group: makeButton,
          read: makeButton,
          write: makeButton,
          touch: makeButton,
          latch: makeButton,
          trim: makeButton,
        },
        utility: {
          marker: makeButton,
          nudge: makeButton,
          click: makeButton,
          shift: makeButton,
          drop: makeButton,
          replace: makeButton,
          solo: makeButton,
        },

        transport: {
          left: makeButton,
          right: makeButton,
          cycle: makeButton,
          punch: makeButton,
          rewind: makeButton,
          forward: makeButton,
          stop: makeButton,
          play: makeButton,
          record: makeButton,
        },

        navigation: {
          bank: {
            left: makeButton,
            right: makeButton,
          },
          channel: {
            left: makeButton,
            right: makeButton,
          },
          directions: {
            left: makeButton,
            right: makeButton,
            up: makeButton,
            center: makeButton,
            down: makeButton,
          },
        },
      },

      displayLeds: {
        smpte: () => new Lamp(surface),
        beats: () => new Lamp(surface),
        solo: () => new Lamp(surface),
      },

      expressionPedal: () =>
        ({
          mSurfaceValue: surface.makeCustomValueVariable("ExpressionPedal"),
        }) as MR_Knob,

      footSwitch1: () =>
        ({
          mSurfaceValue: surface.makeCustomValueVariable("FootSwitch1"),
        }) as MR_Button,
      footSwitch2: () =>
        ({
          mSurfaceValue: surface.makeCustomValueVariable("FootSwitch2"),
        }) as MR_Button,
    };

    return applyDefaultsFactory(elements, defaultsFactory);
  }
}
