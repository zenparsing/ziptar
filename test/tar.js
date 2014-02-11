module Path from "node:path";

import { TarReader } from "../src/TarFile.js";

var file = Path.join(__dirname, "_temp/tar-sample.tar.gz");

export async main() {
    
    var reader = await TarReader.open(file, true),
        entry;
    
    while (entry = await reader.nextEntry()) {
    
        console.log(`${ entry.name } (${ entry.type }) ${ entry.size }`);
    }
    
    await reader.close();
}
