/**
  # Two Modes
 
  ## Scene Mode
   - rotate
   - shake
   - hold
   - side up
   - one min inactivity
 
  ## Action Mode
   - slide
   - rotate
   - tap twice
   - flip90, flip180
   - shake
   - one min inactivity

  # Clusters (Scene Mode): 

  ## Endpoint 2: 

  | Cluster            | Data                      | Description                   |
  | ------------------ | ------------------------- | ----------------------------- |
  | aqaraopple         | {329: 0-5}                | i side facing up              |
  | genMultistateInput | {presentValue: 0}         | action: shake                 |
  | genMultistateInput | {presentValue: 4}         | action: hold                  |
  | genMultistateInput | {presentValue: 2}         | action: wakeup                |
  | genMultistateInput | {presentValue: 1024-1029} | action: fall with ith side up |

  ## Endpoint 3: 

  | Cluster   | Data                                  | Desc                                       |
  | --------- | ------------------------------------- | ------------------------------------------ |
  | genAnalog | {267: 500, 329: 3, presentValue: -51} | 267: NA, 329: side up, presentValue: angle |
 */

const fz = require('zigbee-herdsman-converters/converters/fromZigbee');
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const xiaomi = require('zigbee-herdsman-converters/lib/xiaomi');
const herdsman = require('zigbee-herdsman');
const globalStore = require('zigbee-herdsman-converters/lib/store');
const ota = require('zigbee-herdsman-converters/lib/ota');
const { sleep } = require('zigbee-herdsman-converters/lib/utils');

const e = exposes.presets;
const ea = exposes.access;

const manufacturerOptions = {
  xiaomi: {
    manufacturerCode: herdsman.Zcl.ManufacturerCode.LUMI_UNITED_TECH,
    disableDefaultResponse: true,
  },
};

const OP_MODE_ATTR = 0x0148;
const opModeLookup = { 0: 'action_mode', 1: 'scene_mode' };
const opModeReverseLookup = { action_mode: 0, scene_mode: 1 };

const one_min_inactivity_handler = (meta, publish) => {
  clearTimeout(globalStore.getValue(meta.device, 'inactivityTimer'));
  const inactivityTimer = setTimeout(() => publish({ action: '1_min_inactivity' }), 1000 * 60);
  globalStore.putValue(meta.device, 'inactivityTimer', inactivityTimer);
}

const aqara_opple = {
  cluster: 'aqaraOpple',
  type: ['attributeReport', 'readResponse'],
  options: (definition) => [
    ...xiaomi.numericAttributes2Options(definition),
    exposes.enum('operation_mode', ea.SET, ['scene_mode', 'action_mode']),
  ],
  convert: async (model, msg, publish, options, meta) => {
    const payload = xiaomi.numericAttributes2Payload(msg, meta, model, options, msg.data);

    // basic data reading (contains operation_mode at attribute 0xf7[247].0x9b[155])
    if (msg.data.hasOwnProperty(247)) {
      // execute pending soft switch of operation_mode, if exists
      if (meta.state.opModeChangeScheduler) {
        const { callback, newMode } = meta.state.opModeChangeScheduler;
        await callback();
        payload.operation_mode = newMode;
        payload.opModeChangeScheduler = null;
      } else {
        const dataObject247 = xiaomi.buffer2DataObject(
          meta,
          model,
          msg.data[247]
        );
        payload.operation_mode = opModeLookup[dataObject247[155]];
      }
      // clear requireClick flag to indicate a successful configure (used by device join and reconfigure).
      if (globalStore.getValue(meta.device, 'requireClick')) {
        globalStore.putValue(meta.device, 'requireClick', false);
      }
    }
    // detected hard switch of operation_mode (attribute 0x148[328])
    else if (msg.data.hasOwnProperty(328)) {
      payload.operation_mode = opModeLookup[msg.data[328]];
    }
    // side_up attribute report (attribute 0x149[329])
    else if (msg.data.hasOwnProperty(329)) {
      payload.action = 'side_up';
      payload.side_up = msg.data[329] + 1;

      one_min_inactivity_handler(meta, publish);
    }

    return payload;
  },
};

const action_multistate = {
  ...fz.MFKZQ01LM_action_multistate,
  convert: (model, msg, publish, options, meta) => {
    one_min_inactivity_handler(meta, publish);
    let payload;
    if (meta.state.operation_mode === 'action_mode') {
      payload = fz.MFKZQ01LM_action_multistate.convert(model, msg, publish, options, meta);
      if (payload?.side != null) payload.side++;
    } else {
      const value = msg.data['presentValue'];
      if (value === 0) payload = { action: 'shake' };
      else if (value === 2) payload = { action: 'wakeup' };
      else if (value === 4) payload = { action: 'hold' };
      else if (value >= 1024) payload = { action: 'side_up', side_up: value - 1023 };
    }
    return payload;
  },
};

const action_analog = {
  ...fz.MFKZQ01LM_action_analog,
  convert: (model, msg, publish, options, meta) => {
    one_min_inactivity_handler(meta, publish);
    return fz.MFKZQ01LM_action_analog.convert(model, msg, publish, options, meta);
  }
}

