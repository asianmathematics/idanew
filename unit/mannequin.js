import { setUnit, sleep, unitFilter, Modifier, handleEvent, removeModifier, basicModifier, logAction, resetStat, regenerateResources, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, modifiers, currentUnit, currentAction, elements, eventState } from '../combatDictionary.js';
import { FourArcher } from './fourArcher.js';
import { Unit, allUnits } from './unit.js';

export const Mannequin = new Unit("Mannnequin", [800, 45, 22, 140, 130, 150, 70, 145, 50, "mid", 120, 100, 10]);

Mannequin.description = "3-star physical midline unit with high offensive stats and speed but low defense and crit/debuff resist. Has strong attacks with reload mechanics."

Mannequin.skills = {
    special: [
        {
            name: "A Wish To Be An Artificial",
            properties: ["physical", "stamina", "buff", "penalty"],
            cost: { stamina: 20 },
            description: "Cost 20 stamina\nIncreased accuracy/focus/speed and decreased presence & resist for 5 turns.",
            code() {
                basicModifier("A Wish To Be An Artificial buff", "Accuracy, focus, and speed increase", { caster: this, target: this, duration: 6, properties: ["physical", "buff"], stats: { accuracy: 60, focus: 50, speed: 40 }, listeners: { turnEnd: true }, focus: true });
                basicModifier("A Wish To Be An Artificial penalty", "Resist and presence decrease", { caster: this, target: this, duration: 6, properties: ["physical", "penalty"], stats: { resist: -25, presence: -35 }, listeners: { turnEnd: true }, focus: true, penalty: true });
            }
        },
        {
            name: "Emergency Aid",
            properties: ["physical", "stamina", "heal", "positional"],
            cost: { stamina: 50 },
            description: "Costs 50 stamina\nHeals self and all allies (around ~20% max hp) in the same position",
            code() {
                const targets = unitFilter(this.team, this.position);
                heal(this, targets, Array(targets.length).fill(2));
            }
        },
        {
            name: "Ex-Revolutionary",
            properties: ["physical", "stamina", "buff", "penalty"],
            cost: { stamina: 20 },
            description: "Cost 20 stamina\nIncreased attack/accuracy/focus and decreased defense/evasion/resist/presence for 5 turns.",
            code() {
                basicModifier("Ex-Revolutionary buff", "attack, accuracy, and focus increase", { caster: this, target: this, duration: 6, properties: ["physical", "buff"], stats: { attack: 40, accuracy: 40, focus: 30 }, listeners: { turnEnd: true }, focus: true });
                basicModifier("Ex-Revolutionary penalty", "Defense, evasion, resist, and presence decrease", { caster: this, target: this, duration: 6, properties: ["physical", "penalty"], stats: { defense: -10, evasion: -25, resist: -50, presence: -50 }, listeners: { turnEnd: true }, focus: true, penalty: true });
            }
        },
        {
            name: "Dual Wield",
            properties: ["physical", "stamina", "attack"],
            cost: { stamina: 40, position: "front" },
            description: "Cost 40 stamina, Frontline only\nAttacks with increased damage to a single target 8 times or two targets 4 times",
            target() { this.team === "player" ? selectTarget(this.skills.special, [Math.ceil(Math.random() * 2), false, unitFilter("enemy", "front", false)]) : this.skills.special.code.call(this, randTarget(unitFilter("player", "front", false))) },
            code(targets) { attack(this, targets, 8 / targets.length, { attacker: { attack: { bonus: 25 } } }) }
        },
        {
            name: "Snipe",
            properties: ["physical", "stamina", "attack"],
            cost: { stamina: 40, position: "back" },
            description: "Cost 40 stamina, Backline only\nAttacks a single target with increased attack/accuracy/focus, can target backline",
            target() { this.team === "player" ? selectTarget(this.skills.special, [1, true, unitFilter("enemy", "", false)]) : this.skills.special.code.call(this, randTarget(unitFilter("player", "", false))) },
            code(target) { attack(this, target, 1, { attacker: { attack: { bonus: 60 }, accuracy: { bonus: 70 }, focus: { bonus: 80 } } }) }
        },
        {
            name: "Reload",
            properties: ["physical", "stamina", "pseudo-resource"],
            cost: { stamina: 50 },
            description: `Cost 50 stamina\nIngnore reload mechanic for next 6 turns, reloads attacks afterwards`,
            code() {
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
            code() {
                this.skills.basic.code.call(this);
                if (this.position === "back") {
                    this.position = "front";
                    logAction(`${this.name} moves to the frontline.`, "info");
                    this.base.attack = 55;
                    this.base.evasion = 90;
                    this.base.resist = 55;
                    this.base.speed = 165;
                    this.base.presence = 100;
                    if (this.frontSkills) this.skills = {...this.frontSkills}
                } else {
                    this.position = "back";
                    logAction(`${this.name} moves to the backline.`, "info");
                    this.base.attack = 45;
                    this.base.evasion = 130;
                    this.base.resist = 70;
                    this.base.speed = 145;
                    this.base.presence = 50;
                    if (this.backSkills) this.skills = {...this.backSkills}
                }
                resetStat(this, ["attack", "evasion", "resist", "speed", "presence"]);
                if (eventState.positionChange.length) handleEvent('positionChange', { unit: this, position: this.position });
                this.skills.basic.code.call(this);
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
            code() { heal(this, unitByStat(unitFilter(this.team, this.position), 'hp', 'percent', false), [2]) }
        },
        {
            name: "Dual Wield",
            properties: ["physical", "attack", "pseudo-resource"],
            cost: { position: "front" },
            description: "Frontline only\nAttacks with increased damage to a single target 4 times or two targets 2 times",
            code() {
                (this.custom ??= {}).dualWield ??= true;
                if (!(this.custom.dualWield = !this.custom.dualWield)) {
                    const targets = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false), Math.ceil(Math.random() * 2));
                    attack(this, targets, 4 / targets.length, { attacker: { attack: { bonus: 25 } } });
                } else logAction(`${this.name} is reloading weapons!`, "info");
            }
        },
        {
            name: "Snipe",
            properties: ["physical", "attack", "pseudo-resource"],
            cost: { position: "back" },
            description: "Backline only\nAttacks a single target with increased attack/accuracy/focus, can target backline, requires reload to be used again",
            code() {
                (this.custom ??= {}).snipe ??= true;
                if (!(this.custom.snipe = !this.custom.snipe)) attack(this, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "", false)), 1, { attacker: { attack: { bonus: 30 }, accuracy: { bonus: 35 }, focus: { bonus: 40 } } });
                else logAction(`${this.name} is reloading a weapon!`, "info");
            }
        },
        {
            name: "Switch Position",
            properties: ["physical", "positional"],
            description: "Switch between front & backline positions and reduce timer by 10% for next turn",
            code() {
                if (this.position === "back") {
                    this.position = "front";
                    logAction(`${this.name} moves to the frontline.`, "info");
                    this.base.attack = 55;
                    this.base.evasion = 90;
                    this.base.resist = 55;
                    this.base.speed = 165;
                    this.base.presence = 100;
                    if (this.frontSkills) this.skills = {...this.frontSkills}
                } else {
                    this.position = "back";
                    logAction(`${this.name} moves to the backline.`, "info");
                    this.base.attack = 45;
                    this.base.evasion = 130;
                    this.base.resist = 70;
                    this.base.speed = 145;
                    this.base.presence = 50;
                    if (this.backSkills) this.skills = {...this.backSkills}
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
            code() {
                basicModifier("A Wish To Be An Artificial buff", "Accuracy and speed increase", { caster: this, target: this, duration: 2, properties: ["physical", "buff"], stats: { accuracy: 40, speed: 30 }, listeners: { turnEnd: true }, focus: true });
                basicModifier("A Wish To Be An Artificial penalty", "Resist and presence decrease", { caster: this, target: this, duration: 2, properties: ["physical", "penalty"], stats: { resist: -15, presence: -25 }, listeners: { turnEnd: true }, focus: true, penalty: true });
            }
        },
        {
            name: "Emergency Aid",
            properties: ["physical", "heal", "positional"],
            description: "Heals lowest hp ally (around ~10% max hp) in the same position",
            code() { heal(this, unitByStat(unitFilter(this.team, this.position), 'hp', 'percent', false), [1]) }
        },
        {
            name: "Reload",
            properties: ["pseudo-resource"],
            description: `Reloads all attacks`,
            code() {
                this.custom?.dualWield !== undefined && (this.custom.dualWield = true);
                this.custom?.snipe !== undefined && (this.custom.snipe = true);
                logAction(`${this.name} reloads all attacks.`, "action");
            }
        },
        {
            name: "Switch Position",
            properties: ["positional"],
            description: "Switch between front and backline positions",
            code() {
                if (eventState.positionChange.length) handleEvent('positionChange', { unit: this, position: this.position === "back" ? "front" : "back" });
                if (this.position === "back") {
                    this.position = "front";
                    logAction(`${this.name} moves to the frontline.`, "info");
                    this.base.attack = 55;
                    this.base.evasion = 90;
                    this.base.resist = 55;
                    this.base.speed = 165;
                    this.base.presence = 100;
                    if (this.frontSkills) this.skills = {...this.frontSkills}
                } else {
                    this.position = "back";
                    logAction(`${this.name} moves to the backline.`, "info");
                    this.base.attack = 45;
                    this.base.evasion = 130;
                    this.base.resist = 70;
                    this.base.speed = 145;
                    this.base.presence = 50;
                    if (this.backSkills) this.skills = {...this.backSkills}
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
            code() {
                basicModifier("A Wish To Be An Artificial buff", "Accuracy and speed increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { accuracy: 30, speed: 15 }, focus: true, passive: true });
                basicModifier("A Wish To Be An Artificial penalty", "Resist and presence decrease", { caster: this, target: this, properties: ["physical", "penalty"], stats: { resist: -25, presence: -35 }, focus: true, penalty: true, passive: true });
            }
        },
        {
            name: "Emergency Aid",
            properties: ["heal", "positional"],
            description: "Reduce max stamina by 20 and base stamina regen by 2\nHeals lowest hp ally (around ~5% max hp) in the same position times number of alive non-summon allies in same position",
            code() {
                this.stamina = (this.base.stamina -= 20);
                this.base.staminaRegen -= 2;
                resetStat(this, ['staminaRegen']);
                new Modifier("Emergency Aid", `Heals lowest hp ally (around ~5% max hp) in the same position times number of alive non-summon allies in same position`,
                    { caster: this, target: this, properties: ["physical", "stamina", "heal", "positional"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], focus: true, passive: true },
                    function() {},
                    function(context) { if (this.vars.applied && context.unit === this.vars.target) heal(this.vars.caster, unitByStat(unitFilter(this.vars.target.team, this.vars.target.position), 'hp', 'percent', false), [(unitFilter(this.vars.target.team, this.vars.target.position).filter(u => u.hp > 0 && !u.custom?.summoner).length - 1)/2]) }
                );
            }
        },
        {
            name: "Ex-Revolutionary",
            properties: ["physical", "buff", "penalty"],
            description: "Increased attack/accuracy/focus and decreased defense/evasion/resist/presence.",
            code() {
                basicModifier("Ex-Revolutionary buff", "attack, accuracy, and focus increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { attack: 20, accuracy: 20, focus: 15 }, focus: true, passive: true } );
                basicModifier("Ex-Revolutionary penalty", "Defense, evasion, resist, and presence decrease", { caster: this, target: this, properties: ["physical", "penalty"], stats: { defense: -20, evasion: -25, resist: -50, presence: -50 }, focus: true, penalty: true, passive: true });
            }
        },
        {
            name: "Reload",
            properties: ["physical", "stamina", "pseudo-resource"],
            cost: { stamina: 20 },
            description: `Cost 20 stamina\nSpends stamina to instantly reload attacks, doesn't reload if stamina is too low`,
            code() {
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
            code() {
                basicModifier("A Wish To Be An Artificial buff", "Accuracy and speed increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { accuracy: 40, speed: 30 }, focus: true, passive: true });
                basicModifier("A Wish To Be An Artificial penalty", "Resist and presence decrease", { caster: this, target: this, properties: ["physical", "penalty"], stats: { resist: -15, presence: -25 }, focus: true, penalty: true, passive: true });
            }
        },
        {
            name: "Emergency Aid",
            properties: ["heal", "positional"],
            description: "Reduce max stamina by 20\nHeals lowest hp ally (around ~7.5% max hp) in the same position times number of alive non-summon allies in same position",
            code() {
                this.stamina = (this.base.stamina -= 20);
                new Modifier("Emergency Aid", `Heals lowest hp ally (around ~7.5% max hp) in the same position times number of alive non-summon allies in same position`,
                    { caster: this, target: this, properties: ["physical", "stamina", "heal"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], focus: true, passive: true },
                    function() {},
                    function(context) { if (this.vars.applied && context.unit === this.vars.target) heal(this.vars.caster, unitByStat(unitFilter(this.vars.target.team, this.vars.target.position), 'hp', 'percent', false), [(unitFilter(this.vars.target.team, this.vars.target.position).filter(u => u.hp > 0 && !u.custom?.summoner).length - 1) * .75]) }
                );
            }
        },
        {
            name: "Ex-Revolutionary",
            properties: ["physical", "buff", "penalty"],
            description: "Increased attack/accuracy/focus and decreased defense/evasion/resist/presence.",
            code() {
                basicModifier("Ex-Revolutionary buff", "attack, accuracy, and focus increase", { caster: this, target: this, properties: ["physical", "buff"], stats: { attack: 40, accuracy: 40, focus: 30 }, focus: true, passive: true });
                basicModifier("Ex-Revolutionary penalty", "Defense, evasion, resist, and presence decrease", { caster: this, target: this, properties: ["physical", "penalty"], stats: { defense: -10, evasion: -15, resist: -30, presence: -40 }, focus: true, penalty: true, passive: true });
            }
        },
    ]
}

Mannequin.frontDefaultSkills = [
    { category: 'special', name: 'Switch Position' },
    { category: 'basic', name: 'Dual Wield' },
    { category: 'secondary', name: 'Emergency Aid' },
    { category: 'passive', name: 'Reload' },
    { category: 'augment', name: 'A Wish To Be An Artificial' }
];

Mannequin.backDefaultSkills = [
    { category: 'special', name: 'Switch Position' },
    { category: 'basic', name: 'Snipe' },
    { category: 'secondary', name: 'Emergency Aid' },
    { category: 'passive', name: 'Reload' },
    { category: 'augment', name: 'A Wish To Be An Artificial' }
];