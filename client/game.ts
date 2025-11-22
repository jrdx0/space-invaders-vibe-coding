// Game Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SPEED = 5;
const BULLET_SPEED = 7;
const ALIEN_SPEED = 1;
const ALIEN_DROP_DISTANCE = 20;

// Types
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

    player = {
        x: CANVAS_WIDTH / 2 - 20,
        y: CANVAS_HEIGHT - 60,
        width: 40,
        height: 40,
        image: playerImg
    };

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

    window.addEventListener('keydown', (e) => keys[e.code] = true);
    window.addEventListener('keyup', (e) => keys[e.code] = false);

    requestAnimationFrame(gameLoop);
}

function update(deltaTime: number) {
    if (gameOver) return;

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
}

function rectIntersect(r1: GameObject, r2: GameObject) {
    return !(r2.x > r1.x + r1.width ||
             r2.x + r2.width < r1.x ||
             r2.y > r1.y + r1.height ||
             r2.y + r2.height < r1.y);
}

function draw() {
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
    ctx.fillText(`Score: ${score}`, 10, 30);

    if (gameOver) {
        ctx.fillStyle = 'red';
        ctx.font = '40px Courier New';
        ctx.fillText('GAME OVER', CANVAS_WIDTH / 2 - 100, CANVAS_HEIGHT / 2);
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
