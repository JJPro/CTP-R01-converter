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

const e = exposes.presets;
const ea = exposes.access;

const manufacturerOptions = {
  xiaomi: {
    manufacturerCode: herdsman.Zcl.ManufacturerCode.LUMI_UNITED_TECH,
    disableDefaultResponse: true,
  },
};

const op_mode_attr = 0x0148;
const op_mode_lookup = { 0: 'action_mode', 1: 'scene_mode' };
const op_mode_reverse_lookup = { action_mode: 0, scene_mode: 1 };

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
      // execute soft switch of operation_mode
      if (meta.state.mode_switching_scheduler) {
        const { callback, new_mode } = meta.state.mode_switching_scheduler;
        await callback();
        payload.operation_mode = new_mode;
        payload.mode_switching_scheduler = null;
      } else {
        const dataObject247 = xiaomi.buffer2DataObject(
          meta,
          model,
          msg.data[247]
        );
        payload.operation_mode = op_mode_lookup[dataObject247[155]];
      }
    }
    // detected hard switch of operation_mode (attribute 0x148[328])
    else if (msg.data.hasOwnProperty(328)) {
      payload.operation_mode = op_mode_lookup[msg.data[328]];
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
          [op_mode_attr]: {
            value: op_mode_reverse_lookup[value],
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
        mode_switching_scheduler: {
          callback,
          new_mode: value,
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
  fromZigbee: [aqara_opple, action_multistate, action_analog],
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
  configure: async (device, coordinatorEndpoint, logger) => {
    const endpoint = device.getEndpoint(1);
    await endpoint.write(
      'aqaraOpple',
      { mode: 1 },
      { manufacturerCode: 0x115f }
    );
  },
};

module.exports = definition;
