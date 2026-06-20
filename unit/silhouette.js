import { attack, basicModifier, eventState, logAction, Modifier, randTarget, resistDebuff, unitFilter } from '../combatDictionary.js';
import { Unit } from './unit.js';

export const Silhouette = new Unit("Silhouette", [650, 24, 25, 110, 160, 135, 140, 75, 50, "mid", 60, 80, 6, 100, 8]);

const skills = {
    special: [
        {
            name: "Shadow Blade",
            properties: ["physical", "stamina", "mystic", "mana", "attack"],
            cost: { stamina: 10, mana: 20, position: "front" },
            description: "Cost 10 stamina & 20 mana, frontline only\nMakes 4 attacks at a single target with increased accuracy and damage",
            target: () => this.stamina < 10 || this.mana < 20 ? showMessage("Not enough resources!", "error", "selection") : this.team === "player" ? selectTarget(this.actions.special, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) : this.actions.special.code(randTarget(unitFilter("player", "front", false))),
            code: (target) => {
                [this.previousAction[0], this.previousAction[1]] = [true, true];
                this.stamina -= 10;
                this.mana -= 20;
                logAction(`${this.name} strike at the heart of ${target[0].name}!`, "action");
                attack(this, target, 4, { attacker: { damage: this.damage + 18, accuracy: this.accuracy + 50 } })
            }
        },
        {
            name: "Fear of the Dark",
            properties: ["physical", "stamina", "mystic", "mana", "buff", "debuff", "positional"],
            cost: { stamina: 15, mana: 25 },
            description: "Cost 15 stamina & 25 mana\nIncreases evasion/focus/presence, gives advantage to attacks at frontline, decreases enemy accuracy or focus of attacks/debuff to self at the backline, lasts 4 turns, 1% chance to fail to give advantage or decrease stats",
            code: () => {
                if (this.stamina < 15 || this.mana < 25) return showMessage("Not enough resources!", "error", "selection");
                [this.previousAction[0], this.previousAction[1]] = [true, true];
                this.stamina -= 15;
                this.mana -= 25;
                basicModifier("Fear of the Dark buff", "Increases evasion/focus/presence", { caster: this, target: this, duration: 5, properties: ["physical", "stamina", "mystic", "mana", "buff"], stats: { evasion: 40, focus: 20, presence: 40 }, listeners: { turnEnd: true }, cancel: false, applied: true, focus: true });
                new Modifier("Fear of the Dark", "Gives advantage to attacks at frontline, decreases enemy accuracy or focus of attacks/debuff to self at the backline, 1% chance to fail",
                    { caster: this, target: this, duration: 5, properties: ["physical", "stamina", "mystic", "mana", "buff", "debuff"], listeners: { turnEnd: true, attackStart: true, resistStart: true }, cancel: false, applied: true, focus: true },
                    function() { this.vars.resistStart = this.vars.caster.position === "back" },
                    function(context) {
                        if (this.vars.caster.position === "back" && context.defenders.includes(this.vars.caster) && resistDebuff(this.vars.caster, context.attacker)[0] >= 2) {
                            context.event === "attackStart"; //seperate attacker stats for each attack
                        } else if (context.attacker === this.vars.caster) for (const defender in context.defender) if (resistDebuff(this.vars.caster, context.defender)[0] >= 2) context.calcMods.all ? context.calcMods.all.reroll = (context.calcMods.all.reroll || 0) + 1 : context.calcMods.all = { reroll: 1 };
                    }
                )
            }
        }
    ],
    basic: [
        {
            name: "Shadow Blade",
            properties: ["physical", "mystic", "attack"],
            cost: { position: "front" },
            description: "Frontline only\nMakes 2 attacks at a single target with increased accuracy and damage",
            code: () => {
                [this.previousAction[0], this.previousAction[1]] = [true, true];
                const target = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false));
                logAction(`${this.name} strikes ${target[0].name}!`, "action");
                attack(this, target, 2, { attacker: { damage: this.damage + 18, accuracy: this.accuracy + 50 } })
            }
        }
    ],
    secondary: [
        {
            name: "Shadow Blade",
            properties: ["attack"],
            cost: { position: "front" },
            description: "Frontline only\nAttacks a single target with increased accuracy and damage",
            code: () => {
                const target = randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false));
                logAction(`${this.name} strikes ${target[0].name}!`, "action");
                attack(this, target, 1, { attacker: { damage: this.damage + 18, accuracy: this.accuracy + 50 } })
            }
        }
    ],
    passive: [],
    augment: []
}