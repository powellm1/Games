const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 2500 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

let player, platforms, cursors, background, obstacles, scoreText, levelText;
let score = 0;
let isGameOver = false;
let canJump = true;
let restartKey;
let playerName = '';
let leaderboard = JSON.parse(localStorage.getItem('leaderboard')) || [];

// Difficulty settings
let currentLevel = 1;
let obstacleSpeed = -200;
let spawnDelay = 3000;
let obstacleSpawnTimer;
let scrollSpeed = 2;

function preload() {
    this.load.image('sky1', 'https://labs.phaser.io/assets/skies/space3.png'); // Level 1 background
    this.load.image('sky2', 'https://labs.phaser.io/assets/skies/space4.png'); // Level 2 background
    this.load.image('sky3', 'https://labs.phaser.io/assets/skies/space5.png'); // Level 3 background
    this.load.image('ground', 'https://labs.phaser.io/assets/sprites/platform.png');
    this.load.image('player', 'https://labs.phaser.io/assets/sprites/phaser-dude.png');
    this.load.audio('jump', 'https://freesound.org/people/cabled_mess/sounds/350904/');
}

function create() {
    // Ask for player name with length validation
    do {
        playerName = prompt("Enter your name to start (4-15 characters):");
    } while (playerName.length < 4 || playerName.length > 15);

    background = this.add.tileSprite(400, 300, 800, 600, 'sky1'); // Set initial background

    platforms = this.physics.add.staticGroup();
    platforms.create(400, 568, 'ground').setScale(2).refreshBody();

    player = this.physics.add.sprite(100, 450, 'player');
    player.setBounce(0.2);
    player.setCollideWorldBounds(true);

    this.physics.add.collider(player, platforms);

    obstacles = this.physics.add.group();

    obstacleSpawnTimer = this.time.addEvent({
        delay: spawnDelay,
        callback: addObstacle,
        callbackScope: this,
        loop: true
    });

    this.physics.add.collider(player, obstacles, hitObstacle, null, this);

    cursors = this.input.keyboard.createCursorKeys();
    restartKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    jumpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '32px', fill: '#fff' });
    levelText = this.add.text(16, 56, 'Level: 1', { fontSize: '32px', fill: '#fff' });
}

function update() {
    if (isGameOver) {
        if (Phaser.Input.Keyboard.JustDown(restartKey)) {
            restartGame.call(this);
            return;
        }
        return;
    }

    background.tilePositionX += scrollSpeed;
    player.setVelocityX(0);

    // Jumping logic
    if (jumpKey.isDown && canJump) {
        player.setVelocityY(-900);
        canJump = false;
    }

    if (obstacles && obstacles.children) {
        obstacles.children.iterate(function(obstacle) {
            if (obstacle && obstacle.x < -50) {
                obstacle.destroy();
            }
        });
    }

    score += 1;
    scoreText.setText('Score: ' + score);

    // Check for level increase every 1000 points
    const newLevel = Math.floor(score / 1000) + 1;
    if (newLevel !== currentLevel) {
        increaseDifficulty.call(this, newLevel);
    }

    if (player.body.touching.down) {
        canJump = true;
    }
}

function increaseDifficulty(newLevel) {
    currentLevel = newLevel;
    
    obstacleSpeed = -200 - (currentLevel - 1) * 100;
    spawnDelay = Math.max(500, 3000 - (currentLevel - 1) * 500);
    scrollSpeed = 2 + (currentLevel - 1) * 1;

    if (obstacleSpawnTimer) {
        obstacleSpawnTimer.destroy();
    }
    
    obstacleSpawnTimer = this.time.addEvent({
        delay: spawnDelay,
        callback: addObstacle,
        callbackScope: this,
        loop: true
    });

    // Change the background based on the current level
    switch (currentLevel) {
        case 1:
            background.setTexture('sky1');
            break;
        case 2:
            background.setTexture('sky2');
            break;
        case 3:
            background.setTexture('sky3');
            break;
        default:
            background.setTexture('sky1'); // Reset to level 1 background for levels above 3
            break;
    }

    levelText.setText(`Level: ${currentLevel}\nSpeed: ${Math.abs(obstacleSpeed)}`);

    const levelUpText = this.add.text(400, 300, 'LEVEL UP!', {
        fontSize: '48px',
        fill: '#ff0',
        align: 'center'
    }).setOrigin(0.5);

    this.tweens.add({
        targets: levelUpText,
        alpha: 0,
        duration: 500,
        ease: 'Power2',
        onComplete: () => levelUpText.destroy()
    });

    this.tweens.add({
        targets: levelText,
        alpha: 0,
        duration: 200,
        ease: 'Power2',
        yoyo: true,
        repeat: 2
    });
}

