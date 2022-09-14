const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);
const config = require('./config.json');

app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({ extended: true }));

//Send Resources
app.get('/', (req, res) => {
    //res.sendFile(__dirname + '/public/index.html');
    res.send("Hello");
});

//HTTP server begin listening
server.listen(config.serverPort , config.serverAddress, () => {
    console.log('listening on http://' + config.serverAddress + ':' + config.serverPort);
});


