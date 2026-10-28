/**
 * Constants and configuration for Drift Downhill 3D (下山大甩尾！)
 */

export const GAME_CONSTANTS = {
  // Road & Track parameters
  TRACK: {
    WIDTH: 14,                  // Total road width in units
    GUARD_RAIL_OFFSET: 7.2,     // Distance from centerline to guardrail
    SEGMENTS: 200,              // Spline resolution points
    SUMMIT_ELEVATION: 180,      // Summit height in units (Y axis)
    BASE_ELEVATION: 0,          // Base/finish height in units
    TOTAL_LENGTH_APPROX: 1800,  // Approx length
  },

  // Vehicle physics tuning
  VEHICLE: {
    LENGTH: 4.2,
    WIDTH: 2.0,
    HEIGHT: 1.3,
    MASS: 1100,
    BASE_ACCELERATION: 8.0,     // Downhill base forward drive (relaxed pace)
    GRAVITY_ACCEL: 4.5,         // Downhill gravity component
    MAX_SPEED: 24.0,            // Relaxed top speed (controllable on mobile)
    BOOST_SPEED: 32.0,          // Boost top speed
    MIN_SPEED: 6.5,             // Minimum crawl speed
    BRAKE_FORCE: 25.0,
    STEER_SENSITIVITY: 1.5,     // Lower, smoother steering sensitivity
    DRIFT_STEER_BOOST: 1.15,    // Gentle yaw response during drift
    DRIFT_STICK_THRESHOLD: 0.45,// Joystick horizontal deflection to initiate drift
    MAX_DRIFT_SLIP_ANGLE: 0.52, // Max slip angle (~30 deg, prevents 90-deg spinouts)
    SLIP_FRICTION_LATERAL: 0.92,// Good lateral grip for controllable drifts
    SKID_SMOKE_RATE: 0.06,      // Seconds between smoke particle emission
  },

  // Drift scoring weights
  DRIFT_SCORING: {
    MIN_DRIFT_ANGLE: 0.15,      // ~8.5 degrees slip angle threshold
    BASE_POINTS_PER_SEC: 250,
    ANGLE_EXPONENT: 1.3,
    EDGE_PROXIMITY_THRESHOLD: 2.0, // Near guardrail
    EDGE_BONUS_MULTIPLIER: 1.5,
    COMBO_TIMEOUT_SEC: 1.4,     // Seconds before combo chain drops
    MAX_COMBO: 5.0,
    COMBO_STEP: 0.3,
  },

  // Yeet Obstacle parameters
  OBSTACLES: {
    TYPES: {
      HUMAN: {
        id: 'human',
        name: '觀賽人',
        baseScore: 300,
        radius: 0.9,
        launchImpulse: 22,
        sfx: 'yeet_human',
        text: 'YEET! 人類起飛 +300',
        color: '#FF6B6B',
      },
      CAT: {
        id: 'cat',
        name: '看熱鬧的橘貓',
        baseScore: 600,
        radius: 0.7,
        launchImpulse: 26,
        sfx: 'yeet_cat',
        text: 'CAT ROCKET! 貓咪升空 +600 🚀',
        color: '#FFA94D',
      },
      SHIBA: {
        id: 'shiba',
        name: '好奇柴犬',
        baseScore: 450,
        radius: 0.8,
        launchImpulse: 24,
        sfx: 'yeet_dog',
        text: 'SHIBA SPIN! 旋轉柴柴 +450 🐕',
        color: '#FFD43B',
      },
      CONE: {
        id: 'cone',
        name: '三角錐群',
        baseScore: 120,
        radius: 0.6,
        launchImpulse: 18,
        sfx: 'yeet_cone',
        text: 'STRIKE! 三角錐全倒 +120 🎳',
        color: '#FF922B',
      },
      WATERMELON: {
        id: 'watermelon',
        name: '農產西瓜堆',
        baseScore: 500,
        radius: 1.0,
        launchImpulse: 20,
        sfx: 'yeet_melon',
        text: 'SPLASH! 西瓜大爆發 +500 🍉',
        color: '#51CF66',
      },
    },
  },

  // Color Palette (Light, pastel, soft Japanese anime low-poly aesthetic)
  COLORS: {
    SKY: 0xE4F1F9,              // Soft pale dreamy anime sky blue
    FOG: 0xEEF6FA,              // Milky soft horizon haze
    SUNLIGHT: 0xFFFAF0,         // Gentle warm sun (low contrast)
    AMBIENT: 0xF0F5F8,          // Cool-warm balanced ambient
    MOUNTAIN_GRASS: 0xCDE5C7,   // Soft creamy matcha green meadow
    MOUNTAIN_ROCK: 0xE4DFD7,    // Soft warm sandstone rock
    ROAD_ASPHALT: 0xDFE3E8,     // Clean matte ivory-slate road (anti-glare)
    ROAD_LINE_YELLOW: 0xFEE08B, // Soft warm butter yellow center dashes
    ROAD_CURB_RED: 0xFCA5A5,    // Pastel coral red curb
    ROAD_CURB_WHITE: 0xFAFBFD,  // Cream white curb
    GUARD_RAIL: 0xD5DFE8,       // Soft clean silver-gray rail
    CAR_PRIMARY: 0x38D9A9,      // Pastel mint turquoise body
    CAR_SECONDARY: 0xFAFBFD,    // Pure cream white roof/stripes
    CAR_GLASS: 0xBFDBFE,        // Soft pastel sky blue glass
    CAR_TAILLIGHT: 0xF87171,    // Soft red glow
    CAR_WHEEL: 0x475569,        // Soft slate dark wheel
  },

  // Screen Feel
  JUICE: {
    HIT_STOP_DURATION_MS: 40,   // Freeze frame duration on big impact
    MAX_TRAUMA: 1.0,
    TRAUMA_DECAY: 1.8,
    MAX_SHAKE_OFFSET: 0.6,
    MAX_SHAKE_ROLL: 0.04,
  },
};
