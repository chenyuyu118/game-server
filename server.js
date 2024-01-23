const {WebSocketServer} = require('ws');
const { readFileSync } = require('fs')
const {createServer} = require('https')

const server = createServer({
    cert: readFileSync('keys/cert.pem'),
    key: readFileSync('keys/key.pem'),
});
const wss = new WebSocketServer({ server });

let clients = new Map;

//如果有WebSocket请求接入，wss对象可以响应connection事件来处理这个WebSocket：
wss.on('connection',function(ws, request){  //在connection事件中，回调函数会传入一个WebSocket的实例，表示这个WebSocket连接。
    let start = request.url.indexOf("test");
    let id = request.url.substring(start + 4);
    clients.set(id, ws);
    ws.on('message',function(message){  //我们通过响应message事件，在收到消息后再返回一个ECHO: xxx的消息给客户端。
        let clientIter = clients.values();
        let client = clientIter.next().value;
        while (client) {
            if (client !== ws) {
                client.send(message.toString());
            }
            client = clientIter.next().value;
        }
    })

    ws.on('close',function(ws, request){
        let deleteKey;
        for (let client of clients) {
            if (client[1]._closeCode === ws) {
                deleteKey = client[0];
                break
            }
        }

        if (deleteKey) {
            clients.delete(deleteKey);
            for (let client of clients) {
                let s = JSON.stringify({
                    id: deleteKey,
                    type: 1
                });
                client[1].send(s)
            }
        }
    })
})



server.listen(4000)