const operation_mode_switch = {
  key: ['operation_mode'],
  convertSet: async (entity, key, value, meta) => {
    /**
     * schedule the callback to run when the configuration window comes
     */
    const callback = async () => {
      await entity.write(
        'aqaraOpple',
        {
          [OP_MODE_ATTR]: {
            value: opModeReverseLookup[value],
            type: 0x20,
          },
        },
        manufacturerOptions.xiaomi
      );
      meta.logger.info("operation_mode switch success!");
    };

    meta.logger.info("operation_mode switch is scheduled, it might take a long time. \n" +
      "The cube will respond to it once an hour, but you may pick up and shake it to speed up the process. \n" +
      "OR you may open lid and click LINK button once to make it respond immediately.")

    // store callback in state
    return {
      state: {
        opModeChangeScheduler: {
          callback,
          newMode: value,
        },
      },
    };
  },
};

const definition = {
  zigbeeModel: ['lumi.remote.cagl02'],
  model: 'CTP-R01',
  vendor: 'Xiaomi',
  description: 'Aqara magic cube T1 Pro',
  meta: { battery: { voltageToPercentage: '3V_2850_3000' } },
  ota: ota.zigbeeOTA,
  fromZigbee: [aqara_opple, action_multistate, action_analog, fz.ignore_onoff_report],
  toZigbee: [operation_mode_switch],
  exposes: [
    /* Device Info */
    e.battery(),
    e.battery_voltage(),
    e.device_temperature(),
    e.power_outage_count(false),
    exposes
      .enum('operation_mode', ea.SET, ['scene_mode', 'action_mode'])
      .withDescription(
        '[Soft Switch]: There is a configuration window, opens once an hour, ' +
        'only during which the cube will respond to mode switch. ' +
        'Change will be scheduled to be run when the window opens next time. ' +
        'You can also put down the cube to have it rest for a little bit (e.g. 10s), ' +
        'then pick up and shake it, ' +
        'this wakeup behavior will make the window open sooner sometimes. ' +
        'Otherwise, you may open lid and click LINK button once to make the cube respond immediately. ' +
        '[Hard Switch]: Open lid and click LINK button 5 times to toggle between action_mode and scene_mode'
      ),
    /* Actions */
    e.angle('action_angle'),
    e.cube_side('action_from_side'),
    e.cube_side('action_side'),
    e.cube_side('action_to_side'),
    e.cube_side('side').withDescription('Destination side of action'),
    e.cube_side('side_up').withDescription('Upfacing side of current scene'),
    e.action([
      'shake',
      'wakeup',
      'fall',
      'tap',
      'slide',
      'flip180',
      'flip90',
      'hold',
      'side_up',
      'rotate_left',
      'rotate_right',
    ]),
  ],
  /**
   * 1. write to necessary cluster/attributes 
   * 2. request the user to click LINK button or shake the device
   *      - during device join: 
   *            the click will trigger the device to report device metadata
   *              (e.g. battery, voltage, temperature, outage count ...)
   *            then we can populate the exposes tab with data
   *      - during device reconfigure: 
   *            a click makes the device respond to write command in step 1. 
   *            write will timeout otherwise. 
   */
  configure: async (device, coordinatorEndpoint, logger) => {
    const isNewJoin = !device.meta.hasOwnProperty('configured');
    const endpoint = device.getEndpoint(1);
    const flagRequireClick = () => globalStore.putValue(device, 'requireClick', true);;
    const writeToDevice = async () => {
      await endpoint.write('aqaraOpple', { mode: 1 }, manufacturerOptions.xiaomi); // attr: 0x09
      await endpoint.write('aqaraOpple',
        {
          0x00ff: {
            value: [0x45, 0x65, 0x21, 0x20, 0x75, 0x38, 0x17, 0x69, 0x78,
              0x53, 0x89, 0x51, 0x13, 0x16, 0x49, 0x58],
            type: 0x41
          }
        }
        , manufacturerOptions.xiaomi
      );
    };
    const requestUserToClick = () => {
      const sendRequest = () => logger.warn('Click LINK OR shake the device to complete the setup!');
      setTimeout(sendRequest, 1000);
      return new Promise((resolve, reject) => {
        // wait and periodically notify the user to click LINK, 
        //       reject if no click is detected when the wait is over.
        let count = 7;
        const interval = setInterval(async () => {
          if (!globalStore.getValue(device, 'requireClick')) {
            clearInterval(interval);
            logger.info('GREAT JOB! YOU MADE IT!')
            await sleep(4200);
            return resolve(null);
          }

          if (--count < 0) {
            return reject("User interaction timed out, open lid and click LINK if shaking didn't work.");
          }

          sendRequest();
        }, 5000);
      });
    }

    // device join
    if (isNewJoin) {
      await writeToDevice();
      flagRequireClick();
      try {
        await requestUserToClick();
      } catch (reason) {
        logger.warn(reason);
        await sleep(5000);
        throw (new Error(reason));
      }
    }
    // device reconfigure
    else {
      flagRequireClick();
      try {
        await requestUserToClick();
      } catch (reason) {
        logger.warn(reason);
        await sleep(5000);
        throw (new Error(reason));
      }
      try {
        await writeToDevice();
      } catch (err) {
        // very rarely write will timeout, 
        // but device works as expected
      }
    }
  },
};

module.exports = definition;
