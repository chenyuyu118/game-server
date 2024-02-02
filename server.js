const {WebSocketServer} = require('ws');
const { readFileSync } = require('fs')
const cors = require('cors')
const {createServer} = require('http')
const express = require('express');
const pug = require('pug')

let app = express();
app.use(express.json());
app.use(cors())
app.set('view engine', 'pug');

let counter = 0;
let nameIdMap = new Map();
let idNameMap = new Map();
let idGroupMap = new Map();
let groups = [[]];
let currentGroup = 0;
let clients = new Map;
let groupWinnerSet = new Set();


const finalArea = {
    x0: 419,
    x1: 704,
    y0: 1800,
    y1: 1872
}

const server = createServer({
    // cert: readFileSync('keys/certificate.crt'),
    // key: readFileSync('keys/key.pem'),
}, app);

const wss = new WebSocketServer({ server });


app.get("/counter", function(req, res) {
    res.send(counter.toString());
    counter++;
})

app.post("/user", function(req, res) {
    // 获取请求中对象
    let body = req.body;
    nameIdMap.set(body.name, counter);
    idNameMap.set(counter, body.name);
    res.send(counter.toString());

    if (groups[currentGroup].length < 8) {
        idGroupMap.set(counter, currentGroup);
    } else {
        currentGroup++;
        groups.push([]);
        idGroupMap.set(counter, currentGroup);
    }

    counter++;
})

app.get("/user/:id", function(req, res) {
    let id = req.params.id;
    let name = idNameMap.get(Number.parseInt(id));
    res.send(name);
})

app.get("/group", function (req, res) {
    let resultList = [];
    for (let idGroup of idGroupMap) {
        if (!resultList[idGroup[1]]) {
            resultList[idGroup[1]] = {
                "users": [],
            }
        }

        let items = {
            id: idGroup[0],
            name: idNameMap.get(Number.parseInt(idGroup[0])),
            isOb: clients.get(idGroup[0].toString()).isOb
        };
        resultList[idGroup[1]].users.push(items)
    }

    for (let i = 0; i < groups.length; i++) {
        if (!resultList[i]) {
            resultList[i] = {
                "users": []
            }
        }
    }

    res.render('index', {title: "服务端控制", resultList: resultList})
})

app.post("/group/add", function (req, res) {
    groups.push([])
    res.send("success")
})

app.post("/group/move", function (req, res) {
    let body = req.body;
    let id = body.id;
    let groupId = body.groupId;

    // 获取ws连接
    let ws = clients.get(id);

    // 从原来的group中删除
    let originGroup = idGroupMap.get(Number.parseInt(id));
    idGroupMap.delete(Number.parseInt(id));
    let originGroupArray = groups[originGroup];
    let originIndex = originGroupArray.findIndex(item => item === ws);
    if (originIndex !== -1) {
        originGroupArray.splice(originIndex, 1);
    }

    // 向原有group发送全局通告
    for (let client of originGroupArray) {
        let s = JSON.stringify({
            id: id,
            type: 1
        });
        client.send(s)

        // 向迁移的client发送所有人退出的通告
        ws.send(JSON.stringify({
            id: client.id,
            type: 1
        }))
    }

    // 添加到新的Group中
    idGroupMap.set(Number.parseInt(id), groupId);
    let group = groups[groupId];
    group.push(ws);

    res.send("success")
});


// 发送全局游戏开始
app.post("/group/start", function (req, res) {
  let body = req.body;
  let groupId = body.groupId;
  for (let client of groups[groupId]) {
    client.send(JSON.stringify({
      type: 2
    }))
  }
})

// 发送全局游戏结束
app.post("/group/stop", function (req, res) {
  let body = req.body;
  let groupId = body.groupId;
  for (let client of groups[groupId]) {
    client.send(JSON.stringify({
      type: 3
    }))
  }
})


//如果有WebSocket请求接入，wss对象可以响应connection事件来处理这个WebSocket：
wss.on('connection',function(ws, request){  //在connection事件中，回调函数会传入一个WebSocket的实例，表示这个WebSocket连接。
    let start = request.url.indexOf("test");
    if (start > 0) {
        let id = request.url.substring(start + 4);
        ws.id = id
        clients.set(id, ws);
        // set group
        let group = idGroupMap.get(Number.parseInt(id));

        if (group >= 1) {
            ws.send(JSON.stringify({
                type: 2
            }))
        }

        groups[group].push(ws);

        if (request.url.indexOf('ob') >= 0) {
            ws.isOb = true
        }
    } else {
        clients.set(request.url, ws);
    }


    ws.on('message',function(message){  //我们通过响应message事件，在收到消息后再返回一个ECHO: xxx的消息给客户端。
        let meg = JSON.parse(message);
        if (meg.id) {
            // 转发消息
            let numberId = Number.parseInt(meg.id);
            let groupIndex = idGroupMap.get(numberId);
            let group = groups[groupIndex];
            for (let client of group) {
                if (client !== ws) {
                    client.send(message.toString());
                }
            }

            // if (meg.type === 0 && groupIndex >= 1) {
            //     const rect = meg.rect
            //     let xRange = rect.x0 < finalArea.x1 && rect.x1 > finalArea.x0;
            //     let yRange = rect.y1 > finalArea.y0 && rect.y0 < finalArea.y1;
            //     if (xRange && yRange) {
            //         if (this.winners.has(other.id)) return;
            //         this.winners.add(other.id)
            //         eventCenter.emit("winner", {
            //             id: other.id,
            //             place: this.place++,
            //             name: this.idNameMap.get(other.id).text
            //         })
            //     }
            // }
        }
        if (meg.key) {
            // 更新group
            let targetWs = clients.get(meg.key);
            if (targetWs) {
                if (meg.groupId && meg.groupId < groups.length && meg.groupId >= 0) {
                    let group = groups[meg.groupId];
                    group.push(targetWs);
                }
            }
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
            // 从所有client索引中删除
            clients.delete(deleteKey);

            // 从group中删除
            let groupIndex = idGroupMap.get(Number.parseInt(deleteKey));
            console.log("group index " + groupIndex)

            if (groupIndex !== undefined && groupIndex >= 0) {
                let group = groups[groupIndex];
                let wsIndex = group.findIndex((item, index) => item._closeCode === ws);
                console.log("ws index " + wsIndex)
                if (wsIndex !== -1) {
                    group.splice(wsIndex, 1)
                }

                for (let groupElement of group) {
                    let s = JSON.stringify({
                        id: deleteKey,
                        type: 1
                    });
                    groupElement.send(s)
                }
            }

            // 从idGroupMap中删除
            idGroupMap.delete(Number.parseInt(deleteKey));

            // 从idNameMap中删除
            idNameMap.delete(Number.parseInt(deleteKey));
        }
    })
})


server.listen(4000)
