import { ZipFile } from "ZipFile.js";
export { ZipFile };

export * from "ZipEntry.js";

export async zip(files, dest, options) {

    var z = new ZipFile;
    
    await z.addFiles(files);
    await z.write(dest);
}

export async unzip(source, dest, options) {

    var z = new ZipFile;
    
    await z.open(source);
    await z.extractAll(dest);
    await z.close();
}