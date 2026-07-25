import { sleep, unitFilter, Modifier, handleEvent, removeModifier, basicModifier, logAction, resetStat, regenerateResources, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, modifiers, currentUnit, currentAction, elements, eventState } from '../combatDictionary.js';
import { Unit, allUnits } from './unit.js';

export const reject = new Unit("Reject", [660, 30, 28, 60, 40, 60, 80, 40, 70, "front", 66, 60, 8]);

reject.skills = {
    special: [
        {
            name: "Bite",
            properties: ["physical", "stamina", "attack"],
            cost: { stamina: 25 },
            description: "Attacks a single target with increased attack, accuracy, and focus",
            target() {  this.team === "player" ? selectTarget(this.skills.special, [1, true, unitFilter("enemy", "front", false)]) : this.skills.special.code.call(this, randTarget(unitFilter("player", "front", false))) },
            code(target) { attack(this, target, 1, { attacker: { attack: { bonus: 40 }, accuracy: { bonus: 120 }, focus: { bonus: 120 } } }) }
        },
        {
            name: "Regeneration",
            properties: ["physical", "stamina", "heal"],
            cost: { stamina: 25 },
            description: "Heals a lot (20% max hp)",
            code() { heal(this, [this], [2]) }
        },
        {
            name: "Rejected by All",
            properties: ["physical", "stamina", "buff", "penalty"],
            cost: { stamina: 20 },
            description: "Increases defensive stats, decreases offensive stats and presence",
            code() {
                logAction(`${this.name} doesn't let the past take control!`, "buff");
                basicModifier("Ex-Revolutionary buff", "Attack, accuracy, and focus increase", { caster: this, target: this, duration: 6, properties: ["physical", "buff"], stats: { attack: 40, accuracy: 40, focus: 30 }, listeners: { turnEnd: true }, focus: true });
                basicModifier("Ex-Revolutionary penalty", "Defense, evasion, resist, and presence decrease", { caster: this, target: this, duration: 6, properties: ["physical", "penalty"], stats: { defense: -10, evasion: -25, resist: -50, presence: -50 }, listeners: { turnEnd: true }, focus: true, penalty: true });
            }
        }
    ]
}