class AestheticTree {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        this.config = {
            trunkColor: 'rgb(60, 40, 30)',
            bloomColors: [
                'rgba(255, 183, 197, 0.95)',
                'rgba(255, 220, 230, 0.95)',
                'rgba(255, 240, 245, 0.95)',
                'rgba(255, 192, 203, 0.9)'
            ],
            // Branching
            maxDepth: 10,
            branchProb: 0.7,

            // Aesthetics
            taper: 0.75,
            jitter: 0.1,
            curl: 0.05,

            // Animation
            growSpeed: 1.0,
            swaySpeed: 0.001,
            swayAmp: 0.003,

            // Falling Leaves
            windSpeed: 0.8, // Increased wind for wider flow
            gravity: 0.4,   // Slightly faster fall
            fallingLeafLimit: 100 // Cap max falling leaves to prevent covering screen
        };

        this.root = null;
        this.fallingBlooms = [];
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.fallingBlooms = [];
        this.initTree();
    }

    initTree() {
        // Position: 2% from left, Bottom aligned
        const x = this.canvas.width * 0.02;
        const y = this.canvas.height;
        const trunkLen = Math.min(this.canvas.height, this.canvas.width) * 0.22;
        const trunkWidth = 24;

        this.root = this.createBranch(x, y, -Math.PI / 2, trunkLen, trunkWidth, 0);
    }

    createBranch(x, y, angle, length, width, depth) {
        const branch = {
            x, y, angle, length, width, depth,
            currentLen: 0,
            curveControl: (Math.random() - 0.5) * 0.5 * length,
            children: [],
            blooms: []
        };

        // Recurse
        if (depth < this.config.maxDepth) {
            const subBranches = Math.random() > 0.4 ? 2 : 3;

            for (let i = 0; i < subBranches; i++) {
                const newLen = length * (0.65 + Math.random() * 0.25);
                const newWidth = width * this.config.taper;
                const spread = 1.0;
                const angleVariation = (Math.random() - 0.5) * spread;
                const bias = -0.05 * (angle + Math.PI / 2);

                branch.children.push(
                    this.createBranch(0, 0, angle + angleVariation + bias, newLen, newWidth, depth + 1)
                );
            }
        }

        // Add blooms to THIS branch?
        // Logic: Add blooms if we are near the end OR randomly on intermediate branches
        // Start allowing blooms from depth > 4 (lower branches)
        if (depth >= 4) {
            // Higher probability at higher depth
            const bloomProb = (depth - 3) / (this.config.maxDepth - 3); // 0.1 to 1.0
            if (Math.random() < bloomProb || branch.children.length === 0) {
                this.createBlooms(branch);
            }
        }

        return branch;
    }

    createBlooms(branch) {
        // Newer branches get more blooms
        const count = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < count; i++) {
            branch.blooms.push({
                angle: (Math.random() - 0.5) * Math.PI * 2,
                dist: Math.random() * 15,
                size: 0,
                targetSize: 6 + Math.random() * 7,
                color: this.config.bloomColors[Math.floor(Math.random() * this.config.bloomColors.length)],
                growthRate: 0.05 + Math.random() * 0.05,

                // Falling Logic
                isFalling: false,
                x: 0,
                y: 0,
                vx: 0,
                vy: 0
            });
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const time = Date.now();
        const sway = Math.sin(time * this.config.swaySpeed) * this.config.swayAmp;

        if (this.root) {
            this.drawBranch(this.root, this.root.x, this.root.y, this.root.angle, sway);
        }

        this.drawFallingBlooms();
        requestAnimationFrame(this.animate);
    }

    drawBranch(branch, startX, startY, parentAngle, sway) {
        if (branch.currentLen < branch.length) {
            branch.currentLen += 2 * this.config.growSpeed;
            if (branch.currentLen > branch.length) branch.currentLen = branch.length;
        }

        const mySway = sway * (branch.depth + 1);
        const effectiveAngle = branch.angle + mySway;

        const endX = startX + Math.cos(effectiveAngle) * branch.currentLen;
        const endY = startY + Math.sin(effectiveAngle) * branch.currentLen;

        const cpX = (startX + endX) / 2 + Math.cos(effectiveAngle + Math.PI / 2) * branch.curveControl * (branch.currentLen / branch.length);
        const cpY = (startY + endY) / 2 + Math.sin(effectiveAngle + Math.PI / 2) * branch.curveControl * (branch.currentLen / branch.length);

        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.quadraticCurveTo(cpX, cpY, endX, endY);
        this.ctx.strokeStyle = this.config.trunkColor;
        this.ctx.lineWidth = branch.width;
        this.ctx.lineCap = 'round';
        this.ctx.stroke();

        // Optimized Recursion/Drawing
        if (branch.currentLen > branch.length * 0.4 && branch.width > 0.5) {
            branch.children.forEach(child => {
                this.drawBranch(child, endX, endY, child.angle, sway);
            });

            // Draw blooms along the branch
            if (branch.currentLen >= branch.length) {
                for (let i = branch.blooms.length - 1; i >= 0; i--) {
                    const bloom = branch.blooms[i];

                    if (!bloom.isFalling) {
                        // Chance to fall
                        // Logic: Only fall if we haven't hit limit
                        if (this.fallingBlooms.length < this.config.fallingLeafLimit && Math.random() < 0.0003) {
                            bloom.isFalling = true;
                            // World position approximation (using end of branch for simplicity)
                            // Better: Interpolate along branch length? No, end is fine.
                            const bx = endX + Math.cos(bloom.angle) * bloom.dist;
                            const by = endY + Math.sin(bloom.angle) * bloom.dist;

                            bloom.x = bx;
                            bloom.y = by;
                            // Randomize initial velocity
                            bloom.vx = this.config.windSpeed * (1 + Math.random());
                            bloom.vy = this.config.gravity + Math.random() * 0.5;

                            this.fallingBlooms.push(bloom);
                            branch.blooms.splice(i, 1);
                        } else {
                            // Draw attached
                            if (bloom.size < bloom.targetSize) bloom.size += bloom.growthRate;

                            const bx = endX + Math.cos(bloom.angle) * bloom.dist;
                            const by = endY + Math.sin(bloom.angle) * bloom.dist;

                            this.ctx.beginPath();
                            this.ctx.fillStyle = bloom.color;
                            this.ctx.arc(bx, by, bloom.size, 0, Math.PI * 2);
                            this.ctx.fill();
                        }
                    }
                }
            }
        }
    }

    drawFallingBlooms() {
        for (let i = this.fallingBlooms.length - 1; i >= 0; i--) {
            const b = this.fallingBlooms[i];

            b.x += b.vx;
            b.y += b.vy;
            b.x += Math.sin(b.y * 0.02) * 0.5; // Gentle flutter

            this.ctx.beginPath();
            this.ctx.fillStyle = b.color;
            this.ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
            this.ctx.fill();

            // Remove if way off screen
            if (b.y > this.canvas.height + 50 || b.x > this.canvas.width + 50) {
                this.fallingBlooms.splice(i, 1);
            }
        }
    }
}

window.addEventListener('load', () => {
    new AestheticTree('treeCanvas');
});
