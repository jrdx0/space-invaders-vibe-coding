// Game Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SPEED = 5;
const BULLET_SPEED = 7;
const ALIEN_SPEED = 1;
const ALIEN_DROP_DISTANCE = 20;

// Types
enum GameState {
    MENU,
    PLAYING,
    SCOREBOARD,
    CREDITS,
    GAME_OVER
}

interface GameObject {
    x: number;
    y: number;
    width: number;
    height: number;
    image?: HTMLImageElement;
}

interface Bullet extends GameObject {
    active: boolean;
}

interface Alien extends GameObject {
    active: boolean;
}

// Game State
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let currentState: GameState = GameState.MENU;
let player: GameObject;
let bullets: Bullet[] = [];
let aliens: Alien[] = [];
let keys: { [key: string]: boolean } = {};
let lastTime = 0;
let alienDirection = 1; // 1 for right, -1 for left
let score = 0;
let gameOver = false;

// Assets
const playerImg = new Image();
playerImg.src = '/assets/player.svg';
const alienImg = new Image();
alienImg.src = '/assets/alien.svg';

function init() {
    canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    ctx = canvas.getContext('2d')!;

    resetGame();

    window.addEventListener('keydown', (e) => keys[e.code] = true);
    window.addEventListener('keyup', (e) => keys[e.code] = false);
    
    // Mouse handling for menu
    canvas.addEventListener('mousedown', handleMouseClick);

    requestAnimationFrame(gameLoop);
}

function resetGame() {
    player = {
        x: CANVAS_WIDTH / 2 - 20,
        y: CANVAS_HEIGHT - 60,
        width: 40,
        height: 40,
        image: playerImg
    };
    
    bullets = [];
    aliens = [];
    score = 0;
    gameOver = false;
    alienDirection = 1;

    // Create Aliens
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 8; col++) {
            aliens.push({
                x: 100 + col * 60,
                y: 50 + row * 50,
                width: 40,
                height: 40,
                active: true,
                image: alienImg
            });
        }
    }
}

function handleMouseClick(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (currentState === GameState.MENU) {
        // Start Game
        if (isInside(mouseX, mouseY, CANVAS_WIDTH / 2 - 100, 200, 200, 50)) {
            currentState = GameState.PLAYING;
            resetGame();
        }
        // Scoreboard
        else if (isInside(mouseX, mouseY, CANVAS_WIDTH / 2 - 100, 270, 200, 50)) {
            currentState = GameState.SCOREBOARD;
        }
        // Credits
        else if (isInside(mouseX, mouseY, CANVAS_WIDTH / 2 - 100, 340, 200, 50)) {
            currentState = GameState.CREDITS;
        }
    } else if (currentState === GameState.SCOREBOARD || currentState === GameState.CREDITS || currentState === GameState.GAME_OVER) {
        // Back to Menu (click anywhere or specific button)
        currentState = GameState.MENU;
    }
}

function isInside(x: number, y: number, rx: number, ry: number, rw: number, rh: number) {
    return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
}

function update(deltaTime: number) {
    if (currentState !== GameState.PLAYING) return;
    if (gameOver) {
        currentState = GameState.GAME_OVER;
        return;
    }

    // Player Movement
    if (keys['ArrowLeft'] && player.x > 0) {
        player.x -= PLAYER_SPEED;
    }
    if (keys['ArrowRight'] && player.x < CANVAS_WIDTH - player.width) {
        player.x += PLAYER_SPEED;
    }

    // Shooting
    if (keys['Space'] && !keys['SpaceLocked']) {
        bullets.push({
            x: player.x + player.width / 2 - 2,
            y: player.y,
            width: 4,
            height: 10,
            active: true
        });
        keys['SpaceLocked'] = true; // Simple debounce
    }
    if (!keys['Space']) {
        keys['SpaceLocked'] = false;
    }

    // Update Bullets
    bullets.forEach(b => {
        b.y -= BULLET_SPEED;
        if (b.y < 0) b.active = false;
    });
    bullets = bullets.filter(b => b.active);

    // Update Aliens
    let hitWall = false;
    aliens.forEach(alien => {
        if (!alien.active) return;
        alien.x += ALIEN_SPEED * alienDirection;
        if (alien.x <= 0 || alien.x >= CANVAS_WIDTH - alien.width) {
            hitWall = true;
        }
    });

    if (hitWall) {
        alienDirection *= -1;
        aliens.forEach(alien => {
            alien.y += ALIEN_DROP_DISTANCE;
        });
    }

    // Collision Detection
    bullets.forEach(bullet => {
        aliens.forEach(alien => {
            if (alien.active && bullet.active &&
                rectIntersect(bullet, alien)) {
                alien.active = false;
                bullet.active = false;
                score += 10;
            }
        });
    });

    // Game Over Check
    if (aliens.some(a => a.active && a.y + a.height >= player.y)) {
        gameOver = true;
    }
    
    // Win Check
    if (aliens.every(a => !a.active)) {
        // For now, just restart or show win
        resetGame();
    }
}

