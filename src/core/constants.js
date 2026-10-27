// Core BWF Court Specifications & Palette Constants
export const COURT_SPEC = {
  length: 13.4,
  halfLength: 6.7,
  width: 6.1,
  halfWidth: 3.05,
  singlesWidth: 5.18,
  halfSinglesWidth: 2.59,
  shortServiceDist: 1.98,
  doublesLongServiceDist: 5.94, // 6.70 - 0.76
  lineWidth: 0.04,
  netHeightPosts: 1.55,
  netHeightCenter: 1.524,
  netBottomHeight: 0.76,
  palette: {
    courtMat: '#98C9A3',
    woodFloor: '#F3E9DC',
    woodFloorAlt: '#EAD7C3',
    lines: '#FFFFFF',
    walls: '#9FB3C8',
    dadoWall: '#5C7C99',
    acousticSlat: '#D4B996',
    aBoards: '#4F7393',
  },
};

export const HYSTERESIS_PX = 15;
export const CURSOR_LIMIT_X = 360;
export const CURSOR_LIMIT_Y = 220;

// Badminton Aerodynamics & Aeromechanical Constants (Milestone 2)
export const SHUTTLE_PHYSICS = {
  mass: 0.005,             // 5.0 grams tournament feather shuttlecock
  dragCoeff: 0.215,        // Quadratic air drag coefficient: a_drag = -C_drag * |v| * v
  gravity: 9.81,           // Downward gravitational acceleration (m/s^2)
  subSteps: 4,             // 4x sub-stepping per 60Hz physics tick (240Hz sub-step)
  turnoverDuration: 0.04,  // 40ms nose-forward turnaround transition after racket strike
  netCatenaryPosts: 1.55,  // Post height (m)
  netCatenaryCenter: 1.524,// Center dip height (m)
  netTapeThickness: 0.05,  // Top 50mm cord deflection zone
  floorY: 0.04,            // Floor contact collision plane
  singlesHalfWidth: 2.59,  // Singles sideline boundary
  doublesHalfWidth: 3.05,  // Doubles sideline boundary
  courtHalfLength: 6.70,   // Baseline boundary
};

// Realistic Shot Trajectory Presets (BWF tournament flight curves calibrated for C_drag = 0.215 m^-1)
export const SHOT_PRESETS = {
  CLEAR: {
    name: '高遠球 Clear',
    type: 'CLEAR',
    speed: 35.5,           // High deep clear (m/s), drops steeply at back baseline (z ≈ +5.8m)
    elevationDeg: 31.0,    // High launch angle (peak height ~4.4m)
    azimuthDeg: 0.0,       // Straight along Z
    defaultOpponentPos: [0.0, 2.15, -4.2],
    defaultPlayerPos: [0.0, 2.15, 4.2],
    outlineState: 'normal_navy',
  },
  SMASH: {
    name: '重殺球 Smash',
    type: 'SMASH',
    speed: 68.0,           // High-speed smash (m/s) (~245 km/h), slams mid-court (z ≈ +2.45m)
    elevationDeg: -24.5,   // Steep downward intercept clearing net at ~1.61m
    azimuthDeg: 0.0,
    defaultOpponentPos: [0.0, 2.95, -2.6],
    defaultPlayerPos: [0.0, 2.95, 2.6],
    outlineState: 'smash_flame',
  },
  ATTACKING_CLEAR: {
    name: '平高球 Attacking Clear',
    type: 'ATTACKING_CLEAR',
    speed: 32.5,           // Fast attacking clear (m/s), flatter arc to backcourt (z ≈ +5.1m)
    elevationDeg: 23.0,    // Flatter trajectory rushing opponent
    azimuthDeg: 0.0,
    defaultOpponentPos: [0.0, 2.25, -3.8],
    defaultPlayerPos: [0.0, 2.25, 3.8],
    outlineState: 'normal_navy',
  },
  DROP: {
    name: '切球/吊球 Drop',
    type: 'DROP',
    speed: 13.8,           // Sliced touch shot (m/s), drops in front court (z ≈ +1.85m)
    elevationDeg: 7.5,     // Gentle arc skimming close to net
    azimuthDeg: -2.0,
    defaultOpponentPos: [0.25, 2.48, -3.2],
    defaultPlayerPos: [-0.25, 2.48, 3.2],
    outlineState: 'drop_cyan',
  },
  DRIVE: {
    name: '平抽球 Drive',
    type: 'DRIVE',
    speed: 22.0,           // Flat fast drive (m/s), lands mid-court (z ≈ +2.95m)
    elevationDeg: 4.5,     // Low skimming angle
    azimuthDeg: -3.0,      // Slight diagonal angle
    defaultOpponentPos: [0.35, 1.65, -2.8],
    defaultPlayerPos: [-0.35, 1.65, 2.8],
    outlineState: 'normal_navy',
  },
  NET_SHOT: {
    name: '網前放網 Net Shot',
    type: 'NET_SHOT',
    speed: 5.2,            // Delicate spinning tumble (m/s), lands tight past net (z ≈ +1.25m)
    elevationDeg: 32.0,    // Soft upward lift over 1.524m net tape
    azimuthDeg: 3.0,
    defaultOpponentPos: [-0.25, 1.38, -0.85],
    defaultPlayerPos: [0.25, 1.38, 0.85],
    outlineState: 'drop_cyan',
  },
  LIFT: {
    name: '網前挑球 Lift',
    type: 'LIFT',
    speed: 34.0,           // Defensive high underhand lift (m/s)
    elevationDeg: 38.5,    // High trajectory out of deep net corner (peak height ~4.2m)
    azimuthDeg: 0.0,
    defaultOpponentPos: [0.25, 0.85, -1.2],
    defaultPlayerPos: [-0.25, 0.85, 1.2],
    outlineState: 'normal_navy',
  },
};
