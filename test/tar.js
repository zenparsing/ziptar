var Path = require("path");

import { tar, untar, extract } from "../src/main.js";

var file = Path.join(__dirname, "_temp/tar-sample.tar.gz");

export async function main() {
    
    await extract(file);
    /*
    var reader = await TarReader.open(file, true),
        entry;
    
    while (entry = await reader.nextEntry()) {
    
        console.log(`${ entry.name } (${ entry.type }) ${ entry.size }`);
    }
    
    await reader.close();
    */
}
