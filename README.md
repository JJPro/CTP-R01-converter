# Aqara Magic Cube T1 Pro External Converter 
[![Sponsor](https://img.shields.io/badge/Sponsor-ko--fi-ff5e5b)](https://ko-fi.com/jjpro)
[![Sponsor](https://img.shields.io/badge/Sponsor-patreon-brightgreen)](https://patreon.com/jjpro)

This converter is officially merged into zigbee2mqtt, thus being archived. 

But there are information, e.g. action list, demos & nodeRED flows in the wiki, that people might find interesting, so this repo will continue to exist. 

---

A PR based on this converter is WIP, code will be migrated to the PR when this converter proves solid. 

PRs: 
- Koenkk/zigbee2mqtt.io#1833
- Koenkk/zigbee-herdsman-converters#5367

#### Issue Report & Feedback

 - Issue Report: [Issues](https://github.com/JJPro/CTP-R01-converter/issues)
 - Feedbacks: [Discussions](https://github.com/JJPro/CTP-R01-converter/discussions)

## [Wiki - Guide](https://github.com/JJPro/CTP-R01-converter/wiki)

## How to Use

1. Download `CTPR01.js` and put it in the same directory as Zigbee2MQTT `configuration.yaml` file. 
2. Enable the external converter by adding the following to your Zigbee2MQTT `configuration.yaml`. 
    ```yml
    external_converters:
      - CTPR01.js
    ```
3. Restart Zigbee2MQTT and pairing your device.

## How to Upgrade

If you see `#requiresRemoval` in any of the commit messages since your last download/pull, you need to 
- remove device from the network 
- restart Zigbee2MQTT (restart Docker container or the machine it runs on, not through Zigbee2MQTT frontend)
- restart HomeAssistant

Otherwise, just restart Zigbee2MQTT via its frontend is fine.


## SUPPORT MY WORK

If the converter is helpful, and want to thank me for my work, consider buying me a coffee or another cube for more fun and testing. ❤️

**Thank You:**

<p>
  &nbsp;&nbsp;&nbsp;<a href="https://ko-fi.com/jjpro">
    <img src="assets/124lxlp-0.webp" width=200 />
  </a>
</p>
<p>
  &nbsp;&nbsp;&nbsp;<a href="https://patreon.com/jjpro">
    <img src="assets/124lx7c-0.jpg" width=200 />
  </a>
</p>