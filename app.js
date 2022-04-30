//!
//! Modules
//!

const config = require('./config.json')

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
    Network['latency'] = await si.inetLatency(config.ping)


    //? CPU Statistics
    osUtils.cpuUsage(v => CPU['usage'] = (v * 100).toFixed(2))
    CPU.model['simple'] = os.cpus()[0].model.trim()
    CPU.model['advanced'] = await si.cpu().then(data => data)
    CPU['temperature'] = await si.cpuTemperature().then(data => data)
    CPU['load'] = await si.currentLoad().then(data => data)


    //? Memory Statistics
    Memory['free'] = parseFloat((os.freemem() / 1000000000).toFixed(2))
    Memory['total'] = parseFloat((os.totalmem() / 1000000000).toFixed(2))
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



    //!
    //! DNS Registration
    //!

    

} setInterval(Loop, 1000 * 120), Loop()