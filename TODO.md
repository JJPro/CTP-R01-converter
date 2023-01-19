# TODO: 


- ✅Mode Switching 
    - ✅save the changing command until receives opple.xf7 report. 
        - use node-red to send notifications when event is received. 
    - ✅remove refresh button
        - try ea.SET enum options
    - ✅notification to frontend 
- ✅Inactivity after one minute (schedule task to run after one minute timeout, with debounce)
- ✅configure 
    1. ✅configure 
        - write aqaraOpple.0x00ff, 这是啥?
    2. ~~handle genPowerConf.0x0021~~
- ✅OTA
    - ~~handle/expose genBasic.application_version~~

Converter Repo: 
- ✅change var mode_switching.... to opModeChange
- ✅change all vars to camelCase
- ✅use globalStore for mode switching task 
- ✅fix device appVersion meta
- ✅Add demo gifs for 
    - node-red events one-min inactivity 
    - pairing process 
    - mode switcher
- ✅link PR(s) in readme 
- ✅share sniff log files in repo

PR: 
- ✅point out that `endpoint.write('aqaraOpple', {mode: 1}, ..)` is copied from other aqara converters. but I don't know what it does to the cube. 
- ✅post sniff file in PR 

Continue the consersation in issue page: 
- ✅link to this repo
- ✅link both PRs






# REF

## Data Types

| Data Type             | indicator | default value |
| --------------------- | --------- | ------------- |
| boolean               | 0x10      | -             |
| byte                  | 0x08      | 0xff          |
| unsigned byte integer | 0x20      | 0xff          |


## Sniff

- operation_mode attrs
  - fz 
    - regular attr report (aqaraOpple >> 0xf7(dataObject247) >> 0x9b[155])
    - attr report on hard switch (aqaraOpple >> 0x148[328])
  - tz 
    - aqaraOpple >> 0x148

- sniffer during set up: 
    - FROM - report attributes (0x0a)
        - ep: 1
        - cluster: basic (0x0000)
        - manufacturer specific: false 
        - disable default response: true 
        - attributes: 
            - {
                model identifier: 'lumi.remote.cagl02', 
                application version: 0x19 | type: 0x20
            }
    - FROM - report attributes (0x0a)
        - ep: 1
        - cluster: power configuration (0x0001)
        - manufacturer specific: false 
        - disable default response: true 
        - attributes: 
            - battery voltage
    - FROM - report attributes (0x0a)
        - ep: 1
        - cluster: manu specific (0xfcc0) aqaraOpple
        - manufacturer specific: true
        - disable default response: true 
        - attributes: 0x00f7[247]
    - __TO - read attributes (0x00)__
        - ep: 1
        - cluster: power configuration (0x0001)
        - manufacturer specific: false 
        - disable default response: true 
        - attribute: battery percentage (0x0021)
    - FROM - read resp (0x01)
        - status record: unsupported attribute
    - __TO - write attributes (0x02)__
        - ep: 1
        - cluster: 0xfcc0 aqaraOpple
        - manu specific: true 
        - disable default response: true 
        - attributes: 
            - {0x00ff[255]: 1045652120753817697853895113164958} (changes for each pairing attempt)
    - FROM - write resp (0x04)
        - ep .. disable default response
        - status: Success (0x00)
    - FROM - report attributes (0x0a)
        - ep: 1
        - cluster: manu specific (0xfcc0) aqaraOpple
        - manufacturer specific: true
        - disable default response: true 
        - attributes: 
            - {0x00ff[255]: c6:bc:4d:14:ef:49:1e:44:99:4f:51:f9:74:20:2d:4d}
    - FROM - report attributes (0x0a)
        - ep: 1
        - cluster: manu specific (0xfcc0) aqaraOpple
        - manufacturer specific: false
        - disable default response: true 
        - attributes: 
            - {0x0148[328]: 1}
    - FROM - report attributes (0x0a)
        - ep: 1
        - cluster: manu specific (0xfcc0) aqaraOpple
        - manufacturer specific: true
        - disable default response: true 
        - attributes: 0x00f7[247]

