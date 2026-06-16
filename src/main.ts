import "@logseq/libs";
import type { SettingSchemaDesc } from "@logseq/libs/dist/LSPlugin";

const settingsSchema: SettingSchemaDesc[] = [
  {
    key: "language",
    type: "string",
    title: "Language to use for definitions",
    description: "What language do you want to default to when defining?",
    default: "en",
  },
];

const removeBrackets = /[\[\]]/g;

// Cache the medical dictionary in memory so it's only loaded over the network once
let medicalDictionaryCache: Record<string, string> | null = null;

async function loadMedicalDictionary() {
  if (medicalDictionaryCache) return medicalDictionaryCache;
  try {
    const response = await fetch('./medical-dictionary.json');
    medicalDictionaryCache = await response.json();
    return medicalDictionaryCache;
  } catch (err) {
    console.error("Failed to load local medical dictionary cache:", err);
    return null;
  }
}

async function main() {
  // -----------------------------------------
  // General Dictionary Command
  // -----------------------------------------
  logseq.Editor.registerSlashCommand("Define", async () => {
    const block = await logseq.Editor.getCurrentBlock();
    if (!block) return;
    
    let content = await logseq.Editor.getEditingBlockContent();
    content = content.replaceAll(removeBrackets, "");

    const lang = logseq.settings?.language ?? "en";
    try {
      const request = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/${lang}/${content}`
      );
      const result = await request.json();
      if (result.message) throw new Error("word not found");
      
      const firstAudio = result[0].phonetics.find((p: any) => p.audio);
      const phonetic = firstAudio
        ? {
            content: "phonetic",
            children: [
              {
                content: `${firstAudio.text}\n<audio controls><source src="${firstAudio.audio}"></audio>`,
              },
            ],
          }
        : {
            content: "phonetic",
            children: [
              {
                content: result[0].phonetic,
              },
            ],
          };
          
      const blocks = [phonetic].concat(
        result[0].meanings.map((meaning: any) => {
          return {
            content: meaning.partOfSpeech,
            children: meaning.definitions.map((def: any) => {
              return {
                content: def.definition,
              };
            }),
          };
        })
      );
      
      await logseq.Editor.insertBatchBlock(block.uuid, blocks, {
        sibling: false,
      });
    } catch (err) {
      logseq.UI.showMsg(`error defining word ${content}: ${err}`, "error");
    }
  });

  // -----------------------------------------
  // Medical Dictionary Command
  // -----------------------------------------
  logseq.Editor.registerSlashCommand("DefineM", async () => {
    const block = await logseq.Editor.getCurrentBlock();
    if (!block) return;

    let content = await logseq.Editor.getEditingBlockContent();
    content = content.replaceAll(removeBrackets, "").trim();

    try {
      const dict = await loadMedicalDictionary();
      if (!dict) throw new Error("Medical dictionary JSON file not found.");

      // Perform a case-insensitive lookup
      const rawHtmlDefinition = dict[content.toLowerCase()];
      if (!rawHtmlDefinition) throw new Error("Medical term not found in local dictionary.");

      // Strip MDX HTML formatting to match the clean JSON structure of the standard API
      const cleanText = rawHtmlDefinition.replace(/<[^>]*>?/gm, '').trim();

      const blocks = [
        {
          content: "Medical Definition",
          children: [
            {
              content: cleanText,
            },
          ],
        }
      ];

      await logseq.Editor.insertBatchBlock(block.uuid, blocks, {
        sibling: false,
      });
    } catch (err) {
      logseq.UI.showMsg(`Error defining medical term '${content}': ${err}`, "error");
    }
  });
}

logseq.useSettingsSchema(settingsSchema);
logseq.ready(main).catch(() => console.error);
