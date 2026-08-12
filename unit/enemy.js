import { sleep, unitFilter, Modifier, handleEvent, removeModifier, basicModifier, stunModifier, logAction, resetStat, regenerateResources, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, modifiers, currentUnit, currentAction, elements, eventState } from '../combatDictionary.js';
import { Unit, allUnits } from './unit.js';

export const enemy = new Unit("Basic Enemy", [1000, 30, 30, 100, 100, 100, 100, 100, 100, "front", 100, 100, 10]);

enemy.skills = {
    special: [
        {
            name: "Attack",
            properties: ["physical", "stamina", "attack"],
            cost: { stamina: 30 },
            description: "Attacks a single target 4 times at double damage",
            target() {  this.team === "player" ? selectTarget(this.skills.special, [1, true, unitFilter("enemy", "front", false)]) : this.skills.special.code.call(this, randTarget(unitFilter("player", "front", false))) },
            code(target) { attack(this, target, 4, { attacker: { attack: { mult: 2 } } }) }
        },
        {
            name: "Power Up",
            properties: ["physical", "stamina", "buff"],
            cost: { stamina: 35 },
            description: "Next attack gains double attack, accurracy, & focus",
            code() {
                logAction(`${this.name} charges for the next attack!`, "buff");
                new Modifier("Power Up", "Next attack gains double attack, accurracy, & focus",
                    { caster: this, target: this, properties: ["physical","buff"], listeners: { attackStart: true }, cancelListeners: ['attackStart'], focus: true },
                    function() {},
                    function(context) {
                        if (context.attacker !== this.vars.caster) return;
                        ['attack', 'accuracy', 'focus'].forEach(k => { (context.calcMods.attacker ??= {})[k] = { mult: (context.calcMods.attacker[k]?.mult || 1) + 1 } });
                        return true;
                    }
                )
            }
        },
        {
            name: "Defend",
            properties: ["physical", "stamina", "buff"],
            cost: { stamina: 20 },
            description: "Increases defense, evasion, and resist for 5 turns",
            code() { basicModifier("Defend", "Defense, evasion, and resist increase", { caster: this, target: this, duration: 5, properties: ["physical", "buff"], stats: { defense: 30, evasion: 25, resist: 50 }, listeners: { turnStart: true }, focus: true }) }
        },
        {
            name: "Taunt",
            properties: ["physical", "stamina", "debuff"],
            cost: { stamina: 20 },
            description: "Decreases target evasion, focus, and resist and increase chance for caster to be targeted by target for a few turns, 1% chance to fail, can target backline",
            target() {  this.team === "player" ? selectTarget(this.skills.special, [1, true, unitFilter("enemy", "", false)]) : this.skills.special.code.call(this, randTarget(unitFilter("player", "", false))) },
            code(target) {
                let will = resistDebuff(this, target)[0];
                if (will >= 2) {
                    logAction(`${this.name} taunts ${target[0].name}!`, "debuff");
                    new Modifier("Taunt", "Decreases target evasion, focus, and resist and increase chance for caster to be targeted by target",
                        { caster: this, target: target[0], duration: will > 99 ? 6 : Math.ceil(will/25), properties: ["physical", "debuff"], stats: { evasion: -20, focus: -35, resist: -25 }, listeners: { turnStart: true, targetStart: true }, cancelListeners: ['targetStart'], focus: true },
                        function() {},
                        function(context) {
                            let i;
                            if (context.event === 'targetStart' && currentUnit.at(-2) === this.vars.target && (i = context.unitList.findIndex(u => u === this.vars.caster)) > -1) (((context.targetMods.targets ??= [])[i] ??= {}).presence ??= { mult: 1 }).mult++;
                            if (context.unit === this.vars.caster) this.vars.duration--;
                            return this.vars.duration > 0;
                        }
                    );
                } else logAction(`${this.name} fails to taunt ${target[0].name}!`, "miss");
            }
        },
        {
            name: "Recover",
            properties: ["physical", "stamina", "heal"],
            cost: { stamina: 50 },
            description: "Heals a lot (35% max hp)",
            code() { heal(this, [this], [3.5]) }
        }
    ],
    basic: [
        {
            name: "Attack",
            properties: ["physical", "attack"],
            description: "Attacks a single target 4 times",
            code() { attack(this, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false)), 4) }
        },
        {
            name: "Power Up",
            properties: ["physical", "buff"],
            description: "Next attack gains increased attack and accurracy",
            code() {
                logAction(`${this.name} prepares for the next attack`, "buff");
                new Modifier("Power Up", "Next attack gains increased attack and accurracy",
                    { caster: this, target: this, properties: ["physical", "buff"], listeners: { attackStart: true }, cancelListeners: ['attackStart'], focus: true },
                    function() {},
                    function(context) {
                        if (context.attacker !== this.vars.caster) return;
                        (context.calcMods.attacker ??= {}).attack = { bonus: (context.calcMods.attacker.attack?.bonus || 0) + 30 };
                        (context.calcMods.attacker ??= {}).accuracy = { bonus: (context.calcMods.attacker.accuracy?.bonus || 0) + 50 };
                        return true;
                    }
                )
            }
        },
        {
            name: "Defend",
            properties: ["physical", "buff"],
            description: "Increases defense and resist for 2 turns. If currently active, refreshes duration and allow stamina regen next turn",
            code() {
                const mod = modifiers.find(m => m.name === "Defend" && m.vars.caster === this)
                if (mod) mod.vars.duration = 2, this.previousAction[0] = false, logAction(`${this.name} refreshes ${mod.name}`);
                else basicModifier("Defend", "Defense and resist increase", { caster: this, target: this, duration: 2, properties: ["physical", "buff"], stats: { defense: 20, evasion: 15, resist: 30 }, listeners: { turnStart: true }, focus: true });
            }
        },
        {
            name: "Taunt",
            properties: ["physical", "debuff"],
            description: "Chance to decrease target focus and resist and double the chance for caster to be targeted by target for a 1 turn, can target backline",
            code() {
                let target = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "", false)), will = resistDebuff(this, target)[0];
                if (will >= 20) {
                    logAction(`${this.name} distracts ${target[0].name}`, "debuff");
                    new Modifier("Taunt", "Decreases target focus, and resist and doubles the chance for caster to be targeted by target",
                        { caster: this, target: target[0], duration: 1, properties: ["physical", "debuff"], stats: { focus: -25, resist: -10 }, listeners: { turnStart: true, targetStart: true }, cancelListeners: ['targetStart'], focus: true },
                        function() {},
                        function(context) {
                            let i;
                            if (context.event === 'targetStart' && currentUnit.at(-2) === this.vars.target && (i = context.unitList.findIndex(u => u === this.vars.caster)) > -1) (((context.targetMods.targets ??= [])[i] ??= {}).presence ??= { mult: 1 }).mult += 1;
                            if (context.unit === this.vars.caster) this.vars.duration--;
                            return this.vars.duration > 0;
                        }
                    );
                } else logAction(`${this.name} fails to distract ${target[0].name}`, "miss");
            }
        },
        {
            name: "Recover",
            properties: ["physical", "stamina", "heal"],
            cost: { stamina: 10 },
            description: "Heals moderately (15% max hp)",
            code() { heal(this, [this], [1.5]) }
        }
    ],
    secondary: [
        {
            name: "Attack",
            properties: ["attack"],
            description: "Attacks a single target 3 times",
            code() { attack(this, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false)), 3) }
        },
        {
            name: "Power Up",
            properties: ["buff"],
            description: "Next attack gains increased attack",
            code() {
                logAction(`${this.name} prepares for the next attack`, "buff");
                new Modifier("Power Up", "Next attack gains increased attack",
                    { caster: this, target: this, properties: ["physical", "stamina", "buff"], listeners: { attackStart: true }, cancelListeners: ['attackStart'], focus: true },
                    function() {},
                    function(context) {
                        if (context.attacker !== this.vars.caster) return;
                        (context.calcMods.attacker ??= {}).attack = { bonus: (context.calcMods.attacker.attack?.bonus || 0) + 30 };
                        return true;
                    }
                )
            }
        },
        {
            name: "Defend",
            properties: ["buff"],
            description: "Increases defense and resist for 1 turn",
            code() { basicModifier("Defend", "Defense and resist increase", { caster: this, target: this, duration: 2, properties: ["physical", "buff"], stats: { defense: 10, resist: 15 }, listeners: { turnStart: true }, focus: true }) }
        },
        {
            name: "Taunt",
            properties: ["debuff"],
            description: "Chance to decrease target focus and double the chance for caster to be targeted by target for a 1 turn",
            code() {
                let target = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false)), will = resistDebuff(this, target)[0];
                if (will > 33) {
                    logAction(`${this.name} distracts ${target[0].name}`, "debuff");
                    new Modifier("Taunt", "Decreases target evasion, focus, and resist and doubles the chance for caster to be targeted by target",
                        { caster: this, target: target[0], duration: 1, properties: ["physical", "debuff"], stats: { focus: -10 }, listeners: { turnStart: true, targetStart: true }, cancelListeners: ['targetStart'], focus: true },
                        function() {},
                        function(context) {
                            let i;
                            if (context.event === 'targetStart' && currentUnit.at(-2) === this.vars.target && (i = context.unitList.findIndex(u => u === this.vars.caster)) > -1) (((context.targetMods.targets ??= [])[i] ??= {}).presence ??= { mult: 1 }).mult += 1;
                            if (context.unit === this.vars.caster) this.vars.duration--;
                            return this.vars.duration > 0;
                        }
                    );
                } else logAction(`${this.name} fails to distract ${target[0].name}`, "miss");
            }
        },
        {
            name: "Recover",
            properties: ["physical", "heal"],
            description: "Heals moderately (10% max hp)",
            code() { heal(this, [this], [1]) }
        }
    ],
    passive: [
        {
            name: "Power Up",
            properties: ["physical", "stamina", "buff"],
            description: "Increases attack and accuracy every turn until attacking or stuned, which it resets",
            code() {
                new Modifier("Power Up", "Increases attack and accuracy every turn until attacking or stuned, which it resets",
                    { caster: this, target: this, properties: ["physical", "buff"], listeners: { attackStart: true, turnEnd: true }, cancelListeners: ['attackStart', 'turnEnd'], stats: { attack: 15, accuracy: 25 }, disablestatChange: true, focus: true, passive: true, charge: 0 },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.target) return !++this.vars.charge;
                        if (context.attacker !== this.vars.target) return;
                        (context.calcMods.attacker ??= {}).attack = { bonus: (context.calcMods.attacker.attack?.bonus || 0) + this.vars.stats.attack*this.vars.charge };
                        (context.calcMods.attacker ??= {}).accuracy = { bonus: (context.calcMods.attacker.accuracy?.bonus || 0) + this.vars.stats.accuracy*this.vars.charge };
                        this.vars.charge = 0;
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                this.vars.listeners.attackStart = false;
                                eventState.attackStart.splice(eventState.attackStart.indexOf(this), 1);
                                this.vars.listeners.turnEnd = false;
                                eventState.turnEnd.splice(eventState.turnEnd.indexOf(this), 1);
                                this.vars.charge = 0;
                            }
                            if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.listeners.attackStart = true;
                                eventState.attackStart.push(this);
                                this.vars.listeners.turnEnd = true;
                                eventState.turnEnd.push(this);
                            }
                        }
                    }
                )
            }
        },
        {
            name: "Defend",
            properties: ["physical", "stamina", "buff"],
            description: "Increases defense and resist",
            code() { basicModifier("Defend", "Defense and resist increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { defense: 10, resist: 20 }, listeners: { turnStart: true }, focus: true, passive: true }) }
        },
        {
            name: "Taunt",
            properties: ["physical", "stamina", "debuff"],
            description: "Start of turn, chooses a target and has a chance to decrease target focus and resist and double the chance for caster to be targeted by target, can target backline",
            code() {
                new Modifier("Taunt", "Decreases target focus, and resist and double the chance for caster to be targeted by target",
                    { caster: this, target: null, duration: 1, properties: ["physical", "debuff"], stats: { focus: -25, resist: -15 }, listeners: { turnStart: true, targetStart: true }, cancelListeners: ['targetStart'], focus: true, passive: true, fail: false },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            let target = randTarget(unitFilter(this.vars.caster.team === "player" ? "enemy" : "player", '', false)), will = resistDebuff(this.vars.caster, target)[0];
                            this.changeTarget(target[0]);
                            if (this.vars.fail && will > 33) this.cancel(this.vars.fail = false);
                            if (!this.vars.fail && will <= 33) this.cancel(this.vars.fail = true);
                        }
                        let i;
                        if (this.vars.target && context.event === 'targetStart' && currentUnit.at(-2) === this.vars.target && (i = context.unitList.findIndex(u => u === this.vars.caster)) > -1) (((context.targetMods.targets ??= [])[i] ??= {}).presence ??= { mult: 1 }).mult += 1;
                    }, undefined,
                    function(unit) {
                        if (!this.vars.target) resetStat(unit, Object.keys(this.vars.stats), Object.values(this.vars.stats));
                        if (this.vars.applied) {
                            this.cancel(true, true);
                            this.vars.target = unit;
                            this.cancel(false, true);
                        } else this.vars.target = unit;
                    }
                );
            }
        },
        {
            name: "Recover",
            properties: ["physical", "stamina", "heal"],
            description: `Heals (~2.5% max HP) at start of turn`,
            code() {
                new Modifier("Recover", `Heals at start of turn`,
                    { caster: this, target: this, properties: ["physical", "heal"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], focus: true, passive: true },
                    function() {},
                    function(context) { if (this.vars.target === context.unit) heal(this.vars.caster, [this.vars.target], [.25]) }
                );
            }
        }
    ],
    augment: [
        {
            name: "Power Up",
            properties: ["physical", "stamina", "buff"],
            description: "Increases attack/accuracy/focus every turn until attacking or stuned, which it resets",
            code() {
                new Modifier("Power Up", "Increases attack/accuracy/focus every turn until attacking or stuned, which it resets",
                    { caster: this, target: this, properties: ["physical", "buff"], listeners: { attackStart: true, turnEnd: true }, cancelListeners: ['attackStart', 'turnEnd'], stats: { attack: 30, accuracy: 50, focus: 50 }, disablestatChange: true, focus: true, passive: true, charge: 0 },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.target) return !++this.vars.charge;
                        if (context.attacker !== this.vars.target) return;
                        (context.calcMods.attacker ??= {}).attack = { bonus: (context.calcMods.attacker.attack?.bonus || 0) + this.vars.stats.attack*this.vars.charge };
                        (context.calcMods.attacker ??= {}).accuracy = { bonus: (context.calcMods.attacker.accuracy?.bonus || 0) + this.vars.stats.accuracy*this.vars.charge };
                        (context.calcMods.attacker ??= {}).focus = { bonus: (context.calcMods.attacker.focus?.bonus || 0) + this.vars.stats.focus*this.vars.charge };
                        this.vars.charge = 0;
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                this.vars.listeners.attackStart = false;
                                eventState.attackStart.splice(eventState.attackStart.indexOf(this), 1);
                                this.vars.listeners.turnEnd = false;
                                eventState.turnEnd.splice(eventState.turnEnd.indexOf(this), 1);
                                this.vars.charge = 0;
                            }
                            if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.listeners.attackStart = true;
                                eventState.attackStart.push(this);
                                this.vars.listeners.turnEnd = true;
                                eventState.turnEnd.push(this);
                            }
                        }
                    }
                )
            }
        },
        {
            name: "Defend",
            properties: ["physical", "stamina", "buff"],
            description: "Increases defense, evasion, and resist",
            code() { basicModifier("Defend", "Defense, evasion, and resist increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { defense: 15, evasion: 15, resist: 30 }, listeners: { turnStart: true }, focus: true, passive: true }) }
        },
        {
            name: "Taunt",
            properties: ["physical", "stamina", "debuff"],
            description: "Start of turn, chooses a target and has a chance to decrease target focus and resist and double the chance for caster to be targeted by target, can target backline",
            code() {
                new Modifier("Taunt", "Decreases target focus, and resist and double the chance for caster to be targeted by target",
                    { caster: this, target: null, duration: 1, properties: ["physical", "debuff"], stats: { focus: -40, resist: -25 }, listeners: { turnStart: true, targetStart: true }, cancelListeners: ['targetStart'], focus: true, passive: true, fail: false },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            let target = randTarget(unitFilter(this.vars.caster.team === "player" ? "enemy" : "player", '', false)), will = resistDebuff(this.vars.caster, target)[0];
                            this.changeTarget(target[0]);
                            if (this.vars.fail && will > 33) this.cancel(this.vars.fail = false);
                            if (!this.vars.fail && will <= 33) this.cancel(this.vars.fail = true);
                        }
                        let i;
                        if (this.vars.target && context.event === 'targetStart' && currentUnit.at(-2) === this.vars.target && (i = context.unitList.findIndex(u => u === this.vars.caster)) > -1) (((context.targetMods.targets ??= [])[i] ??= {}).presence ??= { mult: 1 }).mult += 1;
                    }, undefined,
                    function(unit) {
                        if (!this.vars.target) resetStat(unit, Object.keys(this.vars.stats), Object.values(this.vars.stats));
                        if (this.vars.applied) {
                            this.cancel(true, true);
                            this.vars.target = unit;
                            this.cancel(false, true);
                        } else this.vars.target = unit;
                    }
                );
            }
        },
        {
            name: "Recover",
            properties: ["physical", "stamina", "heal"],
            description: `Heals (~5% max HP) at start of turn`,
            code() {
                new Modifier("Recover", `Heals at start of turn`,
                    { caster: this, target: this, properties: ["physical", "heal"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], focus: true, passive: true },
                    function() {},
                    function(context) { if (this.vars.target === context.unit) heal(this.vars.caster, [this.vars.target], [.5]) }
                );
            }
        }
    ]
}

enemy.defaultSkills = [
    { category: 'special', name: 'Power Up' },
    { category: 'basic', name: 'Attack' },
    { category: 'secondary', name: 'Recover' },
    { category: 'passive', name: 'Taunt' },
    { category: 'augment', name: 'Defend' }
];