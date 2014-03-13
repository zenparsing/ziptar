module Path from "node:path";

import { tar, untar } from "../src/main.js";

var zipSource = Path.join(__dirname, "../src"),
    zipFile = Path.join(__dirname, "_temp/archive.tar.gz"),
    temp = Path.join(__dirname, "_temp");

export async function main() {
    
    var source = [zipSource];
    
    if (process.argv.length > 2)
        source = process.argv.slice(2);
    
    var t;
    
    t = +new Date;
    process.stdout.write(`taring [${ Path.basename(source) }]...`);
    await tar(source, zipFile, { zip: true });
    process.stdout.write(`done in ${((+new Date() - t) / 1000).toFixed(2)}s.\n`);
    
    t = +new Date;
    process.stdout.write(`untaring [${ Path.basename(zipFile) }]...`);
    await untar(zipFile, temp, { unzip: true });
    process.stdout.write(`done in ${((+new Date() - t) / 1000).toFixed(2)}s.\n`);
}
