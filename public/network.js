//Open Socket to server
console.log("Connecting to network...");
var sockets = io();

//Global Variables (Across Multiplayer)
var GRD = {
    gameId: 0,
    hostSocketId: 'NULL',
    playerCount: 1,
    playerLimit: 8,
    timeLeft: 'NULL',
    timeLimit: 120,
    Players: []
}

//Local Variables (Only on this instance)
var myName = 'anon';

var IO = {
    init : function() {
        IO.socket = sockets;
        IO.bindEvents();
    },
    bindEvents : function() {
        //Bind Server Listeners
        IO.socket.on('connected', IO.onConnected);
        IO.socket.on('getNameACK', IO.getNameACK);
        IO.socket.on('joinSocketACK', IO.joinSocketACK);

        //Host Server Listeners
        IO.socket.on('playerJoinREQ', App.Host.playerJoinREQ); //Host determines if player can join
        //Player Server Listeners
        IO.socket.on('gameUpdateACK'. App.Player.gameUpdateACK); //Player recieves Entire lobby data from host
    },
    onConnected : function(socID) {
        App.mySessionId = IO.socket.io.engine.id;
        App.mySocketId = socID;
        console.log('Connected! Socket ID: ' + App.mySocketId);
        console.log("Creating Lobby...");

        //Get Room code from URL
        let path = window.location.pathname;
        let pathAry = path.split('/');
        let currentGameId = pathAry[pathAry.length-1];

        //POST to server to see if room is set up already
        let data = {gameId: currentGameId, mySocketId: App.mySocketId}
        var formBody = [];
        for (var property in data) {
            var encodedKey = encodeURIComponent(property);
            var encodedValue = encodeURIComponent(data[property]);
            formBody.push(encodedKey + "=" + encodedValue);
        }
        formBody = formBody.join("&");
        fetch(window.location.href, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body: formBody
        });

        //See if name exists on server
        let newData = {gameId: parseInt(currentGameId), socketId: App.mySocketId}
        GRD.gameId = currentGameId;
        try {IO.socket.emit("getName", newData);} catch (error) {console.log(error);}
    },
    getNameACK : function (data) {
        //If player is joining lobby
        if(data.error) {
            console.log("Lobby already created by: " + data.hostName);
            console.log("Joining Lobby...");
            try {
                let sendData = {name: myName, mySocket: App.mySocketId, gameId: GRD.gameId}
                IO.socket.emit('playerJoinREQ', sendData);
            } catch (error) {
                console.log(error);
            }
        //If player is hosting lobby
        } else {
            console.log("Created Lobby for: " + data.gameId + ' with host: ' + data.hostName + ' who has id: ' + data.hostSocketId);
            console.log("Joining Lobby...");
            try {
                IO.socket.emit("joinSocket", GRD.gameId); 
                myName = data.hostName;
            } catch (error) {
                console.log(error);
            }
        }
    },
    joinSocketACK : function (data) {
        try {
            if(data.joined) {
                GRD.hostSocketId = data.hostSocketId;
                console.log("Joined " + data.hostName + "'s lobby:  " + data.gameId);
                GRD.Players[myName] = {
                    mySocket: App.mySocketId,
                    myPosition: [Math.random() * 100, 100, Math.random() * 100]
                }
                GameUpdater.prototype.initializePlayers({Players: GRD.Players, name: myName});
            } else {
                console.log("Failed to join game!");
            }
        } catch (error) {
            console.log(error);
        }
    }
}

var App = {
    init : function() {
        App.cacheElements();
        App.bindEvents();
    },
    cacheElements : function() {
        return;
    },
    bindEvents : function() {
        return;
    },
    Host : {
        playerJoinREQ : function(data) {
            console.log("Player " + data.name + " with socketId: " + data.mySocket + " is trying to join my lobby " + data.gameId);
            try {
                let transmitData = {mySocket: data.mySocket, gameId: data.gameId}
                sockets.emit('requestPlayerToJoin', transmitData);
                sendGameUpdate();
            } catch (error) {console.log(error);}
        }
    },
    Player : {
        sendName : function() {
            let joinName = 'anon';
            myName = joinName;
            let data = {name: joinName, socketId: App.mySocketId, gameId: GameRoomData.gameId}
            IO.socket.emit('playerJoinREQ', data);
        },
        gameUpdateACK : function(data) {
            if(GRD.Players.length != data.Players.length) remakePlayers(data.Players);
            GRD = {
                gameId: data.gameId,
                hostSocketId: data.hostSocketId,
                playerCount: data.playerCount,
                playerLimit: data.playerLimit,
                timeLeft: data.timeLeft,
                timeLimit: data.timeLimit,
                Players: data.Players
            }
            updatePlayers();
        }
    }
}

//Run network.js
IO.init();
App.init();


//--------------------------------------------------------------------------------------------
//Help functions
//--------------------------------------------------------------------------------------------

//Send Whole game update for everyone with new player
function sendGameUpdate() {
    let data = {
        gameId: GRD.gameId,
        hostSocketId: GRD.hostSocketId,
        playerCount: GRD.playerCount,
        playerLimit: GRD.playerLimit,
        timeLeft: GRD.timeLeft,
        timeLimit: GRD.timeLimit,
        Players: GRD.Players
    }
    IO.socket.emit('gameUpdate', data);
}

//Remake balls in lobby if there is new player data
function remakePlayers(players) {

}

//Update player data in game
function updatePlayers() {
    for(let i = 0; i < GRD.Players.length; i++) {

    }
}