const {WebSocket} = require('ws');

let client = new WebSocket('ws://localhost:4000/test');

client.on('open',function(){
    console.log('open connection');
    client.send(JSON.stringify({
        "position": {
            x: 0,
            y: 0
        },
        "velocity": {
            x: 0,
            y: 0
        },
    }));
})

client.on('message',function(message){
    console.log(message.toString());
})