module Path from "node:path";

import { zip, unzip } from "../src/main.js";

var zipSource = Path.join(__dirname, "../src"),
    zipFile = Path.join(__dirname, "_temp/archive.zip"),
    temp = Path.join(__dirname, "_temp");

export async main() {
    
    var source = zipSource;
    
    if (process.argv[2])
        source = Path.resolve(process.argv[2]);

    var t;
    
    t = +new Date;
    process.stdout.write(`zipping [${ Path.basename(source) }]...`);
    await zip(source, zipFile);
    process.stdout.write(`done in ${((+new Date() - t) / 1000).toFixed(2)}s.\n`);
    
    t = +new Date;
    process.stdout.write(`unzipping [${ Path.basename(zipFile) }]...`);
    await unzip(zipFile, temp);
    process.stdout.write(`done in ${((+new Date() - t) / 1000).toFixed(2)}s.\n`);
}