## READING MATERIALS
- [x] Understand Zigbee network https://www.zigbee2mqtt.io/advanced/zigbee/01_zigbee_network.html
  - [x] understand binding: 
    - https://devzone.nordicsemi.com/f/nordic-q-a/55365/creating-a-binding-locally-on-a-zigbee-device
    - https://devzone.nordicsemi.com/f/nordic-q-a/54459/problem-with-binding-in-zigbee-devices
    - https://infocenter.nordicsemi.com/index.jsp?topic=%2Fsdk_tz_v3.2.0%2Fzigbee_multi_sensor_example.html&anchor=zigbee_multi_sensor_example_test
- [x] [GET OTA URL](https://www.zigbee2mqtt.io/advanced/more/tuya_xiaomi_ota_url.html)
- [x] Follow this [page](https://www.zigbee2mqtt.io/advanced/support-new-devices/01_support_new_devices.html#_3-adding-converter-s-for-your-device) to create PR



## CODE FOR REF

### FP1
```js
{
    zigbeeModel: ['lumi.motion.ac01'],
    model: 'RTCZCGQ11LM',
    vendor: 'Xiaomi',
    description: 'Aqara presence detector FP1 (regions not supported for now)',
    fromZigbee: [fz.aqara_opple],
    toZigbee: [tz.RTCZCGQ11LM_presence, tz.RTCZCGQ11LM_monitoring_mode, tz.RTCZCGQ11LM_approach_distance,
        tz.aqara_motion_sensitivity, tz.RTCZCGQ11LM_reset_nopresence_status],
    exposes: [e.presence().withAccess(ea.STATE_GET),
        exposes.enum('presence_event', ea.STATE, ['enter', 'leave', 'left_enter', 'right_leave', 'right_enter', 'left_leave',
            'approach', 'away']).withDescription('Presence events: "enter", "leave", "left_enter", "right_leave", ' +
            '"right_enter", "left_leave", "approach", "away"'),
        exposes.enum('monitoring_mode', ea.ALL, ['undirected', 'left_right']).withDescription('Monitoring mode with or ' +
            'without considering right and left sides'),
        exposes.enum('approach_distance', ea.ALL, ['far', 'medium', 'near']).withDescription('The distance at which the ' +
            'sensor detects approaching'),
        exposes.enum('motion_sensitivity', ea.ALL, ['low', 'medium', 'high']).withDescription('Different sensitivities ' +
            'means different static human body recognition rate and response speed of occupied'),
        exposes.enum('reset_nopresence_status', ea.SET, ['']).withDescription('Reset the status of no presence'),
        e.device_temperature(), e.power_outage_count()],
    configure: async (device, coordinatorEndpoint, logger) => {
        const endpoint = device.getEndpoint(1);
        await endpoint.read('aqaraOpple', [0x010c], {manufacturerCode: 0x115f});
        await endpoint.read('aqaraOpple', [0x0142], {manufacturerCode: 0x115f});
        await endpoint.read('aqaraOpple', [0x0144], {manufacturerCode: 0x115f});
        await endpoint.read('aqaraOpple', [0x0146], {manufacturerCode: 0x115f});
    },
    ota: ota.zigbeeOTA,
},
```

### ...mode
```js 
/** # TO ZigBee **/
RTCZCGQ11LM_monitoring_mode: {
    key: ['monitoring_mode'],
    convertSet: async (entity, key, value, meta) => {
        value = value.toLowerCase();
        const lookup = {'undirected': 0, 'left_right': 1};
        await entity.write('aqaraOpple', {0x0144: {value: lookup[value], type: 0x20}}, manufacturerOptions.xiaomi);
        return {state: {monitoring_mode: value}};
    },
    convertGet: async (entity, key, meta) => {
        await entity.read('aqaraOpple', [0x0144], manufacturerOptions.xiaomi);
    },
},
```
```js
case '324':
    if (['RTCZCGQ11LM'].includes(model.model)) {
        payload.monitoring_mode = {0: 'undirected', 1: 'left_right'}[value];
    }
    break;
```

### write raw data
```js
xiaomi_switch_power_outage_memory: {
    key: ['power_outage_memory'],
    convertSet: async (entity, key, value, meta) => {
        if (['SP-EUC01', 'ZNCZ04LM', 'ZNCZ12LM', 'ZNCZ15LM', 'QBCZ14LM', 'QBCZ15LM', 'SSM-U01', 'SSM-U02', 'DLKZMK11LM', 'DLKZMK12LM',
            'WS-EUK01', 'WS-EUK02', 'WS-EUK03', 'WS-EUK04', 'QBKG19LM', 'QBKG20LM', 'QBKG25LM', 'QBKG26LM',
            'QBKG31LM', 'QBKG34LM', 'QBKG38LM', 'QBKG39LM', 'QBKG40LM', 'QBKG41LM', 'ZNDDMK11LM', 'ZNLDP13LM',
            'WS-USC02', 'WS-USC04',
        ].includes(meta.mapped.model)) {
            await entity.write('aqaraOpple', {0x0201: {value: value ? 1 : 0, type: 0x10}}, manufacturerOptions.xiaomi);
        } else if (['ZNCZ02LM', 'QBCZ11LM', 'LLKZMK11LM'].includes(meta.mapped.model)) {
            const payload = value ?
                [[0xaa, 0x80, 0x05, 0xd1, 0x47, 0x07, 0x01, 0x10, 0x01], [0xaa, 0x80, 0x03, 0xd3, 0x07, 0x08, 0x01]] :
                [[0xaa, 0x80, 0x05, 0xd1, 0x47, 0x09, 0x01, 0x10, 0x00], [0xaa, 0x80, 0x03, 0xd3, 0x07, 0x0a, 0x01]];

            await entity.write('genBasic', {0xFFF0: {value: payload[0], type: 0x41}}, manufacturerOptions.xiaomi);
            await entity.write('genBasic', {0xFFF0: {value: payload[1], type: 0x41}}, manufacturerOptions.xiaomi);
        } else if (['ZNCZ11LM'].includes(meta.mapped.model)) {
            const payload = value ?
                [0xaa, 0x80, 0x05, 0xd1, 0x47, 0x00, 0x01, 0x10, 0x01] :
                [0xaa, 0x80, 0x05, 0xd1, 0x47, 0x01, 0x01, 0x10, 0x00];

            await entity.write('genBasic', {0xFFF0: {value: payload, type: 0x41}}, manufacturerOptions.xiaomi);
        } else {
            throw new Error('Not supported');
        }
        return {state: {power_outage_memory: value}};
    },
    convertGet: async (entity, key, meta) => {
        if (['SP-EUC01', 'ZNCZ04LM', 'ZNCZ12LM', 'ZNCZ15LM', 'QBCZ14LM', 'QBCZ15LM', 'SSM-U01', 'SSM-U02', 'DLKZMK11LM', 'DLKZMK12LM',
            'WS-EUK01', 'WS-EUK02', 'WS-EUK03', 'WS-EUK04', 'QBKG19LM', 'QBKG20LM', 'QBKG25LM', 'QBKG26LM',
            'QBKG31LM', 'QBKG34LM', 'QBKG38LM', 'QBKG39LM', 'QBKG40LM', 'QBKG41LM', 'ZNDDMK11LM', 'ZNLDP13LM',
            'WS-USC02', 'WS-USC04',
        ].includes(meta.mapped.model)) {
            await entity.read('aqaraOpple', [0x0201]);
        } else if (['ZNCZ02LM', 'QBCZ11LM', 'ZNCZ11LM'].includes(meta.mapped.model)) {
            await entity.read('aqaraOpple', [0xFFF0]);
        } else {
            throw new Error('Not supported');
        }
    },
},
```