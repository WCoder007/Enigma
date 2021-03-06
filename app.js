//SERVER

// Variable: expresss
// Includes the Express module
var expresss = require("express");
// Variable: express
// new express application
var express = expresss();
// Variable: socket
// Includes the socket.io module
var socket = require("socket.io");
// Variable: randomstring
// Includes the randomstring module
var randomstring = require("randomstring");
// Constant: path
// Includes the path module
const path = require('path');

express.set("view engine", "ejs");
express.use(expresss.static("assets"));

express.get("/", function(req, res) {
    res.render("index");
});
 express.get("/instructions", function(req, res) {
     res.render("instructions");
 });
express.get("/multiplayer", function(req, res) {
    res.render("multiplayer");
});

express.get("/loaderio-c22eb21e6fd039f5bb76ec284ff22809",(req,res)=>{
    res.sendFile(path.join(__dirname+'/loaderio-c22eb21e6fd039f5bb76ec284ff22809.txt'));
})

//Server Setup
if (process.env.PORT) {
    var server = express.listen(process.env.PORT||80, process.env.IP, function() {
        console.log("The Server is running");
    });
} else {
    var server = express.listen(3000, function() {
        console.log("The Server is running");
    });
}


// Variable: io
//Socket Setup
var io = socket(server);

/* Variables: Game Variables

   choice1 - Choice of player 1
   choice2 - Choice of player 2
   players   - list of players
   totalGame   - total number of games
   gameCnt   - increments on every round
*/
var choice1 = "",
    choice2 = "";
var players = [];
var totalGames, gameCnt = 0;
//FUNCTIONS

/* Function: getWinner

   calculate the winner in each round

   Parameters:

      p - Choice of first player
      c - Choice of second player

   Returns:

      An integer from 1 to 4 depending on the conditions

*/
function getWinner(p, c) {

    if (p === "blame") {
        if (c === "blame") {
            return 1;
        }
        else {
            return 2;
        }
    }
    else {
        if (c === "blame") {
            return 3;
        }
        else {
            return 4;
        }
    }
}

/* Function: result

   Result execution after getting both choices and emits it

   Parameters:

      roomID - Room ID of the players

*/

function result(roomID) {
    gameCnt++;
    var winner = getWinner(choice1, choice2);
    io.sockets.to(roomID).emit("result", {
        winner: winner,
        choice1: choice1,
        choice2: choice2,
        gameCnt: gameCnt,
        totalGames: totalGames
    });
    choice1 = "";
    choice2 = "";
}
//Socket Connection
io.on("connection", function(socket) {
    console.log("made connection with socket");

    //Disconnect
    socket.on("disconnect", function(data) {
        if(socket.isMultiplayerGame) {
            gameCnt=0;
            var leavingPlayer = players.find(player => player.socket === socket.id);
            players = players.filter(player => player.socket !== leavingPlayer.socket);
            var playingPlayer = players.find(player => player.room === leavingPlayer.room);
            var playingPlayerSocket = io.sockets.sockets[playingPlayer.socket];
            playingPlayerSocket.isMultiplayerGame = false;
            socket.isMultiplayerGame = false;
            playingPlayerSocket.emit("informAboutExit", {
                player : playingPlayer,
                leaver : leavingPlayer
            });

        }

        io.of("/")
            .in(data.room)
            .clients((error, socketIds) => {
                if (error) throw error;
                socketIds.forEach(socketId =>
                    io.sockets.sockets[socketId].leave("chat")
                );
            });
    });

    //Create Game Listener
    socket.on("createGame", function(data) {
        var room = randomstring.generate({
            length: 4
        });
        players.push({
            socket : socket.id,
            name : data.name,
            room
        })
        socket.join(room);
        socket.isMultiplayerGame = true;
        totalGames = Number(data.totalGames);
        socket.emit("newGame", {
            name: data.name,
            room: room,
        });
    });
    //Join Game Listener
    socket.on("joinGame", function(data) {
        var room = io.nsps["/"].adapter.rooms[data.room];
        if (room) {
            if (room.length == 1) {
                socket.join(data.room);
                players.push({
                    socket : socket.id,
                    name : data.name,
                    room : data.room
                });
                socket.isMultiplayerGame = true;
                socket.broadcast.to(data.room).emit("player1", { oppName: data.name });
                socket.emit("player2", { name: data.name, room: data.room });
            } else {
                socket.emit("err", { message: "Sorry, The room is full!" });
            }
        } else {
            socket.emit("err", { message: "Invalid Room Key" });
        }
    });
    //Listener to pass the name of the game creater
    socket.on("joinedGame", function(data) {
        console.log("Joined Game ", data);
        socket.broadcast.to(data.room).emit("welcomeGame", data.player);
    });
    //Listener to Player 1's Choice
    socket.on("choice1", function(data) {
        choice1 = data.choice;
        console.log(choice1, choice2);
        if (choice2 != "") {
            result(data.room);
            //gameCnt++;
        }
    });
    //Listener to Player 2's Choice
    socket.on("choice2", function(data) {
        choice2 = data.choice;
        console.log(choice1, choice2);
        if (choice1 != "") {
            result(data.room);
        }
    });

    //Listener to Chat Messages
    socket.on("chat", function(data) {
        io.sockets.to(data.room).emit("chat", data);
    });
    socket.on("typing", function(data) {
        socket.broadcast.to(data.room).emit("typing", data.player);
    });
});