import { sleep, unitFilter, Modifier, handleEvent, removeModifier, basicModifier, stunModifier, logAction, resetStat, regenerateResources, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, modifiers, currentUnit, currentAction, elements, eventState } from '../combatDictionary.js';
import { Unit, allUnits } from './unit.js';

export const Revolutionary = new Unit("Revolutionary", [850, 50, 20, 130, 100, 150, 65, 90, 75, "mid", 75, 150, 20], ["passion/hatred"]);

Revolutionary.skills = {
    special: [
        {
            name: "Focus Fire",
            properties: ["physical", "attack", "pseudo-resource"],
            cost: { stamina: 40 },
            description: "Attacks a single target 4 times with increased attack/accuracy/focus, adds two attacks and extra attack if reloaded",
            target() { this.team === "player" ? selectTarget(this.skills.special, [1, true, unitFilter("enemy", "front", false)]) : this.skills.special.code.call(this, randTarget(unitFilter("player", "", false))) },
            code(target) {
                const bonus = this.custom?.focusFire ? !!this.custom.focusFire-- : 0;
                attack(this, target, 4 + 2*bonus, { attacker: { attack: { bonus: 50*(1 + bonus) }, accuracy: { bonus: 35 }, focus: { bonus: 40 } } })
            }
        },
        {
            name: "Flashbang",
            properties: ["physical", "stamina", "debuff", "stun"],
            cost: { stamina: 40, position: "front" },
            description: "Decrease target accuracy/evasion/speed for a few turns depending on chance and stuns target for 1 turn, 1% chance to fail",
            target() { this.team === "player" ? selectTarget(this.skills.special, [1, true, unitFilter("enemy", "front", false)]) : this.skills.special.code.call(this, randTarget(unitFilter("player", "", false))) },
            code(target) {
                const will = resistDebuff(this, target)[0];
                if (will >= 2) {
                    basicModifier("Flashbang debuff", "Accuracy, evasion, and speed decrease", { caster: this, target: target[0], duration: will > 99 ? 6 : Math.ceil(will/25), properties: ["physical", "debuff"], stats: { accuracy: -30, evasion: -60, speed: -25 }, listeners: { turnStart: true }, debuff: (target) => resistDebuff(this, [target])[0] >= 2 });
                    stunModifier("Flashbang", { caster: this, target: target[0], duration: 1, properties: ["physical", "stun", "debuff"], listeners: { turnEnd: true }, debuff: (target) => resistDebuff(this, [target])[0] >= 2 });
                } else logAction(`${target[0].name} resists the flashbang!`, "miss");
            }
        },
        {
            name: "Snipe",
            properties: ["physical", "stamina", "attack", "pseudo-resource"],
            cost: { stamina: 40, position: "back" },
            description: "Attacks a single target with increased attack/accuracy/focus, can target backline, adds extra attack if reloaded",
            target() { this.team === "player" ? selectTarget(this.skills.special, [1, true, unitFilter("enemy", "", false)]) : this.skills.special.code.call(this, randTarget(unitFilter("player", "", false))) },
            code(target) { attack(this, target, 1, { attacker: { attack: { bonus: this.custom?.snipe ? this.custom.snipe-- && 90 : 60  }, accuracy: { bonus: 70 }, focus: { bonus: 80 } } }) }
        },
        {
            name: "Reload",
            properties: ["physical", "stamina", "pseudo-resource"],
            cost: { stamina: 50 },
            description: `Ingnore reload mechanic for next 6 turns, reloads attacks afterwards`,
            code() {
                logAction(`${this.name}'s weapons turn automatic!`, "buff");
                new Modifier("Reload", `Ignores reload mechanic`,
                    { caster: this, target: this, duration: 6, properties: ["physical", "pseudo-resource"], listeners: { turnStart: true }, focus: true},
                    function() {
                        this.custom?.snipe !== undefined && (this.custom.snipe = 1);
                        this.custom?.focusFire !== undefined && (this.custom.focusFire = 1);
                        logAction(`${this.vars.target.name} reloads all weapons!`, "buff");
                    },
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            this.custom?.snipe !== undefined && (this.custom.snipe = 1);
                            this.custom?.focusFire !== undefined && (this.custom.focusFire = 1);
                            this.vars.duration--;
                        }
                        if (this.vars.duration <= 0);
                    }
                );
            }
        },
        {
            name: "Taunt",
            properties: ["physical", "stamina", "debuff"],
            cost: { stamina: 20 },
            description: "Decreases target evasion, focus, and resist and increase chance for caster to be targeted by target for a few turns, 1% chance to fail, can target backline if at frontline",
            target() {  this.team === "player" ? selectTarget(this.skills.special, [1, true, unitFilter("enemy", this.position === 'front' ? '' : 'front', false)]) : this.skills.special.code.call(this, randTarget(unitFilter("player", this.position === 'front' ? '' : 'front', false))) },
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
            name: "Made to Serve",
            properties: ["physical", "stamina", "buff", "penalty"],
            cost: { stamina: 30 },
            description: "Increases accuracy/focus and decreases resist/presence for 5 turns",
            code() {
                basicModifier("Made to Serve buff", "Accuracy and focus increase", { caster: this, target: this, duration: 6, properties: ["physical", "buff"], stats: { accuracy: 160, focus: 160 }, listeners: { turnEnd: true } });
                basicModifier("Made to Serve penalty", "resist and presence decrease", { caster: this, target: this, duration: 6, properties: ["physical", "buff"], stats: { resist: -40, presence: -80 }, listeners: { turnEnd: true }, penalty: true });
            }
        },
        {
            name: "Private Military",
            properties: ["physical", "stamina", "buff", "penalty"],
            cost: { stamina: 20 },
            description: "Increases attack/evasion and decreases resist/presence for 5 turns",
            code() {
                basicModifier("Private Military buff", "Attack and evasion increase", { caster: this, target: this, duration: 6, properties: ["physical", "buff"], stats: { attack: 45, evasion: 80 }, listeners: { turnEnd: true } });
                basicModifier("Private Military penalty", "resist and presence decrease", { caster: this, target: this, duration: 6, properties: ["physical", "buff"], stats: { resist: -30, presence: -60 }, listeners: { turnEnd: true }, penalty: true });
            }
        },
        {
            name: "Switch Position",
            properties: ["physical", "stamina", "positional"],
            cost: { stamina: 10 },
            description: "Switch between front and backline positions and immediately gain next turn",
            code() {
                this.switchPosition()
                this.timer -= 1000;
            }
        }
    ],
    basic: [
        {
            name: "Focus Fire",
            properties: ["physical", "attack", "pseudo-resource"],
            description: "Attacks a single target 2 times with increased attack/accuracy/focus, adds an extra attack and attack if reloaded",
            code() {
                const bonus = this.custom?.focusFire ? !!this.custom.focusFire-- : 0;
                attack(this, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false)), 2 + bonus, { attacker: { attack: { bonus: 25*(1 + bonus) }, accuracy: { bonus: 15 }, focus: { bonus: 20 } } })
            }
        },
        {
            name: "Flashbang",
            properties: ["physical", "debuff", "stun"],
            cost: { position: "front" },
            description: "Chance to decrease target evasion/speed for a few turns depending on chance and smaller chance to stun target for 1 turn",
            code() {
                const target = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false)), will = resistDebuff(this, target)[0];
                switch (true) {
                    case will >= 60:
                        stunModifier("Flashbang", { caster: this, target: target[0], duration: 1, properties: ["physical", "stun", "debuff"], listeners: { turnEnd: true }, debuff: (target) => resistDebuff(this, [target])[0] >= 60 });
                    case will >= 25:
                        basicModifier("Flashbang debuff", "Evasion, and speed decrease", { caster: this, target: target[0], duration: will > 99 ? 4 : Math.ceil(will/50), properties: ["physical", "debuff"], stats: { evasion: -30, speed: -15 }, listeners: { turnStart: true }, debuff: (target) => resistDebuff(this, [target])[0] >= 25 });
                        break;
                    default:
                        logAction(`${target[0].name} resists the flashbang!`, "miss");
                }
            }
        },
        {
            name: "Snipe",
            properties: ["physical", "attack", "pseudo-resource"],
            cost: { position: "back" },
            description: "Attacks a single target with increased attack/accuracy/focus, can target backline, requires reload to be used again",
            code() {
                (this.custom ??= {}).snipe ??= 1;
                if (this.custom.snipe) this.custom.snipe--, attack(this, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "", false)), 1, { attacker: { attack: { bonus: 30 }, accuracy: { bonus: 35 }, focus: { bonus: 40 } } });
                else {
                    this.custom.snipe++;
                    this.previousAction[0] = false;
                    logAction(`${this.name} is reloading a weapon!`, "info");
                }
            }
        },
        {
            name: "Taunt",
            properties: ["physical", "debuff"],
            description: "Chance to decrease target focus and resist and double the chance for caster to be targeted by target for a 1 turn, can target backline",
            code() {
                let target = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false)), will = resistDebuff(this, target)[0];
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
        },
        {
            name: "Private Military",
            properties: ["physical", "buff", "penalty"],
            description: "Increases attack/evasion and decreases resist/presence for 2 turns. If currently active, refreshes duration and allow stamina regen next turn",
            code() {
                let mod = modifiers.find(m => m.name.includes("Private Military") && m.vars.caster === this);
                if (mod) {
                    this.previousAction[0] = false;
                    mod.vars.duration = 3;
                    logAction(`${this.name} refreshes ${mod.name}`);
                    mod = modifiers.find(m => m !== mod && m.name.includes("Private Military") && m.vars.caster === this)
                    if (mod) mod.vars.duration = 3, logAction(`${this.name} refreshes ${mod.name}`);
                } else {
                    basicModifier("Private Military buff", "Attack and evasion increase", { caster: this, target: this, duration: 3, properties: ["physical", "buff"], stats: { attack: 30, evasion: 60 }, listeners: { turnEnd: true } });
                    basicModifier("Private Military penalty", "resist and presence decrease", { caster: this, target: this, duration: 3, properties: ["physical", "buff"], stats: { resist: -20, presence: -40 }, listeners: { turnEnd: true }, penalty: true });
                }
            }
        },
        {
            name: "Switch Position",
            properties: ["physical", "positional"],
            description: "Switch between front & backline positions and reduce timer by 50% for next turn",
            code() {
                this.switchPosition();
                this.timer -= 500;
            }
        }
    ],
    secondary: [
        {
            name: "Reload",
            properties: ["pseudo-resource"],
            description: `Reloads all attacks`,
            code() {
                this.custom?.snipe !== undefined && (this.custom.snipe = 2);
                this.custom?.focusFire !== undefined && (this.custom.focusFire = 2);
                logAction(`${this.name} reloads all attacks.`, "action");
            }
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
            name: "Made to Serve",
            properties: ["buff", "penalty"],
            description: "Increases accuracy/focus and decreases resist/presence for 1 turn",
            code() {
                basicModifier("Made to Serve buff", "Accuracy and focus increase", { caster: this, target: this, duration: 2, properties: ["physical", "buff"], stats: { accuracy: 80, focus: 80 }, listeners: { turnEnd: true } });
                basicModifier("Made to Serve penalty", "resist and presence decrease", { caster: this, target: this, duration: 2, properties: ["physical", "buff"], stats: { resist: -20, presence: -40 }, listeners: { turnEnd: true }, penalty: true });
            }
        },
        {
            name: "Private Military",
            properties: ["buff", "penalty"],
            description: "Increases attack/evasion and decreases presence for 1 turn",
            code() {
                basicModifier("Private Military buff", "Attack and evasion increase", { caster: this, target: this, duration: 2, properties: ["physical", "buff"], stats: { attack: 20, evasion: 40 }, listeners: { turnEnd: true } });
                basicModifier("Private Military penalty", "Presence decrease", { caster: this, target: this, duration: 2, properties: ["physical", "buff"], stats: { presence: -20 }, listeners: { turnEnd: true }, penalty: true });
            }
        },
        {
            name: "Switch Position",
            properties: ["positional"],
            description: "Switch between front and backline positions",
            code() { this.switchPosition() }
        }
    ],
    passive: [
        {
            name: "Reload",
            properties: ["physical", "stamina", "pseudo-resource"],
            cost: { stamina: 10 },
            description: `Spends stamina to instantly reload attacks, doesn't reload if stamina is too low`,
            code() {
                new Modifier("Reload", `Ignores reload mechanic`,
                    { caster: this, target: this, properties: ["physical", "stamina", "pseudo-resource"], listeners: { turnEnd: true }, cancelListeners: ['turnEnd'], cost: this.skills.passive.cost, focus: true, passive: true},
                    function() { this.vars.caster.custom = { dualWield: 1, snipe: 1, focusFire: 1 } },
                    function(context) {
                        if (context.unit === this.vars.caster && this.vars.applied) {
                            if (!this.vars.caster.custom.snipe && resourceChange(this.vars.caster, this.vars.cost, false)) this.vars.caster.custom.snipe = 1;
                            if (!this.vars.caster.custom.focusFire && resourceChange(this.vars.caster, this.vars.cost, false)) this.vars.caster.custom.focusFire = 1;
                        }
                    }
                );
            }
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
            name: "Made to Serve",
            properties: ["physical", "stamina", "buff", "penalty"],
            description: "Increases accuracy/focus and decreases resist/presence",
            code() {
                basicModifier("Made to Serve buff", "Accuracy and focus increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { accuracy: 60, focus: 60 } });
                basicModifier("Made to Serve penalty", "resist and presence decrease", { caster: this, target: this, properties: ["physical", "buff"], stats: { resist: -30, presence: -60 }, passive: true, penalty: true });
            }
        },
        {
            name: "Private Military",
            properties: ["physical", "stamina", "buff", "penalty"],
            description: "Increases attack/evasion and decreases resist/presence",
            code() {
                basicModifier("Private Military buff", "Attack and evasion increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { attack: 25, evasion: 40 } });
                basicModifier("Private Military penalty", "Resist and presence decrease", { caster: this, target: this, properties: ["physical", "buff"], stats: { resist: -20, presence: -40 }, passive: true, penalty: true });
            }
        }
    ],
    augment: [
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
            name: "Made to Serve",
            properties: ["physical", "stamina", "buff", "penalty"],
            description: "Increases accuracy/focus and decreases resist/presence",
            code() {
                basicModifier("Made to Serve buff", "Accuracy and focus increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { accuracy: 80, focus: 80 } });
                basicModifier("Made to Serve penalty", "resist and presence decrease", { caster: this, target: this, properties: ["physical", "buff"], stats: { resist: -20, presence: -40 }, passive: true, penalty: true });
            }
        },
        {
            name: "Private Military",
            properties: ["physical", "stamina", "buff", "penalty"],
            description: "Increases attack/evasion and decreases resist/presence",
            code() {
                basicModifier("Private Military buff", "Attack and evasion increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { attack: 40, evasion: 60 } });
                basicModifier("Private Military penalty", "Presence decrease", { caster: this, target: this, properties: ["physical", "buff"], stats: { presence: -20 }, passive: true, penalty: true });
            }
        }
    ]
}

Revolutionary.frontDefaultSkills = [
    { category: 'special', name: 'Focus Fire' },
    { category: 'basic', name: 'Flashbang' },
    { category: 'secondary', name: 'Switch Position' },
    { category: 'passive', name: 'Made to Serve' },
    { category: 'augment', name: 'Private Military' }
];

Revolutionary.backDefaultSkills = [
    { category: 'special', name: 'Focus Fire' },
    { category: 'basic', name: 'Snipe' },
    { category: 'secondary', name: 'Switch Position' },
    { category: 'passive', name: 'Made to Serve' },
    { category: 'augment', name: 'Private Military' }
];

Revolutionary.switchPosition = function() {
    if (this.position === "back") {
        this.position = "front";
        this.base.attack = 60;
        this.base.evasion = 60;
        this.base.resist = 50;
        this.base.speed = 110;
        this.base.presence = 125;
        this.skills = {...this.frontSkills}
    } else {
        this.position = "back";
        this.base.attack = 50;
        this.base.evasion = 100;
        this.base.resist = 65;
        this.base.speed = 90;
        this.base.presence = 75;
        this.skills = {...this.backSkills}
    }
    logAction(`${this.name} moves to the ${this.position}line.`, "info");
    resetStat(this, ["attack", "evasion", "resist", "speed", "presence"]);
    if (eventState.positionChange.length) handleEvent('positionChange', { unit: this, position: this.position });
}