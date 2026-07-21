import fs from "node:fs";

const breeding = JSON.parse(fs.readFileSync("public/data/breeding-data.json", "utf8"));
const characters = JSON.parse(fs.readFileSync("/tmp/palworld-save-tools-current/resources/game_data/characters.json", "utf8"));
const skills = JSON.parse(fs.readFileSync("/tmp/palworld-save-tools-current/resources/game_data/skills.json", "utf8"));
const passiveHtml = fs.readFileSync("/tmp/pal-passives-cn.html", "utf8");

const palByEnglishName = new Map(breeding.pals.map((pal) => [pal.name.trim(), pal.id]));
const pals = {};
for (const character of characters.pals) {
  const palId = palByEnglishName.get(character.name.trim());
  if (palId) pals[character.asset] = palId;
}

const passives = {};
for (const match of passiveHtml.matchAll(/class="flex-grow-1 mx-2">([^<]+)<div>([^<]+)<\/div>/g)) {
  const [, name, asset] = match;
  passives[asset.trim()] = name.trim();
}

const passiveRanks = Object.fromEntries(skills.passives
  .filter((passive) => passive.category === "EPalPassiveCategory::SortDisplayable")
  .map((passive) => [passive.asset, passive.rank]));

const output = {
  generatedAt: new Date().toISOString(),
  sources: {
    pals: "PalworldSaveTools resources/game_data/characters.json",
    passives: "https://paldb.cc/cn/PassiveSkills_Table",
  },
  pals,
  passives,
  passiveRanks,
};

fs.writeFileSync("public/data/save-import-index.json", `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${Object.keys(pals).length} Pal IDs, ${Object.keys(passives).length} passive names and ${Object.keys(passiveRanks).length} passive ranks.`);
