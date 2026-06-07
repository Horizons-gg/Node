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
let OS = {}
let Processes = []
let Users = []
let Docker = []
let Connections = {}



//!
//! Web Config
//!

const express = require('express')
const app = express()

app.listen(config.port, () => console.log(`Listening on port ${config.port}`))

app.use(express.static('public'))

//?
//? Routes
//?

app.get('/api', (_req, res) => {
    res.json({
        IPv4: IPv4,
        Location: config.location,
        Network: Network,
        CPU: CPU,
        Memory: Memory,
        System: System,
        Disk: Disk,
        OS: OS,
        Processes: Processes,
        Users: Users,
        Docker: Docker,
        Connections: Connections
    })
})



//!
//! Event Loop
//!

async function Loop() {

    //? Public IPv4 Address
    try {
        IPv4 = await fetch('https://api.ipify.org?format=json')
            .then(res => res.json())
            .then(json => json.ip)
    } catch (e) { console.error('IPv4:', e.message) }


    //? Latency
    try {
        Network['latency'] = Math.floor((await ping.promise.probe(config.ping || '1.1.1.1')).time)
    } catch (e) { console.error('Latency:', e.message) }

    //? Network Interfaces & I/O
    try {
        const ifaces = await si.networkInterfaces()
        Network['interfaces'] = (Array.isArray(ifaces) ? ifaces : [ifaces]).filter(i => !i.virtual).map(i => ({
            name: i.ifaceName || i.iface,
            ip4: i.ip4,
            ip6: i.ip6,
            mac: i.mac,
            speed: i.speed > 100000 ? null : i.speed,
            type: i.type,
            operstate: i.operstate
        }))
    } catch (e) { console.error('Network interfaces:', e.message) }
    try {
        Network['stats'] = (await si.networkStats()).map(s => ({
            iface: s.iface,
            rx_sec: s.rx_sec,
            tx_sec: s.tx_sec,
            rx_bytes: s.rx_bytes,
            tx_bytes: s.tx_bytes
        }))
    } catch (e) { console.error('Network stats:', e.message) }


    //? CPU Statistics
    try { osUtils.cpuUsage(v => CPU['usage'] = (v * 100).toFixed(2)) } catch (e) { console.error('CPU usage:', e.message) }
    try { CPU.model['simple'] = os.cpus()[0].model.trim() } catch (e) { console.error('CPU model:', e.message) }
    try { CPU.model['advanced'] = await si.cpu() } catch (e) { console.error('CPU advanced:', e.message) }
    try { CPU['temperature'] = await si.cpuTemperature() } catch (e) { console.error('CPU temp:', e.message) }
    try { CPU['load'] = await si.currentLoad() } catch (e) { console.error('CPU load:', e.message) }


    //? Memory Statistics
    try {
        Memory['used'] = parseFloat(((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024).toFixed(2))
        Memory['total'] = parseFloat((os.totalmem() / 1024 / 1024 / 1024).toFixed(2))
    } catch (e) { console.error('Memory basic:', e.message) }
    try { Memory['information'] = await si.mem() } catch (e) { console.error('Memory info:', e.message) }
    try {
        Memory['layout'] = (await si.memLayout()).map(d => ({
            size: d.size, bank: d.bank, ecc: d.ecc, clockSpeed: d.clockSpeed,
            formFactor: d.formFactor, manufacturer: d.manufacturer,
            voltageConfigured: d.voltageConfigured, voltageMin: d.voltageMin, voltageMax: d.voltageMax
        }))
    } catch (e) { console.error('Memory layout:', e.message) }


    //? System Statistics
    try { System['uptime'] = new Date(osUtils.sysUptime() * 1000).toISOString().slice(11, 19) } catch (e) { console.error('Uptime:', e.message) }
    try { const d = await si.system();     System['system']      = { manufacturer: d.manufacturer, model: d.model, version: d.version, virtual: d.virtual } } catch (e) { console.error('System:', e.message) }
    try { const d = await si.bios();       System['bios']        = { vendor: d.vendor, version: d.version, releaseDate: d.releaseDate, revision: d.revision } } catch (e) { console.error('BIOS:', e.message) }
    try { const d = await si.baseboard();  System['motherboard'] = { manufacturer: d.manufacturer, model: d.model, version: d.version, memMax: d.memMax, memSlots: d.memSlots } } catch (e) { console.error('Motherboard:', e.message) }
    try { const d = await si.chassis();    System['chassis']     = { manufacturer: d.manufacturer, model: d.model, type: d.type, version: d.version } } catch (e) { console.error('Chassis:', e.message) }


    //? OS Info
    try {
        const osInfo = await si.osInfo()
        OS = {
            platform: osInfo.platform,
            distro: osInfo.distro,
            release: osInfo.release,
            kernel: osInfo.kernel,
            arch: osInfo.arch,
            hostname: osInfo.hostname,
            fqdn: osInfo.fqdn
        }
    } catch (e) { console.error('OS info:', e.message) }


    //? Disk Statistics
    try {
        Disk['layout'] = (await si.diskLayout()).map(d => ({
            type: d.type, vendor: d.vendor, size: d.size, interfaceType: d.interfaceType,
            smartStatus: d.smartStatus, temperature: d.temperature, firmwareRevision: d.firmwareRevision
        }))
    } catch (e) { console.error('Disk layout:', e.message) }
    try {
        Disk['devices'] = (await si.blockDevices()).map(d => ({
            name: d.name, identifier: d.identifier, type: d.type, fsType: d.fsType,
            mount: d.mount, size: d.size, physical: d.physical, label: d.label,
            model: d.model, removable: d.removable, protocol: d.protocol
        }))
    } catch (e) { console.error('Disk devices:', e.message) }
    try { const io = await si.disksIO(); if (io) Disk['io'] = io } catch (e) { console.error('Disk IO:', e.message) }

    try {
        const drives = await si.fsSize()
        Disk['usage'] = drives.map(d => ({
            mount: d.mount,
            type: d.type,
            total: parseFloat((d.size / 1024 / 1024 / 1024).toFixed(2)),
            used: parseFloat((d.used / 1024 / 1024 / 1024).toFixed(2)),
            available: parseFloat(((d.size - d.used) / 1024 / 1024 / 1024).toFixed(2)),
            use: d.use
        }))
    } catch (e) { console.error('Disk usage:', e.message) }



    //? Processes (top 10 by CPU, fallback sort by memory)
    try {
        const procs = await si.processes()
        Processes = procs.list
            .sort((a, b) => b.cpu - a.cpu || b.mem - a.mem)
            .slice(0, 10)
            .map(p => ({ pid: p.pid, name: p.name, cpu: p.cpu, mem: p.mem, state: p.state }))
    } catch (e) { console.error('Processes:', e.message) }


    //? Logged-in Users
    try { Users = await si.users() } catch (e) { console.error('Users:', e.message) }


    //? Docker Containers
    try { Docker = await si.dockerContainers() } catch (e) { console.error('Docker:', e.message) }


    //? Network Connections (summarised by named state only)
    try {
        const conns = await si.networkConnections()
        const named = ['ESTABLISHED', 'LISTEN', 'CLOSE_WAIT', 'TIME_WAIT', 'FIN_WAIT1', 'FIN_WAIT2', 'CLOSING', 'LAST_ACK', 'SYN_SENT', 'SYN_RECV']
        const states = {}
        conns.forEach(c => { if (named.includes(c.state)) states[c.state] = (states[c.state] || 0) + 1 })
        Connections = { total: conns.length, states }
    } catch (e) { console.error('Connections:', e.message) }





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