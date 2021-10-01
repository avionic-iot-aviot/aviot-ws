import { redis as redisConfig, jwtSecret } from '../../config'
import redisAdapter from 'socket.io-redis'
import io from 'socket.io'
import _ from 'lodash'
const Redis = require('ioredis')

const redis = new Redis(redisConfig)
const sub = new Redis(redisConfig)
const pub = new Redis(redisConfig)
// import socketJwt from 'socketio-jwt'
const NODE_COUNT_KEY = 'rosListeners'
const NODES_INFO_KEY = 'nodes'

//error codes
const CONNECTION_ERROR = -1



export default (httpserver) => {
  const ws = io(httpserver, {
    log: false,
    agent: false,
    //origins: '*',
    transports: ['websocket', 'hstmlfile', 'xhr-polling', 'jsonp-polling', 'polling'],
    allowRequest: (req, callback) => {
      callback(null, true); // cross-origin requests will not be allowed
    },
    handlePreflightRequest: (req, res) => {
      res.writeHead(200, {
        "Access-Control-Allow-Origin": req.headers.origin || '*',
        "Access-Control-Allow-Methods": "GET,POST, PUT",
        "Access-Control-Allow-Credentials": true
      });
      res.end();
    }
  })
  //ws.set('origin', '*:*')
  ws.origins([
    '*'
  ])
  ws.adapter(redisAdapter(redisConfig))
  /*
  ws.use(socketJwt.authorize({
  secret: jwtSecret,
  timeout: 15000,
  handshake: true
}))
*/
  ws.on('connection', onConnection(ws))
}

const onConnection = (ws) => (socket) => {
  console.log('New user connected')
  // const userId = socket.decoded_token
  // console.log(userId)

  socket.on('connect_to_copter', connectToCopter(ws, socket))
  socket.on('cmd_vel', onCmdVel)
  socket.on('arm', onArm)
  socket.on('takeoff', onTakeOff)
  socket.on('disconnect_from_copter', disconnectFromCopter(ws, socket))
  socket.on('disconnect', onDisconnect(ws, socket))
  socket.on('land', onLand)
  socket.on('video_stream', onVideoStream)
  socket.on('video_room', onVideoRoom)
  socket.on('rtt_test', onRttTest)
  socket.on('fence', onFence)
  socket.on('mission', onMission)
  socket.on('servo', onServo)
  socket.on('mode', onMode)
  socket.on('stream_rate', onStreamRate)
}
const onRttTest = (msg) => {
  console.log(`rtt_test: ${msg.frontendId} ${Date.now()}`)
  pub.publish(`/${msg.copterId}/rtt_test`, JSON.stringify({ frontendId: msg.frontendId }))
}

const onVideoStream = (msg) => {
  console.log('Received video stream msg: ', msg)
  pub.publish(`/${msg.copterId}/streaming`, JSON.stringify({ action: msg.action }))
}
const onVideoRoom = (msg) => {
  console.log('Received video room msg: ', msg)
  pub.publish(`/${msg.copterId}/video_room`, JSON.stringify({ action: msg.action }))
}
const onFence = (msg) => {
  console.log('Recieved fence cmd', msg, msg.copterId)
  pub.publish(`/${msg.copterId}/fence`, JSON.stringify({ action: msg.action, data: msg.data }))
}
const onMission = (msg) => {
  console.log('Recieved mission cmd', msg, msg.copterId)
  pub.publish(`/${msg.copterId}/mission`, JSON.stringify({ action: msg.action, data: msg.data }))
}
const onServo = (msg) => {
  console.log('Recieved servo cmd', msg, msg.copterId)
  pub.publish(`/${msg.copterId}/servo`, JSON.stringify({ action: msg.action, data: msg.data }))
}
const onMode = (msg) => {
  console.log('Recieved mode cmd', msg, msg.copterId)
  pub.publish(`/${msg.copterId}/mode`, JSON.stringify({ data: msg.data }))
}
const onStreamRate = (msg) => {
  console.log('Recieved stream rate cmd', msg, msg.copterId)
  pub.publish(`/${msg.copterId}/stream_rate`, JSON.stringify({ data: msg.data }))
}
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
}
const connectToCopter = (ws, socket) => (copterId) => {
  console.log('Connection request', copterId)
  console.log(`joining to 'copter_${copterId}'`)
  socket.join(`copter_${copterId}`)
  redis.get(NODES_INFO_KEY)
    .then((list) => list ? JSON.parse(list) : [])
    .then((list) => {
      console.log(list)
      return list
    })
    .then((nodes) => {
      // checking node number
      if (nodes.length === 0) {
        // no nodes online error
        throw new Error('No nodes found')
      }
      // looking for copter
      let copter
      nodes.forEach(n => {
        let _copter = n.copters.find(c => c === copterId)
        if (_copter) {
          copter = _copter
        }
      })
      return copter
    })
    .then((copter) => {
      if (copter) {
        return copter
      }
      return redis.get(NODES_INFO_KEY)
        .then((nodes) => nodes ? JSON.parse(nodes) : [])
        .then((nodes) => {
          console.log('Found following nodes:', nodes)
          let msg = {
            copterId,
            uuid: nodes[0].uuid,
            action: 'connect'
          }
          console.log('Sending message to redis channel: "copters"', msg)

          return pub.publish('copters', JSON.stringify(msg)).then(() => copterId)
        })
    })
    .catch((err) => {
      socket.emit('err', { code: CONNECTION_ERROR, msg: err.message})
    })
}

const disconnectFromCopter = (ws, socket) => (copterId) => {
  console.log('Disconnecting from copter', copterId)
  _.forEach(_.filter(socket.rooms, (value, key) => key.startsWith(`copter_${copterId}`)), (value, key) => socket.leave(key))
}

const onDisconnect = (ws, socket) => () => {
  console.log('Socket disconnect')
  return true
}
