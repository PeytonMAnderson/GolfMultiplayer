const { application } = require('express');
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);
const gg = require('./golfgame');

require("dotenv").config();

app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/nav'));
app.use(express.urlencoded({ extended: true }));

//Send Resources
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/nav/main.html');
});
app.get('/:query', (req, res) => {
    let gameId = req.params.query;
    let name;
    const searchParams = new URLSearchParams(req._parsedUrl.search);
    for (const [key, value] of searchParams.entries()) {if(key == 'name') name = value;}
    console.log(gameId);
    console.log(name);

    switch(req.params.query) {
        case null:
            res.sendFile(__dirname + '/nav/main.html');
            break;
        case 'create':
            res.sendFile(__dirname + '/nav/create.html');
            break;
        case 'join':
            res.sendFile(__dirname + '/nav/join.html');
            break;
        default:
            try {
                if(gg.getGame(parseInt(req.params.query)) == 'NULL' || gg.getGame(parseInt(req.params.query)) == null) {
                    res.status(404).send("Game Room Not Found");
                } else {
                    res.sendFile(__dirname + '/public/game.html');
                }
            } catch (error) {
                res.status(500).send("Unable to get Game Room");
                console.log(error);
            }
            break;
    }
});

//User wants to create lobby
app.post('/lobby', (req, res) => {
    try {
        //Invalid JSON
        if(req.body == null && req.body == '') return;

        //If person connecting is a host
        if(req.body.createPlayerName != null) {
            //Create empty lobby
            let name = req.body.createPlayerName;
            let game = gg.getGameId();
            gg.setGame(game, name);
            res.redirect('/' + game);
            return;
        } else {
            //Player is not host, join lobby
            let game = req.body.joinGame;
            res.redirect('/' + game);
            return;
        }
    } catch (error) {
        res.status(500).send("Unable to create lobby");
        console.log(error);
    }
});
//Host wants to join lobby
app.post('/:id', (req, res) => {
    try {
        if(gg.getGame(parseInt(req.params.id)).hostSocketId == 'EMPTY') {
            gg.createGame(parseInt(req.body.gameId), req.body.mySocketId);
            console.log('Host id for game room: ' + req.body.gameId + ' is: ' + gg.getGame(parseInt(req.body.gameId)).hostSocketId);
        }
    } catch (error) {
        res.status(500).send("Unable edit Game Room");
        console.log(error);
    }
});

//Socket listen
io.on('connection', (socket) => {
    //Begin Handshake to new opened socket
    try{gg.connectedToServer(io, socket);} catch (error) {console.log(error);}
});

//HTTP server begin listening
let port = process.env.PORT || 3000;
let address = process.env.ADDRESS || "0.0.0.0";
server.listen(port , address, () => {
    console.log('listening on http://' + address + ':' + port);
});


