import { sleep, unitFilter, Modifier, handleEvent, removeModifier, basicModifier, stunModifier, logAction, resetStat, regenerateResources, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, modifiers, currentUnit, currentAction, elements, eventState } from '../combatDictionary.js';
import { Unit, allUnits } from './unit.js';

export const ArtificialSoldier = new Unit("Artificial Soldier", [1200, 22, 25, 85, 60, 80, 60, 90, 110, "front", 120, 80, 10, 50, 5, 30, 6], ["perfection/precision"]);

ArtificialSoldier.skills = {
    special: [
        {
            name: "Magic Weapon",
            properties: ["physical", "stamina", "mystic", "mana", "attack"],
            cost: { stamina: 20, mana: 30 },
            description: "Attacks a single target twice with increased attack, accuracy, and focus",
            target() { this.team === "player" ? selectTarget(this.skills.special, [1, true, unitFilter("enemy", "front", false)]) : this.skills.special.code.call(this, randTarget(unitFilter("player", "front", false))) },
            code(target) { attack(this, target, 2, { attacker: { attack: { bonus: 24 }, accuracy: { bonus: 80 }, focus: { bonus: 60 } } }) }
        },
        {
            name: "Energy Rifle",
            properties: ["physical", "stamina", "techno", "energy", "attack"],
            cost: { stamina: 30, energy: 20 },
            description: "Attacks a single target 4 times with increased attack and accuracy",
            target() { this.team === "player" ? selectTarget(this.skills.special, [1, true, unitFilter("enemy", "front", false)]) : this.skills.special.code.call(this, randTarget(unitFilter("player", "front", false))) },
            code(target) { attack(this, target, 4, { attacker: { attack: { bonus: 36 }, accuracy: { bonus: 60 } } }) }
        },
        {
            name: "Recharge",
            properties: ["physical", "stamina", "mystic", "techno", "conditional", "drain", "mana", "energy"],
            cost: { stamina: 10 },
            description: "Drains additional stamina by staminaRegen to regen missing mana and energy by regen amounts",
            code() { resourceChange(this, { stamina: Math.min(5.5-(this.base.mana-this.mana)/this.manaRegen - (this.base.energy-this.energy)/this.energyRegen, 0), mana: this.base.mana/this.manaRegen, energy: this.base.energy/this.energyRegen}, true, true) }
        },
        {
            name: "Perfect Form",
            properties: ["physical", "stamina", "buff"],
            cost: { stamina: 30 },
            description: "Increases accuracy, evasion, and focus for 5 turns",
            code() { basicModifier("Perfect Form", "Accuracy, evasion, and focus increase", { caster: this, target: this, duration: 6, properties: ["physical", "buff"], stats: { accuracy: 80, evasion: 50, focus: 80 }, listeners: { turnEnd: true }, focus: true }) }
        },
        {
            name: "Made to Serve",
            properties: ["physical", "stamina", "buff", "penalty"],
            cost: { stamina: 30 },
            description: "Increases accuracy/focus and decreases resist/presence for 5 turns",
            code() {
                basicModifier("Made to Serve buff", "Accuracy and focus increase", { caster: this, target: this, duration: 6, properties: ["physical", "buff"], stats: { accuracy: 160, focus: 160 }, listeners: { turnEnd: true } });
                basicModifier("Made to Serve penalty", "resist and presence decrease", { caster: this, target: this, duration: 6, properties: ["physical", "buff"], stats: { resist: -40, presence: -80 }, listeners: { turnEnd: true }, penalty: true });
            }
        }
    ],
    basic: [
        {
            name: "Magic Weapon",
            properties: ["physical", "mystic", "attack", "conditional", "mana"],
            description: "Attacks a single target twice with increased accuracy and focus, can spend 15 mana to increase attack",
            code() { attack(this, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false)), 2, { attacker: { attack: { bonus: resourceChange(this, { mana: -15 }) ? 16 : 0 }, accuracy: { bonus: 60 }, focus: { bonus: 30 } } }) }
        },
        {
            name: "Energy Rifle",
            properties: ["physical", "techno", "attack", "conditional", "energy"],
            description: "Attacks a single target 4 times with increased attack, can spend 10 energy to increase accuracy",
            code() { attack(this, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false)), 4, { attacker: { attack: { bonus: 8 }, accuracy: { bonus: resourceChange(this, { energy: -10 }) ? 30 : 0 } } }) }
        },
        {
            name: "Recharge",
            properties: ["physical", "stamina", "mystic", "techno", "conditional", "drain", "mana", "energy"],
            cost: { stamina: 10 },
            description: "Regen mana and energy based on which is lower (40% and 15% max resource)",
            code() { resourceChange(this, this.mana/this.base.mana > this.energy/this.base.energy ? { mana: 1.5, energy: 4 } : { mana: 4, energy: 1.5 }) }
        },
        {
            name: "Perfect Form",
            properties: ["physical", "buff"],
            description: "Increases accuracy, evasion, and focus for 2 turns. If currently active, refreshes duration and allow stamina regen next turn",
            code() {
                const mod = modifiers.find(m => m.name === "Perfect Form" && m.vars.caster === this)
                if (mod) mod.vars.duration = 3, this.previousAction[0] = false, logAction(`${this.name} refreshes ${mod.name}`);
                else basicModifier("Perfect Form", "Accuracy, evasion, and focus increase", { caster: this, target: this, duration: 3, properties: ["physical", "buff"], stats: { accuracy: 60, evasion: 20, focus: 50 }, listeners: { turnEnd: true }, focus: true });
            }
        },
        {
            name: "Made to Serve",
            properties: ["physical", "buff", "penalty"],
            description: "Increases accuracy/focus and decreases resist/presence for 2 turns. If currently active, refreshes duration and allow stamina regen next turn",
            code() {
                let mod = modifiers.find(m => m.name.includes("Made to Serve") && m.vars.caster === this);
                if (mod) {
                    this.previousAction[0] = false;
                    mod.vars.duration = 3;
                    logAction(`${this.name} refreshes ${mod.name}`);
                    mod = modifiers.find(m => m !== mod && m.name.includes("Made to Serve") && m.vars.caster === this)
                    if (mod) mod.vars.duration = 3, logAction(`${this.name} refreshes ${mod.name}`);
                } else {
                    basicModifier("Made to Serve buff", "Accuracy and focus increase", { caster: this, target: this, duration: 3, properties: ["physical", "buff"], stats: { accuracy: 120, focus: 120 }, listeners: { turnEnd: true } });
                    basicModifier("Made to Serve penalty", "resist and presence decrease", { caster: this, target: this, duration: 3, properties: ["physical", "buff"], stats: { resist: -30, presence: -60 }, listeners: { turnEnd: true }, penalty: true });
                }
            }
        }
    ],
    secondary: [
        {
            name: "Magic Weapon",
            properties: ["mystic", "attack", "conditional", "mana"],
            description: "Attacks a single target twice with increased accuracy, can spend 10 mana to increase attack",
            code() { attack(this, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false)), 2, { attacker: { attack: { bonus: resourceChange(this, { mana: -10 }) ? 12 : 0 }, accuracy: { bonus: 40 } } }) }
        },
        {
            name: "Energy Rifle",
            properties: ["techno", "attack", "conditional", "energy"],
            description: "Attacks a single target 4 times, can spend 5 energy to increase accuracy",
            code() { attack(this, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false)), 4, { attacker: { accuracy: { bonus: resourceChange(this, { energy: -5 }) ? 20 : 0 } } }) }
        },
        {
            name: "Recharge",
            properties: ["physical", "mystic", "techno", "conditional", "drain", "mana", "energy"],
            description: "Regen mana and energy based on which is lower (35% and 10% max resource)",
            code() { resourceChange(this, this.mana/this.base.mana > this.energy/this.base.energy ? { mana: 1, energy: 3.5 } : { mana: 3.5, energy: 1 }) }
        },
        {
            name: "Perfect Form",
            properties: ["buff"],
            description: "Increases accuracy and focus for 1 turn",
            code() { basicModifier("Perfect Form", "Accuracy and focus increase", { caster: this, target: this, duration: 2, properties: ["physical", "buff"], stats: { accuracy: 40, focus: 30 }, listeners: { turnEnd: true }, focus: true }) }
        },
        {
            name: "Made to Serve",
            properties: ["buff", "penalty"],
            description: "Increases accuracy/focus and decreases resist/presence for 1 turn",
            code() {
                basicModifier("Made to Serve buff", "Accuracy and focus increase", { caster: this, target: this, duration: 2, properties: ["physical", "buff"], stats: { accuracy: 80, focus: 80 }, listeners: { turnEnd: true } });
                basicModifier("Made to Serve penalty", "resist and presence decrease", { caster: this, target: this, duration: 2, properties: ["physical", "buff"], stats: { resist: -20, presence: -40 }, listeners: { turnEnd: true }, penalty: true });
            }
        }
    ],
    passive: [
        {
            name: "Recharge",
            properties: ["physical", "stamina", "mystic", "techno", "conditional", "mana", "energy"],
            description: "Regens some mana or stamina depending which one is lower, regen is 5% max resource per 25% of stamina remaining",
            code() {
                new Modifier("Recharge", "Regens some mana or stamina depending which one is lower, regen is 5% max resource per 25% of stamina remaining",
                    { caster: this, target: this, properties: ["physical", "mystic", "techno", "conditional", "mana", "energy"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], focus: true, passive: true },
                    function() {},
                    function(context) { if (this.vars.target === context.unit && 4 * this.vars.target.stamina >= this.vars.target.base.stamina) resourceChange(this.vars.target, this.vars.target.mana/this.vars.target.base.mana > this.vars.target.energy/this.vars.target.base.energy ? { energy: this.vars.target.energyRegen*Math.floor(4*this.vars.target.stamina/this.vars.target.base.stamina)/2 } : { mana: this.vars.target.manaRegen*Math.floor(4*this.vars.target.stamina/this.vars.target.base.stamina)/2 })}
                );
            }
        },
        {
            name: "Perfect Form",
            properties: ["physical", "stamina", "buff"],
            description: "Increases accuracy and focus",
            code() { basicModifier("Perfect Form", "Accuracy and focus increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { accuracy: 30, focus: 20 }, focus: true, passive: true }) }
        },
        {
            name: "Made to Serve",
            properties: ["physical", "stamina", "buff", "penalty"],
            description: "Increases accuracy/focus and decreases resist/presence",
            code() {
                basicModifier("Made to Serve buff", "Accuracy and focus increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { accuracy: 60, focus: 60 } });
                basicModifier("Made to Serve penalty", "resist and presence decrease", { caster: this, target: this, properties: ["physical", "buff"], stats: { resist: -30, presence: -60 }, passive: true, penalty: true });
            }
        }
    ],
    augment: [
        {
            name: "Recharge",
            properties: ["physical", "stamina", "mystic", "techno", "conditional", "mana", "energy"],
            description: "Regens some mana or stamina depending which one is lower, regen is 7.5% max resource per 25% of stamina remaining",
            code() {
                new Modifier("Recharge", "Regens some mana or stamina depending which one is lower, regen is 5% max resource per 25% of stamina remaining",
                    { caster: this, target: this, properties: ["physical", "mystic", "techno", "conditional", "mana", "energy"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], focus: true, passive: true },
                    function() {},
                    function(context) { if (this.vars.target === context.unit && 4 * this.vars.target.stamina >= this.vars.target.base.stamina) resourceChange(this.vars.target, this.vars.target.mana/this.vars.target.base.mana > this.vars.target.energy/this.vars.target.base.energy ? { energy: this.vars.target.energyRegen*Math.floor(4*this.vars.target.stamina/this.vars.target.base.stamina)*.75 } : { mana: this.vars.target.manaRegen*Math.floor(4*this.vars.target.stamina/this.vars.target.base.stamina)*.75 })}
                );
            }
        },
        {
            name: "Perfect Form",
            properties: ["physical", "stamina", "buff"],
            description: "Increases accuracy, evasion, and focus",
            code() { basicModifier("Perfect Form", "Accuracy and focus increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { accuracy: 45, evasion: 15, focus: 30 }, focus: true, passive: true }) }
        },
        {
            name: "Made to Serve",
            properties: ["physical", "stamina", "buff", "penalty"],
            description: "Increases accuracy/focus and decreases resist/presence",
            code() {
                basicModifier("Made to Serve buff", "Accuracy and focus increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { accuracy: 80, focus: 80 } });
                basicModifier("Made to Serve penalty", "resist and presence decrease", { caster: this, target: this, properties: ["physical", "buff"], stats: { resist: -20, presence: -40 }, passive: true, penalty: true });
            }
        }
    ]
}

ArtificialSoldier.defaultSkills = [
    { category: 'special', name: 'Perfect Form' },
    { category: 'basic', name: 'Magic Weapon' },
    { category: 'secondary', name: 'Energy Rifle' },
    { category: 'passive', name: 'Made to Serve' },
    { category: 'augment', name: 'Recharge' }
];