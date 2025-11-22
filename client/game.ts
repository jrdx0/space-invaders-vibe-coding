// Game Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SPEED = 5;
const BULLET_SPEED = 7;
const BASE_ALIEN_SPEED = 1;
const BASE_HEAVY_ALIEN_SPEED = 2;
const ALIEN_DROP_DISTANCE = 20;

// Types
enum GameState {
    MENU,
    PLAYING,
    SCOREBOARD,
    CREDITS,
    GAME_OVER,
    LEVEL_TRANSITION,
    PAUSED,
    NAME_INPUT
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
    type: 'normal' | 'heavy';
    hp: number;
}

interface ScoreEntry {
    name: string;
    score: number;
}

// Game State
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let currentState: GameState = GameState.MENU;
let player: GameObject;
let bullets: Bullet[] = [];
let aliens: Alien[] = [];
let heavyAliens: Alien[] = []; // Separate list for independent movement
let keys: { [key: string]: boolean } = {};
let lastTime = 0;
let alienDirection = 1; // 1 for right, -1 for left
let heavyAlienDirection = 1;
let score = 0;
let gameOver = false;
let currentLevel = 1;
let alienSpeed = BASE_ALIEN_SPEED;
let heavyAlienSpeed = BASE_HEAVY_ALIEN_SPEED;
let transitionTimer = 0;
let playerName = '';
const MAX_NAME_LENGTH = 10;

// Assets
const playerImg = new Image();
playerImg.src = '/assets/player.svg';
const alienImg = new Image();
alienImg.src = '/assets/alien.svg';
const alienPurpleImg = new Image();
alienPurpleImg.src = '/assets/alien_purple.svg';

function init() {
    canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    ctx = canvas.getContext('2d')!;

    resetGame();

    window.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        if (e.code === 'Escape') {
            if (currentState === GameState.PLAYING) {
                currentState = GameState.PAUSED;
            } else if (currentState === GameState.PAUSED) {
                currentState = GameState.PLAYING;
            }
        }
        
        if (currentState === GameState.NAME_INPUT) {
            if (e.key.length === 1 && playerName.length < MAX_NAME_LENGTH && /[a-zA-Z0-9]/.test(e.key)) {
                playerName += e.key.toUpperCase();
            } else if (e.key === 'Backspace') {
                playerName = playerName.slice(0, -1);
            } else if (e.key === 'Enter' && playerName.length > 0) {
                currentState = GameState.PLAYING;
                resetGame();
            }
        }
    });
    window.addEventListener('keyup', (e) => keys[e.code] = false);
    
    // Mouse handling for menu
    canvas.addEventListener('mousedown', handleMouseClick);

    requestAnimationFrame(gameLoop);
}

function resetGame(startNewGame: boolean = true) {
    if (startNewGame) {
        currentLevel = 1;
        score = 0;
    }
    
    // Calculate difficulty scaling
    alienSpeed = BASE_ALIEN_SPEED * (1 + (currentLevel - 1) * 0.3);
    heavyAlienSpeed = BASE_HEAVY_ALIEN_SPEED * (1 + (currentLevel - 1) * 0.3);
    
    player = {
        x: CANVAS_WIDTH / 2 - 20,
        y: CANVAS_HEIGHT - 60,
        width: 40,
        height: 40,
        image: playerImg
    };
    
    bullets = [];
    aliens = [];
    heavyAliens = [];
    gameOver = false;
    alienDirection = 1;
    heavyAlienDirection = 1;

    // Calculate number of enemies based on level
    const normalRows = Math.min(4 + Math.floor((currentLevel - 1) / 2), 6);
    const normalCols = Math.min(8 + Math.floor((currentLevel - 1) / 3), 10);
    const heavyCount = Math.min(3 + Math.floor((currentLevel - 1) / 2), 6);

    // Create Normal Aliens
    for (let row = 0; row < normalRows; row++) {
        for (let col = 0; col < normalCols; col++) {
            aliens.push({
                x: 80 + col * 60,
                y: 80 + row * 50,
                width: 40,
                height: 40,
                active: true,
                image: alienImg,
                type: 'normal',
                hp: 1
            });
        }
    }

    // Create Heavy Aliens (Boss row at the top)
    const heavySpacing = CANVAS_WIDTH / (heavyCount + 1);
    for (let i = 0; i < heavyCount; i++) {
        heavyAliens.push({
            x: heavySpacing * (i + 1) - 30,
            y: 20,
            width: 60,
            height: 60,
            active: true,
            image: alienPurpleImg,
            type: 'heavy',
            hp: 4 + Math.floor((currentLevel - 1) / 3) // HP increases every 3 levels
        });
    }
}

