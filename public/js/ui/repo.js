import { showToast, showConfirm } from './dialog.js';
import { GiftDropdown } from './components/GiftDropdown.js';
import { makeGiftCell, makeActionCell } from './components/GiftActionButtons.js';

const REPO_EFFECTS = [
    // Player
    { id: 'player_heal',          name: 'Heal',              category: 'Player',   desc: '+100 health',           timed: false },
    { id: 'player_hurt',          name: 'Hurt',              category: 'Player',   desc: '-25 health',            timed: false },
    { id: 'player_kill',          name: 'Kill',              category: 'Player',   desc: 'Instant death',         timed: false },
    { id: 'player_refill_energy', name: 'Refill Stamina',    category: 'Player',   desc: 'Full stamina',          timed: false },
    { id: 'player_drain_energy',  name: 'Drain Stamina',     category: 'Player',   desc: 'Zero stamina',          timed: false },
    // Toggle/Timed
    { id: 'player_invincible',    name: 'Invincible',        category: 'Toggle',   desc: 'God mode',              timed: true  },
    { id: 'player_infinitestam',  name: 'Infinite Stamina',  category: 'Toggle',   desc: 'Infinite stamina',      timed: true  },
    { id: 'player_disableinput',  name: 'Disable Input',     category: 'Toggle',   desc: 'Freeze controls',       timed: true  },
    { id: 'player_disablecrouch', name: 'Disable Crouch',    category: 'Toggle',   desc: "Can't crouch",          timed: true  },
    // Movement
    { id: 'player_fast',                       name: 'Speed Boost',          category: 'Movement', desc: '2× speed',              timed: true  },
    { id: 'player_slow',                       name: 'Slow',                 category: 'Movement', desc: '0.5× speed',            timed: true  },
    { id: 'player_antigravity',                name: 'Anti Gravity',         category: 'Movement', desc: 'Float',                 timed: true  },
    { id: 'player_teleport_random',            name: 'TP to Random Player',  category: 'Movement', desc: 'TP to a random player', timed: false },
    { id: 'player_teleport_extraction',        name: 'TP to Extraction',     category: 'Movement', desc: 'TP to nearest exit',    timed: false },
    { id: 'player_teleport_truck',             name: 'TP to Truck',          category: 'Movement', desc: 'TP back to truck',      timed: false },
    { id: 'player_teleport_room',              name: 'TP to Random Room',    category: 'Movement', desc: 'TP to random level point', timed: false },
    // Voice
    { id: 'playerPitch_high', name: 'High Pitch',  category: 'Voice', desc: 'Chipmunk voice', timed: true },
    { id: 'playerPitch_low',  name: 'Low Pitch',   category: 'Voice', desc: 'Deep voice',     timed: true },
    // Upgrades
    { id: 'player_upgrade_energy',       name: 'Upgrade Energy',       category: 'Upgrade', desc: 'Upgrade stamina bar',    timed: false },
    { id: 'player_upgrade_health',       name: 'Upgrade Health',       category: 'Upgrade', desc: 'Upgrade max HP',         timed: false },
    { id: 'player_upgrade_jump',         name: 'Upgrade Jump',         category: 'Upgrade', desc: 'Extra jump upgrade',     timed: false },
    { id: 'player_upgrade_grabrange',    name: 'Upgrade Grab Range',   category: 'Upgrade', desc: 'Longer grab range',      timed: false },
    { id: 'player_upgrade_grabstrength', name: 'Upgrade Grab Strength',category: 'Upgrade', desc: 'Stronger grab',          timed: false },
    { id: 'player_upgrade_sprint',       name: 'Upgrade Sprint',       category: 'Upgrade', desc: 'Faster sprint speed',    timed: false },
    { id: 'player_upgrade_throw',        name: 'Upgrade Throw',        category: 'Upgrade', desc: 'Stronger throw',         timed: false },
    { id: 'player_upgrade_tumble',       name: 'Upgrade Tumble',       category: 'Upgrade', desc: 'Better tumble launch',   timed: false },
    { id: 'player_upgrade_map',          name: 'Upgrade Map',          category: 'Upgrade', desc: 'Expand map player count',timed: false },
    // World
    { id: 'revive_all',           name: 'Revive All',            category: 'World', desc: 'Revives all dead players',   timed: false },
    { id: 'closeAllDoors',        name: 'Close All Doors',       category: 'World', desc: 'Slams every door',         timed: false },
    { id: 'increase_haul_goal',   name: 'Increase Quota (1.5x)', category: 'World', desc: 'Multiplies quota by 1.5',  timed: false },
    { id: 'decrease_haul_goal',   name: 'Decrease Quota (0.5x)', category: 'World', desc: 'Multiplies quota by 0.5',  timed: false },
    { id: 'destroy_random_item',  name: 'Destroy Random Item',   category: 'World', desc: 'Destroys a random valuable',timed: false },
    
    // --- Item Spawns (Full List) ---
    { id: 'spawncollectable_ItemHealthPackLarge',    name: 'Health Pack (L)',   category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemHealthPackMedium',   name: 'Health Pack (M)',   category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemHealthPackSmall',    name: 'Health Pack (S)',   category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemGunHandgun',         name: 'Handgun',           category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemGunShotgun',         name: 'Shotgun',           category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemGunTranq',           name: 'Tranq Gun',         category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemMeleeSword',         name: 'Sword',             category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemMeleeSledgeHammer',  name: 'Sledge Hammer',     category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemMeleeBaseballBat',   name: 'Baseball Bat',      category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemMeleeFryingPan',     name: 'Frying Pan',        category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemMeleeInflatableHammer', name: 'Inflatable Hammer', category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemGrenadeExplosive',   name: 'Explosive Grenade', category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemGrenadeShockwave',   name: 'Shockwave Grenade', category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemGrenadeStun',        name: 'Stun Grenade',      category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemGrenadeDuctTaped',   name: 'Duct Tape Grenade', category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemGrenadeHuman',       name: 'Human Grenade',     category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemMineExplosive',      name: 'Explosive Mine',    category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemMineShockwave',      name: 'Shockwave Mine',    category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemMineStun',           name: 'Stun Mine',         category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemDroneBattery',       name: 'Drone Battery',     category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemDroneFeather',       name: 'Drone Feather',     category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemDroneIndestructible',name: 'Unbreakable Drone', category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemDroneTorque',        name: 'Torque Drone',      category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemDroneZeroGravity',   name: 'Zero-G Drone',      category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemOrbZeroGravity',     name: 'Zero-G Orb',        category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemCartMedium',         name: 'Medium Cart',       category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemCartSmall',          name: 'Small Cart',        category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemExtractionTracker',  name: 'Exit Tracker',      category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemValuableTracker',    name: 'Loot Tracker',      category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemPowerCrystal',       name: 'Power Crystal',     category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemRubberDuck',         name: 'Rubber Duck',       category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemGunLaser',            name: 'Photon Blaster',    category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemGunShockwave',        name: 'Pulse Pistol',      category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemGunStun',             name: 'Boltzap',           category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemPhaseBridge',         name: 'Phase Bridge',      category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemCartCannon',         name: 'Cart Cannon',       category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemCartLaser',          name: 'Cart Laser',        category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemMeleeStunBaton',      name: 'Stun Baton',        category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemDuckBucket',          name: 'Duck Bucket',       category: 'Item Spawn', desc: '', timed: false },
    // Upgrade items (physical — spawns the shop object)
    { id: 'spawncollectable_ItemUpgradePlayerEnergy',       name: 'Upgrade Energy (Item)',       category: 'Item Spawn', desc: 'Spawns the shop item', timed: false },
    { id: 'spawncollectable_ItemUpgradePlayerHealth',       name: 'Upgrade Health (Item)',       category: 'Item Spawn', desc: 'Spawns the shop item', timed: false },
    { id: 'spawncollectable_ItemUpgradePlayerExtraJump',    name: 'Upgrade Jump (Item)',         category: 'Item Spawn', desc: 'Spawns the shop item', timed: false },
    { id: 'spawncollectable_ItemUpgradePlayerGrabRange',    name: 'Upgrade Grab Range (Item)',   category: 'Item Spawn', desc: 'Spawns the shop item', timed: false },
    { id: 'spawncollectable_ItemUpgradePlayerGrabStrength', name: 'Upgrade Grab Strength (Item)',category: 'Item Spawn', desc: 'Spawns the shop item', timed: false },
    { id: 'spawncollectable_ItemUpgradePlayerSprintSpeed',  name: 'Upgrade Sprint (Item)',       category: 'Item Spawn', desc: 'Spawns the shop item', timed: false },
    { id: 'spawncollectable_ItemUpgradePlayerTumbleLaunch', name: 'Upgrade Tumble (Item)',       category: 'Item Spawn', desc: 'Spawns the shop item', timed: false },
    { id: 'spawncollectable_ItemUpgradeMapPlayerCount',     name: 'Upgrade Map (Item)',          category: 'Item Spawn', desc: 'Spawns the shop item', timed: false },
    { id: 'spawncollectable_ItemUpgradeDeathHeadBattery',  name: 'Upgrade Death Head Batt (Item)', category: 'Item Spawn', desc: 'Spawns the shop item', timed: false },
    { id: 'spawncollectable_ItemUpgradePlayerCrouchRest',  name: 'Upgrade Crouch Rest (Item)',  category: 'Item Spawn', desc: 'Spawns the shop item', timed: false },
    { id: 'spawncollectable_ItemUpgradePlayerTumbleClimb', name: 'Upgrade Tumble Climb (Item)', category: 'Item Spawn', desc: 'Spawns the shop item', timed: false },
    { id: 'spawncollectable_ItemUpgradePlayerTumbleWings', name: 'Upgrade Tumble Wings (Item)', category: 'Item Spawn', desc: 'Spawns the shop item', timed: false },

    // --- Valuable Spawns (Full List) ---
    // Tiny
    { id: 'spawncollectable_ValuableDiamond',          name: 'Diamond',          category: 'Valuable', desc: 'Tiny',    timed: false },
    { id: 'spawncollectable_ValuableEmeraldBracelet',  name: 'Emerald Bracelet', category: 'Valuable', desc: 'Tiny',    timed: false },
    { id: 'spawncollectable_ValuableGoblet',           name: 'Goblet',           category: 'Valuable', desc: 'Tiny',    timed: false },
    { id: 'spawncollectable_ValuableOcarina',          name: 'Ocarina',          category: 'Valuable', desc: 'Tiny',    timed: false },
    { id: 'spawncollectable_ValuablePocketWatch',      name: 'Pocket Watch',     category: 'Valuable', desc: 'Tiny',    timed: false },
    { id: 'spawncollectable_ValuableUraniumMug',       name: 'Uranium Mug',      category: 'Valuable', desc: 'Tiny',    timed: false },
    // Small
    { id: 'spawncollectable_ValuableArcticBonsai',     name: 'Arctic Bonsai',    category: 'Valuable', desc: 'Small',   timed: false },
    { id: 'spawncollectable_ValuableArcticHDD',        name: 'Arctic HDD',       category: 'Valuable', desc: 'Small',   timed: false },
    { id: 'spawncollectable_ValuableChompBook',        name: 'Chomp Book',       category: 'Valuable', desc: 'Small',   timed: false },
    { id: 'spawncollectable_ValuableCrown',            name: 'Crown',            category: 'Valuable', desc: 'Small',   timed: false },
    { id: 'spawncollectable_ValuableDoll',             name: 'Doll',             category: 'Valuable', desc: 'Small',   timed: false },
    { id: 'spawncollectable_ValuableFrog',             name: 'Frog',             category: 'Valuable', desc: 'Small',   timed: false },
    { id: 'spawncollectable_ValuableGemBox',           name: 'Gem Box',          category: 'Valuable', desc: 'Small',   timed: false },
    { id: 'spawncollectable_ValuableGlobe',            name: 'Globe',            category: 'Valuable', desc: 'Small',   timed: false },
    { id: 'spawncollectable_ValuableLovePotion',       name: 'Love Potion',      category: 'Valuable', desc: 'Small',   timed: false },
    { id: 'spawncollectable_ValuableMoney',            name: 'Money',            category: 'Valuable', desc: 'Small',   timed: false },
    { id: 'spawncollectable_ValuableMusicBox',         name: 'Music Box',        category: 'Valuable', desc: 'Small',   timed: false },
    { id: 'spawncollectable_ValuableToyMonkey',        name: 'Toy Monkey',       category: 'Valuable', desc: 'Small',   timed: false },
    { id: 'spawncollectable_ValuableUraniumPlate',     name: 'Uranium Plate',    category: 'Valuable', desc: 'Small',   timed: false },
    { id: 'spawncollectable_ValuableVaseSmall',        name: 'Vase (S)',         category: 'Valuable', desc: 'Small',   timed: false },
    // Medium
    { id: 'spawncollectable_ValuableArctic3DPrinter',  name: '3D Printer',       category: 'Valuable', desc: 'Medium',  timed: false },
    { id: 'spawncollectable_ValuableArcticLaptop',     name: 'Laptop',           category: 'Valuable', desc: 'Medium',  timed: false },
    { id: 'spawncollectable_ValuableArcticPropaneTank',name: 'Propane Tank',    category: 'Valuable', desc: 'Medium',  timed: false },
    { id: 'spawncollectable_ValuableArcticSampleSixPack', name: 'Sample 6-Pack', category: 'Valuable', desc: 'Medium',  timed: false },
    { id: 'spawncollectable_ValuableArcticSample',     name: 'Arctic Sample',    category: 'Valuable', desc: 'Medium',  timed: false },
    { id: 'spawncollectable_ValuableBottle',           name: 'Bottle Trap',      category: 'Valuable', desc: 'Medium',  timed: false },
    { id: 'spawncollectable_ValuableClown',            name: 'Clown Doll',       category: 'Valuable', desc: 'Medium',  timed: false },
    { id: 'spawncollectable_ValuableComputer',         name: 'Computer',         category: 'Valuable', desc: 'Medium',  timed: false },
    { id: 'spawncollectable_ValuableFan',              name: 'Fan',              category: 'Valuable', desc: 'Medium',  timed: false },
    { id: 'spawncollectable_ValuableGramophone',       name: 'Gramophone',       category: 'Valuable', desc: 'Medium',  timed: false },
    { id: 'spawncollectable_ValuableMarbleTable',      name: 'Marble Table',     category: 'Valuable', desc: 'Medium',  timed: false },
    { id: 'spawncollectable_ValuableRadio',            name: 'Radio',            category: 'Valuable', desc: 'Medium',  timed: false },
    { id: 'spawncollectable_ValuableShipInBottle',     name: 'Ship in Bottle',   category: 'Valuable', desc: 'Medium',  timed: false },
    { id: 'spawncollectable_ValuableTrophy',           name: 'Trophy',           category: 'Valuable', desc: 'Medium',  timed: false },
    { id: 'spawncollectable_ValuableVase',             name: 'Vase',             category: 'Valuable', desc: 'Medium',  timed: false },
    { id: 'spawncollectable_ValuableWizardGoblinHead', name: 'Goblin Head',      category: 'Valuable', desc: 'Medium',  timed: false },
    { id: 'spawncollectable_ValuableWizardPowerCrystal',name: 'Power Crystal',   category: 'Valuable', desc: 'Medium',  timed: false },
    { id: 'spawncollectable_ValuableWizardTimeGlass',  name: 'Time Glass',       category: 'Valuable', desc: 'Medium',  timed: false },
    // Big / Wide / Tall
    { id: 'spawncollectable_ValuableArcticBarrel',     name: 'Arctic Barrel',    category: 'Valuable', desc: 'Big',     timed: false },
    { id: 'spawncollectable_ValuableArcticBigSample',  name: 'Big Sample',       category: 'Valuable', desc: 'Big',     timed: false },
    { id: 'spawncollectable_ValuableArcticCreatureLeg', name: 'Creature Leg',     category: 'Valuable', desc: 'Big',     timed: false },
    { id: 'spawncollectable_ValuableArcticFlamethrower',name: 'Flamethrower',    category: 'Valuable', desc: 'Big',     timed: false },
    { id: 'spawncollectable_ValuableArcticGuitar',     name: 'Guitar',           category: 'Valuable', desc: 'Big',     timed: false },
    { id: 'spawncollectable_ValuableArcticSampleCooler',name: 'Sample Cooler',   category: 'Valuable', desc: 'Big',     timed: false },
    { id: 'spawncollectable_ValuableDiamondDisplay',   name: 'Diamond Display',  category: 'Valuable', desc: 'Big',     timed: false },
    { id: 'spawncollectable_ValuableIceSaw',           name: 'Ice Saw',          category: 'Valuable', desc: 'Big',     timed: false },
    { id: 'spawncollectable_ValuableScreamDoll',       name: 'Scream Doll',      category: 'Valuable', desc: 'Big',     timed: false },
    { id: 'spawncollectable_ValuableTelevision',       name: 'Television',       category: 'Valuable', desc: 'Big',     timed: false },
    { id: 'spawncollectable_ValuableVaseBig',          name: 'Vase (Big)',       category: 'Valuable', desc: 'Big',     timed: false },
    { id: 'spawncollectable_ValuableWizardCubeOfKnowledge', name: 'Cube of Knowledge', category: 'Valuable', desc: 'Big', timed: false },
    { id: 'spawncollectable_ValuableWizardMasterPotion', name: 'Master Potion',  category: 'Valuable', desc: 'Big',     timed: false },
    { id: 'spawncollectable_ValuableAnimalCrate',      name: 'Animal Crate',     category: 'Valuable', desc: 'Wide',    timed: false },
    { id: 'spawncollectable_ValuableArcticIceBlock',   name: 'Ice Block',        category: 'Valuable', desc: 'Wide',    timed: false },
    { id: 'spawncollectable_ValuableDinosaur',         name: 'Dinosaur',         category: 'Valuable', desc: 'Wide',    timed: false },
    { id: 'spawncollectable_ValuablePiano',            name: 'Piano',            category: 'Valuable', desc: 'Wide',    timed: false },
    { id: 'spawncollectable_ValuableWizardGriffinStatue', name: 'Griffin Statue',category: 'Valuable', desc: 'Wide',    timed: false },
    { id: 'spawncollectable_ValuableArcticScienceStation', name: 'Science Station', category: 'Valuable', desc: 'Tall', timed: false },
    { id: 'spawncollectable_ValuableHarp',             name: 'Harp',             category: 'Valuable', desc: 'Tall',    timed: false },
    { id: 'spawncollectable_ValuablePainting',         name: 'Painting',         category: 'Valuable', desc: 'Tall',    timed: false },
    { id: 'spawncollectable_ValuableWizardDumgolfsStaff', name: "Dumgolf's Staff", category: 'Valuable', desc: 'Legendary', timed: false },
    { id: 'spawncollectable_ValuableWizardSword',      name: 'Wizard Sword',      category: 'Valuable', desc: 'Legendary', timed: false },
    { id: 'spawncollectable_ValuableArcticServerRack', name: 'Server Rack',      category: 'Valuable', desc: 'Massive', timed: false },
    { id: 'spawncollectable_ValuableGoldenStatue',     name: 'Golden Statue',    category: 'Valuable', desc: 'Massive', timed: false },
    { id: 'spawncollectable_ValuableGrandfatherClock', name: 'Grandfather Clock',category: 'Valuable', desc: 'Massive', timed: false },
    { id: 'spawncollectable_ValuableWizardBroom',      name: 'Wizard Broom',      category: 'Valuable', desc: 'Massive', timed: false },

    // --- Enemies ---
    { id: 'spawnenemy_Runner',        name: 'Spawn Reaper',      category: 'Enemies', desc: 'Fast runner',    timed: false },
    { id: 'spawnenemy_Floater',       name: 'Spawn Mentalist',   category: 'Enemies', desc: 'Floating enemy', timed: false },
    { id: 'spawnenemy_Hunter',        name: 'Spawn Huntsman',    category: 'Enemies', desc: 'Stalks player',  timed: false },
    { id: 'spawnenemy_Beamer',        name: 'Spawn Clown',       category: 'Enemies', desc: 'Laser eyes',     timed: false },
    { id: 'spawnenemy_Tumbler',       name: 'Spawn Chef',        category: 'Enemies', desc: 'Rolling enemy',  timed: false },
    { id: 'spawnenemy_SlowWalker',    name: 'Spawn Trudge',      category: 'Enemies', desc: 'Slow & tanky',   timed: false },
    { id: 'spawnenemy_SlowMouth',     name: 'Spawn Spewer',      category: 'Enemies', desc: 'Spits acid',     timed: false },
    { id: 'spawnenemy_ThinMan',       name: 'Spawn Shadow',      category: 'Enemies', desc: 'Stealthy',       timed: false },
    { id: 'spawnenemy_ValuableThrower', name: 'Spawn Rugrat',    category: 'Enemies', desc: 'Throws loot',    timed: false },
    { id: 'spawnenemy_Peeper',        name: 'Spawn Ceiling Eye', category: 'Enemies', desc: 'Watchful',       timed: false },
    { id: 'spawnenemy_Birthdayboy',   name: 'Spawn Birthday Boy',category: 'Enemies', desc: 'Surprise!',      timed: false },
    { id: 'spawnenemy_HeadGrabber',   name: 'Spawn Head Grabber',category: 'Enemies', desc: 'Jumps on head',  timed: false },
    { id: 'spawnenemy_HeartHugger',   name: 'Spawn Heart Hugger',category: 'Enemies', desc: 'Creepy',         timed: false },
    { id: 'spawnenemy_Duck',          name: 'Spawn Apex Predator',category: 'Enemies', desc: 'Rubber duck?',  timed: false },
    { id: 'spawnenemy_BombThrower',   name: 'Spawn Bomb Thrower', category: 'Enemies', desc: 'Throws bombs',   timed: false },
    { id: 'spawnenemy_Head',          name: 'Spawn Headman',      category: 'Enemies', desc: 'Just a head',   timed: false },
    { id: 'spawnenemy_Banger',        name: 'Spawn Bang',         category: 'Enemies', desc: 'Explodes',      timed: false },
];

