import { redis as redisConfig, jwtSecret } from '../../config'
import _ from 'lodash'
const dgram = require('dgram');
const Redis = require('ioredis')

const redis = new Redis(redisConfig)
const sub = new Redis(redisConfig)
const pub = new Redis(redisConfig)
// import socketJwt from 'socketio-jwt'
const NODE_COUNT_KEY = 'rosListeners'
const NODES_INFO_KEY = 'nodes'

//error codes
const CONNECTION_ERROR = -1

//dgram
const udp_server = dgram.createSocket('udp4');

udp_server.on('error', (err) => {
    console.log(`server error:\n${err.stack}`);
    udp_server.close();
});

udp_server.on('message', (content, rinfo) => {
    console.log(`server got: ${content} from ${rinfo.address}:${rinfo.port}`);
    const content_json = JSON.parse(content);
    const event = content_json.event;
    const data = content_json.data;
    switch(event) {
        case 'arm':
            onArm(data);
            break;
        case 'land':
            onLand(data);
            break;
        case 'takeoff':
            onTakeOff(data);
            break;
        case 'cmd_vel':
            onCmdVel(data);
            break;
        default:
            console.log("Missing or not a valid event.")
    }
    udp_server.send(content, rinfo.port, rinfo.address, (err) => {
        console.log(err);
    });
});

udp_server.on('listening', () => {
    const address = udp_server.address();
    console.log(`server listening ${address.address}:${address.port}`);
});

export default udp_server;


const onLand = (msg) => {
    if (!msg.copterId) {
        return
    }
    let { latitude, longitude } = msg
    pub.publish(`/${msg.copterId}`, JSON.stringify({ cmd: 'LAND', latitude, longitude, altitude: 0 }))
        .then(() => console.log('published'))
}
const onTakeOff = (msg) => {
    console.log('Recieved arm cmd', msg, msg.copterId)
    if (!msg.copterId) {
        return
    }
    let { latitude, longitude, altitude } = msg
    pub.publish(`/${msg.copterId}`, JSON.stringify({ cmd: 'TAKEOFF', latitude, longitude, altitude }))
        .then(() => console.log('published'))
}
const onArm = (msg) => {
    console.log('Recieved arm cmd', msg, msg.copterId)
    if (!msg.copterId) {
        return
    }
    pub.publish(`/${msg.copterId}`, JSON.stringify({ cmd: 'ARM' }))
        .then(() => console.log('published'))
}
const onCmdVel = (msg) => {
    console.log('Recieved cmd_vel', msg)
    if (!msg.copterId) {
        return
    }
    let { linear, angular } = msg
    pub.publish(`/${msg.copterId}/cmd_vel`, JSON.stringify({ linear, angular }))
        .then(() => console.log('published'))
}