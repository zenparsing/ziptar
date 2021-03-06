import * as Path from "node:path";
import * as FS from "zen-fs";
import { File, Directory } from "zen-fs";
import { pumpBytes } from "streamware";

import { ZipReader, ZipWriter } from "./ZipFile.js";
import { TarReader, TarWriter } from "./TarFile.js";

function getArchiveExtension(path) {

    let match = /(\.tar)?\.[^\.]+$/i.exec(Path.basename(path));
    return match ? match[0].toLowerCase() : "";
}

export async function tar(list, dest, options) {

    return createArchive(await TarWriter.open(dest, options), list);
}

export async function untar(source, dest, options) {

    return extractArchive(await TarReader.open(source, options), dest);
}

export async function zip(list, dest, options) {

    return createArchive(await ZipWriter.open(dest, options), list);
}

export async function unzip(source, dest, options) {

    return extractArchive(await ZipReader.open(source, options), dest);
}

async function getReader(source) {

    source = Path.resolve(source);

    let reader;

    switch (getArchiveExtension(source)) {

        case ".tar.gz":
        case ".tgz":
            reader = await TarReader.open(source, { unzip: true });
            break;

        case ".tar":
            reader = await TarReader.open(source, { unzip: false });
            break;

        case ".zip":
            reader = await ZipReader.open(source);
            break;

        default:
            throw new Error("Unknown file type");
    }

    return reader;
}

export async function extract(source, dest) {

    source = Path.resolve(source);
    dest = dest ? Path.resolve(dest) : Path.dirname(source);

    return extractArchive(await getReader(source), dest);
}

export async function listEntries(source) {

    let reader = await getReader(source),
        entries = [];

    for await (let entry of reader.entries())
        entries.push(entry);

    await reader.close();

    return entries;
}

async function createArchive(archive, list) {

    if (typeof list === "string")
        list = [list];

    for (let path of list)
        await add(Path.resolve(path), "");

    await archive.close();

    async function add(path, dir) {

        let filename = Path.basename(path),
            stat = await FS.stat(path),
            isDir = stat.isDirectory();

        if (!isDir && !stat.isFile())
            throw new Error("Invalid path");

        let entry = archive.createEntry(dir + filename + (isDir ? "/" : ""));

        entry.lastModified = stat.mtime;

        if (entry.isFile)
            entry.size = stat.size;

        if (entry.isDirectory) {

            await entry.write();

            let list = (await Directory.list(path))
                .filter(item => item !== ".." && item !== ".")
                .map(item => Path.join(path, item));

            for (let child of list)
                await add(child, entry.name);

        } else {

            await entry.write(File.read(path)::pumpBytes());
        }

    }
}

async function extractArchive(archive, dest) {

    // Create the destination directory
    await Directory.create(dest);

    for await (let entry of archive.entries()) {

        let outPath = Path.join(dest, entry.name);

        if (entry.isDirectory) {

            await Directory.create(outPath, true);

        } else if (entry.isFile) {

            // Create intermediate directories
            await Directory.create(Path.dirname(outPath), true);

            // Write the file
            await File.write(entry.read(), outPath);

            // Set the last modified time for the file
            await FS.utimes(outPath, entry.lastModified, entry.lastModified);
        }
    }

    await archive.close();
}