function rectIntersect(r1: GameObject, r2: GameObject) {
    return !(r2.x > r1.x + r1.width ||
             r2.x + r2.width < r1.x ||
             r2.y > r1.y + r1.height ||
             r2.y + r2.height < r1.y);
}

function drawButton(text: string, x: number, y: number, w: number, h: number) {
    ctx.fillStyle = '#333';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    
    ctx.fillStyle = '#0f0';
    ctx.font = '24px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);
}

function drawMenu() {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = '#0f0';
    ctx.font = '50px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('SPACE INVADERS', CANVAS_WIDTH / 2, 100);

    drawButton('Iniciar Juego', CANVAS_WIDTH / 2 - 100, 200, 200, 50);
    drawButton('Tabla de Score', CANVAS_WIDTH / 2 - 100, 270, 200, 50);
    drawButton('Creditos', CANVAS_WIDTH / 2 - 100, 340, 200, 50);
}

function drawScoreboard() {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.fillStyle = '#0f0';
    ctx.font = '40px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('TABLA DE SCORE', CANVAS_WIDTH / 2, 100);
    
    ctx.font = '24px Courier New';
    ctx.fillText(`High Score: ${score}`, CANVAS_WIDTH / 2, 200); // Placeholder
    
    ctx.fillStyle = '#666';
    ctx.font = '20px Courier New';
    ctx.fillText('Click to return', CANVAS_WIDTH / 2, 500);
}

function drawCredits() {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.fillStyle = '#0f0';
    ctx.font = '40px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('CREDITOS', CANVAS_WIDTH / 2, 100);
    
    ctx.font = '24px Courier New';
    ctx.fillText('Created by Vibe Coding', CANVAS_WIDTH / 2, 250);
    ctx.fillText('Powered by Bun & TypeScript', CANVAS_WIDTH / 2, 300);
    
    ctx.fillStyle = '#666';
    ctx.font = '20px Courier New';
    ctx.fillText('Click to return', CANVAS_WIDTH / 2, 500);
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.fillStyle = 'red';
    ctx.font = '60px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    
    ctx.fillStyle = 'white';
    ctx.font = '30px Courier New';
    ctx.fillText(`Final Score: ${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
    
    ctx.font = '20px Courier New';
    ctx.fillText('Click to return to menu', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 120);
}

function draw() {
    if (currentState === GameState.MENU) {
        drawMenu();
    } else if (currentState === GameState.SCOREBOARD) {
        drawScoreboard();
    } else if (currentState === GameState.CREDITS) {
        drawCredits();
    } else if (currentState === GameState.PLAYING) {
        // Clear screen
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Draw Player
        if (player.image && player.image.complete) {
            ctx.drawImage(player.image, player.x, player.y, player.width, player.height);
        } else {
            ctx.fillStyle = 'green';
            ctx.fillRect(player.x, player.y, player.width, player.height);
        }

        // Draw Aliens
        aliens.forEach(alien => {
            if (alien.active) {
                if (alien.image && alien.image.complete) {
                    ctx.drawImage(alien.image, alien.x, alien.y, alien.width, alien.height);
                } else {
                    ctx.fillStyle = 'red';
                    ctx.fillRect(alien.x, alien.y, alien.width, alien.height);
                }
            }
        });

        // Draw Bullets
        ctx.fillStyle = 'white';
        bullets.forEach(bullet => {
            ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        });

        // Draw Score
        ctx.fillStyle = 'white';
        ctx.font = '20px Courier New';
        ctx.textAlign = 'left';
        ctx.fillText(`Score: ${score}`, 10, 30);
    } else if (currentState === GameState.GAME_OVER) {
        drawGameOver();
    }
}

function gameLoop(timestamp: number) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    update(deltaTime);
    draw();

    requestAnimationFrame(gameLoop);
}

// Start game when images are loaded (or just start, images will pop in)
init();
