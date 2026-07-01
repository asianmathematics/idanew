class Unit {
    constructor(name, stat, elements, actionsInit, passivesInit) {
        this.name = name;
        this.base = {
            hp: stat[0],
            attack: stat[1],
            defense: stat[2],
            accuracy: stat[3],
            evasion: stat[4],
            focus: stat[5],
            resist: stat[6],
            speed: stat[7],
            presence: stat[8],
            position: stat[9],
            elements: elements,
            healFactor: stat[10],
            stamina: stat[11],
            staminaRegen: stat[12],
        };
        this.mult = {
            attack: 0,
            defense: 0,
            accuracy: 0,
            evasion: 0,
            focus: 0,
            resist: 0,
            speed: 0,
            presence: 0,
            healFactor: 0,
            staminaRegen: 0,
        };
        if (stat[13]) { 
            this.mana = this.base.mana = stat[13];
            this.base.manaRegen = stat[14];
            this.mult.manaRegen = 0;
        }
        if (stat[15]) { 
            this.energy = this.base.energy = stat[15];
            this.base.energyRegen = stat[16];
            this.mult.energyRegen = 0;
        }
        this.elements = this.base.elements;
        this.hp = this.base.hp;
        this.stamina = this.base.stamina;
        this.skills = {};
        this.previousAction = [false, false, false];
        this.stun = false;
        this.cancel = false;
        this.actionsInit = actionsInit;
    }
}

function createUnit(unit, team) {
    const newUnit = cloneUnit(unit);
    let name = unit.name;
    let dupe = 1;
    while (allUnits.filter(obj => obj.name.includes(name)).some(obj => obj.name === name)) { name = `${unit.name} ${++dupe}` }
    newUnit.name = name;
    if (newUnit.position === "mid") newUnit.position = "back";
    newUnit.team = team;
    allUnits.push(newUnit);
    newUnit.actionsInit();
    newUnit.passivesInit?.();
    newUnit.timer = 1000;
    return newUnit;
}

function cloneUnit(unit) {
    const newUnit = {
        name: unit.name,
        description: unit.description,
        previousAction: [false, false, false],
        base: {...unit.base},
        mult: {...unit.mult},
        skills: {},
        elements: [...unit.base.elements],
        stun: false,
        cancel: false,
        learnedSkills: []
    };
    newUnit.actionsInit = unit.actionsInit;
    if (unit.passivesInit) {
        newUnit.passives = {};
        newUnit.passivesInit = unit.passivesInit;
    }
    for (const stat in newUnit.base) newUnit[stat] = newUnit.base[stat];
    return newUnit;
}
export { Unit, createUnit, cloneUnit }