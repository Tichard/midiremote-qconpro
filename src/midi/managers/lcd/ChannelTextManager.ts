// @ts-expect-error No type defs available
import abbreviate from "abbreviate";
import { LcdManager } from "./LcdManager";
import { deviceConfig } from "/config";
import { GlobalState } from "/state";
import { ContextVariable, TimerUtils } from "/util";

/**
 * Handles the LCD display text of a single channel
 */
export class ChannelTextManager {
  private static readonly channelWidth = deviceConfig.hasIndividualScribbleStrips ? 7 : 6;

  private static nextManagerId = 0;

  /**
   * Strips any non-ASCII character from the provided string, since devices only support ASCII.
   **/
  private static stripNonAsciiCharacters(input: string) {
    return input.replace(/[^\x00-\x7F]/g, "");
  }

  /**
   * Given a <= `ChannelTextManager.channelWidth` characters long string, returns a left-padded
   * version of it that appears centered on an `ChannelTextManager.channelWidth`-character display.
   */
  private static centerString(input: string) {
    if (input.length >= ChannelTextManager.channelWidth) {
      return input;
    }

    return (
      LcdManager.makeSpaces(Math.floor((ChannelTextManager.channelWidth - input.length) / 2)) +
      input
    );
  }

  /**
   * Given a string, returns an abbreviated version of it consisting of at most
   * `LcdManager.channelWidth` characters.
   */
  private static abbreviateString(input: string) {
    if (input.length < ChannelTextManager.channelWidth) {
      return input;
    }

    return abbreviate(input, { length: ChannelTextManager.channelWidth });
  }

  /**
   * Most value will have too much precision, so pre-abbreviate the value so it stays readable
   * within `LcdManager.channelWidth` characters.
   */
  private static FormatParameterName(parameterName: string) {
    if (parameterName.includes('EQ ')) // Cubase encoder EQ
    {
      // Remove EQ from the name and add the EQ ID at the end
      parameterName = parameterName.split('EQ ')[1]
      let eq = parameterName.split(' ')
      parameterName =  eq[1] + eq[0]
    }
    return parameterName;
  }

  /**
   * Most values will have too much precision, so pre-abbreviate the value so it stays readable
   * within `LcdManager.channelWidth` characters.
   */
  private static FormatParameterValue(parameterValue: string) {
    if (parameterValue.length < ChannelTextManager.channelWidth) {
      return parameterValue;
    }
    if (parameterValue.includes('Hz'))
    {
      let value = Number(parameterValue.split('Hz')[0])
      if (value > 10000)
      {
        value =  Math.round(value/100) / 10;
        let int = Math.floor(value);
        let dec = Math.floor(10* (value - int));
        parameterValue = int + 'k' + dec + 'Hz';
      }
      else if (value > 100)
      {
        parameterValue = Math.round(value) + 'Hz';
      }
    }
    else if (parameterValue.includes('dB'))
    {
      let value = Number(parameterValue.split('dB')[0])
      if (Math.abs(value) > 10)
      {
        parameterValue = Math.round(value) + 'dB';
      }
    }
    return parameterValue;
  }

  private static translateParameterName(parameterName: string) {
    return (
      {
        // English
        "Left-Right": "Pan",
        "Pan Left-Right": "Pan",

        // German
        "Pan links/rechts": "Pan",

        // Spanish
        "Pan izquierda-derecha": "Pan",

        // French
        "Pan gauche-droit": "Pan",
        "Pré/Post": "PrePost",

        // Italian
        "Pan sinistra-destra": "Pan",
        Monitoraggio: "Monitor",

        // Japanese
        左右パン: "Pan",
        モニタリング: "Monitor",
        レベル: "Level",

        // Portuguese
        "Pan Esquerda-Direita": "Pan",
        Nível: "Nivel",
        "Pré/Pós": "PrePost",

        // Russian
        "Панорама Лево-Право": "Pan",
        Монитор: "Monitor",
        Уровень: "Level",
        "Пре/Пост": "PrePost",

        // Chinese
        "声像 左-右": "Pan",
        监听: "Monitor",
        电平: "Level",
        "前置/后置": "PrePost",
      }[parameterName] ?? parameterName
    );
  }

