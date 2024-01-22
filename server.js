const {WebSocketServer} = require('ws');
const { readFileSync } = require('fs')
const {createServer} = require('https')

const server = createServer({
    cert: readFileSync('keys/cert.pem'),
    key: readFileSync('keys/key.pem'),
});
const wss = new WebSocketServer({ server });

let clients = [];

//如果有WebSocket请求接入，wss对象可以响应connection事件来处理这个WebSocket：
wss.on('connection',function(ws){  //在connection事件中，回调函数会传入一个WebSocket的实例，表示这个WebSocket连接。
    console.log(`[SERVER] connection()`);
    clients.push(ws);
    ws.on('message',function(message){  //我们通过响应message事件，在收到消息后再返回一个ECHO: xxx的消息给客户端。
        console.log(`[SERVER] Received:${message}`);
        for (let i = 0; i < clients.length; i++) {
            if (clients[i] !== ws)
                clients[i].send(message.toString());
        }
    })
})

wss.on('close',function(ws){
    console.log('close connection');
    clients.splice(clients.indexOf(ws),1);
})

server.listen(4000)
