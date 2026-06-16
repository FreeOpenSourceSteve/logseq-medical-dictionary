// scripts/convert-mdx.js
import fs from 'fs';
import pkg from 'js-mdict'; 

const Mdict = pkg.MDX || pkg.default || pkg;

const MDX_PATH = "./Black's Medical Dictionary, 43rd Edition.mdx";
const OUTPUT_PATH = "./public/medical-dictionary.json";

async function convert() {
  console.log("Loading MDX dictionary...");
  try {
    const dict = new Mdict(MDX_PATH);
    const parsedData = {};

    console.log(`Found ${dict._num_entries} total entries.`);
    console.log("Extracting definitions...");

    let successCount = 0;

    if (Array.isArray(dict._key_list)) {
        for (let i = 0; i < dict._key_list.length; i++) {
            const entry = dict._key_list[i];
            
            // Extract the word from index 1 of the array
            const word = Array.isArray(entry) ? entry[1] : entry;
            const offset = Array.isArray(entry) ? entry[0] : null;
            
            if (word && typeof word === 'string') {
                try {
                    // Try the public lookup method first, fallback to the internal parse method
                    let result = dict.lookup(word);
                    if (!result && typeof dict.parse_defination === 'function') {
                        result = dict.parse_defination(offset, word);
                    }
                    
                    if (result instanceof Promise) result = await result;
                    
                    // Unpack the text if the library wraps it in an object
                    const def = (result && typeof result === 'object') ? (result.definition || result.def || result.text) : result;

                    if (def && typeof def === 'string') {
                        parsedData[word.toLowerCase()] = def;
                        successCount++;
                    }
                } catch (e) {
                    // Silently skip individual corrupted entries
                }
            }
        }
    }

    if (successCount === 0) {
        console.log("⚠️ Extraction failed again. Check the LogSeq developer console.");
    } else {
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(parsedData));
        console.log(`✅ Successfully extracted ${successCount} terms to ${OUTPUT_PATH}`);
    }

  } catch (err) {
    console.error("Failed to parse MDX file:", err);
  }
}

convert();