  private static translateParameterValue(parameterValue: string) {
    return (
      {
        // French
        Éteint: "Eteint",

        // Japanese
        オン: "On",
        オフ: "Off",

        // Russian
        "Вкл.": "On",
        "Выкл.": "Off",

        // Chinese
        开: "On",
        关: "Off",
      }[parameterValue] ?? parameterValue
    );
  }

  /** A unique number for each `ChannelTextManager` so it can set uniquely identified timeouts */
  private uniqueManagerId = ChannelTextManager.nextManagerId++;

  private parameterName = new ContextVariable("");
  private parameterNameOverride = new ContextVariable<string | undefined>(undefined);
  private parameterValue = new ContextVariable("");
  private channelName = new ContextVariable("");
  private isLocalValueModeActive = new ContextVariable(false);

  constructor(
    private globalState: GlobalState,
    private timerUtils: TimerUtils,
    private sendText: (context: MR_ActiveDevice, row: number, text: string) => void,
  ) {
    globalState.isValueDisplayModeActive.addOnChangeCallback(
      this.updateNameValueDisplay.bind(this),
    );
    globalState.areDisplayRowsFlipped.addOnChangeCallback(this.updateNameValueDisplay.bind(this));
    globalState.areDisplayRowsFlipped.addOnChangeCallback(this.updateTrackTitleDisplay.bind(this));
  }

  private updateNameValueDisplay(context: MR_ActiveDevice) {
    const row = +this.globalState.areDisplayRowsFlipped.get(context);

    this.sendText(
      context,
      row,
      this.isLocalValueModeActive.get(context) ||
        this.globalState.isValueDisplayModeActive.get(context)
        ? this.parameterValue.get(context)
        : this.parameterNameOverride.get(context) ?? this.parameterName.get(context),
    );
  }

  private updateTrackTitleDisplay(context: MR_ActiveDevice) {
    const row = 1 - +this.globalState.areDisplayRowsFlipped.get(context);

    this.sendText(context, row, this.channelName.get(context));
  }

  setParameterName(context: MR_ActiveDevice, name: string) {
    // Luckily, `mOnTitleChange` runs after `mOnDisplayValueChange`, so setting
    // `isLocalValueModeActive` to `false` here overwrites the `true` that `mOnDisplayValueChange`
    // sets
    this.isLocalValueModeActive.set(context, false);

    this.parameterName.set(
      context,
      ChannelTextManager.centerString(
        ChannelTextManager.abbreviateString(
          ChannelTextManager.stripNonAsciiCharacters(
            ChannelTextManager.FormatParameterName(
              ChannelTextManager.translateParameterName(name),
            ),
          ),
        ),
      ),
    );

    this.updateNameValueDisplay(context);
  }

  /**
   * Sets a parameter name string that replaces the one set via `setParameterName()` until
   * `clearParameterNameOverride()` is invoked.
   */
  setParameterNameOverride(context: MR_ActiveDevice, name: string) {
    this.parameterNameOverride.set(
      context,
      ChannelTextManager.centerString(ChannelTextManager.abbreviateString(name)),
    );
  }

  clearParameterNameOverride(context: MR_ActiveDevice) {
    this.parameterNameOverride.set(context, undefined);
  }

  setParameterValue(context: MR_ActiveDevice, value: string) {
    value = ChannelTextManager.translateParameterValue(value);

    this.parameterValue.set(
      context,
      ChannelTextManager.centerString(
        ChannelTextManager.abbreviateString(
          ChannelTextManager.stripNonAsciiCharacters(
            ChannelTextManager.FormatParameterValue(value),
          ),
        ),
      ),
    );
    this.isLocalValueModeActive.set(context, true);
    this.updateNameValueDisplay(context);

    this.timerUtils.setTimeout(
      context,
      `updateDisplay${this.uniqueManagerId}`,
      (context) => {
        this.isLocalValueModeActive.set(context, false);
        this.updateNameValueDisplay(context);
      },
      1,
    );
  }

  setChannelName(context: MR_ActiveDevice, name: string) {
    this.channelName.set(
      context,
      ChannelTextManager.centerString(
        ChannelTextManager.abbreviateString(
          ChannelTextManager.stripNonAsciiCharacters(name)
        ),
      ),
    );
    this.updateTrackTitleDisplay(context);
  }
}