function addObstacle() {
    if (!isGameOver) {
        const isTrap = Phaser.Math.Between(0, 5) === 0; // Random chance to spawn a trap
        const obstacleLength = Phaser.Math.Between(20, 50);
        const obstacleHeight = Phaser.Math.Between(500, 400);

        const obstacle = obstacles.create(850, obstacleHeight, 'ground');
        obstacle.displayWidth = obstacleLength;
        obstacle.setVelocityX(obstacleSpeed);
        obstacle.setCollideWorldBounds(false);
        obstacle.body.allowGravity = false;

        if (isTrap) {
            obstacle.setTint(0xff0000); // Color the trap obstacle red
            obstacle.isTrap = true; // Add a custom flag to identify it as a trap
        }
    }
}

function hitObstacle(player, obstacle) {
    if (isGameOver) return;

    // Check if the obstacle is a trap
    if (obstacle.isTrap) {
        springboardTrap.call(this, player); // Launch the player with the trap effect
    } else {
        this.physics.pause();
        isGameOver = true;
        player.setTint(0xff0000);

        // Store the score in the leaderboard
        leaderboard.push({ name: playerName, score: score });
        leaderboard.sort((a, b) => b.score - a.score);
        leaderboard = leaderboard.slice(0, 10);
        localStorage.setItem('leaderboard', JSON.stringify(leaderboard));

        displayGameOverText.call(this);
    }
}

// Function to handle the springboard effect
function springboardTrap(player) {
    // Launch the player upward (higher than a normal jump)
    player.setVelocityY(-1500);

    // Set a timeout to return the player back to the game after a brief delay
    setTimeout(() => {
        player.setVelocityY(2000); // Bring the player back down with added gravity
    }, 500); // Adjust the delay for how long the player stays off-screen

    // Optionally, display some feedback (e.g., "Trap!")
    const trapText = this.add.text(player.x, player.y - 50, 'TRAP!', {
        fontSize: '32px',
        fill: '#ff0000',
        align: 'center'
    }).setOrigin(0.5);
    
    // Fade out and remove the text
    this.tweens.add({
        targets: trapText,
        alpha: 0,
        duration: 1000,
        ease: 'Power2',
        onComplete: () => trapText.destroy()
    });
}

function displayGameOverText() {
    const bestScore = leaderboard.length > 0 ? leaderboard[0].score : score;
    const leaderboardText = leaderboard.map((entry, i) => `${i + 1}. ${entry.name}: ${entry.score}`).join('\n');

    const gameOverText = this.add.text(400, 300, 
        `Game Over!\nScore: ${score}\nBest Score: ${bestScore}\nPress ESC to restart\n\nLeaderboard:\n${leaderboardText}`, {
        fontSize: '24px',
        fill: '#fff',
        align: 'center'
    });
    gameOverText.setOrigin(0.5);
}

function restartGame() {
    isGameOver = false;
    score = 0;
    canJump = true;
    
    currentLevel = 1;
    obstacleSpeed = -200;
    spawnDelay = 3000;
    scrollSpeed = 2;

    if (obstacleSpawnTimer) {
        obstacleSpawnTimer.destroy();
    }
    
    obstacleSpawnTimer = this.time.addEvent({
        delay: spawnDelay,
        callback: addObstacle,
        callbackScope: this,
        loop: true
    });

    player.clearTint();
    player.setPosition(100, 450);
    player.setVelocityY(0);

    obstacles.clear(true, true);

    scoreText.setText('Score: 0');
    levelText.setText('Level: 1');

    this.physics.resume();

    this.children.list
        .filter(child => child.type === 'Text' && child.text.includes('Press ESC'))
        .forEach(child => child.destroy());
}
