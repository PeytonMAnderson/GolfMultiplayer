//Open Socket to server
console.log("Connecting to network...");
var sockets = io(); //Socket IO Connection 

//Global Variables (Across Multiplayer)
var GRD = {
    gameId: 0,
    origin: undefined,
    hostSocketId: 'NULL',
    playerCount: 1,
    playerLimit: 8,
    timeLeft: 'NULL',
    timeLimit: 120,
    Players: []
}

//Local Variables (Only on this instance)
var myName = 'anon'; //My Name
var loaded = false; //If the Script in PlayCanvas is completely initalized

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
        IO.socket.on('gameUpdateACK', App.Player.gameUpdateACK); //Player recieves Entire lobby data from host
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
        GRD.gameId = parseInt(currentGameId);
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
    joinSocketACK : async function (data) {
        try {
            if(data.joined) {
                //Create Host in Lobby
                GRD.hostSocketId = data.hostSocketId;
                console.log("Joined " + data.hostName + "'s lobby:  " + data.gameId);
                resetPlayersArray();
                let index = findFirstOpen(GRD.Players);
                GRD.Players[index] = {
                    myName: myName,
                    mySocket: App.mySocketId,
                    myPosition: undefined
                }

                //Wait for Scene to load if it hasn't yet
                function checkLoading() {
                    if(loaded) {
                        GameUpdater.prototype.initializePlayers({Players: GRD.Players, name: myName});
                    } else {
                        window.setTimeout(checkLoading, 50);
                    }
                }
                checkLoading();
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
                let index = findFirstOpen(GRD.Players);
                if(index != null) {
                    GRD.Players[index] = {
                        myName: data.name,
                        mySocket: data.mySocket,
                        myPosition: GRD.origin
                    }
                    updatePlayers();    //Update Local Players
                    sendGameUpdate();   //Send New data to Everyone in Lobby
                } else {
                    console.log("GAME ROOM FULL");
                }
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
            //Wait for Scene to load if it hasn't yet
            function checkLoading() {
                if(loaded) {
                    
                    if(findFirstOpen(GRD.Players) == null || findFirstOpen(GRD.Players) != findFirstOpen(data.Players)) {
                        //If different ammount of players, reset players
                        resetPlayers(data.Players);
                    } else {
                        //Update each players position
                        updatePlayers();
                    }
                    GRD = {
                        gameId: parseInt(data.gameId),
                        hostSocketId: data.hostSocketId,
                        origin: data.origin,
                        playerCount: data.playerCount,
                        playerLimit: data.playerLimit,
                        timeLeft: data.timeLeft,
                        timeLimit: data.timeLimit,
                        Players: data.Players
                    }
                } else {
                    window.setTimeout(checkLoading, 50);
                }
            }
            checkLoading();
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
        origin: GRD.origin,
        playerCount: GRD.playerCount,
        playerLimit: GRD.playerLimit,
        timeLeft: GRD.timeLeft,
        timeLimit: GRD.timeLimit,
        Players: GRD.Players
    }
    IO.socket.emit('gameUpdate', data);
}

//Reset Players if Player count mis-match
function resetPlayers(newPlayers) {
    console.log("reseting players");
    let data = {name: myName, Players: newPlayers}
    GameUpdater.prototype.initializePlayers(data);
}


//Update player data in game
function updatePlayers() {
    for (let i = 0; i < GRD.Players.length; i++) {
        let data = {name: GRD.Players[i].myName, position: GRD.Players[i].myPosition}
        GameUpdater.prototype.updatePosition(data);
    }
}

//Find my index
function getPlayer(name) {
    for(let i = 0; i < GRD.Players.length; i++) {
        if(GRD.Players[i].myName == name) {
            return i;
        }
    }
}

//Reset Players Array
function resetPlayersArray() {
    GRD.Players = [];
    for(let i = 0; i < GRD.playerLimit; i++) {
        GRD.Players[i] = 'EMPTY';
    }
}

//Find First open slot
function findFirstOpen(Array) {
    for(let i = 0; i < Array.length; i++) {
        if(Array[i] == 'EMPTY') {
            return i;
        }
    }
    return null;
}