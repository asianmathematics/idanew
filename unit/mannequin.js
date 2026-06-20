import { unitFilter } from '../combatDictionary.js';
import { Unit } from './unit.js';

export const Mannequin = new Unit("Mannnequin", [800, 45, 22, 140, 130, 150, 70, 145, 50, "mid", 70, 100, 10]);

const skills = {
    special: [
        {
            name: "A Wish To Be An Artificial",
            properties: ["physical", "stamina", "buff", "penalty"],
            cost: { stamina: 20 },
            description: "Cost 20 stamina\nIncreased accuracy/focus/speed and decreased presence & resist for 5 turns.",
            code: () => {
                if (this.stamina < 20) return showMessage("Not enough stamina!", "error", "selection");
                this.stamina -= 20;
                this.previousAction[0] = true;
                logAction(`${this.name} reaches for an ideal!`, "buff");
                basicModifier("A Wish To Be An Artificial buff", "Accuracy, focus, and speed increase", { caster: this, target: this, duration: 6, properties: ["physical", "stamina", "buff"], stats: { accuracy: 60, focus: 50, speed: 40 }, listeners: {turnEnd: true}, cancel: false, applied: true, focus: true });
                basicModifier("A Wish To Be An Artificial penalty", "Speed and presence decrease", { caster: this, target: this, duration: 6, properties: ["physical", "stamina", "penalty"], stats: { resist: -25, presence: -35 }, listeners: {turnEnd: true}, cancel: false, applied: true, focus: true, penalty: true });
            }
        },
        {
            name: "Emergency Aid",
            properties: ["physical", "stamina", "heal", "positional"],
            cost: { stamina: 50 },
            description: "Costs 50 stamina\nHeals self and all allies (around ~20% max hp) in the same position",
            code: () => {
                if (this.stamina < 50) return showMessage("Not enough stamina!", "error", "selection");
                this.previousAction[0] = true;
                this.stamina -= 50;
                logAction(`${this.name} provides emergency aid to the entire ${this.position}line!`, "heal");
                for (let target of unitFilter(this.team, this.position)) {
                    if (eventState.resourceChange.length) handleEvent('resourceChange', { effect: this.actions.special, unit: target, resource: ['hp'], value: [2 * target.healFactor] });
                    if (target.hp === 0 && eventState.unitChange.length) handleEvent('unitChange', {type: 'revive', unit: target});
                    target.hp = Math.min(target.base.hp, target.hp + 2 * target.healFactor);
                }
            }
        },
        {
            name: "Ex-Revolutionary",
            properties: ["physical", "stamina", "buff", "penalty"],
            cost: { stamina: 20 },
            description: "Cost 20 stamina\nIncreased attack/accuracy/focus and decreased defense/evasion/resist/presence for 5 turns.",
            code: () => {
                if (this.stamina < 20) return showMessage("Not enough stamina!", "error", "selection");
                this.stamina -= 20;
                this.previousAction[0] = true;
                logAction(`${this.name} reaches for an ideal!`, "buff");
                basicModifier("Ex-Revolutionary buff", "attack, accuracy, and focus increase", { caster: this, target: this, duration: 6, properties: ["physical", "stamina", "buff"], stats: { attack: 40, accuracy: 40, focus: 30 }, listeners: {turnEnd: true}, cancel: false, applied: true, focus: true });
                basicModifier("Ex-Revolutionary penalty", "Defense, evasion, resist, and presence decrease", { caster: this, target: this, duration: 6, properties: ["physical", "stamina", "penalty"], stats: { defense: -10, evasion: -25, resist: -50, presence: -50 }, listeners: {turnEnd: true}, cancel: false, applied: true, focus: true, penalty: true });
            }
        },
        {
            name: "Dual Wield",
            properties: ["physical", "stamina", "attack"],
            cost: { stamina: 40, position: "front" },
            description: "Cost 40 stamina, Frontline only\nAttacks with increased damage to a single target 8 times or two targets 4 times, requires a reload to be used again",
            target: () => this.stamina < 40 ? showMessage("Not enough stamina!", "error", "selection") : this.team === "player" ? selectTarget(this.actions.special, () => { playerTurn(this) }, [2, false, unitFilter("enemy", "front", false)]) : this.actions.special.code(randTarget(unitFilter("player", "front", false))),
            code: (targets) => {
                this.stamina -= 40;
                this.previousAction[0] = true;
                logAction(`${this.name} attempts to do a trickshot!`, "action");
                attack(this, targets, 8 / targets.length, { attacker: { attack: this.attack + 25} });
            }
        },
        {
            name: "Snipe",
            properties: ["physical", "stamina", "attack"],
            cost: { stamina: 40, position: "back" },
            description: "Cost 40 stamina, Backline only\nAttacks a single target with increased attack/accuracy/focus, can target backline, requires a reload to be used again",
            target: () => this.stamina < 40 ? showMessage("Not enough stamina!", "error", "selection") : this.team === "player" ? selectTarget(this.actions.special, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "", false)]) : this.actions.special.code(randTarget(unitFilter("player", "", false))),
            code: (target) => {
                this.stamina -= 40;
                this.previousAction[0] = true;
                logAction(`${this.name} attempts to headshot ${target[0].name}!`, "action");
                attack(this, target, 1, { attacker: { attack: this.attack + 60, accuracy: this.accuracy + 70, focus: this.focus + 80 } });
            }
        },
        {
            name: "Reload",
            properties: ["physical", "stamina", "pseudo-resource"],
            cost: { stamina: 50 },
            description: `Cost 50 stamina\nIngnore reload mechanic for next 6 turns, reloads attacks afterwards`,
            code: () => {
                if (this.stamina < 50) return showMessage("Not enough stamina!", "error", "selection");
                this.stamina -= 50;
                this.previousAction[0] = true;
                new Modifier("Reload", `Ignores reload mechanic`,
                    { caster: this, target: this, duration: 6, properties: ["physical", "stamina", "pseudo-resource"], listeners: { turnStart: true }, cancel: false, applied: true, focus: true},
                    function() {
                        this.custom?.dualWield !== undefined && (this.custom.dualWield = true);
                        this.custom?.snipe !== undefined && (this.custom.snipe = true);
                        logAction(`${this.vars.target.name} reloads all weapons!`, "buff");
                    },
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            this.custom?.dualWield !== undefined && (this.custom.dualWield = true);
                            this.custom?.snipe !== undefined && (this.custom.snipe = true);
                            this.vars.duration--;
                        }
                        if (this.vars.duration <= 0);
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) this.vars.applied = false;
                            else if (!this.vars.cancel && !this.vars.applied) this.vars.applied = true;
                        }
                    }
                );
            }
        },
        {
        name: "Switch Position",
        properties: ["physical", "stamina", "positional"],
        description: "Switch between front and backline positions as well as perform both frontline and backline basic skills",
        code: () => {
            this.previousAction[0] = true;
            this.skills.basic.code();
            if (eventState.positionChange.length) handleEvent('positionChange', { unit: this, position: this.position === "back" ? "front" : "back" });
            if (this.position === "back") {
                this.position = "front";
                logAction(`${this.name} moves to the frontline.`, "info");
                this.base.attack = 55;
                this.base.evasion = 90;
                this.base.resist = 55;
                this.base.speed = 165;
                this.base.presence = 100;
            } else {
                this.position = "back";
                logAction(`${this.name} moves to the backline.`, "info");
                this.base.attack = 45;
                this.base.evasion = 130;
                this.base.resist = 70;
                this.base.speed = 145;
                this.base.presence = 50;
            }
            resetStat(this, ["attack", "evasion", "resist", "speed", "presence"]);
            this.skills.basic.code();
        }
    }
    ],
    basic: [
        {
            name: "Emergency Aid",
            properties: ["physical", "stamina", "heal", "positional"],
            cost: { stamina: 20 },
            description: "Costs 20 stamina\nHeals lowest hp ally (around ~20% max hp) in the same position",
            code: () => {
                if (this.stamina < 20) return showMessage("Not enough stamina!", "error", "selection");
                this.previousAction[0] = true;
                this.stamina -= 20;
                let target = unitFilter(this.team, this.position).reduce((lowest, unit) => unit.hp / unit.base.hp < lowest.hp / lowest.base.hp ? unit : lowest);
                if (eventState.targets.length) handleEvent('targets', { selectedTargets: target, count: 1, trueRand: false });
                logAction(`${this.name} provides emergency aid to ${target.name}!`, "heal");
                if (eventState.resourceChange.length) handleEvent('resourceChange', { effect: this.actions.basic, unit: target, resource: ['hp'], value: [2 * target.healFactor] });
                if (target.hp === 0 && eventState.unitChange.length) handleEvent('unitChange', {type: 'revive', unit: target});
                target.hp = Math.min(target.base.hp, target.hp + 2 * target.healFactor);
            }
        },
        {
            name: "Dual Wield",
            properties: ["physical", "attack", "pseudo-resource"],
            cost: { position: "front" },
            description: "Frontline only\nAttacks with increased damage to a single target 4 times or two targets 2 times",
            code: () => {
                this.previousAction[0] = true;
                const targets = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false), 2)
                (this.custom ??= {}).dualWield ??= true;
                if (!(this.custom.dualWield = !this.custom.dualWield)) {
                    logAction(`${this.name} dual wields!`, "action");
                    attack(this, targets, 4 / targets.length, { attacker: { attack: this.attack + 25} });
                }
            }
        },
        {
            name: "Snipe",
            properties: ["physical", "attack", "pseudo-resource"],
            cost: { position: "back" },
            description: "Backline only\nAttacks a single target with increased attack/accuracy/focus, can target backline, requires reload to be used again",
            code: (target) => {
                this.previousAction[0] = true;
                const target = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "", false));
                (this.custom ??= {}).snipe ??= true;
                if (!(this.custom.snipe = this.custom.snipe)) {
                    logAction(`${this.name} snipes ${target[0].name}!`, "action");
                    attack(this, target, 1, { attacker: { attack: this.attack + 30, accuracy: this.accuracy + 35, focus: this.focus + 40 } });
                }
            }
        },
    ],
    secondary: [
        {
            name: "A Wish To Be An Artificial",
            properties: ["buff", "penalty"],
            description: "Increased accuracy & speed and decreased presence & resist.",
            code: () => {
                logAction(`${this.name} hops for the impossible.`, "buff");
                basicModifier("A Wish To Be An Artificial buff", "Accuracy and speed increase", { caster: this, target: this, duration: 2, properties: ["physical", "buff"], stats: { accuracy: 40, speed: 30 }, listeners: {turnEnd: true}, cancel: false, applied: true, focus: true });
                basicModifier("A Wish To Be An Artificial penalty", "Speed and presence decrease", { caster: this, target: this, duration: 2, properties: ["physical", "penalty"], stats: { resist: -15, presence: -25 }, listeners: {turnEnd: true}, cancel: false, applied: true, focus: true, penalty: true });
            }
        },
        {
            name: "Emergency Aid",
            properties: ["physical", "heal", "positional"],
            description: "Heals lowest hp ally (around ~10% max hp) in the same position",
            code: () => {
                this.previousAction[0] = true;
                let target = unitFilter(this.team, this.position).reduce((lowest, unit) => unit.hp / unit.base.hp < lowest.hp / lowest.base.hp ? unit : lowest);
                if (eventState.targets.length) handleEvent('targets', { selectedTargets: target, count: 1, trueRand: false });
                logAction(`${this.name} provides some aid to ${target.name}!`, "heal");
                if (eventState.resourceChange.length) handleEvent('resourceChange', { effect: this.actions.basic, unit: target, resource: ['hp'], value: [target.healFactor] });
                if (target.hp === 0 && eventState.unitChange.length) handleEvent('unitChange', {type: 'revive', unit: target});
                target.hp = Math.min(target.base.hp, target.hp + target.healFactor);
            }
        },
        {
            name: "Reload",
            properties: ["pseudo-resource"],
            description: `Reloads all attacks`,
            code: () => {
                this.custom?.dualWield !== undefined && (this.custom.dualWield = true);
                this.custom?.snipe !== undefined && (this.custom.snipe = true);
                logAction(`${this.name} reloads all attacks!`, "action");
            }
        },
        {
        name: "Switch Position",
        properties: ["positional"],
        description: "Switch between front and backline positions",
        code: () => {
            if (eventState.positionChange.length) handleEvent('positionChange', { unit: this, position: this.position === "back" ? "front" : "back" });
            if (this.position === "back") {
                this.position = "front";
                logAction(`${this.name} moves to the frontline.`, "info");
                this.base.attack = 55;
                this.base.evasion = 90;
                this.base.resist = 55;
                this.base.speed = 165;
                this.base.presence = 100;
            } else {
                this.position = "back";
                logAction(`${this.name} moves to the backline.`, "info");
                this.base.attack = 45;
                this.base.evasion = 130;
                this.base.resist = 70;
                this.base.speed = 145;
                this.base.presence = 50;
            }
            resetStat(this, ["attack", "evasion", "resist", "speed", "presence"]);
        }
    }
    ],
    passive: [
        {
            name: "A Wish To Be An Artificial",
            properties: ["buff", "penalty"],
            description: "Increased accuracy & speed and decreased presence & resist.",
            code: () => {
                new Modifier("A Wish To Be An Artificial buff", "Accuracy and speed increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { accuracy: 30, speed: 15 }, cancel: false, applied: true, focus: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) {},
                    function() {
                        if (this.vars.cancel && this.vars.applied) {
                            resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats), false);
                            this.vars.applied = false;
                        } else if (!this.vars.cancel && !this.vars.applied) {
                            resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats));
                            this.vars.applied = true;
                        }
                    }
                );
                new Modifier("A Wish To Be An Artificial penalty", "Speed and presence decrease", { caster: this, target: this, properties: ["physical", "penalty"], stats: { resist: -25, presence: -35 }, cancel: false, applied: true, focus: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) {},
                    function() {
                        if (this.vars.cancel && this.vars.applied) {
                            resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats), false);
                            this.vars.applied = false;
                        } else if (!this.vars.cancel && !this.vars.applied) {
                            resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats));
                            this.vars.applied = true;
                        }
                    }
                );
            }
        },
        {
            name: "Emergency Aid",
            properties: ["heal", "positional"],
            cost: { stamina: 20 },
            description: "Reduce max stamina by 20\nHeals lowest hp ally (around ~5% max hp) in the same position times number of alive allies in same position",
            code: () => {
                this.base.stamina = Math.max(0, this.base.stamina - 20);
                new Modifier("Emergency Aid", `Heals lowest hp ally (around ~5% max hp) in the same position times number of alive allies in same position`,
                    { caster: this, target: this, properties: ["physical", "stamina", "heal", "positional"], listeners: { turnStart: true, unitChange: false }, cancel: false, applied: true, focus: true, passive: true },
                    function() {},
                    function(context) {
                        if (this.vars.listeners.unitChange && context.unit === this.vars.target && context.type === "revive") this.cancel(false);
                        else if (this.vars.applied && context.unit === this.vars.target) {
                            let target = unitFilter(this.vars.target.team, this.vars.target.position).reduce((lowest, unit) => unit.hp / unit.base.hp < lowest.hp / lowest.base.hp ? unit : lowest);
                            if (eventState.targets.length) { handleEvent('targets', { selectedTargets: target, count: 1, trueRand: false }) };
                            let count = unitFilter(this.vars.target.team, this.vars.target.position).filter(u => u.hp > 0).length - 1;
                            if (eventState.resourceChange.length) handleEvent('resourceChange', { effect: this, unit: target, resource: ['hp'], value: [Math.round(target.healFactor * count / 2)] });
                            target.hp = Math.min(target.hp + Math.round(target.healFactor * count / 2), target.base.hp);
                            logAction(`${this.vars.caster.name} healed ${this.vars.caster.team === "player" ? ` ${Math.round(target.healFactor * count / 2)} HP to` : ''}${target.name}!`, "buff");
                        }
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                this.vars.applied = false;
                                this.vars.listeners.turnStart = false;
                                eventState.turnStart.splice(eventState.turnStart.indexOf(this), 1);
                                this.vars.listeners.unitChange = true;
                                eventState.unitChange.push(this);
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.applied = true;
                                this.vars.listeners.unitChange = false;
                                eventState.unitChange.splice(eventState.unitChange.indexOf(this), 1);
                                this.vars.listeners.turnStart = true;
                                eventState.turnStart.push(this);
                            }
                        }
                    }
                );
            }
        },
        {
            name: "Ex-Revolutionary",
            properties: ["physical", "buff", "penalty"],
            cost: { stamina: 10 },
            description: "Reduce max stamina by 10\nIncreased attack/accuracy/focus and decreased defense/evasion/resist/presence.",
            code: () => {
                this.base.stamina = Math.max(0, this.base.stamina - 10);
                new Modifier("Ex-Revolutionary buff", "attack, accuracy, and focus increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { attack: 20, accuracy: 20, focus: 15 }, cancel: false, applied: true, focus: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) {},
                    function() {
                        if (this.vars.cancel && this.vars.applied) {
                            resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats), false);
                            this.vars.applied = false;
                        } else if (!this.vars.cancel && !this.vars.applied) {
                            resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats));
                            this.vars.applied = true;
                        }
                    }
                );
                new Modifier("Ex-Revolutionary penalty", "Defense, evasion, resist, and presence decrease", { caster: this, target: this, properties: ["physical", "penalty"], stats: { defense: -20, evasion: -25, resist: -50, presence: -50 }, cancel: false, applied: true, focus: true, penalty: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) {},
                    function() {
                        if (this.vars.cancel && this.vars.applied) {
                            resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats), false);
                            this.vars.applied = false;
                        } else if (!this.vars.cancel && !this.vars.applied) {
                            resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats));
                            this.vars.applied = true;
                        }
                    }
                );
            }
        },
        {
            name: "Reload",
            properties: ["physical", "stamina", "pseudo-resource"],
            cost: { stamina: 20 },
            description: `Cost 20 stamina\nSpends stamina to instantly reload attacks, doesn't reload if stamina is too low`,
            code: () => {
                new Modifier("Reload", `Ignores reload mechanic`,
                    { caster: this, target: this, properties: ["physical", "stamina", "pseudo-resource"], listeners: { turnEnd: true }, cancel: false, applied: true, focus: true, passive: true},
                    function() { this.vars.caster.custom = { dualWield: true, snipe: true } },
                    function(context) {
                        if (context.unit === this.vars.caster && this.vars.applied) {
                            if (Object.hasOwn(this.vars.caster.custom, dualWield) && this.vars.caster.stamina >= 20) {
                                if (eventState.resourceChange.length) handleEvent('resourceChange', { effect: this, unit: this.vars.caster, resource: ['stamina'], value: [-20] });
                                this.vars.caster.stamina -= 20;
                                this.vars.caster.custom.dualWield = true;
                            }
                            if (Object.hasOwn(this.vars.caster.custom, snipe) && this.vars.caster.stamina >= 20) {
                                if (eventState.resourceChange.length) handleEvent('resourceChange', { effect: this, unit: this.vars.caster, resource: ['stamina'], value: [-20] });
                                this.vars.caster.stamina -= 20;
                                this.vars.caster.custom.snipe = true;
                            }
                        }
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                this.vars.applied = false;
                                this.vars.listeners.turnEnd = false;
                                eventState.turnEnd.splice(eventState.turnEnd.indexOf(this), 1);
                            }
                            else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.applied = true;
                                this.vars.listeners.turnEnd = true;
                                eventState.turnEnd.push(this);
                            }
                        }
                    }
                );
            }
        },
    ],
    augment: [
        {
            name: "A Wish To Be An Artificial",
            properties: ["buff", "penalty"],
            description: "Increased accuracy & speed and decreased presence & resist.",
            code: () => {
                new Modifier("A Wish To Be An Artificial buff", "Accuracy and speed increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { accuracy: 40, speed: 30 }, cancel: false, applied: true, focus: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) {},
                    function() {
                        if (this.vars.cancel && this.vars.applied) {
                            resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats), false);
                            this.vars.applied = false;
                        } else if (!this.vars.cancel && !this.vars.applied) {
                            resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats));
                            this.vars.applied = true;
                        }
                    }
                );
                new Modifier("A Wish To Be An Artificial penalty", "Speed and presence decrease", { caster: this, target: this, properties: ["physical", "penalty"], stats: { resist: -15, presence: -25 }, cancel: false, applied: true, focus: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) {},
                    function() {
                        if (this.vars.cancel && this.vars.applied) {
                            resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats), false);
                            this.vars.applied = false;
                        } else if (!this.vars.cancel && !this.vars.applied) {
                            resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats));
                            this.vars.applied = true;
                        }
                    }
                );
            }
        },
        {
            name: "Emergency Aid",
            properties: ["heal", "positional"],
            cost: { stamina: 20 },
            description: "Reduce max stamina by 20\nHeals lowest hp ally (around ~7.5% max hp) in the same position times number of alive allies in same position",
            code: () => {
                this.base.stamina = Math.max(0, this.base.stamina - 20);
                new Modifier("Emergency Aid", `Heals lowest hp ally (around ~7.5% max hp) in the same position times number of alive allies in same position`,
                    { caster: this, target: this, properties: ["physical", "stamina", "heal"], listeners: { turnStart: true, unitChange: false }, cancel: false, applied: true, focus: true, passive: true },
                    function() {},
                    function(context) {
                        if (this.vars.listeners.unitChange && context.unit === this.vars.target && context.type === "revive") this.cancel(false);
                        else if (this.vars.applied && context.unit === this.vars.target) {
                            let target = unitFilter(this.vars.target.team, this.vars.target.position).reduce((lowest, unit) => unit.hp / unit.base.hp < lowest.hp / lowest.base.hp ? unit : lowest);
                            let count = unitFilter(this.vars.target.team, this.vars.target.position).filter(u => u.hp > 0).length - 1;
                            if (eventState.resourceChange.length) handleEvent('resourceChange', { effect: this, unit: target, resource: ['hp'], value: [Math.round(target.healFactor * count * 0.75)] });
                            target.hp = Math.min(target.hp + Math.round(target.healFactor * count * 0.75), target.base.hp);
                            logAction(`${this.vars.caster.name} healed ${this.vars.caster.team === "player" ? ` ${Math.round(target.healFactor * count * 0.75)} HP to` : ''}${target.name}!`, "buff");
                        }
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                this.vars.applied = false;
                                this.vars.listeners.turnStart = false;
                                eventState.turnStart.splice(eventState.turnStart.indexOf(this), 1);
                                this.vars.listeners.unitChange = true;
                                eventState.unitChange.push(this);
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.applied = true;
                                this.vars.listeners.unitChange = false;
                                eventState.unitChange.splice(eventState.unitChange.indexOf(this), 1);
                                this.vars.listeners.turnStart = true;
                                eventState.turnStart.push(this);
                            }
                        }
                    }
                );
            }
        },
        {
            name: "Ex-Revolutionary",
            properties: ["physical", "buff", "penalty"],
            cost: { stamina: 10 },
            description: "Reduce max stamina by 10\nIncreased attack/accuracy/focus and decreased defense/evasion/resist/presence.",
            code: () => {
                this.base.stamina = Math.max(0, this.base.stamina - 10);
                new Modifier("Ex-Revolutionary buff", "attack, accuracy, and focus increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { attack: 40, accuracy: 40, focus: 30 }, cancel: false, applied: true, focus: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) {},
                    function() {
                        if (this.vars.cancel && this.vars.applied) {
                            resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats), false);
                            this.vars.applied = false;
                        } else if (!this.vars.cancel && !this.vars.applied) {
                            resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats));
                            this.vars.applied = true;
                        }
                    }
                );
                new Modifier("Ex-Revolutionary penalty", "Defense, evasion, resist, and presence decrease", { caster: this, target: this, properties: ["physical", "penalty"], stats: { defense: -10, evasion: -15, resist: -30, presence: -40 }, cancel: false, applied: true, focus: true, penalty: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) {},
                    function() {
                        if (this.vars.cancel && this.vars.applied) {
                            resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats), false);
                            this.vars.applied = false;
                        } else if (!this.vars.cancel && !this.vars.applied) {
                            resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats));
                            this.vars.applied = true;
                        }
                    }
                );
            }
        },
    ]
}