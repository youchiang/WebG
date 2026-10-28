/**
 * Dynamic Floating Virtual Joystick for Mobile Single-Hand Control
 * Includes deadzone, spring-back, visual feedback, and desktop keyboard/mouse fallback.
 */

export class TouchJoystick {
  constructor(containerEl) {
    this.container = containerEl || document.body;

    // Output values: -1.0 to +1.0
    this.steer = 0;       // Horizontal: Left (-1) to Right (+1)
    this.throttle = 0;    // Vertical: Brake (-1) to Boost (+1)

    // Touch tracking
    this.isActive = false;
    this.touchId = null;
    this.originX = 0;
    this.originY = 0;
    this.currentX = 0;
    this.currentY = 0;

    this.maxRadius = 65; // px
    this.deadzone = 8;   // px

    // Visual Elements
    this.baseEl = null;
    this.nubEl = null;

    // Keyboard state fallback
    this.keys = { left: false, right: false, up: false, down: false };

    this.createDom();
    this.bindEvents();
  }

  createDom() {
    this.baseEl = document.createElement('div');
    this.baseEl.id = 'virtual-joystick-base';
    this.baseEl.className = 'joystick-base hidden';

    this.nubEl = document.createElement('div');
    this.nubEl.id = 'virtual-joystick-nub';
    this.nubEl.className = 'joystick-nub';

    this.baseEl.appendChild(this.nubEl);
    this.container.appendChild(this.baseEl);
  }

  bindEvents() {
    // Pointer down on lower 65% of screen
    window.addEventListener('pointerdown', (e) => {
      // Ignore if clicking UI buttons
      if (e.target.closest('button') || e.target.closest('.interactive-ui')) return;

      const screenH = window.innerHeight;
      // Allow joystick in lower 70% of screen
      if (e.clientY > screenH * 0.3) {
        this.isActive = true;
        this.touchId = e.pointerId;
        this.originX = e.clientX;
        this.originY = e.clientY;
        this.currentX = e.clientX;
        this.currentY = e.clientY;

        this.showJoystickAt(e.clientX, e.clientY);
      }
    }, { passive: false });

    window.addEventListener('pointermove', (e) => {
      if (!this.isActive || e.pointerId !== this.touchId) return;

      this.currentX = e.clientX;
      this.currentY = e.clientY;

      let dx = this.currentX - this.originX;
      let dy = this.currentY - this.originY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.deadzone) {
        this.steer = 0;
        this.throttle = 0;
        this.updateNub(0, 0);
        return;
      }

      // Clamp to max radius
      const clampedDist = Math.min(dist, this.maxRadius);
      const angle = Math.atan2(dy, dx);

      const clampedX = Math.cos(angle) * clampedDist;
      const clampedY = Math.sin(angle) * clampedDist;

      this.updateNub(clampedX, clampedY);

      // Normalized outputs
      this.steer = clampedX / this.maxRadius;
      // Invert Y so up is positive throttle/boost, down is brake
      this.throttle = -clampedY / this.maxRadius;
    }, { passive: false });

    const endTouch = (e) => {
      if (this.isActive && (e.pointerId === this.touchId || e.pointerId === undefined)) {
        this.isActive = false;
        this.touchId = null;
        this.steer = 0;
        this.throttle = 0;
        this.hideJoystick();
      }
    };

    window.addEventListener('pointerup', endTouch);
    window.addEventListener('pointercancel', endTouch);

    // Desktop Keyboard Fallback (WASD / Arrows)
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = true;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.up = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.down = true;
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = false;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.up = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.down = false;
    });
  }

  showJoystickAt(x, y) {
    if (!this.baseEl) return;
    this.baseEl.style.left = `${x}px`;
    this.baseEl.style.top = `${y}px`;
    this.baseEl.classList.remove('hidden');
    this.updateNub(0, 0);
  }

  updateNub(dx, dy) {
    if (!this.nubEl) return;
    this.nubEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  hideJoystick() {
    if (!this.baseEl) return;
    this.baseEl.classList.add('hidden');
    this.updateNub(0, 0);
  }

  getInputs() {
    // If touch active, use touch; otherwise fallback to keyboard
    if (this.isActive) {
      return { steer: this.steer, throttle: this.throttle };
    }

    let kSteer = 0;
    let kThrottle = 0;
    if (this.keys.left) kSteer -= 1;
    if (this.keys.right) kSteer += 1;
    if (this.keys.up) kThrottle += 1;
    if (this.keys.down) kThrottle -= 1;

    return { steer: kSteer, throttle: kThrottle };
  }
}
