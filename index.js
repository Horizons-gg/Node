//!
//! Modules
//!

const fs = require('fs')
const dns = require('dns')
const ping = require('ping')
const { spawn } = require('child_process')

const config = JSON.parse(fs.readFileSync('./config.json'))

const os = require('os')
const osUtils = require('os-utils')
const si = require('systeminformation')


let IPv4 = 'xxx.xxx.xxx.xxx'
let Network = {}
let CPU = { model: {} }
let Memory = {}
let System = {}
let Disk = {}



//!
//! Web Config
//!

const express = require('express')
const app = express()

app.listen(config.port, () => console.log(`Listening on port ${config.port}`))


//?
//? Routes
//?

app.get('/', (req, res) => {
    res.json({
        IPv4: IPv4,
        Location: config.location,
        Network: Network,
        CPU: CPU,
        Memory: Memory,
        System: System,
        Disk: Disk
    })
})



//!
//! Event Loop
//!

async function Loop() {

    //? Public IPv4 Address
    IPv4 = await fetch('https://api.ipify.org?format=json')
        .then(res => res.json())
        .then(json => json.ip)


    //? Latency
    Network['latency'] = Math.floor((await ping.promise.probe(config.ping || '1.1.1.1')).time)


    //? CPU Statistics
    osUtils.cpuUsage(v => CPU['usage'] = (v * 100).toFixed(2))
    CPU.model['simple'] = os.cpus()[0].model.trim()
    CPU.model['advanced'] = await si.cpu().then(data => data)
    CPU['temperature'] = await si.cpuTemperature().then(data => data)
    CPU['load'] = await si.currentLoad().then(data => data)


    //? Memory Statistics
    Memory['used'] = parseFloat(((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024).toFixed(2))
    Memory['total'] = parseFloat((os.totalmem() / 1024 / 1024 / 1024).toFixed(2))
    Memory['information'] = await si.mem().then(data => data)
    Memory['layout'] = await si.memLayout().then(data => data)


    //? System Statistics
    System['uptime'] = new Date(osUtils.sysUptime() * 1000).toISOString().substr(11, 8)
    System['system'] = await si.system().then(data => data)
    System['bios'] = await si.bios().then(data => data)
    System['motherboard'] = await si.baseboard().then(data => data)
    System['chassis'] = await si.chassis().then(data => data)


    // Disk Statistics
    Disk['layout'] = await si.diskLayout().then(data => data)
    Disk['devices'] = await si.blockDevices().then(data => data)
    Disk['usage'] = await si.fsSize().then(data => data)



    //!
    //! Remove Vulnerable Information
    //!

    //? System
    delete System.system.serial
    delete System.system.uuid
    delete System.system.sku

    delete System.bios.serial

    delete System.motherboard.serial
    delete System.motherboard.assetTag

    delete System.chassis.serial
    delete System.chassis.assetTag
    delete System.chassis.sku


    //? Memory
    Memory.layout.forEach((stick, index) => {
        delete stick.partNum
        delete stick.serialNum
        Memory.layout[index] = stick
    })


    //? Disk
    Disk.layout.forEach((disk, index) => {
        delete disk.device
        delete disk.name
        delete disk.serialNum
        Disk.layout[index] = disk
    })

    Disk.devices.forEach((device, index) => {
        delete device.uuid
        delete device.serial
        Disk.devices[index] = device
    })



    // //!
    // //! Dynamic DNS
    // //!

    // if (config.cloudflare.record) {
    //     const ddns = require("cloudflare-dynamic-dns")

    //     const route = {
    //         auth: {
    //             email: config.cloudflare.email,
    //             key: config.cloudflare.key
    //         },
    //         recordName: `${config.cloudflare.record}.${config.cloudflare.zone}`,
    //         zoneName: config.cloudflare.zone
    //     }

    //     const wildcard = {
    //         auth: {
    //             email: config.cloudflare.email,
    //             key: config.cloudflare.key
    //         },
    //         recordName: `*.${config.cloudflare.record}.${config.cloudflare.zone}`,
    //         zoneName: config.cloudflare.zone
    //     }

    //     ddns.update(route, (err) => {
    //         if (!err) return
    //         console.log("An error occurred:")
    //         console.log(err)
    //     })

    //     ddns.update(wildcard, (err) => {
    //         if (!err) return
    //         console.log("An error occurred:")
    //         console.log(err)
    //     })
    // }



    //!
    //! Dynamic Firewall
    //!

    // if (config.firewall) {

    //     let Whitelist = []

    //     config.firewall.forEach((domain, index) => {
    //         dns.lookup(domain, (err, address, family) => {
    //             if (err) console.log(`Failed to lookup "${domain}":\n`, err, '\n')
    //             if (address) Whitelist.push(`${address}/32`)
    //             if (index >= config.firewall.length - 1) SetFirewall()
    //         })
    //     })

    //     function SetFirewall() {
    //         spawn('powershell', [`netsh advfirewall firewall set rule name="Active Directory Domain Controller - LDAP (UDP-In)" new remoteip=${Whitelist.join(',')}`]).stdout.on('data', data => {
    //             data = data.toString('utf8')
    //             console.log(data)
    //         })
    //     }

    // }


}
setInterval(Loop, 1000 * 60), Loop()