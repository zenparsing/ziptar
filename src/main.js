import { ZipFile } from "ZipFile.js";
export { ZipFile };

export * from "ZipEntry.js";

export function zip(files, dest, options) {

    return new ZipFile()
        .addFiles(files)
        .then(zip => zip.write(dest));
}

export function unzip(source, dest, options) {

    return new ZipFile()
        .open(source)
        .then(zip => zip.extractAll(dest))
        .then(zip => zip.close());
}