const CATEGORY_COLORS = {
    'Player':     '#27ae60',
    'Toggle':     '#e05252',
    'Movement':   '#3498db',
    'Voice':      '#9b59b6',
    'Upgrade':    '#f39c12',
    'World':      '#e07c2a',
    'Item Spawn': '#00d2d3',
    'Valuable':   '#fbbf24',
    'Enemies':    '#7f8c8d',
};

const ALL_CATEGORIES = ['Player', 'Toggle', 'Movement', 'Voice', 'Upgrade', 'World', 'Item Spawn', 'Valuable', 'Enemies'];

let socket = null;
let availableGifts = [];
let currentCommands = {};
let giftDropdown = null;
let serverActive = false;
let isConnected = false;
let selectedEffect = null;
let activeCategory = 'Player';

export function initRepoUI(ioConnection) {
    if (ioConnection) socket = ioConnection.socket;

    const tableBody       = $('#repoEffectsTableBody');
    const modal           = $('#repoEffectModal');
    const addBtn          = $('#addRepoEffectBtn');
    const sidebarDot      = $('#repoStatusSidebarDot');
    const statusTextLarge = $('#repoStatusTextLarge');
    const connectBtn      = $('#repoConnectBtn');

    giftDropdown = new GiftDropdown({
        inputId:   'repoGiftInput',
        resultsId: 'repoGiftResults',
        previewId: 'repoGiftImagePreview',
    });

    // Build category tabs
    buildCategoryTabs();

    // ── UI Actions ────────────────────────────────────────────────────────────
    $('#repoSetupBtn').off('click').on('click', () => $('#repoSetupModal').css('display', 'flex'));
    $('#closeRepoSetupBtn, #repoGotItBtn').off('click').on('click', () => $('#repoSetupModal').hide());
    addBtn.off('click').on('click', () => openModal());

    connectBtn.off('click').on('click', () => {
        socket.emit(!serverActive ? 'repoStart' : 'repoStop');
    });

    $('#saveRepoEffectBtn').off('click').on('click', saveCurrentMapping);
    $('#cancelRepoModalBtn').off('click').on('click', () => { modal.hide(); resetModal(); });

    // ── Status Engine ──────────────────────────────────────────────────────────
    function updateUI(connected, active) {
        isConnected = !!connected;
        serverActive = !!active;

        const bridgeCard      = $('#repoBridgeCard');
        const statusIndicator = $('#repoStatusIndicator');
        const btnText         = $('#repoBtnText');
        const btnIcon         = $('#repoBtnIcon');

        btnText.text(serverActive ? 'Stop Bridge' : 'Start Bridge');
        connectBtn.removeClass('btn-primary btn-secondary').addClass(serverActive ? 'btn-secondary' : 'btn-primary');

        btnIcon.html(serverActive
            ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12"></rect></svg>`
            : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`
        );

        if (!serverActive) {
            statusTextLarge.text('Offline').css('color', 'var(--dim)');
            statusIndicator.css({ background: 'var(--danger)', 'box-shadow': '0 0 12px var(--danger)' });
            bridgeCard.css('border-left-color', 'var(--danger)');
        } else {
            const statusColor = isConnected ? 'var(--success)' : 'var(--warning)';
            statusTextLarge.text(isConnected ? 'Connected' : 'Listening...').css('color', statusColor);
            statusIndicator.css({ background: statusColor, 'box-shadow': `0 0 12px ${statusColor}` });
            bridgeCard.css('border-left-color', statusColor);
        }

        sidebarDot.toggle(isConnected).css('background', 'var(--success)');
    }

    if (socket) {
        socket.on('repoStatus', data => updateUI(data.isConnected, data.serverActive));
    }

    // ── Category Tabs ──────────────────────────────────────────────────────────
    function buildCategoryTabs() {
        const container = $('#repoCategoryTabs').empty();
        
        container.css({
            'display': 'flex',
            'gap': '2px',
            'background': 'var(--bg2)',
            'padding': '3px',
            'border-radius': '10px',
            'border': '1px solid var(--border)',
            'overflow-x': 'auto',
            'scrollbar-width': 'none',
            'margin-bottom': '4px'
        });

        ALL_CATEGORIES.forEach(cat => {
            const color = CATEGORY_COLORS[cat] || '#888';
            const isActive = activeCategory === cat;
            
            const btn = $(`
                <button style="
                    flex: 1 0 auto;
                    padding: 8px 14px;
                    border-radius: 8px;
                    border: none;
                    background: ${isActive ? 'var(--bg-light)' : 'transparent'};
                    color: ${isActive ? 'var(--text)' : 'var(--dim)'};
                    font-size: 11px;
                    font-weight: ${isActive ? '800' : '600'};
                    cursor: pointer;
                    transition: all .2s;
                    white-space: nowrap;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    box-shadow: ${isActive ? '0 2px 8px rgba(0,0,0,0.2)' : 'none'};
                ">
                    <div style="width:8px; height:8px; border-radius:50%; background:${color}; box-shadow: 0 0 6px ${color}88; opacity:${isActive ? 1 : 0.5}; transition: opacity .2s;"></div>
                    ${cat}
                </button>
            `);
            
            btn.on('click', () => {
                activeCategory = cat;
                buildCategoryTabs();
                renderEffectCards(selectedEffect ? selectedEffect.id : null);
            });
            container.append(btn);
        });
    }

    function renderEffectCards(selId) {
        const cards = $('#repoEffectCards').empty();
        const filtered = REPO_EFFECTS.filter(e => e.category === activeCategory);
        const color = CATEGORY_COLORS[activeCategory] || '#888';

        filtered.forEach(e => {
            const isSelected = e.id === selId;
            const card = $(`
                <div style="
                    padding: 12px;
                    border: 1px solid ${isSelected ? color : 'var(--border)'};
                    border-radius: 12px;
                    cursor: pointer;
                    background: ${isSelected ? color + '15' : 'var(--bg4)'};
                    transition: all .2s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    position: relative;
                    overflow: hidden;
                    box-shadow: ${isSelected ? 'inset 0 0 12px ' + color + '10' : 'none'};
                ">
                    ${isSelected ? `<div style="position:absolute; top:0; right:0; width:30px; height:30px; background:${color}; clip-path: polygon(100% 0, 0 0, 100% 100%); display:flex; align-items:flex-start; justify-content:flex-end; padding:4px;">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>` : ''}
                    
                    <div style="font-weight:800; font-size:.85rem; color:${isSelected ? 'var(--text)' : 'var(--text-muted)'}; display:flex; align-items:center; gap:6px;">
                        ${e.name}
                        ${e.timed ? `<span style="font-size:8px; padding:1px 5px; border-radius:4px; background:${color}22; color:${color}; font-weight:900; text-transform:uppercase; border: 1px solid ${color}33;">TIMED</span>` : ''}
                    </div>
                    ${e.desc ? `<div style="font-size:.7rem; color:var(--dim); line-height:1.3;">${e.desc}</div>` : ''}
                </div>
            `);
            
            card.on('mouseover', function() { if(!isSelected) $(this).css({'border-color': color + '88', 'background': 'var(--bg3)'}); });
            card.on('mouseout', function() { if(!isSelected) $(this).css({'border-color': 'var(--border)', 'background': 'var(--bg4)'}); });
            
            card.on('click', () => {
                selectedEffect = e;
                renderEffectCards(e.id);
                $('#repoDurationRow').toggle(!!e.timed);
            });
            cards.append(card);
        });

        if (!filtered.length) {
            cards.append(`<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--dim);font-size:.85rem;">No effects in this category.</div>`);
        }
    }

    // ── Table Rendering ────────────────────────────────────────────────────────
    function getEffectName(effect) {
        if (!effect) return 'Unknown';
        const code = typeof effect === 'string' ? effect : effect.code;
        const found = REPO_EFFECTS.find(e => e.id === code);
        return found ? found.name : code;
    }

    function renderTable() {
        tableBody.empty();
        const keys = Object.keys(currentCommands);
        if (!keys.length) return tableBody.append('<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--dim);">No effects mapped.</td></tr>');

        keys.forEach(giftName => {
            const effect = currentCommands[giftName];
            const gift   = availableGifts.find(g => g.name === giftName);
            const code   = typeof effect === 'string' ? effect : effect.code;
            const found  = REPO_EFFECTS.find(e => e.id === code);
            const color  = found ? (CATEGORY_COLORS[found.category] || '#888') : '#888';

            const effectTd = $('<td class="command-cell"></td>');
            const inner    = $('<div style="display:flex;align-items:center;gap:8px;"></div>');
            if (found) inner.append($(`<span style="font-size:9px;padding:1px 6px;border-radius:3px;background:${color}33;color:${color};font-weight:800;text-transform:uppercase;">${found.category}</span>`));
            inner.append($('<span></span>').text(getEffectName(effect)));
            effectTd.append(inner);

            const row = $('<tr></tr>');
            row.append(
                makeGiftCell(giftName, gift),
                effectTd,
                makeActionCell(giftName, {
                    onTest:   g => window.testRepoEffect(g),
                    onEdit:   g => openModal(g),
                    onDelete: g => window.deleteRepoMapping(g)
                })
            );
            tableBody.append(row);
        });
    }

    // ── Modal ─────────────────────────────────────────────────────────────────
    function resetModal() {
        selectedEffect = null;
        activeCategory = 'Player';
        buildCategoryTabs();
        renderEffectCards(null);
        $('#repoDurationRow').hide();
        $('#repoEffectDuration').val(10);
        $('#repoWaitStreak').prop('checked', true);
    }

    function openModal(editGiftName) {
        resetModal();
        if (editGiftName) {
            giftDropdown.setValue(editGiftName);
            $('#repoModalTitle').text('Edit R.E.P.O. Effect');
            const effect = currentCommands[editGiftName];
            const code   = typeof effect === 'string' ? effect : effect.code;
            const found  = REPO_EFFECTS.find(e => e.id === code);
            if (found) {
                selectedEffect = found;
                activeCategory = found.category;
                buildCategoryTabs();
                renderEffectCards(found.id);
                if (found.timed) {
                    $('#repoDurationRow').show();
                    $('#repoEffectDuration').val((typeof effect === 'object' && effect.duration) ? effect.duration : 10);
                }
            }
            if (typeof effect === 'object') {
                $('#repoWaitStreak').prop('checked', effect.waitForStreak !== false);
                $('#repoTargetRandom').prop('checked', !!effect.targetRandom);
            } else {
                $('#repoTargetRandom').prop('checked', false);
            }
        } else {
            giftDropdown.setValue('');
            $('#repoModalTitle').text('Add R.E.P.O. Effect');
            $('#repoTargetRandom').prop('checked', false);
            $('#repoWaitStreak').prop('checked', true);
        }
        modal.css('display', 'flex');
    }

    function saveCurrentMapping() {
        const giftName = giftDropdown.getValue();
        if (!giftName) { showToast('You must choose a gift!', 'warning'); return; }
        if (!selectedEffect) { showToast('You must choose an effect!', 'warning'); return; }

        const isEdit = $('#repoModalTitle').text().includes('Edit');
        if (!isEdit && currentCommands[giftName]) {
            showToast(`"${giftName}" already has an effect! Delete it first.`, 'error');
            return;
        }

        const payload = {
            code: selectedEffect.id,
            waitForStreak: $('#repoWaitStreak').is(':checked'),
            targetRandom: $('#repoTargetRandom').is(':checked'),
            ...(selectedEffect.timed ? { duration: parseInt($('#repoEffectDuration').val()) || 10 } : {})
        };

        saveMapping(giftName, payload, 'save');
    }

    async function saveMapping(giftName, effect, action) {
        try {
            const r = await fetch('/api/repo/commands', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ giftName, effect, action })
            });
            const d = await r.json();
            if (d.success) {
                currentCommands = d.commands;
                renderTable();
                modal.hide();
                resetModal();
                showToast(action === 'delete' ? 'Mapping removed' : 'Mapping saved!', 'success');
            } else {
                showToast(d.error || 'Failed to save mapping', 'error');
            }
        } catch (e) {
            showToast('Connection error: ' + e.message, 'error');
        }
    }

    window.testRepoEffect = (g) => {
        fetch('/api/repo/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ giftName: g }) })
            .then(r => r.json()).then(res => showToast(res.success ? 'Sent!' : res.error, res.success ? 'success' : 'error'));
    };

    window.deleteRepoMapping = (g) => {
        showConfirm({ title: 'Delete?', message: `Remove mapping for ${g}?` }).then(ok => { if (ok) saveMapping(g, null, 'delete'); });
    };

    // ── Initial Load ───────────────────────────────────────────────────────────
    async function loadAllData() {
        try {
            const [cmdsRes, giftsRes] = await Promise.all([
                fetch('/api/repo/commands').then(r => r.json()),
                fetch('/api/gifts').then(r => r.json())
            ]);
            currentCommands = cmdsRes.commands || {};
            availableGifts  = giftsRes.gifts || [];
            giftDropdown.updateGifts(availableGifts);
            renderTable();
        } catch (e) { console.error('[Repo] Load Error', e); }
    }

    loadAllData();
}
