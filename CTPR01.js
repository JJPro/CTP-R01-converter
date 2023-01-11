/**
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
const e = exposes.presets;
const ea = exposes.access;

/**
 * data types: 
 *  boolean: 0x10
 *  byte: 0x08 (FF)
 *  unsigned byte integer: 0x20 (FF)
 */

const manufacturerOptions = {
  xiaomi: {
    manufacturerCode: herdsman.Zcl.ManufacturerCode.LUMI_UNITED_TECH,
    disableDefaultResponse: true,
  },
};

const ops_mode_key = 0x0148;

const ops_mode_lookup = { 0: 'action_mode', 1: 'scene_mode' };

const aqara_opple = {
  cluster: 'aqaraOpple',
  type: ['attributeReport', 'readResponse'],
  options: (definition) => [
    ...xiaomi.numericAttributes2Options(definition),
    exposes.enum('operation_mode', ea.ALL, ['scene_mode', 'action_mode']),
  ],
  convert: (model, msg, publish, options, meta) => {
    // let ops_mode;
    if (msg.data.hasOwnProperty('328') || msg.data.hasOwnProperty('155')) {
      meta.state.operation_mode = ops_mode_lookup[msg.data[328] || msg.data[155]];
    }
    // if (msg.data.hasOwnProperty('328')) {
    //   meta.state.operation_mode = ops_mode_lookup[msg.data[328]];
    // }

    return {
      ...xiaomi.numericAttributes2Payload(msg, meta, model, options, msg.data),
      // operation_mode: ops_mode,
      action: 'side_up',
      side_up: msg.data['329'] + 1,
    };
  },
};

const action_multistate = {
  ...fz.MFKZQ01LM_action_multistate,
  convert: (model, msg, publish, options, meta) => {
    // console.debug('>>>> fz >> action_multistate >> meta', meta);
    console.log('>>>> fz >> action_multistate >> meta.state', meta.state);
    // console.log(
    //   '>>>> fz >> action_multistate >> meta.operation_mode',
    //   meta.operation_mode
    // );
    // console.debug('>>>> msg.data', msg.data);
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
    const lookup = { action_mode: 0, scene_mode: 1 };
    console.log('>>>> convertSet()');
    await entity.write(
      'aqaraOpple',
      { [ops_mode_key]: { value: lookup[value], type: 0x20 } },
      manufacturerOptions.xiaomi
    );
    console.log('>>> setting ops_mode success');
    return { state: { operation_mode: value } };
  },
  convertGet: async (entity, key, meta) => {
    console.log('>>>> convertGet()');
    const data = await entity.read(
      'aqaraOpple',
      [ops_mode_key],
      manufacturerOptions.xiaomi
    );
    console.log('>>>> convert read data', data);
    return {state: {operation_mode: ops_mode_lookup[data[328]]}};
  },
};

const definition = {
  zigbeeModel: ['lumi.remote.cagl02'],
  model: 'CTP-R01',
  vendor: 'Xiaomi',
  description: 'Aqara magic cube T1 Pro',
  meta: { battery: { voltageToPercentage: '3V_2850_3000' } },
  fromZigbee: [aqara_opple, action_multistate, fz.MFKZQ01LM_action_analog],
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
        'Press LINK button 5 times to toggle between action_mode and scene_mode'
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
   * 
   * @param {Device} device device.d.ts
   * @param {*} coordinatorEndpoint 
   * @param {*} logger 
   */
  configure: async (device, coordinatorEndpoint, logger) => {
    console.log('>>>> configure()');
    const endpoint = device.getEndpoint(1);
    const data = await endpoint.read('aqaraOpple', [ops_mode_key], {
      manufacturerCode: 0x115f,
    });

    const operation_mode = data[ops_mode_key];

    console.log('>>>> 初始化是ops_mode', operation_mode);
    if (!operation_mode || operation_mode == 0xff) {
      await endpoint.write(
        'aqaraOpple',
        { [ops_mode_key]: { value: 0, type: 0x20 } },
        manufacturerOptions.xiaomi
      );
    }
    // console.log('>>>> \t write to aqaraOpple.operation_mode data point');
    // console.log('>>>> device', device);
    // device.meta.operation_mode = ops_mode_lookup[0];
    // device.save();
    // return { state: { operation_mode: ops_mode_lookup[0] } };
  },
};

module.exports = definition;
