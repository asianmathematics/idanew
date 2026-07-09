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
            cost: { stamina: -20 },
            description: "Cost 20 stamina\nIncreased accuracy/focus/speed and decreased presence & resist for 5 turns.",
            code() {
                logAction(`${this.name} reaches for an ideal!`, "buff");
                basicModifier("A Wish To Be An Artificial buff", "Accuracy, focus, and speed increase", { caster: this, target: this, duration: 6, properties: ["physical", "buff"], stats: { accuracy: 60, focus: 50, speed: 40 }, listeners: { turnEnd: true }, focus: true });
                basicModifier("A Wish To Be An Artificial penalty", "Resist and presence decrease", { caster: this, target: this, duration: 6, properties: ["physical", "penalty"], stats: { resist: -25, presence: -35 }, listeners: { turnEnd: true }, focus: true, penalty: true });
            }
        },
        {
            name: "Emergency Aid",
            properties: ["physical", "stamina", "heal", "positional"],
            cost: { stamina: -50 },
            description: "Costs 50 stamina\nHeals self and all allies (around ~20% max hp) in the same position",
            code() {
                const targets = unitFilter(this.team, this.position);
                if (eventState.targets.length) handleEvent('targets', { selectedTargets: targets, count: targets.length });
                heal(this, targets, Array(targets.length).fill(2));
            }
        },
        {
            name: "Ex-Revolutionary",
            properties: ["physical", "stamina", "buff", "penalty"],
            cost: { stamina: -20 },
            description: "Cost 20 stamina\nIncreased attack/accuracy/focus and decreased defense/evasion/resist/presence for 5 turns.",
            code() {
                logAction(`${this.name} doesn't let the past take control!`, "buff");
                basicModifier("Ex-Revolutionary buff", "Attack, accuracy, and focus increase", { caster: this, target: this, duration: 6, properties: ["physical", "buff"], stats: { attack: 40, accuracy: 40, focus: 30 }, listeners: { turnEnd: true }, focus: true });
                basicModifier("Ex-Revolutionary penalty", "Defense, evasion, resist, and presence decrease", { caster: this, target: this, duration: 6, properties: ["physical", "penalty"], stats: { defense: -10, evasion: -25, resist: -50, presence: -50 }, listeners: { turnEnd: true }, focus: true, penalty: true });
            }
        },
        {
            name: "Dual Wield",
            properties: ["physical", "stamina", "attack", "multi-target", "pseudo-resource"],
            cost: { stamina: -40, position: "front" },
            description: "Cost 40 stamina, Frontline only\nAttacks with increased damage to a single target 8 times or two targets 4 times, adds two attacks if reloaded",
            target() { this.team === "player" ? selectTarget(this.skills.special, [2, false, unitFilter("enemy", "front", false)]) : this.skills.special.code.call(this, randTarget(unitFilter("player", "front", false), Math.ceil(Math.random() * 2))) },
            code(targets) { attack(this, targets, (this.custom?.dualWield ? this.custom.dualWield-- && 10 : 8) / targets.length, { attacker: { attack: { bonus: 25 } } }) }
        },
        {
            name: "Snipe",
            properties: ["physical", "stamina", "attack", "pseudo-resource"],
            cost: { stamina: -40, position: "back" },
            description: "Cost 40 stamina, Backline only\nAttacks a single target with increased attack/accuracy/focus, can target backline, adds extra damage if reloaded",
            target() { this.team === "player" ? selectTarget(this.skills.special, [1, true, unitFilter("enemy", "", false)]) : this.skills.special.code.call(this, randTarget(unitFilter("player", "", false))) },
            code(target) { attack(this, target, 1, { attacker: { attack: { bonus: this.custom?.snipe ? this.custom.snipe-- && 90 : 60  }, accuracy: { bonus: 70 }, focus: { bonus: 80 } } }) }
        },
        {
            name: "Focus Fire",
            properties: ["physical", "attack", "pseudo-resource"],
            description: "Attacks a single target 4 times with increased attack/accuracy/focus, adds two attacks and damage if reloaded",
            target() { this.team === "player" ? selectTarget(this.skills.special, [1, true, unitFilter("enemy", "", false)]) : this.skills.special.code.call(this, randTarget(unitFilter("player", "", false))) },
            code(target) {
                const bonus = this.custom?.focusFire ? !!this.custom.focusFire-- : 0;
                attack(this, target, 4 + 2*bonus, { attacker: { attack: { bonus: 50*(1 + bonus) }, accuracy: { bonus: 35 }, focus: { bonus: 40 } } })
            }
        },
        {
            name: "Reload",
            properties: ["physical", "stamina", "pseudo-resource"],
            cost: { stamina: -50 },
            description: `Cost 50 stamina\nIngnore reload mechanic for next 6 turns, reloads attacks afterwards`,
            code() {
                logAction(`${this.name}'s weapons turn automatic!`, "buff");
                new Modifier("Reload", `Ignores reload mechanic`,
                    { caster: this, target: this, duration: 6, properties: ["physical", "pseudo-resource"], listeners: { turnStart: true }, focus: true},
                    function() {
                        this.custom?.dualWield !== undefined && (this.custom.dualWield = 1);
                        this.custom?.snipe !== undefined && (this.custom.snipe = 1);
                        this.custom?.focusFire !== undefined && (this.custom.focusFire = 1);
                        logAction(`${this.vars.target.name} reloads all weapons!`, "buff");
                    },
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            this.custom?.dualWield !== undefined && (this.custom.dualWield = 1);
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
            name: "Switch Position",
            properties: ["physical", "stamina", "positional"],
            cost: { stamina: -10 },
            description: "Switch between front and backline positions and immediately gain next turn",
            code() {
                this.switchPosition()
                this.timer -= 1000;
            }
        }
    ],
    basic: [
        {
            name: "A Wish To Be An Artificial",
            properties: ["physical", "buff", "penalty"],
            description: "Increased accuracy & speed and decreased presence & resist for 2 turns. If currently active, refreshes duration and allow stamina regen next turn",
            code() {
                logAction(`${this.name} acts on a wish!`, "buff");;
                let mod = modifiers.find(m => m.name.includes("A Wish To Be An Artificial") && m.vars.caster === this);
                if (mod) {
                    this.previousAction[0] = false;
                    mod.vars.duration = 3;
                    mod = modifiers.find(m => m !== mod && m.name.includes("A Wish To Be An Artificial") && m.vars.caster === this)
                    if (mod) mod.vars.duration = 3;
                } else {
                    basicModifier("A Wish To Be An Artificial buff", "Accuracy and speed increase", { caster: this, target: this, duration: 3, properties: ["physical", "buff"], stats: { accuracy: 40, speed: 30 }, listeners: { turnEnd: true }, focus: true });
                    basicModifier("A Wish To Be An Artificial penalty", "Resist and presence decrease", { caster: this, target: this, duration: 3, properties: ["physical", "penalty"], stats: { resist: -15, presence: -25 }, listeners: { turnEnd: true }, focus: true, penalty: true });
                }
            }
        },
        {
            name: "Emergency Aid",
            properties: ["physical", "stamina", "heal", "positional"],
            cost: { stamina: -20 },
            description: "Costs 20 stamina\nHeals lowest hp ally (around ~20% max hp) in the same position",
            code() { heal(this, unitByStat(unitFilter(this.team, this.position), 'hp', 'percent', false), [2]) }
        },
        {
            name: "Ex-Revolutionary",
            properties: ["physical", "stamina", "buff", "penalty"],
            cost: { stamina: -20 },
            description: "Cost 20 stamina\nIncreased attack & accuracy and decreased evasion/resist/presence for 2 turns. If currently active, refreshes duration and allow stamina regen next turn",
            code() {
                logAction(`${this.name} reminiscences on the past.`, "buff");
                let mod = modifiers.find(m => m.name.includes("Ex-Revolutionary") && m.vars.caster === this);
                if (mod) {
                    this.previousAction[0] = false;
                    mod.vars.duration = 3;
                    mod = modifiers.find(m => m !== mod && m.name.includes("A Wish To Be An Artificial") && m.vars.caster === this)
                    if (mod) mod.vars.duration = 3;
                } else {
                    basicModifier("Ex-Revolutionary buff", "Attack and accuracy increase", { caster: this, target: this, duration: 3, properties: ["physical", "buff"], stats: { attack: 40, accuracy: 40 }, listeners: { turnEnd: true }, focus: true });
                    basicModifier("Ex-Revolutionary penalty", "Evasion, resist, and presence decrease", { caster: this, target: this, duration: 3, properties: ["physical", "penalty"], stats: { evasion: -25, resist: -50, presence: -50 }, listeners: { turnEnd: true }, focus: true, penalty: true });
                }
            }
        },
        {
            name: "Dual Wield",
            properties: ["physical", "attack", "multi-target", "pseudo-resource"],
            cost: { position: "front" },
            description: "Frontline only\nAttacks with increased damage to a single target 4 times or two targets 2 times, requires reload to be used again",
            code() {
                (this.custom ??= {}).dualWield ??= 1;
                if (this.custom.dualWield--) {
                    const targets = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false), Math.ceil(Math.random() * 2));
                    attack(this, targets, 4 / targets.length, { attacker: { attack: { bonus: 25 } } });
                } else this.previousAction[this.custom.dualWield++] = !!logAction(`${this.name} is reloading weapons!`, "info");
            }
        },
        {
            name: "Snipe",
            properties: ["physical", "attack", "pseudo-resource"],
            cost: { position: "back" },
            description: "Backline only\nAttacks a single target with increased attack/accuracy/focus, can target backline, requires reload to be used again",
            code() {
                (this.custom ??= {}).snipe ??= 1;
                if (this.custom.snipe--) attack(this, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "", false)), 1, { attacker: { attack: { bonus: 30 }, accuracy: { bonus: 35 }, focus: { bonus: 40 } } });
                else this.previousAction[this.custom.snipe++] = !!logAction(`${this.name} is reloading a weapon!`, "info");
            }
        },
        {
            name: "Focus Fire",
            properties: ["physical", "attack", "pseudo-resource"],
            description: "Attacks a single target 2 times with increased attack/accuracy/focus, adds an extra attack and damage if reloaded",
            code() {
                const bonus = this.custom?.focusFire ? !!this.custom.focusFire-- : 0;
                attack(this, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "", false)), 2 + bonus, { attacker: { attack: { bonus: 25*(1 + bonus) }, accuracy: { bonus: 15 }, focus: { bonus: 20 } } })
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
            name: "A Wish To Be An Artificial",
            properties: ["buff", "penalty"],
            description: "Increased accuracy & speed and decreased presence & resist.",
            code() {
                logAction(`${this.name} wishes for the impossible.`, "buff");
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
            name: "Ex-Revolutionary",
            properties: ["physical", "stamina", "buff", "penalty"],
            cost: { stamina: -20 },
            description: "Cost 20 stamina\nIncreased attack &accuracy and decreased evasion/resist/presence for 1 turn.",
            code() {
                logAction(`${this.name} is lost in memories.`, "buff");
                basicModifier("Ex-Revolutionary buff", "Attack and accuracy increase", { caster: this, target: this, duration: 2, properties: ["physical", "buff"], stats: { attack: 40, accuracy: 20 }, listeners: { turnEnd: true }, focus: true });
                basicModifier("Ex-Revolutionary penalty", "Evasion, resist, and presence decrease", { caster: this, target: this, duration: 2, properties: ["physical", "penalty"], stats: { evasion: -10, resist: -50, presence: -50 }, listeners: { turnEnd: true }, focus: true, penalty: true });
            }
        },
        {
            name: "Reload",
            properties: ["pseudo-resource"],
            description: `Reloads all attacks`,
            code() {
                this.custom?.dualWield !== undefined && (this.custom.dualWield = 2);
                this.custom?.snipe !== undefined && (this.custom.snipe = 2);
                this.custom?.focusFire !== undefined && (this.custom.focusFire = 2);
                logAction(`${this.name} reloads all attacks.`, "action");
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
                new Modifier("Emergency Aid", `Heals lowest hp ally (around ~5% max hp) in the same position times number of alive non-summon allies in same position`,
                    { caster: this, target: this, properties: ["physical", "stamina", "heal", "positional"], listeners: { turnStart: true, positionChange: true }, cancelListeners: ['turnStart'], position: this.position, focus: true, passive: true },
                    function() {
                        this.vars.caster.stamina = Math.max(this.vars.caster.base.stamina -= 20, 0);
                        this.vars.caster.base.staminaRegen -= 2;
                        resetStat(this.vars.caster, ['staminaRegen']);
                    },
                    function(context) {
                        if (context.unit !== this.vars.caster) return;
                        if (context.event === 'positionChange') {
                            this.vars.caster.stamina = Math.max(this.vars.caster.base.stamina += 20, 0);
                            this.vars.caster.base.staminaRegen += 2;
                            resetStat(this.vars.caster, ['staminaRegen']);
                            return this.vars.passive--;
                        }
                        if (this.vars.applied) heal(this.vars.caster, unitByStat(unitFilter(this.vars.target.team, this.vars.target.position), 'hp', 'percent', false), [(unitFilter(this.vars.target.team, this.vars.target.position).filter(u => u.hp > 0 && !u.custom?.summoner).length - 1)/2]);
                    }
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
            cost: { stamina: -10 },
            description: `Cost 10 stamina\nSpends stamina to instantly reload attacks, doesn't reload if stamina is too low`,
            code() {
                new Modifier("Reload", `Ignores reload mechanic`,
                    { caster: this, target: this, properties: ["physical", "stamina", "pseudo-resource"], listeners: { turnEnd: true }, cancelListeners: ['turnEnd'], cost: { stamina: -10 }, focus: true, passive: true},
                    function() { this.vars.caster.custom = { dualWield: 1, snipe: 1, focusFire: 1 } },
                    function(context) {
                        if (context.unit === this.vars.caster && this.vars.applied) {
                            if (!this.vars.caster.custom.dualWield) this.vars.caster.custom.dualWield = resourceChange(this.vars.caster, this.vars.cost);
                            if (!this.vars.caster.custom.snipe) this.vars.caster.custom.snipe = resourceChange(this.vars.caster, this.vars.cost);
                            if (!this.vars.caster.custom.focusFire) this.vars.caster.custom.focusFire = resourceChange(this.vars.caster, this.vars.cost);
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
            description: "Reduce max stamina by 20 and base stamina regen by 2\nHeals lowest hp ally (around ~7.5% max hp) in the same position times number of alive non-summon allies in same position",
            code() {
                new Modifier("Emergency Aid", `Heals lowest hp ally (around ~7.5% max hp) in the same position times number of alive non-summon allies in same position`,
                    { caster: this, target: this, properties: ["physical", "stamina", "heal"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], focus: true, passive: true },
                    function() {
                        this.vars.caster.stamina = Math.max(this.vars.caster.base.stamina -= 20, 0);
                        this.vars.caster.base.staminaRegen -= 2;
                        resetStat(this.vars.caster, ['staminaRegen']);
                    },
                    function(context) {
                        if (context.unit !== this.vars.caster) return;
                        if (context.event === 'positionChange') {
                            this.vars.caster.stamina = Math.max(this.vars.caster.base.stamina += 20, 0);
                            this.vars.caster.base.staminaRegen += 2;
                            resetStat(this.vars.caster, ['staminaRegen']);
                            return this.vars.passive--;
                        }
                        if (this.vars.applied) heal(this.vars.caster, unitByStat(unitFilter(this.vars.target.team, this.vars.target.position), 'hp', 'percent', false), [(unitFilter(this.vars.target.team, this.vars.target.position).filter(u => u.hp > 0 && !u.custom?.summoner).length - 1) * .75]);
                    }
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

Mannequin.switchPosition = function() {
    if (this.position === "back") {
        this.position = "front";
        this.base.attack = 55;
        this.base.evasion = 90;
        this.base.resist = 55;
        this.base.speed = 165;
        this.base.presence = 100;
        this.skills = {...this.frontSkills}
    } else {
        this.position = "back";
        this.base.attack = 45;
        this.base.evasion = 130;
        this.base.resist = 70;
        this.base.speed = 145;
        this.base.presence = 50;
        this.skills = {...this.backSkills}
    }
        logAction(`${this.name} moves to the ${this.position}line.`, "info");
    resetStat(this, ["attack", "evasion", "resist", "speed", "presence"]);
    if (eventState.positionChange.length) handleEvent('positionChange', { unit: this, position: this.position });
    this.skills.passive?.code?.call(this);
    this.skills.augment?.code?.call(this);
}