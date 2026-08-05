import { sleep, unitFilter, Modifier, handleEvent, removeModifier, basicModifier, stunModifier, logAction, resetStat, regenerateResources, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, modifiers, currentUnit, currentAction, elements, eventState } from '../combatDictionary.js';
import { Unit, allUnits } from './unit.js';

export const Experiment = new Unit("Experiment", [700, 24, 10, 70, 45, 70, 45, 45, 80, "front", 80, 70, 7], ["independence/loneliness"]);

Experiment.skills = {
    special: [
        {
            name: "Tooth and Nail",
            properties: ["physical", "stamina", "attack"],
            cost: { stamina: 30 },
            description: "Attacks a single target 3 times with increased attack and accuracy",
            target() {  this.team === "player" ? selectTarget(this.skills.special, [1, true, unitFilter("enemy", "front", false)]) : this.skills.special.code.call(this, randTarget(unitFilter("player", "front", false))) },
            code(target) { attack(this, target, 3, { attacker: { attack: { bonus: 25 }, accuracy: { bonus: 35 } } }) }
        },
        {
            name: "Brain Eating",
            properties: ["physical", "stamina", "attack", "fatal"],
            cost: { stamina: 50 },
            description: "Makes an attack on alive target. If attack reduced half of target's current hp or target is downed, chance to kill target",
            target() {  this.team === "player" ? selectTarget(this.skills.special, [1, true, unitFilter("enemy", "front")]) : this.skills.special.code.call(this, randTarget(unitFilter("player", "front"))) },
            code(target) {
                if ((!target[0].hp || attack(this, target)[0] >= target[0].hp) && resistDebuff(this, target)[0] > 50) {
                    allUnits.splice(allUnits.indexOf(target[0]), 1);
                    if (eventState.unitChange.length) handleEvent('unitChange', { type: 'death', unit: target[0] });
                    for (let i = modifiers.length - 1; i >= 0; i--) if (modifiers[i].vars.caster === target[0]) removeModifier(modifiers[i]);
                    logAction(`${this.name} consumes ${target[0].name}!`);
                } else logAction(`${this.name} fails to consume ${target[0].name}!`, "miss");
            }
        },
        {
            name: "Imperfect Abomination",
            properties: ["physical", "stamina", "buff", "penalty"],
            cost: { stamina: 20 },
            description: "Increase attack/focus/presence and decreased defense/accuracy/evasion for 4 turns",
            code() {
                basicModifier("Imperfect Abomination buff", "Attack, focus, and presence increase", { caster: this, target: this, duration: 5, properties: ["physical", "buff"], stats: { attack: 16, focus: 60, presence: 80 }, listeners: { turnEnd: true } });
                basicModifier("Imperfect Abomination penalty", "Defense, accuracy, and evasion decrease", { caster: this, target: this, duration: 5, properties: ["physical", "penalty"], stats: { defense: -5, accuracy: -20, evasion: -10 }, listeners: { turnEnd: true }, penalty: true });
            }
        },
        {
            name: "Forced Mercenary",
            properties: ["physical", "stamina", "buff", "penalty"],
            cost: { stamina: 20 },
            description: "Increase attack/accuracy/focus and decreased evasion/resist/presence for 4 turns",
            code() {
                basicModifier("Forced Mercenary buff", "Attack, accuracy, and focus increase", { caster: this, target: this, duration: 5, properties: ["physical", "buff"], stats: { attack: 8, accuracy: 40, focus: 40 }, listeners: { turnEnd: true } });
                basicModifier("Forced Mercenary penalty", "Evasion, resist, and presence decrease", { caster: this, target: this, duration: 5, properties: ["physical", "penalty"], stats: { evasion: -10, resist: -15, presence: -40 }, listeners: { turnEnd: true }, penalty: true });
            }
        }
    ],
    basic: [
        {
            name: "Tooth and Nail",
            properties: ["physical", "attack"],
            description: "Attacks a single target 3 times",
            code() { attack(this, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false)), 3) }
        },
        {
            name: "Brain Eating",
            properties: ["physical", "stamina", "attack", "fatal"],
            cost: { stamina: 30 },
            description: "Makes an attack on alive target. If attack reduced half of target's current hp or target is downed, chance to kill target",
            code() {
                const target = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front"))
                if ((!target[0].hp || (attack(this, target) && !target[0].hp)) && resistDebuff(this, target)[0] > 75) {
                    allUnits.splice(allUnits.indexOf(target[0]), 1);
                    if (eventState.unitChange.length) handleEvent('unitChange', { type: 'death', unit: target[0] });
                    for (let i = modifiers.length - 1; i >= 0; i--) if (modifiers[i].vars.caster === target[0]) removeModifier(modifiers[i]);
                    logAction(`${this.name} consumes ${target[0].name}!`);
                } else logAction(`${this.name} fails to consume ${target[0].name}!`, "miss");
            }
        },
        {
            name: "Imperfect Abomination",
            properties: ["physical", "buff", "penalty"],
            description: "Increase attack/focus/presence and decreased accuracy/evasion for 2 turns. If currently active, refreshes duration and allow stamina regen next turn",
            code() {
                let mod = modifiers.find(m => m.name.includes("Imperfect Abomination") && m.vars.caster === this);
                if (mod) {
                    this.previousAction[0] = false;
                    mod.vars.duration = 3;
                    logAction(`${this.name} refreshes ${mod.name}`);
                    mod = modifiers.find(m => m !== mod && m.name.includes("Imperfect Abomination") && m.vars.caster === this)
                    if (mod) mod.vars.duration = 3, logAction(`${this.name} refreshes ${mod.name}`);
                } else {
                    basicModifier("Imperfect Abomination buff", "Attack, focus, and presence increase", { caster: this, target: this, duration: 3, properties: ["physical", "buff"], stats: { attack: 12, focus: 30, presence: 40 }, listeners: { turnEnd: true } });
                    basicModifier("Imperfect Abomination penalty", "Accuracy and evasion decrease", { caster: this, target: this, duration: 3, properties: ["physical", "penalty"], stats: { accuracy: -10, evasion: -5 }, listeners: { turnEnd: true }, penalty: true });
                }
            }
        },
        {
            name: "Forced Mercenary",
            properties: ["physical", "buff", "penalty"],
            description: "Increase attack/accuracy/focus and decreased evasion/resist/presence for 2 turns. If currently active, refreshes duration and allow stamina regen next turn",
            code() {
                logAction(`${this.name} focuses in on the target.`, "buff");
                let mod = modifiers.find(m => m.name.includes("Forced Mercenary") && m.vars.caster === this);
                if (mod) {
                    this.previousAction[0] = false;
                    mod.vars.duration = 3;
                    logAction(`${this.name} refreshes ${mod.name}`);
                    mod = modifiers.find(m => m !== mod && m.name.includes("Forced Mercenary") && m.vars.caster === this);
                    if (mod) mod.vars.duration = 3, logAction(`${this.name} refreshes ${mod.name}`);
                } else {
                    basicModifier("Forced Mercenary buff", "Attack, accuracy, and focus increase", { caster: this, target: this, duration: 3, properties: ["physical", "buff"], stats: { attack: 6, accuracy: 20, focus: 20 }, listeners: { turnEnd: true } });
                    basicModifier("Forced Mercenary penalty", "Evasion, resist, and presence decrease", { caster: this, target: this, duration: 3, properties: ["physical", "penalty"], stats: { evasion: -5, resist: -10, presence: -20 }, listeners: { turnEnd: true }, penalty: true });
                }
            }
        }
    ],
    secondary: [
        {
            name: "Tooth and Nail",
            properties: ["attack"],
            description: "Attacks a single target 2 times",
            code() { attack(this, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false)), 2) }
        },
        {
            name: "Imperfect Abomination",
            properties: ["buff", "penalty"],
            description: "Increase focus/presence and decreased accuracy for 1 turn",
            code() {
                basicModifier("Imperfect Abomination buff", "Focus, and presence increase", { caster: this, target: this, duration: 2, properties: ["physical", "buff"], stats: { focus: 30, presence: 40 }, listeners: { turnEnd: true } });
                basicModifier("Imperfect Abomination penalty", "Accuracy decrease", { caster: this, target: this, duration: 2, properties: ["physical", "penalty"], stats: { accuracy: -5 }, listeners: { turnEnd: true }, penalty: true });
            }
        },
        {
            name: "Forced Mercenary",
            properties: ["buff", "penalty"],
            description: "Increase accuracy/focus and decreased resist/presence for 1 turn",
            code() {
                basicModifier("Forced Mercenary buff", "Accuracy, and focus increase", { caster: this, target: this, duration: 2, properties: ["physical", "buff"], stats: { accuracy: 20, focus: 20 }, listeners: { turnEnd: true } });
                basicModifier("Forced Mercenary penalty", "Resist, and presence decrease", { caster: this, target: this, duration: 2, properties: ["physical", "penalty"], stats: { resist: -5, presence: -10 }, listeners: { turnEnd: true }, penalty: true });
            }
        }
    ],
    passive: [
        {
            name: "Brain Eating",
            properties: ["physical", "stamina", "fatal"],
            description: "When downing a unit or skipping a turn, chance to kill target or randomly downed frontline unit",
            code() {
                new Modifier("Brain Eating", "When downing a unit or skipping a turn, chance to kill target or randomly downed frontline unit",
                    { caster: this, target: this, properties: ["physical", "fatal"], listeners: { unitChange: true, actionStart: true, turnEnd: false }, cancelListeners: ['unitChange', 'actionStart', 'turnEnd'], focus: true, passive: true, unit: null },
                    function() {},
                    function(context) {
                        if (context.event === 'turnEnd') {
                            if (allUnits.indexOf(this.vars.unit) > -1 && !this.vars.unit.hp) {
                                allUnits.splice(allUnits.indexOf(this.vars.unit), 1);
                                if (eventState.unitChange.length) handleEvent('unitChange', { type: 'death', unit: this.vars.unit });
                                for (let i = modifiers.length - 1; i >= 0; i--) if (modifiers[i].vars.caster === this.vars.unit) removeModifier(modifiers[i]);
                            }
                            this.vars.unit = null;
                            this.vars.listeners.turnEnd = false;
                        }
                        if (context.action === 'skip' && context.unit === this.vars.caster) {
                            const unit = randTarget(unitFilter(this.vars.caster.team === 'player' ? 'enemy' : 'player', 'front', true), 1, true)[0];
                            if (unit && resistDebuff(this.vars.caster, [unit])[0] > 85) {
                                allUnits.splice(allUnits.indexOf(unit), 1);
                                if (eventState.unitChange.length) handleEvent('unitChange', { type: 'death', unit });
                                for (let i = modifiers.length - 1; i >= 0; i--) if (modifiers[i].vars.caster === unit) removeModifier(modifiers[i]);
                            }
                        } else if (context.type === 'downed' && currentUnit.at(-2) === this.vars.caster && resistDebuff(this.vars.caster, [context.unit])[0] > 85) {
                            this.vars.unit = context.unit;
                            this.vars.listeners.turnEnd = true;
                        }
                    }
                )
            }
        },
        {
            name: "Imperfect Abomination",
            properties: ["physical", "stamina", "buff", "penalty"],
            description: "Increase focus/presence and decreased accuracy",
            code() {
                basicModifier("Imperfect Abomination buff", "Focus, and presence increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { focus: 20, presence: 30 }, passive: true });
                basicModifier("Imperfect Abomination penalty", "Accuracy decrease", { caster: this, target: this, properties: ["physical", "penalty"], stats: { accuracy: -10 }, passive: true, penalty: true });
            }
        },
        {
            name: "Forced Mercenary",
            properties: ["physical", "stamina", "buff", "penalty"],
            description: "Increase accuracy/focus and decreased resist/presence",
            code() {
                basicModifier("Forced Mercenary buff", "Accuracy, and focus increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { accuracy: 10, focus: 10 }, passive: true});
                basicModifier("Forced Mercenary penalty", "Resist, and presence decrease", { caster: this, target: this, properties: ["physical", "penalty"], stats: { resist: -5, presence: -20 }, passive: true, penalty: true });
            }
        }
    ]
}

Experiment.defaultSkills = [
    { category: 'special', name: 'Brain Eating' },
    { category: 'basic', name: 'Tooth and Nail' },
    { category: 'secondary', name: 'Forced Mercenary' },
    { category: 'passive', name: 'Imperfect Abomination' }
];