
const PORT = process.env.PORT || 3333 ;

const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const game = createGame();

const vScalePix = 50;
const vFrameCanvas = 500;

var vCirclePix = vScalePix / 2;

const vAddPontos = 1;

game.canvasWidth = vFrameCanvas;
game.canvasHeight = vFrameCanvas;
game.frameCanvas = vFrameCanvas;
game.scalePix = vScalePix;

let maxConcurrentConnections = 15 ;

app.get('/', function (req, res){
	res.sendFile(__dirname + '/game.html');
})

// a31ecc0596d72f84e5ee403ddcacb3d
app.get('/admin', function (req, res){
	res.sendFile(__dirname + '/game-admin.html');
})

app.get('/style.css', function (req, res){
	res.sendFile(__dirname + '/style.css');
})

app.get('/gramado.jpg', function (req, res){
	res.sendFile(__dirname + '/gramado.jpg');
})

app.get('/paper.jpg', function (req, res){
	res.sendFile(__dirname + '/paper.jpg');
})

app.get('/fantasma.png', function (req, res){
	res.sendFile(__dirname + '/fantasma.png');
})

app.get('/pacman.png', function (req, res){
	res.sendFile(__dirname + '/pacman.png');
})

app.get('/emoji.png', function (req, res){
	res.sendFile(__dirname + '/emoji.png');
})

app.get('/cereja.png', function (req, res){
	res.sendFile(__dirname + '/cereja.png');
})

app.get('/bg.png', function (req, res){
	res.sendFile(__dirname + '/bg.png');
})

app.get('/collect.mp3', function (req, res){
	res.sendFile(__dirname + '/collect.mp3');
})

app.get('/100-collect.mp3', function (req, res){
	res.sendFile(__dirname + '/100-collect.mp3');
})

setInterval(() => {
	io.emit('concurrent-connections', io.engine.clientsCount)
}, 5000);

io.on('connection', function(socket){
	const admin = socket.handshake.query.admin;

	if (io.engine.clientsCount > maxConcurrentConnections && !admin){
		socket.emit('show-max-concurrent-connections-message');
		socket.conn.close()
		return
	} else {
		socket.emit('hide-max-concurrent-connections-message');
	}
	const playerState = game.addPlayer(socket.id);
	socket.emit('bootstrap', game);

	socket.broadcast.emit('player-update', {
		socketId: socket.id,
		newState: playerState
	});

	socket.on('player-move', (direction) => {
		game.movePlayer(socket.id, direction);

		const fruitColisionIds = game.checkForFruitColision();

		socket.broadcast.emit('player-update', {
			socketId: socket.id,
			newState: game.players[socket.id]
		});

		if (fruitColisionIds){
			io.emit('fruit-remove', {
				fruitId: fruitColisionIds.fruitId,
				score: game.players[socket.id].score
			})
			socket.emit('update-player-score', game.players[socket.id].score);
		}

	});

	socket.on('disconnect', () => {
		game.removePlayer(socket.id);
		socket.broadcast.emit('player-remove', socket.id);
	});

	let fruitGameInterval;
	socket.on('admin-start-fruit-game', (interval) => {
		console.log('> Fruit Game start')
		clearInterval(fruitGameInterval);

		fruitGameInterval = setInterval(() => {
			const fruitData = game.addFruit();

			if (fruitData) {
				io.emit('fruit-add', fruitData);
			}
		}, interval);
	});

	socket.on('admin-stop-fruit-game', () => {
		console.log('> Fruit Game stop');
		clearInterval(fruitGameInterval);
	});

	socket.on('admin-start-crazy-mode', () => {
		io.emit('start-crazy-mode');
	});

	socket.on('admin-clear-scores', () => {
		game.clearScores();
		io.emit('bootstrap', game);
	});

	socket.on('admin-concurrent-connections', (newConcurrentConnections) => {
		maxConcurrentConnections = newConcurrentConnections;
	});

});

function createGame(){

	let fruitGameInterval;

	const game = {
		canvasWidth: 0,
		canvasHeight: 0,
		players: {},
		fruits: {},
		addPlayer,
		removePlayer,
		movePlayer,
		addFruit,
		removeFruit,
		checkForFruitColision,
		clearScores
	}

	function randMultiple(pMax, pScale){
		const vRound = Math.round(Math.random() * (pMax - pScale) / pScale);
		const vReturn = Math.abs((vRound * pScale) - vCirclePix);
		// console.log('> vReturn: '+ vReturn );
		return (vReturn);
	}

	function addPlayer(socketId){

		const xWidth = randMultiple(vFrameCanvas, vScalePix);
		const yHeight = randMultiple(vFrameCanvas, vScalePix);

		return game.players[socketId] = {
			x: xWidth,
			y: yHeight,
			score: 0
		}

	}

	function removePlayer(socketId){
		delete game.players[socketId];
	}

	function movePlayer(socketId, direction){

		const player = game.players[socketId];
		/*
		console.log( 'X: '+ player.x );
		console.log( 'Y: '+ player.y );
		console.log( '' );
		*/
		if (direction === 'up' && player.y - 0 >= 0){
			player.y = player.y - vScalePix;
		}

		if (direction === 'left' && player.x - 0 >= 0){
			player.x = player.x - vScalePix;
		}

		if (direction === 'down' && player.y + 0 < game.canvasHeight){
			player.y = player.y + vScalePix;
		}

		if (direction === 'right' && player.x + 0 < game.canvasWidth){
			player.x = player.x + vScalePix;
		}

		return player;
	}

	function addFruit(){

		const fruitRandomId = Math.floor(Math.random() * 10000000);

		const xWidth = randMultiple(vFrameCanvas, vScalePix);
		const yHeight = randMultiple(vFrameCanvas, vScalePix);

		const fruitRandomX = xWidth;
		const fruitRandomY = yHeight;

		for (fruitId in game.fruits) {
			const fruit = game.fruits[fruitId];

			if (fruit.x === fruitRandomX && fruit.y === fruitRandomY){
				return false;
			}

		}

		game.fruits[fruitRandomId] = {
			x: fruitRandomX,
			y: fruitRandomY
		}

		return {
			fruitId: fruitRandomId,
			x: fruitRandomX,
			y: fruitRandomY
		}

	}

	function removeFruit(fruitId){
		delete game.fruits[fruitId];
		// console.log( fruitId );
	}

	function checkForFruitColision(){
		for (fruitId in game.fruits){
			const fruit = game.fruits[fruitId];

			for (socketId in game.players) {
				const player = game.players[socketId];

				if (fruit.x === player.x && fruit.y === player.y) {
					player.score = player.score + vAddPontos;
					game.removeFruit(fruitId);

					return {
						socketId: socketId,
						fruitId: fruitId
					}
				}
			}
		}
	}

	function clearScores(){
		for (socketId in game.players) {
			game.players[socketId].score = 0;
		}
	}
	return game;
}

http.listen( PORT , function(){
	console.log( '' );
	console.log( '  =====================================================' );
	console.log( '  =                                                   =' );
	console.log( '  =     # App iniciado com sucesso na porta: '+ PORT +'     =' );
	console.log( '  =                                                   =' );
	console.log( '  =====================================================' );
	console.log( '' );
});
