module Path from "node:path";

import { tar, untar } from "../src/main.js";

var zipSource = Path.join(__dirname, "../src"),
    zipFile = Path.join(__dirname, "_temp/archive.tar"),
    temp = Path.join(__dirname, "_temp");

export async main() {
    
    var source = zipSource;
    
    if (process.argv[2])
        source = Path.resolve(process.argv[2]);

    var t;
    
    t = +new Date;
    process.stdout.write(`taring [${ Path.basename(source) }]...`);
    await tar(source, zipFile, { zip: false });
    process.stdout.write(`done in ${((+new Date() - t) / 1000).toFixed(2)}s.\n`);
    
    t = +new Date;
    process.stdout.write(`untaring [${ Path.basename(zipFile) }]...`);
    await untar(zipFile, temp, { unzip: false });
    process.stdout.write(`done in ${((+new Date() - t) / 1000).toFixed(2)}s.\n`);
}