function handleMouseClick(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (currentState === GameState.MENU) {
        // Start Game
        if (isInside(mouseX, mouseY, CANVAS_WIDTH / 2 - 120, 250, 240, 60)) {
            currentState = GameState.NAME_INPUT;
            playerName = '';
        }
        // Scoreboard
        else if (isInside(mouseX, mouseY, CANVAS_WIDTH / 2 - 120, 330, 240, 60)) {
            currentState = GameState.SCOREBOARD;
        }
        // Credits
        else if (isInside(mouseX, mouseY, CANVAS_WIDTH / 2 - 120, 410, 240, 60)) {
            currentState = GameState.CREDITS;
        }
    } else if (currentState === GameState.PLAYING) {
        // Pause Button (Top Right)
        if (isInside(mouseX, mouseY, CANVAS_WIDTH - 40, 10, 30, 30)) {
            currentState = GameState.PAUSED;
        }
    } else if (currentState === GameState.PAUSED) {
        // Resume
        if (isInside(mouseX, mouseY, CANVAS_WIDTH / 2 - 100, 250, 200, 50)) {
            currentState = GameState.PLAYING;
        }
        // Menu
        else if (isInside(mouseX, mouseY, CANVAS_WIDTH / 2 - 100, 320, 200, 50)) {
            currentState = GameState.MENU;
            resetGame();
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
    if (currentState === GameState.LEVEL_TRANSITION) {
        transitionTimer += deltaTime;
        if (transitionTimer > 3000) { // 3 seconds
            transitionTimer = 0;
            currentLevel++;
            resetGame(false);
            currentState = GameState.PLAYING;
        }
        return;
    }
    
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

    // Update Normal Aliens
    let hitWall = false;
    aliens.forEach(alien => {
        if (!alien.active) return;
        alien.x += alienSpeed * alienDirection;
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

    // Update Heavy Aliens (Independent movement, faster)
    let heavyHitWall = false;
    heavyAliens.forEach(alien => {
        if (!alien.active) return;
        alien.x += heavyAlienSpeed * heavyAlienDirection;
        if (alien.x <= 0 || alien.x >= CANVAS_WIDTH - alien.width) {
            heavyHitWall = true;
        }
    });

    if (heavyHitWall) {
        heavyAlienDirection *= -1;
        heavyAliens.forEach(alien => {
            alien.y += ALIEN_DROP_DISTANCE;
        });
    }

    // Collision Detection
    bullets.forEach(bullet => {
        // Check Normal Aliens
        aliens.forEach(alien => {
            if (alien.active && bullet.active && rectIntersect(bullet, alien)) {
                alien.active = false;
                bullet.active = false;
                score += 10;
            }
        });

        // Check Heavy Aliens
        heavyAliens.forEach(alien => {
            if (alien.active && bullet.active && rectIntersect(bullet, alien)) {
                alien.hp--;
                bullet.active = false;
                if (alien.hp <= 0) {
                    alien.active = false;
                    score += 50; // More points for heavy
                }
            }
        });
    });

    // Game Over Check
    if (aliens.some(a => a.active && a.y + a.height >= player.y) || 
        heavyAliens.some(a => a.active && a.y + a.height >= player.y)) {
        gameOver = true;
        saveScore(playerName, score);
    }
    
    // Level Complete Check
    if (aliens.every(a => !a.active) && heavyAliens.every(a => !a.active)) {
        currentState = GameState.LEVEL_TRANSITION;
        transitionTimer = 0;
    }
}

function rectIntersect(r1: GameObject, r2: GameObject) {
    return !(r2.x > r1.x + r1.width ||
             r2.x + r2.width < r1.x ||
             r2.y > r1.y + r1.height ||
             r2.y + r2.height < r1.y);
}

function saveScore(name: string, score: number) {
    const scores: ScoreEntry[] = JSON.parse(localStorage.getItem('space_invaders_scores') || '[]');
    scores.push({ name, score });
    scores.sort((a, b) => b.score - a.score);
    // Keep top 5
    if (scores.length > 5) scores.length = 5;
    localStorage.setItem('space_invaders_scores', JSON.stringify(scores));
}

function getHighScores(): ScoreEntry[] {
    return JSON.parse(localStorage.getItem('space_invaders_scores') || '[]');
}

function drawButton(text: string, x: number, y: number, w: number, h: number, hovered: boolean = false) {
    // Gradient background
    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    if (hovered) {
        gradient.addColorStop(0, '#00ff88');
        gradient.addColorStop(1, '#00aa55');
    } else {
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#0f0f1e');
    }
    
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, w, h);
    
    // Glowing border
    ctx.shadowBlur = hovered ? 20 : 10;
    ctx.shadowColor = '#00ff88';
    ctx.strokeStyle = hovered ? '#00ffaa' : '#00aa66';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    ctx.shadowBlur = 0;
    
    // Inner highlight
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    
    // Text
    ctx.fillStyle = hovered ? '#ffffff' : '#00ff88';
    ctx.font = 'bold 24px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = hovered ? 10 : 0;
    ctx.shadowColor = '#00ff88';
    ctx.fillText(text, x + w / 2, y + h / 2);
    ctx.shadowBlur = 0;
}

function drawStarfield() {
    // Animated starfield background
    const time = Date.now() * 0.0001;
    for (let i = 0; i < 100; i++) {
        const x = (i * 123.456) % CANVAS_WIDTH;
        const y = ((i * 789.012 + time * 20) % CANVAS_HEIGHT);
        const size = (i % 3) + 1;
        const alpha = 0.3 + (i % 7) * 0.1;
        
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(x, y, size, size);
    }
}

function drawMenu() {
    // Deep space background
    const bgGradient = ctx.createRadialGradient(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH);
    bgGradient.addColorStop(0, '#0a0a1e');
    bgGradient.addColorStop(1, '#000000');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Starfield
    drawStarfield();
    
    // Title with glow effect
    const time = Date.now() * 0.001;
    const pulse = Math.sin(time * 2) * 0.3 + 0.7;
    
    ctx.shadowBlur = 30 * pulse;
    ctx.shadowColor = '#00ff88';
    
    // Title gradient
    const titleGradient = ctx.createLinearGradient(0, 60, 0, 140);
    titleGradient.addColorStop(0, '#00ffaa');
    titleGradient.addColorStop(0.5, '#00ff88');
    titleGradient.addColorStop(1, '#00aa66');
    
    ctx.fillStyle = titleGradient;
    ctx.font = 'bold 64px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('SPACE', CANVAS_WIDTH / 2, 90);
    ctx.fillText('INVADERS', CANVAS_WIDTH / 2, 150);
    
    // Subtitle
    ctx.shadowBlur = 5;
    ctx.fillStyle = '#00aa66';
    ctx.font = '16px Courier New';
    ctx.fillText('[ RETRO EDITION ]', CANVAS_WIDTH / 2, 180);
    ctx.shadowBlur = 0;
    
    // Decorative lines
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2 - 150, 200);
    ctx.lineTo(CANVAS_WIDTH / 2 + 150, 200);
    ctx.stroke();
    
    // Buttons
    drawButton('INICIAR JUEGO', CANVAS_WIDTH / 2 - 120, 250, 240, 60);
    drawButton('TABLA DE SCORE', CANVAS_WIDTH / 2 - 120, 330, 240, 60);
    drawButton('CREDITOS', CANVAS_WIDTH / 2 - 120, 410, 240, 60);
    
    // Footer text
    ctx.fillStyle = 'rgba(0, 170, 102, 0.5)';
    ctx.font = '14px Courier New';
    ctx.fillText('Click para seleccionar', CANVAS_WIDTH / 2, 520);
    
    // Animated alien sprites in corners
    const alienScale = 0.5;
    if (alienImg.complete) {
        ctx.globalAlpha = 0.3;
        ctx.drawImage(alienImg, 50, 50, 40 * alienScale, 40 * alienScale);
        ctx.drawImage(alienImg, CANVAS_WIDTH - 70, 50, 40 * alienScale, 40 * alienScale);
        ctx.globalAlpha = 1;
    }
}

function drawScoreboard() {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    drawStarfield();

    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00ff88';
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 40px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('TABLA DE SCORE', CANVAS_WIDTH / 2, 100);
    ctx.shadowBlur = 0;
    
    const scores = getHighScores();
    ctx.font = '24px Courier New';
    ctx.fillStyle = '#ffffff';
    
    if (scores.length === 0) {
        ctx.fillText('No scores yet!', CANVAS_WIDTH / 2, 250);
    } else {
        scores.forEach((entry, index) => {
            ctx.textAlign = 'left';
            ctx.fillText(`${index + 1}. ${entry.name}`, CANVAS_WIDTH / 2 - 150, 200 + index * 50);
            ctx.textAlign = 'right';
            ctx.fillText(`${entry.score}`, CANVAS_WIDTH / 2 + 150, 200 + index * 50);
        });
    }
    
    ctx.textAlign = 'center';
    ctx.fillStyle = '#666';
    ctx.font = '20px Courier New';
    ctx.fillText('Click to return', CANVAS_WIDTH / 2, 550);
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

function drawLevelTransition() {
    // Background with starfield
    const bgGradient = ctx.createRadialGradient(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH);
    bgGradient.addColorStop(0, '#0a0a1e');
    bgGradient.addColorStop(1, '#000000');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    drawStarfield();
    
    // Pulsing effect
    const pulse = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;
    
    // Level complete message
    ctx.shadowBlur = 20 * pulse;
    ctx.shadowColor = '#00ff88';
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 48px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('NIVEL COMPLETADO!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80);
    
    // Next level info
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#00ffaa';
    ctx.font = 'bold 36px Courier New';
    ctx.fillText(`NIVEL ${currentLevel}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    
    // Stats
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#00aa66';
    ctx.font = '20px Courier New';
    ctx.fillText(`Score: ${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
    
    // Loading bar
    const barWidth = 300;
    const barHeight = 20;
    const barX = CANVAS_WIDTH / 2 - barWidth / 2;
    const barY = CANVAS_HEIGHT / 2 + 100;
    const progress = Math.min(transitionTimer / 3000, 1);
    
    ctx.fillStyle = 'rgba(0, 255, 136, 0.2)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    
    const progressGradient = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
    progressGradient.addColorStop(0, '#00ff88');
    progressGradient.addColorStop(1, '#00aa55');
    ctx.fillStyle = progressGradient;
    ctx.fillRect(barX, barY, barWidth * progress, barHeight);
    
    ctx.fillStyle = '#00aa66';
    ctx.font = '14px Courier New';
    ctx.fillText('Preparando siguiente nivel...', CANVAS_WIDTH / 2, barY + 40);
}

function drawPaused() {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Title
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00ff88';
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 48px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', CANVAS_WIDTH / 2, 150);
    ctx.shadowBlur = 0;
    
    drawButton('RESUME', CANVAS_WIDTH / 2 - 100, 250, 200, 50);
    drawButton('MENU', CANVAS_WIDTH / 2 - 100, 320, 200, 50);
}

function drawNameInput() {
    // Background
    const bgGradient = ctx.createRadialGradient(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH);
    bgGradient.addColorStop(0, '#0a0a1e');
    bgGradient.addColorStop(1, '#000000');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    drawStarfield();
    
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00ff88';
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 40px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('ENTER YOUR NAME', CANVAS_WIDTH / 2, 200);
    ctx.shadowBlur = 0;
    
    // Input box
    ctx.fillStyle = 'rgba(0, 255, 136, 0.1)';
    ctx.fillRect(CANVAS_WIDTH / 2 - 150, 250, 300, 60);
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.strokeRect(CANVAS_WIDTH / 2 - 150, 250, 300, 60);
    
    // Name text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Courier New';
    ctx.fillText(playerName + (Math.floor(Date.now() / 500) % 2 === 0 ? '_' : ''), CANVAS_WIDTH / 2, 290);
    
    ctx.fillStyle = '#00aa66';
    ctx.font = '16px Courier New';
    ctx.fillText('PRESS ENTER TO START', CANVAS_WIDTH / 2, 350);
}

function draw() {
    if (currentState === GameState.MENU) {
        drawMenu();
    } else if (currentState === GameState.NAME_INPUT) {
        drawNameInput();
    } else if (currentState === GameState.SCOREBOARD) {
        drawScoreboard();
    } else if (currentState === GameState.CREDITS) {
        drawCredits();
    } else if (currentState === GameState.LEVEL_TRANSITION) {
        drawLevelTransition();
    } else if (currentState === GameState.PLAYING || currentState === GameState.PAUSED) {
        // Animated background
        const bgGradient = ctx.createRadialGradient(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH);
        bgGradient.addColorStop(0, '#0a0a1e');
        bgGradient.addColorStop(1, '#000000');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Subtle starfield
        drawStarfield();
        
        // Grid lines for depth
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i < CANVAS_HEIGHT; i += 40) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(CANVAS_WIDTH, i);
            ctx.stroke();
        }

        // Draw Player with glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00ff88';
        if (player.image && player.image.complete) {
            ctx.drawImage(player.image, player.x, player.y, player.width, player.height);
        } else {
            ctx.fillStyle = '#00ff88';
            ctx.fillRect(player.x, player.y, player.width, player.height);
        }
        ctx.shadowBlur = 0;

        // Draw Normal Aliens with subtle glow
        aliens.forEach(alien => {
            if (alien.active) {
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#ff3366';
                if (alien.image && alien.image.complete) {
                    ctx.drawImage(alien.image, alien.x, alien.y, alien.width, alien.height);
                } else {
                    ctx.fillStyle = '#ff3366';
                    ctx.fillRect(alien.x, alien.y, alien.width, alien.height);
                }
                ctx.shadowBlur = 0;
            }
        });

        // Draw Heavy Aliens with stronger glow
        heavyAliens.forEach(alien => {
            if (alien.active) {
                ctx.shadowBlur = 12;
                ctx.shadowColor = '#9933ff';
                if (alien.image && alien.image.complete) {
                    ctx.drawImage(alien.image, alien.x, alien.y, alien.width, alien.height);
                } else {
                    ctx.fillStyle = '#9933ff';
                    ctx.fillRect(alien.x, alien.y, alien.width, alien.height);
                }
                ctx.shadowBlur = 0;
                
                // Enhanced HP bar with background
                const hpBarY = alien.y - 8;
                const hpBarHeight = 4;
                
                // Background
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(alien.x - 2, hpBarY - 1, alien.width + 4, hpBarHeight + 2);
                
                // HP bar border
                ctx.strokeStyle = '#666';
                ctx.lineWidth = 1;
                ctx.strokeRect(alien.x, hpBarY, alien.width, hpBarHeight);
                
                // HP fill with gradient
                const hpPercent = alien.hp / 4;
                const hpGradient = ctx.createLinearGradient(alien.x, hpBarY, alien.x + alien.width, hpBarY);
                if (hpPercent > 0.5) {
                    hpGradient.addColorStop(0, '#00ff00');
                    hpGradient.addColorStop(1, '#88ff00');
                } else if (hpPercent > 0.25) {
                    hpGradient.addColorStop(0, '#ffaa00');
                    hpGradient.addColorStop(1, '#ff8800');
                } else {
                    hpGradient.addColorStop(0, '#ff0000');
                    hpGradient.addColorStop(1, '#cc0000');
                }
                ctx.fillStyle = hpGradient;
                ctx.fillRect(alien.x, hpBarY, alien.width * hpPercent, hpBarHeight);
            }
        });

        // Draw Bullets with glow and trail
        bullets.forEach(bullet => {
            // Glow effect
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00ffff';
            
            // Bullet gradient
            const bulletGradient = ctx.createLinearGradient(bullet.x, bullet.y, bullet.x, bullet.y + bullet.height);
            bulletGradient.addColorStop(0, '#ffffff');
            bulletGradient.addColorStop(0.5, '#00ffff');
            bulletGradient.addColorStop(1, '#0088ff');
            ctx.fillStyle = bulletGradient;
            ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
            
            // Trail
            ctx.shadowBlur = 5;
            ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
            ctx.fillRect(bullet.x, bullet.y + bullet.height, bullet.width, 8);
            ctx.shadowBlur = 0;
        });

        // HUD Panel
        const hudHeight = 50;
        const hudGradient = ctx.createLinearGradient(0, 0, 0, hudHeight);
        hudGradient.addColorStop(0, 'rgba(10, 10, 30, 0.9)');
        hudGradient.addColorStop(1, 'rgba(5, 5, 15, 0.95)');
        ctx.fillStyle = hudGradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, hudHeight);
        
        // HUD border
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, hudHeight);
        ctx.lineTo(CANVAS_WIDTH, hudHeight);
        ctx.stroke();
        
        // Score panel
        ctx.fillStyle = 'rgba(0, 255, 136, 0.1)';
        ctx.fillRect(10, 10, 200, 30);
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, 200, 30);
        
        ctx.fillStyle = '#00ff88';
        ctx.font = 'bold 20px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`SCORE: ${score}`, 110, 25);
        
        // Level indicator (center)
        ctx.fillStyle = 'rgba(0, 170, 255, 0.1)';
        ctx.fillRect(CANVAS_WIDTH / 2 - 60, 10, 120, 30);
        ctx.strokeStyle = '#00aaff';
        ctx.lineWidth = 2;
        ctx.strokeRect(CANVAS_WIDTH / 2 - 60, 10, 120, 30);
        
        ctx.fillStyle = '#00aaff';
        ctx.font = 'bold 20px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`LVL ${currentLevel}`, CANVAS_WIDTH / 2, 25);
        
        // Enemy counter
        const activeAliens = aliens.filter(a => a.active).length;
        const activeHeavy = heavyAliens.filter(a => a.active).length;
        
        ctx.fillStyle = 'rgba(255, 51, 102, 0.1)';
        ctx.fillRect(CANVAS_WIDTH - 250, 10, 200, 30);
        ctx.strokeStyle = '#ff3366';
        ctx.lineWidth = 2;
        ctx.strokeRect(CANVAS_WIDTH - 250, 10, 200, 30);
        
        ctx.fillStyle = '#ff3366';
        ctx.font = 'bold 16px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`👾 ${activeAliens}  💀 ${activeHeavy}`, CANVAS_WIDTH - 150, 25);

        // Pause Button
        const pauseX = CANVAS_WIDTH - 40;
        const pauseY = 10;
        const pauseSize = 30;
        
        ctx.fillStyle = 'rgba(0, 255, 136, 0.1)';
        ctx.fillRect(pauseX, pauseY, pauseSize, pauseSize);
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.strokeRect(pauseX, pauseY, pauseSize, pauseSize);
        
        // Pause Icon (II)
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(pauseX + 8, pauseY + 6, 4, 18);
        ctx.fillRect(pauseX + 18, pauseY + 6, 4, 18);

        if (currentState === GameState.PAUSED) {
            drawPaused();
        }
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
