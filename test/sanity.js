module Path from "node:path";

import { zip, unzip } from "../src/main.js";

var zipSource = Path.join(__dirname, "../src"),
    zipFile = Path.join(__dirname, "_temp/archive.zip"),
    temp = Path.join(__dirname, "_temp");

export async main() {

    var t;
    
    t = +new Date;
    await zip(zipSource, zipFile);
    console.log(`zipped in ${((+new Date() - t) / 1000).toFixed(2)} s`);
    
    t = +new Date;
    await unzip(zipFile, temp);
    console.log(`unzipped in ${((+new Date() - t) / 1000).toFixed(2)} s`);
}
