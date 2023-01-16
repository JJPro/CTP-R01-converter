/**
  # MAC ADDR: 54ef4410006a4157

  # Two Modes
 
  ## Scene Mode
   - rotate
   - shake
   - hold
   - side up
   - trigger after one-min inactivity
 
  ## Action Mode
   - slide
   - rotate
   - tap twice
   - flip90, flip180
   - shake
   - trigger after one-min inactivity

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
const ota = require('zigbee-herdsman-converters/lib/ota');

const e = exposes.presets;
const ea = exposes.access;

const manufacturerOptions = {
  xiaomi: {
    manufacturerCode: herdsman.Zcl.ManufacturerCode.LUMI_UNITED_TECH,
    disableDefaultResponse: true,
  },
};

const ops_mode_key = 0x0148;

const ops_mode_lookup = { 0: 'action_mode', 1: 'scene_mode' };
const ops_mode_reverse_lookup = {action_mode: 0, scene_mode: 1};

const aqara_opple = {
  cluster: 'aqaraOpple',
  type: ['attributeReport', 'readResponse'],
  options: (definition) => [
    ...xiaomi.numericAttributes2Options(definition),
    exposes.enum('operation_mode', ea.ALL, ['scene_mode', 'action_mode']),
  ],
  convert: (model, msg, publish, options, meta) => {
    console.debug('>>> fq.aqaraOpple >> convert()');
    const state = xiaomi.numericAttributes2Payload(
      msg,
      meta,
      model,
      options,
      msg.data
    );

    // basic data reading (including operation_mode -- 155)
    if (msg.data.hasOwnProperty(247)) {
      const dataObject247 = xiaomi.buffer2DataObject(
        meta,
        model,
        msg.data[247]
      );
      state.operation_mode = ops_mode_lookup[dataObject247[155]];
      console.debug('>>> \t data247', dataObject247);
      console.debug('>>> \t operation_mode is', state.operation_mode);
      // Time to run scheduled tasks

      // debug
      state.data247 = new Date().toTimeString();
      console.log('>>>> state', state);

    }
    // hard switch of operation mode
    else if (msg.data.hasOwnProperty(328)) {
      console.debug('>>> \t data328');
      state.operation_mode = ops_mode_lookup[msg.data[328]];
    } else if (msg.data.hasOwnProperty('mode')) {
      console.debug('>>> \t data/mode');
      state.operation_mode = ops_mode_lookup[msg.data['mode']];
    }
    // side_up attribute report
    else if (msg.data.hasOwnProperty(329)) {
      console.debug('>>> \t data329/side_up action');
      state.action = 'side_up';
      state.side_up = msg.data[329] + 1;
    } else {
      meta.logger.warn('>>> unknown aqaraOpple data');
      console.warn('>>> unknown aqaraOpple data', msg.data);
    }

    return state;
  },
};

const action_multistate = {
  ...fz.MFKZQ01LM_action_multistate,
  convert: (model, msg, publish, options, meta) => {
    if (meta.state.operation_mode === 'action_mode') {
      return fz.MFKZQ01LM_action_multistate.convert(
        model,
        msg,
        publish,
        options,
        meta
      );
    } else {
      const value = msg.data['presentValue'];
      let scene_action_multistate;
      if (value === 0) scene_action_multistate = { action: 'shake' };
      else if (value === 2) scene_action_multistate = { action: 'wakeup' };
      else if (value === 4) scene_action_multistate = { action: 'hold' };
      else if (value >= 1024)
        scene_action_multistate = { action: 'side_up', side_up: value - 1023 };

      return scene_action_multistate;
    }
  },
};

const operation_mode = {
  key: ['operation_mode'],
  convertSet: async (entity, key, value, meta) => {
    await entity.write(
      'aqaraOpple',
      { [ops_mode_key]: { value: ops_mode_reverse_lookup[value], type: 0x20 } },
      manufacturerOptions.xiaomi
    );
    console.log('>>> setting ops_mode success');
    return { state: { operation_mode: value } };
  },
  convertGet: async (entity, key, meta) => {
    await entity.read('aqaraOpple', [ops_mode_key], manufacturerOptions.xiaomi);
  },
};

const definition = {
  zigbeeModel: ['lumi.remote.cagl02'],
  model: 'CTP-R01',
  vendor: 'Xiaomi',
  description: 'Aqara magic cube T1 Pro',
  meta: { battery: { voltageToPercentage: '3V_2850_3000' } },
  ota: ota.zigbeeOTA,
  fromZigbee: [
    aqara_opple,
    action_multistate,
    fz.MFKZQ01LM_action_analog,
  ],
  toZigbee: [operation_mode],
  exposes: [
    /* Device Info */
    e.battery(),
    e.battery_voltage(),
    e.device_temperature(),
    e.power_outage_count(false),
    exposes
      .enum('operation_mode', ea.ALL, ['scene_mode', 'action_mode'])
      .withDescription(
        'Soft Switching: There is a configuration window, once in an hour, only during which the cube will respond to mode switching command. Soft switching will schedule the command to run when the window opens next time. You can also hold the device and keep shaking it, which will keep it awake and probably speed-up the process. Otherwise, you can open the lid and click the LINK button once to make it respond immediately.\n' +
          'Hard Switching: Open lid and click LINK button 5 times to toggle between action_mode and scene_mode'
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
};

module.exports = definition;
