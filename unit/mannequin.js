import { setUnit, sleep, unitFilter, Modifier, handleEvent, removeModifier, basicModifier, logAction, resetStat, regenerateResources, enemyTurn, randTarget, playerTurn, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, allUnits, modifiers, currentUnit, currentAction, elements, eventState } from '../combatDictionary.js';
import { Unit } from './unit.js';

export const Mannequin = new Unit("Mannnequin", [800, 45, 22, 140, 130, 150, 70, 145, 50, "mid", 120, 100, 10]);

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
                basicModifier("A Wish To Be An Artificial buff", "Accuracy, focus, and speed increase", { caster: this, target: this, duration: 6, properties: ["physical", "buff"], stats: { accuracy: 60, focus: 50, speed: 40 }, listeners: { turnEnd: true }, focus: true });
                basicModifier("A Wish To Be An Artificial penalty", "Speed and presence decrease", { caster: this, target: this, duration: 6, properties: ["physical", "penalty"], stats: { resist: -25, presence: -35 }, listeners: { turnEnd: true }, focus: true, penalty: true });
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
                const targets = unitFilter(this.team, this.position);
                heal(this, targets, Array(targets.length).fill(2));
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
                basicModifier("Ex-Revolutionary buff", "attack, accuracy, and focus increase", { caster: this, target: this, duration: 6, properties: ["physical", "buff"], stats: { attack: 40, accuracy: 40, focus: 30 }, listeners: { turnEnd: true }, focus: true });
                basicModifier("Ex-Revolutionary penalty", "Defense, evasion, resist, and presence decrease", { caster: this, target: this, duration: 6, properties: ["physical", "penalty"], stats: { defense: -10, evasion: -25, resist: -50, presence: -50 }, listeners: { turnEnd: true }, focus: true, penalty: true });
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
                    { caster: this, target: this, duration: 6, properties: ["physical", "pseudo-resource"], listeners: { turnStart: true }, focus: true},
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
                    }
                );
            }
        },
        {
            name: "Switch Position",
            properties: ["physical", "stamina", "positional"],
            description: "Switch between front and backline positions, perform both frontline & backline basic skills, and reduce timer by 25% for next turn",
            code: () => {
                this.previousAction[0] = true;
                this.skills.basic.code();
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
                if (eventState.positionChange.length) handleEvent('positionChange', { unit: this, position: this.position });
                this.skills.basic.code();
                this.timer -= 250;
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
                heal(this, [target], [2]);
            }
        },
        {
            name: "Dual Wield",
            properties: ["physical", "attack", "pseudo-resource"],
            cost: { position: "front" },
            description: "Frontline only\nAttacks with increased damage to a single target 4 times or two targets 2 times",
            code: () => {
                this.previousAction[0] = true;
                const targets = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false), 2);
                (this.custom ??= {}).dualWield ??= true;
                if (!(this.custom.dualWield = !this.custom.dualWield)) attack(this, targets, 4 / targets.length, { attacker: { attack: this.attack + 25} });
                else logAction(`${this.name} is reloading weapons!`, "info");
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
                if (!(this.custom.snipe = !this.custom.snipe)) attack(this, target, 1, { attacker: { attack: this.attack + 30, accuracy: this.accuracy + 35, focus: this.focus + 40 } });
                else logAction(`${this.name} is reloading a weapon!`, "info");
            }
        },
        {
            name: "Switch Position",
            properties: ["physical", "positional"],
            description: "Switch between front & backline positions and reduce timer by 10% for next turn",
            code: () => {
                this.previousAction[0] = true;
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
                if (eventState.positionChange.length) handleEvent('positionChange', { unit: this, position: this.position });
                this.timer -= 100;
            }
        }
    ],
    secondary: [
        {
            name: "A Wish To Be An Artificial",
            properties: ["buff", "penalty"],
            description: "Increased accuracy & speed and decreased presence & resist.",
            code: () => {
                basicModifier("A Wish To Be An Artificial buff", "Accuracy and speed increase", { caster: this, target: this, duration: 2, properties: ["physical", "buff"], stats: { accuracy: 40, speed: 30 }, listeners: { turnEnd: true }, focus: true });
                basicModifier("A Wish To Be An Artificial penalty", "Speed and presence decrease", { caster: this, target: this, duration: 2, properties: ["physical", "penalty"], stats: { resist: -15, presence: -25 }, listeners: { turnEnd: true }, focus: true, penalty: true });
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
                heal(this, [target], [1]);
            }
        },
        {
            name: "Reload",
            properties: ["pseudo-resource"],
            description: `Reloads all attacks`,
            code: () => {
                this.custom?.dualWield !== undefined && (this.custom.dualWield = true);
                this.custom?.snipe !== undefined && (this.custom.snipe = true);
                logAction(`${this.name} reloads all attacks.`, "action");
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
                new Modifier("A Wish To Be An Artificial buff", "Accuracy and speed increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { accuracy: 30, speed: 15 }, focus: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function() {}
                );
                new Modifier("A Wish To Be An Artificial penalty", "Speed and presence decrease", { caster: this, target: this, properties: ["physical", "penalty"], stats: { resist: -25, presence: -35 }, focus: true, penalty: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function() {}
                );
            }
        },
        {
            name: "Emergency Aid",
            properties: ["heal", "positional"],
            description: "Reduce max stamina by 20 and base stamina regen by 2\nHeals lowest hp ally (around ~5% max hp) in the same position times number of alive allies in same position",
            code: () => {
                this.base.stamina -= 20;
                this.base.staminaRegen -= 2;
                new Modifier("Emergency Aid", `Heals lowest hp ally (around ~5% max hp) in the same position times number of alive allies in same position`,
                    { caster: this, target: this, properties: ["physical", "stamina", "heal", "positional"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], focus: true, passive: true },
                    function() {},
                    function(context) {
                        if (this.vars.applied && context.unit === this.vars.target) {
                            let list = unitFilter(this.vars.target.team, this.vars.target.position), target = list.reduce((lowest, unit) => unit.hp / unit.base.hp < lowest.hp / lowest.base.hp ? unit : lowest);
                            if (eventState.targets.length) { handleEvent('targets', { selectedTargets: target, count: 1, trueRand: false }) };
                            heal(this.vars.caster, [target], [(list.filter(u => u.hp > 0).length - 1)/2]);
                        }
                    }
                );
            }
        },
        {
            name: "Ex-Revolutionary",
            properties: ["physical", "buff", "penalty"],
            description: "Reduce max stamina by 10 and base stamina regen by 1\nIncreased attack/accuracy/focus and decreased defense/evasion/resist/presence.",
            code: () => {
                this.base.stamina -= 10;
                this.base.staminaRegen -= 1;
                new Modifier("Ex-Revolutionary buff", "attack, accuracy, and focus increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { attack: 20, accuracy: 20, focus: 15 }, focus: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function() {}
                );
                new Modifier("Ex-Revolutionary penalty", "Defense, evasion, resist, and presence decrease", { caster: this, target: this, properties: ["physical", "penalty"], stats: { defense: -20, evasion: -25, resist: -50, presence: -50 }, focus: true, penalty: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function() {}
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
                    { caster: this, target: this, properties: ["physical", "stamina", "pseudo-resource"], listeners: { turnEnd: true }, cancelListeners: ['turnEnd'], focus: true, passive: true},
                    function() { this.vars.caster.custom = { dualWield: true, snipe: true } },
                    function(context) {
                        if (context.unit === this.vars.caster && this.vars.applied) {
                            if (!this.vars.caster.custom.dualWield) this.vars.caster.custom.dualWield = resourceChange(this.vars.caster, { stamina: -20 });
                            if (!this.vars.caster.custom.snipe) this.vars.caster.custom.snipe = resourceChange(this.vars.caster, { stamina: -20 });
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
                new Modifier("A Wish To Be An Artificial buff", "Accuracy and speed increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { accuracy: 40, speed: 30 }, focus: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function() {}
                );
                new Modifier("A Wish To Be An Artificial penalty", "Speed and presence decrease", { caster: this, target: this, properties: ["physical", "penalty"], stats: { resist: -15, presence: -25 }, focus: true, penalty: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function() {}
                );
            }
        },
        {
            name: "Emergency Aid",
            properties: ["heal", "positional"],
            description: "Reduce max stamina by 20\nHeals lowest hp ally (around ~7.5% max hp) in the same position times number of alive allies in same position",
            code: () => {
                this.base.stamina = Math.max(0, this.base.stamina - 20);
                new Modifier("Emergency Aid", `Heals lowest hp ally (around ~7.5% max hp) in the same position times number of alive allies in same position`,
                    { caster: this, target: this, properties: ["physical", "stamina", "heal"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], focus: true, passive: true },
                    function() {},
                    function(context) {
                        if (this.vars.applied && context.unit === this.vars.target) {
                            let list = unitFilter(this.vars.target.team, this.vars.target.position), target = list.reduce((lowest, unit) => unit.hp / unit.base.hp < lowest.hp / lowest.base.hp ? unit : lowest);
                            if (eventState.targets.length) { handleEvent('targets', { selectedTargets: target, count: 1, trueRand: false }) };
                            heal(this.vars.caster, [target], [(list.filter(u => u.hp > 0).length - 1) * .75]);
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
                new Modifier("Ex-Revolutionary buff", "attack, accuracy, and focus increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { attack: 40, accuracy: 40, focus: 30 }, focus: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function() {}
                );
                new Modifier("Ex-Revolutionary penalty", "Defense, evasion, resist, and presence decrease", { caster: this, target: this, properties: ["physical", "penalty"], stats: { defense: -10, evasion: -15, resist: -30, presence: -40 }, focus: true, penalty: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function() {}
                );
            }
        },
    ]
}