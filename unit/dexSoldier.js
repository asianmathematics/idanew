import { sleep, unitFilter, Modifier, handleEvent, removeModifier, basicModifier, logAction, resetStat, regenerateResources, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, modifiers, currentUnit, currentAction, elements, eventState } from '../combatDictionary.js';
import { Unit, allUnits } from './unit.js';

export const DexSoldier = new Unit("DeX (Soldier)", [1800, 25, 55, 70, 50, 60, 80, 55, 200, "front", 250, 150, 27]);

DexSoldier.description = "3-star physical frontline unit with high defensive stats but low speed, has strong sustain and defensive capabilities.";

DexSoldier.skills = {
    special: [
        {
            name: "Hammer, Hammer, Hammer!",
            properties: ["physical", "stamina", "attack"],
            cost: { stamina: 30 },
            description: "Attacks a single target with increased attack, accuracy, and focus",
            target() {  this.team === "player" ? selectTarget(this.skills.special, [1, true, unitFilter("enemy", "front", false)]) : this.skills.special.code.call(this, randTarget(unitFilter("player", "front", false))) },
            code(target) { attack(this, target, 1, { attacker: { attack: { mult: 3 }, accuracy: { mult: 2.5 }, focus: { mult: 2 } } }) }
        },
        {
            name: "Determination",
            properties: ["physical", "stamina", "heal"],
            cost: { stamina: 40 },
            description: `Immediately heals a lot (~20% max HP) and moderately heals (~10% max HP) at start of turn for next 5 turns`,
            code() {
                new Modifier("Determination", `Moderately heals at start of turn`,
                    { caster: this, target: this, duration: 5, properties: ["physical", "stamina", "heal"], listeners: { turnStart: true }, focus: true },
                    function() { heal(this.vars.caster, [this.vars.target], [2]) },
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            if (this.vars.applied) heal(this.vars.caster, [this.vars.target], [1]);
                            this.vars.duration--;
                        }
                        return this.vars.duration <= 0;
                    },
                );
            }
        },
        {
            name: "But It Refused",
            properties: ["physical", "stamina", "revive"],
            cost: { stamina: 70 },
            description: `Revives once per turn for the next 5 turns`,
            code() {
                logAction(`${this.name} refuses to die!`, "buff");
                new Modifier("But It Refused", `Revives once per turn`,
                    { caster: this, target: this, duration: 5, properties: ["physical", "revive"], listeners: { turnStart: true, unitChange: true }, cancelListeners: ['unitChange'], uses: 1 },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.target && context.type === "downed") {
                            heal(this.vars.caster, [this.vars.target], [3]);
                            this.vars.uses--;
                            this.cancel(true);
                        }
                        if (context.event === "turnStart" && context.unit === this.vars.caster) {
                            this.vars.duration--;
                            if (!this.vars.uses) {
                                this.vars.uses++;
                                this.cancel(false);
                            }
                        }
                        return this.vars.duration <= 0;
                    }
                );
            }
        },
        {
            name: "Guardian",
            properties: ["physical", "stamina", "redirect"],
            cost: { stamina: 50 },
            description: "Redirects all non-aoe attacks on the frontline to self with increased defense for 1 turn",
            code() {
                logAction(`${this.name} protects the frontline!`, "buff")
                new Modifier("Guardian", "Redirects attacks and increases defense",
                    { caster: this, target: this, duration: 1, properties: ["physical"], stats: { defense: 40 }, listeners: { attackStart: true, turnStart: true }, cancelListeners: ['attackStart'], focus: true },
                    function() { resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats)) },
                    function(context) {
                        if (context.event === "attackStart" && context.attacker.team !== this.vars.target.team && !currentAction.at(-2)?.properties?.includes("aoe") && !currentAction.at(-2)?.vars?.properties?.includes("aoe")) {
                            let redirect = 0;
                            for (let i = 0; i < context.defenders.length; i++) {
                                const target = context.defenders[i];
                                if (target === this.vars.target || target.team !== this.vars.target.team || target.position !== "front" || !context.calcMods.defenders?.[i]?.redirect) continue;
                                redirect++;
                                context.defenders[i] = this.vars.target;
                                ((context.calcMods.defenders ??= [])[i] ??= {}).redirect = [target, this.vars.target];
                            }
                            if (redirect > 0) logAction(`${this.vars.target.name} redirects ${redirect} attack${redirect > 1 ? 's' : ''} to self!`, "crit");
                        }
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    }
                );
            }
        },
        {
            name: "Last Stand",
            properties: ["physical", "stamina", "buff"],
            cost: { stamina: 30 },
            description: "Increases defense, resist, and presence for 5 turns",
            code() {
                logAction(`${this.name} makes a final stand!`, "buff");
                basicModifier("Last Stand", "Defense, resist, and presence increase", { caster: this, target: this, duration: 5, properties: ["physical", "buff"], stats: { defense: 35, resist: 60, presence: 150 }, listeners: { turnStart: true }, focus: true });
            }
        },
        {
            name: "Quake Hammer",
            properties: ["physical", "stamina", "attack", "aoe", "multi-target"],
            cost: { stamina: 50 },
            description: "Makes two AOE attacks on enemy frontline",
            code() {
                let targets = unitFilter(this.team === 'player' ? 'enemy' : 'player', 'front', false);
                if (eventState.targets.length) handleEvent('targets', { selectedTargets: targets, count: targets.length });
                attack(this, targets, 2)
            }
        }
    ],
    basic: [
        {
            name: "Hammer, Hammer, Hammer!",
            properties: ["physical", "attack"],
            description: "Attacks a single target with increased attack, accuracy, and focus",
            code() { attack(this, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false)), 1, { attacker: { attack: { mult: 3 }, accuracy: { mult: 2 } } }) }
        },
        {
            name: "Determination",
            properties: ["physical","heal"],
            description: `Moderately heals (~10% max HP) at start of turn for next 3 turns`,
            code() {
                logAction(`${this.name} holds onto hope.`, "buff")
                new Modifier("Determination", `Moderately heals at start of turn`,
                    { caster: this, target: this, duration: 3, properties: ["physical", "heal"], listeners: { turnStart: true }, focus: true },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            if (this.vars.applied) heal(this.vars.caster, [this.vars.target], [1]);
                            this.vars.duration--;
                        }
                        return this.vars.duration <= 0;
                    }
                );
            }
        },
        {
            name: "Guardian",
            properties: ["physical", "stamina", "redirect"],
            cost: { stamina: 20 },
            description: "Redirects all non-aoe attacks on lowest hp frontline unit to self for 1 turn",
            code() {
                const target = unitByStat(unitFilter(this.team, this.position), 'hp', 'percent', false)[0];
                logAction(`${this.name} protects ${target.name}`, "buff")
                new Modifier("Guardian", "Redirects attacks from an ally and increases defense",
                    { caster: this, target, duration: 1, properties: ["physical"], listeners: { attackStart: true, turnStart: true }, cancelListeners: ['attackStart'], focus: true },
                    function() {},
                    function(context) {
                        if (context.event === "attackStart" && context.attacker.team !== this.vars.caster.team && !currentAction.at(-2)?.properties?.includes("aoe") && !currentAction.at(-2)?.vars?.properties?.includes("aoe")) {
                            let redirect = 0;
                            for (const target of context.defenders) {
                                const index = context.defenders.indexOf(target);
                                if (target !== this.vars.target) continue;
                                context.defenders.splice(index, 1, this.vars.caster);
                                ((context.calcMods.defenders ??= [])[index] ??= {}).redirect = [target, this.vars.caster];
                                redirect++;
                            }
                            if (redirect > 0) logAction(`${this.vars.caster.name} redirects ${redirect} attack${redirect > 1 ? 's' : ''} to self!`, "crit");
                        }
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    }
                );
            }
        },
        {
            name: "Last Stand",
            properties: ["physical", "buff"],
            description: "Increases defense/resist/presence for 2 turns. If currently active, refreshes duration and allow stamina regen next turn",
            code() {
                logAction(`${this.name} makes a stand.`, "buff");
                const mod = modifiers.find(m => m.name === "Last Stand" && m.vars.caster === this)
                if (mod) mod.vars.duration = 2, this.previousAction[0] = false;
                else basicModifier("Last Stand", "Defense, resist, and presence increase", { caster: this, target: this, duration: 2, properties: ["physical", "buff"], stats: { defense: 25, resist: 30, presence: 100 }, listeners: {turnStart: true}, focus: true });
            }
        },
        {
            name: "Quake Hammer",
            properties: ["physical", "stamina", "attack", "aoe", "multi-target"],
            cost: { stamina: 20 },
            description: "Makes an AOE attack on enemy frontline reduced attack and focus",
            code() {
                let targets = unitFilter(this.team === 'player' ? 'enemy' : 'player', 'front', false);
                if (eventState.targets.length) handleEvent('targets', { selectedTargets: targets, count: targets.length });
                attack(this, targets, 1, { attacker: { attack: { bonus: -10 }, focus: { bonus: -20 } } })
            }
        }
    ],
    secondary: [
        {
            name: "Hammer, Hammer, Hammer!",
            properties: ["attack"],
            description: "Attacks a single target with increased attack, accuracy, and focus",
            code() { attack(this, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false)), 1, { attacker: { attack: { mult: 3 } } }) }
        },
        {
            name: "Determination",
            properties: ["heal"],
            description: `Moderately heals (~10% max HP) at start of next turn`,
            code() {
                logAction(`${this.name} hopes a little longer.`, 'buff')
                new Modifier("Determination", `Moderately heals at start of next turn`,
                    { caster: this, target: this, duration: 1, properties: ["physical", "heal"], listeners: { turnStart: true }, focus: true },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            if (this.vars.applied) heal(this.vars.caster, [this.vars.target], [1]);
                            this.vars.duration--;
                        }
                        return this.vars.duration <= 0
                    },
                );
            }
        },
        {
            name: "Last Stand",
            properties: ["buff"],
            description: "Increases defense and presence for 1 turn",
            code() {
                logAction(`${this.name} stands there.`, "buff")
                basicModifier("Last Stand", "Defense and presence increase", { caster: this, target: this, duration: 1, properties: ["physical", "buff"], stats: { defense: 15, presence: 50 }, listeners: {turnStart: true}, focus: true });
            }
        }
    ],
    passive: [
        {
            name: "Determination",
            properties: ["physical", "stamina", "heal"],
            description: `Heals (~5% max HP) at start of turn whenever stamina is at least half`,
            code() {
                new Modifier("Determination", `Heals at start of turn whenever stamina is at least half`,
                    { caster: this, target: this, properties: ["physical", "stamina", "heal"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], focus: true, passive: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.target && 2 * this.vars.target.stamina >= this.vars.target.base.stamina) heal(this.vars.caster, [this.vars.target], [.5]) }
                );
            }
        },
        {
            name: "But It Refused",
            properties: ["physical", "stamina", "revive"],
            cost: { stamina: 50 },
            description: `Spends stamina to revive`,
            code() {
                new Modifier("But It Refused", `Revives`,
                    { caster: this, target: this, properties: ["physical", "stamina", "revive"], listeners: { unitChange: true }, cancelListeners: ['unitChange'], cost: this.skills.passive.cost, passive: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.target && context.type === "downed" && resourceChange(this.vars.caster, this.vars.cost, false)) { heal(this.vars.caster, [this.vars.target], [1]) } }
                );
            }
        },
        {
            name: "Guardian",
            properties: ["physical", "stamina", "redirect"],
            cost: { stamina: 5 },
            description: "Spends stamina per redirect to redirect all non-aoe attacks on lowest hp frontline unit to self",
            code() {
                new Modifier("Guardian", "Redirects attacks",
                    { caster: this, target: this, duration: 1, properties: ["physical", "stamina"], listeners: { attackStart: true }, cancelListeners: ['attackStart'], cost: this.skills.passive.cost, focus: true, passive: true },
                    function() { },
                    function(context) {
                        if (this.vars.caster.stamina >= this.vars.cost.stamina && !currentAction.at(-2)?.properties?.includes("aoe") && !currentAction.at(-2)?.vars?.properties?.includes("aoe") && context.event === "attackStart" && context.attacker.team !== this.vars.target.team) {
                            let redirect = 0;
                            for (let i = 0; i < context.defenders.length; i++) {
                                const target = context.defenders[i];
                                if (target === this.vars.target || target.team !== this.vars.target.team || target.position !== "front" || context.calcMods.defenders?.[i]?.redirect || !resourceChange(this.vars.caster, this.vars.cost, false)) continue;
                                context.defenders[i] = this.vars.target;
                                ((context.calcMods.defenders ??= [])[i] ??= {}).redirect = [target, this.vars.target];
                                
                                redirect++;
                            }
                            if (redirect > 0) logAction(`${this.vars.caster.name} redirects ${redirect} attack${redirect > 1 ? 's' : ''} to self!`, "crit");
                        }
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    }
                );
            }
        },
        {
            name: "Last Stand",
            properties: ["physical", "stamina", "buff"],
            description: "Increases defense and presence",
            code() { basicModifier("Last Stand", "Increases defense and presence", { caster: this, target: this, properties: ["physical", "buff"], stats: { defense: 15, presence: 100 }, focus: true, passive: true }) }
        },
        {
            name: "Quake Hammer",
            properties: ["physical", "stamina", "attack", "aoe", "multi-target"],
            reduction: { stamina: 50 },
            description: "When hitting an attack, makes an AOE attack with increased attack to 3 random frontline units",
            code() {
                new Modifier("Quake Hammer", "When hitting an attack, makes an AOE attack with increased attack to 3 random frontline units",
                    { caster: this, target: this, properties: ["physical", "attack", "aoe"], listeners: { singleDamage: true }, cancelListeners: ['singleDamage'], reduction: this.skills.passive.reduction, passive: true, attacking: 0 },
                    function() {},
                    function(context) {
                        if (context.attacker !== this.vars.caster || !this.vars.applied || this.vars.attacking) return;
                        if (context.damageSingle > this.vars.attacking++) attack(this.vars.caster, randTarget(unitFilter(this.team === 'player' ? 'enemy' : 'player', 'front', false), 3, true), 1, { attacker: { attack: { bonus: context.damageSingle/2 } } });
                        this.vars.attacking = 0;
                    }
                )
            }
        }
    ],
    augment: [
        {
            name: "Determination",
            properties: ["physical", "stamina", "heal"],
            description: `Moderately heals (~7.5% max HP) at start of turn whenever stamina is at least half`,
            code() {
                new Modifier("Determination", `Heals at start of turn whenever stamina is at least half`,
                    { caster: this, target: this, properties: ["physical", "stamina", "heal"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], focus: true, passive: true },
                    function() {},
                    function(context) { if (this.vars.target === context.unit && 2 * this.vars.target.stamina >= this.vars.target.base.stamina) heal(this.vars.caster, [this.vars.target], [.75]) }
                );
            }
        },
        {
            name: "Last Stand",
            properties: ["physical", "stamina", "buff"],
            description: "Increases defense, resist, and presence",
            code() { basicModifier("Last Stand", "Increases defense, resist, and presence", { caster: this, target: this, properties: ["physical", "buff"], stats: { defense: 20, resist: 20, presence: 125 }, focus: true, passive: true }) }
        }
    ]
}

DexSoldier.defaultSkills = [
    { category: 'special', name: 'Guardian' },
    { category: 'basic', name: 'Hammer, Hammer, Hammer!' },
    { category: 'secondary', name: 'Last Stand' },
    { category: 'passive', name: 'But It Refused' },
    { category: 'augment', name: 'Determination' }
];