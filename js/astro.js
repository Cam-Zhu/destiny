// Chinese Astrology calculation engine

const ANIMALS  = ['Rat','Ox','Tiger','Rabbit','Dragon','Snake','Horse','Goat','Monkey','Rooster','Dog','Pig'];
const CHINESE  = ['鼠','牛','虎','兔','龍','蛇','馬','羊','猴','雞','狗','豬'];
const EMOJIS   = ['🐀','🐂','🐅','🐇','🐉','🐍','🐎','🐑','🐒','🐓','🐕','🐖'];
const ELEMENTS = ['Metal','Water','Wood','Fire','Earth'];
const ELEM_CN  = ['金','水','木','火','土'];
const STEMS    = ['庚','辛','壬','癸','甲','乙','丙','丁','戊','己'];
const BRANCHES = ['申','酉','戌','亥','子','丑','寅','卯','辰','巳','午','未'];
const MONTHS_CN   = ['寅','卯','辰','巳','午','未','申','酉','戌','亥','子','丑'];
const MONTHS_ANIM = ['Tiger','Rabbit','Dragon','Snake','Horse','Goat','Monkey','Rooster','Dog','Pig','Rat','Ox'];
const HOUR_BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const HOUR_ANIMALS  = ['Rat','Ox','Tiger','Rabbit','Dragon','Snake','Horse','Goat','Monkey','Rooster','Dog','Pig'];
const POLARITY = ['Yang','Yin'];

function getYearPillar(year) {
  const idx = ((year - 4) % 60 + 60) % 60;
  const animalIdx = ((year - 4) % 12 + 12) % 12;
  const elemIdx = Math.floor((idx % 10) / 2);
  return {
    stem: STEMS[idx % 10],
    branch: BRANCHES[idx % 12],
    animal: ANIMALS[animalIdx],
    animalCN: CHINESE[animalIdx],
    emoji: EMOJIS[animalIdx],
    element: ELEMENTS[elemIdx],
    elemCN: ELEM_CN[elemIdx],
    polarity: POLARITY[idx % 2]
  };
}

function getMonthPillar(month) {
  const m = month - 1;
  return { branch: MONTHS_CN[m], animal: MONTHS_ANIM[m] };
}

function getDayPillar(year, month, day) {
  const base = new Date(1900, 0, 1);
  const d = new Date(year, month - 1, day);
  const days = Math.floor((d - base) / 86400000) + 1;
  const idx = ((days % 60) + 60) % 60;
  const elemIdx = Math.floor((idx % 10) / 2);
  return {
    stem: STEMS[idx % 10],
    branch: BRANCHES[idx % 12],
    element: ELEMENTS[elemIdx],
    elemCN: ELEM_CN[elemIdx],
    polarity: POLARITY[idx % 2]
  };
}

function getHourPillar(hour) {
  if (hour === null || hour === undefined || hour === '') return null;
  const idx = Math.floor(Number(hour) / 2) % 12;
  return { branch: HOUR_BRANCHES[idx], animal: HOUR_ANIMALS[idx] };
}

function buildChart(day, month, year, hour) {
  return {
    year:  getYearPillar(year),
    month: getMonthPillar(month),
    day:   getDayPillar(year, month, day),
    hour:  getHourPillar(hour)
  };
}
